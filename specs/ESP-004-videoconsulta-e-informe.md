# ESP-004 · Videoconsulta, transcripción e informe de apoyo

| | |
|---|---|
| **Estado** | Borrador |
| **Módulo** | `modules/consulta`, `supabase/functions/transcribir`, `supabase/functions/redactar-informe` |
| **Depende de** | ESP-003, ESP-006 |

## 1. Justificación en la tesis

Corresponde a la **Fase 6 de CRISP-DM (Despliegue)**: el sistema no solo detecta, también deriva y apoya. Cuando el modelo marca a un profesional en riesgo, se le ofrece una sesión con un psicólogo; el sistema transcribe la sesión y redacta un borrador de informe que ahorra trabajo administrativo al profesional.

> ⚠️ **Este componente no aparece en el documento de tesis actual.** Debe incorporarse a la metodología o retirarse (documento de arquitectura §8, pendiente 5). Un jurado preguntará por qué existe.

## 2. Propósito

Conectar por videollamada a un participante detectado con un psicólogo, y entregar a ese psicólogo un borrador de informe generado desde la transcripción, que él revisa, corrige y aprueba.

## 3. Fuera de alcance

- El modelo de detección → ESP-005
- La decisión de derivar (automática o revisada) → ESP-006 §11, pendiente 2
- Cualquier forma de diagnóstico automatizado. Ver §5.

## 4. Requisitos funcionales

### Sesión

| ID | Requisito |
|---|---|
| RF-004-01 | Videollamada 1:1 entre participante y psicólogo derivado |
| RF-004-02 | Antes de iniciar, **ambas partes** consienten explícitamente la grabación de esa sesión |
| RF-004-03 | Si cualquiera de los dos rechaza, la sesión ocurre igual pero **sin grabación ni transcripción** |
| RF-004-04 | Se graba únicamente audio, nunca video |

### Transcripción

| ID | Requisito |
|---|---|
| RF-004-05 | Al finalizar, el audio se transcribe de forma asíncrona |
| RF-004-06 | La app muestra el estado: `pendiente`, `procesando`, `lista`, `fallida` |
| RF-004-07 | El audio se conserva junto a la transcripción durante el plazo de retención definido |

### Informe

| ID | Requisito |
|---|---|
| RF-004-08 | Se genera un **borrador** de informe a partir de la transcripción |
| RF-004-09 | El borrador se presenta al psicólogo en estado `sin_revisar` |
| RF-004-10 | El psicólogo puede editar cualquier sección antes de aprobarlo |
| RF-004-11 | Solo un informe aprobado por el psicólogo pasa a estado `aprobado` |
| RF-004-12 | Se conserva tanto el borrador original como la versión aprobada |

## 5. Reglas de negocio

### Seguridad clínica — no negociables

| ID | Regla | Motivo |
|---|---|---|
| RN-004-01 | El informe es un **borrador de apoyo administrativo**. No emite diagnóstico, no clasifica severidad, no recomienda tratamiento ni medicación | La tesis declara explícitamente que el sistema es apoyo y no diagnóstico clínico. Un texto generado que sugiera un diagnóstico convierte al sistema en algo que el proyecto afirma no ser |
| RN-004-02 | Ningún informe llega a un expediente sin aprobación explícita del psicólogo | El profesional colegiado es responsable del contenido clínico. El sistema redacta; la persona responde |
| RN-004-03 | El informe **nunca** se muestra al participante | Un texto sobre el estado psicológico de alguien, leído sin acompañamiento profesional, puede hacer daño |
| RN-004-04 | Se conservan borrador y versión aprobada, con autoría distinguible | Permite auditar cuánto corrigió el profesional — dato valioso, y además protege al psicólogo si el borrador contenía un error |
| RN-004-05 | Si la transcripción falla, no se genera informe. No se redacta desde una transcripción parcial | Un informe basado en media conversación puede omitir justo lo importante y parecer completo |

### Privacidad

| ID | Regla | Motivo |
|---|---|---|
| RN-004-06 | El consentimiento de grabación es **por sesión**, no heredado del consentimiento del estudio | Aceptar participar en una investigación no es aceptar que graben una sesión clínica |
| RN-004-07 | La transcripción sale hacia servicios externos (transcripción y redacción). Esto debe estar declarado en el consentimiento, con nombre de los proveedores | Un participante tiene derecho a saber que su conversación con un psicólogo será procesada por terceros |
| RN-004-08 | Solo el psicólogo con derivación abierta accede a la sesión, la transcripción y el informe | Impuesto por RLS (ESP-006). Ni el investigador ve el contenido clínico |
| RN-004-09 | Audio y transcripción tienen plazo de borrado automático | Datos sensibles de salud (Ley N.º 29733, Perú) |

## 6. Arquitectura

```
Detección (ESP-003)
   → Derivación (ESP-006)
   → Sesión LiveKit 1:1
   → Egress: audio de la sala al bucket
   → Webhook egress_ended
   → Edge Function: transcribir  (Deepgram Nova-3, callback asíncrono)
   → Edge Function: redactar-informe  (Claude Opus 5)
   → Psicólogo revisa, corrige, aprueba
```

Cada paso registra su evento; ningún paso avanza sin que el anterior haya terminado.

## 7. Contratos de datos

```sql
sesiones_consulta
  id, derivacion_id,
  consentimiento_participante, consentimiento_psicologo,   -- RF-004-02
  sala_livekit, iniciada_en, finalizada_en

transcripciones
  id, sesion_id, estado, audio_ruta, texto,
  proveedor, generada_en, borrar_despues_de

informes
  id, sesion_id, transcripcion_id,
  contenido_borrador  jsonb,   -- generado, inmutable
  contenido_aprobado  jsonb,   -- editado por el psicólogo
  estado,                      -- sin_revisar | aprobado | descartado
  modelo, generado_en, aprobado_por, aprobado_en
```

### Estructura del informe

Salida en JSON con esquema fijo (`output_config.format`), no prosa libre. Un esquema explícito impide que el modelo agregue secciones no previstas, como una de "diagnóstico sugerido":

```json
{
  "temas_tratados": ["string"],
  "situaciones_laborales_mencionadas": ["string"],
  "recursos_de_apoyo_mencionados": ["string"],
  "acuerdos_de_la_sesion": ["string"],
  "citas_textuales_relevantes": [{ "texto": "string", "contexto": "string" }]
}
```

Ninguna sección admite interpretación clínica. El modelo **organiza lo que se dijo**; no lo interpreta.

## 8. Modelo y costo

**Claude Opus 5** (`claude-opus-5`), $5 por millón de tokens de entrada y $25 de salida.

Estimación por sesión de 45 minutos:

| Concepto | Cantidad | Costo |
|---|---|---|
| Transcripción de entrada | ~10.000 tokens | $0,05 |
| Informe de salida | ~1.200 tokens | $0,03 |
| **Por sesión** | | **~$0,08** |
| **25 sesiones** | | **~$2** |

El costo es irrelevante; no es criterio de decisión. Usar un modelo más barato para ahorrar dos dólares en un informe sobre la salud mental de alguien sería una mala economía.

### Retención de datos del proveedor

Si el comité de ética exige que las transcripciones **no se retengan** en el proveedor del modelo, hay que consultar la disponibilidad de retención cero para la cuenta antes de enviar el primer audio real. Conviene saber que Claude Fable 5 no está disponible bajo retención cero; Claude Opus 5 no declara esa restricción, pero debe confirmarse por escrito antes del piloto, no después.

## 9. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-004-01 | Sin consentimiento de ambas partes, la sesión no se graba y no existe transcripción | Prueba automatizada |
| CA-004-02 | Un informe recién generado está en `sin_revisar` y no aparece en ningún expediente | Prueba automatizada |
| CA-004-03 | Tras la aprobación, borrador y versión aprobada coexisten y son distinguibles | Prueba automatizada |
| CA-004-04 | Un participante autenticado no puede leer ningún informe, ni el suyo | Prueba automatizada |
| CA-004-05 | Un psicólogo sin derivación abierta no accede a la transcripción | Prueba automatizada |
| CA-004-06 | Con transcripción fallida, no se genera informe | Prueba automatizada |
| CA-004-07 | La salida del modelo valida contra el esquema; no contiene secciones fuera de él | Prueba automatizada |
| CA-004-08 | Cumplido el plazo, audio y transcripción se borran y el informe aprobado permanece | Prueba automatizada |

## 10. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-004-02, RF-004-03 | `supabase/migrations/20260829090400_consulta.sql` — `puede_grabarse()` |
| RF-004-05 … RF-004-07 | `20260829090400_consulta.sql` — tabla `transcripciones` |
| RF-004-09, RF-004-11, RF-004-12 | `20260829090400_consulta.sql` — `informes`, restricción `aprobacion_completa` |
| RN-004-02 | `20260829090400_consulta.sql` — restricción `aprobacion_completa` |
| RN-004-03, RN-004-08 | `20260829090400_consulta.sql` — ausencia deliberada de políticas RLS |
| RN-004-04 | `20260829090400_consulta.sql` — disparador `informes_borrador_inmutable` |
| RN-004-05 | `20260829090400_consulta.sql` — disparador `informes_exigen_transcripcion` |
| RN-004-06 | `20260829090400_consulta.sql` — `sesiones_consulta`, doble consentimiento |
| RN-004-09 | `20260829090400_consulta.sql` — `borrar_datos_vencidos()` |
| RF-004-01, RF-004-04, RF-004-08, RF-004-10 | *pendiente* — Edge Functions y `modules/consulta` |

Verificación de invariantes: `supabase/tests/consulta_invariantes.sql`.

## 11. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| ~~1~~ | ~~Incorporar el componente a la metodología de la tesis~~ — **resuelto:** el componente se conserva; los autores ajustan el documento de tesis | — |
| 2 | Plazo de retención de audio y transcripción | Comité de ética |
| 3 | Confirmar por escrito la política de retención de los proveedores (§8) | Autores |
| 4 | Declarar los proveedores en el texto del consentimiento (RN-004-07) | Autores + comité |
| 5 | ¿El psicólogo colaborador valida la estructura del informe (§7) antes de construirlo? | Autores |

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
| RF-004-10 | El psicólogo puede editar cualquier sección antes de aprobarlo. Lo que edita se **guarda mientras escribe** en una copia de trabajo (`contenido_en_revision`), separada del borrador y de la versión aprobada: puede salir y retomar la nota más tarde. Un informe aprobado ya no se modifica |
| RF-004-11 | Solo un informe aprobado por el psicólogo pasa a estado `aprobado` |
| RF-004-12 | Si la sesión no se grabó, el psicólogo puede abrir un **informe manual** con la misma estructura (motivo, lo que se conversó, observaciones clínicas, acuerdos y seguimiento): borrador vacío, `modelo = 'manual'`, lo escrito va a `contenido_aprobado` al aprobar |
| RF-004-12 | Se conserva tanto el borrador original como la versión aprobada |
| RF-004-13 | El participante puede **pedir una cita** con un psicólogo desde la pestaña Apoyo, en cualquier momento del estudio (activo o detectado): elige día hábil y hora entre las ofrecidas, y opcionalmente escribe en ≤ 240 caracteres de qué quiere hablar. Solo puede haber una cita viva (`solicitada` o `confirmada`) a la vez |
| RF-004-14 | Si el participante no tiene derivación abierta, pedir la cita abre una con `origen = 'solicitud'` asignada al psicólogo activo con menos casos abiertos (misma regla que la detección). Si ya la tiene, la cita cuelga de esa |
| RF-004-15 | El psicólogo ve la cita en su lista y ficha (`cita_por_confirmar` / `cita_confirmada`, hora y motivo) y puede **confirmarla** o **cancelarla**; el participante también puede cancelarla. Al finalizar una sesión de esa derivación la cita pasa a `atendida` |
| RF-004-16 | El participante ve el estado de su cita (pendiente de confirmar / confirmada), el nombre del profesional, y sus citas anteriores; y en la misma pestaña entra a la videollamada cuando el psicólogo abre la sala |
| RF-004-17 | Al salir de la videollamada, el participante recibe un **resumen personal** en PDF: lo que conversó, lo que acordó y recomendaciones de autocuidado, redactadas por el modelo a partir de la **misma transcripción** que alimenta el borrador del psicólogo (Deepgram corre una sola vez). Una pantalla muestra el circuito paso a paso (sesión finalizada → procesando la conversación → recomendaciones con IA → PDF); si la sesión no se grabó o la transcripción no llega en 12 min, recibe recomendaciones generales sin inventar nada de la conversación. Se descarga desde esa pantalla y desde Apoyo. **No es el informe clínico** (RN-004-03 se mantiene): sin observaciones clínicas, sin puntajes, sin valoraciones; el esquema de salida no tiene dónde ponerlos. Solo el participante lo lee (RLS); ni psicólogo, ni investigador, ni empresa |

## 5. Reglas de negocio

### Seguridad clínica — no negociables

| ID | Regla | Motivo |
|---|---|---|
| RN-004-01 | El informe es un **borrador de apoyo administrativo**. No emite diagnóstico, no clasifica severidad, no recomienda tratamiento ni medicación | La tesis declara explícitamente que el sistema es apoyo y no diagnóstico clínico. Un texto generado que sugiera un diagnóstico convierte al sistema en algo que el proyecto afirma no ser |
| RN-004-02 | Ningún informe llega a un expediente sin aprobación explícita del psicólogo | El profesional colegiado es responsable del contenido clínico. El sistema redacta; la persona responde |
| RN-004-03 | El informe **nunca** se muestra al participante. El resumen personal de RF-004-17 es otro documento: en segunda persona, sin contenido clínico, generado sin revisión humana previa y con pie que lo declara orientativo y generado con IA | Un texto sobre el estado psicológico de alguien, leído sin acompañamiento profesional, puede hacer daño |
| RN-004-04 | Se conservan borrador y versión aprobada, con autoría distinguible | Permite auditar cuánto corrigió el profesional — dato valioso, y además protege al psicólogo si el borrador contenía un error |
| RN-004-05 | Si la transcripción falla, no se genera informe **automático**. No se redacta desde una transcripción parcial. El informe manual (RF-004-12) nace sin transcripción y con borrador vacío | Un informe basado en media conversación puede omitir justo lo importante y parecer completo |
| RN-004-10 | El botón de finalizar la llamada no es rojo | El rojo en esta app es de los errores; finalizar una sesión es un acto normal, en tono tierra |
| RN-004-11 | La cita se puede pedir **siempre**, sin que el sistema lo sugiera ni condicione a un nivel | Quien participa en un estudio sobre burnout tiene que poder pedir ayuda sin esperar a que un modelo lo señale. Es una garantía ética, no una función más |
| RN-004-12 | Al pedir la cita se informa que el psicólogo asignado podrá ver nombre y correo de contacto (acceso registrado, RN-006-03). Si una derivación nació de una solicitud, no tuvo sesiones y su cita se cancela, se **cierra en el mismo acto** | La derivación abierta es acceso a la identidad; sin cita ni sesión no hay motivo para mantenerlo |

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
| RN-004-05 | `20260829090400_consulta.sql` — disparador `informes_exigen_transcripcion`, ampliado en `20260918170000_casos_psicologo.sql` |
| RF-004-12 | `20260918170000_casos_psicologo.sql` (columna opcional, política de inserción), `modules/psicologo/datos.ts` (`abrirInformeManual`), `app/psicologo/informe/[id].tsx` |
| RF-004-13 … RF-004-16, RN-004-11, RN-004-12 | `20260918180000_citas.sql` (tabla `citas`, `solicitar_cita`, `confirmar_cita`, `cancelar_cita`, `mis_citas`, trigger `cita_atendida`, `casos_psicologo` con cita), `20260918200000_cita_cancelada_cierra_derivacion.sql`, `modules/consulta/citas.ts`, `app/(participante)/apoyo.tsx`, `modules/psicologo/datos.ts` (`confirmarCita`), `app/psicologo/caso/[id].tsx` |
| RF-004-17 | `20260921130000_resumen_participante.sql` (tabla `resumenes_participante`, bucket `resumenes-participante`, evento `resumen_entregado`), `supabase/functions/resumen-participante` + `_compartido/pdf.ts` (Haiku 4.5 + pdf-lib), `transcripcion-lista` (lanza ambas redacciones en paralelo), `modules/consulta/resumen.ts`, `app/consulta/resumen/[id].tsx`, `app/(participante)/apoyo.tsx` («Tus resúmenes de sesión») |
| Pantallas rev. 2 (Figma «Antes de la Videollamada», «En la Videollamada», «Informe Clínico») | `app/psicologo/consulta/[id].tsx`, `modules/consulta/SalaLiveKit.tsx` (nativo), `app/psicologo/informe/[id].tsx` |
| RN-004-06 | `20260829090400_consulta.sql` — `sesiones_consulta`, doble consentimiento |
| RN-004-09 | `20260829090400_consulta.sql` — `borrar_datos_vencidos()`; programada a diario con pg_cron en `20260921150000_tareas_programadas.sql` |
| RF-004-05 (sesiones huérfanas) | `20260921140000_sesiones_huerfanas.sql` — `cerrar_sesiones_huerfanas()` (cada hora, pg_cron) y trigger `sesiones_una_sala_viva`; `modules/consulta/datos.ts` (`sesionDisponible` solo ofrece salas de las últimas 3 h) |
| RF-004-10 | `20260921120000_informe_en_revision.sql` (`contenido_en_revision`, `revisado_en`, `proteger_borrador` ampliado), `modules/psicologo/datos.ts` (`guardarRevision`), `app/psicologo/informe/[id].tsx` (guardado automático 1,5 s tras la última tecla, al pulsar «Listo» y al salir) |
| RF-004-01, RF-004-04, RF-004-08 | `supabase/functions/token-livekit`, `_compartido/grabacion.ts`, `_compartido/deepgram.ts`, `redactar-informe`, `modules/consulta` |

Verificación de invariantes: `supabase/tests/consulta_invariantes.sql`.

## 11. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| ~~1~~ | ~~Incorporar el componente a la metodología de la tesis~~ — **resuelto:** el componente se conserva; los autores ajustan el documento de tesis | — |
| 2 | Plazo de retención de audio y transcripción | Comité de ética |
| 3 | Confirmar por escrito la política de retención de los proveedores (§8) | Autores |
| 4 | Declarar los proveedores en el texto del consentimiento (RN-004-07) | Autores + comité |
| 5 | ¿El psicólogo colaborador valida la estructura del informe (§7) antes de construirlo? | Autores |

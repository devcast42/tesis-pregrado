# ESP-002 · Recolección longitudinal de datos

| | |
|---|---|
| **Estado** | Aprobada |
| **Módulo** | `modules/recoleccion` |
| **Depende de** | ESP-001 |

## 1. Justificación en la tesis

Alimenta los tres indicadores del estudio y construye el dataset del modelo:

- **Indicador 2** — n.º de profesionales evaluados por unidad de tiempo
- **Indicador 3** — tiempo promedio de detección, calculado desde los eventos que este módulo registra
- **Fase 2 de CRISP-DM** — comprensión de los datos

La recolección longitudinal es irreversible: lo que no se capture el día 1 no existirá nunca para el día 1.

## 2. Propósito

Presentar al participante los cuatro instrumentos en su cadencia, capturar las respuestas ítem por ítem y registrar los eventos de proceso que alimentan los indicadores.

## 3. Fuera de alcance

- Cálculo de puntajes y clasificación → ESP-003
- Definición del contenido psicométrico del OLBI (proviene del Anexo 07 validado)
- Modelo predictivo → ESP-005

## 4. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-002-01 | La app muestra qué instrumentos están pendientes hoy según su cadencia |
| RF-002-02 | Los formularios se renderizan desde la definición almacenada en base de datos, no desde el código |
| RF-002-03 | Cada respuesta se guarda **ítem por ítem**; el puntaje agregado no se almacena |
| RF-002-04 | Se registra `evaluacion_iniciada` al abrir el formulario y `evaluacion_enviada` al enviarlo |
| RF-002-05 | No se permite enviar un formulario incompleto |
| RF-002-06 | Un recordatorio local diario avisa del check-in a una hora configurable |
| RF-002-07 | El participante puede consultar su racha de días completados |
| RF-002-08 | Un formulario ya enviado hoy no se vuelve a solicitar el mismo día |

### Cadencia

| Instrumento | Frecuencia | Duración objetivo |
|---|---|---|
| `estable` | Una vez, al inscribirse | ~2 min |
| `diario` | Diaria | ~30 s |
| `semanal` | Semanal | ~1 min |
| `olbi` | Quincenal | ~4 min |

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-002-01 | Las respuestas son **append-only**: una corrección agrega fila, no sobrescribe | Preserva la trazabilidad del dato longitudinal. Sobrescribir destruye evidencia |
| RN-002-02 | Toda respuesta guarda `formulario_version` | Si un ítem cambia a mitad del estudio, las respuestas dejan de ser comparables sin saber qué versión respondió cada uno |
| RN-002-03 | `iniciado_en` se captura al **montar** la pantalla, no al enviar | Es la mitad del indicador de tiempo. Capturarlo al enviar lo haría siempre cero |
| RN-002-04 | El OLBI **no** se aplica a diario | No está validado para esa cadencia y produce fatiga de respuesta, con deserción y respuestas automáticas |
| RN-002-05 | El cliente nunca calcula ni almacena un puntaje | La puntuación es competencia del servidor (ESP-003); un cliente no puede influir en una detección |

## 6. Contratos de datos

```
formularios                                   (clave, version) PK
  definicion: { titulo, descripcion?, items: ItemDef[] }

ItemDef
  clave, texto, tipo: 'escala'|'numero'|'booleano'|'opcion'
  escala?    { min, max, etiquetaMin?, etiquetaMax? }
  opciones?  { valor, etiqueta }[]
  dimension? invertido?        // solo instrumentos psicométricos

respuestas                                    (append-only)
  id, participante_id, formulario_clave, formulario_version,
  iniciado_en, enviado_en

respuestas_items                              (append-only)
  respuesta_id, item_clave, valor_num, valor_texto

eventos                                       (append-only)
  participante_id, tipo, ocurrido_en, metadata
```

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-002-01 | Dado un formulario enviado, entonces existe una fila en `respuestas_items` por cada ítem de la definición | Prueba automatizada |
| CA-002-02 | Dado un formulario abierto y enviado 45 s después, entonces `enviado_en − iniciado_en ≈ 45 s` | Prueba automatizada |
| CA-002-03 | Dado un formulario con un ítem sin responder, cuando se intenta enviar, entonces se rechaza y se señala el ítem faltante | Manual |
| CA-002-04 | Dado un check-in ya enviado hoy, cuando se vuelve a la pantalla, entonces aparece como completado | Manual |
| CA-002-05 | Consultando la base de datos, no existe ninguna columna que almacene un puntaje agregado | Revisión de esquema |
| CA-002-06 | Dado un cambio en la definición del formulario, entonces las respuestas anteriores conservan su `formulario_version` original | Prueba automatizada |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-002-01, RF-002-08 | `modules/recoleccion/agenda.ts`, `app/hoy.tsx` |
| RF-002-02 | `modules/recoleccion/datos.ts`, `modules/recoleccion/componentes/Campo.tsx` |
| RF-002-03, RF-002-04 | `modules/recoleccion/datos.ts` |
| RF-002-05 | `modules/recoleccion/componentes/Formulario.tsx` |
| RF-002-06 | `modules/recoleccion/recordatorios.ts` |
| RN-002-01, RN-002-02 | `supabase/migrations/20260829090100_esquema_inicial.sql` |

## 9. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Duración total del seguimiento en días | Asesor |
| 2 | Contenido definitivo de los formularios `diario`, `semanal` y `estable` | Autores + asesor |
| 3 | Hora por defecto del recordatorio diario | Autores |

# ESP-003 · Evaluación por umbral OLBI

| | |
|---|---|
| **Estado** | Implementada · revisión 2 (OLBI semanal) **aplicada**; pendiente de la conformidad del asesor |
| **Módulo** | `supabase/functions/evaluar-olbi` |
| **Depende de** | ESP-002 |

## 1. Justificación en la tesis

Este módulo implementa el **método tradicional** de evaluación: puntuar el OLBI y aplicar el punto de corte. En el diseño preexperimental es la **línea base del pretest** contra la cual se compara el sistema propuesto (HE1, HE2, HE3).

**No es el modelo de machine learning.** Es el patrón oro que proporciona las etiquetas de entrenamiento: en la revisión 2 del calendario (ESP-002 §4), **cada viernes** produce una etiqueta por participante.

## 2. Propósito

Dado un envío del OLBI (uno por semana, el viernes), calcular el puntaje por dimensión aplicando la inversión de ítems, compararlo contra los puntos de corte y registrar un evento de detección si corresponde.

## 3. Fuera de alcance

- El modelo predictivo → ESP-005
- El contenido de los ítems: proviene del Anexo 07 validado, cargado en `formularios.definicion`
- La derivación al psicólogo → ESP-004

## 4. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-003-01 | El cálculo se realiza en el servidor, nunca en el cliente |
| RF-003-02 | Los ítems marcados como inversos se recodifican como `min + max − valor` |
| RF-003-03 | Se calcula la media por dimensión sobre los ítems recodificados |
| RF-003-04 | Se compara cada dimensión con su punto de corte |
| RF-003-05 | Si se cumple el criterio de detección, se registra un evento `deteccion` y el participante pasa a estado `detectado` |
| RF-003-06 | Todo evento de detección registra el método que lo produjo |
| RF-003-07 | Si falta cualquier ítem, la evaluación falla; no se puntúa parcialmente |
| RF-003-08 | Solo se puntúan respuestas con `formulario_clave = 'olbi'`; los ítems diarios `od_*` (ESP-002 §4) nunca entran en un puntaje |

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-003-01 | Todo evento de detección lleva `metadata.metodo` | Cuando el modelo entre en operación, las detecciones por umbral y las del modelo deben poder separarse. Sin esta marca el dataset queda contaminado sin remedio |
| RN-003-02 | Se registran también los puntajes y umbrales usados en el evento | Permite auditar una detección meses después, aunque los umbrales hayan cambiado |
| RN-003-03 | El puntaje se recalcula siempre desde los ítems crudos | Cambiar el punto de corte no debe requerir recolectar de nuevo |
| RN-003-04 | Sin umbrales configurados, la función falla; no asume valores por defecto | Un umbral inventado produce detecciones sin respaldo que se toman por reales |
| RN-003-05 | Un cliente no puede insertar eventos de tipo `deteccion` | Impuesto por RLS: solo la `service_role` los escribe |
| RN-003-06 | El OLBI se aplica **semanalmente**, y se declara como supuesto que los puntos de corte de Leclercq et al. (2021), obtenidos con aplicación estándar, se mantienen en aplicación semanal | Existen estudios de diario semanal y diario con el OLBI (Gruszczynska et al., 2021); el corte no se ha revalidado para esa cadencia. Se escribe en métodos, no se esconde |
| RN-003-07 | Los ítems del OLBI se presentan en orden aleatorio cada viernes | Seis aplicaciones seguidas del mismo cuestionario producen respuesta por inercia (retest). El puntaje no depende del orden |

## 6. Contratos de datos

**Entrada** `POST /evaluar-olbi` → `{ respuesta_id: uuid }`

**Definición** (`formularios.definicion` para `clave = 'olbi'`)

```json
{
  "escala": { "min": 1, "max": 4 },
  "items": [{ "clave": "olbi_01", "dimension": "agotamiento", "invertido": false }],
  "umbrales": { "agotamiento": null, "desvinculacion": null },
  "version_umbral": "sin-definir"
}
```

**Salida** → `{ detectado, metodo, puntajes, umbrales }`

**Efecto** si `detectado`: fila en `eventos` (tipo `deteccion`) + `participantes.estado = 'detectado'`.

## 7. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-003-01 | Dado un ítem inverso con valor 1 en escala 1–4, entonces se computa como 4 | Prueba automatizada |
| CA-003-02 | Dada una respuesta con un ítem faltante, entonces devuelve error 422 y no registra evento | Prueba automatizada |
| CA-003-03 | Dado un puntaje bajo los umbrales, entonces no se registra evento y el estado no cambia | Prueba automatizada |
| CA-003-04 | Dada una detección, entonces el evento contiene `metodo`, `puntajes`, `umbrales` y `version_umbral` | Prueba automatizada |
| CA-003-05 | Dado un cliente autenticado, cuando intenta insertar un evento `deteccion`, entonces RLS lo rechaza | Prueba automatizada |
| CA-003-06 | Dados umbrales en `null`, entonces la función no detecta a nadie | Prueba automatizada |

## 8. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-003-01 … RF-003-07 | `supabase/functions/evaluar-olbi/index.ts` |
| RN-003-05 | `supabase/migrations/20260829090100_esquema_inicial.sql` |

## 9. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Puntos de corte de cada dimensión, con referencia bibliográfica. **Cargados:** Leclercq et al. (2021), `leclercq-2021`. Falta la confirmación del asesor | Asesor |
| 2 | Criterio de detección: (a) ambas dimensiones sobre su corte (vigente en la función) o (b) total ≥ 44 (el validado por ROC). **Evidencia nueva a favor de (b):** en el diario de Gruszczynska et al. (2021) agotamiento y desvinculación correlacionan 0.75–0.83 y el modelo unidimensional es más fiable (ω = .85 vs. .66) | Asesor |
| 3 | Textos, dimensiones e ítems inversos del Anexo 07 | Autores |
| 4 | Aprobar la aplicación semanal (RN-003-06) | Asesor |

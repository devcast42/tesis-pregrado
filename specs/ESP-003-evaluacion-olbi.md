# ESP-003 · Evaluación por umbral OLBI

| | |
|---|---|
| **Estado** | Aprobada |
| **Módulo** | `supabase/functions/evaluar-olbi` |
| **Depende de** | ESP-002 |

## 1. Justificación en la tesis

Este módulo implementa el **método tradicional** de evaluación: puntuar el OLBI y aplicar el punto de corte. En el diseño preexperimental es la **línea base del pretest** contra la cual se compara el sistema propuesto (HE1, HE2, HE3).

**No es el modelo de machine learning.** Es el patrón oro que, más adelante, proporcionará las etiquetas de entrenamiento.

## 2. Propósito

Dado un envío del OLBI, calcular el puntaje por dimensión aplicando la inversión de ítems, compararlo contra los puntos de corte y registrar un evento de detección si corresponde.

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

## 5. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-003-01 | Todo evento de detección lleva `metadata.metodo` | Cuando el modelo entre en operación, las detecciones por umbral y las del modelo deben poder separarse. Sin esta marca el dataset queda contaminado sin remedio |
| RN-003-02 | Se registran también los puntajes y umbrales usados en el evento | Permite auditar una detección meses después, aunque los umbrales hayan cambiado |
| RN-003-03 | El puntaje se recalcula siempre desde los ítems crudos | Cambiar el punto de corte no debe requerir recolectar de nuevo |
| RN-003-04 | Sin umbrales configurados, la función falla; no asume valores por defecto | Un umbral inventado produce detecciones sin respaldo que se toman por reales |
| RN-003-05 | Un cliente no puede insertar eventos de tipo `deteccion` | Impuesto por RLS: solo la `service_role` los escribe |

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
| 1 | Puntos de corte de cada dimensión, con referencia bibliográfica | Asesor |
| 2 | Criterio de detección: ¿ambas dimensiones sobre el umbral, o una basta? | Asesor |
| 3 | Textos, dimensiones e ítems inversos del Anexo 07 | Autores |

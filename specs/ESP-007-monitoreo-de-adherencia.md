# ESP-007 · Monitoreo de adherencia

| | |
|---|---|
| **Estado** | Implementada · revisión 2 (días laborables) **aplicada**; pendiente de la conformidad del asesor |
| **Módulo** | `supabase/migrations/20260918110000_adherencia_dias_laborables.sql` (vista); `20260829090200_adherencia.sql` (alertas) |
| **Depende de** | ESP-002 |

## 1. Justificación en la tesis

El muestreo es **censal**: los 100 profesionales son la muestra completa, no una selección de la que se pueda prescindir. Cada participante que deja de responder es un hueco irrecuperable en la serie temporal, y los huecos degradan directamente el insumo del modelo de trayectoria.

También sostiene el **indicador 2** (volumen de profesionales evaluados por unidad de tiempo): sin saber quién está respondiendo, ese número no se puede interpretar.

Un hueco detectado el mismo día se recupera con una llamada. Detectado al final del estudio, no se recupera nunca.

## 2. Propósito

Hacer visible, en cualquier momento, quién está respondiendo y quién dejó de hacerlo, con antelación suficiente para intervenir.

## 3. Fuera de alcance

- Panel web del investigador. La vista se consulta desde Supabase Studio mientras el panel no exista.
- Imputación de datos faltantes: es una decisión de análisis, no de recolección.

## 4. Definiciones

| Término | Definición (revisión 2) |
|---|---|
| **Día esperado** | Día **laborable** (lunes a viernes) transcurrido desde el inicio de seguimiento del participante. Sábados y domingos no cuentan |
| **Día cumplido** | Lunes a jueves: día con al menos un `diario`. Viernes: día con un `olbi` enviado el viernes o dentro de su gracia (sábado–domingo) |
| **Tasa de adherencia** | días cumplidos ÷ días esperados |
| **Días sin check-in** | Días **laborables** transcurridos desde el último formulario del calendario enviado |
| **Viernes esperados / cumplidos** | Se reportan aparte: el viernes es la etiqueta del modelo y su pérdida pesa más que la de un diario |

Revisión 1 (sustituida): día esperado = día calendario; día cumplido = día con `diario`.

### Estados de adherencia

| Estado | Condición | Acción |
|---|---|---|
| `al_dia` | ≤ 1 día sin check-in | Ninguna |
| `en_riesgo` | 2 a 3 días sin check-in | Recordatorio reforzado |
| `inactivo` | ≥ 4 días sin check-in | Contacto directo del equipo |
| `nunca_inicio` | Consintió pero nunca envió un `diario` ni un `olbi` | Contacto directo del equipo |

Los cortes son ajustables en un solo lugar de la migración.

## 5. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-007-01 | Existe una vista con una fila por participante activo, con días sin check-in, tasa de adherencia y estado |
| RF-007-02 | La vista distingue `nunca_inicio` de `inactivo` |
| RF-007-03 | El investigador puede consultar la adherencia agregada por organización |
| RF-007-04 | Al pasar a `en_riesgo`, se registra un evento `alerta_adherencia` |
| RF-007-05 | El evento de alerta se registra una sola vez por episodio, no a diario |
| RF-007-06 | Los participantes en estado distinto de `activo` quedan fuera del monitoreo |
| RF-007-07 | La vista expone `viernes_esperados` y `viernes_cumplidos` por participante, y el panel del investigador los muestra aparte de la tasa general |

## 6. Reglas de negocio

| ID | Regla | Motivo |
|---|---|---|
| RN-007-01 | La adherencia se calcula sobre días **cumplidos**, no sobre número de respuestas | Dos check-ins el mismo día no compensan un día perdido: la serie es diaria |
| RN-007-02 | El día en curso no cuenta como incumplido | El participante todavía puede responder; contarlo penalizaría a todos cada mañana |
| RN-007-03 | La alerta no se repite mientras el episodio siga abierto | Un evento diario por participante inactivo inunda la tabla y esconde las alertas nuevas |
| RN-007-04 | Los participantes detectados salen del monitoreo | Su seguimiento diario terminó por diseño; no es incumplimiento |
| RN-007-05 | El cálculo vive en una vista, no en código de aplicación | Cualquier consumidor —panel, Jupyter, Supabase Studio— obtiene el mismo número. Duplicar la fórmula en la app produciría dos verdades |
| RN-007-06 | Un viernes sin `olbi` es un hueco distinto a un día sin `diario`: se cuenta como día incumplido **y** como viernes perdido | Sin el viernes no hay etiqueta para esa semana: los cuatro diarios de esa semana quedan sin supervisión para el modelo |

## 7. Contrato de datos

```sql
vista adherencia
  participante_id, organizacion_id, codigo_anonimo,
  inicio_seguimiento, ultimo_checkin,
  dias_esperados, dias_cumplidos, tasa_adherencia,     -- solo días laborables (rev. 2)
  viernes_esperados, viernes_cumplidos,                -- rev. 2
  dias_sin_checkin, estado_adherencia
```

Nuevo tipo de evento: `alerta_adherencia`, con `metadata { dias_sin_checkin, estado }`.

## 8. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-007-01 | Dado un participante que responde a diario, entonces su estado es `al_dia` y su tasa es 1 | Prueba automatizada |
| CA-007-02 | Dado un participante con 3 días sin responder, entonces su estado es `en_riesgo` | Prueba automatizada |
| CA-007-03 | Dado un participante que consintió hoy y aún no responde, entonces su estado es `nunca_inicio` y no se cuenta como incumplimiento del día en curso | Prueba automatizada |
| CA-007-04 | Dado un participante con dos check-ins el mismo día, entonces cuenta como un día cumplido | Prueba automatizada |
| CA-007-05 | Dado un participante detectado, entonces no aparece en la vista | Prueba automatizada |
| CA-007-06 | Dado un episodio de riesgo abierto, entonces no se registra una alerta nueva cada día | Prueba automatizada |
| CA-007-07 | Dado un participante que respondió el viernes y hoy es lunes, entonces `dias_sin_checkin` es 1, no 3 (el fin de semana no cuenta) | Prueba automatizada |
| CA-007-08 | Dado un viernes sin `olbi` respondido el domingo, entonces cuenta como viernes cumplido | Prueba automatizada |
| CA-007-09 | Dado un viernes sin `olbi` ni en su gracia, entonces `viernes_cumplidos` no lo cuenta y `dias_cumplidos` tampoco | Prueba automatizada |

## 9. Trazabilidad

| Requisito | Implementado en |
|---|---|
| RF-007-01 … RF-007-03, RF-007-07, RN-007-01 … RN-007-06 | `supabase/migrations/20260918110000_adherencia_dias_laborables.sql` (función `dias_laborables`, vista `adherencia`) |
| RF-007-03 (agregado) | `supabase/migrations/20260829090200_adherencia.sql` (vista `adherencia_por_organizacion`, sin cambios) |
| RF-007-04, RF-007-05 | `supabase/migrations/20260829090200_adherencia.sql` (función `registrar_alertas_adherencia`) |

## 10. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | ~~¿7 días o laborables?~~ **Resuelto en la revisión 2 de ESP-002:** lunes a viernes; el fin de semana se captura con una pregunta el lunes (`horas_fin_de_semana`). Pendiente de la aprobación del asesor al calendario | Asesor |
| 2 | ¿Quién contacta a un participante `inactivo`, y por qué medio? | Autores |
| 3 | Mostrar `viernes_esperados` / `viernes_cumplidos` en el panel del investigador (la vista ya los expone) | Autores |

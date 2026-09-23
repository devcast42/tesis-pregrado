# ESP-005 · Modelo de detección temprana

| | |
|---|---|
| **Estado** | **Revisión 2 — parcialmente implementada.** Preentrenamiento (§5), tabla de versiones, cálculo en SQL y registro de predicciones (§8) están hechos y en producción con la versión `preentrenamiento-v1`. El entrenamiento con datos propios (§5.2 pasos 3–4, §7) espera los datos. Pendiente de la conformidad del asesor a §3. |
| **Módulo** | `modelo/` (nuevo), `supabase/migrations` (vista de semanas), `supabase/functions/evaluar-olbi` (integración) |
| **Depende de** | ESP-002 rev. 2 (calendario semanal), ESP-003 (umbral OLBI), ESP-007 (adherencia) |
| **Diseño** | [docs/diseno-semanal-con-preentrenamiento.md](../docs/diseno-semanal-con-preentrenamiento.md) |

## 1. Justificación en la tesis

El título promete detección **temprana**. El método por umbral (ESP-003) no es temprano: clasifica cuando el OLBI ya dio positivo. El modelo es la única pieza que puede señalar riesgo **antes** de que el instrumento lo confirme, y por tanto la única que justifica OE2 (menos tiempo) y OE3 (más volumen).

Esta especificación existe para evitar el error más común en este tipo de tesis (`docs/requisitos-y-arquitectura.md` §5.1): entrenar un modelo cuyas entradas son los ítems del OLBI y cuya etiqueta sale de esos mismos ítems. Ese modelo aprende la fórmula de puntuación, reporta ~99 % y no detecta nada.

La revisión 2 añade una segunda razón de ser: **el modelo se puede preentrenar con datos públicos** antes de tener un solo participante, y la comparación *con vs. sin preentrenamiento* sobre los datos propios es una contribución de la tesis.

## 2. Propósito

Definir qué predice el modelo, con qué entradas, con qué pesos iniciales, cómo se evalúa y contra qué se compara, de modo que el capítulo de resultados sea defendible con la muestra real (~60–100 personas) y con datos reales aunque el reclutamiento salga corto.

## 3. Formulación (la decisión que hay que aprobar)

### 3.1 Unidad: la semana

Con el calendario de ESP-002 rev. 2, cada semana tiene cuatro check-ins (lunes a jueves) y una etiqueta (el OLBI del viernes). **Una fila por (participante, semana).**

### 3.2 Dos tareas, una arquitectura

| Tarea | Entradas | Etiqueta | Qué aporta |
|---|---|---|---|
| **Nowcast** | lunes a jueves de la semana *t* | OLBI del viernes *t* ≥ umbral | Cada día, la probabilidad de que *esta* semana cruce. Permite señalar el miércoles lo que el instrumento dirá el viernes |
| **Pronóstico** | semana *t* completa, incluido su OLBI | OLBI del viernes *t+1* ≥ umbral | **Aquí vive la «detección temprana»**: una semana de anticipación |

La etiqueta es *estar por encima del umbral*, no *cruzarlo por primera vez*. La transición sería más «temprana» pero con 60 personas tiene demasiado pocos positivos. Se declara.

### 3.3 Qué NO es entrada

- Los 16 ítems del OLBI de la semana *t* en el nowcast. Es el patrón oro de esa fila.
- Los ítems del OLBI de *t+1* en el pronóstico.
- Cualquier dato posterior al viernes de la semana *t*.

Los cuatro ítems diarios `od_*` **sí** son entrada. Son ítems del OLBI en versión diaria, pero no forman el instrumento, no se puntúan y la etiqueta sale de otra aplicación (el OLBI completo del viernes). No hay circularidad: el modelo aprende cómo cuatro señales diarias anticipan un instrumento de 16 ítems aplicado en otro momento.

### 3.4 Por qué esta y no otras

| Formulación | Problema |
|---|---|
| Clasificar el OLBI actual con sus propios ítems | Circular. Precisión ~99 %, valor nulo. |
| Ventana de 14 días → OLBI quincenal (revisión 1) | 60 días daban 3 ejemplos por persona y ninguna variable existía en datos públicos. Sustituida. |
| Análisis de supervivencia | Marco limpio para censura, pero no produce precisión/recall/F1 (Anexo 3). Se menciona en métodos como alternativa. |
| **La propuesta (3.2)** | 5–6 etiquetas por persona en 6 semanas, compatible con el Anexo 3, con el título, y preentrenable. |

### 3.5 Censura

Quien cruza el umbral sale del seguimiento (RN-007-04). Cada participante aporta semanas **hasta su primer cruce inclusive**. Quien termina sin cruzar aporta todas sus semanas con etiqueta 0, pero **es censurado, no negativo limpio**. Se declara en métodos.

## 4. Entradas

Todas calculadas sobre la semana *t*. Dos grupos, y la distinción es la base de §5.

### 4.1 Compartidas con el estudio de referencia

De los cuatro ítems `od_*` (lunes a jueves, escala 1–5):

| Rasgo | Cálculo |
|---|---|
| `T_media` | media de los 4 ítems sobre los días respondidos |
| `T_ultimo` | media de los 4 ítems del último día respondido |
| `T_max` | máximo diario |
| `T_pendiente` | pendiente de la regresión lineal del promedio diario sobre el día |
| `E_media` | media de `od_04` y `od_12` (agotamiento) |
| `D_media` | media de `od_03` y `od_06` (desvinculación) |

**Estos seis rasgos se calculan con la misma función en el preentrenamiento y en operación.** Cualquier diferencia rompe la transferencia (RN-002-07).

### 4.2 Propias

| Origen | Rasgos |
|---|---|
| `diario` | `horas_media`, `horas_max`, `sueno_media`, `sueno_min`, `horas_fin_de_semana` (lunes) |
| `diario` | `dias_respondidos` (0–4): dejar de responder es señal, no solo ruido |
| `semanal` (viernes) | `horas_sobretiempo`, `guardias`, `apoyo_lider` |
| `estable` | las 8 variables tal cual; `rol` y `modalidad` en one-hot |
| Solo pronóstico | `E_previo`, `D_previo`: puntajes del OLBI del viernes *t* |

### 4.3 Versiones a reportar

| Versión | Entradas | Qué demuestra |
|---|---|---|
| **A — solo señales diarias y contexto** | 4.1 + 4.2 sin `E_previo`/`D_previo` | Que las señales baratas tienen valor por sí solas. Sostiene el título |
| **B — A + OLBI previo** | A + `E_previo`, `D_previo` (solo pronóstico) | La versión operativa más fuerte |
| **A₀ / B₀ — sin preentrenamiento** | Las mismas, con pesos iniciales en cero | El control del experimento de §5 |

## 5. Preentrenamiento

### 5.1 Fuente

Gruszczynska, E., Basinska, B. A. y Schaufeli, W. B. (2021). *Within- and between-person factor structure of the Oldenburg Burnout Inventory: analysis of a diary study using multilevel confirmatory factor analysis.* PLOS One, 16(5), e0251257. Datos: Mendeley Data, doi:10.17632/vwp3xvp2x8.2, CC BY 4.0. 235 empleados × 10 días laborales, 8 ítems negativos del OLBI en versión diaria, escala 1–5, sin faltantes.

### 5.2 Procedimiento

1. Con los datos de referencia se construyen filas (persona, semana) idénticas a las de §3: rasgos de §4.1 sobre los días 1–4 y 6–9; etiquetas «día 5 alto» (nowcast) y «semana 2 alta» (pronóstico), con «alto» = media ≥ 3 en escala 1–5 (convención; no hay corte publicado para la versión diaria).
2. Se entrena la regresión logística **solo con los rasgos de §4.1**. Salen los pesos `w₀` y se guardan en `modelo_versiones` con `origen = 'preentrenamiento'`.
3. Con datos propios se entrena el modelo completo (§4.1 + §4.2) **partiendo de `w₀`** para los rasgos compartidos y de cero para los propios, con regularización L2 hacia `w₀` en los compartidos y hacia cero en los propios. El intercepto se ajusta libre.
4. Se reportan A, B, A₀ y B₀ con las mismas particiones.

### 5.3 Lo que transfiere y lo que no

Transfiere la **dirección y magnitud relativa** de los pesos de §4.1. **No** transfiere el intercepto ni la calibración: la etiqueta de referencia («día alto», 1–5) no es la propia (OLBI completo, umbral de Leclercq). No transfiere nada sobre §4.2.

### 5.4 Resultados de la exploración (ya realizados)

`modelo/exploracion/explorar.py`, regresión logística, GroupKFold por persona:

| Tarea | ROC-AUC | PR-AUC |
|---|---|---|
| Lun–jue → viernes alto, 4 ítems | 0.75–0.78 | 0.52–0.55 |
| Semana 1 → semana 2 alta, 4 ítems | 0.87–0.90 | 0.44–0.56 |
| Mismas tareas con los 8 ítems | 0.76 / 0.90 | 0.58 / 0.54 |

Cuatro ítems rinden como ocho, y da igual cuáles cuatro. Rotar ítems distintos por día no baja el AUC pero introduce ±0.50 puntos de diferencia entre conjuntos el mismo día: descartado (RN-002-06).

### 5.5 Versión `preentrenamiento-v1` (en producción)

Nowcast con ventanas de 1 a 4 días (todos los prefijos, 1 880 filas), rasgos de §4.1 más `n_dias`, estandarización + logística L2 (C = 0.5, `balanced`). Validación por persona sobre los datos de referencia:

| Días respondidos | ROC-AUC | Precisión | Recall |
|---|---|---|---|
| 1 | 0.65 | 0.37 | 0.63 |
| 2 | 0.68 | 0.38 | 0.63 |
| 3 | 0.70 | 0.38 | 0.63 |
| 4 | 0.75 | 0.43 | 0.67 |

Es lo que la app traduce a «confianza baja/media» y a «de cada 10 avisos se confirman unos 4». Son cifras del dominio de referencia; las propias se medirán cuando haya datos.

**`preentrenamiento-pronostico-v1`** (pronóstico): semana 1 (lun–jue) → semana 2 alta (media de 5 días ≥ 3). n = 235, 11.5 % positivos. ROC-AUC 0.88, PR-AUC 0.50, recall 0.74, precisión 0.32, Brier 0.135. La app la muestra el viernes como «para la próxima semana», con confianza «media» (tope para versiones preentrenadas, ESP-002 RN-002-10).

**Registro de aciertos.** Cada `prediccion_modelo` queda en `eventos`; el viernes la app confronta la última nowcast de la semana con el OLBI real y se lo dice al participante (ESP-002 RF-002-14). De esos mismos eventos saldrá la precisión del modelo *en este estudio*, sin esperar al cierre.

## 6. Modelo

**Regresión logística regularizada (L2)** como modelo principal.

- Interpretable: los coeficientes son contenido de discusión.
- Con ~300 filas y ~25 entradas es lo máximo que la muestra sostiene sin sobreajustar.
- Admite el preentrenamiento de §5 de forma exacta (regularizar hacia `w₀` en vez de hacia cero).
- Se sirve sin Python: `sigmoide(w·x + b)` en una función de Postgres. Todo queda en Supabase.

**Random forest** como comparación, con las mismas particiones. Si no supera claramente a la logística, se reporta y se descarta.

Nada más profundo. No hay muestra.

## 7. Evaluación

### 7.1 Partición

`GroupKFold(n_splits=5)` por `participante_id`. **Obligatorio.** Se reporta por pliegue, media ± desviación.

### 7.2 Métricas

Precisión, **recall**, **F1**, PR-AUC y ROC-AUC. Nunca precisión sola. El umbral de decisión se ajusta en validación **favoreciendo recall**: un falso negativo es alguien con burnout al que no se llama; un falso positivo es una conversación de más con el psicólogo.

### 7.3 Desbalance

Prevalencia esperada de semanas sobre el umbral: 10–25 %. `class_weight='balanced'` y ajuste del umbral. **Reportar intervalos**: van a ser anchos.

### 7.4 Líneas base

| Línea base | Qué mide | Quién debe superarla |
|---|---|---|
| Clase mayoritaria | Trivial | Todas |
| **«Igual que el viernes pasado»** | Lo que sabe el OLBI solo, sin señales diarias | **A**, en pronóstico |
| **A₀ / B₀** | El mismo modelo sin preentrenamiento | A / B, para que el preentrenamiento demuestre valor |

### 7.5 HE1 — propuesta de reformulación

> El modelo, usando señales diarias de 25 segundos y contexto laboral, anticipa la clasificación del OLBI semanal con recall ≥ *R* y F1 ≥ *F*, y permite señalar riesgo en promedio *N* días antes de la aplicación del instrumento.

*R*, *F* y *N* los fija el asesor. En el nowcast, *N* está acotado entre 1 (jueves) y 4 (lunes) días; en el pronóstico, 7.

## 8. Contratos de datos

**Vista `semanas_modelo`** (a construir): una fila por (participante, semana ISO) con todos los rasgos de §4 y ambas etiquetas. Se calcula en SQL para que entrenamiento y operación usen la misma definición de cada variable. La función que calcula §4.1 se escribe **una vez** en Python (para el preentrenamiento) y **una vez** en SQL, y CA-005-05 verifica que coinciden.

**Tabla `modelo_versiones`**: `version`, `origen` (`preentrenamiento` | `propio`), `tarea` (`nowcast` | `pronostico`), `pesos jsonb`, `umbral_decision`, `metricas jsonb`, `entrenado_en`.

**Evento `prediccion_modelo`**: en `eventos`, con `metadata = {version, tarea, semana, probabilidad, señalado}`. De aquí sale `indicador_precision`.

**Integración con `evaluar-olbi`:** el umbral OLBI **no se retira**. Modelo y umbral corren en paralelo.

## 9. Fuera de alcance

- Redes neuronales o modelos secuenciales. Sin muestra.
- Ajuste de umbrales OLBI a partir del modelo. El umbral es el patrón oro.
- Decidir en código quién ve la probabilidad. Lo decide `modelo_versiones.visible_para` (ESP-002 RN-002-11). Hoy incluye al participante, por pedido del asesor, y la app la muestra siempre con su confianza (ESP-002 RF-002-13).
- Reentrenamiento continuo en producción. Se entrena con el dataset cerrado.

## 10. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-005-01 | Ninguna entrada de la fila (participante, semana *t*) se calcula con datos posteriores al viernes de *t* | Prueba automatizada sobre `semanas_modelo` |
| CA-005-02 | Ningún ítem `olbi_*` de la semana etiquetada aparece entre las entradas | Prueba automatizada |
| CA-005-03 | Cada participante aparece en un solo pliegue | Prueba automatizada |
| CA-005-04 | Ningún participante aporta semanas posteriores a su primer cruce | Prueba automatizada |
| CA-005-05 | Los rasgos de §4.1 calculados en SQL y en Python coinciden para el mismo participante-semana | Prueba automatizada |
| CA-005-06 | La predicción en Postgres coincide con la de scikit-learn para el mismo vector | Prueba automatizada |
| CA-005-07 | Se reportan precisión, recall, F1, PR-AUC y ROC-AUC por pliegue para A, B, A₀, B₀ y las líneas base, en ambas tareas | Revisión del informe |
| CA-005-08 | Los pesos `w₀` del preentrenamiento se reproducen desde `modelo/` con el hash del archivo de referencia verificado | Prueba automatizada |

## 11. Trazabilidad

| Requisito | Implementado en |
|---|---|
| §5.1, §5.4 | `modelo/exploracion/` (README, `descargar.py`, `explorar.py`) |
| §5.2 pasos 1–2 | `modelo/preentrenar.py` → `modelo/versiones/preentrenamiento-v1.json` y `supabase/migrations/20260918130000_modelo_version_preentrenamiento.sql` (generada) |
| §4.1 en SQL, §8 (`modelo_versiones`, predicción, evento `prediccion_modelo`) | `supabase/migrations/20260918120000_modelo_versiones.sql` (`rasgos_semana`), `20260918150000_modelo_pronostico.sql` (`probabilidad_semana`, `registrar_prediccion` con tarea, `ultima_prediccion_semana`) |
| CA-005-05, CA-005-06 | Verificado a mano el 2026-09-18: mismos rasgos y misma probabilidad (0.597) en SQL y en Python para el mismo participante-semana. Falta la prueba automatizada |
| §5.2 pasos 3–4, §7, vista `semanas_modelo` para entrenamiento | **Pendiente** hasta tener datos propios |

## 12. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | **Aprobar la formulación semanal de §3** | Asesor |
| 2 | Fijar *R*, *F* y *N* de HE1 (§7.5) | Asesor |
| 3 | Etiqueta de pronóstico: *estar sobre el umbral* (propuesto) vs. *cruzarlo* | Asesor |
| 4 | Confirmar la prevalencia esperada con literatura peruana o latinoamericana | Autores |
| 5 | Fuerza de la regularización hacia `w₀` (cuánto se confía en el dominio de referencia); se elige en validación y se reporta | Autores |

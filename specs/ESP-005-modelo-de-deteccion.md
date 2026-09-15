# ESP-005 · Modelo de detección temprana

| | |
|---|---|
| **Estado** | **Borrador — propuesta para el asesor.** Nada de esto está implementado ni debe implementarse hasta que se apruebe la formulación (§3). |
| **Módulo** | `modelo/` (nuevo), `supabase/migrations` (vista de ventanas), `supabase/functions/evaluar-olbi` (integración) |
| **Depende de** | ESP-002 (recolección), ESP-003 (umbrales OLBI definitivos), ESP-007 (adherencia) |

## 1. Justificación en la tesis

El título promete detección **temprana**. El método por umbral (ESP-003) no es temprano: clasifica cuando el OLBI ya dio positivo, y el OLBI se aplica cada quince días. El modelo es la única pieza del sistema que puede señalar riesgo **antes** de que el instrumento lo confirme, y por tanto la única que justifica los objetivos OE2 (menos tiempo) y OE3 (más volumen).

Esta especificación existe para evitar el error más común en este tipo de tesis, documentado en `docs/requisitos-y-arquitectura.md` §5.1: entrenar un modelo cuyas entradas son los ítems del OLBI y cuya etiqueta sale de esos mismos ítems. Ese modelo aprende la fórmula de puntuación, reporta ~99% y no detecta nada.

## 2. Propósito

Definir qué predice el modelo, con qué entradas, cómo se evalúa y contra qué se compara — de modo que el capítulo de resultados sea defendible con la muestra real (~100 personas) y no con una que no se tiene.

## 3. Formulación (la decisión que hay que aprobar)

### 3.1 La pregunta que responde el modelo

> Dadas las señales diarias y semanales de contexto laboral de una persona en los últimos 14 días, **¿su próxima medición OLBI va a superar el umbral?**

- **Unidad de análisis:** una fila por cada par *(participante, medición OLBI en el momento t)*.
- **Ventana de entrada:** los 14 días anteriores a *t*. Solo datos que existían antes de la medición.
- **Etiqueta:** `1` si el OLBI en *t* supera el umbral definitivo (ESP-003), `0` si no.
- **El OLBI no es entrada.** Es el patrón oro.

Esto es *nowcasting* con señales baratas: el modelo anticipa lo que el instrumento de 16 ítems va a decir, usando check-ins de 30 segundos. En operación se evalúa cada día con ventana móvil, así que puede señalar a alguien el día 8 en lugar de esperar al día 14. Ahí está lo "temprano".

### 3.2 Por qué esta y no otras

| Formulación | Problema |
|---|---|
| Clasificar el OLBI actual con los ítems del OLBI | Circular (§5.1). Precisión ~99%, valor nulo. |
| Predecir el OLBI de *t+1* (30 días) con la ventana previa a *t* | Es la más ambiciosa, pero divide las filas útiles a la mitad. Con ~100 personas no da. **Se deja como análisis secundario** si la muestra lo permite. |
| Análisis de supervivencia (tiempo hasta el primer cruce) | Es el marco estadístico más limpio para datos censurados (§5.4), pero no produce precisión/recall/F1, que son los indicadores del Anexo 3. **Se menciona en métodos como alternativa**; el asesor decide si la sustituye. |
| **La propuesta (3.1)** | Compatible con la muestra, con los indicadores del Anexo 3 y con el título. |

### 3.3 Censura

Quien cruza el umbral sale del seguimiento diario (RN-007-04). Por tanto cada participante aporta filas **hasta su primer cruce inclusive**, y ninguna después. Quien termina sin cruzar aporta todas sus filas con etiqueta 0, pero **no es un negativo limpio: es censurado**. Se declara en métodos. No se corrige en el modelo.

## 4. Entradas

Todas calculadas sobre la ventana de 14 días previa a *t*. Ningún dato posterior.

### 4.1 Del check-in diario (5 señales × 3 resúmenes)

Para `horas_trabajadas`, `horas_sueno`, `carga_percibida`, `energia_final`:

- **media** en la ventana
- **pendiente** (regresión lineal sobre el día): es la *velocidad de deterioro* de §5.2
- **desviación estándar**: la variabilidad

Y además:

- proporción de días con `trabajo_fuera_horario`
- **tasa de respuesta** en la ventana (días respondidos / 14). Dejar de responder es señal, no solo ruido.

### 4.2 Del resumen semanal (las dos semanas de la ventana)

- Demandas: `horas_sobretiempo` (suma), `proyectos_simultaneos` (máximo), `guardias` (alguna), `reuniones_por_dia` (media)
- Recursos: `autonomia`, `apoyo_lider`, `claridad_rol` (media)

Demandas y recursos son las dos mitades del modelo JD-R que fundamenta el OLBI (§4.3). No son una lista arbitraria.

### 4.3 De la inscripción

Las 8 variables estables tal cual; las categóricas (`rol`, `modalidad`) en one-hot.

### 4.4 El OLBI anterior — dos versiones del modelo

El puntaje OLBI de la medición *anterior* (*t−1*) es legítimo como entrada: se conocía antes de *t*. Y probablemente sea el predictor más fuerte.

Pero incluirlo tiene un coste: si el modelo depende del OLBI anterior, no reduce la dependencia del instrumento, y OE2/OE3 se debilitan.

**Se entrenan y reportan dos versiones:**

| Versión | Entradas | Qué demuestra |
|---|---|---|
| **A — solo contexto** | 4.1 + 4.2 + 4.3 | Que las señales baratas tienen valor por sí solas. Es la que sostiene el título. |
| **B — contexto + OLBI previo** | A + agotamiento y desvinculación en *t−1* | La versión operativa más fuerte. |

Si A no supera la línea base, el resultado honesto es que las señales contextuales no anticipan el OLBI en esta muestra — y eso también es un resultado de tesis.

## 5. Modelo

**Regresión logística regularizada (L2)** como modelo principal.

- Es interpretable: los coeficientes dicen *qué* predice el cruce ("la pendiente del sueño y la proporción de días fuera de horario"), y eso es contenido de discusión, no solo un número.
- Con ~400 filas y ~25 entradas es lo máximo que la muestra sostiene sin sobreajustar (§5.5).
- Se puede servir sin servidor de Python: es `sigmoide(w·x + b)`. Los pesos van en una tabla y la predicción se calcula en una función de Postgres. **Todo queda en Supabase**, como el resto del sistema.

**Random forest** como comparación, con las mismas particiones. Si no supera claramente a la logística, se reporta y se descarta: no vale el coste de interpretabilidad.

Nada más profundo. No hay muestra para ello.

## 6. Evaluación

### 6.1 Partición

`GroupKFold(n_splits=5)` agrupando por `participante_id` (§5.3). **Obligatorio.** Una partición aleatoria mete a la misma persona en entrenamiento y prueba, y el modelo aprende a reconocer personas.

Se reporta la métrica **por pliegue** y su media ± desviación. Con esta muestra, la dispersión entre pliegues dice más que la media.

### 6.2 Métricas

Precisión, **recall**, **F1** y PR-AUC. Nunca precisión sola (§3 del documento de arquitectura: es manipulable).

El umbral de decisión se ajusta en validación **favoreciendo recall**: un falso negativo es alguien con burnout al que no se llama. Un falso positivo es una conversación de más con el psicólogo.

### 6.3 Desbalance

Prevalencia esperada del primer cruce en 60 días: 10–20 %. Con 100 personas, 10–20 positivos. `class_weight='balanced'` y ajuste del umbral. **Reportar los intervalos**: van a ser anchos, y ocultarlo sería peor que mostrarlo.

### 6.4 Líneas base — contra qué se compara

| Línea base | Qué mide |
|---|---|
| Clase mayoritaria (siempre 0) | Trivial. Si no se supera, nada funciona. |
| **Autorregresiva:** "cruza en *t* si cruzó en *t−1*" | Lo que sabe el OLBI solo, sin contexto. **Es la que la versión A tiene que superar** para que las señales contextuales demuestren valor. |

### 6.5 HE1 — propuesta de reformulación

Tal como está, HE1 compara la precisión del modelo contra el OLBI, que define la verdad. Medido contra sí mismo da 100 %: **no se puede ganar** (§5.6).

Propuesta:

> El modelo, usando únicamente señales diarias y semanales de contexto laboral, anticipa la clasificación del OLBI quincenal con recall ≥ *R* y F1 ≥ *F*, y permite señalar riesgo en promedio *N* días antes de la aplicación del instrumento.

*R*, *F* y *N* los fija el asesor. Los tres son medibles con el sistema tal como está construido.

## 7. Contratos de datos

**Vista `ventanas_modelo`** (a construir en PB-30): una fila por *(participante, OLBI en t)* con todas las entradas de §4 y la etiqueta. Es la exportación de entrenamiento y la fuente de predicción en operación. Se calcula en SQL para que el entrenamiento y la operación usen **la misma definición de cada variable**; dos implementaciones divergen en silencio.

**Tabla `modelo_versiones`**: `version`, `pesos jsonb`, `umbral_decision`, `metricas jsonb`, `entrenado_en`. Registra qué modelo estaba activo cuando se hizo cada predicción.

**Evento `prediccion_modelo`**: en `eventos`, con `metadata = {version, probabilidad, señalado}`. De aquí sale `indicador_precision` (PB-34).

**Integración con `evaluar-olbi`:** el umbral OLBI **no se retira**. Modelo y umbral corren en paralelo; es lo que permite medir uno contra el otro.

## 8. Fuera de alcance

- Redes neuronales o modelos secuenciales. Sin muestra.
- Ajuste automático de umbrales OLBI a partir del modelo. El umbral es el patrón oro y no se mueve.
- Explicaciones por participante en la app. El participante nunca ve su estado (ESP-004 RN-004-03).
- Reentrenamiento continuo en producción. Se entrena una vez con el dataset cerrado.

## 9. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA-005-01 | Ninguna entrada del modelo se calcula con datos posteriores a *t* | Prueba automatizada sobre `ventanas_modelo` |
| CA-005-02 | Ningún ítem OLBI de *t* aparece entre las entradas | Prueba automatizada |
| CA-005-03 | Cada participante aparece en un solo pliegue de validación | Prueba automatizada |
| CA-005-04 | Ningún participante aporta filas posteriores a su primer cruce | Prueba automatizada |
| CA-005-05 | La predicción en Postgres coincide con la de scikit-learn para el mismo vector | Prueba automatizada |
| CA-005-06 | Se reportan precisión, recall, F1 y PR-AUC por pliegue, para A, B y las dos líneas base | Revisión del informe |

## 10. Decisiones abiertas

| # | Pendiente | Responsable |
|---|---|---|
| 1 | **Aprobar la formulación de §3.1** o sustituirla por supervivencia | Asesor |
| 2 | Fijar *R*, *F* y *N* de la HE1 reformulada (§6.5) | Asesor |
| 3 | ¿Ventana de 14 días o de 7? 14 alinea con la cadencia del OLBI; 7 daría el doble de filas a costa de más ruido | Asesor + autores |
| 4 | Confirmar la prevalencia esperada con literatura peruana o latinoamericana, para dimensionar el desbalance | Autores |

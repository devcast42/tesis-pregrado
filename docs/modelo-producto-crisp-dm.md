# Modelo de producto — CRISP-DM

Rama `version-simplificada`. Registro de lo aplicado en el paso 3, ordenado por
las seis fases de CRISP-DM.

Esta rama **no es la tesis**. En `main` vive el modelo con su aparato
experimental —versiones A/B/D/F, control sin preentrenamiento, random forest,
cuatro líneas base, análisis de potencia, cohorte simulada—, que es lo que
sostiene un capítulo de resultados. Aquí se construye un producto vendible a una
empresa, y ese aparato sobra.

---

## 1 · Comprensión del negocio

**Quién compra.** Una empresa de tecnología que quiere saber si su gente se está
quemando, sin ver a nadie en particular.

**Qué compra.** El circuito completo, no el modelo:

```
medir → detectar → derivar al psicólogo → atender → informe para el gerente
```

El modelo es el disparador. Si desaparece, el producto sigue funcionando con el
umbral del OLBI; si solo existiera el modelo, no habría nada que vender.

**Criterios de éxito**, en este orden:

| | |
|---|---|
| Adherencia | si la gente no contesta, no hay producto. Es la restricción que manda |
| Funciona el día uno | una empresa no espera tres meses para ver una lectura |
| Explicable | el gerente y su área legal tienen que entender qué se mide |
| Recall sobre precisión | no llamar a quien está mal cuesta más que una conversación de sobra |

**Restricción que decidió el diseño.** La versión de la tesis pide **5 sesiones
y 52 ítems por semana**, con teclado tres veces al día. Ninguna empresa acepta
eso para su equipo. Todo lo demás se subordinó a bajar ese número.

---

## 2 · Comprensión de los datos

Fuentes disponibles en la base:

| Origen | Qué aporta |
|---|---|
| `diario` (lun–jue) | 4 ítems de ánimo en escala 1–5, horas trabajadas, horas dormidas |
| `olbi` (viernes) | el instrumento validado, 16 ítems. Es el patrón oro |
| `semanal` (viernes) | sobretiempo, guardia, apoyo del líder |
| `estable` (inscripción) | 8 preguntas de ficha → 17 columnas al codificarlas |

Dos hallazgos que fijaron el recorte:

**Los 4 ítems diarios son transferibles.** Coinciden con 4 de los 8 del diario
OLBI de Gruszczyńska, Basińska y Schaufeli (2021), 235 empleados × 10 días,
datos abiertos. De ahí salen pesos ya calculados. **Es la única fuente de
arranque en frío que existe**, y condicionó todo lo demás: fundir esos cuatro
ítems en uno habría ahorrado tres toques y costado el arranque.

**La ficha no cabe.** 7 preguntas, 17 columnas. Con la prevalencia esperada
(~13 % de semanas altas) y 60–100 personas habría ~50 casos positivos: incluirla
da 1.5 casos por variable cuando la regla de oro pide 10.

---

## 3 · Preparación de los datos

### 3.1 El check-in diario: de 9 ítems a 6 toques

`supabase/migrations/20261003100000_diario_v4_seis_toques.sql` — **escrita, no
aplicada**: la base es compartida con `main` y aplicarla cambiaría también el
formulario del estudio.

| | v3 (tesis) | v4 (producto) |
|---|---|---|
| Ítems de ánimo | 4 escalas | **4 escalas, idénticas** |
| Horas dormidas | número, teclado | **4 rangos, un toque** |
| Horas trabajadas | número, teclado | **4 rangos, un toque** |
| Desconexión | escala | fuera |
| Contacto fuera de horario | sí/no | fuera |
| Horas de fin de semana | número, teclado (lunes) | fuera |
| **Total** | 9 ítems, 3 con teclado | **6 toques, sin teclado** |

El `valor` de cada rango es su punto medio y es numérico, así que cae en
`valor_num` y `semanas_modelo` lo lee sin cambiar una línea de SQL. Se pierde
precisión y no importa: el modelo usa promedios de la semana.

### 3.2 Los rasgos: de 15–18 a 9

Una fila por (persona, semana). Las entradas resumen la semana `t`; la etiqueta
es el OLBI de `t+1`.

| Bloque | Rasgos | De dónde |
|---|---|---|
| Ánimo | `t_media`, `t_ultimo`, `t_max`, `t_pendiente`, `e_media`, `d_media`, `n_dias` | los 4 ítems diarios |
| Contexto | `sueno_media`, `horas_media` | los dos rangos |

Fuera: la ficha entera (17 columnas), el cuestionario del viernes
(`horas_sobretiempo`, `guardias`, `apoyo_lider`), la recuperación
(`desconexion_media`, `contacto_fuera_horario`) y el OLBI previo
(`e_previo`, `d_previo`).

Los tres del viernes salen por una razón de operación, no de potencia: el
producto muestra una probabilidad **desde el lunes**, y esos datos el lunes
todavía no existen. Entrenar con ellos daría métricas que la app nunca podría
reproducir.

### 3.3 Censura

Quien cruza el umbral sale del seguimiento y no aporta semanas posteriores. Se
hereda tal cual de `main`: está en la vista, no en el código del modelo.

---

## 4 · Modelado

**Una tarea.** *¿El próximo OLBI de esta persona saldrá alto?* Desaparece el
nowcast: dos tareas eran dos modelos, dos tablas de pesos y dos explicaciones.

**Un algoritmo.** Regresión logística con penalización L2. Se elige porque los
pesos se leen en una tabla de nueve filas y se discuten con el cliente. Sin
random forest de comparación: en la tesis es un resultado reportable, en un
producto es trabajo sin comprador.

**El preentrenamiento, que es lo que hace funcionar el día uno.** La
penalización no empuja hacia cero, sino **hacia `w₀`** en los siete rasgos de
ánimo y hacia cero en los dos de contexto:

```
coste = error + λ · (cuánto me alejé de w₀)
```

Es decir: *puedes cambiar lo que ya sabíamos, pero tienes que pagar por ello.*
La fuerza `λ` se elige en validación entre cinco valores, no a dedo.

**Decisiones heredadas que no se tocaron**, porque son correctas y baratas:

| | |
|---|---|
| `GroupKFold` por persona | todas las semanas de alguien caen en el mismo pliegue; repartirlas haría que el modelo reconociera a la persona |
| Clases balanceadas | con 15 % de positivos, un modelo que diga «no» siempre acierta el 85 % y es inútil |
| Umbral por F-beta (β=2) | el recall pesa cuatro veces más que la precisión |
| Umbral fuera de muestra | elegido en un `GroupKFold` interno del pliegue de entrenamiento |

**Una sola línea base:** el preentrenamiento aplicado tal cual, sin reentrenar.
Responde la única pregunta que importa en un producto: *¿hacía falta entrenar
con los datos de esta empresa, o bastaba con lo que ya traíamos?*

---

## 5 · Evaluación

Ejecutado sobre los datos de demostración, **no sobre datos del estudio**:

```
=== EL PRÓXIMO OLBI SALDRÁ ALTO ===
  filas 166  personas 51  positivos 0.036  casos/rasgo 0.7
  base  sin reentrenar      recall 0.83  f1 0.23  roc_auc 0.927
  producto-v1  lam=0.1  umbral=0.968
               recall 0.75±0.43  f1 0.32±0.20  pr_auc 0.58±0.39  roc_auc 0.90±0.14
```

**Nada de esto es un resultado.** Son 6 casos positivos en 166 filas, 0.7 por
rasgo. Las desviaciones (±0.43 en recall) lo dicen solas.

Lo que sí demuestra: el pipeline corre de principio a fin, las particiones por
persona funcionan, el preentrenamiento entra y la línea base se calcula.

**Un detalle que conviene leer bien:** la línea base sin reentrenar saca mejor
ROC-AUC (0.927) que el modelo entrenado (0.90). Es exactamente lo esperable con
6 positivos —entrenar sobre casi nada solo puede empeorar— y es la razón por la
que esa línea base se quedó en la versión simple: avisa de esto sola.

**Las ocho pruebas de fuga siguen pasando.** Se adaptaron dos a la estructura
nueva: CA-005-02 pasa a comprobar que ninguna entrada sale de la semana que se
predice, y CA-005-02b, que el modelo puede opinar cualquier día de la semana.

---

## 6 · Despliegue

`modelo/entrenar.py --publicar` carga la versión en `modelo_versiones` y la deja
activa. Se niega en dos casos:

- si hay filas sintéticas (`DEMO-*`, `SIM-*`) en el entrenamiento;
- si hay menos de 20 personas.

Una empresa no puede estar recibiendo avisos de un modelo entrenado con gente
inventada.

La predicción en operación la sirve Postgres (`probabilidad_semana`), sin
Python: `sigmoide(w·x + b)` cabe en una función. CA-005-06 comprueba que da el
mismo número que scikit-learn.

---

## Lo que se borró de esta rama

| | |
|---|---|
| `modelo/simular.py` | cohorte simulada de 80 personas |
| `modelo/potencia.py` | análisis de potencia por tamaño de muestra |
| En `entrenar.py` | las 7 versiones por tarea, el random forest, tres de las cuatro líneas base, la tarea nowcast |

De 1 188 líneas en tres archivos a **407 en uno**.

---

## Pendiente

| | |
|---|---|
| **Aplicar la migración** | necesita que el producto tenga su propio proyecto de Supabase, o `main` se lleva el cambio por delante |
| **Cadencia del OLBI** | se habló de mensual; el calendario de formularios solo entiende días de la semana (`dias: [5]`). Pasar a mensual necesita tocar la agenda |
| **Entrenar de verdad** | hacen falta 20 personas con semanas completas. Hoy hay 3 |

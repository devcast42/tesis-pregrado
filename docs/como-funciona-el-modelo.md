# Cómo funciona el modelo, en simple

Explicación sin jerga del modelo de detección temprana. La versión técnica y
formal está en [`specs/ESP-005`](../specs/ESP-005-modelo-de-deteccion.md); este
documento es para entenderlo y para escribir el capítulo de métodos.

---

## 1. Qué hace, en una frase

Mira lo que una persona respondió de lunes a jueves y **adivina qué va a salir
en el OLBI del viernes**, antes de que lo responda.

Si adivina bien, se puede avisar el miércoles en vez de esperar al viernes. Eso
es la "detección temprana" del título de la tesis.

---

## 2. Con qué datos

### Todos los días (lunes a jueves), ~35 segundos

| | Pregunta | Para qué |
|---|---|---|
| 1 | Después del trabajo necesitaré más tiempo del habitual para recuperarme | ánimo |
| 2 | Hoy termino el trabajo exhausto y fatigado | ánimo |
| 3 | Hoy hablé de mi trabajo de forma negativa | ánimo |
| 4 | Hoy trabajé casi mecánicamente | ánimo |
| 5 | ¿Cuántas horas trabajaste hoy? | carga |
| 6 | ¿Cuántas horas dormiste anoche? | carga |
| 7 | ¿Lograste desconectarte del trabajo? | recuperación |
| 8 | ¿Te contactaron fuera de horario? | recuperación |
| 9 | ¿Horas trabajadas el fin de semana? (solo lunes) | carga |

### El viernes

El OLBI completo (16 preguntas). **Esta es la respuesta que el modelo intenta
adivinar**, no una entrada.

Además: horas de sobretiempo, si estuvo de guardia, y si contó con apoyo de su
líder.

### Una sola vez, al inscribirse

Edad, rol, antigüedad, modalidad, tamaño de equipo, personas a cargo, traslado.
**Se recogen y se describen en la tesis, pero no entran al modelo** (ver §7).

---

## 3. Cómo calcula

Es una **regresión logística**: se eligió porque los pesos se pueden leer y
discutir en la tesis, a diferencia de modelos más opacos. Lo que sigue es todo
el modelo, sin nada escondido.

### 3.1 Lo que la persona responde ya son números

| Pregunta | Qué contesta | Valor |
|---|---|---|
| «Hoy termino el trabajo exhausto y fatigado» | Nunca / Rara vez / A veces / Seguido / Siempre | **1, 2, 3, 4, 5** |
| «¿Cuántas horas trabajaste hoy?» | escribe un número | **8.5** |
| «¿Te contactaron fuera de horario?» | Sí / No | **1 / 0** |

No hay que convertir nada. La escala de 1 a 5 *es* el número.

### 3.2 De 4 respuestas al día a 3 números al día

Cada día, de las cuatro preguntas de ánimo salen tres promedios:

```
t_dia = (od_04 + od_12 + od_03 + od_06) / 4     el total del día
e_dia = (od_04 + od_12) / 2                      agotamiento
d_dia = (od_03 + od_06) / 2                      desvinculación
```

Si el lunes contestó 2, 3, 2, 2: `t_dia = 2.25`, `e_dia = 2.5`, `d_dia = 2.0`.

### 3.3 De 4 días a los 15 números

Una semana de alguien que va empeorando:

| | od_04 | od_12 | od_03 | od_06 | → `t_dia` |
|---|---|---|---|---|---|
| Lunes | 2 | 3 | 2 | 2 | 2.25 |
| Martes | 3 | 3 | 2 | 3 | 2.75 |
| Miércoles | 3 | 4 | 3 | 3 | 3.25 |
| Jueves | 4 | 4 | 3 | 4 | 3.75 |

**Ánimo — 7 números**, todos de la tabla de arriba:

| Variable | Cómo se calcula | Ejemplo |
|---|---|---|
| `t_media` | promedio de los cuatro `t_dia` | 3.00 |
| `t_ultimo` | el `t_dia` del último día respondido | 3.75 |
| `t_max` | el mayor de los cuatro | 3.75 |
| `t_pendiente` | pendiente de la recta sobre los días | +0.50 |
| `e_media` | promedio de los `e_dia` | 3.25 |
| `d_media` | promedio de los `d_dia` | 2.75 |
| `n_dias` | cuántos días respondió (0 a 4) | 4 |

**Carga — 5 números**, de las dos preguntas numéricas del diario:

| Variable | Cómo se calcula | Ejemplo |
|---|---|---|
| `horas_media` | promedio de las horas trabajadas al día | 9.1 |
| `horas_max` | el día más largo | 11.0 |
| `sueno_media` | promedio de las horas dormidas | 6.2 |
| `sueno_min` | la peor noche | 4.5 |
| `horas_fin_de_semana` | horas trabajadas el fin de semana (se pregunta el lunes) | 3.0 |

**Recuperación — 3 números.** Lo que distingue a dos personas con la misma
jornada:

| Variable | Cómo se calcula | Ejemplo |
|---|---|---|
| `desconexion_media` | promedio de «¿lograste desconectarte?» (escala 1–5) | 2.3 |
| `contacto_fuera_horario` | proporción de días en que lo contactaron (0 a 1) | 0.75 |
| `guardia_previa` | si estuvo de guardia **la semana anterior** (sí/no) | 1 |

> `guardia_previa` mira a la semana pasada a propósito: la guardia de esta
> semana se responde el viernes, y el nowcast tiene que poder opinar desde el
> lunes. En pronóstico se añaden tres que el viernes ya son pasado
> —`horas_sobretiempo`, `guardias` y `apoyo_lider`—: son 18 en total.

Si alguien contestó solo lunes y miércoles, `n_dias` vale 2 y los promedios se
calculan sobre esos dos días. Nada se inventa.

### 3.4 Poner todo en la misma unidad

Las horas trabajadas valen ~8.5 y el ánimo ~2.3. Sumados tal cual, las horas
pesarían más **solo por ser números más grandes**: es sumar soles con
kilómetros. Así que cada número se reemplaza por *qué tan lejos de lo normal
está esta persona*:

```
tipificado = (mi valor − media) / desviación
```

La **media** y la **desviación** no son de esta persona: son de la población de
referencia y vienen guardadas en el modelo. Para `t_media`, media 2.30 y
desviación 0.756. La desviación es «un paso»: casi todo el mundo cae entre
2.30 − 0.76 y 2.30 + 0.76.

Con `t_media` = 3.00:

```
3.00 − 2.30 = +0.70      estoy 0.70 arriba del promedio
0.70 / 0.756 = +0.93     es casi un paso entero
```

| Tipificado | Significa |
|---|---|
| 0 | exactamente el promedio |
| +1 | un paso por encima: ya destaca |
| +2 | dos pasos: entre el 2 % peor |
| −1 | un paso por debajo: mejor que la mayoría |

Quien duerme 5 h cuando la media son 7 con desviación 1 sale en −2. Ahora el
modelo puede sumar ánimo y sueño sin problema: ya no son puntos ni horas, son
pasos desde lo normal. El nombre técnico es **puntuación Z**.

### 3.5 Pesar, sumar y convertir en probabilidad

Cada número tipificado se multiplica por su peso y se suman todos. Con los
pesos que hoy están en producción (los del estudio de referencia, §5):

| Variable | Tipificado | × peso | = aporte |
|---|---|---|---|
| `t_media` | +0.93 | +0.171 | **+0.158** |
| `t_ultimo` | +1.66 | +0.340 | **+0.563** |
| `t_max` | +1.18 | −0.006 | −0.007 |
| `t_pendiente` | +0.91 | −0.030 | −0.028 |
| `e_media` | +0.89 | +0.176 | **+0.156** |
| `d_media` | +0.77 | +0.126 | **+0.097** |
| `n_dias` | +1.34 | −0.018 | −0.024 |
| intercepto | | | −0.122 |
| | | **suma** | **+0.794** |

La suma se aplasta entre 0 y 1 con la **sigmoide**:

```
probabilidad = 1 / (1 + e^(−0.794)) = 0.689  →  69 %
```

Eso es lo que la app muestra. Una suma de −3 da 5 %, una de 0 da 50 %, una de
+3 da 95 %.

**Cómo leer la tabla.** Tres columnas, tres dueños distintos:

| Columna | De quién es |
|---|---|
| Tipificado | **de la persona**: qué tan lejos de lo normal está (§3.4) |
| Peso | **del modelo**: el mismo para todo el mundo |
| Aporte | lo que esa variable, en esta persona, puso en la balanza |

**La suma no es un porcentaje**: son *puntos de riesgo*, una moneda interna.
Cero es «ni idea, 50/50»; positivo se inclina a *sí saldrá alto*; negativo, a
*no*. La sigmoide es lo único que traduce puntos a porcentaje.

**Un peso es un tipo de cambio**: cuántos puntos de riesgo suma esa variable
por cada paso que te alejas de lo normal. Como todos están en la misma moneda,
se comparan directamente — `t_ultimo` (+0.340) pesa el doble que `e_media`
(+0.176). Lo que eso hace en la práctica, moviendo una sola variable desde una
persona promedio:

| Situación | Suma | Probabilidad |
|---|---|---|
| Todo en la media | −0.122 | **47 %** |
| `t_ultimo` un paso arriba | +0.218 | **55 %** |
| `t_ultimo` dos pasos arriba | +0.558 | **64 %** |
| `t_media` un paso arriba | +0.049 | **51 %** |
| `t_max` un paso arriba | −0.128 | **47 %** (no se mueve) |

**El intercepto es el único que no multiplica a nada**: es el punto de partida,
lo que marca alguien exactamente promedio en las siete variables. Sin él, el
modelo estaría obligado a decir 50 % a esa persona aunque los datos digan otra
cosa.

Ni los pesos ni el intercepto los eligió nadie: salen todos de la misma
búsqueda, explicada en §5.2.

### 3.6 Lo que este ejemplo ya enseña

El **71 %** de la señal vino de `t_ultimo` (+0.563 de +0.794): cómo estaba el
jueves importa más que el promedio de la semana. El estado reciente manda sobre
el acumulado.

Y `t_max` tiene peso casi cero. También es un hallazgo: una vez que se sabe el
promedio y el último día, **el peor día no añade nada** —está correlacionado
con los otros dos—.

Poder leer esa tabla y discutirla es exactamente por lo que se eligió una
regresión logística. Con un bosque aleatorio esta conversación no existe.

> **Hoy en operación corren 7 números, no 15**: los de ánimo, que son los
> únicos que el estudio de referencia compartía y por tanto los únicos
> preentrenables. Los 15 son el modelo que se entrena cuando haya datos
> propios. El salto de 7 a 15 es, literalmente, lo que aporta la muestra.

---

## 4. Hace dos predicciones distintas

| Nombre | Pregunta que responde | Cuánto anticipa |
|---|---|---|
| **Nowcast** | ¿El OLBI de *este* viernes saldrá alto? | 1 a 4 días |
| **Pronóstico** | ¿El OLBI del viernes de la *próxima* semana saldrá alto? | 7 días |

El pronóstico es el que sostiene la tesis. El nowcast es útil para la app, pero
anticipar dos días es menos impresionante que anticipar una semana.

---

## 5. De dónde salen los pesos

### 5.1 El truco: preentrenar con datos ajenos

Esto vale la pena entenderlo, porque es una contribución propia de la tesis.

**El problema:** el primer día de estudio no hay datos propios, así que no
habría nada que mostrarle al participante.

**La solución:** existe un estudio polaco publicado (Gruszczynska et al., 2021)
con 235 empleados que respondieron preguntas parecidas durante 10 días. Con
esos datos se entrenó el modelo **antes de empezar**. Por eso la app funciona
desde el lunes de la semana 1.

Las 4 preguntas diarias se eligieron a propósito para que coincidan con 4 de
las 8 del estudio polaco. Si se cambian, se rompe el truco.

**Después**, cuando haya datos propios, el modelo se reentrena partiendo de esos
pesos: puede cambiarlos, pero le cuesta (§5.4).

### 5.2 Cómo se encuentran, en concreto

Un peso no se elige: se busca. La idea completa cabe en una frase.

> Prueba unos pesos, mira cuánto se equivoca, ajústalos, repite hasta que no
> mejore.

**Hacen falta casos con respuesta conocida.** Del estudio de referencia salen
**1 880 ejemplos** (persona-semana, con 1 a 4 días respondidos) de los que ya se
sabe el final: 492 terminaron altos, 1 388 no.

**Equivocarse se cobra según la confianza.** No es «acertó o no»: el modelo
entrega una probabilidad y paga por ella.

| Dijo | Pasó | Castigo |
|---|---|---|
| 90 % | fue alto | casi nada |
| 55 % | cualquiera | poco |
| 90 % | **no** fue alto | **mucho** |

La suma de ese castigo sobre los 1 880 ejemplos es **el coste**. Los pesos
buenos son los que lo dejan más bajo.

**La búsqueda.** Se arranca con todos los pesos en cero —el modelo dice 50 % a
todo— y se repite: calcular el coste, ver en qué dirección baja cada peso,
moverlo un poco. Miles de veces, hasta que ningún movimiento mejora. Es
**descenso de gradiente**, y `scikit-learn` lo resuelve en una línea.

**Se puede comprobar.** Dejando fijos los otros seis pesos y moviendo solo el de
`t_ultimo` sobre los datos reales:

| Peso de `t_ultimo` | Coste |
|---|---|
| al revés (−0.34) | 643.20 |
| cero, se ignora | 604.72 |
| el doble (+0.68) | 603.00 |
| la mitad (+0.17) | 595.67 |
| **el aprendido (+0.340)** | **592.79** ← el mínimo |

El 0.340 no es una preferencia de nadie: es donde el coste toca fondo. Y el
peso negativo es con diferencia lo peor, así que ni siquiera el signo lo puso
una persona: los datos dicen que estar peor el jueves se asocia a terminar
alto.

### 5.3 Dos ajustes que cambian el resultado

**Clases desbalanceadas.** Solo el 26 % de los ejemplos son altos; un modelo que
dijera «nunca» acertaría el 74 % de las veces y sería inútil. Por eso cada
ejemplo alto vale casi el triple al calcular el coste (`class_weight='balanced'`).
Sin esto el modelo aprende a callarse.

**Penalización por pesos grandes.** Al coste se le suma la suma de los pesos al
cuadrado. Un peso enorme suele ser el modelo aferrándose a una casualidad de
estos 1 880 ejemplos; la penalización lo frena, y una variable que no gana su
sitio se queda en casi cero sola. Es la **regularización L2** (`C = 0.5`).

> Por eso `t_max` acabó en −0.006: sabiendo ya el promedio y el último día, el
> peor día no añade lo suficiente como para compensar la penalización. **El
> modelo lo apagó solo.**

### 5.4 Y con datos propios, el giro

Todo lo anterior arranca con los pesos en cero. Con muestra propia el
entrenamiento arranca **desde los pesos de referencia `w₀`**, y la penalización
no empuja hacia cero sino **hacia `w₀`**:

```
coste = error + λ · (cuánto me alejé de w₀)
```

Es decir: *puedes cambiar lo que ya sabíamos, pero tienes que pagar por ello.*

`λ` no se elige a dedo: se prueban cinco valores (0.1, 0.3, 1, 3, 10) y gana el
que mejor funcione **en gente que el modelo no vio**. Un λ grande significa «me
fío del estudio de referencia»; uno chico, «mandan mis datos». Cuál ganó es un
resultado reportable.

**Cuidado:** los polacos son administración pública, no gente de tecnología en
Perú. Por eso el modelo se reporta siempre en dos versiones —con y sin ese
arranque— y se compara cuál funcionó mejor.

---

## 6. Cómo se sabe si funciona

Imagina 100 semanas de seguimiento. En 13 la persona realmente cruzó el umbral.
El modelo levanta la mano en 30, y acierta en 10.

| Medida | Cuenta | Qué significa |
|---|---|---|
| **Recall** | 10 de los 13 reales = 77% | De los que sí estaban mal, ¿a cuántos pillé? |
| **Precisión** | 10 de las 30 señaladas = 33% | De los que señalé, ¿cuántos estaban mal? |
| **ROC-AUC** | 0.75 | Si tomo al azar una semana mala y una buena, ¿le doy más puntaje a la mala? (0.5 = moneda al aire, 1.0 = perfecto) |

**Se prioriza el recall a propósito.** Un falso negativo es alguien quemándose
al que nadie llama. Un falso positivo es una conversación de más con el
psicólogo. El primero es peor.

### Por qué no basta con probarlo una vez

Se parte la gente en 5 grupos: se entrena con 4 y se examina con el que quedó
fuera, 5 veces. Así cada persona sirve de examen una vez.

**Importante:** todas las semanas de una persona van juntas al mismo grupo. Si
se repartieran, el modelo ya "conocería" a esa persona y sacaría mejor nota de
la que merece.

---

## 7. Solo 15 variables, y no por casualidad

Regla conocida en modelos de riesgo: hacen falta **~10 casos positivos por cada
variable**.

La cuenta del estudio: 60–100 personas × 6 semanas ≈ 400 filas, de las cuales
~13% son semanas altas ≈ **50 casos positivos**. Con 50 casos alcanzan unas 5
variables; con 15 ya se va justo; con 30 el modelo memoriza en vez de aprender.

Por eso salió entera la ficha de inscripción. Son **7 preguntas, pero 17
columnas**, porque un modelo lineal convierte cada categoría en un sí/no:

| Pregunta | Columnas |
|---|---|
| Edad, antigüedad en la empresa, antigüedad en el sector, tamaño de equipo, personas a cargo, minutos de traslado | 1 cada una = 6 |
| **Rol** | **8** (¿desarrollo? ¿QA? ¿datos? ¿infra? ¿soporte? ¿diseño? ¿gestión? ¿otro?) |
| **Modalidad** | **3** (¿remoto? ¿híbrido? ¿presencial?) |
| | **17** |

Incluirlas llevaría el modelo de 15 a 32 variables: **1.5 casos por variable**
cuando la regla pide 10.

**Entró una sola en su lugar:** `guardia_previa`. La diferencia es defendible —
`rol = infraestructura` es una *suposición* de que ese puesto suele tener
guardias; `guardia_previa` es un hecho que la persona reportó, y está
disponible desde el lunes.

**Pero se siguen calculando y se reportan.** `entrenar.py` entrena una versión
`A-completo` con las 32, que no se publica: existe para enseñar que con el
doble de variables sale el mismo resultado. En el ensayo simulado la versión
completa en pronóstico cayó a ROC-AUC 0.44, por debajo del azar —la firma del
sobreajuste—. Eso es mejor argumento que decir «las quité porque no cabían».

> **La app sigue preguntando todo.** Solo cambia qué se **estima**. Lo demás
> tiene otros tres usos: describir la muestra en la tesis ("el 34% eran
> desarrolladores…"), segmentar el panel de la empresa (el filtro «Híbrido»
> sale de `modalidad`), y quedar disponible por si la muestra sale mayor de lo
> previsto. Recoger de más se puede; recoger después, no.

---

## 8. Los experimentos de la tesis

El modelo se entrena en varias versiones y se comparan. Eso es el capítulo de
resultados.

| Versión | Qué usa | Qué demuestra |
|---|---|---|
| **D — ánimo** | solo las 4 preguntas de ánimo | cuánta señal viene de preguntar cómo te sientes |
| **F — objetivo** | solo sueño, horas, desconexión, contacto | **la más interesante**: ¿se puede detectar sin preguntar por el ánimo? |
| **A — principal** | las dos cosas | el modelo que se publica |
| **A₀** | igual que A pero sin el arranque polaco | sirve de control: ¿el preentrenamiento aportó? |
| **Random forest** | otro algoritmo | comparación; si no gana claro, se descarta |

Y tres líneas base que hay que superar: predecir siempre "no", predecir según el
OLBI de la semana pasada, y el modelo polaco sin reajustar.

### Por qué F es la versión interesante

Las 4 preguntas diarias **son preguntas del OLBI**. Así que el nowcast predice
el OLBI de 16 preguntas desde un mini-OLBI de 4. Un jurado puede decir: *"eso no
es detectar, es demostrar que un cuestionario se parece a sí mismo"*.

Si en cambio el sueño, las horas y la desconexión también predicen, la
afirmación cambia: *"las condiciones de trabajo anticipan el burnout"*. Es más
fuerte, y además es accionable: la empresa puede bajar las guardias o proteger
los horarios. Con la otra versión lo único que se puede recomendar es "siga
llenando el formulario".

**Los tres desenlaces son publicables**, incluido que F no funcione.

---

## 9. Puntos débiles

De más grave a menos.

1. **Puede que solo demuestre que un cuestionario se parece a sí mismo.** Es lo
   que resuelve el experimento F.
2. **Pocos casos para tantas variables.** 50 positivos y 15 variables: la regla
   pide 10 por variable y habrá 3. Cada participante extra cuenta.
3. **De cada 3 avisos, 2 son falsos.** Es el precio de no perderse a nadie. Hay
   que decidir si el psicólogo aguanta ese volumen.
4. **Los polacos no son peruanos de tecnología.** Controlado comparando con y
   sin preentrenamiento.
5. **El nowcast quizá aporta poco.** El valor está en el aviso de una semana.
6. **Se predice un cuestionario, no un diagnóstico.** Cruzar el umbral del OLBI
   no es "tener burnout". Va en limitaciones.
7. **Nunca aprende de recaídas.** Quien cruza sale del estudio, así que el
   modelo solo ve a la gente antes de su primera vez.
8. **Nada se ha medido con datos reales todavía.** Todos los números probados
   hasta hoy vienen de una cohorte simulada; sirven para verificar que la
   maquinaria funciona, no como resultados.

---

## 10. Las trampas que están bloqueadas

Errores que arruinarían la tesis sin dar ningún síntoma —una fuga de
información produce métricas *mejores*, no un error—. Por eso hay 8 pruebas
automáticas (`modelo/pruebas.py`) que fallan si alguna se rompe:

- Ningún dato posterior al viernes entra como entrada.
- Ningún ítem del OLBI de la semana que se está prediciendo entra como entrada.
- El nowcast no usa el cuestionario del viernes (no existiría el miércoles).
- Nadie aporta semanas después de haber cruzado el umbral.
- Cada persona cae en un solo grupo de examen.
- El cálculo en la base de datos y en Python dan el mismo número.

Además, el programa **se niega a publicar** un modelo entrenado con datos
simulados o con menos de 20 personas.

---

## 11. Qué falta

No es código. Son **participantes**.

- Con **20 personas** ya se puede entrenar de verdad.
- Con **60** sale un capítulo de resultados decente.

El día que existan, se corre un comando y salen todas las versiones comparadas.

### Decisiones que siguen abiertas

- Aprobar la formulación semanal (asesor).
- Fijar qué recall y qué F1 mínimos se consideran éxito (asesor).
- Confirmar las 15 variables antes de reclutar. **No se pueden elegir después
  de ver los datos**: eso invalida el resultado.

---

## 12. Cómo correrlo

```bash
# Verificar que no hay trampas
PYTHONPATH=modelo/exploracion modelo/exploracion/venv/bin/python modelo/pruebas.py

# Entrenar y comparar todas las versiones
modelo/exploracion/venv/bin/python modelo/entrenar.py

# Probar la maquinaria con gente simulada (borrar después con --limpiar)
modelo/exploracion/venv/bin/python modelo/simular.py --cargar
modelo/exploracion/venv/bin/python modelo/entrenar.py --origen simulada
```

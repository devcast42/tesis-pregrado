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

Tres pasos.

**Paso 1 — Resume la semana.** De todas las respuestas diarias saca 15 números.
Por ejemplo, de las 4 preguntas de ánimo saca: el promedio de la semana, el
valor del último día, el peor día, si va subiendo o bajando, y cuántos días
respondió.

**Paso 2 — Pesa cada número.** Cada uno de los 15 tiene un peso aprendido:
*dormir poco suma riesgo, desconectar bien resta riesgo*, y así.

**Paso 3 — Suma y convierte en probabilidad.** El total se transforma en un
número entre 0% y 100%. Eso es lo que la app muestra.

Es una **regresión logística**: se eligió porque los pesos se pueden leer y
discutir en la tesis, a diferencia de modelos más opacos.

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

Aquí hay un truco que vale la pena entender, porque es una contribución propia
de la tesis.

**El problema:** el primer día de estudio no hay datos propios, así que no
habría nada que mostrarle al participante.

**La solución:** existe un estudio polaco publicado (Gruszczynska et al., 2021)
con 235 empleados que respondieron preguntas parecidas durante 10 días. Con
esos datos se entrenó el modelo **antes de empezar**. Por eso la app funciona
desde el lunes de la semana 1.

Las 4 preguntas diarias se eligieron a propósito para que coincidan con 4 de
las 8 del estudio polaco. Si se cambian, se rompe el truco.

**Después**, cuando haya datos propios, el modelo se reentrena partiendo de esos
pesos: puede cambiarlos, pero le cuesta. Si los datos peruanos no dicen nada
distinto, se queda cerca de lo que ya se sabía.

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

Por eso el modelo principal se recortó de 30 a 15. Salieron:

- **rol** (eran 8 columnas: ¿es QA? ¿es diseño?…)
- **modalidad** (eran 3)
- edad, antigüedades, tamaño de equipo, personas a cargo, traslado

Y entró en su lugar **si estuvo de guardia la semana pasada**, que es un dato
real y está disponible desde el lunes.

> **La app sigue preguntando todo.** Solo cambia qué se usa para calcular.
> Lo demás se describe en la tesis ("el 34% eran desarrolladores…").

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

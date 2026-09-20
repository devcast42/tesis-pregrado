# Diseño semanal con preentrenamiento — la idea

Estado: **aplicado en base de datos y app el 2026-09-18** por decisión de los autores; pendiente de la conformidad del asesor.
Sustituye al calendario de ESP-002/ESP-003 (diario + semanal + OLBI quincenal).
Las especificaciones ESP-002, ESP-003, ESP-005 y ESP-007 ya llevan esta
revisión 2 marcada como pendiente de asesor, y la semilla de formularios v2
está en `supabase/migrations/20260918100000_formularios_calendario_semanal.sql`.

---

## 1. En una frase

De lunes a jueves el participante responde **cuatro ítems del OLBI en versión
diaria** más dos datos del día; el **viernes responde el OLBI completo**. El
OLBI del viernes es la etiqueta que enseña al modelo qué significaban los
cuatro días anteriores, y el modelo se **preentrena** con un estudio de diario
publicado que usó exactamente esos ítems diarios.

## 2. Por qué cambiamos el diseño anterior

El diseño anterior (check-in diario de contexto + resumen semanal + OLBI cada
quince días, ~60 días) tenía dos problemas:

| Problema | Consecuencia |
|---|---|
| El OLBI es la etiqueta del modelo y llegaba cada 15 días | 60 días daban 4 OLBI por persona: 3 ejemplos de entrenamiento por persona. Poco. |
| Ninguna variable del check-in existía en ningún dataset público | Cero datos hasta terminar el reclutamiento. Si el reclutamiento fallaba, no había resultados. |

El diseño nuevo resuelve los dos: **una etiqueta por semana** y **una parte del
modelo que se puede entrenar hoy**.

## 3. La semana del participante

| Día | Formulario | Contenido | Tiempo |
|---|---|---|---|
| Lunes a jueves | `diario` | 4 ítems OLBI-diario (escala 1–5) + horas trabajadas + horas dormidas. **Solo el lunes**, además: horas trabajadas el fin de semana | ~25 s |
| Viernes | `olbi` → `semanal` | OLBI completo (16 ítems, 1–4) y, como segunda página, sobretiempo de la semana + guardia/disponibilidad + apoyo del líder | ~4 min |
| Sábado y domingo | — | Nada. Se pregunta el lunes. | — |

El `semanal` deja de ser un formulario aparte: queda reducido a tres ítems y
se presenta a continuación del OLBI, como una sola sesión del viernes. (Se
conserva la clave `semanal` para no tocar vistas ni funciones.) Para el
participante son tres momentos: consentir, el diario, el viernes.

**Duración: 6 semanas.** Cuatro es el mínimo defendible; seis dejan margen
para las semanas que cada persona se pierda.

### 3.1 Los cuatro ítems diarios

Son ítems del OLBI (ya cargados desde el Anexo 07), puestos en presente y en
escala de cinco puntos. Todos **negativos**.

| Hoy… | Ítem OLBI | Dimensión |
|---|---|---|
| Después del trabajo necesitaré más tiempo del habitual para relajarme y recuperarme | olbi_04 | Agotamiento |
| Termino el trabajo exhausto y fatigado | olbi_12 | Agotamiento |
| Hablé de mi trabajo de forma negativa | olbi_03 | Desvinculación |
| Trabajé casi mecánicamente, sin pensar mucho | olbi_06 | Desvinculación |

Escala: 1 Totalmente en desacuerdo · 2 Más bien en desacuerdo · 3 Ni sí ni no ·
4 Más bien de acuerdo · 5 Totalmente de acuerdo.

**Por qué solo negativos.** (a) El estudio de referencia (§5) usó solo los ocho
negativos, así que son los únicos que transfieren. (b) En varias validaciones
del OLBI los ítems positivos forman un factor de redacción propio y son menos
fiables; los autores del estudio de referencia los excluyeron para medir
burnout «puro», sin engagement. (c) Los positivos son de rasgo («este es el
único trabajo en el que me imagino») y no se convierten bien a «Hoy…».
El control de aquiescencia lo hace el OLBI completo del viernes, que sí tiene
los ocho positivos.

**Por qué cuatro y no ocho.** Con los datos de referencia, cuatro ítems
(2 + 2) predicen la semana siguiente igual que ocho: ROC-AUC 0.87–0.90 contra
0.90, y da igual cuáles cuatro (las 36 combinaciones posibles caen en ese
rango). Ver `modelo/exploracion/`.

**Los mismos cuatro ítems todos los días, en orden aleatorio.** Rotar ítems
distintos por día casi no baja la capacidad predictiva (ROC 0.88 vs 0.89 con
los datos de referencia) porque el modelo promedia cuatro días, pero dos
conjuntos de 4 ítems difieren ±0.50 puntos el mismo día: tanto como el cambio
real entre días. La pendiente dejaría de significar «empeoró» y pasaría a
significar «tocaron ítems más duros». Contra la respuesta por inercia basta
barajar el orden.

**Estos ítems no se puntúan como instrumento.** Son entradas del modelo. Nadie
—ni el participante ni el investigador— ve un «OLBI diario». Sigue vigente
RN-002-04 reformulada: *el OLBI completo no se aplica a diario; cuatro ítems
en versión diaria, con precedente publicado, sí, y sin puntuación*.

### 3.2 Por qué viernes y no domingo

- La gente responde en modo trabajo: mayor adherencia.
- Es el calendario del estudio de referencia (lunes a viernes), así que el
  preentrenamiento encaja sin ajustes.
- Lo que se pierde (trabajo de fin de semana, muy relevante en tecnología) se
  recupera con la pregunta del lunes.

## 4. El modelo

Regresión logística regularizada, como en ESP-005. Cambia la unidad: **la
semana**.

### 4.1 Dos tareas, una sola arquitectura

| Tarea | Entradas | Etiqueta | Para qué |
|---|---|---|---|
| **Nowcast** | lunes a jueves de la semana *t* | OLBI del viernes *t* ≥ umbral | Cada día el investigador ve la probabilidad de que esta semana cruce el umbral |
| **Pronóstico** | semana *t* completa (incluido su OLBI) | OLBI del viernes *t+1* ≥ umbral | **Aquí vive la «detección temprana»**: una semana de anticipación |

La etiqueta es *estar por encima del umbral*, no *cruzarlo*. La transición es
más «temprana» pero con 60 personas tendría demasiado pocos positivos.

### 4.2 Entradas

Dos grupos, y la distinción importa para §5:

| Grupo | Rasgos | Origen de los pesos |
|---|---|---|
| **Compartidos** | media, último valor, pendiente y máximo de los 4 ítems diarios (lun–jue); media de agotamiento; media de desvinculación | Preentrenados con el estudio de referencia, ajustados con datos propios |
| **Propios** | horas trabajadas (media, máximo), horas de sueño (media, mínimo), horas de fin de semana, sobretiempo, guardia, apoyo del líder, y para el pronóstico: el OLBI del viernes anterior | Arrancan en cero; los aprenden solo los datos propios |

### 4.3 Salida

Probabilidad `sigmoide(w·x + b)`, servida desde Postgres como hasta ahora. El
participante **nunca** la ve (RN-004-03). El investigador la ve por persona y
por semana.

### 4.4 Validación

GroupKFold por participante; precisión, recall, F1, PR-AUC y ROC-AUC por
pliegue. Dos versiones a comparar en la tesis: **con y sin preentrenamiento**,
sobre los mismos datos propios. Esa comparación es una contribución en sí.

### 4.5 Ejemplos esperados

| Personas | Semanas | Etiquetas por persona | Ejemplos nowcast | Ejemplos pronóstico |
|---|---|---|---|---|
| 60 | 6 | 6 | 360 | 300 |
| 40 | 6 | 6 | 240 | 200 |
| 60 | 4 | 4 | 240 | 180 |

Contra 180 del diseño anterior en el mejor caso.

## 5. El preentrenamiento

### 5.1 Fuente

Gruszczynska, E., Basinska, B. A. y Schaufeli, W. B. (2021). *Within- and
between-person factor structure of the Oldenburg Burnout Inventory: analysis of
a diary study using multilevel confirmatory factor analysis*. PLOS One,
16(5), e0251257. doi:10.1371/journal.pone.0251257.
Datos: Mendeley Data, doi:10.17632/vwp3xvp2x8.2, licencia CC BY 4.0.

### 5.2 Qué hicieron

235 empleados de la administración pública polaca, reclutados por una agencia,
respondieron en línea los **8 ítems negativos del OLBI en versión diaria**
(escala 1–5) durante **10 días laborales consecutivos**, después de la jornada.
Sin OLBI completo, sin contexto. Incentivo de 30 €; deserción del 1 %.
Aprobación ética de la Universidad SWPS.

Hallazgos que usamos: agotamiento y desvinculación correlacionan 0.75–0.83 a
nivel diario; un puntaje único es más fiable que dos (ω = .85 vs. .66 para
desvinculación); 59–70 % de la varianza es intra-persona (cambia de día a día).

### 5.3 Cómo se usa

1. Con los datos polacos se entrena el modelo **solo con los rasgos
   compartidos**, calculados exactamente como los calculará la app (mismos
   4 ítems, misma escala, lunes a jueves). Etiqueta: día 5 alto (nowcast) y
   segunda semana alta (pronóstico).
2. Los pesos resultantes son el **punto de partida** del modelo propio, y la
   regularización lo ancla a ellos: se aleja solo si los datos propios lo
   justifican.
3. Los rasgos propios arrancan en cero. El intercepto `b` y la calibración se
   reajustan **siempre** con datos propios, porque la etiqueta propia (OLBI
   completo, umbral de Leclercq) no es la polaca (día alto en 1–5).

**Condición:** la parte compartida tiene que ser idéntica en ambos lados.
Cambiar la escala, la redacción o los ítems rompe la transferencia.

### 5.4 Lo que ya se probó

Con los datos polacos, regresión logística, validación por persona
(`modelo/exploracion/explorar.py`):

| Tarea | ROC-AUC | PR-AUC | Recall |
|---|---|---|---|
| Lun–jue → viernes alto (8 ítems) | 0.76 | 0.58 | — |
| Lun–jue → viernes alto (4 ítems) | 0.75–0.78 | 0.52–0.55 | — |
| Semana 1 → semana 2 alta (8 ítems) | 0.91 | 0.61 | 0.84 |
| Semana 1 → semana 2 alta (4 ítems) | 0.87–0.90 | 0.44–0.56 | — |

El umbral «alto» = 3 en escala 1–5 es una convención de la exploración; no
existe corte publicado para la versión diaria. La etiqueta de la tesis sigue
siendo el OLBI completo.

## 6. Qué gana la tesis

- **Resultados antes del primer participante.** Si el reclutamiento sale
  corto, hay igual un capítulo de resultados con datos reales.
- **Un experimento propio:** con vs. sin preentrenamiento.
- **Más etiquetas en menos tiempo:** 6 semanas en lugar de 60 días, con casi
  el doble de ejemplos.
- **Menos carga:** 25 segundos al día en lugar del check-in actual de 5
  preguntas; un formulario menos.
- **Apoyo para el criterio de detección (b), total ≥ 44:** el estudio de
  referencia concluye que a nivel diario el OLBI es unidimensional.

## 6b. Retroalimentación al participante (pedido del asesor)

El viernes, al terminar, el participante ve su **nivel** por dimensión (bajo /
a vigilar / alto), un mensaje y recomendaciones concretas para la semana. De
lunes a jueves, un agradecimiento y, si el día lo amerita, un consejo a
partir de las horas trabajadas y dormidas. Reglas: es el nivel del OLBI
(servidor), no la probabilidad del modelo; nunca la palabra «diagnóstico»; el
nivel alto termina en la oferta de la sesión de apoyo. Ver ESP-002 RF-002-12,
RN-002-08 y RN-002-09.

Implicaciones que van en la tesis: el consentimiento lo declara; en métodos
se declara la **reactividad** (ver el propio nivel puede modificar las
respuestas siguientes) como limitación, y como parte del sistema evaluado: en
el diseño pre/post, la retroalimentación es parte del «con sistema».

## 7. Riesgos y cómo se declaran

| Riesgo | Mitigación / cómo se escribe |
|---|---|
| Cambio de dominio (administración pública polaca → tecnología peruana) | La recalibración con datos propios es parte del método, no opcional. Se reporta el modelo con y sin preentrenamiento. |
| El umbral de Leclercq se calculó con aplicación estándar, no semanal | Se declara como supuesto. Existen estudios de diario semanal con el OLBI. |
| Retest: responder lo mismo seis viernes seguidos | Barajar el orden de los ítems cada semana. |
| Adherencia sin incentivo económico (los polacos pagaron 30 €) | 6 semanas con margen; recordatorios; el panel de adherencia muestra el viernes aparte. |
| Llamar «porcentaje de burnout diario» a los 4 ítems | No se hace. Son *estado del día*. El participante ve el nivel del OLBI del viernes; la probabilidad del modelo la ven investigador y psicólogo. |
| Reactividad por la retroalimentación semanal | Se declara como limitación y como componente del sistema evaluado. El nivel se comunica con cuidado y sin cifras clínicas. |

## 8. Decisiones pendientes del asesor

1. Aprobar el calendario semanal y las 6 semanas (reemplaza la «duración del
   seguimiento en días» de la Fase 0 del protocolo).
2. Aprobar la versión diaria de 4 ítems y su escala 1–5.
3. Criterio de detección: (a) ambas dimensiones o (b) total ≥ 44. Este
   documento aporta evidencia a favor de (b).
4. Etiqueta de pronóstico: *estar sobre el umbral la semana siguiente*
   (propuesto) vs. *cruzarlo*.

## 9. Qué cambia en el sistema cuando se apruebe

| Dónde | Cambio |
|---|---|
| ESP-002 | **Hecho.** Calendario lun–jue/viernes; `diario` v2; `semanal` v2 pasa a ser la segunda página del `olbi` del viernes (se conserva la clave para no tocar vistas ni funciones); RN-002-04 reformulada; calendario en la definición (`dias`, `gracia_dias`, `barajar`, `despues_de`) |
| ESP-003 | **Hecho.** OLBI semanal (viernes) con gracia sábado–domingo; supuesto sobre el umbral declarado (RN-003-06); orden aleatorio (RN-003-07) |
| ESP-005 | **Hecho.** Unidad semanal; dos tareas; rasgos compartidos/propios; preentrenamiento; versiones A, B, A₀, B₀ |
| ESP-007 | **Hecho.** Días laborables; viernes con gracia; `viernes_esperados/cumplidos` en la vista (`20260918110000_adherencia_dias_laborables.sql`). Falta mostrarlos en el panel |
| Semilla de formularios | **Hecho.** `diario` v2, `semanal` v2, `olbi` v2 (copia de v1 con título y calendario nuevos). Las v1 quedan como históricas |
| App | **Hecho.** `agenda.ts` lee el calendario de la definición; `Formulario.tsx` filtra por día y baraja; el OLBI encadena a «Sobre tu semana»; recordatorios de lunes a viernes con texto propio el viernes; la pantalla principal cuenta el OLBI como el check-in del viernes y cierra la semana |
| `modelo/` | **Hecho.** `preentrenar.py` produce `w₀` (`versiones/preentrenamiento-v1.json`) y la migración que lo carga; `modelo_versiones`, `rasgos_semana`, `probabilidad_semana` y `registrar_prediccion` en la base; la app muestra la probabilidad con su confianza de lunes a jueves. Pendiente: vista `semanas_modelo` y entrenamiento con datos propios (la vista `ventanas_modelo` de la rev. 1 queda obsoleta) |

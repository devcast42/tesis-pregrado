# Protocolo del estudio — paso a paso

Cómo ejecutar la tesis *Detección temprana del síndrome de Burnout en
Profesionales del Sector Tecnológico mediante Machine Learning*, en orden.

El diseño es **preexperimental con pretest y postest**: se miden los tres
indicadores **sin** el sistema, se implementa, y se vuelven a medir **con** el
sistema. La comparación entre ambas mediciones es la tesis.

---

## Fase 0 · Antes de tocar nada

Nada de lo que sigue funciona si estos puntos no están cerrados. Son
decisiones, no trabajo técnico.

### 0.1 Decisiones del asesor

| Qué | Por qué bloquea |
|---|---|
| **Umbrales del OLBI**, con referencia bibliográfica | Sin punto de corte no hay detección, y el que está cargado es provisional |
| **Duración del seguimiento en días** | Define cuántas mediciones tendrá cada participante |
| **Redacción de HE1** | Tal como está es imposible de ganar — ver §0.2 |
| **Criterio de detección**: ¿ambas dimensiones sobre el umbral, o una basta? | Cambia quién sale detectado |
| **Unidad de emparejamiento** para las pruebas pareadas | Ver §5.1. Si se decide después de recolectar, puede no haber datos para emparejar |

### 0.2 Correcciones al documento de tesis

| Dónde | Problema | Corrección sugerida |
|---|---|---|
| HE1 / OE1 | "Mejorar la precisión respecto al método tradicional" es imposible: el método tradicional es el OLBI, que define la verdad de referencia | Reformular hacia *"automatizar la detección mantiene la precisión del instrumento validado mientras incrementa volumen y reduce tiempo"* |
| Justificación teórica | Menciona *"agotamiento, cinismo e ineficacia profesional"* — las tres dimensiones del **MBI** — pero el instrumento es el **OLBI**, que tiene dos: agotamiento y desvinculación | Hablar de agotamiento y desvinculación, o justificar la referencia al MBI |
| Justificación de CRISP-DM | Dice que el sistema *"no funcionará en tiempo real"*, pero el sistema evalúa y deriva en segundos | Actualizar la frase |
| Anexo 3 | El indicador de precisión, usado solo, es manipulable: marcar a una persona y acertar da 100% | Añadir **recall** y **F1** |
| Capítulo de métodos | No menciona la censura | Declarar que quien termina sin detección está censurado a la derecha |
| Metodología | El componente de videoconsulta e informe no aparece | Incorporarlo a la Fase 6 (Despliegue) o retirarlo |

### 0.3 Aprobaciones

1. **Comité de ética.** Presentar el consentimiento informado, el plazo de
   retención de datos y —si se conserva la videoconsulta— el tratamiento del
   audio clínico.
2. **Acuerdo con cada empresa.** Por escrito: qué datos se recogen, quién
   accede, cuánto se conservan. Varias pedirán NDA.
3. **Remitente institucional.** Pedir a la universidad una dirección de correo
   para el estudio. Afecta directamente la tasa de participación.

---

## Fase 1 · Preparación

### 1.1 Cargar el instrumento

Los 16 ítems del OLBI ya están cargados desde el Anexo 07, con 8 por dimensión
y 4 invertidos en cada una. **Verificar ítem por ítem contra el anexo** antes de
recolectar: un ítem inverso mal marcado contamina toda su dimensión y nada
falla a la vista.

```bash
npx supabase db query --linked --file supabase/tests/verificar_olbi.sql
```

### 1.2 Fijar los umbrales definitivos

Sustituir los provisionales en la migración de semilla y cambiar
`version_umbral`. Cada detección guarda con qué versión se produjo, así que los
datos anteriores se pueden recalcular sin recolectar de nuevo.

### 1.3 Cerrar las variables contextuales

Las cargadas siguen el modelo **JD-R** de Demerouti, el mismo marco del que
deriva el OLBI: demandas (horas, sobretiempo, guardias, proyectos) y recursos
(autonomía, apoyo, claridad de rol). Revisarlas con el asesor: **lo que no se
pregunte el día 1 no existirá nunca para el día 1.**

---

## Fase 2 · PRETEST — medir sin el sistema

**Este es el paso que la mayoría hace mal, y no se puede repetir después.**

Hay que medir los tres indicadores aplicando el OLBI **a mano**, como se haría
sin el sistema: en papel o formulario simple, puntuando manualmente.

### 2.1 Qué medir y cómo

| Indicador | Cómo medirlo a mano | Dónde se anota |
|---|---|---|
| **Volumen** | Cuántos profesionales alcanzas a evaluar completos por unidad de tiempo (semana) | Ficha de Registro, Anexo 5 |
| **Tiempo** | Cronometrar por participante: desde que se le entrega el instrumento hasta que hay un resultado clasificado | Ficha de Registro, Anexo 6 |
| **Precisión** | Concordancia entre la puntuación manual y una verificación independiente de los mismos protocolos | Ficha de Registro, Anexo 4 |

### 2.2 Reglas del pretest

- **Antes de desplegar el sistema.** Si los participantes ya usaron la app, el
  pretest está contaminado.
- **Cronometrar de verdad**, con reloj, no de memoria. El tiempo es el
  indicador que sostiene la palabra "temprana" del título.
- **Registrar también los errores** de transcripción y de suma. Son la base del
  indicador de precisión del método tradicional.
- **Sobre una submuestra basta**, si aplicar el OLBI a mano a los 100 es
  inviable. Declararlo explícitamente en métodos.

### 2.3 Por qué importa tanto

El pretest es la única evidencia de que el sistema mejora algo. Sin él, todos
los resultados del postest son números sin comparación, y las tres hipótesis
quedan sin contrastar.

---

## Fase 3 · Despliegue y recolección

### 3.1 Inscribir

Desde el panel del investigador, uno por uno. El sistema crea la cuenta, asigna
el código anónimo y guarda la identidad en una tabla aparte.

### 3.2 Comunicar antes de que llegue el primer correo

Que el contacto de cada empresa anuncie el estudio y diga desde qué dirección
llegará. Es lo más efectivo para la adherencia y no cuesta nada.

### 3.3 Vigilar la adherencia — a diario

**El mayor riesgo del estudio no es técnico: es que la gente deje de responder.**
El muestreo es censal, así que cada participante perdido es un hueco que no se
compensa.

Revisar el panel cada día y contactar a quien lleve dos o tres días sin
responder. Un hueco detectado hoy se recupera con una llamada; detectado al
cerrar el estudio, no se recupera nunca.

Programar a diario:

- `registrar_alertas_adherencia()`
- `borrar_datos_vencidos()`

### 3.4 Duración

La que fije el asesor. Cada participante acumula un check-in diario, un resumen
semanal y un OLBI quincenal hasta ser detectado o hasta el cierre.

---

## Fase 4 · El modelo (CRISP-DM 2 a 5)

### 4.1 Comprensión de los datos

Exportar el dataset anonimizado y explorarlo en Jupyter: distribuciones,
faltantes, cuántos positivos, cuántos censurados.

### 4.2 Preparación

- **Entradas (X):** los datos contextuales laborales
- **Etiqueta (y):** la clasificación del OLBI

> ⚠️ **No usar los ítems del OLBI como entrada.** Si la etiqueta se deriva de
> los mismos ítems que alimentan el modelo, el modelo solo reproduce la fórmula
> de puntuación: daría ~99% de precisión y sería inútil, porque para usarlo
> seguirías necesitando aplicar el cuestionario. Ahí se caen OE2 y OE3.

### 4.3 Modelado

- Modelos simples: regresión logística, árboles, random forest. **Nada de redes
  neuronales** con 100 participantes.
- **Validación cruzada agrupada por sujeto** (`GroupKFold` con el id del
  participante). Partir al azar hace que el modelo reconozca a la persona en vez
  del fenómeno, e infla la precisión.
- Tratar el desbalance de clases explícitamente.

### 4.4 Evaluación

Reportar **precisión, recall y F1**. La precisión sola es manipulable.

---

## Fase 5 · POSTEST — medir con el sistema

Los mismos tres indicadores, ahora calculados por el sistema:

| Indicador | De dónde sale |
|---|---|
| Volumen | vista `indicador_volumen` |
| Tiempo | vista `indicador_tiempo_deteccion` |
| Precisión | vista `indicador_precision` |

No se calculan a mano: se leen de las vistas. Si se recalcularan aparte habría
dos verdades, y la que llegue al capítulo de resultados sería la copiada a mano.

---

## Fase 6 · Análisis estadístico

### 6.1 Definir la unidad de emparejamiento

Las pruebas pareadas exigen **la misma unidad medida dos veces**. Hay que
decidirlo con el asesor **antes** del pretest:

| Indicador | Unidad propuesta |
|---|---|
| Tiempo de detección | El **participante**: su tiempo manual contra su tiempo con el sistema |
| Volumen | El **periodo** (semana): evaluados esa semana a mano contra con el sistema |
| Precisión | El **protocolo evaluado**: acierto manual contra acierto del sistema |

Si esto se decide después de recolectar, puede no haber forma de emparejar y no
se podrán aplicar las pruebas que declara el documento.

### 6.2 Procedimiento

1. **Descriptiva:** medias, porcentajes y desviaciones de los tres indicadores,
   en pretest y postest, con tablas y figuras comparativas.
2. **Normalidad:** Shapiro-Wilk sobre las diferencias pre-post.
3. **Contraste:**
   - Si hay normalidad → **t de Student para muestras pareadas**
   - Si no → **Wilcoxon** de rangos con signo
4. **Significancia:** α = 0,05.

### 6.3 Declarar la censura

Quien termina el seguimiento sin ser detectado **no es un negativo limpio**:
está censurado a la derecha. Podría haberse detectado más tarde. Reconocerlo
explícitamente protege más que omitirlo.

---

## Fase 7 · Redacción

Orden sugerido:

1. **Resultados**: los tres indicadores, pre y post, con sus pruebas
2. **Discusión**: qué mejoró, cuánto, y contra qué referencias
3. **Limitaciones**: N pequeño, censura, umbrales, un solo grupo sin control
4. **Conclusiones**: una por hipótesis específica

---

## Resumen del orden

```
0. Aprobaciones y decisiones del asesor
1. Cargar instrumento y fijar umbrales
2. PRETEST — medir a mano, cronometrando        ← irrepetible
3. Desplegar, inscribir, vigilar adherencia     ← irrepetible
4. Entrenar y evaluar el modelo
5. POSTEST — leer los indicadores del sistema
6. Shapiro-Wilk → t pareada o Wilcoxon
7. Redactar
```

Los pasos 2 y 3 son los únicos que **no se pueden repetir**. Todo lo demás se
puede rehacer.

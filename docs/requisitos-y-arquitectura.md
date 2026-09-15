# Requisitos y Arquitectura del Sistema

**Tesis:** Detección temprana del síndrome de Burnout en Profesionales del Sector Tecnológico mediante Machine Learning
**Autores:** Castillo Rosas, Charles Duck · Castillo Rabanal, Luis Javier
**Asesor:** Dr. Mendoza Rivera, Ricardo Dario
**Universidad Nacional de Trujillo** — Ingeniería de Sistemas

---

## 1. Alcance del sistema

El sistema tiene dos componentes con propósitos distintos:

| Componente | Rol en la tesis |
|---|---|
| **A. Detección** | Núcleo de la investigación. Recolecta datos, entrena y opera el modelo de ML |
| **B. Apoyo post-detección** | Fase 6 (Despliegue). Videoconsulta con psicólogo, transcripción e informe de apoyo |

El componente B **no aparece en el documento de tesis actual**. Si se conserva, debe incorporarse a la metodología o el jurado lo cuestionará. Ver §8.

---

## 2. Población y diseño

- **100 profesionales** del sector tecnológico, Trujillo. Muestreo censal.
- Diseño **preexperimental**, pretest/postest, **longitudinal** con medidas repetidas.
- Los participantes salen del seguimiento al ser detectados → pasan a observación (**censura por evento**).

---

## 3. Indicadores que el sistema debe medir

Son las variables dependientes de la tesis. **La instrumentación no es opcional.**

| # | Indicador | Cómo lo captura el sistema |
|---|---|---|
| 1 | Precisión del modelo — `P% = TP/(TP+FP) × 100` | Evaluación del modelo contra etiquetas OLBI |
| 2 | N.º de profesionales evaluados por unidad de tiempo | Conteo sobre la tabla de eventos |
| 3 | Tiempo promedio de detección por profesional | `evento_deteccion.ts − evento_inicio_seguimiento.ts` |

> **Pendiente en el Anexo 3:** el indicador de precisión, usado solo, es manipulable — un modelo que marca a una sola persona y acierta obtiene 100%. **Añadir recall y F1.** En detección de salud mental un falso negativo es más grave que un falso positivo. La referencia citada (Merhbene, 2022) reporta exactitud balanceada y recall.

---

## 4. Recolección de datos

### 4.1 Reglas invariantes

La recolección longitudinal es **irreversible**. Estas tres reglas mantienen abiertas todas las opciones de modelado:

1. **Guardar respuestas ítem por ítem**, nunca solo el puntaje agregado. El puntaje se recalcula; los ítems no se reconstruyen.
2. **Tablas append-only** con `participante_id` y marca de tiempo. Nunca se sobrescribe una respuesta.
3. **Registrar eventos de proceso** (inicio de evaluación, emisión de resultado, detección) — de ahí sale el indicador 3.

### 4.2 Instrumentos y cadencia

| Momento | Contenido | Duración |
|---|---|---|
| **Inscripción** (una vez) | Edad, rol, antigüedad en empresa y sector, modalidad (remoto/híbrido/presencial), tamaño de equipo, personas a cargo, tiempo de traslado | ~2 min |
| **Diario** | Horas trabajadas hoy, horas de sueño, carga percibida (1–5), energía al terminar (1–5), ¿trabajó fuera de horario? | ~30 s |
| **Semanal** | Sobretiempo, proyectos simultáneos, guardias, reuniones/día + autonomía, apoyo del líder, claridad de rol | ~1 min |
| **Quincenal** | **OLBI completo** (16 ítems) — medición de referencia | ~4 min |

### 4.3 Justificación teórica de las variables contextuales

El OLBI deriva del **modelo de Demandas y Recursos Laborales (JD-R)** de Demerouti. Las variables contextuales se organizan bajo ese mismo marco — demandas (horas, sobretiempo, guardias, proyectos) y recursos (autonomía, apoyo, claridad de rol) — de modo que no son una lista arbitraria sino una operacionalización de la teoría que sustenta el propio instrumento.

### 4.4 Por qué el OLBI no se aplica a diario

El OLBI mide un estado relativamente estable y no está validado para aplicación diaria. Aplicarlo 60 veces produce **fatiga de respuesta** (deserción, respuestas en automático) y es objetable psicométricamente. El esquema de dos niveles —micro-chequeo diario + OLBI quincenal— es el estándar en evaluación ecológica momentánea y da la resolución temporal que necesita el modelo predictivo.

---

## 5. Advertencias sobre el modelo

> Decisión pendiente con el asesor. Documentadas aquí para no perderlas.

### 5.1 Circularidad

Si las entradas del modelo son los 16 ítems del OLBI y la etiqueta se deriva de esos mismos ítems, la etiqueta es una **función determinista de las entradas**. El modelo reproduce la fórmula de puntuación: precisión ~99%, valor nulo. Además invalida OE2 y OE3, porque seguir necesitando el OLBI significa no reducir tiempo ni aumentar volumen.

**Diseño correcto:** entradas = datos contextuales laborales · etiqueta = clasificación OLBI. El OLBI pasa de ser entrada a ser **patrón oro**.

### 5.2 Formulación recomendada: predicción de trayectoria

El diseño longitudinal habilita una pregunta más fuerte y coherente con el título de la tesis:

> ¿Cruzará el umbral de burnout en los próximos 7–14 días, dada su trayectoria de las últimas dos semanas?

- **Entradas:** tendencia del puntaje, variabilidad, velocidad de deterioro + contexto laboral
- **Etiqueta:** cruce del umbral en la ventana futura

Esto es predicción genuina y es lo único que justifica "temprana". Mismo dato, misma app; cambia la formulación.

### 5.3 Fuga de datos por medidas repetidas

Con ~60 filas por participante, las filas de una misma persona están fuertemente correlacionadas. **Validación cruzada agrupada por sujeto obligatoria** (`GroupKFold` con `participante_id`). Partir aleatoriamente hace que el modelo reconozca a la persona, no al fenómeno.

**N efectivo para generalizar a personas nuevas = 100**, no el número de filas.

### 5.4 Censura

Quien es detectado sale del seguimiento. Los participantes que terminan sin detección **no son negativos limpios: son censurados a la derecha**. Debe reconocerse explícitamente en el capítulo de métodos.

### 5.5 Restricciones por tamaño de muestra

Modelos simples (regresión logística, árboles, random forest). Nada de redes neuronales. Tratar explícitamente el desbalance de clases.

### 5.6 HE1 tal como está redactada

El "método tradicional" es el OLBI, que define la verdad de referencia. Medido contra sí mismo da 100%, por lo que **HE1 es imposible de ganar en precisión**. Debe precisarse contra qué se compara — probablemente tiempo y cobertura, no precisión. Resolver en el papel antes de recolectar datos.

---

## 6. Stack

| Capa | Herramienta | Justificación |
|---|---|---|
| Datos, auth, storage | **Supabase** (Postgres) | API autogenerada + RLS por organización |
| Frontend participante | Web app | Sin fricción de instalación — crítico para un censo de 100 |
| Lógica de servidor (B) | Supabase Edge Functions | Firma de tokens LiveKit, webhook de transcripción |
| Inferencia del modelo | **FastAPI** (Python) | Las Edge Functions corren Deno; scikit-learn necesita Python |
| ML | scikit-learn + `GroupKFold` | Modelos simples, validación correcta |
| Análisis estadístico | Jupyter + scipy | Shapiro-Wilk → t pareada o Wilcoxon, α = 0,05 |
| Videoconsulta (B) | LiveKit Cloud | 1:1, tier gratis suficiente |
| Transcripción (B) | Deepgram Nova-3 batch | $200 de crédito; retención cero por defecto |

### 6.1 Orden de incorporación

No todo se construye a la vez. La fase de recolección es CRUD puro y **no requiere backend propio**:

| Fase | Se agrega | Motivo |
|---|---|---|
| **1. Recolección** | Solo Supabase | API autogenerada + RLS cubren todo el CRUD |
| **2. Videoconsulta** | Edge Functions (TypeScript) | Tokens de sala y webhooks |
| **3. Modelo** | Servicio FastAPI | Único componente que exige Python en ejecución |

La Fase 4 de la tesis fija Python para el **entorno de modelado**, requisito que Jupyter satisface. FastAPI se justifica por la inferencia automática, no por cumplimiento metodológico.

**Costo total estimado del proyecto: $0–30.**

> No inscribirse en el *Model Improvement Partnership Program* de Deepgram: intercambia datos por descuentos, inaceptable con conversaciones clínicas.

---

## 7. Consideraciones éticas y de datos

- Anonimización por **códigos de identificación** (ya declarado en la tesis).
- Consentimiento informado explícito, por participante — no basta la autorización de la empresa.
- **Aislamiento estricto entre organizaciones** (RLS). Una empresa nunca ve datos de otra.
- Los audios de sesión clínica son **datos sensibles de salud** (Ley N.º 29733, Perú). Retención con plazo definido y borrado automático.
- El sistema es herramienta de **apoyo**, no diagnóstico clínico definitivo (ya declarado en la tesis).

---

## 8. Decisiones pendientes

| # | Pendiente | Responsable |
|---|---|---|
| 1 | Duración del seguimiento en días | Asesor |
| 2 | Formulación del modelo: clasificación puntual vs. predicción de trayectoria (§5.2) | Asesor |
| 3 | Redacción de HE1 (§5.6) | Asesor |
| 4 | Añadir recall y F1 al Anexo 3 (§3) | Autores |
| 5 | Incorporar el componente B a la metodología, o retirarlo | Asesor |
| 6 | Umbral de corte del OLBI para clasificar burnout | Asesor |

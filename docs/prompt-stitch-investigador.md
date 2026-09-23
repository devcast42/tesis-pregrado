# Prompt para Stitch — panel web del investigador

Copiar desde la línea siguiente.

---

Diseña el **panel web del investigador principal** de un sistema de detección temprana de burnout en profesionales de tecnología, usado en un estudio universitario. Escritorio (1440 × 900; razonable a 1024), barra lateral con grupos. Ya existen, con el mismo esqueleto y sistema visual, el panel del administrador de empresa (teal, Inter, tarjetas blancas sobre fondo cálido, pastillas, gráficas limpias) y la app móvil del participante; esta parte debe sentirse de la misma familia, pero es la más **densa** de todas: es la herramienta de trabajo de una sola persona que analiza datos todos los días.

Quién la usa: el investigador que dirige el estudio. Es la única persona que ve **todo**, hasta la unidad: cada participante, cada día, cada ítem respondido, cada predicción del modelo y si acertó. Trabaja siempre con **códigos anónimos** («P-042»), nunca con nombres; la identidad se abre solo por una acción explícita que queda registrada. Nunca ve el contenido clínico del psicólogo (informes, transcripciones): solo que ocurrieron.

Tres momentos de uso, y cada uno merece su entrada:

- **Operación (5 minutos, cada mañana):** ¿a quién hay que recordar?, ¿qué derivación no avanzó?, ¿qué cita nadie confirmó?
- **Análisis (una hora):** ¿cómo evoluciona la cohorte?, ¿el modelo acierta?, ¿qué factor pesa?, ¿por empresa?
- **Caso a caso (10 minutos por persona):** el arco completo de un participante para entender un falso positivo, una trayectoria rara, una detección tardía.

## Barra lateral

Grupos con encabezado en mayúsculas pequeñas:

- **ESTUDIO**: Hoy (con badge numérico de pendientes), Resumen, Cohorte.
- **PERSONAS**: Participantes, Derivaciones.
- **MODELO**: Versiones, Desempeño.
- **DATOS**: Exportación, Auditoría.
- **MAESTROS**: Empresas, Psicólogos, Umbrales.

Arriba, un **filtro global** siempre visible: empresa (Todas / Fintech Nova / …) y rango de semanas del estudio (Semana 1 → 6), más una búsqueda `⌘K` por código. Abajo: nombre, «Investigador principal», salir.

## Las cinco pantallas que quiero diseñadas

### 1. Hoy — bandeja de pendientes

Una lista agrupada por tipo, cada grupo con su conteo y una línea que explica la regla:

- Inactivos: «4 días hábiles o más sin registro» — filas: código, empresa, días sin responder, último registro, botón «Ver ficha» y «Pedir contacto al admin».
- Semanas sin viernes: código, empresa, semana.
- Detecciones sin derivación (no había psicólogo disponible): código, fecha, botón «Asignar psicólogo».
- Derivaciones sin sesión ≥ 7 días: código, psicólogo, días.
- Citas sin confirmar ≥ 2 días: código, psicólogo, fecha pedida.
- Informes sin aprobar ≥ 7 días: código, psicólogo, sesión.
- Consentimientos pendientes ≥ 7 días: código, empresa, inscrito hace.

Cada grupo se puede plegar. Estado «todo al día» cuando no hay nada, sin celebrar demasiado. Las urgencias van en **ámbar**, no en rojo.

### 2. Participantes — la tabla

Densa, con cabecera fija: código, empresa, semana N/6, estado (activo / detectado / retirado / finalizado, en pastillas neutras salvo detectado en tierra), adherencia (%, con mini barra), días sin responder, último OLBI (agotamiento · desvinculación con nivel), nowcast de la semana (probabilidad + confianza), derivación (sí/no, psicólogo), cita (estado). Filtros combinables arriba como chips (empresa, estado, nivel, nowcast ≥ 50 %, sin responder ≥ 4 d, con derivación, con cita) y búsqueda por código. Selección múltiple con acción «Exportar seleccionados». Orden por defecto: **urgencia**. Paginación abajo. Un panel lateral opcional (drawer) con la vista previa del participante al pasar o al hacer clic, sin salir de la tabla.

### 3. Ficha del participante — la pantalla más importante

Todo en una sola página larga con navegación lateral por secciones (ancla) y un encabezado fijo:

- **Encabezado**: «P-042 · Fintech Nova · Semana 5 de 6», estado, adherencia 87 %, insignias (Detectado S4 · Derivado · Cita confirmada), y acciones: Exportar ficha · Ver identidad (con aviso «queda registrado») · Reasignar psicólogo · Cerrar seguimiento · ← anterior / siguiente →.
- **Calendario de respuestas**: rejilla 6 semanas × L–V. Celda llena = respondió (con hora al pasar), vacía = no, gris = fin de semana, punteada = futuro; el viernes con OLBI se distingue del check-in. Al lado, adherencia por semana.
- **Serie diaria**: los cuatro ítems OLBI diarios (escala 1–5) como líneas finas, y debajo horas trabajadas y horas de sueño como barras; los lunes, un punto extra con las horas de fin de semana. Seis semanas en el eje, con los viernes marcados.
- **Trayectoria OLBI**: agotamiento y desvinculación por viernes, con las bandas de umbral y el **punto de detección** marcado; a la derecha, la tabla semana a semana con puntajes y nivel.
- **Modelo**: dos gráficas. (a) *Nowcast*: por cada semana, la probabilidad de lunes a jueves como puntos que suben o bajan, y al final el resultado real del viernes (alto / no alto) como marca; verde si acertó, tierra si falló. (b) *Pronóstico*: la probabilidad dicha el viernes para la semana siguiente contra lo que pasó. Cada predicción con versión del modelo y confianza. Un resumen: «5 de 6 nowcasts acertaron; 4 de 5 pronósticos».
- **Respuestas ítem a ítem**: acordeón por fecha; dentro, tabla ítem → valor, con el texto del ítem. Es la única pantalla del sistema con este detalle.
- **Línea de tiempo**: vertical, con hitos: inscripción, consentimiento, inicio, cada detección (con puntajes y umbrales), derivación (psicólogo), cita (pedida/confirmada), sesión (fecha y duración, sin contenido), informe aprobado (solo el hecho), acceso a identidad (quién y cuándo), retiro. Íconos por tipo, sin color de alarma.

Diseña esta pantalla como la ficha que un investigador mira para escribir un caso en su tesis: qué se lee primero, qué se lee después, qué se pliega.

### 4. Desempeño del modelo

Selector de tarea (Nowcast / Pronóstico) y de versión. Arriba: matriz de confusión 2×2 grande y legible, con VP/FP/VN/FN y sus porcentajes; al lado, precisión, recall, especificidad y ROC-AUC, cada una con su n. Debajo: (a) precisión y recall **por semana del estudio** como líneas, (b) **calibración**: probabilidad dicha (deciles) vs. frecuencia observada, con la diagonal ideal, y cada punto con su n; los deciles con n < 20 se marcan como poco fiables sin ocultarse. Un bloque de comparación cuando coexisten dos versiones (preentrenado vs. propio). Nota permanente: «Calculado solo con las predicciones registradas en su momento; nunca recalculado con el modelo actual».

### 5. Exportación

Una pantalla sobria: qué se exporta (respuestas, ítems, puntajes OLBI, ventanas del modelo, predicciones, eventos), con el filtro global aplicado y los conteos de filas por tabla; formato (CSV / Parquet); un resumen del **manifiesto** (fecha, filtros, versión del esquema, hash) y el botón «Descargar ZIP». Debajo, el historial de exportaciones anteriores (fecha, filtros, conteos, hash) porque cada una queda registrada. Y un diccionario de variables plegable.

## Estados que quiero ver resueltos

- Hoy sin pendientes.
- Ficha de un participante con solo dos semanas (tendencias cortas, modelo sin pronóstico todavía).
- Desempeño con n pequeño (menos de 30 predicciones).
- Tabla con filtro que no devuelve nada.

## Reglas que no se negocian

- **Códigos, nunca nombres.** La identidad aparece solo tras «Ver identidad», en un panel aparte con el aviso de registro.
- **Nada del contenido clínico.** Informe y sesión son hitos, no documentos.
- **Nada rojo** salvo errores técnicos: detectado y alto en tierra, urgencia de operación en ámbar.
- Toda cifra con su n; toda métrica con su fórmula a un clic (ⓘ).
- Densidad alta pero legible: 13 px mínimo en tablas, números tabulares, cabeceras fijas.

## Sistema visual (ya existe; respétalo)

- Inter (400 / 500 / 600). Verde azulado primario #0F766E, profundo #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #8A8580.
- Niveles: bajo verde #F0FDF4 / #15803D; a vigilar ámbar #FFFBEB / #B45309; alto tierra #FBF3E6 / #9A5B2B. Acierto del modelo en verde, fallo en tierra.
- Esquinas 16 px en tarjetas, 999 en pastillas. Gráficas sin cuadrícula densa, ejes con pocas marcas, leyendas en caja.
- Misma barra lateral que el panel del empresario, con grupos.

## Lo que quiero de ti

Resuelve la **ficha del participante** como una sola narrativa vertical —de lo que la persona hizo (calendario) a lo que respondió (serie, OLBI) a lo que el modelo dijo (predicciones) a lo que pasó después (línea de tiempo)— sin que parezca un informe de base de datos. Y resuelve **Hoy** como una bandeja que se vacía: cada fila tiene una acción y desaparece al resolverse. Piensa en el investigador a las 8 de la mañana con café: en un minuto sabe si hay algo que hacer y en diez lo hizo.

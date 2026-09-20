# Prompt para Stitch — panel web del empresario (rol admin)

Copiar desde la línea siguiente.

---

Diseña el **panel web del administrador de empresa** de un sistema de bienestar laboral usado en un estudio universitario con profesionales de tecnología. Es una aplicación de escritorio (1440 × 900, con una versión razonable a 1024), con barra lateral de navegación. Ya existe el panel del investigador con ese mismo esqueleto (sidebar a la izquierda, contenido en tarjetas, tipografía Inter, teal); esta parte debe sentirse de la misma familia, pero escrita para otra persona.

Quién la usa: el gerente de tecnología o la persona de RR.HH. de una empresa de 20 a 150 personas. Entra una vez por semana, el lunes, con diez minutos. No es psicólogo ni investigador. Quiere tres respuestas: **¿cómo está mi equipo?**, **¿qué lo está desgastando?** y **¿qué puedo cambiar yo?**

La regla que lo define todo: **este panel nunca muestra a una persona**. Ni nombres con puntajes, ni códigos con niveles, ni «quién está en riesgo». Solo promedios de la empresa, y solo cuando el grupo tiene al menos 10 respondientes. Cuando no hay suficientes, la cifra **no aparece** — no se pone «sin datos» ni «n/d», porque hasta la ausencia informaría. Esa restricción es la promesa que hace que los trabajadores respondan con sinceridad, y el panel tiene que transmitirla como una virtud, no como una carencia: es inteligencia organizacional a cambio de anonimato garantizado.

## Las cinco pantallas

### 1. Inicio — el lunes en diez minutos

Un resumen de la última semana reportable, en este orden:

- Encabezado: nombre de la empresa, «Semana 6 del estudio · 12–16 de setiembre», y una línea de participación: «34 de 41 personas respondieron esta semana (83 %)».
- **Pulso de la empresa**: dos indicadores grandes, uno por dimensión: «Agotamiento · 2.4 de 4 · A vigilar» y «Desvinculación · 1.9 de 4 · Bajo», cada uno con una mini tendencia de 6 semanas y una flecha de cambio respecto a la semana anterior («+0.2»). Al lado, discreto, el promedio del estudio: «Otras empresas del estudio: 2.2».
- **Lo que más pesa esta semana**: los dos o tres factores de trabajo que están fuera de referencia, como tarjetas cortas: «Jornada media 9.6 h/día», «38 % estuvo de guardia», «Apoyo del líder 2.8 de 5».
- **Qué hacer**: una o dos recomendaciones, cada una con título, dos líneas y una referencia bibliográfica corta en gris: «Política de desconexión — El trabajo fuera de horario es el mayor predictor de agotamiento en el modelo JD-R. (Demerouti et al., 2001)».
- Al pie, pequeño y permanente: «Cifras agregadas de 34 respondientes. Ningún dato individual es visible para la empresa. Mínimo de reporte: 10 personas.»

### 2. Pulso

La tendencia completa. Un gráfico de líneas de 6 a 12 semanas con las dos dimensiones de la empresa y, en línea punteada, el promedio del estudio. Dos bandas horizontales suaves marcan «a vigilar» y «alto» (umbrales de empresa, fijados por el equipo de investigación; el empresario no los edita). Debajo, una tabla semana a semana: respondientes, agotamiento, desvinculación, nivel.

Un selector de **segmento** arriba: «Toda la empresa · Remoto · Híbrido · Presencial · Por rol». Los segmentos con menos de 10 personas **no aparecen en el selector**. Diseña cómo se ve cuando solo hay «Toda la empresa» disponible sin que parezca roto.

### 3. Factores de trabajo

La pantalla más útil. Seis factores que se recogen cada semana, cada uno como una tarjeta con: nombre, valor de la semana, referencia («ref. ≤ 8.5 h»), tendencia de 6 semanas y un estado (dentro / fuera de referencia):

- Jornada media (h/día)
- Sueño medio (h/noche)
- Horas trabajadas el fin de semana
- Sobretiempo semanal (h)
- Personas de guardia (%)
- Apoyo del líder (1–5)

Debajo, un bloque «**Qué se mueve con qué**»: para esta empresa, qué factores suben y bajan junto con el agotamiento a lo largo de las semanas, dicho en palabras y con una barra de fuerza: «Las semanas con más trabajo de fin de semana son las de mayor agotamiento (relación fuerte)». Aparece solo cuando hay al menos seis semanas de datos; diseña el estado previo: «Con seis semanas de datos podremos decirte qué factores pesan más en tu empresa. Van 4.»

### 4. Personas y participación

Aquí sí hay nombres, porque el admin fue quien inscribió a esa gente, pero **nunca al lado de un dato de salud**. Dos zonas:

- **Participación**: inscritos, consintieron, en seguimiento, tasa de respuesta semanal con tendencia. Un aviso si la tasa baja de 60 %: «Con menos del 60 % la lectura es poco fiable. Recuerda en la reunión de equipo que las respuestas son anónimas.»
- **Cuentas**: tabla con nombre, correo, código anónimo, fecha de inscripción, consentimiento (sí/no), y una única columna de estado con dos valores: «En seguimiento» / «Fuera de seguimiento» — sin motivo. Acciones: «Inscribir persona» (correo + nombre → muestra la contraseña generada una sola vez, con un aviso de que no se volverá a ver), «Reenviar credenciales», «Dar de baja» (cuando alguien deja la empresa; con confirmación que explica que sus respuestas se conservan anonimizadas y que, si tenía una sesión de apoyo en curso, esta continúa).

### 5. Informe mensual

Una vista pensada para imprimirse en **una página A4**: encabezado con empresa y mes, pulso del mes (promedio y tendencia), factores fuera de referencia, recomendaciones, participación, y «Uso del programa de apoyo: unas 5 sesiones este mes» (siempre redondeado, y solo si hubo al menos 5). Al pie, la leyenda de agregación y el mínimo de reporte. Botón «Descargar PDF». Diseña la vista en pantalla y la versión impresa.

## Estados que quiero ver resueltos

- **Empresa pequeña** (menos de 10 respondientes): el Inicio no puede mostrar cifras. Diseña esa pantalla: qué ve el gerente, cómo se le explica sin que parezca error, y qué sí puede ver (participación, cuentas, y cuánta gente falta para que haya reporte: «Con 3 personas más habrá cifras semanales»).
- **Primeras semanas**: hay respondientes pero solo una o dos semanas; sin tendencia todavía.
- **Semana sin reporte** en medio de una serie (cayó la participación): el punto falta en la línea; no se interpola ni se marca.

## Reglas que no se negocian

- **Nada rojo** salvo errores técnicos. «Alto» va en tono tierra/ámbar. Un panel de bienestar que grita no ayuda.
- La palabra **«burnout»** no aparece. Se habla de agotamiento, desvinculación, niveles y factores de trabajo. Tampoco «riesgo» aplicado a personas.
- Ningún gráfico, tabla o exportación tiene una fila por persona con un dato de respuesta.
- Los umbrales y la nota de agregación se ven siempre; no se esconden en un tooltip.
- Todo legible a 1024 px de ancho con la barra lateral plegada.

## Sistema visual (ya existe; respétalo)

- Tipografía Inter (400 / 500 / 600). Cifras grandes con números tabulares.
- Verde azulado primario #0F766E, profundo #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #8A8580.
- Niveles: bajo en verde #F0FDF4 / #15803D; a vigilar en ámbar #FFFBEB / #B45309; alto en tierra #FBF3E6 / #9A5B2B. Línea del estudio (comparación) en gris punteado, nunca en color de nivel.
- Esquinas 16–20 px en tarjetas, 999 en pastillas. Barra lateral clara con el logo arriba, secciones: Inicio · Pulso · Factores · Personas · Informe, y abajo el nombre del admin y «Cerrar sesión».
- Gráficos limpios: sin cuadrícula densa, sin leyendas redundantes, ejes con pocas marcas. Es lectura de tendencia, no análisis financiero.

## Lo que quiero de ti

Resuelve el **Inicio** como la página que un gerente entiende en un minuto sin haber leído nada, y **Factores** como el lugar donde descubre algo que no sabía de su propia empresa. Piensa en cómo la nota de anonimato puede estar presente en todas las pantallas sin ser un cartel de advertencia: como una firma, no como un disclaimer. Y muéstrame el estado de empresa pequeña con el mismo cuidado que el estado con datos: para el piloto, será el más frecuente.

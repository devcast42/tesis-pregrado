# Prompt para Stitch — vista móvil del psicólogo

Copiar desde la línea siguiente.

---

Diseña las **pantallas móviles del psicólogo** de una app de bienestar laboral usada en un estudio universitario con profesionales de tecnología. Es la misma app que usan los participantes (ya diseñada: teal, Inter, cálida, sin dramatismo), pero este usuario es distinto: un profesional de la salud mental que atiende, desde su teléfono y fuera de su horario de consulta, a personas que el sistema le derivó porque su cuestionario semanal salió alto.

Lo que el psicólogo necesita no es un dashboard: es **llegar a la sesión sabiendo lo que importa en dos minutos de lectura**, atender la videollamada sin fricción, y cerrar con un informe que revisa y aprueba, no que escribe desde cero. Cada segundo que le cuesta encontrar algo es un segundo que le quita a la persona.

## Las cinco pantallas

### 1. Casos

Lista de las personas derivadas a este psicólogo. Cada caso: código anónimo («P-042»), empresa, hace cuánto se derivó («derivado hace 3 días»), estado («sesión pendiente» / «sesión agendada · jue 24, 18:00» / «informe por aprobar» / «cerrado»), y una señal sutil de urgencia sin ser alarma. Los casos cerrados van aparte, plegados. Estado vacío: «No tienes casos asignados. Cuando el sistema derive a alguien, aparecerá aquí.»

### 2. Caso

La pantalla más importante. Lo que se debe leer de un vistazo, en este orden de prioridad:

- **Quién**: código, empresa, rol («desarrollo de software»), modalidad («híbrido»), antigüedad. Y un acceso, deliberadamente separado y con un aviso, a la **identidad** (nombre y correo): «Ver identidad · este acceso queda registrado». Es la única persona del sistema que puede verla, y solo para contactar.
- **Qué disparó la derivación**: fecha, y los dos puntajes del OLBI ese viernes, cada uno con su nivel («Agotamiento · Alto · 3.1 de 4», «Desvinculación · A vigilar · 2.6 de 4»), con el umbral marcado.
- **Trayectoria**: las últimas seis semanas de las dos dimensiones, semana a semana, como una lectura de tendencia, no como un gráfico financiero. Tiene que verse en un teléfono sin girar. Marca la semana de la derivación.
- **Lo que dice el modelo**: «Probabilidad de que la próxima semana sea alta: 62 %» con su confianza («Confianza media») y un (i) que explica: «Modelo del estudio, entrenado por ahora con datos de otro estudio. De cada 10 avisos se confirman unos 3; detecta 7 de cada 10 casos altos.»
- **Contexto de la semana**: horas trabajadas (media), horas de sueño (media), horas de fin de semana, sobretiempo, guardia sí/no, apoyo del líder (1–5). Cinco o seis datos, no una tabla.
- **Acciones**: «Agendar sesión» (fecha y hora), «Entrar a la videollamada» cuando hay una agendada, «Cerrar caso» (con confirmación y motivo: «sesión realizada» / «no responde» / «rechazó la sesión»).
- **Sesiones anteriores** de este caso, con su informe si lo hay.

### 3. Antes de la videollamada

Una pantalla de preparación, no de configuración. Explica en tres líneas que la sesión se graba **solo en audio** y **solo si los dos lo autorizan**, para generar un borrador de informe que el psicólogo revisa. Dos estados de autorización visibles («Tu autorización · pendiente», «Autorización del participante · dada»), un botón «Autorizo la grabación» y el botón principal «Entrar a la videollamada». Si nadie autorizó: «La sesión no se grabará. Puedes entrar de todas formas.» Sin miedo, sin letra pequeña.

### 4. En la videollamada

Pantalla completa, oscura. Video del participante grande, el propio pequeño en una esquina. Indicador discreto de «grabando audio» solo si aplica. Controles al alcance del pulgar: silenciar, cámara, y **finalizar**, que tiene que ser claro pero **no rojo** (el rojo en esta app es solo para errores). Estado «Esperando a la otra persona…» con el código del participante, cuando aún no entró.

### 5. Informe

El borrador que generó la transcripción, para revisar. Secciones editables: «Motivo», «Lo que se conversó», «Observaciones clínicas», «Acuerdos y seguimiento». Un aviso permanente: «Borrador generado automáticamente. Nada se comparte hasta que lo apruebes; el participante nunca lo ve.» Botones «Guardar borrador» y «Aprobar informe» (con confirmación). Si no hubo grabación: la misma estructura vacía, para escribirlo a mano.

## Reglas que no se negocian

- **Nada rojo** salvo errores técnicos. Un caso urgente se señala con jerarquía y tono tierra/ámbar, no con rojo.
- **Anonimato por defecto.** En todas partes se usa el código; el nombre real solo aparece en la pantalla de identidad, tras una acción explícita, con el aviso de que queda registrada.
- La palabra **«burnout»** no aparece como etiqueta de la persona. Se habla de niveles, dimensiones y semanas.
- Todo legible con una mano, en un pasillo, con prisa. Tipografía generosa; nada por debajo de 13 px salvo etiquetas.
- Teléfono, 390 × 844. Cinco pantallas, sin tabs inferiores: el psicólogo entra a un caso y vuelve.

## Sistema visual (ya existe; respétalo)

- Tipografía Inter en todos los pesos.
- Verde azulado primario #0F766E, profundo #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #A8A29E.
- Niveles: bajo en verde #F0FDF4 / #15803D; a vigilar en ámbar #FFFBEB / #B45309; alto en tierra #FBF3E6 / #9A5B2B. Confianza del modelo con la misma escala.
- Esquinas de 16–20 px en tarjetas, 999 en pastillas. Botón primario lleno, alto, sin sombra dura.
- Las pantallas del participante ya diseñadas (inicio, modal de resultado) son la referencia de tono: esta parte debe sentirse de la misma familia, pero más densa y más rápida, porque quien la usa es un profesional con prisa.

## Lo que quiero de ti

No me des una lista de tarjetas apiladas. Quiero que resuelvas la **pantalla del caso** como si fuera la ficha que un clínico mira antes de abrir la puerta: qué se lee primero, qué se lee después, qué se esconde detrás de un toque. Piensa en cómo la trayectoria de seis semanas y el número del modelo pueden convivir sin que uno parezca más verdad que el otro. Y piensa en la transición de «caso» a «llamada» a «informe» como un solo recorrido de una tarde, no como tres pantallas sueltas.

Entrega las cinco pantallas, y la del caso en dos estados: con sesión pendiente de agendar, y con sesión agendada para hoy.

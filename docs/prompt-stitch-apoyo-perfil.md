# Prompt para Stitch — pestañas Apoyo y Perfil del participante

Copiar desde la línea siguiente.

---

Diseña dos pantallas de la app del participante de un estudio universitario sobre bienestar laboral en profesionales de tecnología. La app ya existe y ya tiene diseñadas su pantalla de inicio («Hoy»: check-in diario, cuestionario del viernes, resultado) y su modal de resultado; estas dos pantallas son las **otras dos pestañas de la barra inferior**: **Apoyo** y **Perfil**. Tienen que sentirse de la misma familia: teal, Inter, cálida, sin dramatismo, con mucho aire.

La barra inferior tiene tres pestañas: Hoy · Apoyo · Perfil. Diséñala también (íconos de línea simples, etiqueta debajo, activa en verde profundo, inactiva en gris), pero el foco son las dos pantallas.

## 1. Apoyo — pedir una cita con un psicólogo

Quién la usa: una persona que quizá lleva semanas cansada y decidió, por su cuenta, hablar con alguien. Puede estar nerviosa. Puede hacerlo a las once de la noche desde la cama. Esta pantalla no debe hacerla sentir «caso», ni paciente, ni alarma: debe sentirse como pedir hora con alguien que la va a escuchar.

Cabecera propia («Apoyo profesional»), título «Habla con un psicólogo» y una línea: «Un espacio confidencial, independiente de tu empresa. Puedes pedirlo cuando quieras; no hace falta que el estudio te lo sugiera.» Esa última frase importa: la cita **siempre** está disponible, nadie tiene que «merecerla».

La pantalla tiene **tres estados** que quiero ver resueltos:

**a) Sin cita — el formulario para pedirla.** Es una sola tarjeta, corta:
- Elegir día: una fila horizontal de fichas con día de la semana, número y mes («LUN 21 SET»), solo días hábiles, los próximos diez. La seleccionada en verde lleno.
- Elegir hora: fichas con «09:00», «10:00», «11:00», «12:00», «15:00», «16:00», «17:00», «18:00». Las que ya pasaron no aparecen.
- «¿De qué te gustaría hablar? (opcional)» — un campo de texto de dos o tres líneas con el placeholder «Solo lo leerá el profesional que te atienda.» Máximo 240 caracteres; muestra el contador solo cuando se acerca al límite.
- Botón principal «Pedir la cita», inactivo hasta elegir hora.
- Debajo, muy discreto: «Sin costo · Puedes cancelarla cuando quieras».

**b) Con cita pedida.** Reemplaza al formulario. Una tarjeta que dice «Tu próxima cita», la fecha y hora grandes («Lunes, 21 de setiembre · 09:00»), el nombre del profesional («Con Luis Castillo»), y una pastilla de estado: **«Pendiente de confirmar»** (ámbar) o **«Confirmada»** (verde). Una línea de qué pasa después: «Te avisaremos cuando confirme la hora. La videollamada aparecerá aquí a la hora de la cita.» Si escribió motivo, se muestra en un bloque suave. Un enlace «Cancelar la cita» en texto, no un botón destructivo.

**c) Sala abierta.** Cuando el psicólogo abre la videollamada, arriba de todo aparece la tarjeta «Tienes una sesión de apoyo disponible» con el botón «Entrar» (ya existe en la pantalla Hoy; aquí es la misma pieza, en su sitio natural).

Siempre, al pie: un aviso de privacidad con candado: «Al pedir una cita, el profesional asignado podrá ver tu nombre y correo de contacto para coordinarla, y ese acceso queda registrado. Tu empresa no es informada.» Y, si hay, una lista corta «Anteriores» con fecha, profesional y estado («Realizada» / «Cancelada»), en filas simples.

Lo que **no** debe haber: puntajes, niveles, «te recomendamos», urgencia. La decisión es de la persona.

## 2. Perfil — quién soy en el estudio, mis datos, mis derechos

Quién la usa: alguien que entra una vez cada tantas semanas para cambiar la hora del recordatorio, corregir un dato, o —importante— retirarse del estudio. Tiene que ser una pantalla tranquila, ordenada en bloques, que se pueda recorrer de arriba abajo sin sorpresas.

Cabecera «Tu perfil». Bloques, en este orden:

1. **Identidad en el estudio.** Avatar neutro (sin foto, sin iniciales reales), «Participante P-003», «Semana 3 del estudio · desde el 4 de setiembre». Debajo, dos líneas: «Tu nombre y tu correo no están en ninguna tabla de investigación; solo los ve el profesional de psicología si hay una sesión de apoyo, y ese acceso queda registrado.» Es el argumento central de la app; merece estar arriba.

2. **Datos iniciales.** Las ocho respuestas del formulario de inscripción, como pares pregunta corta → respuesta: «Edad · 22», «Rol · Desarrollo de software», «Años en la empresa · 4», «Años en tecnología · 8», «Modalidad · Remoto», «Equipo directo · 5 personas», «Personas a cargo · Sí», «Traslado a la oficina · 0 min». Acortar las preguntas es parte del trabajo: en la app hoy salen completas y ocupan dos líneas. Al pie: «Respondidos el 18 de setiembre. Si algo cambió (rol, modalidad, equipo), actualízalos.» y un botón secundario «Actualizar mis datos». Estado alternativo si nunca los respondió: una invitación y un botón «Responder ahora · 2 minutos».

3. **Recordatorio diario.** «¿A qué hora prefieres que te avisemos?» y cuatro fichas: 18:00 · 19:00 · 20:00 · 21:00, una seleccionada.

4. **Bloqueo al abrir.** Una fila con ícono de huella, «Pedir huella al abrir», la explicación «Al abrir la app y al volver tras cinco minutos. Tu huella nunca sale del teléfono.» y un interruptor. Estado deshabilitado si el teléfono no tiene huella configurada, con el texto «Tu teléfono no tiene huella ni bloqueo configurados; actívalos en sus ajustes.»

5. **Tus derechos.** «Puedes retirar tu consentimiento en cualquier momento, sin dar explicaciones y sin consecuencia alguna. Tu empresa no será informada.» y un botón secundario «Retirar mi participación». Tiene que ser **tan fácil de encontrar como cualquier otro botón**: no escondido, no gris, no al final de todo. Y una nota: «Este sistema es una herramienta de apoyo y no constituye un diagnóstico clínico.»

6. **Cerrar sesión**, como enlace de texto al final.

## Reglas que no se negocian

- **Nada rojo** salvo errores técnicos. Cancelar una cita o retirarse del estudio son actos normales: se confirman con un diálogo, no se pintan de peligro.
- La palabra **«burnout»** no aparece. Tampoco «paciente», «caso», «riesgo».
- Anonimato: código de participante en todas partes; nunca el nombre real en estas pantallas.
- Legible con una mano; nada por debajo de 13 px salvo etiquetas en mayúsculas. Zonas de toque de 52 px.
- Teléfono, 390 × 844, con barra de pestañas inferior de ~56 px más la zona segura.

## Sistema visual (ya existe; respétalo)

- Tipografía Inter (400 / 500 / 600).
- Verde azulado primario #0F766E, profundo #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #8A8580.
- Estados: pendiente en ámbar #FFFBEB / #B45309; confirmada y bajo en verde #F0FDF4 / #15803D; tierra #FBF3E6 / #9A5B2B solo para lo que pide atención (no se usa en estas dos pantallas).
- Esquinas 16–20 px en tarjetas, 999 en pastillas y fichas de día. Botón primario lleno, alto, sin sombra dura; secundario con borde.
- La pantalla «Hoy» y el modal de resultado ya diseñados son la referencia de tono.

## Lo que quiero de ti

En **Apoyo**, resuelve el formulario de la cita como algo que se completa en veinte segundos con el pulgar, y haz que el estado «pendiente de confirmar» se sienta como una espera tranquila, no como un trámite. Piensa en la transición entre los tres estados: es la misma tarjeta cambiando, no tres pantallas.

En **Perfil**, resuelve la tabla de datos iniciales para que ocho pares quepan en una tarjeta limpia sin parecer un formulario, y encuentra el lugar justo para «Retirar mi participación»: visible y respetuoso al mismo tiempo. Si crees que algún bloque sobra o debería ir en otro orden, cámbialo y dime por qué.

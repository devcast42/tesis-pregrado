# Prompt para Stitch — App del participante

Igual que con el panel: primero el **prompt base**, después una pantalla por
generación. Si Stitch pierde el estilo, vuelve a pegar el bloque "Sistema
visual" al inicio.

**Diferencia clave respecto al panel: esto es móvil.** Pídele a Stitch que
genere **a 390 × 844 px** (iPhone), no a escritorio. Un diseño hecho a 1440 px
no baja a un teléfono solo.

---

## Prompt base (pegar primero)

```
Diseña las pantallas de una app MÓVIL (390 × 844 px, iOS/Android) para
participantes de un estudio académico sobre bienestar laboral en el sector
tecnológico. Idioma: español neutro (Perú).

QUIÉN LA USA Y CUÁNDO

Un profesional de tecnología, al final de su jornada, cansado, con el teléfono
en una mano. La abre cada día durante semanas para responder un check-in de
30 segundos, y cada quince días un cuestionario de 4 minutos. La app compite
con las ganas de cerrarla. Todo debe poder hacerse con el pulgar, sin pensar,
y terminar rápido.

EL PRINCIPIO QUE MANDA

La persona está hablando de su propio agotamiento. La app debe leerse como
cuidado, no como evaluación ni como formulario de trabajo. Tono cálido, sin
solemnidad, sin infantilizar. Nunca gamificación, rachas, ni "llevas 3 días
sin responder". Nunca un mensaje que haga sentir mal por no haber respondido.

LO QUE LA APP NUNCA MUESTRA AL PARTICIPANTE

- Ningún puntaje, gráfico ni resultado de sus propias respuestas.
- Ninguna palabra como "burnout", "riesgo", "detectado", "alerta" o "nivel"
  aplicada a la persona.
- Ningún color de alarma sobre sus datos. El rojo está reservado a errores de
  la app (no se pudo enviar), jamás a la persona.
Esto no es una omisión de diseño: es una regla ética del estudio. Si un
diseño incluye "tu nivel de bienestar" o una gráfica de evolución, está mal.

SISTEMA VISUAL

Paleta cálida y apagada. Fuente Inter.
- Fondo de pantalla: #FAF9F7
- Superficie de tarjeta: #FFFFFF
- Superficie suave: #F5F4F1
- Texto principal: #1C1917 · secundario: #57534E · terciario: #8A8580
- Borde sutil: #E8E5E0 · borde de campo: #D6D2CC
- Primario (verde azulado): #0F766E · oscuro: #115E59 · suave: #EFF9F7
- Éxito: #15803D sobre #F0FDF4 (solo para "completado")
- Alerta: #B45309 sobre #FFFBEB (solo avisos de la app)
- Peligro: #B4413C sobre #FEF2F2 (solo errores de la app)

TIPOGRAFÍA
- Título de pantalla: 27px / 34px, peso 600, letter-spacing -0.4px
- Título de sección: 20px / 27px, peso 600
- Cuerpo: 16px / 24px, peso 400 · cuerpo fuerte: peso 500
- Apoyo: 14px / 21px, color #8A8580
- Etiqueta: 12px / 16px, peso 600, MAYÚSCULAS, letter-spacing 0.6px, #8A8580

FORMA Y TOQUE
- Espaciado en múltiplos de 4: 4, 8, 12, 16, 24, 32, 48. Padding de pantalla: 24px.
- Radios: 8 / 12 / 16 px.
- Tarjetas: blanco, radio 16px, borde 1px #E8E5E0, sombra 0 2px 12px rgba(28,25,23,0.05).
- TODO objetivo táctil mide al menos 52px de alto. Sin excepción.
- Botón primario: alto 52px, radio 12px, relleno #0F766E, texto blanco 16px peso 500,
  ancho completo. Deshabilitado: opacidad 0.4.
- Botón de texto: sin fondo, texto #0F766E, alto 44px.
- Campo de texto: alto 52px, radio 12px, borde 1px #D6D2CC, fondo blanco.
  Foco: borde #0F766E.
- Opción seleccionable (escala, sí/no): alto 52px, radio 12px, borde 1px #D6D2CC,
  fondo blanco. Seleccionada: fondo #0F766E, borde #0F766E, texto blanco.

ESTRUCTURA
- Cabecera nativa arriba (44px) con título centrado y, si aplica, flecha de
  volver a la izquierda. Nada más en la cabecera.
- Contenido con scroll. Los botones de acción principal van en un PIE FIJO
  abajo (padding 24px, borde superior 1px #E8E5E0, fondo blanco), nunca al
  final del scroll donde hay que buscarlos.
- Nada de barras de pestañas inferiores: la app tiene una sola pantalla
  principal.
- Sin modales. Sin iconos decorativos. Sin ilustraciones.
```

---

## Pantalla 1 · Acceso

```
Pantalla de acceso, móvil 390 × 844. Cabecera: "Acceso".

Contenido centrado verticalmente:
- Título "Bienestar laboral".
- Párrafo en #57534E: "Ingresa con el correo y la contraseña que te dio el
  equipo de investigación."
- Campo "Correo" (teclado de email).
- Campo "Contraseña" (oculta).
- Botón primario "Entrar", deshabilitado hasta que ambos campos tengan texto.
- Debajo, nota de apoyo 14px #8A8580: "¿Olvidaste tu contraseña? Escríbele al
  equipo de investigación y te la restablecen."

No hay "crear cuenta" ni "recuperar contraseña" por correo: las cuentas las
crea el equipo del estudio.

Variante de error: sobre el botón, un aviso con fondo #FEF2F2 y texto #B4413C:
"Correo o contraseña incorrectos." El botón sigue habilitado.
```

---

## Pantalla 2 · Consentimiento informado

```
Pantalla de consentimiento, móvil 390 × 844. Cabecera: "Consentimiento", sin
flecha de volver.

Es la pantalla más importante de la app: la persona decide aquí si participa.
Tiene que poder leerse entera sin prisa y decidir sin presión.

Contenido con scroll:
- Título "Antes de empezar".
- Párrafo: "Este estudio busca detectar de forma temprana señales de
  agotamiento laboral en profesionales del sector tecnológico."
- Lista de cuatro puntos con viñeta redonda de 6px en #0F766E:
  · "Responderás un check-in breve cada día (unos 30 segundos) y un
    cuestionario más completo cada dos semanas."
  · "Tus respuestas se guardan bajo un código anónimo. Tu empresa no accede a
    tus respuestas individuales."
  · "Puedes retirar tu consentimiento en cualquier momento, sin dar
    explicaciones y sin consecuencia alguna."
  · "Si el sistema identifica señales de riesgo, se te ofrecerá una sesión de
    apoyo con un profesional de psicología. Aceptarla es voluntario."
- Bloque destacado con fondo #EFF9F7, radio 12px, padding 16px, texto 14px
  #57534E: "Este sistema es una herramienta de apoyo y no constituye un
  diagnóstico clínico."

Pie fijo con dos acciones, en este orden y con esta jerarquía:
- Botón primario "Acepto participar".
- Botón de texto "No deseo participar".
Los dos igual de fáciles de pulsar. Rechazar no debe estar escondido ni en
gris pequeño: es una opción legítima.

Variante "rechazó": la pantalla completa se sustituye por un mensaje centrado:
título "Gracias por tu tiempo", párrafo "No registraremos ninguna información
tuya. Si cambias de opinión, puedes volver a abrir la app y aceptar el
consentimiento en cualquier momento.", y un botón de texto "Volver a leer el
consentimiento".
```

---

## Pantalla 3 · Cómo funciona (nueva, tras aceptar)

```
Pantalla de bienvenida que aparece UNA sola vez, justo después de aceptar el
consentimiento. Móvil 390 × 844. Sin cabecera.

Título "Así funciona".

Tres bloques verticales, cada uno una tarjeta con: una etiqueta arriba en
12px MAYÚSCULAS #8A8580, un título 20px, y una línea de apoyo 14px #8A8580.

  CADA DÍA        · "Un check-in de 30 segundos"   · "Cinco preguntas sobre tu día."
  CADA SEMANA     · "Un resumen de 1 minuto"       · "Siete preguntas sobre tu semana."
  CADA DOS SEMANAS· "Un cuestionario de 4 minutos" · "Dieciséis afirmaciones sobre tu trabajo."

Debajo, nota de apoyo: "Te avisaremos con una notificación. Si un día no
puedes, no pasa nada: responde al siguiente."

Pie fijo: botón primario "Empezar".

No hay pasos numerados, ni carrusel, ni "siguiente / siguiente / siguiente".
Una sola pantalla que se lee en diez segundos.
```

---

## Pantalla 4 · Hoy (la pantalla principal)

```
Pantalla principal de la app, móvil 390 × 844. Cabecera: "Bienestar laboral",
sin flecha de volver. Es la que se abre cada día.

Lo primero que debe quedar claro es SI QUEDA ALGO POR HACER O NO. Todo lo
demás es secundario.

Estado A — hay pendientes:
- Título "Hoy te toca".
- Párrafo #57534E: "Una cosa pendiente. No toma más de un par de minutos."
  (o "2 cosas pendientes. No toman más de unos minutos.")
- Lista de tarjetas, una por tarea, cada una de alto mínimo 76px, tocable
  entera, con: título en 16px peso 500 ("Check-in de hoy"), debajo la
  duración en 14px #8A8580 ("30 segundos"), y a la derecha una flecha "→" en
  #0F766E.
  Ejemplo con tres tarjetas: "Check-in de hoy · 30 segundos", "Resumen
  semanal · 1 minuto", "Cuestionario quincenal · 4 minutos".
- Las tareas ya completadas hoy siguen en la lista pero con fondo #F5F4F1,
  texto #8A8580, "Completado" en lugar de la duración, y una marca "✓" en
  #15803D a la derecha. No son tocables.
- Al pie de la pantalla, centrado, en 14px #8A8580: "Tu código de
  participante: P-042".

Estado B — todo hecho:
- Título "Todo listo por hoy".
- Párrafo: "Gracias. Te avisaremos mañana para el siguiente check-in."
- La misma lista, con todas las tarjetas en estado completado.
- Sin confeti, sin medallas, sin "¡Felicidades!". Un "gracias" y ya.

Prohibido en esta pantalla: contadores de racha, porcentajes de adherencia,
"has respondido 12 de 14 días", gráficos, o cualquier cosa sobre cómo va la
persona. Solo qué toca hoy.
```

---

## Pantalla 5 · Check-in diario (formulario corto)

```
Formulario de check-in diario, móvil 390 × 844. Cabecera: "Check-in de hoy",
con flecha de volver.

Arriba, fija bajo la cabecera, una barra de avance: pista de 6px de alto,
radio 3px, fondo #F5F4F1, relleno #0F766E; a su derecha "2 de 5" en 14px
#8A8580.

Bajo la barra, un párrafo de apoyo: "Cinco preguntas sobre tu día. Responde
con lo primero que se te venga."

Cada pregunta es una tarjeta (blanco, radio 16px, borde 1px #E8E5E0, padding
16px) con el texto de la pregunta en 16px #1C1917 y debajo el control:

1. "¿Cuántas horas trabajaste hoy?" → control numérico: un campo de 52px con
   el número centrado grande (24px) y botones "−" y "+" de 52 × 52 px a cada
   lado. Rango 0–24. Nada de teclado si se puede evitar.
2. "¿Cuántas horas dormiste anoche?" → mismo control, rango 0–14.
3. "¿Qué tan pesada sentiste la carga de trabajo hoy?" → escala de 5 botones
   en fila, cada uno flexible, alto 52px, con el número 1–5. Debajo de la
   fila, a los extremos, en 14px #8A8580: "Muy ligera" a la izquierda y
   "Muy pesada" a la derecha.
4. "¿Con cuánta energía terminaste el día?" → misma escala; extremos
   "Agotado" / "Con energía".
5. "¿Trabajaste fuera de tu horario habitual?" → dos botones "Sí" y "No" en
   fila, mitad y mitad, alto 52px.

Pie fijo: botón primario "Enviar". Si faltan respuestas, encima del botón un
texto centrado 14px en #B4413C: "Faltan 2 respuestas", y las tarjetas sin
responder llevan el borde en #B4413C.

Variante de fallo de red, tras pulsar Enviar: aviso sobre el botón con fondo
#FFFBEB y texto #B45309: "No se pudo enviar. Tus respuestas están guardadas
en el teléfono; lo intentaremos de nuevo." El botón pasa a decir "Reintentar".
```

---

## Pantalla 6 · Cuestionario quincenal (OLBI, formulario largo)

```
Formulario largo de 16 afirmaciones, móvil 390 × 844. Cabecera: "Cuestionario
quincenal", con flecha de volver.

Es el formulario que más abandono provoca: 16 preguntas con scroll. La barra
de avance FIJA arriba es lo que evita la sensación de scroll interminable.
Barra de 6px + "7 de 16" en 14px #8A8580.

Bajo la barra: "Dieciséis afirmaciones sobre tu relación con el trabajo. No
hay respuestas correctas."

Cada afirmación es una tarjeta con el texto en 16px y una escala de CUATRO
botones en fila (no cinco), alto 52px, numerados 1–4. Extremos debajo:
"Totalmente en desacuerdo" / "Totalmente de acuerdo". Como las etiquetas son
largas, cada una ocupa la mitad del ancho y se alinea a su lado.

Muestra las cuatro primeras afirmaciones visibles, la segunda ya respondida
(botón 3 seleccionado en verde), y que se intuye que hay más abajo:

  "Siempre encuentro aspectos nuevos e interesantes en mi trabajo."
  "Hay días en los que me siento cansado antes de llegar al trabajo."
  "Cada vez con más frecuencia hablo de mi trabajo de forma negativa."
  "Después del trabajo, necesito más tiempo que antes para relajarme y
   sentirme mejor."

Pie fijo: botón primario "Enviar".

IMPORTANTE: no hay "guardar y continuar después" visible como opción
principal; la persona debe terminar en una sentada. Pero si sale, al volver
debe encontrar lo que ya respondió — muéstralo en la variante siguiente.

Variante "retomar": la misma pantalla con un aviso suave arriba, fondo
#EFF9F7, texto 14px #57534E: "Retomaste donde lo dejaste. Llevas 7 de 16."
```

---

## Pantalla 7 · Datos iniciales (solo una vez)

```
Formulario de inscripción, se responde una sola vez. Móvil 390 × 844.
Cabecera: "Datos iniciales", con flecha de volver.

Barra de avance "3 de 8". Párrafo: "Solo los responderás una vez. Nos ayudan a
entender tu contexto de trabajo."

Tarjetas por pregunta:
1. "¿Cuántos años tienes?" → numérico con −/+.
2. "¿Cuál describe mejor tu rol?" → lista vertical de opciones, cada una un
   botón de ancho completo, alto 52px, texto alineado a la izquierda:
   Desarrollo de software · QA o testing · Datos o analítica ·
   Infraestructura o DevOps · Soporte técnico · Diseño o UX ·
   Gestión de proyectos o producto · Otro.
   Una seleccionada (fondo #0F766E, texto blanco).
3. "¿Cuántos años llevas en tu empresa actual?" → numérico.
4. "¿Cuántos años llevas trabajando en tecnología?" → numérico.
5. "¿Cómo trabajas habitualmente?" → tres opciones en fila: Remoto · Híbrido ·
   Presencial.
6. "¿Cuántas personas hay en tu equipo directo?" → numérico.
7. "¿Tienes personas a tu cargo?" → Sí / No.
8. "Cuando vas a la oficina, ¿cuántos minutos tardas en llegar?" → numérico.

Pie fijo: "Enviar".
```

---

## Pantalla 8 · Sesión de apoyo

```
Pantalla previa a una videollamada con un profesional de psicología. Móvil
390 × 844. Cabecera: "Sesión de apoyo", con flecha de volver.

La persona llega aquí porque el estudio le ofreció una sesión. El tono es de
invitación, no de urgencia. Nada aquí dice por qué se le ofreció.

Contenido centrado:
- Título "Sesión de apoyo".
- Párrafo: "Vas a hablar con un profesional de psicología. La conversación
  puede grabarse solo en audio, y únicamente si tú lo autorizas, para que el
  profesional cuente con un resumen de la sesión."
- Párrafo: "Puedes negarte y la sesión ocurre igual. La grabación se borra
  pasado el plazo acordado, y tu empresa nunca accede a ella."

Pie fijo con dos acciones:
- Botón secundario (borde #D6D2CC, texto #0F766E) "Autorizo que se grabe el
  audio". Una vez pulsado se sustituye por una línea de apoyo 14px #8A8580:
  "Autorizaste la grabación de esta sesión."
- Botón primario "Entrar a la sesión".

Prohibido: cualquier referencia a resultados, puntajes, "detección" o motivo
de la derivación.
```

---

## Pantalla 9 · Estados de cuenta

```
Dos pantallas de mensaje a pantalla completa, móvil 390 × 844, sin cabecera,
contenido centrado vertical y horizontalmente, texto 16px #57534E centrado
con ancho máximo 320px.

A) "Tu cuenta aún no está vinculada al estudio. Contacta al equipo de
    investigación."

B) "Tu seguimiento ha finalizado. El equipo de investigación se pondrá en
    contacto contigo."

En la B, NO decir por qué terminó. Puede ser fin del estudio, retiro del
consentimiento o derivación a acompañamiento, y la app no distingue.

Ambas con un botón de texto "Cerrar sesión" al pie.
```

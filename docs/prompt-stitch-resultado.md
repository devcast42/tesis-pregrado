# Prompt para Stitch — modal de resultado semanal

Copiar desde la línea siguiente.

---

Diseña el **modal de resultado semanal** de una app móvil de bienestar laboral usada en un estudio universitario con profesionales de tecnología. Cada viernes la persona responde un cuestionario validado de 16 preguntas; al terminar, sobre su pantalla de inicio sube este modal con cómo cerró su semana y qué puede hacer con eso.

Es el momento más delicado de la app: una persona, sola, un viernes en la noche, leyendo algo sobre sí misma. El diseño tiene que sentirse como una conversación con alguien que la respeta, no como un reporte médico ni como un dashboard.

## Lo que tiene que contener (el contenido es real, no cambies los textos)

1. Una etiqueta pequeña con la fecha: «TU SEMANA · 18 DE SETIEMBRE».
2. Un titular y un párrafo, distintos según el nivel general:
   - Bajo: «Tu semana cerró en verde» · «Tus respuestas muestran una relación con el trabajo que se sostiene bien. Lo que haces para descansar y desconectar está funcionando; conviene mantenerlo.»
   - A vigilar: «Una semana para mirar con atención» · «Tus respuestas están en una zona intermedia: no es un problema, pero es una señal temprana. Es el mejor momento para ajustar algo pequeño antes de que se acumule.»
   - Alto: «Esta semana pesó más de la cuenta» · «Tus respuestas muestran un nivel de desgaste alto. No estás solo con esto: el equipo del estudio te ofrecerá una sesión confidencial con un psicólogo, independiente de tu empresa, para conversarlo con calma.»
3. Dos dimensiones, cada una con nombre, una frase que la explica, un nivel (Bajo / A vigilar / Alto) y una magnitud de 0 a 100:
   - **Agotamiento** · «Cuánta energía te está costando el trabajo y cuánto te cuesta recuperarla.»
   - **Desvinculación** · «Qué tan lejos te sientes de lo que haces: interés, sentido, ganas.»
4. Una sección «Para esta semana» con entre 2 y 6 recomendaciones cortas, por ejemplo: «Elige una hora fija para cerrar el trabajo esta semana y cúmplela al menos tres días.» · «Antes de dormir, treinta minutos sin pantalla de trabajo. La recuperación empieza ahí.» · «Un almuerzo con alguien del equipo, sin hablar del proyecto.»
5. Solo en nivel alto: un bloque que anuncia la sesión con el psicólogo: «Un psicólogo del estudio te ofrecerá una sesión de apoyo. La verás en tu pantalla de inicio en cuanto esté disponible.»
5b. **La retrospectiva**, una sola frase en voz del sistema, entre las dimensiones y las recomendaciones: «El jueves, con 4 días respondidos, el modelo estimó 61 % de probabilidad de que hoy saliera alto. Salió alto: acertó. Cada semana que respondes lo entrena mejor.» (variante: «…Salió no alto: esta vez se equivocó…»). Tiene que sentirse como honestidad, no como alarde ni como disculpa.
5c. **El pronóstico para la próxima semana**, justo debajo: una etiqueta «PARA LA PRÓXIMA SEMANA», una pastilla de confianza («CONFIANZA BAJA / MEDIA / ALTA»), el número grande «50 %», la frase «de probabilidad de que el próximo viernes salga alto», una barra de 0 a 100, y un texto pequeño: «Estimación preliminar: el modelo fue entrenado con datos de otro estudio y todavía no con los de este. Irá mejorando con las semanas. De cada 10 avisos que da se confirman unos 3 la semana siguiente, y detecta unos 7 de cada 10 casos altos.»
6. Una nota discreta al pie: «Esto es el resultado de un cuestionario validado, no un diagnóstico. Solo tú y el equipo del estudio lo ven; tu empresa no.»
7. Un botón «Volver al inicio» y una X para cerrar.

## Reglas que no se negocian

- **Nunca aparece la palabra «burnout» ni «diagnóstico».** El nivel del cuestionario es una palabra y su magnitud es «50 de 100», no «50 %». El **único** porcentaje de la pantalla es el del pronóstico, porque ese sí es una probabilidad, y **nunca aparece sin su pastilla de confianza al lado**: son una sola unidad visual, no dos elementos.
- La confianza tiene tres tonos: baja en arena (#E5DED8 / #66625D), media en ámbar suave (#FFFBEB / #B45309), alta en verde de éxito (#F0FDF4 / #15803D). El porcentaje en sí no cambia de color por su valor: la barra va en verde azulado por debajo de 50 y en arena oscuro (#66625D) de 50 en adelante.
- **Nada rojo.** El rojo en esta app es solo para errores técnicos. El nivel alto tiene que sentirse serio sin alarmar: piensa en tonos tierra, arena, ámbar profundo.
- No hay gráficos de progreso histórico, comparaciones con otras personas ni promedios: la persona solo ve su semana.
- Es un **modal** (bottom sheet) sobre la pantalla de inicio, no una pantalla completa: se ve un poco de la pantalla de atrás oscurecida, tiene asa arriba y esquinas superiores redondeadas. Puede hacer scroll interno.
- Teléfono, 390 × 844, todo alcanzable con el pulgar.

## Sistema visual (ya existe; respétalo)

- Tipografía Inter en todos los pesos.
- Verde azulado como color primario: #2A7A6F, versión profunda #005C55, suave #EFF9F7. Fondo #FAF9F7, superficies blancas con borde #E8E5E0, texto #1C1917 / #57534E / #A8A29E.
- Arena para lo que pide atención sin alarmar: #E5DED8 con texto #66625D. Ámbar suave #FFFBEB / #B45309 para «a vigilar». Verde de éxito #F0FDF4 / #15803D para «bajo».
- Esquinas de 16 px en tarjetas, 999 en pastillas. Botón primario lleno, alto, sin sombra dura.

## Lo que quiero de ti

No me des la versión obvia (dos tarjetas con barras y una lista con checks: eso ya lo tengo y es correcto pero plano). Quiero que encuentres una forma de que **las dos dimensiones se lean de un vistazo como un solo estado** y que las recomendaciones parezcan una carta breve, no una lista de tareas. Explora el uso de forma orgánica, aire, jerarquía tipográfica y la transición entre el titular y las dimensiones. Piensa en cómo cambia la temperatura visual del modal entre bajo, a vigilar y alto sin cambiar la estructura.

Piensa también en cómo conviven, sin competir, tres cosas de naturaleza distinta: el resultado del cuestionario (lo que **es**), la retrospectiva (lo que el modelo **dijo**) y el pronóstico (lo que **podría venir**). Distinta jerarquía, distinto peso visual; el pronóstico no puede parecer más importante que el resultado.

Entrega **tres variantes del mismo modal**: nivel bajo, nivel a vigilar, nivel alto (esta última con el bloque del psicólogo). Y una cuarta pantalla más pequeña: el cierre de un día normal, lunes a jueves: «Gracias por hoy» · «Veinticinco segundos que valen una semana de datos. Nos vemos mañana.», con un consejo opcional: «Dormiste menos de seis horas. Si puedes, hoy acuéstate media hora antes: es el cambio con más efecto sobre cómo te sentirás mañana.», y con el mismo bloque de probabilidad pero titulado «TU SEMANA HASTA HOY» · «60 %» · «de probabilidad de que el cuestionario del viernes salga alto» · pastilla «CONFIANZA MEDIA» · texto pequeño: «Estimación preliminar: el modelo fue entrenado con datos de otro estudio y todavía no con los de este. Irá mejorando con las semanas. Con 3 días respondidos, de cada 10 avisos que da se confirman unos 4 el viernes, y detecta unos 6 de cada 10 casos altos.»

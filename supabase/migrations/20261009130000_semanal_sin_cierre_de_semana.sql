-- «Sobre tu semana» ya no cierra la semana.
--
-- Su descripción decía «Tres preguntas más y terminaste por esta semana», de
-- cuando iba detrás del OLBI de los viernes. Ahora sigue al cuestionario el
-- día que toque, y el lunes hay check-in otra vez. Solo cambia el texto de
-- presentación: las preguntas y las respuestas ya enviadas no se tocan.

update formularios
   set definicion = jsonb_set(definicion, '{descripcion}', '"Tres preguntas más sobre tu semana."')
 where clave = 'semanal' and version = 4;

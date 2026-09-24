-- ESP-002 RF-002-02 — la duración y la descripción viven en la definición.
--
-- La pantalla «Hoy» anunciaba «Check-in de hoy · 25 segundos / Cuatro frases
-- sobre tu día y dos datos» con un texto escrito a mano en la app. Al pasar el
-- diario a v3 (nueve preguntas) ese texto quedó mintiendo, y nadie se enteró
-- hasta abrir la pantalla.
--
-- Prometer 25 segundos y entregar 35 no es un detalle de estilo: la adherencia
-- es el cuello de botella del estudio (ESP-007), y la primera causa de
-- abandono es que la tarea dure más de lo anunciado.
--
-- `duracion` es texto y no un número de segundos a propósito: es lo que se le
-- muestra a una persona («35 segundos», «4 minutos»), no un cálculo.

update formularios set definicion = definicion || jsonb_build_object('duracion', '2 minutos')
 where clave = 'estable';

update formularios set definicion = definicion || jsonb_build_object('duracion', '25 segundos')
 where clave = 'diario' and version <= 2;
update formularios set definicion = definicion || jsonb_build_object('duracion', '35 segundos')
 where clave = 'diario' and version = 3;

update formularios set definicion = definicion || jsonb_build_object('duracion', '30 segundos')
 where clave = 'semanal';

update formularios set definicion = definicion || jsonb_build_object('duracion', '4 minutos')
 where clave = 'olbi';

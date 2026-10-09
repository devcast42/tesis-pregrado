-- Cerrar un caso no ha funcionado nunca.
--
-- `cerrar_derivacion` registra un evento `derivacion_cerrada`, pero ese valor
-- no se añadió nunca al tipo `tipo_evento`. El insert fallaba, la función
-- entera se deshacía y el psicólogo recibía «No se pudo cerrar el caso» sin
-- más. Ningún caso se pudo cerrar desde la app.
--
-- Va en su propia migración: un valor nuevo de un enum no se puede usar en la
-- misma transacción que lo crea.

alter type tipo_evento add value if not exists 'derivacion_cerrada';

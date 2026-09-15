-- Fecha "de hoy" según el estudio, no según el servidor.
--
-- La base corre en UTC y el estudio en Lima (UTC-5). Entre las 19:00 y la
-- medianoche de Lima, `current_date` ya avanzó al día siguiente. Consultar los
-- indicadores con `current_date` da resultados corridos un día — y no falla:
-- devuelve cero o cifras de otro día, que parecen plausibles.
--
-- Las vistas ya guardan fechas de Lima. Esta función es para el otro lado de
-- la consulta, y debe usarse SIEMPRE en lugar de `current_date`.
--
--   select * from indicador_volumen where dia = hoy_estudio();

create or replace function hoy_estudio() returns date
language sql stable as $$
  select (now() at time zone tz_estudio())::date
$$;

comment on function hoy_estudio is
  'Fecha actual en la zona del estudio. Usar en vez de current_date al consultar indicadores.';

-- La predicción del día se actualiza; antes se congelaba en la primera.
--
-- `registrar_prediccion` anotaba una sola vez al día y descartaba el resto.
-- Con el OLBI del viernes eso daba igual: entre la primera apertura y el
-- viernes no cambiaba gran cosa. Ahora el cuestionario lo pide el modelo
-- cualquier día, y la secuencia real es esta:
--
--   09:03:07  se abre la app     → se anota 47 % con 2 días respondidos
--   09:03:26  llega el check-in  → el modelo sube a 78 % y pide el OLBI
--   09:06:47  se responde el OLBI
--
-- La retrospectiva confrontaba el 47 %: una estimación de diecinueve
-- segundos antes del check-in que provocó todo. La persona veía al modelo
-- fallar con un número que el modelo ya no sostenía.
--
-- Ahora la fila del día se actualiza. Sigue habiendo una por día y por
-- tarea, y sigue siendo anterior al cuestionario, que es lo que la hace
-- válida para confrontarla; lo que cambia es que dice lo último que el
-- modelo sabía, no lo primero.
--
-- De paso, la condición comparaba solo versión y fecha, sin la tarea: un
-- `pronostico` registrado antes bloqueaba el `nowcast` del mismo día y
-- viceversa. Son dos preguntas distintas y cada una necesita su fila.

create or replace function registrar_prediccion(p_trabajador uuid, p_tarea text default 'nowcast')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r    jsonb := probabilidad_semana(p_trabajador, p_tarea);
  hoy  date  := (now() at time zone tz_estudio())::date;
  v_id bigint;   -- `eventos.id` es bigint, no uuid como el resto de tablas
begin
  if r is null or (r ->> 'probabilidad') is null then return r; end if;

  select e.id into v_id
    from eventos e
   where e.trabajador_id = p_trabajador
     and e.tipo = 'prediccion_modelo'
     and e.metadata ->> 'version' = r ->> 'version'
     and e.metadata ->> 'tarea'   = p_tarea
     and (e.metadata ->> 'dia')::date = hoy
   order by e.ocurrido_en desc
   limit 1;

  if v_id is null then
    insert into eventos (trabajador_id, tipo, metadata)
    values (p_trabajador, 'prediccion_modelo', jsonb_build_object(
      'version', r ->> 'version', 'tarea', p_tarea, 'dia', hoy,
      'n_dias', (r ->> 'n_dias')::int,
      'probabilidad', (r ->> 'probabilidad')::numeric,
      'senalado', (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric
    ));
  else
    -- `ocurrido_en` avanza con el dato: `ultima_prediccion_semana` ordena
    -- por esa columna y una fila actualizada pero con la hora vieja podría
    -- quedar detrás de otra más antigua.
    update eventos
       set metadata = metadata || jsonb_build_object(
             'n_dias',       (r ->> 'n_dias')::int,
             'probabilidad', (r ->> 'probabilidad')::numeric,
             'senalado',     (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric),
           ocurrido_en = now()
     where id = v_id;
  end if;

  return r;
end $$;

grant execute on function registrar_prediccion(uuid, text) to authenticated;

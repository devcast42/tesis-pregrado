-- La retrospectiva confronta lo que el modelo dijo ANTES del viernes con lo
-- que el OLBI dijo el viernes. Una predicción nowcast registrada el mismo
-- viernes (o después) no cuenta: ya sabía, o podía saber, la respuesta.

create or replace function ultima_prediccion_semana(p_participante uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with semana as (
    select ((now() at time zone tz_estudio())::date
            - (extract(isodow from now() at time zone tz_estudio())::int - 1)) as lunes
  )
  select e.metadata || jsonb_build_object('ocurrido_en', e.ocurrido_en)
  from eventos e, semana
  where e.participante_id = p_participante
    and e.tipo = 'prediccion_modelo'
    and e.metadata ->> 'tarea' = 'nowcast'
    and (e.metadata ->> 'dia')::date >= semana.lunes
    and (e.metadata ->> 'dia')::date <  semana.lunes + 4
    and (p_participante = participante_actual() or es_investigador() or psicologo_actual() is not null)
  order by e.ocurrido_en desc
  limit 1
$$;

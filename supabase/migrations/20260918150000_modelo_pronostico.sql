-- Modelo · tarea de pronóstico y retrospectiva — implementa ESP-005 §3.2 y ESP-002 RF-002-14.
--
-- El viernes la incógnita de la semana ya está resuelta (el OLBI la resolvió),
-- así que lo que tiene sentido mostrar es otra cosa:
--   · el PRONÓSTICO: con esta semana, ¿la próxima será alta?
--   · la RETROSPECTIVA: qué dijo el modelo el jueves y qué salió el viernes.
--
-- `probabilidad_semana` y `registrar_prediccion` reciben ahora la tarea.
-- Los rasgos son los mismos (`rasgos_semana`: lunes a hoy); lo que cambia es
-- la versión activa que los pesa y la etiqueta que predice.

drop function if exists probabilidad_semana(uuid);
drop function if exists registrar_prediccion(uuid);

create or replace function probabilidad_semana(p_participante uuid, p_tarea text default 'nowcast')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v modelo_versiones%rowtype;
  x jsonb;
  z numeric := 0;
  i int;
  nombre text;
  quien text;
begin
  if p_participante = participante_actual() then quien := 'participante';
  elsif es_investigador() then quien := 'investigador';
  elsif psicologo_actual() is not null then quien := 'psicologo';
  else raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v from modelo_versiones where tarea = p_tarea and activa;
  if not found then return null; end if;
  if not (quien = any (v.visible_para)) then return null; end if;

  x := rasgos_semana(p_participante);
  if x is null then
    return jsonb_build_object('version', v.version, 'tarea', p_tarea, 'n_dias', 0, 'probabilidad', null, 'metricas', v.metricas);
  end if;

  for i in 0 .. jsonb_array_length(v.rasgos) - 1 loop
    nombre := v.rasgos ->> i;
    z := z + (v.pesos ->> i)::numeric
           * ((x ->> nombre)::numeric - (v.medias ->> i)::numeric) / (v.desviaciones ->> i)::numeric;
  end loop;
  z := z + v.intercepto;

  return jsonb_build_object(
    'version', v.version,
    'tarea', p_tarea,
    'origen', v.origen,
    'n_dias', (x ->> 'n_dias')::int,
    'probabilidad', round(1 / (1 + exp(-z)), 3),
    'umbral_decision', v.umbral_decision,
    'metricas', v.metricas
  );
end $$;

create or replace function registrar_prediccion(p_participante uuid, p_tarea text default 'nowcast')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r jsonb := probabilidad_semana(p_participante, p_tarea);
  hoy date := (now() at time zone tz_estudio())::date;
begin
  if r is null or (r ->> 'probabilidad') is null then return r; end if;
  if not exists (
    select 1 from eventos
     where participante_id = p_participante and tipo = 'prediccion_modelo'
       and metadata ->> 'version' = r ->> 'version'
       and (ocurrido_en at time zone tz_estudio())::date = hoy
  ) then
    insert into eventos (participante_id, tipo, metadata)
    values (p_participante, 'prediccion_modelo', jsonb_build_object(
      'version', r ->> 'version', 'tarea', p_tarea, 'dia', hoy,
      'n_dias', (r ->> 'n_dias')::int,
      'probabilidad', (r ->> 'probabilidad')::numeric,
      'senalado', (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric
    ));
  end if;
  return r;
end $$;

-- La última predicción nowcast registrada esta semana antes del viernes: lo
-- que el modelo «dijo» y que el OLBI del viernes confirma o desmiente.
create or replace function ultima_prediccion_semana(p_participante uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select e.metadata || jsonb_build_object('ocurrido_en', e.ocurrido_en)
  from eventos e
  where e.participante_id = p_participante
    and e.tipo = 'prediccion_modelo'
    and e.metadata ->> 'tarea' = 'nowcast'
    and (e.ocurrido_en at time zone tz_estudio())::date
        >= (now() at time zone tz_estudio())::date - (extract(isodow from now() at time zone tz_estudio())::int - 1)
    and (p_participante = participante_actual() or es_investigador() or psicologo_actual() is not null)
  order by e.ocurrido_en desc
  limit 1
$$;

grant execute on function probabilidad_semana(uuid, text) to authenticated;
grant execute on function registrar_prediccion(uuid, text) to authenticated;
grant execute on function ultima_prediccion_semana(uuid) to authenticated;

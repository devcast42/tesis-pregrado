-- Racha de días completados — implementa ESP-002 RF-002-07.
--
-- Cuenta días hábiles consecutivos con el formulario del día enviado (el
-- check-in de lunes a jueves, el OLBI el viernes). El fin de semana no
-- rompe la racha: el lunes sigue al viernes. Un día hábil sin respuesta la
-- reinicia. El día de hoy sin responder no la rompe todavía: la racha vale
-- «hasta ayer» y hoy la puede alargar.
--
-- Se calcula en el servidor y en la zona horaria del estudio (tz_estudio),
-- igual que la adherencia, para que el teléfono y el panel cuenten lo mismo.

create or replace function dia_habil_anterior(d date) returns date
language sql immutable as $$
  select case extract(isodow from d)
    when 1 then d - 3   -- lunes → viernes
    when 7 then d - 2   -- domingo → viernes
    else d - 1
  end
$$;

create or replace function dia_habil_siguiente(d date) returns date
language sql immutable as $$
  select case extract(isodow from d)
    when 5 then d + 3   -- viernes → lunes
    when 6 then d + 2   -- sábado → lunes
    else d + 1
  end
$$;

create or replace function racha(p_participante uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy       date := (now() at time zone tz_estudio())::date;
  v_dias      date[];
  v_actual    int := 0;
  v_mejor     int := 0;
  v_corrida   int := 0;
  v_cursor    date;
  v_previo    date;
  v_d         date;
  v_hoy_hecho boolean;
begin
  -- Solo el propio participante (o el investigador) puede consultarla.
  if p_participante <> participante_actual() and not es_investigador() then
    return null;
  end if;

  select coalesce(array_agg(distinct dia order by dia), '{}')
  into v_dias
  from (
    select (enviado_en at time zone tz_estudio())::date as dia
    from respuestas
    where participante_id = p_participante
      and formulario_clave in ('diario', 'olbi')
  ) t
  where extract(isodow from dia) between 1 and 5;

  v_hoy_hecho := v_hoy = any (v_dias);

  -- Mejor racha: recorrido hacia adelante.
  foreach v_d in array v_dias loop
    if v_previo is not null and v_d = dia_habil_siguiente(v_previo) then
      v_corrida := v_corrida + 1;
    else
      v_corrida := 1;
    end if;
    v_mejor := greatest(v_mejor, v_corrida);
    v_previo := v_d;
  end loop;

  -- Racha actual: hacia atrás desde hoy (o desde el último día hábil si hoy
  -- aún no se respondió o es fin de semana).
  v_cursor := case when v_hoy_hecho then v_hoy else dia_habil_anterior(v_hoy) end;
  while v_cursor = any (v_dias) loop
    v_actual := v_actual + 1;
    v_cursor := dia_habil_anterior(v_cursor);
  end loop;

  return jsonb_build_object('actual', v_actual, 'mejor', v_mejor, 'hoy_cumplido', v_hoy_hecho);
end $$;

grant execute on function racha(uuid) to authenticated;

comment on function racha(uuid) is
  'ESP-002 RF-002-07. {actual, mejor, hoy_cumplido}: días hábiles consecutivos con el formulario del día enviado. El fin de semana no cuenta ni rompe.';

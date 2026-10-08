-- Qué tocaba cada día, para poder mirar atrás.
--
-- El cuestionario ya no cae un día fijo: lo dispara `olbi_toca`. Eso está
-- bien para hoy y es un problema para ayer, porque la función se calcula en
-- vivo y no deja rastro. Sin rastro no hay forma de decir «el martes te tocaba
-- y no lo hiciste», que es justo lo que distingue un día en blanco de un día
-- sin nada que hacer.
--
-- Así que la primera vez que toca en una semana queda anotado. A partir de
-- ahí: pendiente el día que se pidió, retrasado los siguientes, hecho cuando
-- se responde.

alter type tipo_evento add value if not exists 'olbi_requerido';

create or replace function olbi_toca(p_trabajador uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id      uuid := coalesce(p_trabajador, trabajador_actual());
  v_lunes   date := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_ultimo  date;
  v_prob    jsonb;
  v_umbral  numeric;
  v_motivo  text;
  v_extra   jsonb := '{}'::jsonb;
begin
  if v_id is null then return jsonb_build_object('toca', false); end if;
  if v_id <> trabajador_actual() and not es_investigador() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select max((enviado_en at time zone tz_estudio())::date) into v_ultimo
    from respuestas where trabajador_id = v_id and formulario_clave = 'olbi';

  if v_ultimo is not null and v_ultimo >= v_lunes then
    return jsonb_build_object('toca', false, 'motivo', 'ya_respondido');
  end if;

  v_prob := probabilidad_semana(v_id, 'nowcast');
  if v_prob is not null and (v_prob ->> 'probabilidad') is not null then
    v_umbral := (v_prob ->> 'umbral_decision')::numeric;
    if (v_prob ->> 'probabilidad')::numeric >= v_umbral then
      v_motivo := 'modelo';
      v_extra := jsonb_build_object('probabilidad', (v_prob ->> 'probabilidad')::numeric);
    end if;
  end if;

  if v_motivo is null
     and extract(isodow from (now() at time zone tz_estudio())) >= 5
     and abs(hashtext(v_id::text || v_lunes::text)) % 4 = 0 then
    v_motivo := 'sorteo';
  end if;

  if v_motivo is null and (v_ultimo is null or v_ultimo < v_lunes - 28) then
    v_motivo := 'sin_medir';
  end if;

  if v_motivo is null then
    return jsonb_build_object('toca', false, 'motivo', 'no_toca');
  end if;

  -- Se anota una sola vez por semana: lo que importa es el día en que se
  -- pidió, no cada vez que la persona abre la app.
  if not exists (
    select 1 from eventos e
     where e.trabajador_id = v_id and e.tipo = 'olbi_requerido'
       and (e.ocurrido_en at time zone tz_estudio())::date >= v_lunes
  ) then
    insert into eventos (trabajador_id, tipo, metadata)
    values (v_id, 'olbi_requerido', jsonb_build_object('motivo', v_motivo) || v_extra);
  end if;

  return jsonb_build_object('toca', true, 'motivo', v_motivo) || v_extra;
end $$;

grant execute on function olbi_toca(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- El día a día, para mirar atrás
-- ---------------------------------------------------------------------------

-- Una fila por día desde que la persona se inscribió, con lo que tocaba y lo
-- que hizo. La pantalla no tiene que deducir nada: pregunta por un día y
-- recibe su estado.
--
-- `caducado` y `retrasado` no son lo mismo y la diferencia importa: el
-- check-in de ayer ya no se puede responder —preguntaba por aquel día y la
-- respuesta de hoy no valdría— mientras que el cuestionario sí, porque mide
-- las últimas semanas y sigue sirviendo mañana.
create or replace view dia_a_dia
with (security_invoker = off) as
with dias as (
  select t.id as trabajador_id,
         generate_series(t.inscrito_en::date,
                         (now() at time zone tz_estudio())::date,
                         interval '1 day')::date as dia
  from trabajadores t
  where t.id = trabajador_actual() or es_investigador()
),
envios as (
  select trabajador_id, formulario_clave,
         (enviado_en at time zone tz_estudio())::date as dia
  from respuestas group by 1, 2, 3
),
pedido as (
  select trabajador_id, min((ocurrido_en at time zone tz_estudio())::date) as desde,
         date_trunc('week', (ocurrido_en at time zone tz_estudio()))::date as semana
  from eventos where tipo = 'olbi_requerido' group by 1, 3
)
select
  d.trabajador_id,
  d.dia,
  (extract(isodow from d.dia) between 1 and 4)            as tocaba_diario,
  exists (select 1 from envios e where e.trabajador_id = d.trabajador_id
            and e.formulario_clave = 'diario' and e.dia = d.dia)
                                                          as hizo_diario,
  -- El cuestionario se pidió esta semana y sigue sin responderse: pendiente
  -- el día que se pidió, retrasado después.
  (select p.desde from pedido p
    where p.trabajador_id = d.trabajador_id
      and p.semana = date_trunc('week', d.dia)::date)     as olbi_pedido_el,
  exists (select 1 from envios e where e.trabajador_id = d.trabajador_id
            and e.formulario_clave = 'olbi' and e.dia = d.dia)
                                                          as hizo_olbi,
  -- Las fechas van en la zona del estudio, no en UTC: una cita creada a las
  -- 20:00 de Lima es UTC del día siguiente, y aparecía un día corrida.
  (select min((de.abierta_en at time zone tz_estudio())::date) from derivaciones de
    where de.trabajador_id = d.trabajador_id and de.cerrada_en is null)
                                                          as cita_pedida_desde,
  exists (select 1 from citas ci where ci.trabajador_id = d.trabajador_id
            and (ci.creada_en at time zone tz_estudio())::date = d.dia)
                                                          as pidio_cita
from dias d;

comment on view dia_a_dia is
  'Producto. Un día por fila con lo que tocaba y lo que se hizo, para que la '
  'pantalla pueda mirar atrás sin recalcular reglas.';

grant select on dia_a_dia to authenticated;

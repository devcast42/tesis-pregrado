-- El panel de la empresa y el día a día del trabajador, con el flujo de ahora.
--
-- Desde el check-in v4 el OLBI ya no es «todos, cada viernes»: se pide a
-- quien el modelo señala tras un check-in, por sorteo, al mes sin medirse o
-- tras un alta. Cuatro piezas seguían con el calendario de antes.
--
-- 1. La nota de 1 a 4 del equipo (`pulso_empresa`, `_segmento`, `pulso_estudio`)
--    era la media de los OLBI contestados ESA semana, con un mínimo de 10.
--    Ahora casi ninguna semana llega a 10, y cuando llega son sobre todo
--    personas que el modelo señaló: la media sale peor que el equipo. Pasa a
--    ser la media del ÚLTIMO OLBI de cada persona en las 4 semanas que acaban
--    en esa. Como nadie pasa más de un mes sin medirse (`sin_medir`), cubre a
--    todo el equipo, y cada persona pesa una vez aunque la midan más a menudo.
--    Solo semanas cerradas: la de ahora todavía puede cambiar.
--
-- 2. La participación (`participacion_empresa_semanal`) contaba quién contestó
--    el OLBI. Con el flujo de ahora saldría siempre baja y el panel diría cada
--    semana «la lectura es poco fiable». `tasa_respuesta_pct` pasa a ser
--    quién hizo al menos un check-in esa semana, que es lo que se pide a
--    todos; se añade `respondieron_checkin`. `respondieron_viernes` se queda
--    (lo usan otras vistas) y sigue siendo cuántos contestaron el OLBI.
--
-- 3. El sorteo de `olbi_toca` solo corría de viernes a domingo, días sin
--    check-in: dependía de una notificación de viernes que llegaba a todos y
--    a tres de cada cuatro no les traía nada. Ahora corre desde el jueves y
--    se ofrece tras el check-in, como cuando avisa el modelo.
--
-- 4. La racha contaba días hábiles de lunes a viernes, y el viernes ya no hay
--    nada que responder: se cortaba cada semana y nunca pasaba de 4. Ahora
--    cuenta días de check-in seguidos (los de la definición vigente).

-- ---------------------------------------------------------------------------
-- 1. La nota del equipo
-- ---------------------------------------------------------------------------

create or replace view olbi_vigente_semana
with (security_invoker = off) as
with semanas as (
  select distinct t.organizacion_id, semana_de(r.enviado_en) as semana
    from respuestas r
    join trabajadores t on t.id = r.trabajador_id
   where r.formulario_clave in ('diario', 'olbi')
     and semana_de(r.enviado_en) < date_trunc('week', (now() at time zone tz_estudio()))::date
)
select distinct on (s.organizacion_id, s.semana, o.trabajador_id)
  s.organizacion_id, s.semana, o.trabajador_id,
  o.agotamiento, o.desvinculacion, o.semana as semana_medida
from semanas s
join olbi_semana_trabajador o
  on o.organizacion_id = s.organizacion_id
 and o.semana between s.semana - 21 and s.semana
order by s.organizacion_id, s.semana, o.trabajador_id, o.semana desc;

revoke all on olbi_vigente_semana from anon, authenticated;

comment on view olbi_vigente_semana is
  'Por empresa y semana cerrada, el último OLBI de cada persona en las 4 semanas que acaban en esa. Interna: solo la leen las vistas agregadas.';

create or replace view pulso_empresa
with (security_invoker = off) as
with agg as (
  select organizacion_id, semana,
    count(*) as respondientes,
    round(avg(agotamiento), 1) as agotamiento_media,
    round(avg(desvinculacion), 1) as desvinculacion_media
  from olbi_vigente_semana
  group by organizacion_id, semana
)
select organizacion_id, semana, respondientes, agotamiento_media, desvinculacion_media,
  nivel_empresa('agotamiento', agotamiento_media) as nivel_agotamiento,
  nivel_empresa('desvinculacion', desvinculacion_media) as nivel_desvinculacion
from agg
where respondientes >= minimo_para_reportar() and alcance_empresa(organizacion_id);

create or replace view pulso_empresa_segmento
with (security_invoker = off) as
with agg as (
  select o.organizacion_id, o.semana, s.tipo as tipo_segmento, s.segmento,
    count(*) as respondientes,
    round(avg(o.agotamiento), 1) as agotamiento_media,
    round(avg(o.desvinculacion), 1) as desvinculacion_media
  from olbi_vigente_semana o
  join segmento_trabajador s on s.trabajador_id = o.trabajador_id
  group by o.organizacion_id, o.semana, s.tipo, s.segmento
)
select organizacion_id, semana, tipo_segmento, segmento, respondientes, agotamiento_media, desvinculacion_media,
  nivel_empresa('agotamiento', agotamiento_media) as nivel_agotamiento,
  nivel_empresa('desvinculacion', desvinculacion_media) as nivel_desvinculacion
from agg
where respondientes >= minimo_para_reportar() and alcance_empresa(organizacion_id);

create or replace view pulso_estudio
with (security_invoker = off) as
with agg as (
  select semana,
    count(distinct organizacion_id) as empresas,
    count(*) as respondientes,
    round(avg(agotamiento), 1) as agotamiento_media,
    round(avg(desvinculacion), 1) as desvinculacion_media
  from olbi_vigente_semana
  where organizacion_id is distinct from empresa_del_admin()
  group by semana
)
select semana, empresas, respondientes, agotamiento_media, desvinculacion_media
from agg
where empresas >= 2 and respondientes >= minimo_para_reportar();

-- ---------------------------------------------------------------------------
-- 2. La participación
-- ---------------------------------------------------------------------------

create or replace view participacion_empresa_semanal
with (security_invoker = off) as
with semanas as (
  select t.organizacion_id, semana_de(r.enviado_en) as semana,
    count(distinct r.trabajador_id) filter (where r.formulario_clave = 'olbi')   as respondieron_viernes,
    count(distinct r.trabajador_id) filter (where r.formulario_clave = 'diario') as respondieron_checkin
  from respuestas r
  join trabajadores t on t.id = r.trabajador_id
  where r.formulario_clave in ('diario', 'olbi')
    and semana_de(r.enviado_en) < date_trunc('week', (now() at time zone tz_estudio()))::date
  group by t.organizacion_id, semana_de(r.enviado_en)
), seguimiento as (
  select o.id as organizacion_id, s_1.semana,
    count(p.id) filter (where p.inscrito_en < s_1.semana + 7) as inscritos,
    count(p.id) filter (where p.inscrito_en < s_1.semana + 7 and p.estado = 'activo') as en_seguimiento
  from organizaciones o
  join semanas s_1 on s_1.organizacion_id = o.id
  left join trabajadores p on p.organizacion_id = o.id
  group by o.id, s_1.semana
)
select s.organizacion_id, s.semana, g.en_seguimiento, s.respondieron_viernes,
  case when g.inscritos > 0 then redondear_a_5(100.0 * s.respondieron_checkin / g.inscritos) end as tasa_respuesta_pct,
  g.inscritos,
  s.respondieron_checkin
from semanas s
join seguimiento g on g.organizacion_id = s.organizacion_id and g.semana = s.semana
where alcance_empresa(s.organizacion_id);

-- ---------------------------------------------------------------------------
-- 3. El sorteo, desde el jueves
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.olbi_toca(p_trabajador uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid := coalesce(p_trabajador, trabajador_actual());
  v_hoy     date := (now() at time zone tz_estudio())::date;
  v_lunes   date := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_ultimo  date;
  v_alta    date;
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

  -- El último alta sin un cuestionario posterior. Mientras exista, esta
  -- persona está pendiente de su medida de control.
  select max((cerrada_en at time zone tz_estudio())::date) into v_alta
    from derivaciones where trabajador_id = v_id and cerrada_en is not null;
  if v_alta is not null and v_ultimo is not null and v_ultimo >= v_alta then v_alta := null; end if;

  v_prob := probabilidad_semana(v_id, 'nowcast');
  if v_prob is not null and (v_prob ->> 'probabilidad') is not null then
    v_umbral := (v_prob ->> 'umbral_decision')::numeric;
    if (v_prob ->> 'probabilidad')::numeric >= v_umbral then
      v_motivo := 'modelo';
      v_extra := jsonb_build_object('probabilidad', (v_prob ->> 'probabilidad')::numeric);
    end if;
  end if;

  if v_motivo is null and v_alta is not null and v_hoy >= v_alta + 14 then
    v_motivo := 'tras_alta';
  end if;

  if v_motivo is null
     -- Desde el jueves, el último día de check-in: así se ofrece tras él,
     -- sin depender de que la persona abra la app un viernes.
     and extract(isodow from (now() at time zone tz_estudio())) >= 4
     and abs(hashtext(v_id::text || v_lunes::text)) % 4 = 0 then
    v_motivo := 'sorteo';
  end if;

  -- «Un mes sin medirse» no aplica en los 14 días después del alta: el último
  -- cuestionario es el de la detección y caería el primer día de vuelta,
  -- cuando el control ya tiene su fecha.
  if v_motivo is null and v_alta is null and (v_ultimo is null or v_ultimo < v_lunes - 28) then
    v_motivo := 'sin_medir';
  end if;

  if v_motivo is null then
    return jsonb_build_object('toca', false, 'motivo', 'no_toca');
  end if;

  if not exists (
    select 1 from eventos e
     where e.trabajador_id = v_id and e.tipo = 'olbi_requerido'
       and (e.ocurrido_en at time zone tz_estudio())::date >= v_lunes
  ) then
    insert into eventos (trabajador_id, tipo, metadata)
    values (v_id, 'olbi_requerido', jsonb_build_object('motivo', v_motivo) || v_extra);
  end if;

  return jsonb_build_object('toca', true, 'motivo', v_motivo) || v_extra;
end $function$;

-- ---------------------------------------------------------------------------
-- 4. La racha, en días de check-in
-- ---------------------------------------------------------------------------

create or replace function dia_checkin_anterior(d date)
returns date language plpgsql stable as $$
declare x date := d - 1;
begin
  for i in 1..7 loop
    if es_dia_de_checkin(x) then return x; end if;
    x := x - 1;
  end loop;
  return d - 1;
end $$;

create or replace function dia_checkin_siguiente(d date)
returns date language plpgsql stable as $$
declare x date := d + 1;
begin
  for i in 1..7 loop
    if es_dia_de_checkin(x) then return x; end if;
    x := x + 1;
  end loop;
  return d + 1;
end $$;

CREATE OR REPLACE FUNCTION public.racha(p_trabajador uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Solo el propio trabajador (o el investigador) puede consultarla.
  if p_trabajador <> trabajador_actual() and not es_investigador() then
    return null;
  end if;

  select coalesce(array_agg(distinct dia order by dia), '{}')
  into v_dias
  from (
    select (enviado_en at time zone tz_estudio())::date as dia
    from respuestas
    where trabajador_id = p_trabajador
      and formulario_clave = 'diario'
  ) t
  where es_dia_de_checkin(dia);

  v_hoy_hecho := v_hoy = any (v_dias);

  -- Mejor racha: recorrido hacia adelante.
  foreach v_d in array v_dias loop
    if v_previo is not null and v_d = dia_checkin_siguiente(v_previo) then
      v_corrida := v_corrida + 1;
    else
      v_corrida := 1;
    end if;
    v_mejor := greatest(v_mejor, v_corrida);
    v_previo := v_d;
  end loop;

  -- Racha actual: hacia atrás desde hoy (o desde el último día hábil si hoy
  -- aún no se respondió o es fin de semana).
  v_cursor := case when v_hoy_hecho then v_hoy else dia_checkin_anterior(v_hoy) end;
  while v_cursor = any (v_dias) loop
    v_actual := v_actual + 1;
    v_cursor := dia_checkin_anterior(v_cursor);
  end loop;

  return jsonb_build_object('actual', v_actual, 'mejor', v_mejor, 'hoy_cumplido', v_hoy_hecho);
end $function$;

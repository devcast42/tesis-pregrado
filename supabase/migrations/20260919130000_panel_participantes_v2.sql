-- Tabla de participantes del investigador — ESP-009 RF-009-07.
--
-- `panel_participantes` (ESP-006) no traía el último OLBI, el nowcast vigente,
-- la derivación ni la cita: la tabla del diseño los muestra en cada fila y
-- filtra por ellos. Una fila por participante, sin nombres.

create or replace view panel_participantes_v2
with (security_invoker = on) as
with ultimo_olbi as (
  select distinct on (participante_id) participante_id, semana, agotamiento, desvinculacion, alto,
         umbral_agotamiento, umbral_desvinculacion
  from olbi_semanal_etiquetado order by participante_id, semana desc
),
nowcast as (
  select distinct on (participante_id) participante_id, probabilidad, n_dias, dia, version
  from predicciones_participante
  where tarea = 'nowcast' and semana = date_trunc('week', (now() at time zone tz_estudio())::date)::date
  order by participante_id, ocurrido_en desc
),
deriv as (
  select distinct on (participante_id) participante_id, derivacion_id, psicologo, estado as estado_derivacion, origen
  from circuito_apoyo where cerrada_en is null order by participante_id, derivado_en desc
),
cita as (
  select distinct on (participante_id) participante_id, estado as estado_cita, propuesta_para
  from citas where estado in ('solicitada', 'confirmada') order by participante_id, creada_en desc
)
select
  p.id, p.codigo_anonimo, p.organizacion_id, o.nombre as organizacion, p.estado, p.inscrito_en,
  greatest(1, floor(extract(epoch from (now() - p.inscrito_en)) / (7 * 86400))::int + 1) as semana,
  a.dias_sin_checkin, a.tasa_adherencia, a.estado_adherencia, a.dias_cumplidos, a.dias_esperados,
  u.semana as olbi_semana, u.agotamiento as olbi_agotamiento, u.desvinculacion as olbi_desvinculacion, u.alto as olbi_alto,
  case when u.agotamiento is null then null
       when u.agotamiento >= u.umbral_agotamiento or u.desvinculacion >= u.umbral_desvinculacion then 'alto'
       when u.agotamiento >= u.umbral_agotamiento - 0.5 or u.desvinculacion >= u.umbral_desvinculacion - 0.5 then 'a_vigilar'
       else 'bajo' end as olbi_nivel,
  n.probabilidad as nowcast, n.n_dias as nowcast_dias, n.version as nowcast_version,
  d.derivacion_id, d.psicologo, d.estado_derivacion, d.origen as origen_derivacion,
  c.estado_cita, c.propuesta_para as cita_para,
  (select ocurrido_en from eventos e where e.participante_id = p.id and e.tipo = 'deteccion' order by ocurrido_en desc limit 1) as detectado_en
from participantes p
join organizaciones o on o.id = p.organizacion_id
left join adherencia a on a.participante_id = p.id
left join ultimo_olbi u on u.participante_id = p.id
left join nowcast n on n.participante_id = p.id
left join deriv d on d.participante_id = p.id
left join cita c on c.participante_id = p.id
where es_investigador();

grant select on panel_participantes_v2 to authenticated;

-- Historial de exportaciones (RF-009-13): los eventos, aplanados.
create or replace view exportaciones_registradas
with (security_invoker = on) as
select e.id, e.ocurrido_en, e.metadata -> 'filtros' as filtros, e.metadata -> 'conteos' as conteos,
       e.metadata ->> 'hash' as hash, e.metadata ->> 'formato' as formato, (e.metadata ->> 'por')::uuid as por
from eventos e where e.tipo::text = 'exportacion_dataset' and es_investigador();

grant select on exportaciones_registradas to authenticated;

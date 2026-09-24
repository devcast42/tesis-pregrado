-- ESP-009 RF-009-10 — el circuito de apoyo se lee de `eventos`, no de las
-- tablas clínicas.
--
-- EL FALLO
--
-- `circuito_apoyo` es `security_invoker`, y el investigador no tiene —a
-- propósito— política de lectura sobre `sesiones_consulta` ni sobre `informes`
-- (RN-004-08: el contenido clínico no es dato de investigación). Con lo cual
-- esas dos tablas le devolvían cero filas y la vista le decía siempre lo mismo:
-- todas las derivaciones «sin sesión», con `dias_a_sesion` y `dias_a_informe`
-- nulos.
--
-- No es cosmético: «detección → primera sesión» es el indicador OE2 de la
-- tesis, y así no se podía medir desde el panel. El psicólogo sí veía bien su
-- bandeja, porque él lee las tablas directamente, de modo que el fallo solo
-- aparecía mirando el panel del investigador con datos de verdad.
--
-- LA CORRECCIÓN
--
-- La propia RN-004-08 dice de dónde debe salir: «los indicadores de la tesis
-- salen de `eventos`». Ahí está el hecho —hubo sesión, se generó un informe, se
-- aprobó— con su marca de tiempo y sin una línea de contenido clínico. Las
-- columnas no cambian; cambia la fuente.

create or replace view circuito_apoyo
with (security_invoker = on) as
with det as (
  select d_1.id as derivacion_id,
    (select e.ocurrido_en from eventos e
      where e.id = d_1.evento_deteccion_id
         or (d_1.evento_deteccion_id is null and e.participante_id = d_1.participante_id
             and e.tipo = 'deteccion' and e.ocurrido_en <= d_1.abierta_en)
      order by e.ocurrido_en desc limit 1) as detectado_en
  from derivaciones d_1
),
-- Hitos del acompañamiento, acotados a la vida de la derivación.
hitos as (
  select d_1.id as derivacion_id, e.tipo, e.ocurrido_en
  from derivaciones d_1
  join eventos e
    on e.participante_id = d_1.participante_id
   and e.ocurrido_en >= d_1.abierta_en
   and (d_1.cerrada_en is null or e.ocurrido_en <= d_1.cerrada_en + interval '1 day')
   and e.tipo in ('sesion_iniciada', 'sesion_realizada', 'informe_generado', 'informe_aprobado')
),
ses as (
  select derivacion_id,
    min(ocurrido_en) filter (where tipo in ('sesion_iniciada', 'sesion_realizada')) as primera_sesion_en,
    count(*) filter (where tipo in ('sesion_iniciada', 'sesion_realizada')) as sesiones,
    count(*) filter (where tipo = 'sesion_realizada')                       as sesiones_finalizadas
  from hitos group by derivacion_id
),
inf as (
  select derivacion_id,
    min(ocurrido_en) filter (where tipo = 'informe_aprobado') as informe_aprobado_en,
    greatest(count(*) filter (where tipo = 'informe_generado')
           - count(*) filter (where tipo = 'informe_aprobado'), 0) as informes_pendientes
  from hitos group by derivacion_id
),
cit as (
  select d_1.id as derivacion_id,
    (select min(e.ocurrido_en) from eventos e
      where e.participante_id = d_1.participante_id and e.tipo = 'cita_confirmada'
        and e.ocurrido_en >= d_1.abierta_en) as cita_confirmada_en
  from derivaciones d_1
)
select d.id as derivacion_id,
  d.participante_id,
  p.codigo_anonimo,
  p.organizacion_id,
  d.psicologo_id,
  ps.nombre as psicologo,
  d.origen,
  det.detectado_en,
  d.abierta_en as derivado_en,
  ses.primera_sesion_en,
  inf.informe_aprobado_en,
  d.cerrada_en,
  coalesce(ses.sesiones, 0::bigint) as sesiones,
  coalesce(inf.informes_pendientes, 0::bigint) as informes_pendientes,
  round(extract(epoch from d.abierta_en - det.detectado_en) / 86400::numeric, 1) as dias_a_derivacion,
  round(extract(epoch from ses.primera_sesion_en - d.abierta_en) / 86400::numeric, 1) as dias_a_sesion,
  round(extract(epoch from inf.informe_aprobado_en - ses.primera_sesion_en) / 86400::numeric, 1) as dias_a_informe,
  case
    when d.cerrada_en is not null then 'cerrada'::text
    when inf.informes_pendientes > 0 then 'informe_pendiente'::text
    when coalesce(ses.sesiones_finalizadas, 0) > 0 then 'sesion_realizada'::text
    when coalesce(ses.sesiones, 0) > 0 then 'sala_abierta'::text
    else 'sin_sesion'::text
  end as estado,
  cit.cita_confirmada_en,
  round(extract(epoch from cit.cita_confirmada_en - d.abierta_en) / 86400::numeric, 1) as dias_a_cita,
  round(extract(epoch from ses.primera_sesion_en - cit.cita_confirmada_en) / 86400::numeric, 1) as dias_cita_a_sesion
from derivaciones d
  join participantes p on p.id = d.participante_id
  left join psicologos ps on ps.id = d.psicologo_id
  left join det on det.derivacion_id = d.id
  left join ses on ses.derivacion_id = d.id
  left join inf on inf.derivacion_id = d.id
  left join cit on cit.derivacion_id = d.id;

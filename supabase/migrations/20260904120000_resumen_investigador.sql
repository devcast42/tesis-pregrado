-- Datos que faltaban para el panel del investigador — ESP-006 RF-006-09.
--
-- Se agregan al resumen tres cifras que el panel ya mostraba calculadas a
-- mano o no mostraba: cuántos nunca iniciaron, cuántas derivaciones se
-- cerraron y en cuántas empresas está el estudio. Recalcularlas en el cliente
-- habría creado una segunda verdad frente a la que llega al capítulo de
-- resultados.

-- `create or replace` no admite insertar columnas en medio: hay que soltarla.
drop view if exists resumen_estudio;

create view resumen_estudio
with (security_invoker = on) as
select
  (select count(*) from participantes)                                    as inscritos,
  (select count(*) from participantes where estado = 'activo')            as activos,
  (select count(*) from participantes where estado = 'detectado')         as detectados,
  (select count(*) from organizaciones)                                   as empresas,
  (select count(*) from adherencia where estado_adherencia = 'al_dia')    as al_dia,
  (select count(*) from adherencia where estado_adherencia = 'en_riesgo') as en_riesgo,
  (select count(*) from adherencia where estado_adherencia = 'inactivo')  as inactivos,
  (select count(*) from adherencia where estado_adherencia = 'nunca_inicio') as nunca_inicio,
  (select round(avg(tasa_adherencia), 3) from adherencia)                 as adherencia_promedio,
  (select round(avg(dias_hasta_deteccion), 2)
     from indicador_tiempo_deteccion where not censurado)                 as dias_deteccion_promedio,
  (select count(*) from derivaciones where cerrada_en is null)            as derivaciones_abiertas,
  (select count(*) from derivaciones where cerrada_en is not null)        as derivaciones_cerradas,
  (select count(*) from informes where estado = 'sin_revisar')            as informes_por_revisar;

comment on view resumen_estudio is
  'Cifras de cabecera del panel del investigador. Una fila.';

-- ---------------------------------------------------------------------------
-- Detecciones recientes
-- ---------------------------------------------------------------------------
--
-- Lo que el investigador necesita vigilar no es un cuadro clínico —eso es del
-- psicólogo— sino que el circuito funcione: alguien fue detectado, ¿se derivó?
-- Por eso las columnas son código, empresa, los dos puntajes OLBI que
-- dispararon la detección, y el estado de la derivación. Nada más.
--
-- No hay columna de "motivo" ni de "factor crítico": el sistema no produce
-- interpretación clínica, y un panel que la insinuara invitaría a leerla como
-- diagnóstico (ESP-004 RN-004-01).

drop view if exists detecciones_recientes;

create view detecciones_recientes
with (security_invoker = on) as
with ultima_olbi as (
  select distinct on (participante_id)
    participante_id, respuesta_id, enviado_en
  from puntajes_olbi
  order by participante_id, enviado_en desc
),
puntajes as (
  select
    u.participante_id,
    u.enviado_en,
    max(po.puntaje) filter (where po.dimension = 'agotamiento')    as agotamiento,
    max(po.puntaje) filter (where po.dimension = 'desvinculacion') as desvinculacion
  from ultima_olbi u
  join puntajes_olbi po on po.respuesta_id = u.respuesta_id
  group by u.participante_id, u.enviado_en
),
deteccion as (
  select distinct on (participante_id)
    participante_id, ocurrido_en
  from eventos
  where tipo = 'deteccion'
  order by participante_id, ocurrido_en desc
)
select
  p.id                as participante_id,
  p.codigo_anonimo,
  o.nombre            as organizacion,
  d.ocurrido_en       as detectado_en,
  pu.agotamiento,
  pu.desvinculacion,
  der.id              as derivacion_id,
  der.cerrada_en,
  ps.nombre           as psicologo
from deteccion d
join participantes p   on p.id = d.participante_id
join organizaciones o  on o.id = p.organizacion_id
left join puntajes pu  on pu.participante_id = p.id
left join lateral (
  select dv.id, dv.psicologo_id, dv.cerrada_en
  from derivaciones dv
  where dv.participante_id = p.id
  order by dv.abierta_en desc
  limit 1
) der on true
left join psicologos ps on ps.id = der.psicologo_id
order by d.ocurrido_en desc;

comment on view detecciones_recientes is
  'ESP-006. Detecciones con su estado de derivación. Sin interpretación clínica.';

grant select on detecciones_recientes to authenticated;

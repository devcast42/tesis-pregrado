-- La agenda del psicólogo, para pintarla como un calendario.
--
-- La vista solo traía citas pendientes desde ayer. Para una lista de «lo que
-- viene» bastaba; para una semana con sus días no: el lunes salía vacío aunque
-- hubiera atendido a dos personas, y una semana con huecos donde hubo citas
-- dice algo falso. Ahora trae también las atendidas, desde el lunes de la
-- semana pasada, para poder volver una semana atrás.
--
-- Y la empresa, que es lo que distingue a una persona de otra en un bloque de
-- calendario cuando solo se tiene un código.
--
-- Se añade al final: `create or replace view` no deja mover columnas.

create or replace view agenda_psicologo
with (security_invoker = off) as
select
  c.id                                               as cita_id,
  c.derivacion_id,
  c.trabajador_id,
  i.nombre,
  p.codigo_anonimo,
  c.propuesta_para,
  c.estado,
  c.motivo,
  (c.propuesta_para at time zone tz_estudio())::date as dia,
  exists (select 1 from sesiones_consulta s
           where s.derivacion_id = c.derivacion_id and s.finalizada_en is null)
                                                     as sesion_en_curso,
  o.nombre                                           as empresa
from citas c
join trabajadores p       on p.id = c.trabajador_id
left join identidades i   on i.trabajador_id = c.trabajador_id
left join organizaciones o on o.id = p.organizacion_id
where c.psicologo_id = psicologo_actual()
  and c.estado in ('solicitada', 'confirmada', 'atendida')
  -- El lunes de la semana pasada, en hora de Lima y devuelto a timestamptz:
  -- comparar un timestamp local con uno con zona lo leería en UTC.
  and c.propuesta_para >= ((date_trunc('week', now() at time zone tz_estudio()) - interval '7 days') at time zone tz_estudio());

comment on view agenda_psicologo is
  'Producto. Citas del psicólogo actual desde el lunes de la semana pasada, '
  'atendidas incluidas, para pintarlas como un calendario.';

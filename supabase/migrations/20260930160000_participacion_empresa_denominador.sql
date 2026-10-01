-- ESP-008 RF-008-14 — la participación de la empresa pasaba del 100 %.
--
-- `tasa_respuesta_pct` dividía entre `en_seguimiento`, que cuenta solo a
-- quien está HOY en estado `activo`. Pero el OLBI del viernes lo contesta
-- también quien ya fue detectado o terminó el seguimiento, así que el
-- numerador incluía gente que el denominador no: en Nexa Software salía
-- «22 de 20 respondieron (110 %)» tres semanas seguidas.
--
-- El denominador honesto es cuánta gente llevaba la empresa inscrita en esa
-- semana, sea cual sea su estado de hoy. Se añade como `inscritos` y la tasa
-- pasa a calcularse con él. `en_seguimiento` se conserva: dice otra cosa
-- —cuántos siguen activos— y alguna pantalla la usa.

create or replace view participacion_empresa_semanal
with (security_invoker = off) as
with semanas as (
  select organizacion_id, semana, count(*) as respondieron_viernes
  from olbi_semana_participante
  group by organizacion_id, semana
),
seguimiento as (
  select o.id as organizacion_id, s.semana,
         count(p.id) filter (where p.inscrito_en < s.semana + 7) as inscritos,
         count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'activo') as en_seguimiento
  from organizaciones o
  join semanas s on s.organizacion_id = o.id
  left join participantes p on p.organizacion_id = o.id
  group by o.id, s.semana
)
-- El orden de las columnas existentes no se toca: `create or replace view`
-- no deja renombrarlas ni reordenarlas, así que `inscritos` va al final.
select s.organizacion_id, s.semana,
       g.en_seguimiento,
       s.respondieron_viernes,
       case when g.inscritos > 0
            then redondear_a_5(100.0 * s.respondieron_viernes::numeric / g.inscritos::numeric)
            else null::integer end as tasa_respuesta_pct,
       g.inscritos
from semanas s
join seguimiento g on g.organizacion_id = s.organizacion_id and g.semana = s.semana
where alcance_empresa(s.organizacion_id);

comment on view participacion_empresa_semanal is
  'ESP-008 RF-008-14. Participación semanal de la empresa. La tasa se calcula sobre las personas inscritas hasta esa semana, no sobre las que siguen activas: el OLBI lo contesta también quien ya fue detectado o terminó.';

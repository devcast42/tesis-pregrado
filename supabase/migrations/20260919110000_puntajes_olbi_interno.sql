-- Corrección del panel del empresario — ESP-008 rev. 2.
--
-- `pulso_empresa` se apoyaba en `puntajes_olbi`, que es una vista
-- security_invoker: dentro de la cadena de vistas definer, PostgREST la
-- evalúa con los permisos del admin, que no lee `respuestas`, y el pulso
-- salía vacío (los factores, que van directo a las tablas, sí salían).
-- Se añade una copia interna definer con la MISMA fórmula, no concedida a
-- ningún rol, y las vistas internas del panel apuntan a ella.

create or replace view puntajes_olbi_interno
with (security_invoker = off) as
with definicion_items as (
  select
    f.clave,
    f.version,
    item->>'clave'                                     as item_clave,
    item->>'dimension'                                 as dimension,
    coalesce((item->>'invertido')::boolean, false)     as invertido,
    (f.definicion->'escala'->>'min')::numeric          as escala_min,
    (f.definicion->'escala'->>'max')::numeric          as escala_max
  from formularios f,
       lateral jsonb_array_elements(f.definicion->'items') as item
  where f.clave = 'olbi'
)
select
  r.id                as respuesta_id,
  r.participante_id,
  r.enviado_en,
  d.dimension,
  count(*)            as items_contados,
  round(avg(
    case when d.invertido
         then d.escala_min + d.escala_max - ri.valor_num
         else ri.valor_num
    end
  ), 3)               as puntaje
from respuestas r
join definicion_items d
  on d.clave = r.formulario_clave and d.version = r.formulario_version
join respuestas_items ri
  on ri.respuesta_id = r.id and ri.item_clave = d.item_clave
where r.formulario_clave = 'olbi'
  and ri.valor_num is not null
group by r.id, r.participante_id, r.enviado_en, d.dimension;

comment on view puntajes_olbi_interno is
  'Copia definer de puntajes_olbi para las vistas agregadas del panel del empresario. No conceder a ningún rol.';

create or replace view olbi_semana_participante
with (security_invoker = off) as
select distinct on (p.participante_id, semana_de(p.enviado_en))
  p.participante_id,
  pa.organizacion_id,
  semana_de(p.enviado_en)                                  as semana,
  max(p.puntaje) filter (where p.dimension = 'agotamiento')     over (partition by p.respuesta_id) as agotamiento,
  max(p.puntaje) filter (where p.dimension = 'desvinculacion')  over (partition by p.respuesta_id) as desvinculacion
from puntajes_olbi_interno p
join participantes pa on pa.id = p.participante_id
order by p.participante_id, semana_de(p.enviado_en), p.enviado_en desc;

revoke all on puntajes_olbi_interno, olbi_semana_participante from authenticated, anon;

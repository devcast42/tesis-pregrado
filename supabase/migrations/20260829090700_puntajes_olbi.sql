-- Puntajes OLBI — fuente única de la fórmula.
--
-- Antes la inversión de ítems y la media por dimensión vivían solo en la
-- Edge Function. Al necesitar el psicólogo ver la trayectoria (ESP-006
-- RF-006-03), la fórmula habría quedado escrita en dos lugares y habrían
-- divergido en silencio. Vive aquí; la Edge Function lee de esta vista.
--
-- El puntaje NO se almacena: se recalcula desde los ítems crudos cada vez,
-- así cambiar un umbral o corregir una inversión no obliga a recolectar de
-- nuevo (ESP-002 RN-002-05, ESP-003 RN-003-03).

create or replace view puntajes_olbi
with (security_invoker = on) as
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

comment on view puntajes_olbi is
  'Media por dimensión con inversión aplicada. Fuente única de la fórmula OLBI.';

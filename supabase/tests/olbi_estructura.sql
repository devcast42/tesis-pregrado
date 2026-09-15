\echo '=== 1. Estructura: debe dar 8 y 8, con 4 invertidos cada una ==='
select item->>'dimension' as dimension,
       count(*) as items,
       count(*) filter (where (item->>'invertido')::boolean) as invertidos
from formularios, jsonb_array_elements(definicion->'items') item
where clave='olbi' group by 1 order by 1;

\echo '=== 2. Ningún texto vacío ==='
select count(*) as items_sin_texto
from formularios, jsonb_array_elements(definicion->'items') item
where clave='olbi' and coalesce(item->>'texto','') = '';

insert into organizaciones (id, nombre) values ('bbbb1111-0000-0000-0000-000000000001','Test');
insert into auth.users (id) values ('bbbb2222-0000-0000-0000-000000000001');
insert into participantes (id, organizacion_id, auth_user_id, codigo_anonimo)
  values ('bbbb3333-0000-0000-0000-000000000001','bbbb1111-0000-0000-0000-000000000001',
          'bbbb2222-0000-0000-0000-000000000001','T-002');

-- Caso A: burnout máximo. De acuerdo (4) con lo negativo, en desacuerdo (1) con lo positivo.
insert into respuestas (id, participante_id, formulario_clave, formulario_version, iniciado_en)
  values ('bbbb4444-0000-0000-0000-000000000001','bbbb3333-0000-0000-0000-000000000001','olbi',1, now());
insert into respuestas_items (respuesta_id, item_clave, valor_num)
select 'bbbb4444-0000-0000-0000-000000000001',
       item->>'clave',
       case when (item->>'invertido')::boolean then 1 else 4 end
from formularios, jsonb_array_elements(definicion->'items') item
where clave='olbi' and version=1;

\echo '=== 3. Burnout máximo: ambas dimensiones deben dar 4.000 ==='
select dimension, puntaje from puntajes_olbi
 where respuesta_id='bbbb4444-0000-0000-0000-000000000001' order by dimension;

-- Caso B: burnout mínimo, exactamente al revés.
insert into respuestas (id, participante_id, formulario_clave, formulario_version, iniciado_en)
  values ('bbbb5555-0000-0000-0000-000000000001','bbbb3333-0000-0000-0000-000000000001','olbi',1, now());
insert into respuestas_items (respuesta_id, item_clave, valor_num)
select 'bbbb5555-0000-0000-0000-000000000001',
       item->>'clave',
       case when (item->>'invertido')::boolean then 4 else 1 end
from formularios, jsonb_array_elements(definicion->'items') item
where clave='olbi' and version=1;

\echo '=== 4. Burnout mínimo: ambas deben dar 1.000 ==='
select dimension, puntaje from puntajes_olbi
 where respuesta_id='bbbb5555-0000-0000-0000-000000000001' order by dimension;

\echo '=== 5. Contra los umbrales provisionales (2.25 / 2.10) ==='
select 'maximo' as caso,
       bool_and(p.puntaje >= (f.definicion->'umbrales'->>p.dimension)::numeric) as detectaria
from puntajes_olbi p, formularios f
where p.respuesta_id='bbbb4444-0000-0000-0000-000000000001' and f.clave='olbi' and f.version=1
union all
select 'minimo',
       bool_and(p.puntaje >= (f.definicion->'umbrales'->>p.dimension)::numeric)
from puntajes_olbi p, formularios f
where p.respuesta_id='bbbb5555-0000-0000-0000-000000000001' and f.clave='olbi' and f.version=1;

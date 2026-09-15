-- Verifica la vista puntajes_olbi: media por dimensión e inversión de ítems.
insert into organizaciones (id, nombre) values ('aaaa1111-0000-0000-0000-000000000001','Test');
insert into auth.users (id) values ('aaaa2222-0000-0000-0000-000000000001');
insert into participantes (id, organizacion_id, auth_user_id, codigo_anonimo)
  values ('aaaa3333-0000-0000-0000-000000000001','aaaa1111-0000-0000-0000-000000000001',
          'aaaa2222-0000-0000-0000-000000000001','T-001');

-- Respuesta con todos los ítems en 3, versión 1 (ningún ítem invertido)
insert into respuestas (id, participante_id, formulario_clave, formulario_version, iniciado_en)
  values ('aaaa4444-0000-0000-0000-000000000001','aaaa3333-0000-0000-0000-000000000001','olbi',1, now());
insert into respuestas_items (respuesta_id, item_clave, valor_num)
  select 'aaaa4444-0000-0000-0000-000000000001', 'olbi_' || lpad(g::text, 2, '0'), 3
  from generate_series(1,16) g;

\echo '--- 1. Sin inversión: ambas dimensiones deben dar 3.000 ---'
select dimension, items_contados, puntaje from puntajes_olbi
 where respuesta_id='aaaa4444-0000-0000-0000-000000000001' order by dimension;

-- Versión 2 idéntica salvo que olbi_01 (agotamiento) queda invertido
insert into formularios (clave, version, definicion)
select 'olbi', 2, jsonb_set(
  definicion,
  '{items,0,invertido}',
  'true'::jsonb
) from formularios where clave='olbi' and version=1;

insert into respuestas (id, participante_id, formulario_clave, formulario_version, iniciado_en)
  values ('aaaa5555-0000-0000-0000-000000000001','aaaa3333-0000-0000-0000-000000000001','olbi',2, now());
insert into respuestas_items (respuesta_id, item_clave, valor_num)
  select 'aaaa5555-0000-0000-0000-000000000001', 'olbi_' || lpad(g::text, 2, '0'), 3
  from generate_series(1,16) g;

\echo '--- 2. olbi_01 invertido: agotamiento = (7*3 + (1+4-3))/8 = 2.875 ---'
select dimension, items_contados, puntaje from puntajes_olbi
 where respuesta_id='aaaa5555-0000-0000-0000-000000000001' order by dimension;

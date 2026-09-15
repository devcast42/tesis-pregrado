-- Verificación de SOLO LECTURA del instrumento cargado.
-- Segura contra el proyecto real: no inserta ni modifica nada.
--
--   npx supabase db query --linked --file supabase/tests/verificar_olbi.sql
--
-- La prueba completa (que además verifica la ORIENTACIÓN de la inversión
-- simulando respuestas) está en olbi_estructura.sql y SOLO debe correr contra
-- una base local: inserta datos de prueba.

select
  item->>'dimension'                                        as dimension,
  count(*)                                                  as items,
  count(*) filter (where (item->>'invertido')::boolean)     as invertidos,
  count(*) filter (where coalesce(item->>'texto','') = '')  as sin_texto,
  string_agg(
    replace(item->>'clave', 'olbi_', ''),
    ', ' order by item->>'clave'
  ) filter (where (item->>'invertido')::boolean)            as cuales_invertidos
from formularios, jsonb_array_elements(definicion->'items') item
where clave = 'olbi'
group by 1
order by 1;

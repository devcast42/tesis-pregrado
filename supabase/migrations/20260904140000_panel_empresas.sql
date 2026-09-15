-- Empresas con lo que las acompaña en el maestro — ESP-008.
--
-- La lista de empresas mostraba solo nombre y fecha. Una fila así no dice
-- nada: para saber si una empresa está realmente participando o quedó vacía
-- había que entrar a cada una. Los conteos van en la propia fila.
--
-- Se cuentan aquí y no en el cliente porque `participantes` y
-- `administradores` tienen RLS distinto y hacerlo a mano obligaría a tres
-- consultas que pueden desincronizarse entre sí.

create or replace view panel_empresas
with (security_invoker = on) as
select
  o.id,
  o.nombre,
  o.creado_en,
  (select count(*) from participantes p
    where p.organizacion_id = o.id)                    as participantes,
  (select count(*) from participantes p
    where p.organizacion_id = o.id and p.estado = 'activo') as en_seguimiento,
  (select count(*) from administradores a
    where a.organizacion_id = o.id and a.activo)       as administradores
from organizaciones o;

comment on view panel_empresas is
  'ESP-008. Fila del maestro de empresas, con sus conteos.';

grant select on panel_empresas to authenticated;

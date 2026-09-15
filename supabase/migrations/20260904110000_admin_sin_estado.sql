-- Cierra una fuga real encontrada al probar el panel del admin — ESP-008.
--
-- EL PROBLEMA: `participacion_empresa` colapsaba con cuidado el estado del
-- participante en un único booleano para que la ausencia no delatara una
-- detección... pero el admin tenía además permiso de lectura directa sobre
-- `participantes`, y ahí `estado` está tal cual. Un `select estado from
-- participantes` —o cualquier vista construida encima, como
-- `panel_participantes` o `resumen_estudio`— le devolvía 'detectado'.
--
-- LA LECCIÓN: no sirve de nada curar una vista si la tabla que hay debajo
-- sigue siendo legible. La vista curada tiene que ser el ÚNICO camino.
--
-- LA SOLUCIÓN: el admin pierde el acceso directo a las tablas y conserva solo
-- las dos vistas que se diseñaron para él, que pasan a ser SECURITY DEFINER y
-- llevan su propio filtro dentro. La vista deja de heredar los permisos de
-- quien consulta y se convierte en la frontera.

-- ---------------------------------------------------------------------------
-- 1. El admin ya no lee las tablas base
-- ---------------------------------------------------------------------------

drop policy if exists "admin ve participantes de su empresa" on participantes;
drop policy if exists "admin ve identidades de su empresa"   on identidades;
drop policy if exists "admin ve consentimientos de su empresa" on consentimientos;

-- ---------------------------------------------------------------------------
-- 2. Las vistas del admin se vuelven la frontera
-- ---------------------------------------------------------------------------

-- Quién puede mirar qué, en un solo lugar. El investigador ve todo el estudio;
-- el admin, solo su empresa; cualquier otro, nada.
create or replace function alcance_empresa(p_organizacion_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select es_investigador() or p_organizacion_id = empresa_del_admin()
$$;

comment on function alcance_empresa is
  'ESP-008. Filtro de las vistas de empresa. Al ser el único punto donde se
   decide el alcance, cambiarlo cambia todas las vistas a la vez.';

drop view if exists resumen_empresa;
drop view if exists participacion_empresa;

create view participacion_empresa
with (security_invoker = off) as
select
  p.id                    as participante_id,
  p.organizacion_id,
  p.codigo_anonimo,
  i.nombre,
  i.correo_contacto,
  p.inscrito_en,

  -- Decisión administrativa, no clínica.
  (select c.aceptado from consentimientos c
    where c.participante_id = p.id
    order by c.registrado_en desc limit 1)          as consentimiento,

  -- Un único booleano. Nunca el estado real: 'detectado', 'retirado' y
  -- 'finalizado' son indistinguibles desde aquí, y esa es toda la idea.
  (p.estado = 'activo')                             as en_seguimiento,

  -- Solo tiene sentido para quien sigue en seguimiento activo; para el resto
  -- se devuelve NULL, no un número creciente que invite a inferir.
  case when p.estado = 'activo' then (
    select (now() at time zone tz_estudio())::date
         - max((r.enviado_en at time zone tz_estudio())::date)
      from respuestas r
     where r.participante_id = p.id and r.formulario_clave = 'diario'
  ) end                                             as dias_sin_responder

from participantes p
left join identidades i on i.participante_id = p.id
where alcance_empresa(p.organizacion_id);

comment on view participacion_empresa is
  'ESP-008. Participación, nunca salud. SECURITY DEFINER a propósito: es el
   único camino del admin hacia estos datos, y por eso lleva su propio filtro.';

create view resumen_empresa
with (security_invoker = off) as
with base as (
  select
    o.id as organizacion_id,
    o.nombre,
    count(p.id)                                                  as inscritos,
    count(*) filter (where p.estado = 'activo')                  as en_seguimiento,
    count(*) filter (where pe.consentimiento is true)            as consintieron,
    count(*) filter (where pe.dias_sin_responder <= 1)           as respondieron_ayer,
    count(*) filter (where pe.dias_sin_responder >= 4)           as sin_responder_4d
  from organizaciones o
  left join participantes p on p.organizacion_id = o.id
  left join participacion_empresa pe on pe.participante_id = p.id
  where alcance_empresa(o.id)
  group by o.id, o.nombre
)
select
  organizacion_id,
  nombre,
  inscritos,
  en_seguimiento,
  consintieron,
  -- Bajo el mínimo, cualquier proporción es reidentificable.
  case when inscritos >= minimo_para_reportar() then respondieron_ayer end as respondieron_ayer,
  case when inscritos >= minimo_para_reportar() then sin_responder_4d  end as sin_responder_4d,
  (inscritos >= minimo_para_reportar())                                    as reportable
from base;

comment on view resumen_empresa is
  'ESP-008. Cifras agregadas por empresa. Bajo el mínimo devuelve NULL en las
   proporciones y marca reportable = false.';

grant select on participacion_empresa to authenticated;
grant select on resumen_empresa        to authenticated;

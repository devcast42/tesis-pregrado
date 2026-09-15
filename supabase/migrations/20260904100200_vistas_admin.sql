-- Lo que ve el admin — implementa ESP-008.
--
-- ⚠️ EL RIESGO SUTIL: si un participante detectado desapareciera de la lista,
-- o si su estado se mostrara tal cual, la propia ausencia revelaría la
-- detección. Por eso `detectado`, `retirado` y `finalizado` se colapsan en un
-- único "fuera de seguimiento", sin motivo. El admin ve que alguien ya no
-- responde a diario, pero no puede distinguir si fue detectado, si retiró su
-- consentimiento o si terminó el estudio.

create or replace view participacion_empresa
with (security_invoker = on) as
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

  -- Un único booleano. Nunca el estado real.
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
left join identidades i on i.participante_id = p.id;

comment on view participacion_empresa is
  'ESP-008. Participación, nunca salud. El estado real del participante no se expone.';

-- ---------------------------------------------------------------------------
-- Agregado por empresa, con mínimo de reporte
-- ---------------------------------------------------------------------------

create or replace function minimo_para_reportar() returns int
language sql immutable as $$ select 10 $$;

comment on function minimo_para_reportar is
  'ESP-008. Bajo este número no se reporta ninguna cifra agregada: en un grupo
   pequeño, un porcentaje señala personas concretas.';

create or replace view resumen_empresa
with (security_invoker = on) as
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

-- ESP-009 RF-009-01 — las citas sin confirmar no llegaban a la bandeja.
--
-- Mismo caso que `panel_participantes_v2` (20260930120000): la vista es
-- `security_invoker`, su CTE `cita_sin_confirmar` leía `citas` con los
-- permisos del investigador, y `citas` no tiene política de RLS para él.
-- Devolvía cero filas siempre, así que el grupo «citas sin confirmar» nunca
-- aparecía en Hoy y el contador del sidebar contaba de menos. NEX-022 lleva
-- dieciocho días esperando que le confirmen la cita y la bandeja no lo decía.
--
-- Se lee de `citas_estudio`, que es la puerta del investigador (sin `motivo`,
-- que ESP-009 §9.4 decidió no enseñarle) y ya trae el código y la empresa,
-- así que el join con `participantes` deja de hacer falta.

create or replace view bandeja_investigador
with (security_invoker = on) as
with hoy as (select (now() at time zone tz_estudio())::date as dia),
inactivos as (
  select 'inactivo' as tipo, a.participante_id, p.codigo_anonimo, p.organizacion_id,
         a.participante_id as referencia_id, a.ultimo_checkin::timestamptz as desde, a.dias_sin_checkin as dias
  from adherencia a join participantes p on p.id = a.participante_id
  where p.estado = 'activo' and a.dias_sin_checkin >= 4
),
sin_viernes as (
  -- Semana cerrada (viernes + gracia vencida) sin OLBI: la última que falta.
  select 'sin_viernes' as tipo, p.id as participante_id, p.codigo_anonimo, p.organizacion_id,
         p.id as referencia_id, (v.viernes)::timestamptz as desde, (hoy.dia - v.viernes)::int as dias
  from participantes p, hoy,
  lateral (
    select max(d::date) as viernes
    from generate_series(p.inscrito_en::date, hoy.dia - 3, interval '1 day') d
    where extract(isodow from d) = 5
      and not exists (select 1 from olbi_semanal_etiquetado o
                      where o.participante_id = p.id and o.semana = date_trunc('week', d::date)::date)
  ) v
  where p.estado = 'activo' and v.viernes is not null
),
det_sin_deriv as (
  select 'deteccion_sin_derivacion' as tipo, e.participante_id, p.codigo_anonimo, p.organizacion_id,
         e.participante_id as referencia_id, e.ocurrido_en as desde,
         (hoy.dia - (e.ocurrido_en at time zone tz_estudio())::date)::int as dias
  from eventos e join participantes p on p.id = e.participante_id, hoy
  where e.tipo = 'deteccion'
    and not exists (select 1 from derivaciones d where d.participante_id = e.participante_id and d.abierta_en >= e.ocurrido_en - interval '1 minute')
),
deriv_sin_sesion as (
  select 'derivacion_sin_sesion' as tipo, c.participante_id, c.codigo_anonimo, c.organizacion_id,
         c.derivacion_id as referencia_id, c.derivado_en as desde,
         (hoy.dia - (c.derivado_en at time zone tz_estudio())::date)::int as dias
  from circuito_apoyo c, hoy
  where c.estado = 'sin_sesion' and c.cerrada_en is null
    and c.derivado_en < now() - interval '7 days'
),
cita_sin_confirmar as (
  select 'cita_sin_confirmar' as tipo, ci.participante_id, ci.codigo_anonimo, ci.organizacion_id,
         ci.id as referencia_id, ci.creada_en as desde,
         (hoy.dia - (ci.creada_en at time zone tz_estudio())::date)::int as dias
  from citas_estudio ci, hoy
  where ci.estado = 'solicitada' and ci.creada_en < now() - interval '2 days'
),
informe_pend as (
  select 'informe_pendiente' as tipo, c.participante_id, c.codigo_anonimo, c.organizacion_id,
         c.derivacion_id as referencia_id, c.primera_sesion_en as desde,
         (hoy.dia - (c.primera_sesion_en at time zone tz_estudio())::date)::int as dias
  from circuito_apoyo c, hoy
  where c.estado in ('informe_pendiente', 'sesion_realizada') and c.informe_aprobado_en is null
    and c.primera_sesion_en < now() - interval '7 days'
),
consent_pend as (
  select 'consentimiento_pendiente' as tipo, p.id as participante_id, p.codigo_anonimo, p.organizacion_id,
         p.id as referencia_id, p.inscrito_en as desde,
         (hoy.dia - (p.inscrito_en at time zone tz_estudio())::date)::int as dias
  from participantes p, hoy
  where p.estado = 'activo' and p.inscrito_en < now() - interval '7 days'
    and not exists (select 1 from consentimientos c where c.participante_id = p.id)
)
select b.*, o.nombre as empresa
from (
  select * from inactivos union all select * from sin_viernes union all select * from det_sin_deriv
  union all select * from deriv_sin_sesion union all select * from cita_sin_confirmar
  union all select * from informe_pend union all select * from consent_pend
) b
left join organizaciones o on o.id = b.organizacion_id
where es_investigador();

comment on view bandeja_investigador is
  'ESP-009 RF-009-01. Pendientes de operación del estudio, una fila por caso. Solo para el investigador.';

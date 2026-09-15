-- Monitoreo de adherencia — implementa ESP-007.
--
-- El muestreo es censal: cada participante que deja de responder es un hueco
-- irrecuperable en la serie temporal. Un hueco detectado hoy se recupera con
-- una llamada; detectado al cerrar el estudio, no se recupera nunca.
--
-- El cálculo vive aquí y no en la app (RN-007-05): panel, Jupyter y Supabase
-- Studio deben obtener el mismo número. Duplicar la fórmula crearía dos verdades.

-- Zona horaria del estudio (Trujillo, Perú). Define qué cuenta como "el mismo
-- día": con UTC, un check-in a las 20:00 hora local caería al día siguiente.
create or replace function tz_estudio() returns text
language sql immutable as $$ select 'America/Lima' $$;

-- Cortes de estado (ESP-007 §4). Ajustar aquí los cambia en todo el sistema.
create or replace function corte_en_riesgo() returns int
language sql immutable as $$ select 2 $$;

create or replace function corte_inactivo() returns int
language sql immutable as $$ select 4 $$;

-- ---------------------------------------------------------------------------
-- Vista principal: una fila por participante activo
-- ---------------------------------------------------------------------------

create or replace view adherencia
with (security_invoker = on) as
with inicio as (
  select
    p.id                as participante_id,
    p.organizacion_id,
    p.codigo_anonimo,
    -- El seguimiento arranca con el evento explícito; si no existe, con la
    -- inscripción. Así la vista funciona desde el primer día del estudio.
    coalesce(
      (select min(e.ocurrido_en)
         from eventos e
        where e.participante_id = p.id
          and e.tipo = 'inicio_seguimiento'),
      p.inscrito_en
    ) at time zone tz_estudio() as inicio_ts
  from participantes p
  -- RN-007-04: los detectados salieron del seguimiento por diseño, no por
  -- incumplimiento. Contarlos como inactivos falsearía la adherencia.
  where p.estado = 'activo'
),
-- RN-007-01: se cuentan días cumplidos, no respuestas. Dos check-ins el mismo
-- día no compensan un día perdido.
dias_cumplidos as (
  select distinct
    r.participante_id,
    (r.enviado_en at time zone tz_estudio())::date as dia
  from respuestas r
  where r.formulario_clave = 'diario'
),
base as (
  select
    i.participante_id,
    i.organizacion_id,
    i.codigo_anonimo,
    i.inicio_ts::date as inicio_seguimiento,

    (select max(d.dia) from dias_cumplidos d
      where d.participante_id = i.participante_id) as ultimo_checkin,

    -- RN-007-02: el día en curso no cuenta como incumplido; el participante
    -- todavía puede responder. Por eso el conteo excluye hoy.
    (select count(*) from dias_cumplidos d
      where d.participante_id = i.participante_id
        and d.dia < (now() at time zone tz_estudio())::date) as cumplidos,

    greatest(
      0,
      (now() at time zone tz_estudio())::date - i.inicio_ts::date
    ) as esperados
  from inicio i
)
select
  participante_id,
  organizacion_id,
  codigo_anonimo,
  inicio_seguimiento,
  ultimo_checkin,
  esperados as dias_esperados,
  cumplidos as dias_cumplidos,

  case when esperados = 0 then null
       else round(cumplidos::numeric / esperados, 3)
  end as tasa_adherencia,

  case when ultimo_checkin is null then esperados
       else (now() at time zone tz_estudio())::date - ultimo_checkin
  end as dias_sin_checkin,

  case
    -- Inscrito hoy y aún sin responder: no es incumplimiento (CA-007-03).
    when ultimo_checkin is null and esperados = 0 then 'al_dia'
    when ultimo_checkin is null                   then 'nunca_inicio'
    when (now() at time zone tz_estudio())::date - ultimo_checkin
         < corte_en_riesgo()                      then 'al_dia'
    when (now() at time zone tz_estudio())::date - ultimo_checkin
         < corte_inactivo()                       then 'en_riesgo'
    else 'inactivo'
  end as estado_adherencia
from base;

comment on view adherencia is
  'ESP-007. Una fila por participante activo. Fuente única del cálculo de adherencia.';

-- ---------------------------------------------------------------------------
-- RF-007-03: agregado por organización
-- ---------------------------------------------------------------------------

create or replace view adherencia_por_organizacion
with (security_invoker = on) as
select
  o.id   as organizacion_id,
  o.nombre,
  count(*)                                                    as participantes_activos,
  count(*) filter (where a.estado_adherencia = 'al_dia')       as al_dia,
  count(*) filter (where a.estado_adherencia = 'en_riesgo')    as en_riesgo,
  count(*) filter (where a.estado_adherencia = 'inactivo')     as inactivos,
  count(*) filter (where a.estado_adherencia = 'nunca_inicio') as nunca_iniciaron,
  round(avg(a.tasa_adherencia), 3)                            as tasa_promedio
from organizaciones o
join adherencia a on a.organizacion_id = o.id
group by o.id, o.nombre;

-- ---------------------------------------------------------------------------
-- RF-007-04 y RF-007-05: alertas, una por episodio
-- ---------------------------------------------------------------------------

-- Un "episodio" abierto es una alerta posterior al último check-in. Cuando el
-- participante vuelve a responder, el episodio se cierra solo y una recaída
-- futura vuelve a alertar (RN-007-03). Sin esto, cada ejecución generaría una
-- fila diaria por participante inactivo y las alertas nuevas se perderían
-- entre el ruido.
create or replace function registrar_alertas_adherencia()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  insertadas int;
begin
  with candidatos as (
    select a.participante_id, a.estado_adherencia, a.dias_sin_checkin, a.ultimo_checkin,
           a.inicio_seguimiento
    from adherencia a
    where a.estado_adherencia in ('en_riesgo', 'inactivo', 'nunca_inicio')
  ),
  sin_episodio_abierto as (
    select c.*
    from candidatos c
    where not exists (
      select 1
      from eventos e
      where e.participante_id = c.participante_id
        and e.tipo = 'alerta_adherencia'
        and (e.ocurrido_en at time zone tz_estudio())::date
            > coalesce(c.ultimo_checkin, c.inicio_seguimiento)
    )
  ),
  nuevas as (
    insert into eventos (participante_id, tipo, metadata)
    select
      s.participante_id,
      'alerta_adherencia',
      jsonb_build_object(
        'estado', s.estado_adherencia,
        'dias_sin_checkin', s.dias_sin_checkin
      )
    from sin_episodio_abierto s
    returning 1
  )
  select count(*) into insertadas from nuevas;

  return insertadas;
end;
$$;

comment on function registrar_alertas_adherencia is
  'ESP-007 RF-007-04. Ejecutar a diario. Idempotente dentro de un mismo episodio.';

-- Las vistas usan security_invoker: heredan las políticas RLS de las tablas
-- base. Hasta que ESP-006 defina el rol investigador, solo la service_role
-- puede leerlas — que es el valor por defecto seguro.

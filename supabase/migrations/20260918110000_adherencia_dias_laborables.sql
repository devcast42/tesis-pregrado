-- Adherencia · revisión 2 — implementa ESP-007 §4 con el calendario semanal
-- de ESP-002 rev. 2 (docs/diseno-semanal-con-preentrenamiento.md).
--
-- Qué cambia:
--
--   · Solo cuentan los días LABORABLES (lunes a viernes). Con el calendario
--     nuevo nadie responde el fin de semana; contarlo hundiría la tasa de
--     todos dos séptimos cada semana sin que nadie haya fallado.
--   · Lunes a jueves cumple el `diario`; el viernes cumple el `olbi`. Un OLBI
--     enviado sábado o domingo (gracia de 2 días) se acredita al viernes.
--   · `dias_sin_checkin` cuenta días laborables desde el último formulario
--     del calendario, incluyendo hoy si aún no se respondió.
--   · Columnas nuevas al final: `viernes_esperados` y `viernes_cumplidos`
--     (RF-007-07, RN-007-06). Un viernes perdido es una semana sin etiqueta
--     para el modelo; se vigila aparte. Un viernes se considera esperado solo
--     cuando su gracia venció (hoy > viernes + 2).
--
-- Las columnas existentes conservan nombre, tipo y orden: las vistas que
-- dependen de esta (indicadores, resumen_estudio) siguen funcionando.

-- Días laborables en el intervalo [desde, hasta). Inmutable, sin tablas.
create or replace function dias_laborables(desde date, hasta date) returns int
language sql immutable as $$
  select coalesce(count(*), 0)::int
  from generate_series(desde, hasta - 1, interval '1 day') d
  where extract(isodow from d) < 6
    and desde < hasta
$$;

create or replace view adherencia
with (security_invoker = on) as
with hoy as (
  select (now() at time zone tz_estudio())::date as dia
),
inicio as (
  select
    p.id                as participante_id,
    p.organizacion_id,
    p.codigo_anonimo,
    coalesce(
      (select min(e.ocurrido_en)
         from eventos e
        where e.participante_id = p.id
          and e.tipo = 'inicio_seguimiento'),
      p.inscrito_en
    ) at time zone tz_estudio() as inicio_ts
  from participantes p
  where p.estado = 'activo'
),
-- RN-007-01: días cumplidos, no respuestas. El día que acredita cada envío:
-- el propio para el diario; para el OLBI, el viernes de su semana si llegó
-- en la gracia (sábado = viernes + 1, domingo = viernes + 2).
envios as (
  select
    r.participante_id,
    r.formulario_clave,
    (r.enviado_en at time zone tz_estudio())::date as dia_envio
  from respuestas r
  where r.formulario_clave in ('diario', 'olbi')
),
dias_cumplidos as (
  select distinct
    participante_id,
    case
      when formulario_clave = 'olbi' and extract(isodow from dia_envio) in (6, 7)
        then dia_envio - (extract(isodow from dia_envio)::int - 5)
      else dia_envio
    end as dia
  from envios
),
base as (
  select
    i.participante_id,
    i.organizacion_id,
    i.codigo_anonimo,
    i.inicio_ts::date as inicio_seguimiento,

    (select max(d.dia) from dias_cumplidos d
      where d.participante_id = i.participante_id) as ultimo_checkin,

    -- RN-007-02: hoy no cuenta como incumplido. Solo días laborables.
    (select count(*) from dias_cumplidos d, hoy
      where d.participante_id = i.participante_id
        and d.dia < hoy.dia
        and d.dia >= i.inicio_ts::date
        and extract(isodow from d.dia) < 6) as cumplidos,

    (select dias_laborables(i.inicio_ts::date, hoy.dia) from hoy) as esperados,

    -- Viernes cuya gracia ya venció: viernes <= hoy - 3.
    (select count(*) from hoy, generate_series(i.inicio_ts::date, hoy.dia - 3, interval '1 day') v
      where extract(isodow from v) = 5) as viernes_esperados,

    (select count(*) from dias_cumplidos d, hoy
      where d.participante_id = i.participante_id
        and extract(isodow from d.dia) = 5
        and d.dia >= i.inicio_ts::date
        and d.dia <= hoy.dia - 3) as viernes_cumplidos
  from inicio i
)
select
  b.participante_id,
  b.organizacion_id,
  b.codigo_anonimo,
  b.inicio_seguimiento,
  b.ultimo_checkin,
  b.esperados as dias_esperados,
  b.cumplidos as dias_cumplidos,

  case when b.esperados = 0 then null
       else round(least(b.cumplidos, b.esperados)::numeric / b.esperados, 3)
  end as tasa_adherencia,

  -- Laborables en (ultimo_checkin, hoy]. Sin ningún envío: todos los esperados.
  case when b.ultimo_checkin is null then b.esperados
       else dias_laborables(b.ultimo_checkin + 1, hoy.dia + 1)
  end as dias_sin_checkin,

  case
    when b.ultimo_checkin is null and b.esperados = 0 then 'al_dia'
    when b.ultimo_checkin is null                     then 'nunca_inicio'
    when dias_laborables(b.ultimo_checkin + 1, hoy.dia + 1) < corte_en_riesgo() then 'al_dia'
    when dias_laborables(b.ultimo_checkin + 1, hoy.dia + 1) < corte_inactivo()  then 'en_riesgo'
    else 'inactivo'
  end as estado_adherencia,

  b.viernes_esperados,
  b.viernes_cumplidos
from base b, hoy;

comment on view adherencia is
  'ESP-007 rev. 2. Una fila por participante activo, sobre días laborables. Fuente única del cálculo de adherencia.';

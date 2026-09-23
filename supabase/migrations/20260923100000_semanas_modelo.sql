-- Contrato de datos del modelo (ESP-005 §8): una fila por (participante, semana).
--
-- Es la única definición de cada variable. El entrenamiento (modelo/entrenar.py)
-- y la operación (rasgos_semana, probabilidad_semana) leen de aquí o replican
-- esta aritmética; CA-005-05 comprueba que coinciden.
--
-- Qué entra en cada tarea (ESP-005 §3.2 y §3.3) — la vista expone todas las
-- columnas y cada tarea elige las suyas:
--
--   NOWCAST     entradas: t_* / e_media / d_media / n_dias (lun-jue de la
--               semana t) + contexto diario, semanal y estable de t.
--               etiqueta: `alto_t` (OLBI del viernes de t).
--               PROHIBIDO usar e_previo/d_previo: son el OLBI de t, o sea la
--               etiqueta misma (CA-005-02).
--
--   PRONÓSTICO  entradas: las mismas + e_previo/d_previo (OLBI del viernes de
--               t, ya conocido). etiqueta: `alto_t1` (OLBI del viernes de t+1).
--
-- Ninguna columna se calcula con datos posteriores al viernes de la semana t
-- (CA-005-01): el diario se recorta a lunes-jueves, el semanal es el del
-- viernes de t y `estable` no cambia en el tiempo.
--
-- Censura (ESP-005 §3.5): quien cruza el umbral sale del seguimiento, así que
-- cada persona aporta semanas hasta su primer cruce inclusive (CA-005-04).

create or replace view semanas_modelo
with (security_invoker = on) as

-- Una fila por respuesta `diario` con sus ítems desplegados.
with diario_respuesta as (
  select
    r.id,
    r.participante_id,
    r.enviado_en,
    (r.enviado_en at time zone tz_estudio())::date                    as dia,
    max(i.valor_num) filter (where i.item_clave = 'od_04')            as od_04,
    max(i.valor_num) filter (where i.item_clave = 'od_12')            as od_12,
    max(i.valor_num) filter (where i.item_clave = 'od_03')            as od_03,
    max(i.valor_num) filter (where i.item_clave = 'od_06')            as od_06,
    max(i.valor_num) filter (where i.item_clave = 'horas_trabajadas') as horas_trabajadas,
    max(i.valor_num) filter (where i.item_clave = 'horas_sueno')      as horas_sueno,
    max(i.valor_num) filter (where i.item_clave = 'horas_fin_de_semana') as horas_fin_de_semana
  from respuestas r
  join respuestas_items i on i.respuesta_id = r.id
  where r.formulario_clave = 'diario'
  group by r.id, r.participante_id, r.enviado_en
),

-- Un valor por día: el último envío de ese día (RN-002-01, se agregan filas y
-- vale la última). Solo lunes a jueves: el viernes es del OLBI (ESP-002 rev. 2).
dia_habil as (
  select distinct on (participante_id, dia)
    participante_id,
    dia,
    semana_de(enviado_en)                                             as semana,
    (od_04 + od_12 + od_03 + od_06) / 4.0                             as t_dia,
    (od_04 + od_12) / 2.0                                             as e_dia,
    (od_03 + od_06) / 2.0                                             as d_dia,
    horas_trabajadas,
    horas_sueno,
    horas_fin_de_semana
  from diario_respuesta
  where od_04 is not null and od_12 is not null
    and od_03 is not null and od_06 is not null
    and extract(isodow from dia)::int between 1 and 4
  order by participante_id, dia, enviado_en desc
),

-- El índice del día dentro de la semana es 0, 1, 2… en orden de respuesta, no
-- el día natural: así la pendiente coincide con `rasgos_semana` y con
-- `rasgos()` de modelo/preentrenar.py aunque falten días (CA-005-05).
dia_indexado as (
  select *, (row_number() over (partition by participante_id, semana order by dia) - 1)::numeric as idx
  from dia_habil
),

-- ESP-005 §4.1 (compartidos con el estudio de referencia) y §4.2 (diario).
rasgos as (
  select
    participante_id,
    semana,
    count(*)                                                          as n_dias,
    avg(t_dia)                                                        as t_media,
    (array_agg(t_dia order by dia desc))[1]                           as t_ultimo,
    max(t_dia)                                                        as t_max,
    -- Con un solo día no hay pendiente: 0, igual que en Python (`if n >= 2`).
    coalesce(regr_slope(t_dia, idx), 0)                               as t_pendiente,
    avg(e_dia)                                                        as e_media,
    avg(d_dia)                                                        as d_media,
    avg(horas_trabajadas)                                             as horas_media,
    max(horas_trabajadas)                                             as horas_max,
    avg(horas_sueno)                                                  as sueno_media,
    min(horas_sueno)                                                  as sueno_min,
    max(horas_fin_de_semana)                                          as horas_fin_de_semana
  from dia_indexado
  group by participante_id, semana
),

-- Cuestionario semanal del viernes de la semana t (ESP-005 §4.2).
semanal as (
  select distinct on (r.participante_id, semana_de(r.enviado_en))
    r.participante_id,
    semana_de(r.enviado_en)                                           as semana,
    max(i.valor_num) filter (where i.item_clave = 'horas_sobretiempo') as horas_sobretiempo,
    max(i.valor_num) filter (where i.item_clave = 'guardias')          as guardias,
    max(i.valor_num) filter (where i.item_clave = 'apoyo_lider')       as apoyo_lider
  from respuestas r
  join respuestas_items i on i.respuesta_id = r.id
  where r.formulario_clave = 'semanal'
  group by r.participante_id, r.enviado_en
  order by r.participante_id, semana_de(r.enviado_en), r.enviado_en desc
),

-- Ficha estable: no cambia en el tiempo, no puede filtrar futuro.
estable as (
  select
    r.participante_id,
    max(i.valor_num)   filter (where i.item_clave = 'edad')               as edad,
    max(i.valor_num)   filter (where i.item_clave = 'antiguedad_empresa') as antiguedad_empresa,
    max(i.valor_num)   filter (where i.item_clave = 'antiguedad_sector')  as antiguedad_sector,
    max(i.valor_num)   filter (where i.item_clave = 'tamano_equipo')      as tamano_equipo,
    max(i.valor_num)   filter (where i.item_clave = 'personas_a_cargo')   as personas_a_cargo,
    max(i.valor_num)   filter (where i.item_clave = 'minutos_traslado')   as minutos_traslado,
    max(i.valor_texto) filter (where i.item_clave = 'rol')                as rol,
    max(i.valor_texto) filter (where i.item_clave = 'modalidad')          as modalidad
  from respuestas r
  join respuestas_items i on i.respuesta_id = r.id
  where r.formulario_clave = 'estable'
  group by r.participante_id
),

-- Etiquetas: el OLBI del viernes, ya puntuado y comparado con el umbral
-- vigente por `olbi_semanal_etiquetado` (ESP-003).
etiqueta as (
  select participante_id, semana, agotamiento, desvinculacion, alto
  from olbi_semanal_etiquetado
),

-- Primera semana por encima del umbral: la última que aporta la persona.
corte as (
  select participante_id, min(semana) filter (where alto) as primera_alta
  from etiqueta
  group by participante_id
),

-- El universo de filas: toda semana con señal diaria o con OLBI.
base as (
  select participante_id, semana from rasgos
  union
  select participante_id, semana from etiqueta
)

select
  b.participante_id,
  b.semana,

  -- ESP-005 §4.1 — se calculan igual aquí, en `rasgos_semana` y en Python.
  coalesce(r.n_dias, 0)                                               as n_dias,
  r.t_media,
  r.t_ultimo,
  r.t_max,
  r.t_pendiente,
  r.e_media,
  r.d_media,

  -- §4.2 diario
  r.horas_media,
  r.horas_max,
  r.sueno_media,
  r.sueno_min,
  r.horas_fin_de_semana,

  -- §4.2 semanal (viernes de t)
  s.horas_sobretiempo,
  s.guardias,
  s.apoyo_lider,

  -- §4.2 estable
  e.edad,
  e.antiguedad_empresa,
  e.antiguedad_sector,
  e.tamano_equipo,
  e.personas_a_cargo,
  e.minutos_traslado,
  (e.rol = 'desarrollo')::int                                         as rol_desarrollo,
  (e.rol = 'qa')::int                                                 as rol_qa,
  (e.rol = 'datos')::int                                              as rol_datos,
  (e.rol = 'infraestructura')::int                                    as rol_infraestructura,
  (e.rol = 'soporte')::int                                            as rol_soporte,
  (e.rol = 'diseno')::int                                             as rol_diseno,
  (e.rol = 'gestion')::int                                            as rol_gestion,
  (e.rol = 'otro')::int                                               as rol_otro,
  (e.modalidad = 'remoto')::int                                       as modalidad_remoto,
  (e.modalidad = 'hibrido')::int                                      as modalidad_hibrido,
  (e.modalidad = 'presencial')::int                                   as modalidad_presencial,

  -- §4.2 solo pronóstico: el OLBI de t, que en esa tarea ya es pasado.
  et.agotamiento                                                      as e_previo,
  et.desvinculacion                                                   as d_previo,

  -- Etiquetas
  et.alto                                                             as alto_t,
  -- En la semana del cruce la persona sale del seguimiento (RN-007-04): no
  -- hay una t+1 que observar, aunque el OLBI exista en la base por haberse
  -- respondido antes de la baja. Sin este `null`, el pronóstico se entrenaría
  -- con filas que en operación nunca se habrían producido.
  case
    when c.primera_alta is not null and b.semana >= c.primera_alta then null
    else et1.alto
  end                                                                 as alto_t1,

  -- Para auditar la censura sin recalcularla
  (c.primera_alta is not null and b.semana = c.primera_alta)          as es_primer_cruce

from base b
left join rasgos   r   on r.participante_id  = b.participante_id and r.semana  = b.semana
left join semanal  s   on s.participante_id  = b.participante_id and s.semana  = b.semana
left join estable  e   on e.participante_id  = b.participante_id
left join etiqueta et  on et.participante_id = b.participante_id and et.semana = b.semana
left join etiqueta et1 on et1.participante_id = b.participante_id and et1.semana = b.semana + 7
left join corte    c   on c.participante_id  = b.participante_id
-- Censura: nada después del primer cruce (ESP-005 §3.5, CA-005-04).
where c.primera_alta is null or b.semana <= c.primera_alta;

comment on view semanas_modelo is
  'ESP-005 §8. Una fila por (participante, semana ISO) con los rasgos de §4 y ambas etiquetas. '
  'Nowcast usa alto_t y NO puede usar e_previo/d_previo; pronóstico usa alto_t1 y sí puede. '
  'Censurada en el primer cruce del umbral.';

-- ESP-005 §4.2 — bloque de recuperación del check-in diario v3.
--
-- Añade dos rasgos por semana, promediados sobre los días respondidos:
--
--   desconexion_media       qué tanto logró desconectar al terminar de
--                           trabajar (1-5). Mide recuperación, que es lo que
--                           faltaba: hasta ahora el bloque objetivo solo medía
--                           cuánto se trabajó.
--   contacto_fuera_horario  proporción de días (0-1) en que la contactaron
--                           fuera de horario. Hecho verificable.
--
-- Ambos vienen del formulario `diario`, que se responde de lunes a jueves, así
-- que están disponibles para el nowcast (a diferencia del semanal, que es del
-- viernes). Quedan nulos para las respuestas de v1 y v2, que no los
-- preguntaban; `entrenar.py` los imputa con la mediana.

-- Se recrea en vez de reemplazarse: las columnas nuevas van en medio y
-- `create or replace view` solo admite añadirlas al final.
drop view if exists semanas_modelo;

create view semanas_modelo
with (security_invoker = on) as

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
    max(i.valor_num) filter (where i.item_clave = 'horas_fin_de_semana') as horas_fin_de_semana,
    max(i.valor_num) filter (where i.item_clave = 'desconexion')          as desconexion,
    max(i.valor_num) filter (where i.item_clave = 'contacto_fuera_horario') as contacto_fuera_horario
  from respuestas r
  join respuestas_items i on i.respuesta_id = r.id
  where r.formulario_clave = 'diario'
  group by r.id, r.participante_id, r.enviado_en
),

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
    horas_fin_de_semana,
    desconexion,
    contacto_fuera_horario
  from diario_respuesta
  where od_04 is not null and od_12 is not null
    and od_03 is not null and od_06 is not null
    and extract(isodow from dia)::int between 1 and 4
  order by participante_id, dia, enviado_en desc
),

dia_indexado as (
  select *, (row_number() over (partition by participante_id, semana order by dia) - 1)::numeric as idx
  from dia_habil
),

rasgos as (
  select
    participante_id,
    semana,
    count(*)                                                          as n_dias,
    avg(t_dia)                                                        as t_media,
    (array_agg(t_dia order by dia desc))[1]                           as t_ultimo,
    max(t_dia)                                                        as t_max,
    coalesce(regr_slope(t_dia, idx), 0)                               as t_pendiente,
    avg(e_dia)                                                        as e_media,
    avg(d_dia)                                                        as d_media,
    avg(horas_trabajadas)                                             as horas_media,
    max(horas_trabajadas)                                             as horas_max,
    avg(horas_sueno)                                                  as sueno_media,
    min(horas_sueno)                                                  as sueno_min,
    max(horas_fin_de_semana)                                          as horas_fin_de_semana,
    avg(desconexion)                                                  as desconexion_media,
    avg(contacto_fuera_horario)                                       as contacto_fuera_horario
  from dia_indexado
  group by participante_id, semana
),

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

etiqueta as (
  select participante_id, semana, agotamiento, desvinculacion, alto
  from olbi_semanal_etiquetado
),

corte as (
  select participante_id, min(semana) filter (where alto) as primera_alta
  from etiqueta
  group by participante_id
),

base as (
  select participante_id, semana from rasgos
  union
  select participante_id, semana from etiqueta
)

select
  b.participante_id,
  b.semana,

  coalesce(r.n_dias, 0)                                               as n_dias,
  r.t_media,
  r.t_ultimo,
  r.t_max,
  r.t_pendiente,
  r.e_media,
  r.d_media,

  r.horas_media,
  r.horas_max,
  r.sueno_media,
  r.sueno_min,
  r.horas_fin_de_semana,
  r.desconexion_media,
  r.contacto_fuera_horario,

  -- Semanal de t: se responde el viernes. Solo para pronóstico.
  s.horas_sobretiempo,
  s.guardias,
  s.apoyo_lider,

  -- Semanal de t-1: disponible desde el lunes de t, sirve para nowcast.
  sp.horas_sobretiempo                                                as sobretiempo_previo,
  sp.guardias                                                         as guardia_previa,
  sp.apoyo_lider                                                      as apoyo_previo,

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

  et.agotamiento                                                      as e_previo,
  et.desvinculacion                                                   as d_previo,

  et.alto                                                             as alto_t,
  case
    when c.primera_alta is not null and b.semana >= c.primera_alta then null
    else et1.alto
  end                                                                 as alto_t1,

  (c.primera_alta is not null and b.semana = c.primera_alta)          as es_primer_cruce

from base b
left join rasgos   r   on r.participante_id  = b.participante_id and r.semana  = b.semana
left join semanal  s   on s.participante_id  = b.participante_id and s.semana  = b.semana
left join semanal  sp  on sp.participante_id = b.participante_id and sp.semana = b.semana - 7
left join estable  e   on e.participante_id  = b.participante_id
left join etiqueta et  on et.participante_id = b.participante_id and et.semana = b.semana
left join etiqueta et1 on et1.participante_id = b.participante_id and et1.semana = b.semana + 7
left join corte    c   on c.participante_id  = b.participante_id
where c.primera_alta is null or b.semana <= c.primera_alta;

comment on view semanas_modelo is
  'ESP-005 §8. Una fila por (participante, semana ISO) con los rasgos de §4 y ambas etiquetas. '
  'Nowcast usa alto_t y NO puede usar e_previo/d_previo ni el semanal de t (se responde el viernes); '
  'sí puede usar *_previo (semanal de t-1) y el bloque de recuperación del diario. '
  'Pronóstico usa alto_t1 y puede usarlo todo. '
  'Censurada en el primer cruce del umbral.';

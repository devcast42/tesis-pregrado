-- Datos iniciales actualizables — implementa ESP-002 RF-002-16.
--
-- `ventanas_modelo` agregaba el formulario `estable` con max() sobre todas
-- las respuestas del participante. Con una sola respuesta daba igual; ahora
-- que puede actualizarlas desde Perfil, se toma solo la última (igual que
-- ya hacía perfil_caso). Mismas columnas: solo cambia la CTE estable_items.

create or replace view ventanas_modelo
with (security_invoker = on) as
with mediciones_olbi as (
  select
    r.id                                                              as medicion_id,
    r.participante_id,
    r.enviado_en                                                      as t,
    row_number() over (partition by r.participante_id order by r.enviado_en) as num_medicion
  from respuestas r
  where r.formulario_clave = 'olbi'
),

primer_cruce as (
  select participante_id, min(ocurrido_en) as ocurrido_en
  from eventos
  where tipo = 'deteccion'
  group by participante_id
),

mediciones_vigentes as (
  select m.*
  from mediciones_olbi m
  left join primer_cruce c on c.participante_id = m.participante_id
  where c.ocurrido_en is null or m.t <= c.ocurrido_en
),

etiqueta as (
  select
    m.medicion_id,
    exists (
      select 1 from eventos e
      where e.tipo = 'deteccion'
        and e.participante_id = m.participante_id
        and (e.metadata->>'respuesta_id')::uuid = m.medicion_id
    ) as cruzo
  from mediciones_vigentes m
),

diario_items as (
  select
    mv.medicion_id,
    rd.id           as respuesta_id,
    rd.enviado_en,
    ri.item_clave,
    ri.valor_num
  from mediciones_vigentes mv
  join respuestas rd
    on rd.participante_id = mv.participante_id
   and rd.formulario_clave = 'diario'
   and rd.enviado_en >= mv.t - interval '14 days'
   and rd.enviado_en <  mv.t
  join respuestas_items ri on ri.respuesta_id = rd.id
),
diario_agg as (
  select
    medicion_id,
    count(distinct enviado_en::date)                                                       as dias_respondidos,

    avg(valor_num)         filter (where item_clave = 'horas_trabajadas')                   as horas_trabajadas_media,
    regr_slope(valor_num, extract(epoch from enviado_en) / 86400.0)
                            filter (where item_clave = 'horas_trabajadas')                   as horas_trabajadas_pendiente,
    stddev_samp(valor_num)  filter (where item_clave = 'horas_trabajadas')                   as horas_trabajadas_desv,

    avg(valor_num)         filter (where item_clave = 'horas_sueno')                        as horas_sueno_media,
    regr_slope(valor_num, extract(epoch from enviado_en) / 86400.0)
                            filter (where item_clave = 'horas_sueno')                        as horas_sueno_pendiente,
    stddev_samp(valor_num)  filter (where item_clave = 'horas_sueno')                        as horas_sueno_desv,

    avg(valor_num)         filter (where item_clave = 'carga_percibida')                    as carga_percibida_media,
    regr_slope(valor_num, extract(epoch from enviado_en) / 86400.0)
                            filter (where item_clave = 'carga_percibida')                    as carga_percibida_pendiente,
    stddev_samp(valor_num)  filter (where item_clave = 'carga_percibida')                    as carga_percibida_desv,

    avg(valor_num)         filter (where item_clave = 'energia_final')                      as energia_final_media,
    regr_slope(valor_num, extract(epoch from enviado_en) / 86400.0)
                            filter (where item_clave = 'energia_final')                      as energia_final_pendiente,
    stddev_samp(valor_num)  filter (where item_clave = 'energia_final')                      as energia_final_desv,

    avg(valor_num)         filter (where item_clave = 'trabajo_fuera_horario')              as proporcion_trabajo_fuera_horario
  from diario_items
  group by medicion_id
),

semanal_items as (
  select
    mv.medicion_id,
    ri.item_clave,
    ri.valor_num
  from mediciones_vigentes mv
  join respuestas rs
    on rs.participante_id = mv.participante_id
   and rs.formulario_clave = 'semanal'
   and rs.enviado_en >= mv.t - interval '14 days'
   and rs.enviado_en <  mv.t
  join respuestas_items ri on ri.respuesta_id = rs.id
),
semanal_agg as (
  select
    medicion_id,
    sum(valor_num)          filter (where item_clave = 'horas_sobretiempo')     as horas_sobretiempo_suma,
    max(valor_num)          filter (where item_clave = 'proyectos_simultaneos') as proyectos_simultaneos_max,
    bool_or(valor_num = 1)  filter (where item_clave = 'guardias')              as guardias_alguna,
    avg(valor_num)          filter (where item_clave = 'reuniones_por_dia')     as reuniones_por_dia_media,
    avg(valor_num)          filter (where item_clave = 'autonomia')             as autonomia_media,
    avg(valor_num)          filter (where item_clave = 'apoyo_lider')           as apoyo_lider_media,
    avg(valor_num)          filter (where item_clave = 'claridad_rol')          as claridad_rol_media
  from semanal_items
  group by medicion_id
),

estable_items as (
  -- Solo la última respuesta: el participante puede actualizar sus datos
  -- iniciales desde Perfil (ESP-002 RF-002-16) y el máximo entre dos
  -- respuestas mezclaría el rol viejo con la antigüedad nueva.
  select
    re.participante_id,
    ri.item_clave,
    ri.valor_num,
    ri.valor_texto
  from respuestas re
  join respuestas_items ri on ri.respuesta_id = re.id
  where re.formulario_clave = 'estable'
    and re.id = (select id from respuestas
                 where participante_id = re.participante_id and formulario_clave = 'estable'
                 order by enviado_en desc limit 1)
),
estable_agg as (
  select
    participante_id,
    max(valor_num)   filter (where item_clave = 'edad')                as edad,
    max(valor_num)   filter (where item_clave = 'antiguedad_empresa')   as antiguedad_empresa,
    max(valor_num)   filter (where item_clave = 'antiguedad_sector')    as antiguedad_sector,
    max(valor_num)   filter (where item_clave = 'tamano_equipo')        as tamano_equipo,
    max(valor_num)   filter (where item_clave = 'personas_a_cargo')     as personas_a_cargo,
    max(valor_num)   filter (where item_clave = 'minutos_traslado')     as minutos_traslado,
    max(valor_texto) filter (where item_clave = 'rol')                  as rol,
    max(valor_texto) filter (where item_clave = 'modalidad')            as modalidad
  from estable_items
  group by participante_id
),

olbi_previo as (
  select
    mv.medicion_id,
    (
      select po.puntaje
      from puntajes_olbi po
      join respuestas rp on rp.id = po.respuesta_id
      where rp.participante_id = mv.participante_id
        and rp.enviado_en < mv.t
        and po.dimension = 'agotamiento'
      order by rp.enviado_en desc
      limit 1
    ) as agotamiento_anterior,
    (
      select po.puntaje
      from puntajes_olbi po
      join respuestas rp on rp.id = po.respuesta_id
      where rp.participante_id = mv.participante_id
        and rp.enviado_en < mv.t
        and po.dimension = 'desvinculacion'
      order by rp.enviado_en desc
      limit 1
    ) as desvinculacion_anterior
  from mediciones_vigentes mv
)

select
  mv.participante_id,
  mv.medicion_id,
  mv.t,
  mv.num_medicion,

  coalesce(da.dias_respondidos, 0)                     as dias_respondidos,
  coalesce(da.dias_respondidos, 0) / 14.0              as tasa_respuesta_diario,
  da.horas_trabajadas_media,
  da.horas_trabajadas_pendiente,
  da.horas_trabajadas_desv,
  da.horas_sueno_media,
  da.horas_sueno_pendiente,
  da.horas_sueno_desv,
  da.carga_percibida_media,
  da.carga_percibida_pendiente,
  da.carga_percibida_desv,
  da.energia_final_media,
  da.energia_final_pendiente,
  da.energia_final_desv,
  coalesce(da.proporcion_trabajo_fuera_horario, 0)     as proporcion_trabajo_fuera_horario,

  sa.horas_sobretiempo_suma,
  sa.proyectos_simultaneos_max,
  coalesce(sa.guardias_alguna, false)                  as guardias_alguna,
  sa.reuniones_por_dia_media,
  sa.autonomia_media,
  sa.apoyo_lider_media,
  sa.claridad_rol_media,

  ea.edad,
  ea.antiguedad_empresa,
  ea.antiguedad_sector,
  ea.tamano_equipo,
  ea.personas_a_cargo,
  ea.minutos_traslado,
  (ea.rol = 'desarrollo')::int          as rol_desarrollo,
  (ea.rol = 'qa')::int                  as rol_qa,
  (ea.rol = 'datos')::int               as rol_datos,
  (ea.rol = 'infraestructura')::int     as rol_infraestructura,
  (ea.rol = 'soporte')::int             as rol_soporte,
  (ea.rol = 'diseno')::int              as rol_diseno,
  (ea.rol = 'gestion')::int             as rol_gestion,
  (ea.rol = 'otro')::int                as rol_otro,
  (ea.modalidad = 'remoto')::int        as modalidad_remoto,
  (ea.modalidad = 'hibrido')::int       as modalidad_hibrido,
  (ea.modalidad = 'presencial')::int    as modalidad_presencial,

  op.agotamiento_anterior,
  op.desvinculacion_anterior,

  et.cruzo

from mediciones_vigentes mv
left join diario_agg  da on da.medicion_id = mv.medicion_id
left join semanal_agg sa on sa.medicion_id = mv.medicion_id
left join estable_agg ea on ea.participante_id = mv.participante_id
left join olbi_previo op on op.medicion_id = mv.medicion_id
join etiqueta et on et.medicion_id = mv.medicion_id;

comment on view ventanas_modelo is
  'ESP-005 §4/§7. Una fila por (participante, medición OLBI en t): entradas sobre la ventana de 14 días previa a t, más la etiqueta de cruce. Fuente única para entrenamiento (modelo/entrenamiento.ipynb) y predicción (predecir_riesgo).';;

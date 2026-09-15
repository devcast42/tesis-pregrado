-- Indicadores de la tesis — implementa ESP-006 RF-006-09.
--
-- Los tres indicadores del Anexo 3 se calculan aquí y en ningún otro lado.
-- Si la app los recalculara, habría dos verdades y la que llegue al capítulo
-- de resultados sería la que alguien copió a mano.

-- ---------------------------------------------------------------------------
-- Indicador 2 — volumen de profesionales evaluados por unidad de tiempo
-- ---------------------------------------------------------------------------

create or replace view indicador_volumen
with (security_invoker = on) as
select
  (e.ocurrido_en at time zone tz_estudio())::date            as dia,
  e.metadata->>'formulario'                                  as formulario,
  count(distinct e.participante_id)                          as profesionales_evaluados,
  count(*)                                                   as evaluaciones
from eventos e
where e.tipo = 'evaluacion_enviada'
group by 1, 2;

comment on view indicador_volumen is
  'Anexo 3, indicador 2. Profesionales distintos evaluados por día y formulario.';

-- ---------------------------------------------------------------------------
-- Indicador 3 — tiempo promedio de detección por profesional
--
-- Se registran las dos marcas: hasta la detección del sistema y hasta la
-- derivación efectiva. Así el indicador puede reportarse con o sin el tramo
-- de revisión humana, sin volver a recolectar (ESP-006 §11, pendiente 2).
-- ---------------------------------------------------------------------------

create or replace view indicador_tiempo_deteccion
with (security_invoker = on) as
with hitos as (
  select
    p.id as participante_id,
    p.organizacion_id,
    p.codigo_anonimo,
    coalesce(
      (select min(e.ocurrido_en) from eventos e
        where e.participante_id = p.id and e.tipo = 'inicio_seguimiento'),
      p.inscrito_en
    )                                                              as inicio,
    (select min(e.ocurrido_en) from eventos e
      where e.participante_id = p.id and e.tipo = 'deteccion')     as deteccion,
    (select min(e.ocurrido_en) from eventos e
      where e.participante_id = p.id and e.tipo = 'derivacion_psicologo') as derivacion,
    (select e.metadata->>'metodo' from eventos e
      where e.participante_id = p.id and e.tipo = 'deteccion'
      order by e.ocurrido_en limit 1)                              as metodo
  from participantes p
)
select
  participante_id,
  organizacion_id,
  codigo_anonimo,
  metodo,
  inicio,
  deteccion,
  derivacion,
  round(extract(epoch from (deteccion - inicio)) / 86400.0, 2)   as dias_hasta_deteccion,
  round(extract(epoch from (derivacion - inicio)) / 86400.0, 2)  as dias_hasta_derivacion,
  -- Quien termina el estudio sin detección está censurado a la derecha, no es
  -- un negativo limpio (documento de arquitectura §5.4).
  (deteccion is null)                                            as censurado
from hitos;

comment on view indicador_tiempo_deteccion is
  'Anexo 3, indicador 3. Una fila por participante. `censurado` marca a los no detectados.';

-- ---------------------------------------------------------------------------
-- Indicador 1 — precisión del modelo
--
-- Compara las detecciones del modelo contra el OLBI, que es el patrón oro.
-- Queda vacía hasta que exista el modelo (ESP-005); la fórmula ya está fija
-- para que el análisis no dependa de un cálculo hecho a mano después.
--
-- Se reportan precisión Y recall: la precisión sola es manipulable — un
-- modelo que marca a una sola persona y acierta obtiene 100% dejando sin
-- detectar a todos los demás (documento de arquitectura §3).
-- ---------------------------------------------------------------------------

create or replace view indicador_precision
with (security_invoker = on) as
with etiquetas as (
  -- Patrón oro: qué dijo el OLBI sobre cada participante.
  select distinct participante_id, true as positivo_olbi
  from eventos
  where tipo = 'deteccion' and metadata->>'metodo' = 'olbi_umbral'
),
predicciones as (
  select distinct participante_id, true as positivo_modelo
  from eventos
  where tipo = 'deteccion' and metadata->>'metodo' = 'modelo_ml'
),
matriz as (
  select
    count(*) filter (where e.positivo_olbi and m.positivo_modelo)          as verdaderos_positivos,
    count(*) filter (where e.positivo_olbi is null and m.positivo_modelo)  as falsos_positivos,
    count(*) filter (where e.positivo_olbi and m.positivo_modelo is null)  as falsos_negativos
  from etiquetas e
  full outer join predicciones m on m.participante_id = e.participante_id
)
select
  verdaderos_positivos as tp,
  falsos_positivos     as fp,
  falsos_negativos     as fn,
  round(100.0 * verdaderos_positivos
        / nullif(verdaderos_positivos + falsos_positivos, 0), 2) as precision_pct,
  round(100.0 * verdaderos_positivos
        / nullif(verdaderos_positivos + falsos_negativos, 0), 2) as recall_pct,
  round(200.0 * verdaderos_positivos
        / nullif(2 * verdaderos_positivos + falsos_positivos + falsos_negativos, 0), 2) as f1_pct
from matriz;

comment on view indicador_precision is
  'Anexo 3, indicador 1. Modelo contra OLBI. Reporta precisión, recall y F1.';

-- ---------------------------------------------------------------------------
-- Panel del investigador
-- ---------------------------------------------------------------------------

create or replace view panel_participantes
with (security_invoker = on) as
select
  p.id,
  p.codigo_anonimo,
  o.nombre                        as organizacion,
  p.estado,
  p.inscrito_en,
  a.dias_sin_checkin,
  a.tasa_adherencia,
  a.estado_adherencia,
  t.dias_hasta_deteccion,
  (select count(*) from respuestas r
    where r.participante_id = p.id and r.formulario_clave = 'olbi') as olbi_respondidos
from participantes p
join organizaciones o on o.id = p.organizacion_id
left join adherencia a on a.participante_id = p.id
left join indicador_tiempo_deteccion t on t.participante_id = p.id;

create or replace view resumen_estudio
with (security_invoker = on) as
select
  (select count(*) from participantes)                                    as inscritos,
  (select count(*) from participantes where estado = 'activo')            as activos,
  (select count(*) from participantes where estado = 'detectado')         as detectados,
  (select count(*) from adherencia where estado_adherencia = 'al_dia')    as al_dia,
  (select count(*) from adherencia where estado_adherencia = 'en_riesgo') as en_riesgo,
  (select count(*) from adherencia where estado_adherencia = 'inactivo')  as inactivos,
  (select round(avg(tasa_adherencia), 3) from adherencia)                 as adherencia_promedio,
  (select round(avg(dias_hasta_deteccion), 2)
     from indicador_tiempo_deteccion where not censurado)                 as dias_deteccion_promedio,
  (select count(*) from derivaciones where cerrada_en is null)            as derivaciones_abiertas,
  (select count(*) from informes where estado = 'sin_revisar')            as informes_por_revisar;

comment on view resumen_estudio is
  'Cifras de cabecera del panel del investigador. Una fila.';

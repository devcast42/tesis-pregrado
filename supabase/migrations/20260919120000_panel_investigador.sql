-- Panel del investigador — implementa ESP-009 §6 (vistas y funciones).
--
-- Todo `security_invoker = on`: RLS ya le da al investigador lectura sobre
-- el esquema de investigación (ESP-006) y a nadie más se lo da sobre estas
-- tablas, así que las vistas no abren nada nuevo (CA-009-05). El investigador
-- NO está bajo el mínimo de reporte (RN-009-04): aquí no se censura ninguna
-- celda.
--
-- Lo que NUNCA sale de aquí: transcripciones ni contenido de informes
-- (RN-009-03). `informes` solo aporta estado y fechas.

-- ---------------------------------------------------------------------------
-- 0. Eventos nuevos
-- ---------------------------------------------------------------------------

alter type tipo_evento add value if not exists 'exportacion_dataset';
alter type tipo_evento add value if not exists 'reasignacion_psicologo';

-- ---------------------------------------------------------------------------
-- 1. Serie diaria v2 (RN-009-09) — reemplaza historial_checkin, que leía
--    ítems de la versión 1 que ya no existen.
-- ---------------------------------------------------------------------------

create or replace view serie_diaria_v2
with (security_invoker = on) as
select
  r.participante_id,
  (r.enviado_en at time zone tz_estudio())::date                           as dia,
  r.enviado_en,
  max(ri.valor_num) filter (where ri.item_clave = 'od_04')                 as od_04,
  max(ri.valor_num) filter (where ri.item_clave = 'od_12')                 as od_12,
  max(ri.valor_num) filter (where ri.item_clave = 'od_03')                 as od_03,
  max(ri.valor_num) filter (where ri.item_clave = 'od_06')                 as od_06,
  round(avg(ri.valor_num) filter (where ri.item_clave in ('od_04','od_12','od_03','od_06')), 2) as indice_diario,
  max(ri.valor_num) filter (where ri.item_clave = 'horas_trabajadas')      as horas_trabajadas,
  max(ri.valor_num) filter (where ri.item_clave = 'horas_sueno')           as horas_sueno,
  max(ri.valor_num) filter (where ri.item_clave = 'horas_fin_de_semana')   as horas_fin_de_semana
from respuestas r
join respuestas_items ri on ri.respuesta_id = r.id
where r.formulario_clave = 'diario'
group by r.participante_id, (r.enviado_en at time zone tz_estudio())::date, r.enviado_en;

comment on view serie_diaria_v2 is
  'ESP-009 RF-009-08. Check-in diario v2: los 4 ítems OLBI, su media, horas y sueño. Reemplaza historial_checkin.';

grant select on serie_diaria_v2 to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Calendario de respuestas (RF-009-08)
-- ---------------------------------------------------------------------------

create or replace view calendario_respuestas
with (security_invoker = on) as
select
  r.participante_id,
  (r.enviado_en at time zone tz_estudio())::date  as dia,
  r.formulario_clave,
  r.formulario_version,
  r.enviado_en,
  extract(epoch from (r.enviado_en - r.iniciado_en))::int as segundos
from respuestas r
where r.formulario_clave in ('diario', 'olbi', 'semanal', 'estable');

grant select on calendario_respuestas to authenticated;

-- ---------------------------------------------------------------------------
-- 3. OLBI semanal con etiqueta «alto» (base de predicciones y cohorte)
--
-- «Alto» = alguna dimensión en o sobre su umbral de la definición vigente
-- del formulario (Leclercq), igual que evaluar-olbi y que la app.
-- ---------------------------------------------------------------------------

create or replace view olbi_semanal_etiquetado
with (security_invoker = on) as
with umbral as (
  select
    (definicion -> 'umbrales' ->> 'agotamiento')::numeric    as u_ag,
    (definicion -> 'umbrales' ->> 'desvinculacion')::numeric as u_dv
  from formularios where clave = 'olbi' order by version desc limit 1
),
por_respuesta as (
  select
    p.participante_id, p.respuesta_id, p.enviado_en,
    semana_de(p.enviado_en) as semana,
    max(p.puntaje) filter (where p.dimension = 'agotamiento')    as agotamiento,
    max(p.puntaje) filter (where p.dimension = 'desvinculacion') as desvinculacion
  from puntajes_olbi p
  group by p.participante_id, p.respuesta_id, p.enviado_en
),
ultima_de_semana as (
  select distinct on (participante_id, semana) *
  from por_respuesta order by participante_id, semana, enviado_en desc
)
select
  u.participante_id, u.respuesta_id, u.enviado_en, u.semana,
  u.agotamiento, u.desvinculacion,
  (u.agotamiento >= um.u_ag or u.desvinculacion >= um.u_dv) as alto,
  um.u_ag as umbral_agotamiento, um.u_dv as umbral_desvinculacion
from ultima_de_semana u, umbral um;

grant select on olbi_semanal_etiquetado to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Predicciones por participante, confrontadas con lo que pasó (RF-009-08,
--    RF-009-12, RN-009-05): solo eventos registrados en su momento.
-- ---------------------------------------------------------------------------

create or replace view predicciones_participante
with (security_invoker = on) as
with pred as (
  select
    e.participante_id,
    e.id                                          as evento_id,
    e.ocurrido_en,
    e.metadata ->> 'tarea'                         as tarea,
    e.metadata ->> 'version'                       as version,
    (e.metadata ->> 'dia')::date                   as dia,
    (e.metadata ->> 'n_dias')::int                 as n_dias,
    (e.metadata ->> 'probabilidad')::numeric       as probabilidad,
    (e.metadata ->> 'senalado')::boolean           as senalado,
    date_trunc('week', (e.metadata ->> 'dia')::date)::date as semana
  from eventos e
  where e.tipo = 'prediccion_modelo'
),
-- Nowcast apunta al viernes de SU semana; pronóstico, al de la SIGUIENTE.
-- Solo cuenta un nowcast dicho antes del viernes (dia < lunes + 4).
objetivo as (
  select p.*,
    case when p.tarea = 'nowcast' then p.semana else p.semana + 7 end as semana_objetivo,
    (p.tarea = 'nowcast' and p.dia >= p.semana + 4) as tardio
  from pred p
)
select
  o.participante_id, o.evento_id, o.ocurrido_en, o.tarea, o.version, o.dia, o.semana, o.semana_objetivo,
  o.n_dias, o.probabilidad, o.senalado, o.tardio,
  s.alto                       as resultado_real,
  s.agotamiento                as agotamiento_real,
  s.desvinculacion             as desvinculacion_real,
  case when s.alto is null or o.tardio then null else (o.senalado = s.alto) end as acierto
from objetivo o
left join olbi_semanal_etiquetado s
  on s.participante_id = o.participante_id and s.semana = o.semana_objetivo;

comment on view predicciones_participante is
  'ESP-009 RF-009-08/12. Cada predicción registrada, unida al OLBI de su semana objetivo. acierto nulo = aún sin resultado o nowcast tardío.';

grant select on predicciones_participante to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Desempeño y calibración del modelo (RF-009-12)
--
-- Para el nowcast se toma UNA predicción por participante y semana: la última
-- dicha antes del viernes (la que la retrospectiva confronta). Para el
-- pronóstico, la del viernes.
-- ---------------------------------------------------------------------------

create or replace view predicciones_evaluables
with (security_invoker = on) as
select distinct on (participante_id, tarea, semana)
  *
from predicciones_participante
where acierto is not null
order by participante_id, tarea, semana, dia desc, ocurrido_en desc;

grant select on predicciones_evaluables to authenticated;

create or replace view desempeno_modelo
with (security_invoker = on) as
with base as (
  select tarea, version, semana_objetivo as semana, senalado, resultado_real
  from predicciones_evaluables
),
por_semana as (
  select tarea, version, semana,
    count(*)                                                   as n,
    count(*) filter (where senalado and resultado_real)        as vp,
    count(*) filter (where senalado and not resultado_real)    as fp,
    count(*) filter (where not senalado and not resultado_real) as vn,
    count(*) filter (where not senalado and resultado_real)    as fn
  from base group by tarea, version, semana
),
acumulado as (
  select tarea, version, null::date as semana,
    count(*) as n,
    count(*) filter (where senalado and resultado_real)        as vp,
    count(*) filter (where senalado and not resultado_real)    as fp,
    count(*) filter (where not senalado and not resultado_real) as vn,
    count(*) filter (where not senalado and resultado_real)    as fn
  from base group by tarea, version
),
todo as (select * from por_semana union all select * from acumulado)
select
  tarea, version, semana, n, vp, fp, vn, fn,
  case when vp + fp > 0 then round(vp::numeric / (vp + fp), 3) end as precision,
  case when vp + fn > 0 then round(vp::numeric / (vp + fn), 3) end as recall,
  case when vn + fp > 0 then round(vn::numeric / (vn + fp), 3) end as especificidad,
  case when n > 0 then round((vp + vn)::numeric / n, 3) end        as exactitud
from todo;

comment on view desempeno_modelo is
  'ESP-009 RF-009-12. Matriz de confusión y métricas por semana (semana no nula) y acumuladas (semana nula), por tarea y versión. Solo predicciones registradas en su momento (RN-009-05).';

grant select on desempeno_modelo to authenticated;

create or replace view calibracion_modelo
with (security_invoker = on) as
select
  tarea, version,
  least(9, floor(probabilidad * 10))::int             as decil,
  count(*)                                             as n,
  round(avg(probabilidad), 3)                          as prob_media,
  round(avg(resultado_real::int)::numeric, 3)          as frecuencia_observada
from predicciones_evaluables
group by tarea, version, least(9, floor(probabilidad * 10));

grant select on calibracion_modelo to authenticated;

/** ROC-AUC por tarea y versión sobre las predicciones evaluables
 *  (estadístico de Mann-Whitney: P(prob positivo > prob negativo)). */
create or replace function roc_auc_modelo(p_tarea text, p_version text)
returns numeric
language sql stable security invoker as $$
  with e as (
    select probabilidad, resultado_real from predicciones_evaluables
    where tarea = p_tarea and version = p_version
  ),
  pares as (
    select
      count(*) filter (where p.probabilidad > n.probabilidad) + 0.5 * count(*) filter (where p.probabilidad = n.probabilidad) as favorables,
      count(*) as total
    from e p, e n
    where p.resultado_real and not n.resultado_real
  )
  select case when total > 0 then round((favorables / total)::numeric, 3) end from pares
$$;

grant execute on function roc_auc_modelo(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cohorte semanal sin mínimo (RF-009-05, RN-009-04)
--
-- `factores_semana_participante` y `segmento_participante` son vistas
-- definer del panel del empresario, sin permiso para `authenticated` (así
-- un admin no puede leerlas directas). Aquí se replican como invoker: RLS
-- las acota a quien tiene lectura sobre respuestas, es decir, al investigador.
-- ---------------------------------------------------------------------------

create or replace view factores_semana_inv
with (security_invoker = on) as
select
  r.participante_id,
  pa.organizacion_id,
  semana_de(r.enviado_en)                                                          as semana,
  avg(i.valor_num) filter (where i.item_clave = 'horas_trabajadas')                as horas_dia,
  avg(i.valor_num) filter (where i.item_clave = 'horas_sueno')                     as sueno,
  max(i.valor_num) filter (where i.item_clave = 'horas_fin_de_semana')             as fin_de_semana,
  max(i.valor_num) filter (where i.item_clave = 'horas_sobretiempo')               as sobretiempo,
  max(i.valor_num) filter (where i.item_clave = 'guardias')                        as guardia,
  max(i.valor_num) filter (where i.item_clave = 'apoyo_lider')                     as apoyo_lider
from respuestas r
join respuestas_items i on i.respuesta_id = r.id
join participantes pa on pa.id = r.participante_id
where r.formulario_clave in ('diario', 'semanal')
group by r.participante_id, pa.organizacion_id, semana_de(r.enviado_en);

create or replace view segmento_inv
with (security_invoker = on) as
select r.participante_id, s.tipo, s.segmento
from respuestas r
join lateral (
  select 'modalidad' as tipo, max(i.valor_texto) filter (where i.item_clave = 'modalidad') as segmento
  from respuestas_items i where i.respuesta_id = r.id
  union all
  select 'rol', max(i.valor_texto) filter (where i.item_clave = 'rol')
  from respuestas_items i where i.respuesta_id = r.id
) s on true
where r.formulario_clave = 'estable'
  and r.id = (select id from respuestas r2 where r2.participante_id = r.participante_id and r2.formulario_clave = 'estable'
              order by r2.enviado_en desc limit 1)
  and s.segmento is not null;

grant select on factores_semana_inv, segmento_inv to authenticated;

create or replace view cohorte_semanal
with (security_invoker = on) as
with semanas as (
  select distinct semana from olbi_semanal_etiquetado
  union select distinct semana_de(enviado_en) from respuestas where formulario_clave = 'diario'
),
orgs as (select id as organizacion_id from organizaciones union all select null),
olbi as (
  select pa.organizacion_id, o.semana,
    count(*) as respondieron_viernes,
    round(avg(o.agotamiento)::numeric, 2) as olbi_agotamiento_media,
    round(avg(o.desvinculacion)::numeric, 2) as olbi_desvinculacion_media,
    round(100.0 * avg(o.alto::int), 1) as pct_alto
  from olbi_semanal_etiquetado o join participantes pa on pa.id = o.participante_id
  group by grouping sets ((pa.organizacion_id, o.semana), (o.semana))
),
fact as (
  select organizacion_id, semana,
    round(avg(horas_dia)::numeric, 2) as horas_dia_media,
    round(avg(sueno)::numeric, 2) as sueno_media,
    round(avg(fin_de_semana)::numeric, 2) as fin_de_semana_media,
    round(avg(sobretiempo)::numeric, 2) as sobretiempo_media,
    round(100.0 * avg(guardia), 1) as guardia_pct,
    round(avg(apoyo_lider)::numeric, 2) as apoyo_lider_media
  from factores_semana_inv
  group by grouping sets ((organizacion_id, semana), (semana))
),
estado as (
  select o.organizacion_id, s.semana,
    count(p.id) filter (where p.inscrito_en < s.semana + 7)                              as inscritos,
    count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'activo')      as activos,
    count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'detectado')   as detectados,
    count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'retirado')    as retirados,
    count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'finalizado')  as finalizados
  from orgs o
  cross join semanas s
  left join participantes p on (o.organizacion_id is null or p.organizacion_id = o.organizacion_id)
  group by o.organizacion_id, s.semana
)
select
  e.organizacion_id, e.semana,
  e.inscritos, e.activos, e.detectados, e.retirados, e.finalizados,
  coalesce(ol.respondieron_viernes, 0) as respondieron_viernes,
  ol.olbi_agotamiento_media, ol.olbi_desvinculacion_media, ol.pct_alto,
  f.horas_dia_media, f.sueno_media, f.fin_de_semana_media, f.sobretiempo_media, f.guardia_pct, f.apoyo_lider_media
from estado e
left join olbi ol on ol.semana = e.semana and ol.organizacion_id is not distinct from e.organizacion_id
left join fact f  on f.semana  = e.semana and f.organizacion_id  is not distinct from e.organizacion_id
where e.inscritos > 0;

comment on view cohorte_semanal is
  'ESP-009 RF-009-05. Cohorte por semana y empresa (organizacion_id nulo = todo el estudio), sin mínimo de reporte.';

grant select on cohorte_semanal to authenticated;

create or replace view cohorte_segmento
with (security_invoker = on) as
select
  pa.organizacion_id, o.semana, s.tipo as tipo_segmento, s.segmento,
  count(*) as respondientes,
  round(avg(o.agotamiento)::numeric, 2) as olbi_agotamiento_media,
  round(avg(o.desvinculacion)::numeric, 2) as olbi_desvinculacion_media,
  round(100.0 * avg(o.alto::int), 1) as pct_alto
from olbi_semanal_etiquetado o
join participantes pa on pa.id = o.participante_id
join segmento_inv s on s.participante_id = o.participante_id
group by grouping sets ((pa.organizacion_id, o.semana, s.tipo, s.segmento), (o.semana, s.tipo, s.segmento));

grant select on cohorte_segmento to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Circuito de apoyo (RF-009-10)
-- ---------------------------------------------------------------------------

create or replace view circuito_apoyo
with (security_invoker = on) as
with det as (
  select d.id as derivacion_id,
    (select e.ocurrido_en from eventos e
      where (e.id = d.evento_deteccion_id)
         or (d.evento_deteccion_id is null and e.participante_id = d.participante_id
             and e.tipo = 'deteccion' and e.ocurrido_en <= d.abierta_en)
      order by e.ocurrido_en desc limit 1) as detectado_en
  from derivaciones d
),
ses as (
  select derivacion_id, min(iniciada_en) as primera_sesion_en, count(*) as sesiones,
         count(*) filter (where finalizada_en is not null) as sesiones_finalizadas
  from sesiones_consulta group by derivacion_id
),
inf as (
  select s.derivacion_id, min(i.aprobado_en) as informe_aprobado_en,
         count(*) filter (where i.estado = 'sin_revisar') as informes_pendientes
  from informes i join sesiones_consulta s on s.id = i.sesion_id
  group by s.derivacion_id
)
select
  d.id as derivacion_id, d.participante_id, p.codigo_anonimo, p.organizacion_id,
  d.psicologo_id, ps.nombre as psicologo, d.origen,
  det.detectado_en, d.abierta_en as derivado_en, ses.primera_sesion_en, inf.informe_aprobado_en, d.cerrada_en,
  coalesce(ses.sesiones, 0) as sesiones, coalesce(inf.informes_pendientes, 0) as informes_pendientes,
  round(extract(epoch from (d.abierta_en - det.detectado_en)) / 86400, 1)          as dias_a_derivacion,
  round(extract(epoch from (ses.primera_sesion_en - d.abierta_en)) / 86400, 1)     as dias_a_sesion,
  round(extract(epoch from (inf.informe_aprobado_en - ses.primera_sesion_en)) / 86400, 1) as dias_a_informe,
  case
    when d.cerrada_en is not null then 'cerrada'
    when inf.informes_pendientes > 0 then 'informe_pendiente'
    when ses.sesiones > 0 and ses.sesiones_finalizadas = ses.sesiones then 'sesion_realizada'
    when ses.sesiones > 0 then 'sala_abierta'
    else 'sin_sesion'
  end as estado
from derivaciones d
join participantes p on p.id = d.participante_id
left join psicologos ps on ps.id = d.psicologo_id
left join det on det.derivacion_id = d.id
left join ses on ses.derivacion_id = d.id
left join inf on inf.derivacion_id = d.id;

grant select on circuito_apoyo to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Bandeja de hoy (RF-009-01) — una fila por pendiente
--
-- Umbrales (ESP-009 §9.1): inactivo ≥ 4 días hábiles; derivación sin sesión
-- ≥ 7 días; cita sin confirmar ≥ 2 días; informe sin aprobar ≥ 7 días;
-- consentimiento pendiente ≥ 7 días desde la inscripción.
-- ---------------------------------------------------------------------------

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
  select 'cita_sin_confirmar' as tipo, ci.participante_id, p.codigo_anonimo, p.organizacion_id,
         ci.id as referencia_id, ci.creada_en as desde,
         (hoy.dia - (ci.creada_en at time zone tz_estudio())::date)::int as dias
  from citas ci join participantes p on p.id = ci.participante_id, hoy
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

grant select on bandeja_investigador to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Encabezado de la ficha en una llamada (RF-009-08)
-- ---------------------------------------------------------------------------

create or replace function ficha_participante(p_id uuid)
returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'participante_id', p.id,
    'codigo_anonimo', p.codigo_anonimo,
    'empresa', o.nombre,
    'organizacion_id', p.organizacion_id,
    'estado', p.estado,
    'inscrito_en', p.inscrito_en,
    'semana', greatest(1, floor(extract(epoch from (now() - p.inscrito_en)) / (7 * 86400))::int + 1),
    'adherencia', (select jsonb_build_object('esperados', a.dias_esperados, 'cumplidos', a.dias_cumplidos,
                                             'tasa', a.tasa_adherencia,
                                             'viernes_esperados', a.viernes_esperados, 'viernes_cumplidos', a.viernes_cumplidos,
                                             'dias_sin_checkin', a.dias_sin_checkin)
                   from adherencia a where a.participante_id = p.id),
    'derivacion', (select jsonb_build_object('id', c.derivacion_id, 'psicologo', c.psicologo, 'psicologo_id', c.psicologo_id,
                                             'origen', c.origen, 'estado', c.estado, 'derivado_en', c.derivado_en)
                   from circuito_apoyo c where c.participante_id = p.id and c.cerrada_en is null limit 1),
    'cita', (select jsonb_build_object('id', ci.id, 'estado', ci.estado, 'propuesta_para', ci.propuesta_para)
             from citas ci where ci.participante_id = p.id and ci.estado in ('solicitada','confirmada') limit 1),
    'deteccion', (select jsonb_build_object('ocurrido_en', e.ocurrido_en, 'puntajes', e.metadata -> 'puntajes', 'umbrales', e.metadata -> 'umbrales')
                  from eventos e where e.participante_id = p.id and e.tipo = 'deteccion' order by e.ocurrido_en desc limit 1),
    'ultimo_olbi', (select jsonb_build_object('semana', s.semana, 'agotamiento', s.agotamiento, 'desvinculacion', s.desvinculacion, 'alto', s.alto)
                    from olbi_semanal_etiquetado s where s.participante_id = p.id order by s.semana desc limit 1),
    'ultima_prediccion', (select jsonb_build_object('tarea', q.tarea, 'dia', q.dia, 'probabilidad', q.probabilidad, 'version', q.version, 'acierto', q.acierto)
                          from predicciones_participante q where q.participante_id = p.id order by q.ocurrido_en desc limit 1)
  )
  from participantes p
  left join organizaciones o on o.id = p.organizacion_id
  where p.id = p_id and es_investigador()
$$;

grant execute on function ficha_participante(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Acciones (RF-009-09, RF-009-13, RN-009-06, RN-009-07)
-- ---------------------------------------------------------------------------

create or replace function cerrar_seguimiento(p_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  if p_motivo not in ('fin_de_estudio', 'salida_empresa', 'otro') then
    raise exception 'motivo no valido' using errcode = 'P0001';
  end if;
  update participantes set estado = 'finalizado' where id = p_id and estado in ('activo', 'detectado');
  insert into eventos (participante_id, tipo, metadata)
  values (p_id, 'salida_seguimiento', jsonb_build_object('motivo', p_motivo, 'por', 'investigador'));
end $$;

create or replace function reasignar_derivacion(p_derivacion uuid, p_psicologo uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_participante uuid; v_anterior uuid;
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  select participante_id, psicologo_id into v_participante, v_anterior
  from derivaciones where id = p_derivacion and cerrada_en is null;
  if v_participante is null then
    raise exception 'derivacion no encontrada o cerrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from psicologos where id = p_psicologo and activo) then
    raise exception 'psicologo no activo' using errcode = 'P0001';
  end if;
  update derivaciones set psicologo_id = p_psicologo where id = p_derivacion;
  update citas set psicologo_id = p_psicologo where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');
  insert into eventos (participante_id, tipo, metadata)
  values (v_participante, 'reasignacion_psicologo',
          jsonb_build_object('derivacion_id', p_derivacion, 'de', v_anterior, 'a', p_psicologo, 'por', 'investigador'));
end $$;

create or replace function registrar_exportacion(p_filtros jsonb, p_conteos jsonb, p_hash text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_p uuid;
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  -- `eventos` exige participante; una exportación es del estudio. Se ancla
  -- al primer participante del filtro (o cualquiera) y el metadata lo dice.
  select id into v_p from participantes order by inscrito_en limit 1;
  insert into eventos (participante_id, tipo, metadata)
  values (v_p, 'exportacion_dataset', jsonb_build_object('filtros', p_filtros, 'conteos', p_conteos, 'hash', p_hash, 'por', auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function cerrar_seguimiento(uuid, text) to authenticated;
grant execute on function reasignar_derivacion(uuid, uuid) to authenticated;
grant execute on function registrar_exportacion(jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Línea de tiempo completa (RF-009-08): amplía eventos_participante con
--     citas, sesiones, informes (solo el hecho) y accesos a identidad.
-- ---------------------------------------------------------------------------

create or replace view linea_tiempo_participante
with (security_invoker = on) as
select participante_id, tipo::text as tipo, ocurrido_en, metadata
from eventos
-- Comparación en texto: los valores nuevos del enum no se pueden usar como
-- literal dentro de la misma transacción que los crea.
where tipo::text in ('inicio_seguimiento', 'deteccion', 'derivacion_psicologo', 'sesion_iniciada', 'sesion_realizada',
               'salida_seguimiento', 'alerta_adherencia', 'acceso_identidad', 'informe_aprobado',
               'cita_solicitada', 'cita_confirmada', 'cita_cancelada', 'reasignacion_psicologo')
union all
select participante_id, 'consentimiento', registrado_en, jsonb_build_object('aceptado', aceptado, 'version_texto', version_texto)
from consentimientos
union all
select d.participante_id, 'sesion_finalizada', s.finalizada_en,
       jsonb_build_object('sesion_id', s.id, 'minutos', round(extract(epoch from (s.finalizada_en - s.iniciada_en)) / 60))
from sesiones_consulta s join derivaciones d on d.id = s.derivacion_id
where s.finalizada_en is not null;

grant select on linea_tiempo_participante to authenticated;

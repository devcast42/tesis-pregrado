-- Panel del empresario — implementa ESP-008 rev. 2 (RF-008-13 … RF-008-23).
--
-- La pregunta de diseño: qué puede saber una empresa sin saber nada de nadie.
-- Respuesta: promedios semanales de la empresa, y solo cuando la celda
-- (empresa × semana × segmento) tiene al menos `minimo_para_reportar()`
-- respondientes. Bajo el mínimo la fila NO existe (RN-008-11): no se marca
-- «sin datos», porque hasta la ausencia informaría.
--
-- Todas las vistas son SECURITY DEFINER (security_invoker = off) filtradas
-- por alcance_empresa(): son el único camino del admin a estos datos
-- (RN-008-03); no tiene lectura sobre respuestas, puntajes ni items.
--
-- Redondeos (RN-008-12): OLBI a un decimal, porcentajes a múltiplos de 5,
-- conteos de sesiones a múltiplos de 5.

-- ---------------------------------------------------------------------------
-- 1. Umbrales organizacionales (RN-008-13)
-- ---------------------------------------------------------------------------

create table if not exists umbrales_empresa (
  dimension   text primary key check (dimension in ('agotamiento', 'desvinculacion')),
  a_vigilar   numeric(3,2) not null,
  alto        numeric(3,2) not null,
  fuente      text not null,
  check (alto > a_vigilar)
);

-- Propuesta inicial (ESP-008 §9.4): puntos de corte de Peterson et al. (2008)
-- para el OLBI individual, a la espera de percentiles del propio estudio.
insert into umbrales_empresa (dimension, a_vigilar, alto, fuente) values
  ('agotamiento',    2.25, 2.85, 'Peterson et al. (2008), propuesta pendiente de validación del asesor'),
  ('desvinculacion', 2.10, 2.60, 'Peterson et al. (2008), propuesta pendiente de validación del asesor')
on conflict (dimension) do nothing;

alter table umbrales_empresa enable row level security;
create policy "todos leen los umbrales de empresa"
  on umbrales_empresa for select to authenticated using (true);
-- Sin política de escritura: solo el investigador, por SQL.

create or replace function nivel_empresa(p_dimension text, p_media numeric) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_media is null then null
    when p_media >= u.alto      then 'alto'
    when p_media >= u.a_vigilar then 'a_vigilar'
    else 'bajo'
  end
  from umbrales_empresa u where u.dimension = p_dimension
$$;

-- ---------------------------------------------------------------------------
-- 2. Utilidades
-- ---------------------------------------------------------------------------

/** Lunes de la semana (zona del estudio) de una marca de tiempo. */
create or replace function semana_de(ts timestamptz) returns date
language sql immutable as $$
  select date_trunc('week', ts at time zone 'America/Lima')::date
$$;

create or replace function redondear_a_5(x numeric) returns int
language sql immutable as $$ select (round(x / 5.0) * 5)::int $$;

/** Segmento de cada participante según su última respuesta a `estable`.
 *  Uso interno de las vistas; no se concede a `authenticated`. */
create or replace view segmento_participante
with (security_invoker = off) as
select
  r.participante_id,
  s.tipo,
  s.segmento
from respuestas r
join lateral (
  select 'modalidad' as tipo, max(i.valor_texto) filter (where i.item_clave = 'modalidad') as segmento
  from respuestas_items i where i.respuesta_id = r.id
  union all
  select 'rol', max(i.valor_texto) filter (where i.item_clave = 'rol')
  from respuestas_items i where i.respuesta_id = r.id
) s on true
where r.formulario_clave = 'estable'
  and r.id = (select id from respuestas r2
              where r2.participante_id = r.participante_id and r2.formulario_clave = 'estable'
              order by r2.enviado_en desc limit 1)
  and s.segmento is not null;

-- ---------------------------------------------------------------------------
-- 3. Pulso semanal (RF-008-13) y comparación con el estudio (RF-008-14)
-- ---------------------------------------------------------------------------

/** Una fila por participante × semana con su OLBI del viernes (última
 *  aplicación de la semana si hubiera más de una). Interna. */
create or replace view olbi_semana_participante
with (security_invoker = off) as
select distinct on (p.participante_id, semana_de(p.enviado_en))
  p.participante_id,
  pa.organizacion_id,
  semana_de(p.enviado_en)                                  as semana,
  max(p.puntaje) filter (where p.dimension = 'agotamiento')     over (partition by p.respuesta_id) as agotamiento,
  max(p.puntaje) filter (where p.dimension = 'desvinculacion')  over (partition by p.respuesta_id) as desvinculacion
from puntajes_olbi p
join participantes pa on pa.id = p.participante_id
order by p.participante_id, semana_de(p.enviado_en), p.enviado_en desc;

create or replace view pulso_empresa
with (security_invoker = off) as
with agg as (
  select
    organizacion_id,
    semana,
    count(*)                              as respondientes,
    round(avg(agotamiento)::numeric, 1)    as agotamiento_media,
    round(avg(desvinculacion)::numeric, 1) as desvinculacion_media
  from olbi_semana_participante
  group by organizacion_id, semana
)
select
  organizacion_id, semana, respondientes, agotamiento_media, desvinculacion_media,
  nivel_empresa('agotamiento', agotamiento_media)       as nivel_agotamiento,
  nivel_empresa('desvinculacion', desvinculacion_media) as nivel_desvinculacion
from agg
where respondientes >= minimo_para_reportar()
  and alcance_empresa(organizacion_id);

comment on view pulso_empresa is
  'ESP-008 RF-008-13. Media semanal del OLBI por empresa. Solo semanas con al menos minimo_para_reportar() respondientes.';

create or replace view pulso_estudio
with (security_invoker = off) as
with agg as (
  select
    semana,
    count(distinct organizacion_id)        as empresas,
    count(*)                               as respondientes,
    round(avg(agotamiento)::numeric, 1)    as agotamiento_media,
    round(avg(desvinculacion)::numeric, 1) as desvinculacion_media
  from olbi_semana_participante
  -- RN-008-14: excluye la empresa del solicitante (para el investigador,
  -- empresa_del_admin() es NULL y entran todas).
  where organizacion_id is distinct from empresa_del_admin()
  group by semana
)
select semana, empresas, respondientes, agotamiento_media, desvinculacion_media
from agg
where empresas >= 2 and respondientes >= minimo_para_reportar();

comment on view pulso_estudio is
  'ESP-008 RF-008-14. Promedio de las demás empresas del estudio, por semana. Solo con al menos 2 empresas y el mínimo de respondientes.';

create or replace view pulso_empresa_segmento
with (security_invoker = off) as
with agg as (
  select
    o.organizacion_id, o.semana, s.tipo as tipo_segmento, s.segmento,
    count(*)                               as respondientes,
    round(avg(o.agotamiento)::numeric, 1)  as agotamiento_media,
    round(avg(o.desvinculacion)::numeric, 1) as desvinculacion_media
  from olbi_semana_participante o
  join segmento_participante s on s.participante_id = o.participante_id
  group by o.organizacion_id, o.semana, s.tipo, s.segmento
)
select
  organizacion_id, semana, tipo_segmento, segmento, respondientes, agotamiento_media, desvinculacion_media,
  nivel_empresa('agotamiento', agotamiento_media)       as nivel_agotamiento,
  nivel_empresa('desvinculacion', desvinculacion_media) as nivel_desvinculacion
from agg
where respondientes >= minimo_para_reportar()
  and alcance_empresa(organizacion_id);

-- ---------------------------------------------------------------------------
-- 4. Factores de trabajo (RF-008-15, RF-008-17)
-- ---------------------------------------------------------------------------

/** Una fila por participante × semana con sus factores de esa semana.
 *  Los diarios se promedian (horas/día, sueño); los del lunes y del viernes
 *  se toman tal cual. Interna. */
create or replace view factores_semana_participante
with (security_invoker = off) as
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

create or replace view factores_empresa
with (security_invoker = off) as
with agg as (
  select
    organizacion_id, semana,
    count(*)                                          as respondientes,
    round(avg(horas_dia)::numeric, 1)                 as horas_dia_media,
    round(avg(sueno)::numeric, 1)                     as sueno_media,
    round(avg(fin_de_semana)::numeric, 1)             as fin_de_semana_media,
    round(avg(sobretiempo)::numeric, 1)               as sobretiempo_media,
    redondear_a_5(100.0 * avg(guardia))               as guardia_pct,
    round(avg(apoyo_lider)::numeric, 1)               as apoyo_lider_media
  from factores_semana_participante
  group by organizacion_id, semana
)
select * from agg
where respondientes >= minimo_para_reportar()
  and alcance_empresa(organizacion_id);

comment on view factores_empresa is
  'ESP-008 RF-008-15. Factores JD-R semanales por empresa (medias). Solo semanas con el mínimo de respondientes.';

create or replace view factores_empresa_segmento
with (security_invoker = off) as
with agg as (
  select
    f.organizacion_id, f.semana, s.tipo as tipo_segmento, s.segmento,
    count(*)                                          as respondientes,
    round(avg(f.horas_dia)::numeric, 1)               as horas_dia_media,
    round(avg(f.sueno)::numeric, 1)                   as sueno_media,
    round(avg(f.fin_de_semana)::numeric, 1)           as fin_de_semana_media,
    round(avg(f.sobretiempo)::numeric, 1)             as sobretiempo_media,
    redondear_a_5(100.0 * avg(f.guardia))             as guardia_pct,
    round(avg(f.apoyo_lider)::numeric, 1)             as apoyo_lider_media
  from factores_semana_participante f
  join segmento_participante s on s.participante_id = f.participante_id
  group by f.organizacion_id, f.semana, s.tipo, s.segmento
)
select * from agg
where respondientes >= minimo_para_reportar()
  and alcance_empresa(organizacion_id);

-- ---------------------------------------------------------------------------
-- 5. Participación semanal (RF-008-19) y uso del apoyo (RF-008-21)
-- ---------------------------------------------------------------------------

create or replace view participacion_empresa_semanal
with (security_invoker = off) as
with semanas as (
  select organizacion_id, semana, count(*) as respondieron_viernes
  from olbi_semana_participante
  group by organizacion_id, semana
),
seguimiento as (
  -- En seguimiento esa semana: inscritos antes del fin de la semana y que no
  -- hubieran salido (aproximación: estado actual; el histórico exacto no se
  -- guarda y no cambia la lectura).
  select o.id as organizacion_id, s.semana,
         count(p.id) filter (where p.inscrito_en < s.semana + 7 and p.estado = 'activo') as en_seguimiento
  from organizaciones o
  join semanas s on s.organizacion_id = o.id
  left join participantes p on p.organizacion_id = o.id
  group by o.id, s.semana
)
select
  s.organizacion_id, s.semana,
  g.en_seguimiento,
  s.respondieron_viernes,
  case when g.en_seguimiento > 0
       then redondear_a_5(100.0 * s.respondieron_viernes / g.en_seguimiento) end as tasa_respuesta_pct
from semanas s
join seguimiento g on g.organizacion_id = s.organizacion_id and g.semana = s.semana
where alcance_empresa(s.organizacion_id);

create or replace view apoyo_empresa_mensual
with (security_invoker = off) as
with agg as (
  select
    pa.organizacion_id,
    date_trunc('month', s.finalizada_en at time zone tz_estudio())::date as mes,
    count(*) as sesiones
  from sesiones_consulta s
  join derivaciones d on d.id = s.derivacion_id
  join participantes pa on pa.id = d.participante_id
  where s.finalizada_en is not null
  group by pa.organizacion_id, date_trunc('month', s.finalizada_en at time zone tz_estudio())
)
select organizacion_id, mes, redondear_a_5(sesiones) as sesiones_aprox
from agg
where sesiones >= minimo_para_reportar() / 2
  and alcance_empresa(organizacion_id);

comment on view apoyo_empresa_mensual is
  'ESP-008 RF-008-21. Sesiones de apoyo realizadas por mes, redondeadas a 5 y solo desde 5. Nunca quién.';

-- ---------------------------------------------------------------------------
-- 6. Baja por salida de la empresa (RF-008-20, RN-008-16)
-- ---------------------------------------------------------------------------

create or replace function dar_de_baja_participante(p_participante uuid, p_motivo text default 'salida_empresa')
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organizacion_id into v_org from participantes where id = p_participante;
  if v_org is null then
    raise exception 'participante no encontrado' using errcode = 'P0002';
  end if;
  if not (es_investigador() or v_org = empresa_del_admin()) then
    raise exception 'sin alcance sobre este participante' using errcode = '42501';
  end if;
  if p_motivo not in ('salida_empresa', 'fin_de_estudio') then
    raise exception 'motivo no valido' using errcode = 'P0001';
  end if;

  -- Solo cambia el seguimiento. Las respuestas se conservan (RN-001-03) y
  -- las derivaciones abiertas NO se cierran (RN-008-16): el psicólogo
  -- termina su caso aunque la persona ya no esté en la empresa.
  update participantes set estado = 'finalizado'
  where id = p_participante and estado in ('activo', 'detectado');

  insert into eventos (participante_id, tipo, metadata)
  values (p_participante, 'salida_seguimiento', jsonb_build_object('motivo', p_motivo, 'por', rol_actual()));
end $$;

grant execute on function dar_de_baja_participante(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Permisos: solo las vistas de cara al panel
-- ---------------------------------------------------------------------------

grant select on pulso_empresa, pulso_estudio, pulso_empresa_segmento,
                factores_empresa, factores_empresa_segmento,
                participacion_empresa_semanal, apoyo_empresa_mensual
  to authenticated;

revoke all on segmento_participante, olbi_semana_participante, factores_semana_participante
  from authenticated, anon;

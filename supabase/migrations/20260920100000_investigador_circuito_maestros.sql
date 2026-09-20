-- ESP-009 RF-009-10, RF-009-14, RF-009-15 — segunda entrega del panel del
-- investigador (Derivaciones, Auditoría, Empresas, Psicólogos, Resumen).
--
-- 1. citas_estudio: las citas sin `motivo` (es para el psicólogo, §9.4).
-- 2. circuito_apoyo gana el tramo «derivación → cita confirmada».
-- 3. umbrales_empresa: edición solo del investigador, con fecha de cambio.
-- 4. Salida ordenada de un psicólogo: desactivar reasignando sus casos.

-- ---------------------------------------------------------------------------
-- 1. Citas visibles para el investigador, sin el motivo escrito
-- ---------------------------------------------------------------------------
create or replace view citas_estudio as
select c.id, c.participante_id, p.codigo_anonimo, p.organizacion_id, c.derivacion_id, c.psicologo_id,
       c.propuesta_para, c.estado, c.cancelada_por, c.creada_en, c.actualizada_en
from citas c
join participantes p on p.id = c.participante_id
where es_investigador();

comment on view citas_estudio is
  'ESP-009 RF-009-10. Citas del estudio para el investigador: hecho y estado, nunca el motivo (§9.4).';

grant select on citas_estudio to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Circuito con el tramo de la cita (columnas nuevas al final)
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
),
cit as (
  select d.id as derivacion_id,
    (select min(e.ocurrido_en) from eventos e
      where e.participante_id = d.participante_id and e.tipo = 'cita_confirmada' and e.ocurrido_en >= d.abierta_en) as cita_confirmada_en
  from derivaciones d
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
  end as estado,
  cit.cita_confirmada_en,
  round(extract(epoch from (cit.cita_confirmada_en - d.abierta_en)) / 86400, 1)    as dias_a_cita,
  round(extract(epoch from (ses.primera_sesion_en - cit.cita_confirmada_en)) / 86400, 1) as dias_cita_a_sesion
from derivaciones d
join participantes p on p.id = d.participante_id
left join psicologos ps on ps.id = d.psicologo_id
left join det on det.derivacion_id = d.id
left join ses on ses.derivacion_id = d.id
left join inf on inf.derivacion_id = d.id
left join cit on cit.derivacion_id = d.id
where es_investigador();

-- ---------------------------------------------------------------------------
-- 3. Umbrales organizacionales editables por el investigador (RN-008-13)
-- ---------------------------------------------------------------------------
alter table umbrales_empresa add column if not exists actualizado_en timestamptz not null default now();

create or replace function actualizar_umbrales_empresa(p_dimension text, p_a_vigilar numeric, p_alto numeric, p_fuente text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  if p_a_vigilar < 1 or p_alto > 4 or p_alto <= p_a_vigilar then
    raise exception 'umbrales fuera de rango: 1.0 <= a vigilar < alto <= 4.0' using errcode = '22003';
  end if;
  update umbrales_empresa
     set a_vigilar = p_a_vigilar, alto = p_alto, fuente = coalesce(nullif(trim(p_fuente), ''), fuente), actualizado_en = now()
   where dimension = p_dimension;
  if not found then
    raise exception 'dimension desconocida' using errcode = 'P0002';
  end if;
end $$;

grant execute on function actualizar_umbrales_empresa(text, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Desactivar / reactivar psicólogo reasignando sus casos (ESP-008 §9.3)
-- ---------------------------------------------------------------------------
create or replace function desactivar_psicologo(p_psicologo uuid, p_destino uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare v_abiertas int; r record; n int := 0;
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  if not exists (select 1 from psicologos where id = p_psicologo) then
    raise exception 'psicologo no encontrado' using errcode = 'P0002';
  end if;
  select count(*) into v_abiertas from derivaciones where psicologo_id = p_psicologo and cerrada_en is null;
  if v_abiertas > 0 then
    if p_destino is null then
      raise exception 'tiene % casos abiertos: indica a quién reasignarlos', v_abiertas using errcode = 'P0001';
    end if;
    if p_destino = p_psicologo then
      raise exception 'el destino no puede ser el mismo psicologo' using errcode = 'P0001';
    end if;
    for r in select id from derivaciones where psicologo_id = p_psicologo and cerrada_en is null loop
      perform reasignar_derivacion(r.id, p_destino);
      n := n + 1;
    end loop;
  end if;
  update psicologos set activo = false where id = p_psicologo;
  return n;
end $$;

create or replace function reactivar_psicologo(p_psicologo uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  update psicologos set activo = true where id = p_psicologo;
end $$;

grant execute on function desactivar_psicologo(uuid, uuid) to authenticated;
grant execute on function reactivar_psicologo(uuid) to authenticated;

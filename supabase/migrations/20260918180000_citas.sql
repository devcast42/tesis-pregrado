-- Citas solicitadas por el participante — implementa ESP-004 RF-004-13 … RF-004-16.
--
-- Hasta ahora la sesión con el psicólogo solo nacía de una detección: el
-- sistema derivaba y el psicólogo abría la sala. Esto añade la otra puerta:
-- el participante pide una cita cuando quiere, esté o no detectado. Es una
-- garantía ética antes que una función (RN-004-11): quien participa en un
-- estudio sobre burnout tiene que poder pedir ayuda sin esperar a que un
-- modelo lo señale.
--
-- Cómo encaja con lo que ya existe:
--  · Una cita necesita una derivación abierta, porque la derivación es lo
--    que le da al psicólogo acceso a la identidad y a los OLBI (RN-006-02).
--    Si no la hay, se crea con `origen = 'solicitud'` y el psicólogo con
--    menos casos abiertos, igual que hace evaluar-olbi al detectar.
--  · La sala la sigue abriendo el psicólogo (crear-sesion) a la hora de la
--    cita; el participante entra desde su pestaña de apoyo como siempre.
--  · Al terminar la sesión, la cita pasa a `atendida` sola (trigger).

-- ---------------------------------------------------------------------------
-- 1. Origen de la derivación
-- ---------------------------------------------------------------------------

alter table derivaciones
  add column if not exists origen text not null default 'deteccion'
  check (origen in ('deteccion', 'solicitud'));

comment on column derivaciones.origen is
  'deteccion: la abrió el modelo/umbral. solicitud: la abrió el participante al pedir una cita (ESP-004 RF-004-13).';

alter type tipo_evento add value if not exists 'cita_solicitada';
alter type tipo_evento add value if not exists 'cita_confirmada';
alter type tipo_evento add value if not exists 'cita_cancelada';

-- ---------------------------------------------------------------------------
-- 2. Tabla
-- ---------------------------------------------------------------------------

create type estado_cita as enum ('solicitada', 'confirmada', 'cancelada', 'atendida');

create table citas (
  id               uuid primary key default gen_random_uuid(),
  participante_id  uuid not null references participantes(id),
  derivacion_id    uuid not null references derivaciones(id),
  psicologo_id     uuid not null references psicologos(id),
  propuesta_para   timestamptz not null,
  -- Opcional y corto. No es una nota clínica: es «para qué te gustaría
  -- hablar». Solo lo lee el psicólogo asignado.
  motivo           text check (motivo is null or char_length(motivo) <= 240),
  estado           estado_cita not null default 'solicitada',
  cancelada_por    text check (cancelada_por in ('participante', 'psicologo')),
  creada_en        timestamptz not null default now(),
  actualizada_en   timestamptz not null default now()
);

create index on citas (participante_id, creada_en desc);
create index on citas (psicologo_id, propuesta_para) where estado in ('solicitada', 'confirmada');

-- Una sola cita viva por participante: primero se resuelve o cancela.
create unique index cita_viva_unica
  on citas (participante_id)
  where estado in ('solicitada', 'confirmada');

alter table citas enable row level security;

create policy "participante lee sus citas"
  on citas for select
  using (participante_id = participante_actual());

create policy "psicologo lee las citas de sus casos"
  on citas for select
  using (psicologo_id = psicologo_actual());

-- Escrituras solo por función: la asignación del psicólogo y el evento
-- tienen que ocurrir juntos.

-- ---------------------------------------------------------------------------
-- 3. Solicitar (participante)
-- ---------------------------------------------------------------------------

create or replace function solicitar_cita(p_para timestamptz, p_motivo text default null)
returns citas
language plpgsql security definer set search_path = public as $$
declare
  v_participante uuid := participante_actual();
  v_estado       estado_participante;
  v_derivacion   uuid;
  v_psicologo    uuid;
  v_cita         citas;
begin
  if v_participante is null then
    raise exception 'solo un participante puede pedir cita' using errcode = '42501';
  end if;

  select estado into v_estado from participantes where id = v_participante;
  if v_estado not in ('activo', 'detectado') then
    raise exception 'el participante no esta en el estudio' using errcode = 'P0001';
  end if;

  if p_para < now() + interval '1 hour' then
    raise exception 'la cita debe ser al menos con una hora de anticipacion' using errcode = 'P0001';
  end if;

  if exists (select 1 from citas where participante_id = v_participante
             and estado in ('solicitada', 'confirmada')) then
    raise exception 'ya tienes una cita pendiente' using errcode = 'P0001';
  end if;

  -- Derivación abierta existente (detección previa) o una nueva por solicitud.
  select id, psicologo_id into v_derivacion, v_psicologo
  from derivaciones
  where participante_id = v_participante and cerrada_en is null;

  if v_derivacion is null then
    select p.id into v_psicologo
    from psicologos p
    left join derivaciones d on d.psicologo_id = p.id and d.cerrada_en is null
    where p.activo
    group by p.id
    order by count(d.id), p.creado_en
    limit 1;

    if v_psicologo is null then
      raise exception 'no hay psicologos disponibles' using errcode = 'P0001';
    end if;

    insert into derivaciones (participante_id, psicologo_id, origen)
    values (v_participante, v_psicologo, 'solicitud')
    returning id into v_derivacion;

    insert into eventos (participante_id, tipo, metadata)
    values (v_participante, 'derivacion_psicologo',
            jsonb_build_object('psicologo_id', v_psicologo, 'automatica', false, 'origen', 'solicitud'));
  end if;

  insert into citas (participante_id, derivacion_id, psicologo_id, propuesta_para, motivo)
  values (v_participante, v_derivacion, v_psicologo, p_para, nullif(btrim(p_motivo), ''))
  returning * into v_cita;

  insert into eventos (participante_id, tipo, metadata)
  values (v_participante, 'cita_solicitada',
          jsonb_build_object('cita_id', v_cita.id, 'propuesta_para', p_para));

  return v_cita;
end $$;

grant execute on function solicitar_cita(timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cancelar (cualquiera de los dos) y confirmar (psicólogo)
-- ---------------------------------------------------------------------------

create or replace function cancelar_cita(p_cita uuid)
returns citas
language plpgsql security definer set search_path = public as $$
declare
  v_cita  citas;
  v_quien text;
begin
  select * into v_cita from citas where id = p_cita;
  if v_cita.id is null then
    raise exception 'cita no encontrada' using errcode = 'P0002';
  end if;

  if v_cita.participante_id = participante_actual() then v_quien := 'participante';
  elsif v_cita.psicologo_id = psicologo_actual() then v_quien := 'psicologo';
  else raise exception 'sin acceso a esta cita' using errcode = '42501';
  end if;

  if v_cita.estado not in ('solicitada', 'confirmada') then
    raise exception 'la cita ya no esta pendiente' using errcode = 'P0001';
  end if;

  update citas
  set estado = 'cancelada', cancelada_por = v_quien, actualizada_en = now()
  where id = p_cita
  returning * into v_cita;

  insert into eventos (participante_id, tipo, metadata)
  values (v_cita.participante_id, 'cita_cancelada',
          jsonb_build_object('cita_id', p_cita, 'por', v_quien));

  return v_cita;
end $$;

create or replace function confirmar_cita(p_cita uuid)
returns citas
language plpgsql security definer set search_path = public as $$
declare
  v_cita citas;
begin
  update citas
  set estado = 'confirmada', actualizada_en = now()
  where id = p_cita
    and psicologo_id = psicologo_actual()
    and estado = 'solicitada'
  returning * into v_cita;

  if v_cita.id is null then
    raise exception 'cita no encontrada o ya resuelta' using errcode = 'P0002';
  end if;

  insert into eventos (participante_id, tipo, metadata)
  values (v_cita.participante_id, 'cita_confirmada', jsonb_build_object('cita_id', p_cita));

  return v_cita;
end $$;

grant execute on function cancelar_cita(uuid) to authenticated;
grant execute on function confirmar_cita(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Lo que el participante ve: sus citas con el nombre del profesional
--
-- `psicologos` no tiene política para participantes y no la necesita: el
-- nombre del profesional que lo atenderá es lo único que le interesa.
-- ---------------------------------------------------------------------------

create or replace function mis_citas()
returns table (
  id uuid, propuesta_para timestamptz, motivo text, estado estado_cita,
  cancelada_por text, creada_en timestamptz, psicologo text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.propuesta_para, c.motivo, c.estado, c.cancelada_por, c.creada_en, p.nombre
  from citas c
  join psicologos p on p.id = c.psicologo_id
  where c.participante_id = participante_actual()
  order by c.creada_en desc
$$;

grant execute on function mis_citas() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Al terminar la sesión, la cita queda atendida
-- ---------------------------------------------------------------------------

create or replace function cerrar_cita_al_finalizar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.finalizada_en is not null and old.finalizada_en is null then
    update citas
    set estado = 'atendida', actualizada_en = now()
    where derivacion_id = new.derivacion_id
      and estado in ('solicitada', 'confirmada')
      and propuesta_para <= new.finalizada_en + interval '1 day';
  end if;
  return new;
end $$;

drop trigger if exists cita_atendida on sesiones_consulta;
create trigger cita_atendida
  after update of finalizada_en on sesiones_consulta
  for each row execute function cerrar_cita_al_finalizar();

-- ---------------------------------------------------------------------------
-- 7. La ficha del psicólogo muestra la cita
-- ---------------------------------------------------------------------------

-- Se recrea (no `replace`): se añaden columnas en medio y Postgres solo
-- permite añadirlas al final.
drop view if exists casos_psicologo;
create view casos_psicologo
with (security_invoker = on) as
with ultima_sesion as (
  select distinct on (derivacion_id)
    derivacion_id, id as sesion_id, iniciada_en, finalizada_en,
    consentimiento_participante, consentimiento_psicologo
  from sesiones_consulta
  order by derivacion_id, iniciada_en desc
),
deteccion as (
  select d.id as derivacion_id, e.ocurrido_en, e.metadata
  from derivaciones d
  join lateral (
    select ocurrido_en, metadata from eventos e
    where e.id = d.evento_deteccion_id
       or (d.evento_deteccion_id is null and e.participante_id = d.participante_id
           and e.tipo = 'deteccion' and e.ocurrido_en <= d.abierta_en)
    order by ocurrido_en desc limit 1
  ) e on true
),
cita_viva as (
  select distinct on (derivacion_id)
    derivacion_id, id as cita_id, propuesta_para, motivo, estado as cita_estado
  from citas
  where estado in ('solicitada', 'confirmada')
  order by derivacion_id, propuesta_para
)
select
  d.id                          as derivacion_id,
  d.participante_id,
  d.origen,
  p.codigo_anonimo,
  o.nombre                      as empresa,
  d.abierta_en,
  d.cerrada_en,
  det.ocurrido_en               as detectado_en,
  det.metadata -> 'puntajes'    as puntajes,
  det.metadata -> 'umbrales'    as umbrales,
  s.sesion_id,
  s.iniciada_en                 as sesion_iniciada_en,
  s.finalizada_en               as sesion_finalizada_en,
  s.consentimiento_participante,
  s.consentimiento_psicologo,
  i.estado                      as informe_estado,
  c.cita_id,
  c.propuesta_para              as cita_para,
  c.motivo                      as cita_motivo,
  c.cita_estado,
  case
    when d.cerrada_en is not null                                   then 'cerrado'
    when i.estado = 'sin_revisar'                                   then 'informe_por_aprobar'
    when s.sesion_id is not null and s.finalizada_en is null        then 'sala_lista'
    when c.cita_estado = 'solicitada'                               then 'cita_por_confirmar'
    when c.cita_estado = 'confirmada'                               then 'cita_confirmada'
    else                                                                 'sesion_pendiente'
  end                           as estado_caso
from derivaciones d
join participantes p on p.id = d.participante_id
left join organizaciones o on o.id = p.organizacion_id
left join deteccion det on det.derivacion_id = d.id
left join ultima_sesion s on s.derivacion_id = d.id
left join informes i on i.sesion_id = s.sesion_id
left join cita_viva c on c.derivacion_id = d.id;

comment on table citas is
  'ESP-004 RF-004-13. Cita pedida por el participante. Siempre cuelga de una derivación: sin derivación el psicólogo no tiene acceso a la persona.';

-- Videoconsulta, transcripción e informe — implementa ESP-004.
--
-- Componente de apoyo posterior a la detección. Las reglas de seguridad
-- clínica de ESP-004 §5 no son recomendaciones: se imponen aquí con
-- restricciones y disparadores, no con convenciones.

-- ---------------------------------------------------------------------------
-- Sesión de consulta
-- ---------------------------------------------------------------------------

create table sesiones_consulta (
  id               uuid primary key default gen_random_uuid(),
  derivacion_id    uuid not null references derivaciones(id),

  -- RN-004-06: el consentimiento de grabación es POR SESIÓN, no heredado del
  -- consentimiento del estudio. Aceptar participar en una investigación no es
  -- aceptar que graben una sesión clínica.
  consentimiento_participante  boolean not null default false,
  consentimiento_psicologo     boolean not null default false,

  sala_livekit     text not null unique,
  iniciada_en      timestamptz not null default now(),
  finalizada_en    timestamptz
);

create index on sesiones_consulta (derivacion_id);

/** RF-004-02 y RF-004-03 — la grabación exige consentimiento de ambas partes.
 *  Lógica pura, consultable desde cualquier lado del sistema. */
create or replace function puede_grabarse(p_sesion_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select consentimiento_participante and consentimiento_psicologo
       from sesiones_consulta where id = p_sesion_id),
    false)
$$;

-- ---------------------------------------------------------------------------
-- Transcripción
-- ---------------------------------------------------------------------------

create type estado_transcripcion as enum ('pendiente', 'procesando', 'lista', 'fallida');

create table transcripciones (
  id                  uuid primary key default gen_random_uuid(),
  sesion_id           uuid not null unique references sesiones_consulta(id),
  estado              estado_transcripcion not null default 'pendiente',

  audio_ruta          text,
  texto               text,
  proveedor           text,

  creada_en           timestamptz not null default now(),
  generada_en         timestamptz,

  -- RN-004-09: datos sensibles de salud (Ley N.º 29733). El borrado tiene
  -- fecha desde que se crea la fila, no se decide después.
  borrar_despues_de   timestamptz not null,

  -- Solo una transcripción `lista` puede tener texto, y solo ella.
  constraint texto_solo_si_lista check (
    (estado = 'lista' and texto is not null) or
    (estado <> 'lista' and texto is null)
  )
);

-- ---------------------------------------------------------------------------
-- Informe de apoyo
-- ---------------------------------------------------------------------------

create type estado_informe as enum ('sin_revisar', 'aprobado', 'descartado');

create table informes (
  id                   uuid primary key default gen_random_uuid(),
  sesion_id            uuid not null unique references sesiones_consulta(id),
  transcripcion_id     uuid not null references transcripciones(id),

  -- RN-004-04: borrador y versión aprobada coexisten. Permite auditar cuánto
  -- corrigió el profesional, y lo protege si el borrador tenía un error.
  contenido_borrador   jsonb not null,
  contenido_aprobado   jsonb,

  -- RF-004-09: nace sin revisar. Nunca aprobado por defecto.
  estado               estado_informe not null default 'sin_revisar',

  modelo               text not null,
  generado_en          timestamptz not null default now(),
  aprobado_por         uuid references psicologos(id),
  aprobado_en          timestamptz,

  -- RN-004-02: no existe un informe aprobado sin persona que responda por él.
  constraint aprobacion_completa check (
    (estado = 'aprobado'
       and contenido_aprobado is not null
       and aprobado_por is not null
       and aprobado_en is not null)
    or estado <> 'aprobado'
  )
);

create index on informes (estado);

/** RN-004-04 — el borrador es inmutable. Sin esto, un informe corregido
 *  borraría la evidencia de qué generó el modelo, y la comparación entre
 *  ambos —el dato más interesante de este componente— se pierde. */
create or replace function proteger_borrador() returns trigger
language plpgsql as $$
begin
  if new.contenido_borrador is distinct from old.contenido_borrador then
    raise exception 'el contenido del borrador es inmutable (ESP-004 RN-004-04)';
  end if;
  return new;
end;
$$;

create trigger informes_borrador_inmutable
  before update on informes
  for each row execute function proteger_borrador();

/** RN-004-05 — sin transcripción completa no hay informe. Uno redactado
 *  desde media conversación puede omitir justo lo importante y parecer
 *  completo, que es peor que no tenerlo. */
create or replace function exigir_transcripcion_lista() returns trigger
language plpgsql as $$
begin
  if (select estado from transcripciones where id = new.transcripcion_id) <> 'lista' then
    raise exception 'no se genera informe sin transcripcion lista (ESP-004 RN-004-05)';
  end if;
  return new;
end;
$$;

create trigger informes_exigen_transcripcion
  before insert on informes
  for each row execute function exigir_transcripcion_lista();

-- ---------------------------------------------------------------------------
-- Retención — RN-004-09
-- ---------------------------------------------------------------------------

/** Borra audio y transcripción vencidos. El informe aprobado permanece: es el
 *  registro clínico, y ya pasó por revisión humana.
 *  Ejecutar a diario. */
create or replace function borrar_datos_vencidos() returns int
language plpgsql security definer set search_path = public as $$
declare
  afectadas int;
begin
  update transcripciones
     set texto = null,
         audio_ruta = null,
         estado = 'fallida'
   where borrar_despues_de < now()
     and (texto is not null or audio_ruta is not null);

  get diagnostics afectadas = row_count;
  return afectadas;
end;
$$;

comment on function borrar_datos_vencidos is
  'ESP-004 RN-004-09. Ejecutar a diario. El informe aprobado sobrevive al borrado.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table sesiones_consulta enable row level security;
alter table transcripciones   enable row level security;
alter table informes          enable row level security;

/** El psicólogo accede a una sesión solo mientras su derivación siga abierta. */
create or replace function consulta_accesible(p_sesion_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sesiones_consulta s
    join derivaciones d on d.id = s.derivacion_id
    where s.id = p_sesion_id
      and d.psicologo_id = psicologo_actual()
      and d.cerrada_en is null
  )
$$;

create policy "psicologo ve sus sesiones"
  on sesiones_consulta for select
  using (consulta_accesible(id));

create policy "psicologo registra consentimiento"
  on sesiones_consulta for update
  using (consulta_accesible(id))
  with check (consulta_accesible(id));

create policy "psicologo lee la transcripcion"
  on transcripciones for select
  using (consulta_accesible(sesion_id));

create policy "psicologo lee el informe"
  on informes for select
  using (consulta_accesible(sesion_id));

create policy "psicologo corrige y aprueba el informe"
  on informes for update
  using (consulta_accesible(sesion_id))
  with check (consulta_accesible(sesion_id));

-- RN-004-03: NINGUNA política da acceso al participante sobre `informes`.
-- Un texto sobre el estado psicológico de alguien, leído sin acompañamiento
-- profesional, puede hacer daño. La ausencia de política es deliberada.
--
-- RN-004-08: tampoco la hay para el investigador. El contenido clínico no es
-- dato de investigación; los indicadores de la tesis salen de `eventos`.
--
-- La generación de transcripciones e informes corre con service_role desde
-- las Edge Functions: ningún cliente los inserta.

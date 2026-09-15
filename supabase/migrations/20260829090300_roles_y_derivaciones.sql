-- Roles, derivaciones e identidades — implementa ESP-006.
--
-- Tres actores: participante (ya cubierto en 0001), psicólogo e investigador.
--
-- La idea central: el psicólogo accede POR DERIVACIÓN, no por organización
-- (RN-006-01). La diferencia es entre un psicólogo que ve a las tres personas
-- que atiende y uno que puede navegar los 100 participantes del estudio.

create type rol_sistema as enum ('participante', 'psicologo', 'investigador');

-- El rol vive en el servidor, nunca en metadatos editables del token
-- (RN-006-06): un rol autodeclarado por el cliente no es control de acceso.
create table usuarios_rol (
  auth_user_id  uuid primary key references auth.users(id),
  rol           rol_sistema not null,
  creado_en     timestamptz not null default now()
);

create table psicologos (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id),
  nombre        text not null,
  colegiatura   text not null,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Identidades — la única tabla con datos personales
--
-- Separada del esquema de investigación (RN-006-02). El anonimato protege el
-- dataset; la atención clínica exige identidad. Separar ambos ámbitos es lo
-- que hace defendible el diseño ante un comité de ética.
--
-- No se consulta directamente: se accede por obtener_identidad(), que verifica
-- derivación abierta y deja registro del acceso.
-- ---------------------------------------------------------------------------

create table identidades (
  participante_id  uuid primary key references participantes(id),
  nombre           text not null,
  correo_contacto  text not null,
  registrado_en    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Derivaciones — el mecanismo de acceso del psicólogo
-- ---------------------------------------------------------------------------

create table derivaciones (
  id                    uuid primary key default gen_random_uuid(),
  participante_id       uuid not null references participantes(id),
  psicologo_id          uuid not null references psicologos(id),
  evento_deteccion_id   bigint references eventos(id),
  abierta_en            timestamptz not null default now(),
  cerrada_en            timestamptz
);

create index on derivaciones (psicologo_id) where cerrada_en is null;
create index on derivaciones (participante_id);

-- Un participante no puede tener dos derivaciones abiertas a la vez.
create unique index derivacion_abierta_unica
  on derivaciones (participante_id)
  where cerrada_en is null;

-- ---------------------------------------------------------------------------
-- Funciones de autorización
-- ---------------------------------------------------------------------------

create or replace function rol_actual() returns rol_sistema
language sql stable security definer set search_path = public as $$
  select rol from usuarios_rol where auth_user_id = auth.uid()
$$;

create or replace function es_investigador() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() = 'investigador', false)
$$;

create or replace function psicologo_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select id from psicologos where auth_user_id = auth.uid() and activo
$$;

/** RF-006-02 y RF-006-06 — el acceso vive y muere con la derivación abierta. */
create or replace function tiene_derivacion_abierta(p_participante_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from derivaciones d
    where d.participante_id = p_participante_id
      and d.psicologo_id = psicologo_actual()
      and d.cerrada_en is null
  )
$$;

/** RF-006-12 y RN-006-03 — única puerta a los datos personales.
 *  Verifica la derivación y registra el acceso antes de devolver nada: si el
 *  comité pregunta quién vio los datos de quién y cuándo, la respuesta está
 *  en una consulta. */
create or replace function obtener_identidad(p_participante_id uuid)
returns table (nombre text, correo_contacto text)
language plpgsql security definer set search_path = public as $$
declare
  v_psicologo uuid := psicologo_actual();
begin
  if v_psicologo is null then
    raise exception 'solo un psicologo activo puede acceder a una identidad';
  end if;

  if not tiene_derivacion_abierta(p_participante_id) then
    raise exception 'sin derivacion abierta para este participante';
  end if;

  insert into eventos (participante_id, tipo, metadata)
  values (
    p_participante_id,
    'acceso_identidad',
    jsonb_build_object('psicologo_id', v_psicologo)
  );

  return query
    select i.nombre, i.correo_contacto
    from identidades i
    where i.participante_id = p_participante_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table usuarios_rol   enable row level security;
alter table psicologos     enable row level security;
alter table identidades    enable row level security;
alter table derivaciones   enable row level security;

-- `identidades` no recibe ninguna política de lectura: se accede solo por
-- obtener_identidad(). Sin políticas, RLS lo niega todo, que es el default
-- correcto para la única tabla con datos personales del sistema.

create policy "cada quien lee su rol"
  on usuarios_rol for select
  using (auth_user_id = auth.uid());

create policy "psicologo lee su ficha"
  on psicologos for select
  using (auth_user_id = auth.uid() or es_investigador());

create policy "psicologo lee sus derivaciones"
  on derivaciones for select
  using (psicologo_id = psicologo_actual() or es_investigador());

create policy "psicologo cierra sus derivaciones"
  on derivaciones for update
  using (psicologo_id = psicologo_actual())
  with check (psicologo_id = psicologo_actual());

-- La apertura de derivaciones queda en la service_role hasta que se decida
-- si es automática o revisada (ESP-006 §11, pendiente 2). El esquema soporta
-- ambas: solo cambia quién inserta la fila.

-- Acceso del psicólogo a los datos del participante derivado -----------------

create policy "psicologo ve participante derivado"
  on participantes for select
  using (tiene_derivacion_abierta(id));

-- RN-006-07: solo el OLBI. Horas de sueño y carga percibida son insumo del
-- modelo, no información clínica que el participante consintió compartir con
-- un terapeuta.
create policy "psicologo lee solo OLBI del derivado"
  on respuestas for select
  using (
    formulario_clave = 'olbi'
    and tiene_derivacion_abierta(participante_id)
  );

create policy "psicologo lee items del OLBI del derivado"
  on respuestas_items for select
  using (exists (
    select 1 from respuestas r
    where r.id = respuestas_items.respuesta_id
      and r.formulario_clave = 'olbi'
      and tiene_derivacion_abierta(r.participante_id)
  ));

create policy "psicologo ve eventos del derivado"
  on eventos for select
  using (tiene_derivacion_abierta(participante_id));

-- Acceso del investigador — anonimizado por construcción ---------------------
--
-- RN-006-04: `participantes` no contiene ningún campo identificable; los datos
-- personales viven solo en `identidades`, que no tiene política de lectura.
-- El investigador ve todo el dataset sin ver a nadie.

create policy "investigador lee participantes"
  on participantes for select using (es_investigador());

create policy "investigador lee organizaciones"
  on organizaciones for select using (es_investigador());

create policy "investigador lee respuestas"
  on respuestas for select using (es_investigador());

create policy "investigador lee items"
  on respuestas_items for select using (es_investigador());

create policy "investigador lee eventos"
  on eventos for select using (es_investigador());

create policy "investigador lee consentimientos"
  on consentimientos for select using (es_investigador());

-- RN-006-05: ningún rol inserta eventos de deteccion desde el cliente. No se
-- crea ninguna política de INSERT sobre `eventos` para psicólogo o
-- investigador; solo la service_role los escribe, vía ESP-003.

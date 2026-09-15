-- Esquema inicial — Detección temprana de Burnout
--
-- Principios (ver docs/requisitos-y-arquitectura.md §4.1):
--   1. Respuestas ítem por ítem, nunca solo el puntaje agregado
--   2. Tablas append-only: nunca se sobrescribe una respuesta
--   3. Eventos de proceso registrados, para el indicador de tiempo de detección

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizaciones y participantes
-- ---------------------------------------------------------------------------

create table organizaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  creado_en   timestamptz not null default now()
);

create type estado_participante as enum ('activo', 'detectado', 'retirado', 'finalizado');

create table participantes (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id),
  auth_user_id      uuid unique references auth.users(id),

  -- Anonimización por código (Consideraciones Éticas de la tesis).
  -- Ningún dato identificable vive en esta tabla.
  codigo_anonimo    text not null unique,

  estado            estado_participante not null default 'activo',
  inscrito_en       timestamptz not null default now()
);

create index on participantes (organizacion_id);

-- ---------------------------------------------------------------------------
-- Consentimiento informado — append-only, versionado
-- ---------------------------------------------------------------------------

create table consentimientos (
  id                uuid primary key default gen_random_uuid(),
  participante_id   uuid not null references participantes(id),
  version_texto     text not null,   -- qué versión del texto aceptó
  aceptado          boolean not null,
  registrado_en     timestamptz not null default now()
);

create index on consentimientos (participante_id, registrado_en desc);

-- ---------------------------------------------------------------------------
-- Formularios y respuestas
--
-- Un solo modelo genérico para los cuatro instrumentos (estable, diario,
-- semanal, OLBI). El versionado es obligatorio: si un ítem cambia a mitad
-- del estudio longitudinal, hay que poder saber qué versión respondió cada
-- participante, o los datos dejan de ser comparables.
-- ---------------------------------------------------------------------------

create table formularios (
  clave         text not null,       -- 'estable' | 'diario' | 'semanal' | 'olbi'
  version       int  not null,
  definicion    jsonb not null,      -- ítems, etiquetas, escalas
  vigente_desde timestamptz not null default now(),
  primary key (clave, version)
);

create table respuestas (
  id                  uuid primary key default gen_random_uuid(),
  participante_id     uuid not null references participantes(id),
  formulario_clave    text not null,
  formulario_version  int  not null,

  -- Los dos timestamps que alimentan el indicador de tiempo de detección
  iniciado_en         timestamptz not null,
  enviado_en          timestamptz not null default now(),

  foreign key (formulario_clave, formulario_version)
    references formularios(clave, version)
);

create index on respuestas (participante_id, formulario_clave, enviado_en desc);

-- Ítem por ítem. El puntaje agregado NO se almacena: se recalcula siempre
-- desde aquí, para que un cambio de umbral o de fórmula no requiera
-- recolectar de nuevo.
create table respuestas_items (
  id            bigserial primary key,
  respuesta_id  uuid not null references respuestas(id),
  item_clave    text not null,
  valor_num     numeric,
  valor_texto   text,
  unique (respuesta_id, item_clave)
);

-- ---------------------------------------------------------------------------
-- Eventos de proceso — append-only
--
-- Fuente de verdad de los indicadores 2 y 3 de la tesis:
--   volumen evaluado  = conteo de eventos por unidad de tiempo
--   tiempo detección  = deteccion.ocurrido_en - inicio_seguimiento.ocurrido_en
-- ---------------------------------------------------------------------------

create type tipo_evento as enum (
  'inicio_seguimiento',
  'evaluacion_iniciada',
  'evaluacion_enviada',
  'deteccion',
  'derivacion_psicologo',
  'sesion_realizada',
  'salida_seguimiento',
  'alerta_adherencia',        -- ESP-007
  'acceso_identidad',         -- ESP-006 RN-006-03
  'sesion_iniciada',          -- ESP-004
  'transcripcion_lista',      -- ESP-004
  'informe_generado',         -- ESP-004
  'informe_aprobado'          -- ESP-004
);

create table eventos (
  id                bigserial primary key,
  participante_id   uuid not null references participantes(id),
  tipo              tipo_evento not null,
  ocurrido_en       timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb
);

create index on eventos (participante_id, tipo, ocurrido_en);
create index on eventos (tipo, ocurrido_en);

-- ---------------------------------------------------------------------------
-- Row Level Security — aislamiento estricto entre organizaciones
-- ---------------------------------------------------------------------------

alter table organizaciones    enable row level security;
alter table participantes     enable row level security;
alter table consentimientos   enable row level security;
alter table respuestas        enable row level security;
alter table respuestas_items  enable row level security;
alter table eventos           enable row level security;

-- Participante autenticado -> su propia fila
create or replace function participante_actual()
returns uuid language sql stable security definer as $$
  select id from participantes where auth_user_id = auth.uid()
$$;

create policy "participante ve su ficha"
  on participantes for select
  using (auth_user_id = auth.uid());

create policy "participante lee su consentimiento"
  on consentimientos for select
  using (participante_id = participante_actual());

create policy "participante registra su consentimiento"
  on consentimientos for insert
  with check (participante_id = participante_actual());

create policy "participante lee sus respuestas"
  on respuestas for select
  using (participante_id = participante_actual());

create policy "participante envia respuestas"
  on respuestas for insert
  with check (participante_id = participante_actual());

create policy "participante lee sus items"
  on respuestas_items for select
  using (exists (
    select 1 from respuestas r
    where r.id = respuestas_items.respuesta_id
      and r.participante_id = participante_actual()
  ));

create policy "participante envia items"
  on respuestas_items for insert
  with check (exists (
    select 1 from respuestas r
    where r.id = respuestas_items.respuesta_id
      and r.participante_id = participante_actual()
  ));

create policy "participante lee sus eventos"
  on eventos for select
  using (participante_id = participante_actual());

-- El participante registra el inicio y envío de sus evaluaciones (de ahí sale
-- el indicador de tiempo). Los eventos de deteccion y derivacion quedan
-- reservados a la service_role: un cliente nunca puede declararse detectado.
create policy "participante registra eventos de evaluacion"
  on eventos for insert
  with check (
    participante_id = participante_actual()
    and tipo in ('evaluacion_iniciada', 'evaluacion_enviada')
  );

-- Definiciones de formulario: lectura para participantes autenticados.
alter table formularios enable row level security;

create policy "formularios legibles por autenticados"
  on formularios for select
  to authenticated
  using (true);

-- Sin políticas de UPDATE ni DELETE: las tablas son append-only por diseño.
-- Correcciones y borrados se hacen con la service_role, dejando rastro.

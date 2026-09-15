-- Ficha del administrador de empresa — ESP-008.
--
-- Paralela a `psicologos`: el rol vive en `usuarios_rol`, los datos de la
-- persona viven aquí. Sin nombre, la lista de admins de una empresa sería
-- una lista de correos.

create table if not exists administradores (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid not null unique references auth.users(id),
  organizacion_id  uuid not null references organizaciones(id),
  nombre           text not null,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

create index if not exists administradores_organizacion
  on administradores (organizacion_id);

alter table administradores enable row level security;

create policy "admin ve su ficha y la de su empresa"
  on administradores for select
  using (auth_user_id = auth.uid() or organizacion_id = empresa_del_admin());

create policy "investigador ve administradores"
  on administradores for select
  using (es_investigador());

-- Alta y baja pasan por Edge Functions con service_role: crear un admin
-- implica crear una cuenta, y eso no lo hace un cliente.

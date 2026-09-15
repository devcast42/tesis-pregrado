-- Administrador de empresa — implementa ESP-008.
--
-- El admin es personal de la empresa participante. Gestiona cuentas de su
-- propia organización y ve participación, nunca salud.
--
-- La frontera es esa: "Juan lleva 4 días sin responder" es logística;
-- "Juan salió con indicadores de burnout" es un dato clínico que el
-- consentimiento promete que la empresa no verá.

-- ---------------------------------------------------------------------------
-- El rol se ata a una empresa
-- ---------------------------------------------------------------------------

alter table usuarios_rol
  add column if not exists organizacion_id uuid references organizaciones(id);

-- Solo el admin pertenece a una empresa. Investigador, psicólogo y
-- participante no: su alcance sale de otras tablas.
alter table usuarios_rol
  drop constraint if exists admin_pertenece_a_empresa;
alter table usuarios_rol
  add constraint admin_pertenece_a_empresa
  check ((rol = 'admin') = (organizacion_id is not null));

create index if not exists usuarios_rol_organizacion on usuarios_rol (organizacion_id);

-- ---------------------------------------------------------------------------
-- Funciones de alcance
-- ---------------------------------------------------------------------------

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() = 'admin', false)
$$;

/** Empresa del admin autenticado. NULL si no es admin: usada dentro de una
 *  política, un NULL no deja pasar ninguna fila. */
create or replace function empresa_del_admin() returns uuid
language sql stable security definer set search_path = public as $$
  select organizacion_id from usuarios_rol
   where auth_user_id = auth.uid() and rol = 'admin'
$$;

-- ---------------------------------------------------------------------------
-- RLS del admin
--
-- Ninguna política le da acceso a respuestas, puntajes, eventos, derivaciones,
-- sesiones ni informes. Esa ausencia es deliberada y es la que sostiene la
-- promesa del consentimiento.
-- ---------------------------------------------------------------------------

drop policy if exists "admin ve su empresa" on organizaciones;
create policy "admin ve su empresa"
  on organizaciones for select
  using (id = empresa_del_admin());

drop policy if exists "admin ve participantes de su empresa" on participantes;
create policy "admin ve participantes de su empresa"
  on participantes for select
  using (organizacion_id = empresa_del_admin());

-- El admin gestiona cuentas, y gestionar cuentas sin nombres es inservible.
-- Además él mismo inscribió a estas personas: son sus compañeros de trabajo,
-- no le estamos revelando una identidad que no tuviera.
--
-- A diferencia del psicólogo, este acceso NO se registra uno por uno: es
-- administración rutinaria, no una revelación excepcional dentro de un
-- proceso clínico (ESP-006 RN-006-03 cubre ese otro caso).
drop policy if exists "admin ve identidades de su empresa" on identidades;
create policy "admin ve identidades de su empresa"
  on identidades for select
  using (exists (
    select 1 from participantes p
    where p.id = identidades.participante_id
      and p.organizacion_id = empresa_del_admin()
  ));

drop policy if exists "admin ve consentimientos de su empresa" on consentimientos;
create policy "admin ve consentimientos de su empresa"
  on consentimientos for select
  using (exists (
    select 1 from participantes p
    where p.id = consentimientos.participante_id
      and p.organizacion_id = empresa_del_admin()
  ));

drop policy if exists "admin ve roles de su empresa" on usuarios_rol;
create policy "admin ve roles de su empresa"
  on usuarios_rol for select
  using (organizacion_id = empresa_del_admin());

-- El investigador ve y crea empresas
drop policy if exists "investigador administra empresas" on organizaciones;
create policy "investigador administra empresas"
  on organizaciones for all
  using (es_investigador())
  with check (es_investigador());

drop policy if exists "investigador ve roles" on usuarios_rol;
create policy "investigador ve roles"
  on usuarios_rol for select
  using (es_investigador());

drop policy if exists "investigador ve psicologos" on psicologos;
create policy "investigador ve psicologos"
  on psicologos for select
  using (es_investigador());

-- =============================================================================
-- SEED DE PRUEBA — Una cuenta por cada rol del sistema
-- =============================================================================
--
-- INSTRUCCIONES
-- =============
--
--  1. Crea los siguientes usuarios en el panel de Supabase:
--     Authentication → Users → Add user
--     Marca "Auto Confirm User" en cada uno para no depender del correo.
--
--     Correo                                     | Contraseña
--     -------------------------------------------|------------
--     test+investigador@tesis.local              | Test1234!
--     test+psicologo@tesis.local                 | Test1234!
--     test+admin@tesis.local                     | Test1234!
--     test+trabajador@tesis.local              | Test1234!
--
--  2. Ejecuta este script:
--     npx supabase db query --linked --file supabase/seed_testing.sql
--
-- =============================================================================

do $$
declare
  -- Correos de las cuentas de prueba
  correo_investigador  constant text := 'test+investigador@tesis.local';
  correo_psicologo     constant text := 'test+psicologo@tesis.local';
  correo_admin         constant text := 'test+admin@tesis.local';
  correo_trabajador  constant text := 'test+trabajador@tesis.local';

  -- IDs resueltos desde auth.users
  id_investigador  uuid;
  id_psicologo     uuid;
  id_admin         uuid;
  id_trabajador  uuid;

  -- IDs de entidades secundarias
  id_organizacion     uuid;
  id_trabajador_row uuid;

begin

  -- -------------------------------------------------------------------------
  -- 0. Resolver los UUIDs de Auth
  -- -------------------------------------------------------------------------

  select id into id_investigador from auth.users
   where lower(email) = lower(correo_investigador);

  select id into id_psicologo from auth.users
   where lower(email) = lower(correo_psicologo);

  select id into id_admin from auth.users
   where lower(email) = lower(correo_admin);

  select id into id_trabajador from auth.users
   where lower(email) = lower(correo_trabajador);

  -- Validar que todos existen antes de insertar nada
  if id_investigador is null then
    raise exception 'Falta el usuario %. Crealo en Authentication > Users.', correo_investigador;
  end if;
  if id_psicologo is null then
    raise exception 'Falta el usuario %. Crealo en Authentication > Users.', correo_psicologo;
  end if;
  if id_admin is null then
    raise exception 'Falta el usuario %. Crealo en Authentication > Users.', correo_admin;
  end if;
  if id_trabajador is null then
    raise exception 'Falta el usuario %. Crealo en Authentication > Users.', correo_trabajador;
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Empresa de prueba (necesaria para el admin y el trabajador)
  -- -------------------------------------------------------------------------

  select id into id_organizacion
    from organizaciones
   where nombre = 'Empresa de Prueba';

  if id_organizacion is null then
    insert into organizaciones (nombre)
    values ('Empresa de Prueba')
    returning id into id_organizacion;
    raise notice 'Empresa de Prueba creada: %', id_organizacion;
  else
    raise notice 'Empresa de Prueba ya existia: %', id_organizacion;
  end if;

  -- -------------------------------------------------------------------------
  -- 2. ROL: investigador
  -- -------------------------------------------------------------------------

  insert into usuarios_rol (auth_user_id, rol)
  values (id_investigador, 'investigador')
  on conflict (auth_user_id) do update set rol = 'investigador';

  raise notice 'Investigador listo   -> %', correo_investigador;

  -- -------------------------------------------------------------------------
  -- 3. ROL: psicologo
  -- -------------------------------------------------------------------------

  insert into usuarios_rol (auth_user_id, rol)
  values (id_psicologo, 'psicologo')
  on conflict (auth_user_id) do update set rol = 'psicologo';

  insert into psicologos (auth_user_id, nombre, colegiatura)
  values (id_psicologo, 'Psicologo Test', 'CPsP-TEST-01')
  on conflict (auth_user_id) do nothing;

  raise notice 'Psicologo listo      -> %', correo_psicologo;

  -- -------------------------------------------------------------------------
  -- 4. ROL: admin (de empresa)
  -- -------------------------------------------------------------------------

  insert into usuarios_rol (auth_user_id, rol, organizacion_id)
  values (id_admin, 'admin', id_organizacion)
  on conflict (auth_user_id) do update
    set rol = 'admin', organizacion_id = id_organizacion;

  insert into administradores (auth_user_id, organizacion_id, nombre)
  values (id_admin, id_organizacion, 'Admin Test')
  on conflict (auth_user_id) do nothing;

  raise notice 'Admin listo          -> %', correo_admin;

  -- -------------------------------------------------------------------------
  -- 5. ROL: trabajador
  -- -------------------------------------------------------------------------

  -- La fila en `trabajadores` es anonima por diseno: el codigo es el
  -- identificador, no el correo.
  insert into trabajadores (organizacion_id, auth_user_id, codigo_anonimo)
  values (id_organizacion, id_trabajador, 'TEST-P-001')
  on conflict (auth_user_id) do nothing
  returning id into id_trabajador_row;

  -- Si ya existia, recuperar el id
  if id_trabajador_row is null then
    select id into id_trabajador_row
      from trabajadores
     where auth_user_id = id_trabajador;
  end if;

  -- La identidad va en su tabla separada (ESP-006 / RN-006-02)
  insert into identidades (trabajador_id, nombre, correo_contacto)
  values (id_trabajador_row, 'Trabajador Test', correo_trabajador)
  on conflict (trabajador_id) do nothing;

  -- El trabajador no tiene fila en usuarios_rol: su rol se determina
  -- porque existe en `trabajadores` con auth_user_id (no en usuarios_rol).
  -- En la app, el check es: si trabajador_actual() no es null -> es trabajador.

  -- Evento de inicio de seguimiento (indicadores de proceso)
  insert into eventos (trabajador_id, tipo)
  values (id_trabajador_row, 'inicio_seguimiento');

  raise notice 'Trabajador listo   -> % (codigo: TEST-P-001)', correo_trabajador;

end $$;

-- Verificacion final
select
  'investigador' as rol,
  (select count(*) from usuarios_rol where rol = 'investigador') as total
union all
select
  'psicologo',
  (select count(*) from psicologos where activo)
union all
select
  'admin',
  (select count(*) from administradores where activo)
union all
select
  'trabajador',
  (select count(*) from trabajadores);

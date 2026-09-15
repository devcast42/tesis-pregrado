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
--     test+participante@tesis.local              | Test1234!
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
  correo_participante  constant text := 'test+participante@tesis.local';

  -- IDs resueltos desde auth.users
  id_investigador  uuid;
  id_psicologo     uuid;
  id_admin         uuid;
  id_participante  uuid;

  -- IDs de entidades secundarias
  id_organizacion     uuid;
  id_participante_row uuid;

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

  select id into id_participante from auth.users
   where lower(email) = lower(correo_participante);

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
  if id_participante is null then
    raise exception 'Falta el usuario %. Crealo en Authentication > Users.', correo_participante;
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Empresa de prueba (necesaria para el admin y el participante)
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
  -- 5. ROL: participante
  -- -------------------------------------------------------------------------

  -- La fila en `participantes` es anonima por diseno: el codigo es el
  -- identificador, no el correo.
  insert into participantes (organizacion_id, auth_user_id, codigo_anonimo)
  values (id_organizacion, id_participante, 'TEST-P-001')
  on conflict (auth_user_id) do nothing
  returning id into id_participante_row;

  -- Si ya existia, recuperar el id
  if id_participante_row is null then
    select id into id_participante_row
      from participantes
     where auth_user_id = id_participante;
  end if;

  -- La identidad va en su tabla separada (ESP-006 / RN-006-02)
  insert into identidades (participante_id, nombre, correo_contacto)
  values (id_participante_row, 'Participante Test', correo_participante)
  on conflict (participante_id) do nothing;

  -- El participante no tiene fila en usuarios_rol: su rol se determina
  -- porque existe en `participantes` con auth_user_id (no en usuarios_rol).
  -- En la app, el check es: si participante_actual() no es null -> es participante.

  -- Evento de inicio de seguimiento (indicadores de proceso)
  insert into eventos (participante_id, tipo)
  values (id_participante_row, 'inicio_seguimiento');

  raise notice 'Participante listo   -> % (codigo: TEST-P-001)', correo_participante;

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
  'participante',
  (select count(*) from participantes);

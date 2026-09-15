-- Siembra inicial — se corre UNA VEZ, después de `db push`.
--
-- La inscripción del estudio es cerrada (ESP-001 §3): nadie se registra solo,
-- ni siquiera el equipo de investigación. Este archivo crea el primer
-- investigador y la primera empresa, que es lo mínimo para poder entrar al
-- panel e inscribir participantes desde ahí.
--
-- ANTES DE CORRERLO
--   1. Crea tu usuario en el panel de Supabase:
--      Authentication → Users → Add user → Create new user
--      Marca "Auto Confirm User" para no depender del correo.
--   2. Edita los tres valores de abajo.
--
--   npx supabase db query --linked --file supabase/bootstrap.sql

do $$
declare
  -- ⚠️ EDITAR ESTOS TRES VALORES
  correo_investigador constant text := 'ducz.daca@icloud.com';
  nombre_empresa      constant text := 'Empresa Piloto';
  -- Psicólogo de prueba: dejar el correo vacío ('') para no crearlo todavía.
  correo_psicologo    constant text := 'ducz.daca+psi@icloud.com';
  nombre_psicologo    constant text := 'Psicólogo de prueba';
  colegiatura         constant text := 'CPsP-00000';

  id_investigador uuid;
  id_psicologo    uuid;
  id_organizacion uuid;
begin
  -- 1. Investigador
  select id into id_investigador from auth.users
   where lower(email) = lower(correo_investigador);

  if id_investigador is null then
    raise exception
      'No existe un usuario con el correo %. Créalo primero en Authentication → Users.',
      correo_investigador;
  end if;

  insert into usuarios_rol (auth_user_id, rol)
  values (id_investigador, 'investigador')
  on conflict (auth_user_id) do update set rol = 'investigador';

  raise notice 'Investigador listo: %', correo_investigador;

  -- 2. Primera empresa. Sin al menos una, la pantalla de inscripción
  --    no tiene dónde poner a nadie.
  select id into id_organizacion from organizaciones where nombre = nombre_empresa;

  if id_organizacion is null then
    insert into organizaciones (nombre) values (nombre_empresa)
    returning id into id_organizacion;
    raise notice 'Empresa creada: %', nombre_empresa;
  else
    raise notice 'La empresa ya existía: %', nombre_empresa;
  end if;

  -- 3. Psicólogo (opcional). Sin ninguno activo, una detección no puede
  --    derivarse a nadie y el caso queda sin asignar.
  if correo_psicologo <> '' then
    select id into id_psicologo from auth.users
     where lower(email) = lower(correo_psicologo);

    if id_psicologo is null then
      raise exception
        'No existe un usuario con el correo %. Créalo primero en Authentication → Users.',
        correo_psicologo;
    end if;

    insert into usuarios_rol (auth_user_id, rol)
    values (id_psicologo, 'psicologo')
    on conflict (auth_user_id) do update set rol = 'psicologo';

    insert into psicologos (auth_user_id, nombre, colegiatura)
    values (id_psicologo, nombre_psicologo, colegiatura)
    on conflict (auth_user_id) do nothing;

    raise notice 'Psicólogo listo: %', correo_psicologo;
  else
    raise notice 'Sin psicólogo. Las detecciones quedarán sin derivar hasta que crees uno.';
  end if;
end $$;

-- Resultado
select
  (select count(*) from usuarios_rol where rol = 'investigador') as investigadores,
  (select count(*) from psicologos where activo)                 as psicologos_activos,
  (select count(*) from organizaciones)                          as empresas,
  (select count(*) from participantes)                           as participantes;

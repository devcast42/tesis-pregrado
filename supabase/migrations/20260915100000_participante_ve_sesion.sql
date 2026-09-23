-- El participante ve su propia sesión de apoyo — ESP-004 RF-004-02.
--
-- Hasta ahora solo el psicólogo tenía política de lectura sobre
-- `sesiones_consulta`. La pantalla del participante llamaba a obtenerSesion()
-- y RLS le devolvía nada: nunca se había probado porque el componente de
-- videoconsulta está sin desplegar. Para ofrecerle la sesión en su pantalla
-- principal necesita leerla, y para consentir la grabación, actualizarla.
--
-- Lo que NO se abre: `derivaciones`. El participante sabe que tiene una sesión
-- disponible —lo dice el consentimiento que aceptó— pero no lee la derivación,
-- ni el evento de detección, ni ningún puntaje (RN-004-03).

create or replace function sesion_propia(p_sesion_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sesiones_consulta s
    join derivaciones d on d.id = s.derivacion_id
    where s.id = p_sesion_id
      and d.participante_id = participante_actual()
  )
$$;

comment on function sesion_propia is
  'ESP-004. Definer a propósito: el participante no tiene lectura sobre
   derivaciones y no debe tenerla; solo necesita saber si esta sesión es suya.';

drop policy if exists "participante ve su sesion" on sesiones_consulta;
create policy "participante ve su sesion"
  on sesiones_consulta for select
  using (sesion_propia(id));

-- Solo puede tocar su propio consentimiento de grabación. El resto de columnas
-- las protege el trigger del psicólogo y el hecho de que el cliente no
-- tiene forma de escribirlas sin pasar por aquí.
drop policy if exists "participante consiente su grabacion" on sesiones_consulta;
create policy "participante consiente su grabacion"
  on sesiones_consulta for update
  using (sesion_propia(id))
  with check (sesion_propia(id));

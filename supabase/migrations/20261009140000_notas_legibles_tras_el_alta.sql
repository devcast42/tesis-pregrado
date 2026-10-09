-- El psicólogo puede leer sus notas de un caso cerrado.
--
-- `consulta_accesible` exige derivación abierta, y era la regla tanto para
-- leer como para corregir sesiones, notas y transcripciones. En esta rama el
-- psicólogo conserva la historia de sus casos tras el alta
-- (20261003110000_seguimiento_e_historia): su historia decía «1 informe» y,
-- al abrirlo, la nota salía en blanco. Un profesional tiene que poder releer
-- lo que firmó.
--
-- Leer: sus derivaciones, abiertas o cerradas (`consulta_legible`).
-- Corregir y aprobar: solo con el caso abierto (`consulta_accesible`, igual).

create or replace function consulta_legible(p_sesion_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from sesiones_consulta s
      join derivaciones d on d.id = s.derivacion_id
     where s.id = p_sesion_id
       and d.psicologo_id = psicologo_actual()
  )
$$;

revoke all on function consulta_legible(uuid) from public, anon;
grant execute on function consulta_legible(uuid) to authenticated;

drop policy if exists "psicologo lee el informe" on informes;
create policy "psicologo lee el informe" on informes
  for select to authenticated using (consulta_legible(sesion_id));

drop policy if exists "psicologo ve sus sesiones" on sesiones_consulta;
create policy "psicologo ve sus sesiones" on sesiones_consulta
  for select to authenticated using (consulta_legible(id));

drop policy if exists "psicologo lee la transcripcion" on transcripciones;
create policy "psicologo lee la transcripcion" on transcripciones
  for select to authenticated using (consulta_legible(sesion_id));

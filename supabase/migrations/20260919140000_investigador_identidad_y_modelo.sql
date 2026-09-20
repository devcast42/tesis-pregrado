-- Investigador: identidad registrada y lectura del modelo — ESP-009 RF-009-09, RF-009-11.
--
-- 1. `obtener_identidad` solo admitía al psicólogo con derivación abierta.
--    ESP-006 RF-006-12 ya preveía que el investigador accede «solo mediante
--    una acción explícita y registrada»: se abre esa puerta, con el mismo
--    evento `acceso_identidad` y `por = 'investigador'` en el metadata, para
--    que la auditoría lo muestre igual que a un psicólogo (RN-009-02).
-- 2. `modelo_versiones` no tenía políticas: solo la leían funciones definer.
--    El panel lista versiones y activa una por tarea; el investigador lee
--    todo y solo puede cambiar `activa` y `visible_para` (un trigger impide
--    tocar pesos o métricas desde el cliente).

create or replace function obtener_identidad(p_participante_id uuid)
returns table (nombre text, correo_contacto text)
language plpgsql security definer set search_path = public as $$
declare
  v_psicologo uuid := psicologo_actual();
  v_investigador boolean := es_investigador();
begin
  if v_psicologo is null and not v_investigador then
    raise exception 'solo un psicologo activo o el investigador pueden acceder a una identidad';
  end if;

  if v_psicologo is not null and not tiene_derivacion_abierta(p_participante_id) then
    raise exception 'sin derivacion abierta para este participante';
  end if;

  insert into eventos (participante_id, tipo, metadata)
  values (
    p_participante_id,
    'acceso_identidad',
    case when v_psicologo is not null
         then jsonb_build_object('psicologo_id', v_psicologo, 'por', 'psicologo')
         else jsonb_build_object('auth_user_id', auth.uid(), 'por', 'investigador') end
  );

  return query
    select i.nombre, i.correo_contacto
    from identidades i
    where i.participante_id = p_participante_id;
end;
$$;

drop policy if exists "investigador lee versiones del modelo" on modelo_versiones;
create policy "investigador lee versiones del modelo"
  on modelo_versiones for select
  using (es_investigador());

drop policy if exists "investigador activa versiones del modelo" on modelo_versiones;
create policy "investigador activa versiones del modelo"
  on modelo_versiones for update
  using (es_investigador())
  with check (es_investigador());

create or replace function solo_activa_y_visibilidad() returns trigger
language plpgsql as $$
begin
  if es_investigador() and (
       new.pesos is distinct from old.pesos or new.medias is distinct from old.medias
    or new.desviaciones is distinct from old.desviaciones or new.intercepto is distinct from old.intercepto
    or new.rasgos is distinct from old.rasgos or new.metricas is distinct from old.metricas
    or new.umbral_decision is distinct from old.umbral_decision or new.version is distinct from old.version
    or new.tarea is distinct from old.tarea or new.origen is distinct from old.origen) then
    raise exception 'desde el panel solo se cambia activa y visible_para (ESP-005)';
  end if;
  return new;
end $$;

drop trigger if exists modelo_versiones_solo_activa on modelo_versiones;
create trigger modelo_versiones_solo_activa
  before update on modelo_versiones
  for each row execute function solo_activa_y_visibilidad();

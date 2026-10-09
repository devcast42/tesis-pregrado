-- Psicólogos de empresa y psicólogos generales.
--
-- Hasta ahora todos los psicólogos los creaba el investigador y atendían a
-- cualquier empresa. Ahora el administrador puede dar de alta los suyos:
--
--   organizacion_id nulo   psicólogo general (lo crea el investigador),
--                          atiende a todas las empresas.
--   organizacion_id = X    psicólogo de la empresa X (lo crea su admin),
--                          solo atiende a personas de X.
--
-- La elección vivía en tres sitios con reglas propias (`evaluar-olbi`,
-- `solicitar_cita` y la reasignación). Pasa a una sola función,
-- `elegir_psicologo`:
--   1. el mismo psicólogo de su caso anterior, si sigue activo y puede
--      atenderle (empezar con otra persona es empezar de cero);
--   2. si no, uno de su empresa, el que tenga menos casos abiertos;
--   3. si su empresa no tiene ninguno activo, el general con menos casos.

alter table psicologos add column if not exists organizacion_id uuid references organizaciones(id);

comment on column psicologos.organizacion_id is
  'Nulo: psicólogo general, atiende a todas las empresas. Con valor: solo atiende a esa empresa (lo dio de alta su administrador).';

create or replace function puede_atender(p_psicologo uuid, p_trabajador uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from psicologos ps
      join trabajadores t on t.id = p_trabajador
     where ps.id = p_psicologo and ps.activo
       and (ps.organizacion_id is null or ps.organizacion_id = t.organizacion_id)
  )
$$;

create or replace function elegir_psicologo(p_trabajador uuid)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_org      uuid;
  v_anterior uuid;
  v_elegido  uuid;
begin
  select organizacion_id into v_org from trabajadores where id = p_trabajador;

  select psicologo_id into v_anterior
    from derivaciones
   where trabajador_id = p_trabajador and cerrada_en is not null
   order by cerrada_en desc
   limit 1;
  if v_anterior is not null and puede_atender(v_anterior, p_trabajador) then
    return v_anterior;
  end if;

  select ps.id into v_elegido
    from psicologos ps
    left join derivaciones d on d.psicologo_id = ps.id and d.cerrada_en is null
   where ps.activo
     and (ps.organizacion_id is null or ps.organizacion_id = v_org)
   group by ps.id, ps.organizacion_id, ps.creado_en
   -- Primero los de su empresa; dentro de cada grupo, el menos cargado.
   order by (ps.organizacion_id is null), count(d.id), ps.creado_en
   limit 1;

  return v_elegido;
end $$;

revoke all on function puede_atender(uuid, uuid) from public, anon, authenticated;
revoke all on function elegir_psicologo(uuid) from public, anon, authenticated;
grant execute on function elegir_psicologo(uuid) to service_role;
grant execute on function puede_atender(uuid, uuid) to service_role;

-- El administrador ve los psicólogos de su empresa (nombre y estado; los
-- casos que llevan, no).
drop policy if exists "admin ve los psicologos de su empresa" on psicologos;
create policy "admin ve los psicologos de su empresa" on psicologos
  for select to authenticated
  using (organizacion_id is not null and organizacion_id = (select empresa_del_admin()));

-- La cita que pide el trabajador por su cuenta, con la misma regla.
CREATE OR REPLACE FUNCTION public.solicitar_cita(p_para timestamp with time zone, p_motivo text DEFAULT NULL::text)
 RETURNS citas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_trabajador uuid := trabajador_actual();
  v_estado       estado_trabajador;
  v_derivacion   uuid;
  v_psicologo    uuid;
  v_cita         citas;
begin
  if v_trabajador is null then
    raise exception 'solo un trabajador puede pedir cita' using errcode = '42501';
  end if;

  select estado into v_estado from trabajadores where id = v_trabajador;
  if v_estado not in ('activo', 'detectado') then
    raise exception 'el trabajador no esta en el estudio' using errcode = 'P0001';
  end if;

  if p_para < now() + interval '1 hour' then
    raise exception 'la cita debe ser al menos con una hora de anticipacion' using errcode = 'P0001';
  end if;

  if exists (select 1 from citas where trabajador_id = v_trabajador
             and estado in ('solicitada', 'confirmada')) then
    raise exception 'ya tienes una cita pendiente' using errcode = 'P0001';
  end if;

  -- Derivación abierta existente (detección previa) o una nueva por solicitud.
  select id, psicologo_id into v_derivacion, v_psicologo
  from derivaciones
  where trabajador_id = v_trabajador and cerrada_en is null;

  if v_derivacion is null then
    -- La misma regla que la detección: su psicólogo anterior, uno de su
    -- empresa o, si no tiene, uno general.
    v_psicologo := elegir_psicologo(v_trabajador);

    if v_psicologo is null then
      raise exception 'no hay psicologos disponibles' using errcode = 'P0001';
    end if;

    insert into derivaciones (trabajador_id, psicologo_id, origen)
    values (v_trabajador, v_psicologo, 'solicitud')
    returning id into v_derivacion;

    insert into eventos (trabajador_id, tipo, metadata)
    values (v_trabajador, 'derivacion_psicologo',
            jsonb_build_object('psicologo_id', v_psicologo, 'automatica', false, 'origen', 'solicitud'));
  end if;

  insert into citas (trabajador_id, derivacion_id, psicologo_id, propuesta_para, motivo)
  values (v_trabajador, v_derivacion, v_psicologo, p_para, nullif(btrim(p_motivo), ''))
  returning * into v_cita;

  insert into eventos (trabajador_id, tipo, metadata)
  values (v_trabajador, 'cita_solicitada',
          jsonb_build_object('cita_id', v_cita.id, 'propuesta_para', p_para));

  return v_cita;
end $function$;

-- La reasignación del investigador no puede mandar un caso a un psicólogo
-- de otra empresa.
CREATE OR REPLACE FUNCTION public.reasignar_derivacion(p_derivacion uuid, p_psicologo uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_trabajador uuid; v_anterior uuid;
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  select trabajador_id, psicologo_id into v_trabajador, v_anterior
  from derivaciones where id = p_derivacion and cerrada_en is null;
  if v_trabajador is null then
    raise exception 'derivacion no encontrada o cerrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from psicologos where id = p_psicologo and activo) then
    raise exception 'psicologo no activo' using errcode = 'P0001';
  end if;
  -- Un psicólogo de empresa solo atiende a su empresa.
  if not puede_atender(p_psicologo, v_trabajador) then
    raise exception 'ese psicologo solo atiende a otra empresa' using errcode = 'P0001';
  end if;
  update derivaciones set psicologo_id = p_psicologo where id = p_derivacion;
  update citas set psicologo_id = p_psicologo where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');
  insert into eventos (trabajador_id, tipo, metadata)
  values (v_trabajador, 'reasignacion_psicologo',
          jsonb_build_object('derivacion_id', p_derivacion, 'de', v_anterior, 'a', p_psicologo, 'por', 'investigador',
                             'motivo', nullif(trim(coalesce(p_motivo, '')), '')));
end $function$;

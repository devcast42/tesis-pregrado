-- ESP-009 RF-009-09/10 — la reasignación de psicólogo lleva motivo.
-- El diálogo (Figma 2IqfFSK20uCzmuMg6SvaUZ, nodo 13:2) lo exige; queda en el
-- evento `reasignacion_psicologo` para la auditoría.

drop function if exists reasignar_derivacion(uuid, uuid);

create or replace function reasignar_derivacion(p_derivacion uuid, p_psicologo uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_participante uuid; v_anterior uuid;
begin
  if not es_investigador() then
    raise exception 'solo el investigador' using errcode = '42501';
  end if;
  select participante_id, psicologo_id into v_participante, v_anterior
  from derivaciones where id = p_derivacion and cerrada_en is null;
  if v_participante is null then
    raise exception 'derivacion no encontrada o cerrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from psicologos where id = p_psicologo and activo) then
    raise exception 'psicologo no activo' using errcode = 'P0001';
  end if;
  update derivaciones set psicologo_id = p_psicologo where id = p_derivacion;
  update citas set psicologo_id = p_psicologo where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');
  insert into eventos (participante_id, tipo, metadata)
  values (v_participante, 'reasignacion_psicologo',
          jsonb_build_object('derivacion_id', p_derivacion, 'de', v_anterior, 'a', p_psicologo, 'por', 'investigador',
                             'motivo', nullif(trim(coalesce(p_motivo, '')), '')));
end $$;

grant execute on function reasignar_derivacion(uuid, uuid, text) to authenticated;

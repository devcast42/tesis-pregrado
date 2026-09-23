-- Cancelar una cita cierra la derivación que solo existía por ella — ESP-004 RN-004-12.
--
-- Una derivación abierta es acceso del psicólogo a la identidad y a los OLBI
-- de la persona. Si la derivación nació de una solicitud (no de una
-- detección), no tuvo sesiones y la única cita se cancela, no queda ningún
-- motivo para que ese acceso siga abierto: se cierra en el mismo acto.

create or replace function cancelar_cita(p_cita uuid)
returns citas
language plpgsql security definer set search_path = public as $$
declare
  v_cita  citas;
  v_quien text;
begin
  select * into v_cita from citas where id = p_cita;
  if v_cita.id is null then
    raise exception 'cita no encontrada' using errcode = 'P0002';
  end if;

  if v_cita.participante_id = participante_actual() then v_quien := 'participante';
  elsif v_cita.psicologo_id = psicologo_actual() then v_quien := 'psicologo';
  else raise exception 'sin acceso a esta cita' using errcode = '42501';
  end if;

  if v_cita.estado not in ('solicitada', 'confirmada') then
    raise exception 'la cita ya no esta pendiente' using errcode = 'P0001';
  end if;

  update citas
  set estado = 'cancelada', cancelada_por = v_quien, actualizada_en = now()
  where id = p_cita
  returning * into v_cita;

  insert into eventos (participante_id, tipo, metadata)
  values (v_cita.participante_id, 'cita_cancelada',
          jsonb_build_object('cita_id', p_cita, 'por', v_quien));

  -- RN-004-12: sin detección, sin sesión y sin cita, la derivación sobra.
  update derivaciones d
  set cerrada_en = now()
  where d.id = v_cita.derivacion_id
    and d.cerrada_en is null
    and d.origen = 'solicitud'
    and not exists (select 1 from sesiones_consulta s where s.derivacion_id = d.id)
    and not exists (select 1 from citas c where c.derivacion_id = d.id
                    and c.estado in ('solicitada', 'confirmada'));

  return v_cita;
end $$;

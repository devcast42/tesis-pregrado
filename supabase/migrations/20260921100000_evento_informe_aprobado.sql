-- ESP-004 RF-004-11 / ESP-009 RF-009-08 — al aprobar un informe queda el hito
-- en `eventos`. El tipo `informe_aprobado` existía y la línea de tiempo del
-- investigador lo espera, pero nadie lo insertaba: el circuito lo deducía de
-- `informes.aprobado_en`. Con el evento, la ficha del participante y la
-- bandeja lo ven como cualquier otro hito, sin contenido clínico.
create or replace function registrar_informe_aprobado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_participante uuid;
begin
  if new.estado = 'aprobado' and (old.estado is distinct from 'aprobado') then
    select d.participante_id into v_participante
    from sesiones_consulta s join derivaciones d on d.id = s.derivacion_id
    where s.id = new.sesion_id;
    if v_participante is not null then
      insert into eventos (participante_id, tipo, metadata)
      values (v_participante, 'informe_aprobado',
              jsonb_build_object('sesion_id', new.sesion_id, 'informe_id', new.id, 'psicologo_id', new.aprobado_por, 'modelo', new.modelo));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists informes_evento_aprobado on informes;
create trigger informes_evento_aprobado
  after update of estado on informes
  for each row execute function registrar_informe_aprobado();

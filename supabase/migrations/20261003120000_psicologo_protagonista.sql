-- El psicólogo deja de ser reactivo.
--
-- Hasta aquí solo podía responder: esperaba una derivación, confirmaba la cita
-- que le pedían y cerraba el caso. Tres cosas le faltaban para trabajar como
-- trabaja un profesional.
--
--   1. Proponer él la cita, en vez de esperar a que se la pidan. Lo normal al
--      terminar una sesión es acordar la siguiente, y eso no se podía.
--   2. Registrar cómo terminó un acompañamiento. Cerrar sin desenlace deja al
--      servicio sin forma de demostrar que sirve, que es lo primero que
--      pregunta quien lo paga.
--   3. Marcar a alguien para volver a mirarlo después del alta, sin tener que
--      dejar el caso abierto para no perderlo de vista.

-- ---------------------------------------------------------------------------
-- 1. Desenlace del acompañamiento
-- ---------------------------------------------------------------------------

alter table derivaciones
  add column if not exists desenlace text
    check (desenlace is null or desenlace in
           ('mejora', 'derivado_externo', 'abandono', 'sin_contacto', 'otro')),
  add column if not exists desenlace_nota text,
  add column if not exists seguimiento_hasta date;

comment on column derivaciones.desenlace is
  'Cómo terminó el acompañamiento. Solo lo escribe el psicólogo que lo llevó. '
  'No se expone a la empresa: es información clínica.';
comment on column derivaciones.seguimiento_hasta is
  'El psicólogo quiere volver a mirar a esta persona hasta esta fecha, aunque '
  'el caso esté cerrado. No reabre nada ni le pide nada a la persona.';

-- `cerrarDerivacion` hacía un update directo desde la app. Pasa a función para
-- que el desenlace sea obligatorio y nadie pueda cerrar un caso de otro.
create or replace function cerrar_derivacion(
  p_derivacion uuid,
  p_desenlace text,
  p_nota text default null,
  p_seguimiento_hasta date default null
) returns derivaciones
language plpgsql security definer set search_path = public as $$
declare
  d derivaciones%rowtype;
begin
  select * into d from derivaciones
   where id = p_derivacion and psicologo_id = psicologo_actual();
  if not found then
    raise exception 'esa derivación no es tuya' using errcode = '42501';
  end if;
  if d.cerrada_en is not null then
    raise exception 'el caso ya estaba cerrado' using errcode = 'P0001';
  end if;

  update derivaciones
     set cerrada_en = now(), desenlace = p_desenlace,
         desenlace_nota = nullif(btrim(p_nota), ''),
         seguimiento_hasta = p_seguimiento_hasta
   where id = p_derivacion
  returning * into d;

  -- Las citas que quedaban en pie no tienen sentido tras el alta.
  update citas set estado = 'cancelada', cancelada_por = 'psicologo'
   where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');

  insert into eventos (participante_id, tipo, metadata)
  values (d.participante_id, 'derivacion_cerrada',
          jsonb_build_object('derivacion_id', p_derivacion, 'desenlace', p_desenlace));
  return d;
end $$;

grant execute on function cerrar_derivacion(uuid, text, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. El psicólogo propone la cita
-- ---------------------------------------------------------------------------

-- `solicitar_cita` la pide el participante y nace 'solicitada', a la espera de
-- que el psicólogo la confirme. Esta nace ya 'confirmada': la propone quien
-- tendría que confirmarla, así que pedirle que la confirme otra vez sobra.
create or replace function proponer_cita(
  p_derivacion uuid,
  p_para timestamptz,
  p_motivo text default null
) returns citas
language plpgsql security definer set search_path = public as $$
declare
  d derivaciones%rowtype;
  c citas%rowtype;
begin
  select * into d from derivaciones
   where id = p_derivacion and psicologo_id = psicologo_actual() and cerrada_en is null;
  if not found then
    raise exception 'no tienes un caso abierto con esa derivación' using errcode = '42501';
  end if;
  if p_para <= now() then
    raise exception 'la fecha propuesta ya pasó' using errcode = 'P0001';
  end if;

  update citas set estado = 'cancelada', cancelada_por = 'psicologo'
   where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');

  insert into citas (participante_id, derivacion_id, psicologo_id, propuesta_para, motivo, estado)
  values (d.participante_id, d.id, d.psicologo_id, p_para, nullif(btrim(p_motivo), ''), 'confirmada')
  returning * into c;

  insert into eventos (participante_id, tipo, metadata)
  values (d.participante_id, 'cita_confirmada',
          jsonb_build_object('cita_id', c.id, 'propuesta_por', 'psicologo'));
  return c;
end $$;

grant execute on function proponer_cita(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. La agenda
-- ---------------------------------------------------------------------------

-- Lo primero que abre un profesional por la mañana, y lo único que no existía:
-- qué tiene hoy y qué tiene esta semana, de todos sus casos a la vez.
create or replace view agenda_psicologo
with (security_invoker = off) as
select
  c.id                          as cita_id,
  c.derivacion_id,
  c.participante_id,
  i.nombre,
  p.codigo_anonimo,
  c.propuesta_para,
  c.estado,
  c.motivo,
  (c.propuesta_para at time zone tz_estudio())::date as dia,
  exists (select 1 from sesiones_consulta s
          where s.derivacion_id = c.derivacion_id and s.finalizada_en is null)
                                as sesion_en_curso
from citas c
join participantes p on p.id = c.participante_id
left join identidades i on i.participante_id = c.participante_id
where c.psicologo_id = psicologo_actual()
  and c.estado in ('solicitada', 'confirmada')
  and c.propuesta_para >= now() - interval '1 day';

comment on view agenda_psicologo is
  'Producto. Lo que este psicólogo tiene por delante, de todos sus casos. '
  'Incluye el día de ayer para que una cita recién pasada no desaparezca.';

grant select on agenda_psicologo to authenticated;

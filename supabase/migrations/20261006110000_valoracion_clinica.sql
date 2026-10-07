-- La valoración clínica del psicólogo, al aprobar el informe.
--
-- Hoy la única etiqueta de «esta persona está quemada» es el OLBI cruzando su
-- umbral: un cuestionario autoaplicado. Es lo mejor que hay a escala, pero no
-- es un juicio clínico, y el sistema entrena contra él por falta de algo mejor.
--
-- El psicólogo ya habla con esa persona y ya escribe un informe. Marcar una
-- casilla más al aprobarlo cuesta dos segundos y produce la única etiqueta de
-- verdad que existe para el burnout.
--
-- No sirve para entrenar todavía: hacen falta cientos y hoy hay un puñado de
-- casos derivados. Se empieza a juntar ahora porque dentro de dos años no se
-- puede recoger hacia atrás.
--
-- NO SE EXPONE A LA EMPRESA. Es información clínica y vive donde vive el
-- informe: lo ve su autor y nadie más. La vista `seguimiento_empresa` sigue
-- enseñando nivel y acompañamiento, nunca esto.

alter table informes
  add column if not exists valoracion text
    check (valoracion is null or valoracion in
           ('burnout', 'sin_burnout', 'no_concluyente', 'otro_cuadro')),
  add column if not exists valoracion_nota text;

comment on column informes.valoracion is
  'Juicio del psicólogo tras la sesión. «otro_cuadro» cuando el malestar es '
  'real pero no es burnout —depresión, ansiedad, algo médico—: distinguirlo '
  'importa tanto como el sí o el no.';

-- Aprobar pasa a función para exigirla: el campo opcional que nadie rellena
-- no sirve de nada, y la etiqueta solo vale si está completa.
create or replace function aprobar_informe(
  p_informe uuid,
  p_contenido jsonb,
  p_valoracion text,
  p_nota text default null
) returns informes
language plpgsql security definer set search_path = public as $$
declare
  i informes%rowtype;
  v_psicologo uuid := psicologo_actual();
begin
  if v_psicologo is null then
    raise exception 'solo un psicólogo aprueba informes' using errcode = '42501';
  end if;
  -- Que el informe sea de un caso suyo: aprobar el de otro sería firmar por él.
  select inf.* into i
    from informes inf
    join sesiones_consulta s on s.id = inf.sesion_id
    join derivaciones d on d.id = s.derivacion_id
   where inf.id = p_informe and d.psicologo_id = v_psicologo;
  if not found then
    raise exception 'ese informe no es tuyo' using errcode = '42501';
  end if;

  update informes
     set contenido_aprobado = p_contenido,
         estado = 'aprobado',
         aprobado_por = v_psicologo,
         aprobado_en = now(),
         valoracion = p_valoracion,
         valoracion_nota = nullif(btrim(p_nota), '')
   where id = p_informe
  returning * into i;
  return i;
end $$;

grant execute on function aprobar_informe(uuid, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cuánto se parece el cuestionario al juicio del psicólogo
-- ---------------------------------------------------------------------------

-- La pregunta que esta columna existe para contestar, y que hoy nadie puede:
-- de la gente que el OLBI señaló, ¿a cuántos un profesional les habría dicho
-- lo mismo? El día que haya suficientes casos, aquí está la respuesta.
create or replace view acuerdo_olbi_psicologo
with (security_invoker = off) as
select
  inf.valoracion,
  count(*)                                                as casos,
  min(inf.aprobado_en)::date                              as desde,
  max(inf.aprobado_en)::date                              as hasta
from informes inf
where inf.estado = 'aprobado' and inf.valoracion is not null
  and es_investigador()
group by inf.valoracion;

comment on view acuerdo_olbi_psicologo is
  'Solo para el investigador, y agregada: cuántos de los derivados por el OLBI '
  'confirmó un psicólogo. Sin identificar a nadie y sin exponerse a la empresa.';

grant select on acuerdo_olbi_psicologo to authenticated;

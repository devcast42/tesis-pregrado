-- Vista móvil del psicólogo — implementa ESP-006 RF-006-13 … RF-006-15 y ESP-004 RF-004-12.
-- Diseño: Figma VXFnbiXKzb0Hj92s2r2ulL, frames «Casos Derivados», «Detalle
-- del Caso», «Antes de la Videollamada», «En la Videollamada», «Informe Clínico».
--
-- Tres cosas que la app necesitaba y la base no daba:
--
--  1. `casos_psicologo`: una fila por derivación con todo lo que la lista y
--     la ficha muestran (empresa, puntajes de la detección, última sesión,
--     estado del informe, estado del caso). Antes eran cuatro consultas por
--     caso. Security invoker: la sigue acotando RLS por derivación.
--  2. `perfil_caso`: rol, modalidad y antigüedad del formulario `estable`.
--     Es una EXCEPCIÓN acotada a RN-006-07 («solo el OLBI»): son contexto
--     laboral, no clínico, y el psicólogo los necesita para situar a la
--     persona. Nunca horas, sueño ni ítems diarios: esos siguen vedados.
--  3. Informe manual: sin grabación no había forma de dejar constancia de la
--     sesión. `transcripcion_id` pasa a ser opcional; el borrador queda vacío
--     («nada generó el modelo») y lo escrito va a `contenido_aprobado`.

-- ---------------------------------------------------------------------------
-- 1. Empresa del derivado
-- ---------------------------------------------------------------------------

create policy "psicologo ve la empresa del derivado"
  on organizaciones for select
  using (exists (
    select 1 from participantes p
    where p.organizacion_id = organizaciones.id
      and tiene_derivacion_abierta(p.id)
  ));

-- ---------------------------------------------------------------------------
-- 2. Vista de casos
-- ---------------------------------------------------------------------------

create or replace view casos_psicologo
with (security_invoker = on) as
with ultima_sesion as (
  select distinct on (derivacion_id)
    derivacion_id, id as sesion_id, iniciada_en, finalizada_en,
    consentimiento_participante, consentimiento_psicologo
  from sesiones_consulta
  order by derivacion_id, iniciada_en desc
),
deteccion as (
  select d.id as derivacion_id, e.ocurrido_en, e.metadata
  from derivaciones d
  join lateral (
    select ocurrido_en, metadata from eventos e
    where e.id = d.evento_deteccion_id
       or (d.evento_deteccion_id is null and e.participante_id = d.participante_id
           and e.tipo = 'deteccion' and e.ocurrido_en <= d.abierta_en)
    order by ocurrido_en desc limit 1
  ) e on true
)
select
  d.id                          as derivacion_id,
  d.participante_id,
  p.codigo_anonimo,
  o.nombre                      as empresa,
  d.abierta_en,
  d.cerrada_en,
  det.ocurrido_en               as detectado_en,
  det.metadata -> 'puntajes'    as puntajes,
  det.metadata -> 'umbrales'    as umbrales,
  s.sesion_id,
  s.iniciada_en                 as sesion_iniciada_en,
  s.finalizada_en               as sesion_finalizada_en,
  s.consentimiento_participante,
  s.consentimiento_psicologo,
  i.estado                      as informe_estado,
  case
    when d.cerrada_en is not null                                   then 'cerrado'
    when i.estado = 'sin_revisar'                                   then 'informe_por_aprobar'
    when s.sesion_id is not null and s.finalizada_en is null        then 'sala_lista'
    else                                                                 'sesion_pendiente'
  end                           as estado_caso
from derivaciones d
join participantes p on p.id = d.participante_id
left join organizaciones o on o.id = p.organizacion_id
left join deteccion det on det.derivacion_id = d.id
left join ultima_sesion s on s.derivacion_id = d.id
left join informes i on i.sesion_id = s.sesion_id;

comment on view casos_psicologo is
  'ESP-006 RF-006-13. Una fila por derivación con lo que la lista y la ficha del psicólogo muestran. Acotada por RLS a las derivaciones del solicitante.';

-- ---------------------------------------------------------------------------
-- 3. Perfil laboral del derivado (excepción acotada a RN-006-07)
-- ---------------------------------------------------------------------------

create or replace function perfil_caso(p_participante uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when not (tiene_derivacion_abierta(p_participante) or es_investigador()) then null
    else (
      select jsonb_build_object(
        'rol',                max(i.valor_texto) filter (where i.item_clave = 'rol'),
        'modalidad',          max(i.valor_texto) filter (where i.item_clave = 'modalidad'),
        'antiguedad_empresa', max(i.valor_num)   filter (where i.item_clave = 'antiguedad_empresa'),
        'antiguedad_sector',  max(i.valor_num)   filter (where i.item_clave = 'antiguedad_sector')
      )
      from respuestas r
      join respuestas_items i on i.respuesta_id = r.id
      where r.participante_id = p_participante
        and r.formulario_clave = 'estable'
        and r.id = (select id from respuestas
                    where participante_id = p_participante and formulario_clave = 'estable'
                    order by enviado_en desc limit 1)
    )
  end
$$;

grant execute on function perfil_caso(uuid) to authenticated;

comment on function perfil_caso(uuid) is
  'ESP-006 RF-006-14. Rol, modalidad y antigüedad del formulario estable para un derivado. Excepción documentada a RN-006-07: contexto laboral, no clínico.';

-- ---------------------------------------------------------------------------
-- 4. Informe manual cuando no hubo grabación (ESP-004 RF-004-12)
-- ---------------------------------------------------------------------------

alter table informes alter column transcripcion_id drop not null;

create or replace function exigir_transcripcion_lista() returns trigger
language plpgsql as $$
begin
  -- Sin transcripción no hay borrador generado: es un informe manual y el
  -- borrador nace vacío. Con transcripción, sigue exigiéndose completa.
  if new.transcripcion_id is null then
    if new.contenido_borrador <> '{}'::jsonb then
      raise exception 'un informe manual nace con borrador vacio (ESP-004 RF-004-12)';
    end if;
    return new;
  end if;
  if (select estado from transcripciones where id = new.transcripcion_id) <> 'lista' then
    raise exception 'no se genera informe sin transcripcion lista (ESP-004 RN-004-05)';
  end if;
  return new;
end;
$$;

create policy "psicologo abre informe manual"
  on informes for insert
  with check (
    consulta_accesible(sesion_id)
    and transcripcion_id is null
    and modelo = 'manual'
  );

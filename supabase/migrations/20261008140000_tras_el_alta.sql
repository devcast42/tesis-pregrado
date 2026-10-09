-- Qué pasa con alguien cuando su psicólogo cierra el caso.
--
-- Hasta ahora, nada: `cerrar_derivacion` anotaba la fecha y el desenlace y
-- dejaba al trabajador en `detectado` para siempre. En ese estado la app no
-- le pide check-ins ni cuestionarios, así que su nivel no podía cambiar, y en
-- el panel de la empresa seguía saliendo «Alto» —ya sin «En
-- acompañamiento»—: la peor combinación posible, alguien en riesgo a quien
-- aparentemente nadie atiende, cuando en realidad terminó su proceso.
--
-- Ahora:
--   1. Cerrar el caso devuelve a la persona a `activo`: retoma sus check-ins.
--   2. A los 14 días del alta se le vuelve a pedir el cuestionario, con su
--      propio motivo, `tras_alta`. Al responderlo, su nivel se actualiza solo,
--      y si vuelve a salir alto el circuito arranca otra vez.
--   3. Mientras no haya un cuestionario posterior al alta, el panel de la
--      empresa la ve «En seguimiento» en lugar del nivel viejo, que era de
--      antes del acompañamiento y ya no dice nada cierto.

-- ---------------------------------------------------------------------------
-- 1. Cerrar devuelve a activo
-- ---------------------------------------------------------------------------
create or replace function cerrar_derivacion(
  p_derivacion uuid, p_desenlace text, p_nota text default null, p_seguimiento_hasta date default null
)
returns derivaciones
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
         -- Sin fecha explícita, el seguimiento dura lo que tarda en llegar
         -- el cuestionario de control.
         seguimiento_hasta = coalesce(p_seguimiento_hasta, (now() at time zone tz_estudio())::date + 14)
   where id = p_derivacion
  returning * into d;

  -- Las citas que quedaban en pie no tienen sentido tras el alta.
  update citas set estado = 'cancelada', cancelada_por = 'psicologo'
   where derivacion_id = p_derivacion and estado in ('solicitada', 'confirmada');

  -- Vuelve a sus check-ins. Solo desde `detectado`: alguien que se dio de
  -- baja o terminó no se reactiva por cerrar su caso.
  update trabajadores set estado = 'activo'
   where id = d.trabajador_id and estado = 'detectado'
     and not exists (select 1 from derivaciones o
                      where o.trabajador_id = d.trabajador_id and o.cerrada_en is null);

  insert into eventos (trabajador_id, tipo, metadata)
  values (d.trabajador_id, 'derivacion_cerrada',
          jsonb_build_object('derivacion_id', p_derivacion, 'desenlace', p_desenlace));
  return d;
end $$;

-- ---------------------------------------------------------------------------
-- 2. El cuestionario de control
-- ---------------------------------------------------------------------------
create or replace function olbi_toca(p_trabajador uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_id      uuid := coalesce(p_trabajador, trabajador_actual());
  v_hoy     date := (now() at time zone tz_estudio())::date;
  v_lunes   date := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_ultimo  date;
  v_alta    date;
  v_prob    jsonb;
  v_umbral  numeric;
  v_motivo  text;
  v_extra   jsonb := '{}'::jsonb;
begin
  if v_id is null then return jsonb_build_object('toca', false); end if;
  if v_id <> trabajador_actual() and not es_investigador() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select max((enviado_en at time zone tz_estudio())::date) into v_ultimo
    from respuestas where trabajador_id = v_id and formulario_clave = 'olbi';

  if v_ultimo is not null and v_ultimo >= v_lunes then
    return jsonb_build_object('toca', false, 'motivo', 'ya_respondido');
  end if;

  -- El último alta sin un cuestionario posterior. Mientras exista, esta
  -- persona está pendiente de su medida de control.
  select max((cerrada_en at time zone tz_estudio())::date) into v_alta
    from derivaciones where trabajador_id = v_id and cerrada_en is not null;
  if v_alta is not null and v_ultimo is not null and v_ultimo >= v_alta then v_alta := null; end if;

  v_prob := probabilidad_semana(v_id, 'nowcast');
  if v_prob is not null and (v_prob ->> 'probabilidad') is not null then
    v_umbral := (v_prob ->> 'umbral_decision')::numeric;
    if (v_prob ->> 'probabilidad')::numeric >= v_umbral then
      v_motivo := 'modelo';
      v_extra := jsonb_build_object('probabilidad', (v_prob ->> 'probabilidad')::numeric);
    end if;
  end if;

  if v_motivo is null and v_alta is not null and v_hoy >= v_alta + 14 then
    v_motivo := 'tras_alta';
  end if;

  if v_motivo is null
     and extract(isodow from (now() at time zone tz_estudio())) >= 5
     and abs(hashtext(v_id::text || v_lunes::text)) % 4 = 0 then
    v_motivo := 'sorteo';
  end if;

  -- «Un mes sin medirse» no aplica en los 14 días después del alta: el último
  -- cuestionario es el de la detección y caería el primer día de vuelta,
  -- cuando el control ya tiene su fecha.
  if v_motivo is null and v_alta is null and (v_ultimo is null or v_ultimo < v_lunes - 28) then
    v_motivo := 'sin_medir';
  end if;

  if v_motivo is null then
    return jsonb_build_object('toca', false, 'motivo', 'no_toca');
  end if;

  if not exists (
    select 1 from eventos e
     where e.trabajador_id = v_id and e.tipo = 'olbi_requerido'
       and (e.ocurrido_en at time zone tz_estudio())::date >= v_lunes
  ) then
    insert into eventos (trabajador_id, tipo, metadata)
    values (v_id, 'olbi_requerido', jsonb_build_object('motivo', v_motivo) || v_extra);
  end if;

  return jsonb_build_object('toca', true, 'motivo', v_motivo) || v_extra;
end $$;

grant execute on function olbi_toca(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. «En seguimiento» en el panel de la empresa
-- ---------------------------------------------------------------------------
-- Se añade al final: `create or replace view` no deja mover columnas. Sigue
-- siendo un sí/no sin fecha ni motivo, como «en acompañamiento».
create or replace view seguimiento_empresa
with (security_invoker = off) as
 WITH ultimo_olbi AS (
         SELECT DISTINCT ON (o.trabajador_id) o.trabajador_id AS participante_id,
            o.semana, o.agotamiento, o.desvinculacion
           FROM olbi_semana_trabajador o
          ORDER BY o.trabajador_id, o.semana DESC
        ), ultima_respuesta AS (
         SELECT respuestas.trabajador_id AS participante_id,
            max((respuestas.enviado_en AT TIME ZONE tz_estudio())::date) AS dia
           FROM respuestas
          GROUP BY respuestas.trabajador_id
        )
 SELECT p.id AS trabajador_id,
    p.organizacion_id,
    p.codigo_anonimo,
    i.nombre,
    p.estado,
    p.inscrito_en::date AS desde,
    ur.dia AS ultima_respuesta,
    CURRENT_DATE - ur.dia AS dias_sin_responder,
    nivel_empresa('agotamiento'::text, uo.agotamiento) AS nivel_agotamiento,
    nivel_empresa('desvinculacion'::text, uo.desvinculacion) AS nivel_desvinculacion,
    uo.semana AS nivel_de_la_semana,
    (EXISTS ( SELECT 1 FROM derivaciones d
          WHERE d.trabajador_id = p.id AND d.cerrada_en IS NULL)) AS en_acompanamiento,
    i.correo_contacto,
    ( SELECT c.aceptado FROM consentimientos c
          WHERE c.trabajador_id = p.id
          ORDER BY c.registrado_en DESC LIMIT 1) AS consentimiento,
    p.estado = 'activo'::estado_trabajador AS en_seguimiento,
    p.inscrito_en,
    -- Tuvo un alta y todavía no ha respondido un cuestionario después.
    (NOT EXISTS (SELECT 1 FROM derivaciones d WHERE d.trabajador_id = p.id AND d.cerrada_en IS NULL)
     AND (SELECT max(d.cerrada_en) FROM derivaciones d WHERE d.trabajador_id = p.id)
         > coalesce((SELECT max(r.enviado_en) FROM respuestas r
                      WHERE r.trabajador_id = p.id AND r.formulario_clave = 'olbi'), '-infinity'::timestamptz)
    ) AS tras_alta
   FROM trabajadores p
     LEFT JOIN identidades i ON i.trabajador_id = p.id
     LEFT JOIN ultimo_olbi uo ON uo.participante_id = p.id
     LEFT JOIN ultima_respuesta ur ON ur.participante_id = p.id
  WHERE alcance_empresa(p.organizacion_id);

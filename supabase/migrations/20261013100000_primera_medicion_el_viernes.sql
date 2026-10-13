-- La primera medición del OLBI pasa al viernes.
--
-- `sin_medir` («un mes sin medirse») también saltaba con quien nunca lo había
-- respondido, así que todo trabajador nuevo recibía el cuestionario completo
-- el primer día, encima del consentimiento y los datos iniciales, con el
-- texto «hace un mes que no lo respondes». Ahora, si nunca se midió, se pide
-- el viernes (o después) y nunca el día de la inscripción; la respuesta lleva
-- `primera: true` para que la app lo explique como punto de partida.
--
-- Afecta también a `main` (base compartida).

CREATE OR REPLACE FUNCTION public.olbi_toca(p_trabajador uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid := coalesce(p_trabajador, trabajador_actual());
  v_hoy     date := (now() at time zone tz_estudio())::date;
  v_lunes   date := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_ultimo  date;
  v_alta    date;
  v_inscrito date;
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
     -- El viernes, el último día de check-in: se ofrece tras él, al cerrar
     -- la semana.
     and extract(isodow from (now() at time zone tz_estudio())) >= 5
     and abs(hashtext(v_id::text || v_lunes::text)) % 4 = 0 then
    v_motivo := 'sorteo';
  end if;

  -- «Un mes sin medirse» no aplica en los 14 días después del alta: el último
  -- cuestionario es el de la detección y caería el primer día de vuelta,
  -- cuando el control ya tiene su fecha.
  if v_motivo is null and v_alta is null and v_ultimo is not null and v_ultimo < v_lunes - 28 then
    v_motivo := 'sin_medir';
  end if;

  -- Nunca medido: la medida de partida llega el viernes, no el primer día.
  -- El primer día ya trae el consentimiento y los datos iniciales; sumarle
  -- dieciséis preguntas es la forma más rápida de que no vuelva. Si el
  -- modelo avisa antes, se mide antes (ese motivo ya ganó arriba). El día
  -- de la inscripción nunca: quien entra un viernes mide el siguiente.
  if v_motivo is null and v_alta is null and v_ultimo is null then
    select (inscrito_en at time zone tz_estudio())::date into v_inscrito
      from trabajadores where id = v_id;
    if extract(isodow from (now() at time zone tz_estudio())) >= 5
       and (v_inscrito is null or v_inscrito < v_hoy) then
      v_motivo := 'sin_medir';
      v_extra := jsonb_build_object('primera', true);
    end if;
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
end $function$;

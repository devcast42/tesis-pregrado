-- Check-in de lunes a viernes.
--
-- El check-in era de lunes a jueves porque el viernes era el día del OLBI
-- para todos. Desde que el OLBI se pide de vez en cuando, el viernes quedaba
-- vacío: un día laborable sin registro. Ahora hay check-in los cinco días, y
-- el modelo v3 se entrenó con semanas de cinco (20261009150000).
--
-- 1. `diario` v5: las mismas seis preguntas, `dias` de 1 a 5. Las respuestas
--    ya enviadas conservan su versión (RN-002-01). Todo lo que cuenta días de
--    check-in (adherencia, racha, Personas, bandeja) lee la versión vigente
--    con `es_dia_de_checkin` y cambia solo.
-- 2. El sorteo del OLBI vuelve al viernes, tras el último check-in.
-- 3. La retrospectiva confronta la última predicción de lunes a viernes.
-- 4. `semanas_modelo`, el contrato de entrenamiento, toma los cinco días.

insert into formularios (clave, version, definicion)
select 'diario', 5, jsonb_set(definicion, '{dias}', '[1, 2, 3, 4, 5]'::jsonb)
  from formularios where clave = 'diario' and version = 4
on conflict do nothing;

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
end $function$;

CREATE OR REPLACE FUNCTION public.ultima_prediccion_semana(p_trabajador uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with semana as (
    select ((now() at time zone tz_estudio())::date
            - (extract(isodow from now() at time zone tz_estudio())::int - 1)) as lunes
  )
  select e.metadata || jsonb_build_object('ocurrido_en', e.ocurrido_en)
  from eventos e, semana
  where e.trabajador_id = p_trabajador
    and e.tipo = 'prediccion_modelo'
    and e.metadata ->> 'tarea' = 'nowcast'
    and (e.metadata ->> 'dia')::date >= semana.lunes
    and (e.metadata ->> 'dia')::date <  semana.lunes + 5
    and (p_trabajador = trabajador_actual() or es_investigador() or psicologo_actual() is not null)
  order by e.ocurrido_en desc
  limit 1
$function$;

create or replace view semanas_modelo
with (security_invoker = on) as
 WITH diario_respuesta AS (
         SELECT r_1.id,
            r_1.trabajador_id AS participante_id,
            r_1.enviado_en,
            ((r_1.enviado_en AT TIME ZONE tz_estudio()))::date AS dia,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'od_04'::text)) AS od_04,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'od_12'::text)) AS od_12,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'od_03'::text)) AS od_03,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'od_06'::text)) AS od_06,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'horas_trabajadas'::text)) AS horas_trabajadas,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'horas_sueno'::text)) AS horas_sueno,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'horas_fin_de_semana'::text)) AS horas_fin_de_semana,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'desconexion'::text)) AS desconexion,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'contacto_fuera_horario'::text)) AS contacto_fuera_horario
           FROM (respuestas r_1
             JOIN respuestas_items i ON ((i.respuesta_id = r_1.id)))
          WHERE (r_1.formulario_clave = 'diario'::text)
          GROUP BY r_1.id, r_1.trabajador_id, r_1.enviado_en
        ), dia_habil AS (
         SELECT DISTINCT ON (diario_respuesta.participante_id, diario_respuesta.dia) diario_respuesta.participante_id,
            diario_respuesta.dia,
            semana_de(diario_respuesta.enviado_en) AS semana,
            ((((diario_respuesta.od_04 + diario_respuesta.od_12) + diario_respuesta.od_03) + diario_respuesta.od_06) / 4.0) AS t_dia,
            ((diario_respuesta.od_04 + diario_respuesta.od_12) / 2.0) AS e_dia,
            ((diario_respuesta.od_03 + diario_respuesta.od_06) / 2.0) AS d_dia,
            diario_respuesta.horas_trabajadas,
            diario_respuesta.horas_sueno,
            diario_respuesta.horas_fin_de_semana,
            diario_respuesta.desconexion,
            diario_respuesta.contacto_fuera_horario
           FROM diario_respuesta
          WHERE ((diario_respuesta.od_04 IS NOT NULL) AND (diario_respuesta.od_12 IS NOT NULL) AND (diario_respuesta.od_03 IS NOT NULL) AND (diario_respuesta.od_06 IS NOT NULL) AND (((EXTRACT(isodow FROM diario_respuesta.dia))::integer >= 1) AND ((EXTRACT(isodow FROM diario_respuesta.dia))::integer <= 5)))
          ORDER BY diario_respuesta.participante_id, diario_respuesta.dia, diario_respuesta.enviado_en DESC
        ), dia_indexado AS (
         SELECT dia_habil.participante_id,
            dia_habil.dia,
            dia_habil.semana,
            dia_habil.t_dia,
            dia_habil.e_dia,
            dia_habil.d_dia,
            dia_habil.horas_trabajadas,
            dia_habil.horas_sueno,
            dia_habil.horas_fin_de_semana,
            dia_habil.desconexion,
            dia_habil.contacto_fuera_horario,
            ((row_number() OVER (PARTITION BY dia_habil.participante_id, dia_habil.semana ORDER BY dia_habil.dia) - 1))::numeric AS idx
           FROM dia_habil
        ), rasgos AS (
         SELECT dia_indexado.participante_id,
            dia_indexado.semana,
            count(*) AS n_dias,
            avg(dia_indexado.t_dia) AS t_media,
            (array_agg(dia_indexado.t_dia ORDER BY dia_indexado.dia DESC))[1] AS t_ultimo,
            max(dia_indexado.t_dia) AS t_max,
            COALESCE(regr_slope((dia_indexado.t_dia)::double precision, (dia_indexado.idx)::double precision), (0)::double precision) AS t_pendiente,
            avg(dia_indexado.e_dia) AS e_media,
            avg(dia_indexado.d_dia) AS d_media,
            avg(dia_indexado.horas_trabajadas) AS horas_media,
            max(dia_indexado.horas_trabajadas) AS horas_max,
            avg(dia_indexado.horas_sueno) AS sueno_media,
            min(dia_indexado.horas_sueno) AS sueno_min,
            max(dia_indexado.horas_fin_de_semana) AS horas_fin_de_semana,
            avg(dia_indexado.desconexion) AS desconexion_media,
            avg(dia_indexado.contacto_fuera_horario) AS contacto_fuera_horario
           FROM dia_indexado
          GROUP BY dia_indexado.participante_id, dia_indexado.semana
        ), semanal AS (
         SELECT DISTINCT ON (r_1.trabajador_id, (semana_de(r_1.enviado_en))) r_1.trabajador_id AS participante_id,
            semana_de(r_1.enviado_en) AS semana,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'horas_sobretiempo'::text)) AS horas_sobretiempo,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'guardias'::text)) AS guardias,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'apoyo_lider'::text)) AS apoyo_lider
           FROM (respuestas r_1
             JOIN respuestas_items i ON ((i.respuesta_id = r_1.id)))
          WHERE (r_1.formulario_clave = 'semanal'::text)
          GROUP BY r_1.trabajador_id, r_1.enviado_en
          ORDER BY r_1.trabajador_id, (semana_de(r_1.enviado_en)), r_1.enviado_en DESC
        ), estable AS (
         SELECT r_1.trabajador_id AS participante_id,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'edad'::text)) AS edad,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'antiguedad_empresa'::text)) AS antiguedad_empresa,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'antiguedad_sector'::text)) AS antiguedad_sector,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'tamano_equipo'::text)) AS tamano_equipo,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'personas_a_cargo'::text)) AS personas_a_cargo,
            max(i.valor_num) FILTER (WHERE (i.item_clave = 'minutos_traslado'::text)) AS minutos_traslado,
            max(i.valor_texto) FILTER (WHERE (i.item_clave = 'rol'::text)) AS rol,
            max(i.valor_texto) FILTER (WHERE (i.item_clave = 'modalidad'::text)) AS modalidad
           FROM (respuestas r_1
             JOIN respuestas_items i ON ((i.respuesta_id = r_1.id)))
          WHERE (r_1.formulario_clave = 'estable'::text)
          GROUP BY r_1.trabajador_id
        ), etiqueta AS (
         SELECT olbi_semanal_etiquetado.trabajador_id AS participante_id,
            olbi_semanal_etiquetado.semana,
            olbi_semanal_etiquetado.agotamiento,
            olbi_semanal_etiquetado.desvinculacion,
            olbi_semanal_etiquetado.alto
           FROM olbi_semanal_etiquetado
        ), corte AS (
         SELECT etiqueta.participante_id,
            min(etiqueta.semana) FILTER (WHERE etiqueta.alto) AS primera_alta
           FROM etiqueta
          GROUP BY etiqueta.participante_id
        ), base AS (
         SELECT rasgos.participante_id,
            rasgos.semana
           FROM rasgos
        UNION
         SELECT etiqueta.participante_id,
            etiqueta.semana
           FROM etiqueta
        )
 SELECT b.participante_id AS trabajador_id,
    b.semana,
    COALESCE(r.n_dias, (0)::bigint) AS n_dias,
    r.t_media,
    r.t_ultimo,
    r.t_max,
    r.t_pendiente,
    r.e_media,
    r.d_media,
    r.horas_media,
    r.horas_max,
    r.sueno_media,
    r.sueno_min,
    r.horas_fin_de_semana,
    r.desconexion_media,
    r.contacto_fuera_horario,
    s.horas_sobretiempo,
    s.guardias,
    s.apoyo_lider,
    sp.horas_sobretiempo AS sobretiempo_previo,
    sp.guardias AS guardia_previa,
    sp.apoyo_lider AS apoyo_previo,
    e.edad,
    e.antiguedad_empresa,
    e.antiguedad_sector,
    e.tamano_equipo,
    e.personas_a_cargo,
    e.minutos_traslado,
    ((e.rol = 'desarrollo'::text))::integer AS rol_desarrollo,
    ((e.rol = 'qa'::text))::integer AS rol_qa,
    ((e.rol = 'datos'::text))::integer AS rol_datos,
    ((e.rol = 'infraestructura'::text))::integer AS rol_infraestructura,
    ((e.rol = 'soporte'::text))::integer AS rol_soporte,
    ((e.rol = 'diseno'::text))::integer AS rol_diseno,
    ((e.rol = 'gestion'::text))::integer AS rol_gestion,
    ((e.rol = 'otro'::text))::integer AS rol_otro,
    ((e.modalidad = 'remoto'::text))::integer AS modalidad_remoto,
    ((e.modalidad = 'hibrido'::text))::integer AS modalidad_hibrido,
    ((e.modalidad = 'presencial'::text))::integer AS modalidad_presencial,
    et.agotamiento AS e_previo,
    et.desvinculacion AS d_previo,
    et.alto AS alto_t,
        CASE
            WHEN ((c.primera_alta IS NOT NULL) AND (b.semana >= c.primera_alta)) THEN NULL::boolean
            ELSE et1.alto
        END AS alto_t1,
    ((c.primera_alta IS NOT NULL) AND (b.semana = c.primera_alta)) AS es_primer_cruce
   FROM (((((((base b
     LEFT JOIN rasgos r ON (((r.participante_id = b.participante_id) AND (r.semana = b.semana))))
     LEFT JOIN semanal s ON (((s.participante_id = b.participante_id) AND (s.semana = b.semana))))
     LEFT JOIN semanal sp ON (((sp.participante_id = b.participante_id) AND (sp.semana = (b.semana - 7)))))
     LEFT JOIN estable e ON ((e.participante_id = b.participante_id)))
     LEFT JOIN etiqueta et ON (((et.participante_id = b.participante_id) AND (et.semana = b.semana))))
     LEFT JOIN etiqueta et1 ON (((et1.participante_id = b.participante_id) AND (et1.semana = (b.semana + 7)))))
     LEFT JOIN corte c ON ((c.participante_id = b.participante_id)))
  WHERE ((c.primera_alta IS NULL) OR (b.semana <= c.primera_alta));

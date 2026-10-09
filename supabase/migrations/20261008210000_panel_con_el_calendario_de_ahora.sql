-- El panel del investigador, con el check-in de lunes a jueves y el OLBI a demanda.
--
-- Desde el check-in v4 (`dias: [1,2,3,4]`) no hay nada que contestar el
-- viernes, y el OLBI ya no es semanal para todos. Dos vistas seguían con el
-- calendario de antes:
--
--   adherencia   esperaba un check-in de lunes a viernes y contaba el OLBI del
--                viernes como un día cumplido. Quien no falla ninguno se
--                quedaba en un 80 %, y cada viernes sumaba un día «sin
--                responder». Ahora cuenta solo el check-in, en sus días, que
--                salen de la definición vigente del formulario.
--                `viernes_esperados` / `viernes_cumplidos` conservan el nombre
--                (las vistas que dependen de esta no dejan cambiarlo) pero ya
--                son semanas en que se pidió el OLBI / en que se contestó.
--
--   bandeja_investigador
--                «sin_viernes» avisaba de cada persona sin OLBI el último
--                viernes: con el sistema actual, casi todas, cada semana. Pasa
--                a `olbi_sin_contestar`: se le pidió el OLBI en una semana ya
--                cerrada y no lo ha contestado desde entonces.

create or replace function es_dia_de_checkin(d date)
returns boolean language sql stable as $$
  select extract(isodow from d)::int in (
    select (jsonb_array_elements_text(f.definicion -> 'dias'))::int
      from (select definicion from formularios where clave = 'diario' order by version desc limit 1) f)
$$;

create or replace function dias_de_checkin(desde date, hasta date)
returns integer language sql stable as $$
  select count(*)::int
    from generate_series(desde, hasta - 1, interval '1 day') d
   where desde < hasta and es_dia_de_checkin(d::date)
$$;

create or replace view adherencia
with (security_invoker = on) as
 WITH hoy AS (
         SELECT ((now() AT TIME ZONE tz_estudio()))::date AS dia
        ), inicio AS (
         SELECT p.id AS participante_id,
            p.organizacion_id,
            p.codigo_anonimo,
            (COALESCE(( SELECT min(e.ocurrido_en) AS min
                   FROM eventos e
                  WHERE ((e.trabajador_id = p.id) AND (e.tipo = 'inicio_seguimiento'::tipo_evento))), p.inscrito_en) AT TIME ZONE tz_estudio()) AS inicio_ts
           FROM trabajadores p
          WHERE (p.estado = 'activo'::estado_trabajador)
        ), envios AS (
         SELECT r.trabajador_id AS participante_id,
            r.formulario_clave,
            ((r.enviado_en AT TIME ZONE tz_estudio()))::date AS dia_envio
           FROM respuestas r
          WHERE (r.formulario_clave = 'diario'::text)
        ), dias_cumplidos AS (
         SELECT DISTINCT envios.participante_id,
            envios.dia_envio AS dia
           FROM envios
          WHERE es_dia_de_checkin(envios.dia_envio)
        ), base AS (
         SELECT i.participante_id,
            i.organizacion_id,
            i.codigo_anonimo,
            (i.inicio_ts)::date AS inicio_seguimiento,
            ( SELECT max(d.dia) AS max
                   FROM dias_cumplidos d
                  WHERE (d.participante_id = i.participante_id)) AS ultimo_checkin,
            ( SELECT count(*) AS count
                   FROM dias_cumplidos d,
                    hoy hoy_1
                  WHERE ((d.participante_id = i.participante_id) AND (d.dia < hoy_1.dia) AND (d.dia >= (i.inicio_ts)::date))) AS cumplidos,
            ( SELECT dias_de_checkin((i.inicio_ts)::date, hoy_1.dia) AS dias_de_checkin
                   FROM hoy hoy_1) AS esperados,
            ( SELECT count(DISTINCT semana_de(e.ocurrido_en)) AS count
                   FROM eventos e, hoy hoy_1
                  WHERE ((e.trabajador_id = i.participante_id) AND (e.tipo = 'olbi_requerido'::tipo_evento) AND (semana_de(e.ocurrido_en) < (date_trunc('week'::text, (hoy_1.dia)::timestamp with time zone))::date))) AS viernes_esperados,
            ( SELECT count(DISTINCT semana_de(e.ocurrido_en)) AS count
                   FROM eventos e, hoy hoy_1
                  WHERE ((e.trabajador_id = i.participante_id) AND (e.tipo = 'olbi_requerido'::tipo_evento) AND (semana_de(e.ocurrido_en) < (date_trunc('week'::text, (hoy_1.dia)::timestamp with time zone))::date)
                    AND (EXISTS ( SELECT 1 FROM olbi_semanal_etiquetado o WHERE ((o.trabajador_id = i.participante_id) AND (o.semana = semana_de(e.ocurrido_en))))))) AS viernes_cumplidos
           FROM inicio i
        )
 SELECT b.participante_id AS trabajador_id,
    b.organizacion_id,
    b.codigo_anonimo,
    b.inicio_seguimiento,
    b.ultimo_checkin,
    b.esperados AS dias_esperados,
    b.cumplidos AS dias_cumplidos,
        CASE
            WHEN (b.esperados = 0) THEN NULL::numeric
            ELSE round(((LEAST(b.cumplidos, (b.esperados)::bigint))::numeric / (b.esperados)::numeric), 3)
        END AS tasa_adherencia,
        CASE
            WHEN (b.ultimo_checkin IS NULL) THEN b.esperados
            ELSE dias_de_checkin((b.ultimo_checkin + 1), (hoy.dia + 1))
        END AS dias_sin_checkin,
        CASE
            WHEN ((b.ultimo_checkin IS NULL) AND (b.esperados = 0)) THEN 'al_dia'::text
            WHEN (b.ultimo_checkin IS NULL) THEN 'nunca_inicio'::text
            WHEN (dias_de_checkin((b.ultimo_checkin + 1), (hoy.dia + 1)) < corte_en_riesgo()) THEN 'al_dia'::text
            WHEN (dias_de_checkin((b.ultimo_checkin + 1), (hoy.dia + 1)) < corte_inactivo()) THEN 'en_riesgo'::text
            ELSE 'inactivo'::text
        END AS estado_adherencia,
    b.viernes_esperados,
    b.viernes_cumplidos
   FROM base b,
    hoy;

create or replace view bandeja_investigador
with (security_invoker = on) as
 WITH hoy AS (
         SELECT ((now() AT TIME ZONE tz_estudio()))::date AS dia
        ), inactivos AS (
         SELECT 'inactivo'::text AS tipo,
            a.trabajador_id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            a.trabajador_id AS referencia_id,
            (a.ultimo_checkin)::timestamp with time zone AS desde,
            a.dias_sin_checkin AS dias
           FROM (adherencia a
             JOIN trabajadores p ON ((p.id = a.trabajador_id)))
          WHERE ((p.estado = 'activo'::estado_trabajador) AND (a.dias_sin_checkin >= 4))
        ), sin_viernes AS (
         SELECT 'olbi_sin_contestar'::text AS tipo,
            p.id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            p.id AS referencia_id,
            r.pedido AS desde,
            (hoy.dia - ((r.pedido AT TIME ZONE tz_estudio()))::date) AS dias
           FROM trabajadores p,
            hoy,
            LATERAL ( SELECT max(e.ocurrido_en) AS pedido
                   FROM eventos e
                  WHERE ((e.trabajador_id = p.id) AND (e.tipo = 'olbi_requerido'::tipo_evento)
                    AND (semana_de(e.ocurrido_en) < (date_trunc('week'::text, (hoy.dia)::timestamp with time zone))::date)
                    AND (NOT (EXISTS ( SELECT 1 FROM respuestas x
                          WHERE ((x.trabajador_id = p.id) AND (x.formulario_clave = 'olbi'::text) AND (x.enviado_en >= e.ocurrido_en))))))) r
          WHERE ((p.estado = 'activo'::estado_trabajador) AND (r.pedido IS NOT NULL))
        ), det_sin_deriv AS (
         SELECT 'deteccion_sin_derivacion'::text AS tipo,
            e.trabajador_id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            e.trabajador_id AS referencia_id,
            e.ocurrido_en AS desde,
            (hoy.dia - ((e.ocurrido_en AT TIME ZONE tz_estudio()))::date) AS dias
           FROM (eventos e
             JOIN trabajadores p ON ((p.id = e.trabajador_id))),
            hoy
          WHERE ((e.tipo = 'deteccion'::tipo_evento) AND (NOT (EXISTS ( SELECT 1
                   FROM derivaciones d
                  WHERE ((d.trabajador_id = e.trabajador_id) AND (d.abierta_en >= (e.ocurrido_en - '00:01:00'::interval)))))))
        ), deriv_sin_sesion AS (
         SELECT 'derivacion_sin_sesion'::text AS tipo,
            c.trabajador_id AS participante_id,
            c.codigo_anonimo,
            c.organizacion_id,
            c.derivacion_id AS referencia_id,
            c.derivado_en AS desde,
            (hoy.dia - ((c.derivado_en AT TIME ZONE tz_estudio()))::date) AS dias
           FROM circuito_apoyo c,
            hoy
          WHERE ((c.estado = 'sin_sesion'::text) AND (c.cerrada_en IS NULL) AND (c.derivado_en < (now() - '7 days'::interval)))
        ), cita_sin_confirmar AS (
         SELECT 'cita_sin_confirmar'::text AS tipo,
            ci.trabajador_id AS participante_id,
            ci.codigo_anonimo,
            ci.organizacion_id,
            ci.id AS referencia_id,
            ci.creada_en AS desde,
            (hoy.dia - ((ci.creada_en AT TIME ZONE tz_estudio()))::date) AS dias
           FROM citas_estudio ci,
            hoy
          WHERE ((ci.estado = 'solicitada'::estado_cita) AND (ci.creada_en < (now() - '2 days'::interval)))
        ), informe_pend AS (
         SELECT 'informe_pendiente'::text AS tipo,
            c.trabajador_id AS participante_id,
            c.codigo_anonimo,
            c.organizacion_id,
            c.derivacion_id AS referencia_id,
            c.primera_sesion_en AS desde,
            (hoy.dia - ((c.primera_sesion_en AT TIME ZONE tz_estudio()))::date) AS dias
           FROM circuito_apoyo c,
            hoy
          WHERE ((c.estado = ANY (ARRAY['informe_pendiente'::text, 'sesion_realizada'::text])) AND (c.informe_aprobado_en IS NULL) AND (c.primera_sesion_en < (now() - '7 days'::interval)))
        ), consent_pend AS (
         SELECT 'consentimiento_pendiente'::text AS tipo,
            p.id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            p.id AS referencia_id,
            p.inscrito_en AS desde,
            (hoy.dia - ((p.inscrito_en AT TIME ZONE tz_estudio()))::date) AS dias
           FROM trabajadores p,
            hoy
          WHERE ((p.estado = 'activo'::estado_trabajador) AND (p.inscrito_en < (now() - '7 days'::interval)) AND (NOT (EXISTS ( SELECT 1
                   FROM consentimientos c
                  WHERE (c.trabajador_id = p.id)))))
        )
 SELECT b.tipo,
    b.participante_id AS trabajador_id,
    b.codigo_anonimo,
    b.organizacion_id,
    b.referencia_id,
    b.desde,
    b.dias,
    o.nombre AS empresa
   FROM (( SELECT inactivos.tipo,
            inactivos.participante_id,
            inactivos.codigo_anonimo,
            inactivos.organizacion_id,
            inactivos.referencia_id,
            inactivos.desde,
            inactivos.dias
           FROM inactivos
        UNION ALL
         SELECT sin_viernes.tipo,
            sin_viernes.participante_id,
            sin_viernes.codigo_anonimo,
            sin_viernes.organizacion_id,
            sin_viernes.referencia_id,
            sin_viernes.desde,
            sin_viernes.dias
           FROM sin_viernes
        UNION ALL
         SELECT det_sin_deriv.tipo,
            det_sin_deriv.participante_id,
            det_sin_deriv.codigo_anonimo,
            det_sin_deriv.organizacion_id,
            det_sin_deriv.referencia_id,
            det_sin_deriv.desde,
            det_sin_deriv.dias
           FROM det_sin_deriv
        UNION ALL
         SELECT deriv_sin_sesion.tipo,
            deriv_sin_sesion.participante_id,
            deriv_sin_sesion.codigo_anonimo,
            deriv_sin_sesion.organizacion_id,
            deriv_sin_sesion.referencia_id,
            deriv_sin_sesion.desde,
            deriv_sin_sesion.dias
           FROM deriv_sin_sesion
        UNION ALL
         SELECT cita_sin_confirmar.tipo,
            cita_sin_confirmar.participante_id,
            cita_sin_confirmar.codigo_anonimo,
            cita_sin_confirmar.organizacion_id,
            cita_sin_confirmar.referencia_id,
            cita_sin_confirmar.desde,
            cita_sin_confirmar.dias
           FROM cita_sin_confirmar
        UNION ALL
         SELECT informe_pend.tipo,
            informe_pend.participante_id,
            informe_pend.codigo_anonimo,
            informe_pend.organizacion_id,
            informe_pend.referencia_id,
            informe_pend.desde,
            informe_pend.dias
           FROM informe_pend
        UNION ALL
         SELECT consent_pend.tipo,
            consent_pend.participante_id,
            consent_pend.codigo_anonimo,
            consent_pend.organizacion_id,
            consent_pend.referencia_id,
            consent_pend.desde,
            consent_pend.dias
           FROM consent_pend) b
     LEFT JOIN organizaciones o ON ((o.id = b.organizacion_id)))
  WHERE es_investigador();

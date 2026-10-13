-- La PWA del trabajador no ofrece apoyo psicológico: si su OLBI sale alto,
-- `evaluar-olbi` registra la detección con `sin_derivar` y no abre caso.
-- La bandeja no debe pedir una derivación que no corresponde.
--
-- Afecta también a `main`: la base es compartida (en main nadie manda
-- `sin_derivar`, así que no cambia nada allí).

create or replace view bandeja_investigador
with (security_invoker = on) as
 WITH hoy AS (
         SELECT (now() AT TIME ZONE tz_estudio())::date AS dia
        ), inactivos AS (
         SELECT 'inactivo'::text AS tipo,
            a.trabajador_id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            a.trabajador_id AS referencia_id,
            (a.ultimo_checkin::timestamp without time zone AT TIME ZONE tz_estudio()) AS desde,
            a.dias_sin_checkin AS dias
           FROM adherencia a
             JOIN trabajadores p ON p.id = a.trabajador_id
          WHERE p.estado = 'activo'::estado_trabajador AND a.dias_sin_checkin >= 4
        ), sin_viernes AS (
         SELECT 'olbi_sin_contestar'::text AS tipo,
            p.id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            p.id AS referencia_id,
            r.pedido AS desde,
            hoy.dia - (r.pedido AT TIME ZONE tz_estudio())::date AS dias
           FROM trabajadores p,
            hoy,
            LATERAL ( SELECT max(e.ocurrido_en) AS pedido
                   FROM eventos e
                  WHERE e.trabajador_id = p.id AND e.tipo = 'olbi_requerido'::tipo_evento AND semana_de(e.ocurrido_en) < date_trunc('week'::text, hoy.dia::timestamp with time zone)::date AND NOT (EXISTS ( SELECT 1
                           FROM respuestas x
                          WHERE x.trabajador_id = p.id AND x.formulario_clave = 'olbi'::text AND x.enviado_en >= e.ocurrido_en))) r
          WHERE p.estado = 'activo'::estado_trabajador AND r.pedido IS NOT NULL
        ), det_sin_deriv AS (
         SELECT 'deteccion_sin_derivacion'::text AS tipo,
            e.trabajador_id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            e.trabajador_id AS referencia_id,
            e.ocurrido_en AS desde,
            hoy.dia - (e.ocurrido_en AT TIME ZONE tz_estudio())::date AS dias
           FROM eventos e
             JOIN trabajadores p ON p.id = e.trabajador_id,
            hoy
          WHERE e.tipo = 'deteccion'::tipo_evento AND COALESCE(e.metadata ->> 'sin_derivar'::text, 'false'::text) <> 'true'::text AND NOT (EXISTS ( SELECT 1
                   FROM derivaciones d
                  WHERE d.trabajador_id = e.trabajador_id AND d.abierta_en >= (e.ocurrido_en - '00:01:00'::interval)))
        ), deriv_sin_sesion AS (
         SELECT 'derivacion_sin_sesion'::text AS tipo,
            c.trabajador_id AS participante_id,
            c.codigo_anonimo,
            c.organizacion_id,
            c.derivacion_id AS referencia_id,
            c.derivado_en AS desde,
            hoy.dia - (c.derivado_en AT TIME ZONE tz_estudio())::date AS dias
           FROM circuito_apoyo c,
            hoy
          WHERE c.estado = 'sin_sesion'::text AND c.cerrada_en IS NULL AND c.derivado_en < (now() - '7 days'::interval)
        ), cita_sin_confirmar AS (
         SELECT 'cita_sin_confirmar'::text AS tipo,
            ci.trabajador_id AS participante_id,
            ci.codigo_anonimo,
            ci.organizacion_id,
            ci.id AS referencia_id,
            ci.creada_en AS desde,
            hoy.dia - (ci.creada_en AT TIME ZONE tz_estudio())::date AS dias
           FROM citas_estudio ci,
            hoy
          WHERE ci.estado = 'solicitada'::estado_cita AND ci.creada_en < (now() - '2 days'::interval)
        ), informe_pend AS (
         SELECT 'informe_pendiente'::text AS tipo,
            c.trabajador_id AS participante_id,
            c.codigo_anonimo,
            c.organizacion_id,
            c.derivacion_id AS referencia_id,
            c.primera_sesion_en AS desde,
            hoy.dia - (c.primera_sesion_en AT TIME ZONE tz_estudio())::date AS dias
           FROM circuito_apoyo c,
            hoy
          WHERE (c.estado = ANY (ARRAY['informe_pendiente'::text, 'sesion_realizada'::text])) AND c.informe_aprobado_en IS NULL AND c.primera_sesion_en < (now() - '7 days'::interval)
        ), consent_pend AS (
         SELECT 'consentimiento_pendiente'::text AS tipo,
            p.id AS participante_id,
            p.codigo_anonimo,
            p.organizacion_id,
            p.id AS referencia_id,
            p.inscrito_en AS desde,
            hoy.dia - (p.inscrito_en AT TIME ZONE tz_estudio())::date AS dias
           FROM trabajadores p,
            hoy
          WHERE p.estado = 'activo'::estado_trabajador AND p.inscrito_en < (now() - '7 days'::interval) AND NOT (EXISTS ( SELECT 1
                   FROM consentimientos c
                  WHERE c.trabajador_id = p.id))
        )
 SELECT b.tipo,
    b.participante_id AS trabajador_id,
    b.codigo_anonimo,
    b.organizacion_id,
    b.referencia_id,
    b.desde,
    b.dias,
    o.nombre AS empresa
   FROM ( SELECT inactivos.tipo,
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
     LEFT JOIN organizaciones o ON o.id = b.organizacion_id
  WHERE es_investigador();

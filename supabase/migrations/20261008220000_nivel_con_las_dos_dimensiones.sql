-- El nivel de cada persona en el panel del investigador, con la regla de la detección.
--
-- `olbi_nivel` decía «alto» con que una de las dos notas pasara su corte, y
-- `evaluar-olbi` solo deriva con las dos. Una persona podía salir «alto» en
-- Trabajadores y en el Resumen sin que el sistema la hubiera derivado nunca.
-- Ahora «alto» es `olbi_semanal_etiquetado.alto` (las dos dimensiones); quien
-- pasa solo una queda en «a vigilar», que ya cubría estar cerca de un corte.

create or replace view panel_trabajadores_v2
with (security_invoker = on) as
 WITH adh AS MATERIALIZED (
         SELECT adherencia.trabajador_id AS participante_id,
            adherencia.organizacion_id,
            adherencia.codigo_anonimo,
            adherencia.inicio_seguimiento,
            adherencia.ultimo_checkin,
            adherencia.dias_esperados,
            adherencia.dias_cumplidos,
            adherencia.tasa_adherencia,
            adherencia.dias_sin_checkin,
            adherencia.estado_adherencia,
            adherencia.viernes_esperados,
            adherencia.viernes_cumplidos
           FROM adherencia
        ), ultimo_olbi AS MATERIALIZED (
         SELECT DISTINCT ON (olbi_semanal_etiquetado.trabajador_id) olbi_semanal_etiquetado.trabajador_id AS participante_id,
            olbi_semanal_etiquetado.semana,
            olbi_semanal_etiquetado.agotamiento,
            olbi_semanal_etiquetado.desvinculacion,
            olbi_semanal_etiquetado.alto,
            olbi_semanal_etiquetado.umbral_agotamiento,
            olbi_semanal_etiquetado.umbral_desvinculacion
           FROM olbi_semanal_etiquetado
          ORDER BY olbi_semanal_etiquetado.trabajador_id, olbi_semanal_etiquetado.semana DESC
        ), nowcast AS MATERIALIZED (
         SELECT DISTINCT ON (predicciones_trabajador.trabajador_id) predicciones_trabajador.trabajador_id AS participante_id,
            predicciones_trabajador.probabilidad,
            predicciones_trabajador.n_dias,
            predicciones_trabajador.dia,
            predicciones_trabajador.version
           FROM predicciones_trabajador
          WHERE ((predicciones_trabajador.tarea = 'nowcast'::text) AND (predicciones_trabajador.semana = (date_trunc('week'::text, (((now() AT TIME ZONE tz_estudio()))::date)::timestamp with time zone))::date))
          ORDER BY predicciones_trabajador.trabajador_id, predicciones_trabajador.ocurrido_en DESC
        ), deriv AS MATERIALIZED (
         SELECT DISTINCT ON (circuito_apoyo.trabajador_id) circuito_apoyo.trabajador_id AS participante_id,
            circuito_apoyo.derivacion_id,
            circuito_apoyo.psicologo,
            circuito_apoyo.estado AS estado_derivacion,
            circuito_apoyo.origen
           FROM circuito_apoyo
          WHERE (circuito_apoyo.cerrada_en IS NULL)
          ORDER BY circuito_apoyo.trabajador_id, circuito_apoyo.derivado_en DESC
        ), cita AS MATERIALIZED (
         SELECT DISTINCT ON (citas_estudio.trabajador_id) citas_estudio.trabajador_id AS participante_id,
            citas_estudio.estado AS estado_cita,
            citas_estudio.propuesta_para
           FROM citas_estudio
          WHERE (citas_estudio.estado = ANY (ARRAY['solicitada'::estado_cita, 'confirmada'::estado_cita]))
          ORDER BY citas_estudio.trabajador_id, citas_estudio.creada_en DESC
        )
 SELECT p.id,
    p.codigo_anonimo,
    p.organizacion_id,
    o.nombre AS organizacion,
    p.estado,
    p.inscrito_en,
    GREATEST(1, ((floor((EXTRACT(epoch FROM (now() - p.inscrito_en)) / ((7 * 86400))::numeric)))::integer + 1)) AS semana,
    a.dias_sin_checkin,
    a.tasa_adherencia,
    a.estado_adherencia,
    a.dias_cumplidos,
    a.dias_esperados,
    u.semana AS olbi_semana,
    u.agotamiento AS olbi_agotamiento,
    u.desvinculacion AS olbi_desvinculacion,
    u.alto AS olbi_alto,
        CASE
            WHEN (u.agotamiento IS NULL) THEN NULL::text
            WHEN u.alto THEN 'alto'::text
            WHEN ((u.agotamiento >= (u.umbral_agotamiento - 0.5)) OR (u.desvinculacion >= (u.umbral_desvinculacion - 0.5))) THEN 'a_vigilar'::text
            ELSE 'bajo'::text
        END AS olbi_nivel,
    n.probabilidad AS nowcast,
    n.n_dias AS nowcast_dias,
    n.version AS nowcast_version,
    d.derivacion_id,
    d.psicologo,
    d.estado_derivacion,
    d.origen AS origen_derivacion,
    c.estado_cita,
    c.propuesta_para AS cita_para,
    ( SELECT e.ocurrido_en
           FROM eventos e
          WHERE ((e.trabajador_id = p.id) AND (e.tipo = 'deteccion'::tipo_evento))
          ORDER BY e.ocurrido_en DESC
         LIMIT 1) AS detectado_en
   FROM ((((((trabajadores p
     JOIN organizaciones o ON ((o.id = p.organizacion_id)))
     LEFT JOIN adh a ON ((a.participante_id = p.id)))
     LEFT JOIN ultimo_olbi u ON ((u.participante_id = p.id)))
     LEFT JOIN nowcast n ON ((n.participante_id = p.id)))
     LEFT JOIN deriv d ON ((d.participante_id = p.id)))
     LEFT JOIN cita c ON ((c.participante_id = p.id)))
  WHERE es_investigador();

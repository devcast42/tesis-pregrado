-- «Alto» en la etiqueta semanal = las dos dimensiones sobre su corte.
--
-- `evaluar-olbi` deriva al psicólogo solo si agotamiento Y desvinculación
-- pasan su umbral; esta vista marcaba «alto» con que pasara una. El panel
-- del investigador, la cohorte y la evaluación del modelo contaban así como
-- casos reales semanas que el producto nunca habría derivado (en los datos
-- de hoy, 6 «altos» frente a 3 detecciones). Ahora es la misma regla.

create or replace view olbi_semanal_etiquetado
with (security_invoker = on) as
 WITH umbral AS (
         SELECT (((formularios.definicion -> 'umbrales'::text) ->> 'agotamiento'::text))::numeric AS u_ag,
            (((formularios.definicion -> 'umbrales'::text) ->> 'desvinculacion'::text))::numeric AS u_dv
           FROM formularios
          WHERE (formularios.clave = 'olbi'::text)
          ORDER BY formularios.version DESC
         LIMIT 1
        ), por_respuesta AS (
         SELECT p.trabajador_id AS participante_id,
            p.respuesta_id,
            p.enviado_en,
            semana_de(p.enviado_en) AS semana,
            max(p.puntaje) FILTER (WHERE (p.dimension = 'agotamiento'::text)) AS agotamiento,
            max(p.puntaje) FILTER (WHERE (p.dimension = 'desvinculacion'::text)) AS desvinculacion
           FROM puntajes_olbi p
          GROUP BY p.trabajador_id, p.respuesta_id, p.enviado_en
        ), ultima_de_semana AS (
         SELECT DISTINCT ON (por_respuesta.participante_id, por_respuesta.semana) por_respuesta.participante_id,
            por_respuesta.respuesta_id,
            por_respuesta.enviado_en,
            por_respuesta.semana,
            por_respuesta.agotamiento,
            por_respuesta.desvinculacion
           FROM por_respuesta
          ORDER BY por_respuesta.participante_id, por_respuesta.semana, por_respuesta.enviado_en DESC
        )
 SELECT u.participante_id AS trabajador_id,
    u.respuesta_id,
    u.enviado_en,
    u.semana,
    u.agotamiento,
    u.desvinculacion,
    ((u.agotamiento >= um.u_ag) AND (u.desvinculacion >= um.u_dv)) AS alto,
    um.u_ag AS umbral_agotamiento,
    um.u_dv AS umbral_desvinculacion
   FROM ultima_de_semana u,
    umbral um;

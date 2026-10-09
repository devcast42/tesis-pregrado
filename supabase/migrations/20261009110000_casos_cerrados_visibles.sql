-- El psicólogo ve también sus casos cerrados.
--
-- `casos_psicologo` era security_invoker y unía `trabajadores`, cuya política
-- solo deja al psicólogo ver a quien tiene una derivación ABIERTA. Al cerrar un
-- caso desaparecía entero: la ficha volvía atrás a una pantalla caducada, la
-- lista decía «Todavía no te han derivado a nadie» y la sección «Cerrados» no
-- podía mostrar nunca nada.
--
-- Pasa a ejecutarse como su dueño y filtra a mano por el psicólogo que mira:
-- solo sus derivaciones. Lo que expone de un caso cerrado es código, empresa,
-- puntajes de la detección y estado de la sesión, no la identidad: nombre y
-- correo siguen en `obtener_identidad`, que exige el caso abierto.

create or replace view casos_psicologo
with (security_invoker = off) as
 WITH ultima_sesion AS (
         SELECT DISTINCT ON (sesiones_consulta.derivacion_id) sesiones_consulta.derivacion_id,
            sesiones_consulta.id AS sesion_id,
            sesiones_consulta.iniciada_en,
            sesiones_consulta.finalizada_en,
            sesiones_consulta.consentimiento_trabajador AS consentimiento_participante,
            sesiones_consulta.consentimiento_psicologo
           FROM sesiones_consulta
          ORDER BY sesiones_consulta.derivacion_id, sesiones_consulta.iniciada_en DESC
        ), deteccion AS (
         SELECT d_1.id AS derivacion_id,
            e.ocurrido_en,
            e.metadata
           FROM (derivaciones d_1
             JOIN LATERAL ( SELECT e_1.ocurrido_en,
                    e_1.metadata
                   FROM eventos e_1
                  WHERE ((e_1.id = d_1.evento_deteccion_id) OR ((d_1.evento_deteccion_id IS NULL) AND (e_1.trabajador_id = d_1.trabajador_id) AND (e_1.tipo = 'deteccion'::tipo_evento) AND (e_1.ocurrido_en <= d_1.abierta_en)))
                  ORDER BY e_1.ocurrido_en DESC
                 LIMIT 1) e ON (true))
        ), cita_viva AS (
         SELECT DISTINCT ON (citas.derivacion_id) citas.derivacion_id,
            citas.id AS cita_id,
            citas.propuesta_para,
            citas.motivo,
            citas.estado AS cita_estado
           FROM citas
          WHERE (citas.estado = ANY (ARRAY['solicitada'::estado_cita, 'confirmada'::estado_cita]))
          ORDER BY citas.derivacion_id, citas.propuesta_para
        )
 SELECT d.id AS derivacion_id,
    d.trabajador_id,
    d.origen,
    p.codigo_anonimo,
    o.nombre AS empresa,
    d.abierta_en,
    d.cerrada_en,
    det.ocurrido_en AS detectado_en,
    (det.metadata -> 'puntajes'::text) AS puntajes,
    (det.metadata -> 'umbrales'::text) AS umbrales,
    s.sesion_id,
    s.iniciada_en AS sesion_iniciada_en,
    s.finalizada_en AS sesion_finalizada_en,
    s.consentimiento_participante AS consentimiento_trabajador,
    s.consentimiento_psicologo,
    i.estado AS informe_estado,
    c.cita_id,
    c.propuesta_para AS cita_para,
    c.motivo AS cita_motivo,
    c.cita_estado,
        CASE
            WHEN (d.cerrada_en IS NOT NULL) THEN 'cerrado'::text
            WHEN (i.estado = 'sin_revisar'::estado_informe) THEN 'informe_por_aprobar'::text
            WHEN ((s.sesion_id IS NOT NULL) AND (s.finalizada_en IS NULL)) THEN 'sala_lista'::text
            WHEN (c.cita_estado = 'solicitada'::estado_cita) THEN 'cita_por_confirmar'::text
            WHEN (c.cita_estado = 'confirmada'::estado_cita) THEN 'cita_confirmada'::text
            ELSE 'sesion_pendiente'::text
        END AS estado_caso
   FROM ((((((derivaciones d
     JOIN trabajadores p ON ((p.id = d.trabajador_id)))
     LEFT JOIN organizaciones o ON ((o.id = p.organizacion_id)))
     LEFT JOIN deteccion det ON ((det.derivacion_id = d.id)))
     LEFT JOIN ultima_sesion s ON ((s.derivacion_id = d.id)))
     LEFT JOIN informes i ON ((i.sesion_id = s.sesion_id)))
     LEFT JOIN cita_viva c ON ((c.derivacion_id = d.id)))
  WHERE (d.psicologo_id = psicologo_actual());

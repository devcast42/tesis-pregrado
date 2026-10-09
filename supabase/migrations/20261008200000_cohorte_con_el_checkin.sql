-- La cohorte, con lo que contesta todo el grupo.
--
-- `cohorte_semanal` solo sabía del OLBI, que era para todos cada viernes.
-- Ahora el cuestionario se pide a quien el modelo señala, por sorteo, al mes
-- o tras un alta: su media es la de un grupo con más riesgo que el promedio
-- y la tasa de respuesta ya no mide participación. Se añaden, al final:
--   respondieron_checkin          personas con al menos un check-in esa semana
--   checkin_agotamiento_media     media de od_04 y od_12 (escala 1-5)
--   checkin_desvinculacion_media  media de od_03 y od_06 (escala 1-5)
--   pasaron_umbral                cuántas, no qué porcentaje, cruzaron esa semana

create or replace view cohorte_semanal
with (security_invoker = on) as
 WITH semanas AS (
         SELECT DISTINCT olbi_semanal_etiquetado.semana
           FROM olbi_semanal_etiquetado
        UNION
         SELECT DISTINCT semana_de(respuestas.enviado_en) AS semana_de
           FROM respuestas
          WHERE (respuestas.formulario_clave = 'diario'::text)
        ), orgs AS (
         SELECT organizaciones.id AS organizacion_id
           FROM organizaciones
        UNION ALL
         SELECT NULL::uuid
        ), olbi AS (
         SELECT pa.organizacion_id,
            o.semana,
            count(*) AS respondieron_viernes,
            round(avg(o.agotamiento), 2) AS olbi_agotamiento_media,
            round(avg(o.desvinculacion), 2) AS olbi_desvinculacion_media,
            round((100.0 * avg((o.alto)::integer)), 1) AS pct_alto,
            count(*) FILTER (WHERE o.alto) AS pasaron_umbral
           FROM (olbi_semanal_etiquetado o
             JOIN trabajadores pa ON ((pa.id = o.trabajador_id)))
          GROUP BY GROUPING SETS ((pa.organizacion_id, o.semana), (o.semana))
        ), fact AS (
         SELECT factores_semana_inv.organizacion_id,
            factores_semana_inv.semana,
            round(avg(factores_semana_inv.horas_dia), 2) AS horas_dia_media,
            round(avg(factores_semana_inv.sueno), 2) AS sueno_media,
            round(avg(factores_semana_inv.fin_de_semana), 2) AS fin_de_semana_media,
            round(avg(factores_semana_inv.sobretiempo), 2) AS sobretiempo_media,
            round((100.0 * avg(factores_semana_inv.guardia)), 1) AS guardia_pct,
            round(avg(factores_semana_inv.apoyo_lider), 2) AS apoyo_lider_media
           FROM factores_semana_inv
          GROUP BY GROUPING SETS ((factores_semana_inv.organizacion_id, factores_semana_inv.semana), (factores_semana_inv.semana))
        ), diario_r AS (
         SELECT r.trabajador_id, pa.organizacion_id, semana_de(r.enviado_en) AS semana,
            avg(i.valor_num) FILTER (WHERE i.item_clave = ANY (ARRAY['od_04'::text, 'od_12'::text])) AS e,
            avg(i.valor_num) FILTER (WHERE i.item_clave = ANY (ARRAY['od_03'::text, 'od_06'::text])) AS d
           FROM respuestas r
             JOIN trabajadores pa ON pa.id = r.trabajador_id
             LEFT JOIN respuestas_items i ON i.respuesta_id = r.id
          WHERE r.formulario_clave = 'diario'::text
          GROUP BY r.id, r.trabajador_id, pa.organizacion_id, (semana_de(r.enviado_en))
        ), diario AS (
         SELECT diario_r.organizacion_id, diario_r.semana,
            count(DISTINCT diario_r.trabajador_id) AS respondieron_checkin,
            round(avg(diario_r.e), 2) AS checkin_agotamiento_media,
            round(avg(diario_r.d), 2) AS checkin_desvinculacion_media
           FROM diario_r
          GROUP BY GROUPING SETS ((diario_r.organizacion_id, diario_r.semana), (diario_r.semana))
        ), estado AS (
         SELECT o.organizacion_id,
            s.semana,
            count(p.id) FILTER (WHERE (p.inscrito_en < (s.semana + 7))) AS inscritos,
            count(p.id) FILTER (WHERE ((p.inscrito_en < (s.semana + 7)) AND (p.estado = 'activo'::estado_trabajador))) AS activos,
            count(p.id) FILTER (WHERE ((p.inscrito_en < (s.semana + 7)) AND (p.estado = 'detectado'::estado_trabajador))) AS detectados,
            count(p.id) FILTER (WHERE ((p.inscrito_en < (s.semana + 7)) AND (p.estado = 'retirado'::estado_trabajador))) AS retirados,
            count(p.id) FILTER (WHERE ((p.inscrito_en < (s.semana + 7)) AND (p.estado = 'finalizado'::estado_trabajador))) AS finalizados
           FROM ((orgs o
             CROSS JOIN semanas s)
             LEFT JOIN trabajadores p ON (((o.organizacion_id IS NULL) OR (p.organizacion_id = o.organizacion_id))))
          GROUP BY o.organizacion_id, s.semana
        )
 SELECT e.organizacion_id,
    e.semana,
    e.inscritos,
    e.activos,
    e.detectados,
    e.retirados,
    e.finalizados,
    COALESCE(ol.respondieron_viernes, (0)::bigint) AS respondieron_viernes,
    ol.olbi_agotamiento_media,
    ol.olbi_desvinculacion_media,
    ol.pct_alto,
    f.horas_dia_media,
    f.sueno_media,
    f.fin_de_semana_media,
    f.sobretiempo_media,
    f.guardia_pct,
    f.apoyo_lider_media,
    COALESCE(ol.pasaron_umbral, (0)::bigint) AS pasaron_umbral,
    COALESCE(di.respondieron_checkin, (0)::bigint) AS respondieron_checkin,
    di.checkin_agotamiento_media,
    di.checkin_desvinculacion_media
   FROM (((estado e
     LEFT JOIN olbi ol ON (((ol.semana = e.semana) AND (NOT (ol.organizacion_id IS DISTINCT FROM e.organizacion_id)))))
     LEFT JOIN fact f ON (((f.semana = e.semana) AND (NOT (f.organizacion_id IS DISTINCT FROM e.organizacion_id)))))
     LEFT JOIN diario di ON (((di.semana = e.semana) AND (NOT (di.organizacion_id IS DISTINCT FROM e.organizacion_id)))))
  WHERE (e.inscritos > 0);

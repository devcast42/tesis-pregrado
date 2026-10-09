-- Personas: «lleva días sin contestar», en días de check-in.
--
-- `dias_sin_responder` restaba a CURRENT_DATE, que va en UTC: desde las 19:00
-- de Lima la respuesta de hoy salía «de ayer». Ahora es la fecha de Lima.
-- Y el panel marcaba «lleva días sin contestar» con 4 días naturales: con
-- el check-in de lunes a jueves, quien lo hizo el jueves salía marcado cada
-- lunes por la mañana. Se añade `dias_checkin_sin_responder`, que cuenta
-- solo días de check-in (como la bandeja del investigador).

create or replace view seguimiento_empresa
with (security_invoker = off) as
 WITH ultimo_olbi AS (
         SELECT DISTINCT ON (o.trabajador_id) o.trabajador_id AS participante_id,
            o.semana,
            o.agotamiento,
            o.desvinculacion
           FROM olbi_semana_trabajador o
          ORDER BY o.trabajador_id, o.semana DESC
        ), ultima_respuesta AS (
         SELECT respuestas.trabajador_id AS participante_id,
            max(((respuestas.enviado_en AT TIME ZONE tz_estudio()))::date) AS dia
           FROM respuestas
          GROUP BY respuestas.trabajador_id
        )
 SELECT p.id AS trabajador_id,
    p.organizacion_id,
    p.codigo_anonimo,
    i.nombre,
    p.estado,
    (p.inscrito_en)::date AS desde,
    ur.dia AS ultima_respuesta,
    (((now() AT TIME ZONE tz_estudio()))::date - ur.dia) AS dias_sin_responder,
    nivel_empresa('agotamiento'::text, uo.agotamiento) AS nivel_agotamiento,
    nivel_empresa('desvinculacion'::text, uo.desvinculacion) AS nivel_desvinculacion,
    uo.semana AS nivel_de_la_semana,
    (EXISTS ( SELECT 1
           FROM derivaciones d
          WHERE ((d.trabajador_id = p.id) AND (d.cerrada_en IS NULL)))) AS en_acompanamiento,
    i.correo_contacto,
    ( SELECT c.aceptado
           FROM consentimientos c
          WHERE (c.trabajador_id = p.id)
          ORDER BY c.registrado_en DESC
         LIMIT 1) AS consentimiento,
    (p.estado = 'activo'::estado_trabajador) AS en_seguimiento,
    p.inscrito_en,
    ((NOT (EXISTS ( SELECT 1
           FROM derivaciones d
          WHERE ((d.trabajador_id = p.id) AND (d.cerrada_en IS NULL))))) AND (( SELECT max(d.cerrada_en) AS max
           FROM derivaciones d
          WHERE (d.trabajador_id = p.id)) > COALESCE(( SELECT max(r.enviado_en) AS max
           FROM respuestas r
          WHERE ((r.trabajador_id = p.id) AND (r.formulario_clave = 'olbi'::text))), '-infinity'::timestamp with time zone))) AS tras_alta,
    dias_de_checkin((ur.dia + 1), ((((now() AT TIME ZONE tz_estudio()))::date) + 1)) AS dias_checkin_sin_responder
   FROM (((trabajadores p
     LEFT JOIN identidades i ON ((i.trabajador_id = p.id)))
     LEFT JOIN ultimo_olbi uo ON ((uo.participante_id = p.id)))
     LEFT JOIN ultima_respuesta ur ON ((ur.participante_id = p.id)))
  WHERE alcance_empresa(p.organizacion_id);

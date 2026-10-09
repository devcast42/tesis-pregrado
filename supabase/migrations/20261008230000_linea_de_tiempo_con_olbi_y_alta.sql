-- La línea de tiempo de la ficha, con los dos hechos del flujo actual.
--
-- `olbi_requerido`: cuándo y por qué se le pidió el OLBI (modelo, sorteo, un
-- mes sin medirse, tras un alta). Sin él la ficha no explicaba por qué una
-- semana tiene cuestionario y otra no.
-- `derivacion_cerrada`: el alta, tras la que vuelve a sus check-ins y a los
-- 14 días se le mide otra vez.

create or replace view linea_tiempo_trabajador
with (security_invoker = on) as
 SELECT eventos.trabajador_id,
    (eventos.tipo)::text AS tipo,
    eventos.ocurrido_en,
    eventos.metadata
   FROM eventos
  WHERE ((eventos.tipo)::text = ANY (ARRAY['inicio_seguimiento'::text, 'deteccion'::text, 'derivacion_psicologo'::text, 'sesion_iniciada'::text, 'sesion_realizada'::text, 'salida_seguimiento'::text, 'alerta_adherencia'::text, 'acceso_identidad'::text, 'informe_aprobado'::text, 'cita_solicitada'::text, 'cita_confirmada'::text, 'cita_cancelada'::text, 'reasignacion_psicologo'::text, 'olbi_requerido'::text, 'derivacion_cerrada'::text]))
UNION ALL
 SELECT consentimientos.trabajador_id,
    'consentimiento'::text AS tipo,
    consentimientos.registrado_en AS ocurrido_en,
    jsonb_build_object('aceptado', consentimientos.aceptado, 'version_texto', consentimientos.version_texto) AS metadata
   FROM consentimientos
UNION ALL
 SELECT d.trabajador_id,
    'sesion_finalizada'::text AS tipo,
    s.finalizada_en AS ocurrido_en,
    jsonb_build_object('sesion_id', s.id, 'minutos', round((EXTRACT(epoch FROM (s.finalizada_en - s.iniciada_en)) / (60)::numeric))) AS metadata
   FROM (sesiones_consulta s
     JOIN derivaciones d ON ((d.id = s.derivacion_id)))
  WHERE (s.finalizada_en IS NOT NULL);

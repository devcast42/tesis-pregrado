-- ESP-002 / ESP-005 §4.2 — check-in diario v3: se añade el bloque de
-- RECUPERACIÓN.
--
-- POR QUÉ
--
-- Hasta v2 todo lo objetivo del diario medía *cuánto* se trabajó (horas,
-- sueño, fin de semana). La evidencia en burnout señala que la recuperación
-- pesa tanto o más que la carga: dos personas con la misma jornada difieren
-- en si lograron desconectar al terminar. La v2 no las puede distinguir.
--
-- Esto importa para la tesis, no solo para la app: el bloque objetivo es el
-- que sostiene la versión del modelo que NO usa ítems del OLBI (ESP-005 §4.3,
-- versión F). Sin recuperación, ese bloque es solo «horas» y se queda corto.
--
--   desconexion             qué tanto logró desconectar. Es un comportamiento,
--                           no una valoración del trabajo: por eso cuenta como
--                           rasgo objetivo y no reintroduce la circularidad de
--                           §3.3. Nótese que `od_04` pregunta algo cercano
--                           («necesitaré más tiempo para recuperarme») pero es
--                           un ítem del OLBI y cuenta como ánimo.
--   contacto_fuera_horario  hecho verificable. Explica por qué las guardias
--                           desgastan: no es estar de guardia, es que te
--                           interrumpan. Reformula el `trabajo_fuera_horario`
--                           de v1, que mezclaba quedarse por decisión propia
--                           con que te contacten.
--
-- Los cuatro ítems `od_*` NO cambian: cambiarlos rompería la transferencia del
-- preentrenamiento (ESP-005 §5.3). Las versiones anteriores no se borran: las
-- respuestas ya enviadas conservan su definición (RN-002-01, RN-002-02).

insert into formularios (clave, version, definicion) values ('diario', 3, '{
  "titulo": "Check-in de hoy",
  "descripcion": "Cuatro frases sobre tu día y unos datos. Responde con lo primero que se te venga.",
  "dias": [1, 2, 3, 4],
  "gracia_dias": 0,
  "barajar": ["od_04", "od_12", "od_03", "od_06"],
  "items": [
    { "clave": "od_04", "texto": "Hoy, después del trabajo, necesitaré más tiempo del habitual para relajarme y recuperarme.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo" } },
    { "clave": "od_12", "texto": "Hoy termino el trabajo exhausto y fatigado.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo" } },
    { "clave": "od_03", "texto": "Hoy hablé de mi trabajo de forma negativa.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo" } },
    { "clave": "od_06", "texto": "Hoy trabajé casi mecánicamente, sin pensar mucho en lo que hacía.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo" } },
    { "clave": "horas_trabajadas", "texto": "¿Cuántas horas trabajaste hoy?", "tipo": "numero" },
    { "clave": "horas_sueno", "texto": "¿Cuántas horas dormiste anoche?", "tipo": "numero" },
    { "clave": "desconexion", "texto": "Hoy, después de terminar de trabajar, logré desconectarme del trabajo.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Nada", "etiquetaMax": "Totalmente" } },
    { "clave": "contacto_fuera_horario", "texto": "¿Te contactaron por temas de trabajo fuera de tu horario hoy?", "tipo": "booleano" },
    { "clave": "horas_fin_de_semana", "texto": "¿Cuántas horas trabajaste el fin de semana? (0 si ninguna)", "tipo": "numero", "dias": [1] }
  ]
}'::jsonb)
on conflict (clave, version) do update set definicion = excluded.definicion;

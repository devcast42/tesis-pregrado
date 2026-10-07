-- Check-in diario · versión 4 — seis toques, sin teclado.
--
-- RAMA version-simplificada. NO APLICADA TODAVÍA: la base de datos es la
-- misma que usa `main`, y aplicar esto cambiaría también el formulario del
-- estudio. Aplicar solo cuando el producto tenga su propio proyecto.
--
-- Qué cambia respecto a v3:
--
--   Se quedan   Los 4 ítems od_* tal cual. No se tocan ni en texto ni en
--               escala: son los que coinciden con el estudio de referencia y
--               los que permiten que el modelo opine desde el primer día de
--               una empresa nueva. Cambiarlos rompe la transferencia.
--
--   Cambian     `horas_sueno` y `horas_trabajadas` pasan de número a rango.
--               Eran los dos únicos campos que abrían el teclado, tres veces
--               al día entre los dos, y son la razón de que el check-in se
--               sintiera un trámite. El `valor` de cada opción es el punto
--               medio del rango y es NUMÉRICO: así cae en `valor_num` y
--               `semanas_modelo` sigue leyéndolos sin tocar una línea de SQL.
--
--               Se pierde precisión y no importa: el modelo usa promedios de
--               la semana, y nadie recuerda si durmió 6.5 o 6.8.
--
--   Salen       `desconexion`, `contacto_fuera_horario` y `horas_fin_de_semana`.
--               Las dos primeras no entran en el modelo de producto; la
--               tercera abría el teclado un lunes de cada cuatro. Las columnas
--               que las derivaban siguen en `semanas_modelo` y quedan nulas
--               para las respuestas nuevas: nada se rompe, dejan de llenarse.
--
-- Las versiones anteriores NO se borran (RN-002-01): las respuestas ya
-- enviadas conservan la definición con la que se respondieron. La app lee
-- siempre la versión mayor.

insert into formularios (clave, version, definicion) values ('diario', 4, '{
  "titulo": "Check-in de hoy",
  "descripcion": "Seis toques. Nada más.",
  "duracion": "15 segundos",
  "dias": [1, 2, 3, 4],
  "gracia_dias": 0,
  "barajar": ["od_04", "od_12", "od_03", "od_06"],
  "items": [
    { "clave": "od_04", "texto": "Hoy, después del trabajo, necesitaré más tiempo del habitual para relajarme y recuperarme.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetas": ["Totalmente en desacuerdo", "Más bien en desacuerdo", "Ni sí ni no", "Más bien de acuerdo", "Totalmente de acuerdo"] } },
    { "clave": "od_12", "texto": "Hoy termino el trabajo exhausto y fatigado.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetas": ["Totalmente en desacuerdo", "Más bien en desacuerdo", "Ni sí ni no", "Más bien de acuerdo", "Totalmente de acuerdo"] } },
    { "clave": "od_03", "texto": "Hoy hablé de mi trabajo de forma negativa.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetas": ["Totalmente en desacuerdo", "Más bien en desacuerdo", "Ni sí ni no", "Más bien de acuerdo", "Totalmente de acuerdo"] } },
    { "clave": "od_06", "texto": "Hoy trabajé casi mecánicamente, sin pensar mucho en lo que hacía.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetas": ["Totalmente en desacuerdo", "Más bien en desacuerdo", "Ni sí ni no", "Más bien de acuerdo", "Totalmente de acuerdo"] } },
    { "clave": "horas_sueno", "texto": "¿Cuánto dormiste anoche?", "tipo": "opcion",
      "escala": { "emojis": ["😫", "😟", "🙂", "😄"] },
      "opciones": [
        { "valor": 5.0, "etiqueta": "Menos de 6 h" },
        { "valor": 6.5, "etiqueta": "6 a 7 h" },
        { "valor": 7.5, "etiqueta": "7 a 8 h" },
        { "valor": 8.5, "etiqueta": "Más de 8 h" }
      ] },
    { "clave": "horas_trabajadas", "texto": "¿Cuántas horas trabajaste hoy?", "tipo": "opcion",
      "escala": { "emojis": ["😄", "🙂", "😟", "😫"] },
      "opciones": [
        { "valor": 7.0, "etiqueta": "Menos de 8 h" },
        { "valor": 8.5, "etiqueta": "8 a 9 h" },
        { "valor": 9.5, "etiqueta": "9 a 10 h" },
        { "valor": 11.0, "etiqueta": "Más de 10 h" }
      ] }
  ]
}'::jsonb)
on conflict (clave, version) do update set definicion = excluded.definicion;

comment on table formularios is
  'Definiciones versionadas. La app lee la versión mayor de cada clave; las '
  'anteriores se conservan porque las respuestas las referencian (RN-002-01).';

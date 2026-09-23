-- Formularios · versión 2 — calendario semanal con preentrenamiento.
-- Implementa ESP-002 §4 (revisión 2). Diseño en
-- docs/diseno-semanal-con-preentrenamiento.md.
--
-- Qué cambia respecto a la versión 1:
--
--   diario   Lunes a jueves. Cuatro ítems del OLBI en versión diaria
--            (escala 1–5, solo negativos) + horas trabajadas + horas dormidas.
--            El lunes, además, horas trabajadas el fin de semana.
--   semanal  Viernes, inmediatamente después del OLBI. Tres ítems de
--            contexto de la semana (JD-R). Ya no existe como formulario
--            separado del OLBI: es su segunda página.
--   olbi     Viernes, semanal. Mismos 16 ítems, mismos umbrales. Solo cambian
--            título, descripción y calendario. Puede responderse sábado y
--            domingo si el viernes se pasó (gracia de 2 días).
--
-- Las versiones 1 NO se borran (RN-002-01, RN-002-02): las respuestas que las
-- referencian conservan su definición. La app lee siempre la versión mayor.
--
-- CALENDARIO EN LA DEFINICIÓN, NO EN LA APP
--
-- `dias` en el formulario: días ISO en los que corresponde (1 = lunes …
-- 7 = domingo). `gracia_dias`: cuántos días después sigue aceptándose.
-- `dias` en un ítem: días en los que ese ítem se muestra; sin `dias`, todos.
-- La app filtra por estos campos (ESP-002 RF-002-09). Mientras no lo haga,
-- mostrará todos los ítems todos los días: degradación tolerable, no error.
--
-- POR QUÉ LOS CUATRO ÍTEMS DIARIOS SON ESTOS Y EN ESCALA 1–5
--
-- Son ítems del OLBI (Anexo 07: olbi_04, olbi_12, olbi_03, olbi_06) puestos en
-- presente. Escala de cinco puntos, todos negativos: idéntico al diario de
-- Gruszczynska, Basinska y Schaufeli (2021, PLOS One, doi:10.1371/
-- journal.pone.0251257), cuyos datos públicos (Mendeley, doi:10.17632/
-- vwp3xvp2x8.2, CC BY 4.0) preentrenan el modelo (ESP-005 §5). Cambiar los
-- ítems, la redacción o la escala ROMPE la transferencia.
--
-- Estos cuatro ítems NO se puntúan como instrumento y no llevan `dimension`
-- ni `invertido` a propósito: así `puntajes_olbi` y `evaluar-olbi` nunca los
-- confunden con el OLBI. Son entradas del modelo. Nadie ve un "OLBI diario".
--
-- El orden de los ítems se baraja en cada presentación (`barajar: true`):
-- mismos ítems todos los días, distinto orden, contra la respuesta por
-- inercia. Rotar ítems distintos por día está descartado con datos
-- (docs/diseno-semanal-con-preentrenamiento.md §3.1).

-- ---------------------------------------------------------------------------
-- diario v2 — lunes a jueves, ~25 s
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('diario', 2, '{
  "titulo": "Check-in de hoy",
  "descripcion": "Cuatro frases sobre tu día y dos datos. Responde con lo primero que se te venga.",
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
    { "clave": "horas_fin_de_semana", "texto": "¿Cuántas horas trabajaste el fin de semana? (0 si ninguna)", "tipo": "numero", "dias": [1] }
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------
-- semanal v2 — viernes, segunda página del OLBI, ~30 s
--
-- Demandas (sobretiempo, guardias) y recursos (apoyo del líder): JD-R.
-- Se recorta de 7 ítems a 3. Los demás (proyectos, reuniones, autonomía,
-- claridad de rol) no tenían suficiente variación semana a semana para
-- justificar su costo en un formulario que ya lleva 16 ítems delante.
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('semanal', 2, '{
  "titulo": "Sobre tu semana",
  "descripcion": "Tres preguntas más y terminaste por esta semana.",
  "dias": [5],
  "gracia_dias": 2,
  "despues_de": "olbi",
  "items": [
    { "clave": "horas_sobretiempo", "texto": "¿Cuántas horas de sobretiempo hiciste esta semana?", "tipo": "numero" },
    { "clave": "guardias", "texto": "¿Estuviste de guardia o disponible fuera de horario esta semana?", "tipo": "booleano" },
    { "clave": "apoyo_lider", "texto": "Esta semana, cuando lo necesité, conté con el apoyo de mi líder.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Nunca", "etiquetaMax": "Siempre" } }
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------
-- olbi v2 — viernes, semanal, ~4 min
--
-- Se copia la definición de la versión 1 (ítems, escala, umbrales, versión
-- del umbral) y solo se cambian título, descripción y calendario. Copiar en
-- vez de reescribir evita el riesgo del que avisa la semilla original: un
-- `invertido` mal transcrito contamina toda una dimensión sin que nada falle.
--
-- `barajar: true` — el orden de los 16 ítems cambia cada viernes (retest).
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion)
select 'olbi', 2, definicion || '{
  "titulo": "Cuestionario del viernes",
  "descripcion": "Dieciséis afirmaciones sobre tu relación con el trabajo. No hay respuestas correctas.",
  "dias": [5],
  "gracia_dias": 2,
  "barajar": true
}'::jsonb
from formularios
where clave = 'olbi' and version = 1;

-- Sanidad: la versión 2 del OLBI conserva los 16 ítems y los umbrales.
do $$
declare
  n_items int;
  v_umbral text;
begin
  select jsonb_array_length(definicion->'items'), definicion->>'version_umbral'
    into n_items, v_umbral
    from formularios where clave = 'olbi' and version = 2;
  if n_items <> 16 or v_umbral is distinct from 'leclercq-2021' then
    raise exception 'olbi v2 mal construido: % ítems, umbral %', n_items, v_umbral;
  end if;
end $$;

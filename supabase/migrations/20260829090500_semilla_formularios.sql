-- Semilla de formularios — implementa ESP-002 §4.2.
--
-- Las variables contextuales se organizan bajo el modelo de Demandas y
-- Recursos Laborales (JD-R) de Demerouti, que es el mismo marco del que
-- deriva el OLBI. No son una lista arbitraria: son una operacionalización
-- de la teoría que sustenta el propio instrumento (ESP-002 §4.3).

-- ---------------------------------------------------------------------------
-- estable — una sola vez, al inscribirse (~2 min)
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('estable', 1, '{
  "titulo": "Datos iniciales",
  "descripcion": "Solo los responderás una vez. Nos ayudan a entender tu contexto de trabajo.",
  "items": [
    { "clave": "edad", "texto": "¿Cuántos años tienes?", "tipo": "numero" },
    { "clave": "rol", "texto": "¿Cuál describe mejor tu rol?", "tipo": "opcion",
      "opciones": [
        { "valor": "desarrollo", "etiqueta": "Desarrollo de software" },
        { "valor": "qa", "etiqueta": "QA o testing" },
        { "valor": "datos", "etiqueta": "Datos o analítica" },
        { "valor": "infraestructura", "etiqueta": "Infraestructura o DevOps" },
        { "valor": "soporte", "etiqueta": "Soporte técnico" },
        { "valor": "diseno", "etiqueta": "Diseño o UX" },
        { "valor": "gestion", "etiqueta": "Gestión de proyectos o producto" },
        { "valor": "otro", "etiqueta": "Otro" }
      ] },
    { "clave": "antiguedad_empresa", "texto": "¿Cuántos años llevas en tu empresa actual?", "tipo": "numero" },
    { "clave": "antiguedad_sector", "texto": "¿Cuántos años llevas trabajando en tecnología?", "tipo": "numero" },
    { "clave": "modalidad", "texto": "¿Cómo trabajas habitualmente?", "tipo": "opcion",
      "opciones": [
        { "valor": "remoto", "etiqueta": "Remoto" },
        { "valor": "hibrido", "etiqueta": "Híbrido" },
        { "valor": "presencial", "etiqueta": "Presencial" }
      ] },
    { "clave": "tamano_equipo", "texto": "¿Cuántas personas hay en tu equipo directo?", "tipo": "numero" },
    { "clave": "personas_a_cargo", "texto": "¿Tienes personas a tu cargo?", "tipo": "booleano" },
    { "clave": "minutos_traslado", "texto": "Cuando vas a la oficina, ¿cuántos minutos tardas en llegar? (0 si trabajas siempre remoto)", "tipo": "numero" }
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------
-- diario — check-in de ~30 s
--
-- Corto a propósito: se responde todos los días durante semanas, y la
-- adherencia es el mayor riesgo de campo del estudio (ESP-007 §1).
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('diario', 1, '{
  "titulo": "Check-in de hoy",
  "descripcion": "Cinco preguntas sobre tu día. Responde con lo primero que se te venga.",
  "items": [
    { "clave": "horas_trabajadas", "texto": "¿Cuántas horas trabajaste hoy?", "tipo": "numero" },
    { "clave": "horas_sueno", "texto": "¿Cuántas horas dormiste anoche?", "tipo": "numero" },
    { "clave": "carga_percibida", "texto": "¿Qué tan pesada sentiste la carga de trabajo hoy?", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Muy ligera", "etiquetaMax": "Muy pesada" } },
    { "clave": "energia_final", "texto": "¿Con cuánta energía terminaste el día?", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Agotado", "etiquetaMax": "Con energía" } },
    { "clave": "trabajo_fuera_horario", "texto": "¿Trabajaste fuera de tu horario habitual?", "tipo": "booleano" }
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------
-- semanal — ~1 min
--
-- Demandas (sobretiempo, proyectos, guardias, reuniones) y recursos
-- (autonomía, apoyo, claridad de rol): las dos mitades del modelo JD-R.
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('semanal', 1, '{
  "titulo": "Resumen semanal",
  "descripcion": "Sobre tu semana de trabajo.",
  "items": [
    { "clave": "horas_sobretiempo", "texto": "¿Cuántas horas de sobretiempo hiciste esta semana?", "tipo": "numero" },
    { "clave": "proyectos_simultaneos", "texto": "¿En cuántos proyectos distintos trabajaste?", "tipo": "numero" },
    { "clave": "guardias", "texto": "¿Estuviste de guardia o disponible fuera de horario?", "tipo": "booleano" },
    { "clave": "reuniones_por_dia", "texto": "En promedio, ¿cuántas reuniones tuviste por día?", "tipo": "numero" },
    { "clave": "autonomia", "texto": "Esta semana pude decidir cómo hacer mi trabajo.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Nunca", "etiquetaMax": "Siempre" } },
    { "clave": "apoyo_lider", "texto": "Cuando lo necesité, conté con el apoyo de mi líder.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Nunca", "etiquetaMax": "Siempre" } },
    { "clave": "claridad_rol", "texto": "Tuve claro qué se esperaba de mí.", "tipo": "escala",
      "escala": { "min": 1, "max": 5, "etiquetaMin": "Nunca", "etiquetaMax": "Siempre" } }
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------
-- olbi — quincenal, patrón oro del estudio
--
-- Ítems tomados del Anexo 07 de la tesis (versión validada en español).
--
-- ⚠️ SOBRE `invertido` Y LA DOBLE INVERSIÓN.
-- El Anexo 07 presenta la clave de puntuación ya invertida: en los ocho
-- enunciados positivos las columnas van 4-3-2-1 en lugar de 1-2-3-4.
--
-- La app NO guarda esa puntuación: guarda la POSICIÓN que marcó la persona
-- (1 = Totalmente en desacuerdo … 4 = Totalmente de acuerdo), y la inversión
-- la aplica la vista `puntajes_olbi` según este campo `invertido`.
--
-- Por eso NUNCA hay que hacer las dos cosas a la vez. Si alguien cargara los
-- valores ya invertidos del anexo Y dejara `invertido: true`, cada ítem
-- positivo se invertiría dos veces, volvería a su valor original, y los ocho
-- enunciados positivos quedarían contando al revés. Los puntajes parecerían
-- normales y estarían mal durante todo el estudio.
--
-- Invertidos (enunciados positivos, clave 4-3-2-1): 1, 5, 7, 10, 13, 14, 15, 16
--
-- UMBRALES — Leclercq et al. (2021), derivados por análisis ROC.
--
--   Leclercq, C., Braeckman, L., Firket, P., Babic, A., & Hansez, I. (2021).
--   Interest of a Joint Use of Two Diagnostic Tools of Burnout: Comparison
--   between the Oldenburg Burnout Inventory and the Early Detection Tool of
--   Burnout Completed by Physicians. International Journal of Environmental
--   Research and Public Health.
--
-- El estudio reporta los cortes sobre PUNTAJES SUMADOS; aquí se guardan como
-- MEDIAS porque la vista `puntajes_olbi` promedia. La conversión es dividir
-- entre el número de ítems:
--
--   Agotamiento     ≥ 23 / 8 ítems  = 2,875
--   Desvinculación  ≥ 22 / 8 ítems  = 2,750
--   Total           ≥ 44 / 16 ítems = 2,750   ← el corte validado por ROC
--
-- ⚠️ FALTA DECIDIR EL CRITERIO. Son dos criterios distintos y dan resultados
-- distintos:
--
--   (a) Ambas dimensiones sobre su corte — el que aplica hoy la función
--   (b) El puntaje TOTAL ≥ 44 — el que Leclercq validó con ROC
--
-- Alguien con agotamiento alto y desvinculación baja puede superar el total
-- sin superar ambas subescalas. El criterio (b) tiene el respaldo más fuerte;
-- el (a) es más conservador. Es decisión del asesor (ESP-003 §9, pendiente 2).
-- ---------------------------------------------------------------------------

insert into formularios (clave, version, definicion) values ('olbi', 1, '{
  "titulo": "Cuestionario quincenal",
  "descripcion": "Dieciséis afirmaciones sobre tu relación con el trabajo. No hay respuestas correctas.",
  "escala": { "min": 1, "max": 4 },
  "umbrales": { "agotamiento": 2.875, "desvinculacion": 2.75 },
  "umbral_total": 2.75,
  "version_umbral": "leclercq-2021",
  "items": [
    {"clave": "olbi_01", "texto": "Siempre encuentro aspectos nuevos e interesantes en mi trabajo.", "tipo": "escala", "dimension": "desvinculacion", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_02", "texto": "Hay días en los que me siento cansado antes de llegar al trabajo.", "tipo": "escala", "dimension": "agotamiento", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_03", "texto": "Cada vez con más frecuencia hablo de mi trabajo de forma negativa.", "tipo": "escala", "dimension": "desvinculacion", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_04", "texto": "Después del trabajo, necesito más tiempo que antes para relajarme y sentirme mejor.", "tipo": "escala", "dimension": "agotamiento", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_05", "texto": "Puedo tolerar muy bien la presión de mi trabajo.", "tipo": "escala", "dimension": "agotamiento", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_06", "texto": "Últimamente tiendo a pensar menos en el trabajo y realizo mis tareas casi de manera mecánica.", "tipo": "escala", "dimension": "desvinculacion", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_07", "texto": "Considero que mi trabajo representa un desafío positivo.", "tipo": "escala", "dimension": "desvinculacion", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_08", "texto": "Durante mi trabajo, con frecuencia me siento emocionalmente agotado.", "tipo": "escala", "dimension": "agotamiento", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_09", "texto": "Con el tiempo, una persona puede llegar a desconectarse de este tipo de trabajo.", "tipo": "escala", "dimension": "desvinculacion", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_10", "texto": "Después de trabajar, tengo suficiente energía para realizar mis actividades de ocio.", "tipo": "escala", "dimension": "agotamiento", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_11", "texto": "A veces siento rechazo o malestar hacia las tareas de mi trabajo.", "tipo": "escala", "dimension": "desvinculacion", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_12", "texto": "Después de trabajar, normalmente me siento agotado y exhausto.", "tipo": "escala", "dimension": "agotamiento", "invertido": false, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_13", "texto": "Este es el único tipo de trabajo en el que puedo imaginarme desempeñándome.", "tipo": "escala", "dimension": "desvinculacion", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_14", "texto": "Generalmente puedo manejar bien la cantidad de trabajo que tengo.", "tipo": "escala", "dimension": "agotamiento", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_15", "texto": "Me siento cada vez más comprometido con mi trabajo.", "tipo": "escala", "dimension": "desvinculacion", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}},
    {"clave": "olbi_16", "texto": "Cuando trabajo, por lo general me siento lleno de energía.", "tipo": "escala", "dimension": "agotamiento", "invertido": true, "escala": {"min": 1, "max": 4, "etiquetaMin": "Totalmente en desacuerdo", "etiquetaMax": "Totalmente de acuerdo"}}
  ]
}'::jsonb);

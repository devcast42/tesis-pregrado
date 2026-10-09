-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.
-- Versión preentrenada del modelo de ESP-005 (nowcast, v3: semanas de 5 días) con el diario OLBI de
-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos
-- de referencia, no sobre datos propios.

insert into modelo_versiones
  (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision, metricas, fuente, activa, visible_para)
values (
  'preentrenamiento-v3', 'preentrenamiento', 'nowcast',
  '["T_media", "T_ultimo", "T_max", "T_pendiente", "E_media", "D_media", "n_dias"]'::jsonb,
  '[2.30128, 2.306489, 2.771064, 0.007596, 2.43416, 2.168401, 3.0]'::jsonb,
  '[0.734026, 0.874719, 0.890035, 0.493347, 0.897504, 0.731129, 1.414214]'::jsonb,
  '[0.907422, -0.1342, 0.126422, 0.188581, 0.384514, 1.350022, -0.037965]'::jsonb,
  -2.003218, 0.5,
  '{"global": {"precision": 0.253, "recall": 0.84, "f1": 0.389, "pr_auc": 0.465, "roc_auc": 0.915, "brier": 0.118, "n": 2350, "positivos": 0.064}, "por_dias_respondidos": {"1": {"roc_auc": 0.845, "precision": 0.162, "recall": 0.7}, "2": {"roc_auc": 0.919, "precision": 0.227, "recall": 0.833}, "3": {"roc_auc": 0.931, "precision": 0.28, "recall": 0.867}, "4": {"roc_auc": 0.943, "precision": 0.321, "recall": 0.9}, "5": {"roc_auc": 0.955, "precision": 0.333, "recall": 0.9}}}'::jsonb,
  'Gruszczynska, Basinska & Schaufeli (2021), Mendeley Data doi:10.17632/vwp3xvp2x8.2, CC BY 4.0',
  false,
  array['investigador', 'psicologo', 'trabajador']
)
on conflict (version) do update set
  rasgos = excluded.rasgos, medias = excluded.medias, desviaciones = excluded.desviaciones,
  pesos = excluded.pesos, intercepto = excluded.intercepto, metricas = excluded.metricas;

-- En uso desde ya: el check-in pasa a ser de lunes a viernes y v2 solo
-- sabe opinar con 1 a 4 días.
update modelo_versiones set activa = false where tarea = 'nowcast' and version <> 'preentrenamiento-v3';
update modelo_versiones set activa = true where version = 'preentrenamiento-v3';

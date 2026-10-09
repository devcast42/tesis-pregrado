-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.
-- Versión preentrenada del modelo de ESP-005 (nowcast, v2: las dos dimensiones, como la detección) con el diario OLBI de
-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos
-- de referencia, no sobre datos propios.

insert into modelo_versiones
  (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision, metricas, fuente, activa, visible_para)
values (
  'preentrenamiento-v2', 'preentrenamiento', 'nowcast',
  '["T_media", "T_ultimo", "T_max", "T_pendiente", "E_media", "D_media", "n_dias"]'::jsonb,
  '[2.299978, 2.303191, 2.693617, 0.008418, 2.428923, 2.171033, 2.5]'::jsonb,
  '[0.755506, 0.873077, 0.894843, 0.537963, 0.925086, 0.754469, 1.118034]'::jsonb,
  '[0.138262, 0.24598, 0.170949, 0.00806, -0.02678, 0.309739, -0.064327]'::jsonb,
  -0.172759, 0.5,
  '{"global": {"precision": 0.301, "recall": 0.633, "f1": 0.408, "pr_auc": 0.345, "roc_auc": 0.695, "brier": 0.22, "n": 1880, "positivos": 0.191}, "por_dias_respondidos": {"1": {"roc_auc": 0.647, "precision": 0.267, "recall": 0.6}, "2": {"roc_auc": 0.688, "precision": 0.303, "recall": 0.656}, "3": {"roc_auc": 0.703, "precision": 0.304, "recall": 0.644}, "4": {"roc_auc": 0.752, "precision": 0.337, "recall": 0.633}}}'::jsonb,
  'Gruszczynska, Basinska & Schaufeli (2021), Mendeley Data doi:10.17632/vwp3xvp2x8.2, CC BY 4.0',
  false,
  array['investigador', 'psicologo', 'trabajador']
)
on conflict (version) do update set
  rasgos = excluded.rasgos, medias = excluded.medias, desviaciones = excluded.desviaciones,
  pesos = excluded.pesos, intercepto = excluded.intercepto, metricas = excluded.metricas;

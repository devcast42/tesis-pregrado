-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.
-- Versión preentrenada del modelo de ESP-005 (nowcast) con el diario OLBI de
-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos
-- de referencia, no sobre datos propios.

insert into modelo_versiones
  (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision, metricas, fuente, activa, visible_para)
values (
  'preentrenamiento-v1', 'preentrenamiento', 'nowcast',
  '["T_media", "T_ultimo", "T_max", "T_pendiente", "E_media", "D_media", "n_dias"]'::jsonb,
  '[2.299978, 2.303191, 2.693617, 0.008418, 2.428923, 2.171033, 2.5]'::jsonb,
  '[0.755506, 0.873077, 0.894843, 0.537963, 0.925086, 0.754469, 1.118034]'::jsonb,
  '[0.170665, 0.339835, -0.005675, -0.030493, 0.175761, 0.126291, -0.017769]'::jsonb,
  -0.121699, 0.5,
  '{"global": {"precision": 0.39, "recall": 0.642, "f1": 0.485, "pr_auc": 0.434, "roc_auc": 0.691, "brier": 0.222, "n": 1880, "positivos": 0.262}, "por_dias_respondidos": {"1": {"roc_auc": 0.647, "precision": 0.373, "recall": 0.634}, "2": {"roc_auc": 0.676, "precision": 0.375, "recall": 0.634}, "3": {"roc_auc": 0.701, "precision": 0.382, "recall": 0.634}, "4": {"roc_auc": 0.749, "precision": 0.434, "recall": 0.667}}}'::jsonb,
  'Gruszczynska, Basinska & Schaufeli (2021), Mendeley Data doi:10.17632/vwp3xvp2x8.2, CC BY 4.0',
  true,
  array['investigador', 'psicologo', 'participante']
)
on conflict (version) do update set
  rasgos = excluded.rasgos, medias = excluded.medias, desviaciones = excluded.desviaciones,
  pesos = excluded.pesos, intercepto = excluded.intercepto, metricas = excluded.metricas;

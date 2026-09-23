-- Generado por modelo/preentrenar.py. NO editar a mano: volver a ejecutar el script.
-- Versión preentrenada del modelo de ESP-005 (pronóstico) con el diario OLBI de
-- referencia. Métricas de validación por persona (5 pliegues) sobre los datos
-- de referencia, no sobre datos propios.

insert into modelo_versiones
  (version, origen, tarea, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision, metricas, fuente, activa, visible_para)
values (
  'preentrenamiento-pronostico-v1', 'preentrenamiento', 'pronostico',
  '["T_media", "T_ultimo", "T_max", "T_pendiente", "E_media", "D_media", "n_dias"]'::jsonb,
  '[2.297074, 2.268085, 3.006383, -0.005638, 2.42766, 2.166489, 4.0]'::jsonb,
  '[0.612802, 0.848617, 0.796576, 0.325466, 0.724995, 0.628877, 1.0]'::jsonb,
  '[0.744167, 0.084151, 0.391903, 0.006354, 0.613797, 0.742681, 0.0]'::jsonb,
  -1.51747, 0.5,
  '{"global": {"precision": 0.323, "recall": 0.741, "f1": 0.449, "pr_auc": 0.499, "roc_auc": 0.879, "brier": 0.135, "n": 235, "positivos": 0.115}, "por_dias_respondidos": {"4": {"roc_auc": 0.879, "precision": 0.323, "recall": 0.741}}}'::jsonb,
  'Gruszczynska, Basinska & Schaufeli (2021), Mendeley Data doi:10.17632/vwp3xvp2x8.2, CC BY 4.0',
  true,
  array['investigador', 'psicologo', 'participante']
)
on conflict (version) do update set
  rasgos = excluded.rasgos, medias = excluded.medias, desviaciones = excluded.desviaciones,
  pesos = excluded.pesos, intercepto = excluded.intercepto, metricas = excluded.metricas;

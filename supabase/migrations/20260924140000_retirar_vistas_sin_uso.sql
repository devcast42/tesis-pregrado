-- Limpieza del esquema: se retiran nueve vistas que no lee nadie.
--
-- Son restos de dos cambios de formulación que sí se completaron en el código
-- pero no en la base, de modo que cada una seguía calculándose y compitiendo
-- con su sustituta a la hora de responder «¿de dónde sale este número?».
--
--   panel_participantes        -> panel_participantes_v2 (materializada)
--   historial_checkin          -> serie_diaria_v2 (ESP-009 RN-009-09; la vieja
--                                 lee claves de la v1 del diario que ya no
--                                 existen)
--   historial_olbi             -> olbi_semanal_etiquetado
--   ventanas_modelo            -> semanas_modelo (ESP-005 §3.4: la formulación
--                                 de ventanas de 14 días quedó sustituida por
--                                 la semanal)
--   resumen_estudio            -> el panel del investigador compone sus cifras
--                                 de adherencia, cohorte_semanal y circuito_apoyo
--   detecciones_recientes      -> bandeja_investigador
--   eventos_participante       -> linea_tiempo_participante
--   cohorte_segmento           -> nunca se llegó a mostrar; cohorte_semanal sí
--   segmento_inv               -> solo existía para alimentar cohorte_segmento
--
-- NO se tocan `indicador_volumen`, `indicador_tiempo_deteccion` ni
-- `indicador_precision`: no las usa la app, pero son las fuentes declaradas de
-- los indicadores de la tesis (docs/protocolo-del-estudio.md) y se consultan a
-- mano. Dejarlas es deliberado.

drop view if exists cohorte_segmento;
drop view if exists segmento_inv;
drop view if exists detecciones_recientes;
drop view if exists eventos_participante;
drop view if exists historial_checkin;
drop view if exists historial_olbi;
drop view if exists resumen_estudio;
drop view if exists panel_participantes;
drop view if exists ventanas_modelo;

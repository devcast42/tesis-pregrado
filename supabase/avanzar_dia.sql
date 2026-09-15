-- =============================================================================
-- AVANZAR DÍA — herramienta de prueba
-- =============================================================================
--
-- Retrocede los timestamps de la base para simular que pasó el tiempo.
-- Con esto los participantes pueden volver a responder sus formularios hoy
-- y las gráficas del panel muestran datos acumulados.
--
-- ⚠️  SOLO PARA PRUEBAS. Nunca en el proyecto real con datos de participantes.
--
-- CUÁNTOS DÍAS AVANZAR
-- --------------------
--   1  → habilita el check-in diario
--   7  → habilita diario + semanal
--  14  → habilita diario + semanal + OLBI (flujo completo con detección)
--
-- USO
-- ---
--   npx supabase db query --linked --file supabase/avanzar_dia.sql
--
-- Para cambiar el número de días, edita la línea marcada con ⚙️.
-- =============================================================================

do $$
declare
  dias_a_retroceder constant int := 1;  -- ⚙️ EDITAR: 1 | 7 | 14
  intervalo interval := (dias_a_retroceder || ' days')::interval;

  n_respuestas  int;
  n_eventos     int;
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Respuestas — retrocede iniciado_en y enviado_en
  --    La agenda usa `enviado_en` para saber si ya se respondió hoy.
  -- ─────────────────────────────────────────────────────────────────────────
  update respuestas
    set iniciado_en = iniciado_en - intervalo,
        enviado_en  = enviado_en  - intervalo;

  get diagnostics n_respuestas = row_count;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Eventos — retrocede ocurrido_en
  --    La vista `adherencia` usa los eventos para calcular dias_sin_checkin.
  --    La vista `indicador_tiempo_deteccion` los usa para medir el arco.
  -- ─────────────────────────────────────────────────────────────────────────
  update eventos
    set ocurrido_en = ocurrido_en - intervalo;

  get diagnostics n_eventos = row_count;

  raise notice '──────────────────────────────────────────';
  raise notice 'Avanzado % día(s) hacia adelante.',    dias_a_retroceder;
  raise notice '  Respuestas retrocedidas: %',         n_respuestas;
  raise notice '  Eventos    retrocedidos: %',         n_eventos;
  raise notice '';
  raise notice 'Los participantes pueden volver a responder ahora:';
  raise notice '  - diario   (cadencia: 1 d)  → siempre';
  raise notice '  - semanal  (cadencia: 7 d)  → si avanzaste ≥ 7';
  raise notice '  - olbi     (cadencia: 14 d) → si avanzaste ≥ 14';
  raise notice '──────────────────────────────────────────';
end $$;

-- Verificación rápida del estado actual
select
  p.codigo_anonimo,
  o.nombre as empresa,
  p.estado,
  (select max(r.enviado_en)
     from respuestas r
    where r.participante_id = p.id
      and r.formulario_clave = 'diario') as ultimo_diario,
  (select max(r.enviado_en)
     from respuestas r
    where r.participante_id = p.id
      and r.formulario_clave = 'olbi') as ultimo_olbi
from participantes p
join organizaciones o on o.id = p.organizacion_id
order by p.codigo_anonimo;

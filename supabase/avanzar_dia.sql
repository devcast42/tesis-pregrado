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
-- CUÁNTOS DÍAS AVANZAR (calendario semanal, ESP-002 rev. 2)
-- ----------------------------------------------------------
--   1  → lo respondido hoy pasa a «ayer»: se puede volver a responder el
--        formulario que toque HOY (diario lunes-jueves, OLBI viernes)
--   7  → toda la semana pasa a la anterior: el ritmo semanal se vacía y el
--        pronóstico/retrospectiva dejan de ver estos datos
--
-- El día de la semana lo decide la app con la fecha REAL del dispositivo.
-- Para «estar» en lunes siendo viernes, en la app: Ajustes → «Solo
-- desarrollo · fecha simulada» (existe solo en compilaciones de desarrollo).
-- Combinación típica para probar un lunes completo: este script con 1 y el
-- desfase de la app en +3 (viernes → lunes).
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
  raise notice 'Los participantes pueden volver a responder lo que toque hoy:';
  raise notice '  - lunes a jueves → diario';
  raise notice '  - viernes        → olbi + semanal (gracia sábado y domingo)';
  raise notice 'El día de la semana lo pone la app (Ajustes → fecha simulada en desarrollo).';
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

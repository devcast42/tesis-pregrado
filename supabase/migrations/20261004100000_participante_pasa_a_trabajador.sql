-- El rol «participante» pasa a llamarse «trabajador».
--
-- RAMA version-simplificada. En la tesis quien responde es un participante de
-- un estudio; en el producto es un trabajador de la empresa que lo paga. No es
-- cosmético: cambia a quién le habla el sistema.
--
-- Aplicada el 2026-10-04 con un script que leyó el catálogo y renombró lo que
-- encontró, en una sola transacción. Este archivo deja constancia de qué se
-- tocó; reproducirla en una base nueva no hace falta, porque las migraciones
-- anteriores ya crean todo con los nombres viejos y esta los cambia.
--
--   tabla      participantes          → trabajadores
--              resumenes_participante → resumenes_trabajador
--   columna    participante_id        → trabajador_id   (7 tablas)
--              adherencia_por_organizacion.participantes_activos
--              casos_psicologo.consentimiento_participante
--              panel_empresas.participantes
--              sesiones_consulta.consentimiento_participante
--   tipo       estado_participante    → estado_trabajador
--              rol_sistema: valor 'participante' → 'trabajador'
--   vistas     factores_semana_participante, linea_tiempo_participante,
--              olbi_semana_participante, panel_participantes_v2,
--              predicciones_participante, segmento_participante
--   funciones  participante_actual, ficha_participante,
--              dar_de_baja_participante, siguiente_codigo_participante
--              (+ 15 cuerpos que las referenciaban)
--   índices    los 12 que llevaban el nombre
--
-- LO QUE NO SE TOCÓ: los parámetros de entrada de las funciones siguen
-- llamándose `p_participante`. Renombrarlos exige DROP FUNCTION, y hay vistas
-- que dependen de ellas. Son nombres locales: no se ven desde fuera.

alter table if exists participantes rename to trabajadores;
alter table if exists resumenes_participante rename to resumenes_trabajador;

do $$
declare t text;
begin
  foreach t in array array['citas','consentimientos','derivaciones','eventos',
                           'identidades','respuestas','resumenes_trabajador'] loop
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name=t and column_name='participante_id') then
      execute format('alter table %I rename column participante_id to trabajador_id', t);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname='estado_participante') then
    alter type estado_participante rename to estado_trabajador;
  end if;
  if exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
             where t.typname='rol_sistema' and e.enumlabel='participante') then
    alter type rol_sistema rename value 'participante' to 'trabajador';
  end if;
end $$;

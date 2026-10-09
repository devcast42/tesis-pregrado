-- Dos factores más, sacados de las mismas dos preguntas del check-in.
--
-- Los factores que contesta todo el equipo son solo dos: horas trabajadas y
-- horas dormidas. Su media sola esconde los extremos: una jornada media de
-- 8.5 h está «dentro de lo previsto» aunque una de cada cinco jornadas pase
-- de 10 h, y dormir menos de 6 h es lo que más se asocia al agotamiento
-- (Åkerstedt, 2006), más que el promedio.
--
-- Así que, sin preguntar nada nuevo:
--   jornada_larga_pct   % de días con más de 10 h trabajadas
--   noche_corta_pct     % de noches con menos de 6 h dormidas
--
-- Por persona es la proporción de sus días de esa semana; por empresa, la
-- media de esas proporciones, redondeada a 5 como las guardias: con diez
-- personas, un 10 % exacto ya señala a alguien.
--
-- Con el check-in v4 las respuestas son rangos guardados en su punto medio:
-- «Más de 10 h» es 11.0 y «Menos de 6 h» es 5.0. Los cortes `> 10` y `< 6`
-- valen también para las respuestas numéricas de versiones anteriores.
--
-- Columnas añadidas al final: `create or replace view` no deja moverlas.

create or replace view factores_semana_trabajador
with (security_invoker = off) as
 SELECT r.trabajador_id,
    pa.organizacion_id,
    semana_de(r.enviado_en) AS semana,
    avg(i.valor_num) FILTER (WHERE i.item_clave = 'horas_trabajadas') AS horas_dia,
    avg(i.valor_num) FILTER (WHERE i.item_clave = 'horas_sueno') AS sueno,
    max(i.valor_num) FILTER (WHERE i.item_clave = 'horas_fin_de_semana') AS fin_de_semana,
    max(i.valor_num) FILTER (WHERE i.item_clave = 'horas_sobretiempo') AS sobretiempo,
    max(i.valor_num) FILTER (WHERE i.item_clave = 'guardias') AS guardia,
    max(i.valor_num) FILTER (WHERE i.item_clave = 'apoyo_lider') AS apoyo_lider,
    avg((i.valor_num > 10)::int) FILTER (WHERE i.item_clave = 'horas_trabajadas') AS jornada_larga,
    avg((i.valor_num < 6)::int) FILTER (WHERE i.item_clave = 'horas_sueno') AS noche_corta
   FROM respuestas r
     JOIN respuestas_items i ON i.respuesta_id = r.id
     JOIN trabajadores pa ON pa.id = r.trabajador_id
  WHERE r.formulario_clave = ANY (ARRAY['diario', 'semanal'])
  GROUP BY r.trabajador_id, pa.organizacion_id, (semana_de(r.enviado_en));

create or replace view factores_empresa
with (security_invoker = off) as
 WITH agg AS (
         SELECT f.organizacion_id,
            f.semana,
            count(*) AS respondientes,
            round(avg(f.horas_dia), 1) AS horas_dia_media,
            round(avg(f.sueno), 1) AS sueno_media,
            round(avg(f.fin_de_semana), 1) AS fin_de_semana_media,
            round(avg(f.sobretiempo), 1) AS sobretiempo_media,
            redondear_a_5(100.0 * avg(f.guardia)) AS guardia_pct,
            round(avg(f.apoyo_lider), 1) AS apoyo_lider_media,
            redondear_a_5(100.0 * avg(f.jornada_larga)) AS jornada_larga_pct,
            redondear_a_5(100.0 * avg(f.noche_corta)) AS noche_corta_pct
           FROM factores_semana_trabajador f
          GROUP BY f.organizacion_id, f.semana
        )
 SELECT organizacion_id, semana, respondientes,
    horas_dia_media, sueno_media, fin_de_semana_media, sobretiempo_media, guardia_pct, apoyo_lider_media,
    jornada_larga_pct, noche_corta_pct
   FROM agg
  WHERE respondientes >= minimo_para_reportar() AND alcance_empresa(organizacion_id);

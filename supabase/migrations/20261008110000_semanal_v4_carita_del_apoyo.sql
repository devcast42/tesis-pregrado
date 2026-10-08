-- Sobre tu semana · versión 4 — la carita del apoyo del líder, al derecho.
--
-- `apoyo_lider` es el único ítem de todo el sistema donde estar de acuerdo es
-- BUENO: «conté con el apoyo de mi líder». Los demás van al revés —«termino
-- exhausto», «hablé de mi trabajo de forma negativa»— y por eso la rampa por
-- defecto del deslizador empieza en 😄 y termina en 😫.
--
-- Resultado: el ítem mostraba la cara más feliz justo en «en desacuerdo», que
-- es la peor respuesta posible.
--
-- La vuelta se da con `escala.emojis`, que es presentación y nada más. NO con
-- `invertido`: ese campo lo lee `puntajes_olbi` para la fórmula, y los ítems
-- semanales se dejaron sin él a propósito (ver 20260918100000) para que ni esa
-- vista ni `evaluar-olbi` puedan recogerlos por accidente. El valor guardado
-- no cambia: sigue siendo 1 a 5 con 5 = de acuerdo = mejor, que es lo que
-- `apoyo_lider_media` promedia y lo que el panel compara contra su umbral.
--
-- La definición se copia de la v3 en vez de volver a escribirla: transcribir a
-- mano los metadatos de un ítem es exactamente el error que este archivo
-- arregla.

insert into formularios (clave, version, definicion)
select 'semanal', 4, jsonb_set(
  f.definicion,
  '{items}',
  (select jsonb_agg(
            case when item ->> 'clave' = 'apoyo_lider'
                 then jsonb_set(item, '{escala,emojis}',
                                '["😫", "😟", "😐", "🙂", "😄"]'::jsonb)
                 else item
            end
            order by orden)
     from jsonb_array_elements(f.definicion -> 'items')
          with ordinality as t(item, orden))
)
from formularios f
where f.clave = 'semanal' and f.version = 3
on conflict (clave, version) do update set definicion = excluded.definicion;

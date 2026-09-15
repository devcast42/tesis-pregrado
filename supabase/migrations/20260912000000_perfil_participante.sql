-- Perfil de participante — datos de evolución para el panel del investigador.
--
-- Tres vistas nuevas que alimentan la pantalla /investigador/participante/[id]:
--
--   historial_checkin   → curva de carga y sueño diarios
--   historial_olbi      → trayectoria OLBI por aplicación quincenal
--   eventos_participante → línea de tiempo de hitos relevantes
--
-- Las tres son `security_invoker`: RLS las filtra según quien las llama, por
-- lo que el investigador ve todo y un participante solo se vería a sí mismo
-- (aunque estas vistas no están expuestas en la app del participante).

-- ---------------------------------------------------------------------------
-- 1. Check-in diario — una fila por día respondido
--
-- Los item_clave siguen el modelo JD-R de Demerouti: los nombres abajo son
-- los que define la migración de semilla de formularios. Si cambian allí,
-- hay que actualizarlos aquí también (o pasar a una extracción dinámica).
-- ---------------------------------------------------------------------------

create or replace view historial_checkin
with (security_invoker = on) as
select
  r.participante_id,
  (r.enviado_en at time zone 'America/Lima')::date                        as dia,
  r.enviado_en,
  max(ri.valor_num) filter (where ri.item_clave = 'carga_percibida')      as carga_percibida,
  max(ri.valor_num) filter (where ri.item_clave = 'horas_sueno')          as horas_sueno,
  max(ri.valor_num) filter (where ri.item_clave = 'energia_al_terminar')  as energia,
  max(ri.valor_num) filter (where ri.item_clave = 'horas_trabajadas')     as horas_trabajadas
from respuestas r
join respuestas_items ri on ri.respuesta_id = r.id
where r.formulario_clave = 'diario'
group by r.participante_id, dia, r.enviado_en;

comment on view historial_checkin is
  'Serie diaria del participante. Alimenta la gráfica de carga y sueño del panel del investigador.';

grant select on historial_checkin to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trayectoria OLBI — una fila por aplicación quincenal
-- ---------------------------------------------------------------------------

create or replace view historial_olbi
with (security_invoker = on) as
select
  participante_id,
  enviado_en,
  max(puntaje) filter (where dimension = 'agotamiento')    as agotamiento,
  max(puntaje) filter (where dimension = 'desvinculacion') as desvinculacion,
  max(items_contados)                                      as items_contados
from puntajes_olbi
group by participante_id, enviado_en
order by participante_id, enviado_en;

comment on view historial_olbi is
  'Puntajes OLBI por aplicación quincenal. Alimenta la gráfica de trayectoria del panel.';

grant select on historial_olbi to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Eventos clave — solo los hitos relevantes para una línea de tiempo
--
-- Se excluyen evaluacion_iniciada y evaluacion_enviada: son demasiado
-- ruidosos (uno por formulario respondido) y no son hitos del estudio.
-- La línea de tiempo muestra el arco de la persona, no cada interacción.
-- ---------------------------------------------------------------------------

create or replace view eventos_participante
with (security_invoker = on) as
select
  participante_id,
  tipo,
  ocurrido_en,
  metadata
from eventos
where tipo in (
  'inicio_seguimiento',
  'deteccion',
  'derivacion_psicologo',
  'sesion_realizada',
  'salida_seguimiento',
  'alerta_adherencia'
)
order by ocurrido_en desc;

comment on view eventos_participante is
  'Hitos relevantes del participante para la línea de tiempo del panel.';

grant select on eventos_participante to authenticated;

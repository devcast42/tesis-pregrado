-- El desempeño del modelo, con el OLBI de cualquier día.
--
-- Hasta ahora una predicción contaba si se había dicho antes del viernes
-- (`dia < lunes + 4`), porque el OLBI era el viernes. Ahora el modelo lo
-- pide el día en que cruza el corte, y lo que hace válida una predicción es
-- haberse dicho ANTES de que la persona contestara. Con la regla del viernes,
-- un check-in del miércoles posterior a un OLBI del martes entraba en la
-- evaluación: el modelo «predecía» algo que ya se sabía.
--
-- 1. `registrar_prediccion` deja de anotar cuando la semana ya tiene OLBI.
--    Devuelve lo mismo (la app no cambia), pero no pisa la estimación del
--    día con una posterior al cuestionario, que es la que confrontan la
--    retrospectiva y esta evaluación.
-- 2. `predicciones_trabajador.tardio` pasa a significar «dicha después del
--    OLBI de su semana», y se añade `motivo`: por qué se pidió ese OLBI.
--    Importa para leer las cifras: a quien el modelo no avisa solo se le
--    mide por sorteo, al mes o tras un alta, así que los falsos negativos
--    salen de una muestra pequeña. Nulo = semana de antes, con OLBI para todos.

create or replace function registrar_prediccion(p_trabajador uuid, p_tarea text default 'nowcast')
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r     jsonb := probabilidad_semana(p_trabajador, p_tarea);
  hoy   date  := (now() at time zone tz_estudio())::date;
  lunes date  := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_id  bigint;   -- `eventos.id` es bigint, no uuid como el resto de tablas
begin
  if r is null or (r ->> 'probabilidad') is null then return r; end if;

  -- La semana ya se resolvió: lo que diga ahora el modelo no es una
  -- predicción, y anotarlo taparía la de antes del cuestionario.
  if p_tarea = 'nowcast' and exists (
    select 1 from respuestas
     where trabajador_id = p_trabajador and formulario_clave = 'olbi'
       and (enviado_en at time zone tz_estudio())::date >= lunes
  ) then
    return r;
  end if;

  select e.id into v_id
    from eventos e
   where e.trabajador_id = p_trabajador
     and e.tipo = 'prediccion_modelo'
     and e.metadata ->> 'version' = r ->> 'version'
     and e.metadata ->> 'tarea'   = p_tarea
     and (e.metadata ->> 'dia')::date = hoy
   order by e.ocurrido_en desc
   limit 1;

  if v_id is null then
    insert into eventos (trabajador_id, tipo, metadata)
    values (p_trabajador, 'prediccion_modelo', jsonb_build_object(
      'version', r ->> 'version', 'tarea', p_tarea, 'dia', hoy,
      'n_dias', (r ->> 'n_dias')::int,
      'probabilidad', (r ->> 'probabilidad')::numeric,
      'senalado', (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric
    ));
  else
    update eventos
       set metadata = metadata || jsonb_build_object(
             'n_dias',       (r ->> 'n_dias')::int,
             'probabilidad', (r ->> 'probabilidad')::numeric,
             'senalado',     (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric),
           ocurrido_en = now()
     where id = v_id;
  end if;

  return r;
end $$;

grant execute on function registrar_prediccion(uuid, text) to authenticated;

create or replace view predicciones_trabajador
with (security_invoker = on) as
with pred as (
  select
    e.trabajador_id                               as participante_id,
    e.id                                          as evento_id,
    e.ocurrido_en,
    e.metadata ->> 'tarea'                         as tarea,
    e.metadata ->> 'version'                       as version,
    (e.metadata ->> 'dia')::date                   as dia,
    (e.metadata ->> 'n_dias')::int                 as n_dias,
    (e.metadata ->> 'probabilidad')::numeric       as probabilidad,
    (e.metadata ->> 'senalado')::boolean           as senalado,
    date_trunc('week', (e.metadata ->> 'dia')::date)::date as semana
  from eventos e
  where e.tipo = 'prediccion_modelo'
),
objetivo as (
  select p.*,
    case when p.tarea = 'nowcast' then p.semana else p.semana + 7 end as semana_objetivo
  from pred p
),
con_olbi as (
  select o.*, s.alto, s.agotamiento, s.desvinculacion, s.enviado_en,
    -- Un nowcast vale si se dijo antes de contestar el OLBI de su semana.
    (o.tarea = 'nowcast' and s.enviado_en is not null and o.ocurrido_en > s.enviado_en) as tardio
  from objetivo o
  left join olbi_semanal_etiquetado s
    on s.trabajador_id = o.participante_id and s.semana = o.semana_objetivo
)
select
  c.participante_id as trabajador_id, c.evento_id, c.ocurrido_en, c.tarea, c.version, c.dia, c.semana, c.semana_objetivo,
  c.n_dias, c.probabilidad, c.senalado, c.tardio,
  c.alto                       as resultado_real,
  c.agotamiento                as agotamiento_real,
  c.desvinculacion             as desvinculacion_real,
  case when c.alto is null or c.tardio then null else (c.senalado = c.alto) end as acierto,
  (select r.metadata ->> 'motivo' from eventos r
    where r.trabajador_id = c.participante_id and r.tipo = 'olbi_requerido'
      and semana_de(r.ocurrido_en) = c.semana_objetivo
    order by r.ocurrido_en limit 1) as motivo
from con_olbi c;

create or replace view predicciones_evaluables
with (security_invoker = on) as
select distinct on (trabajador_id, tarea, semana)
  trabajador_id, evento_id, ocurrido_en, tarea, version, dia, semana, semana_objetivo, n_dias,
  probabilidad, senalado, tardio, resultado_real, agotamiento_real, desvinculacion_real, acierto, motivo
from predicciones_trabajador
where acierto is not null
order by trabajador_id, tarea, semana, dia desc, ocurrido_en desc;

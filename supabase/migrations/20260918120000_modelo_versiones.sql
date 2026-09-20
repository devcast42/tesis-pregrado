-- Modelo de detección temprana · versiones y predicción — implementa ESP-005 §8.
--
-- El modelo es una regresión logística: probabilidad = sigmoide(w·z + b),
-- con z = (x − media) / desviación. Los pesos viven en `modelo_versiones` y
-- la predicción se calcula AQUÍ, en SQL, con los mismos rasgos que el
-- entrenamiento (CA-005-05, CA-005-06). Nada de Python en producción.
--
-- Los rasgos de `rasgos_semana` son los de ESP-005 §4.1 y tienen que dar lo
-- mismo que `rasgos()` en modelo/preentrenar.py. Si cambia uno, cambia el otro.

alter type tipo_evento add value if not exists 'prediccion_modelo';

create table modelo_versiones (
  version          text primary key,
  origen           text not null check (origen in ('preentrenamiento', 'propio')),
  tarea            text not null check (tarea in ('nowcast', 'pronostico')),
  rasgos           jsonb not null,   -- nombres, en el orden de pesos/medias/desviaciones
  medias           jsonb not null,
  desviaciones     jsonb not null,
  pesos            jsonb not null,
  intercepto       numeric not null,
  umbral_decision  numeric not null default 0.5,
  metricas         jsonb not null default '{}'::jsonb,
  fuente           text,
  activa           boolean not null default false,
  -- Quién puede ver la probabilidad en la app. El participante solo entra
  -- aquí por decisión explícita del asesor (ESP-002 RN-002-08).
  visible_para     text[] not null default array['investigador'],
  entrenado_en     timestamptz not null default now()
);

comment on table modelo_versiones is
  'ESP-005 §8. Pesos y métricas de cada versión del modelo. Una sola activa por tarea.';

create unique index modelo_versiones_activa on modelo_versiones (tarea) where activa;

alter table modelo_versiones enable row level security;
-- Sin políticas: solo service_role y funciones security definer la leen.

-- ---------------------------------------------------------------------------
-- Rasgos de la semana en curso de un participante (ESP-005 §4.1)
-- ---------------------------------------------------------------------------

create or replace function rasgos_semana(p_participante uuid, p_referencia date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoy date := coalesce(p_referencia, (now() at time zone tz_estudio())::date);
  lunes date := hoy - (extract(isodow from hoy)::int - 1);
  dias record;
  n int;
  t numeric[]; e numeric[]; d numeric[];
  pend numeric := 0;
  sx numeric := 0; sy numeric := 0; sxx numeric := 0; sxy numeric := 0;
  i int;
begin
  -- Un valor por día: el último `diario` enviado ese día (RN-002-01: se
  -- agregan filas, no se sobrescriben; la vigente es la última).
  select
    array_agg(t_dia order by dia), array_agg(e_dia order by dia), array_agg(d_dia order by dia), count(*)
  into t, e, d, n
  from (
    select distinct on (dia)
      dia,
      (v.od_04 + v.od_12 + v.od_03 + v.od_06) / 4.0 as t_dia,
      (v.od_04 + v.od_12) / 2.0 as e_dia,
      (v.od_03 + v.od_06) / 2.0 as d_dia
    from (
      select
        r.id,
        (r.enviado_en at time zone tz_estudio())::date as dia,
        r.enviado_en,
        max(i.valor_num) filter (where i.item_clave = 'od_04') as od_04,
        max(i.valor_num) filter (where i.item_clave = 'od_12') as od_12,
        max(i.valor_num) filter (where i.item_clave = 'od_03') as od_03,
        max(i.valor_num) filter (where i.item_clave = 'od_06') as od_06
      from respuestas r
      join respuestas_items i on i.respuesta_id = r.id
      where r.participante_id = p_participante
        and r.formulario_clave = 'diario'
        and (r.enviado_en at time zone tz_estudio())::date between lunes and hoy
      group by r.id, r.enviado_en
    ) v
    where v.od_04 is not null and v.od_12 is not null and v.od_03 is not null and v.od_06 is not null
    order by dia, enviado_en desc
  ) s;

  if n is null or n = 0 then return null; end if;

  if n >= 2 then
    for i in 1..n loop
      sx := sx + (i - 1); sy := sy + t[i];
      sxx := sxx + (i - 1) * (i - 1); sxy := sxy + (i - 1) * t[i];
    end loop;
    pend := (n * sxy - sx * sy) / (n * sxx - sx * sx);
  end if;

  return jsonb_build_object(
    'T_media', (select avg(x) from unnest(t) x),
    'T_ultimo', t[n],
    'T_max', (select max(x) from unnest(t) x),
    'T_pendiente', pend,
    'E_media', (select avg(x) from unnest(e) x),
    'D_media', (select avg(x) from unnest(d) x),
    'n_dias', n
  );
end $$;

-- ---------------------------------------------------------------------------
-- Probabilidad con la versión activa (ESP-005 §3.2, nowcast)
-- ---------------------------------------------------------------------------

create or replace function probabilidad_semana(p_participante uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v modelo_versiones%rowtype;
  x jsonb;
  z numeric := 0;
  i int;
  nombre text;
  quien text;
begin
  -- Quién pregunta: el propio participante, un psicólogo o un investigador.
  if p_participante = participante_actual() then quien := 'participante';
  elsif es_investigador() then quien := 'investigador';
  elsif psicologo_actual() is not null then quien := 'psicologo';
  else raise exception 'sin permiso' using errcode = '42501';
  end if;

  select * into v from modelo_versiones where tarea = 'nowcast' and activa;
  if not found then return null; end if;
  if not (quien = any (v.visible_para)) then return null; end if;

  x := rasgos_semana(p_participante);
  if x is null then
    return jsonb_build_object('version', v.version, 'n_dias', 0, 'probabilidad', null, 'metricas', v.metricas);
  end if;

  for i in 0 .. jsonb_array_length(v.rasgos) - 1 loop
    nombre := v.rasgos ->> i;
    z := z + (v.pesos ->> i)::numeric
           * ((x ->> nombre)::numeric - (v.medias ->> i)::numeric) / (v.desviaciones ->> i)::numeric;
  end loop;
  z := z + v.intercepto;

  return jsonb_build_object(
    'version', v.version,
    'origen', v.origen,
    'n_dias', (x ->> 'n_dias')::int,
    'probabilidad', round(1 / (1 + exp(-z)), 3),
    'umbral_decision', v.umbral_decision,
    'metricas', v.metricas
  );
end $$;

comment on function probabilidad_semana(uuid) is
  'ESP-005. Probabilidad (nowcast) de que el OLBI del viernes cruce el umbral, con la versión activa. Devuelve null si no hay versión activa o el solicitante no está en visible_para.';

-- ---------------------------------------------------------------------------
-- Registro de predicciones: una por participante, versión y día (ESP-005 §8)
-- ---------------------------------------------------------------------------

create or replace function registrar_prediccion(p_participante uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r jsonb := probabilidad_semana(p_participante);
  hoy date := (now() at time zone tz_estudio())::date;
begin
  if r is null or (r ->> 'probabilidad') is null then return r; end if;
  if not exists (
    select 1 from eventos
     where participante_id = p_participante and tipo = 'prediccion_modelo'
       and metadata ->> 'version' = r ->> 'version'
       and (ocurrido_en at time zone tz_estudio())::date = hoy
  ) then
    insert into eventos (participante_id, tipo, metadata)
    values (p_participante, 'prediccion_modelo', jsonb_build_object(
      'version', r ->> 'version', 'tarea', 'nowcast', 'dia', hoy,
      'n_dias', (r ->> 'n_dias')::int,
      'probabilidad', (r ->> 'probabilidad')::numeric,
      'senalado', (r ->> 'probabilidad')::numeric >= (r ->> 'umbral_decision')::numeric
    ));
  end if;
  return r;
end $$;

grant execute on function rasgos_semana(uuid, date) to authenticated;
grant execute on function probabilidad_semana(uuid) to authenticated;
grant execute on function registrar_prediccion(uuid) to authenticated;

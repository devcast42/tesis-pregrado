-- El OLBI deja de ser «los viernes» y pasa a ser «cuando toca».
--
-- Tres puertas, y cada una responde a algo distinto:
--
--   modelo   la probabilidad del día cruzó el umbral. Es la detección: medir
--            caro solo cuando la señal barata lo justifica.
--   sorteo   un 25 % al azar cada semana, pase lo que pase. Es la única
--            medida limpia que queda del modelo. Sin ella el sistema solo
--            vería resultados de la gente que él mismo señaló, nunca sabría
--            a cuántos se le pasaron, y al reentrenar aprendería de sus
--            propios aciertos: el problema de las etiquetas selectivas.
--   nunca    quien lleva cinco semanas sin responderlo, aunque no haya
--            salido sorteado ni el modelo haya avisado. Un trabajador sin
--            una sola medición no tiene nivel que enseñarle a su empresa.
--
-- El sorteo es determinista sobre (trabajador, semana): la misma persona ve
-- lo mismo toda la semana aunque abra la app diez veces, y no hace falta
-- guardar a quién le tocó.

create or replace function olbi_toca(p_trabajador uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id      uuid := coalesce(p_trabajador, trabajador_actual());
  v_lunes   date := date_trunc('week', (now() at time zone tz_estudio()))::date;
  v_ultimo  date;
  v_prob    jsonb;
  v_umbral  numeric;
begin
  if v_id is null then return jsonb_build_object('toca', false); end if;
  if v_id <> trabajador_actual() and not es_investigador() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  select max((enviado_en at time zone tz_estudio())::date) into v_ultimo
    from respuestas where trabajador_id = v_id and formulario_clave = 'olbi';

  -- Ya lo respondió esta semana: no se pide dos veces.
  if v_ultimo is not null and v_ultimo >= v_lunes then
    return jsonb_build_object('toca', false, 'motivo', 'ya_respondido');
  end if;

  -- 1. El modelo. `probabilidad_semana` ya aplica el permiso y la versión activa.
  v_prob := probabilidad_semana(v_id, 'nowcast');
  if v_prob is not null and (v_prob ->> 'probabilidad') is not null then
    v_umbral := (v_prob ->> 'umbral_decision')::numeric;
    if (v_prob ->> 'probabilidad')::numeric >= v_umbral then
      return jsonb_build_object('toca', true, 'motivo', 'modelo',
                                'probabilidad', (v_prob ->> 'probabilidad')::numeric);
    end if;
  end if;

  -- 2. El sorteo, y solo el viernes: cerrar la semana es cuando el
  --    cuestionario tiene más sentido y cuando la gente ya lo espera. El
  --    sábado y el domingo siguen valiendo para que nadie lo pierda por un
  --    viernes ocupado.
  --    `hashtext` es determinista sobre (persona, semana), así que no cambia
  --    aunque abra la app diez veces y no hay que registrar a quién le tocó.
  if extract(isodow from (now() at time zone tz_estudio())) >= 5
     and abs(hashtext(v_id::text || v_lunes::text)) % 4 = 0 then
    return jsonb_build_object('toca', true, 'motivo', 'sorteo');
  end if;

  -- 3. El suelo: nadie puede pasarse el mes sin una medición.
  if v_ultimo is null or v_ultimo < v_lunes - 28 then
    return jsonb_build_object('toca', true, 'motivo', 'sin_medir');
  end if;

  return jsonb_build_object('toca', false, 'motivo', 'no_toca');
end $$;

grant execute on function olbi_toca(uuid) to authenticated;

comment on function olbi_toca(uuid) is
  'Producto. Decide si hoy corresponde el OLBI: por el modelo, por sorteo del '
  '25 % semanal, o porque lleva más de cuatro semanas sin medirse.';

-- ---------------------------------------------------------------------------
-- El calendario deja de mandar sobre el OLBI
-- ---------------------------------------------------------------------------

-- `dias` pasa a null en el OLBI y en el cuestionario de la semana: ya no los
-- dispara el día, los dispara `olbi_toca`. El `semanal` conserva su
-- `despues_de`, así que sigue apareciendo detrás del OLBI y nunca solo.
insert into formularios (clave, version, definicion)
select 'olbi', 3, (definicion - 'dias' - 'gracia_dias')
     || jsonb_build_object('titulo', 'Cuestionario completo',
                           'descripcion', 'Son 16 preguntas. Se pide de vez en cuando, no todas las semanas.')
  from formularios where clave = 'olbi' and version = 2
on conflict (clave, version) do update set definicion = excluded.definicion;

insert into formularios (clave, version, definicion)
select 'semanal', 3, (definicion - 'dias' - 'gracia_dias')
     || jsonb_build_object('despues_de', 'olbi')
  from formularios where clave = 'semanal' and version = 2
on conflict (clave, version) do update set definicion = excluded.definicion;

-- Resto del renombrado que se escapó: `visible_para` es un arreglo de texto,
-- no un identificador, así que el renombrado de objetos no lo tocó. La función
-- ya comparaba contra 'trabajador' y el arreglo seguía diciendo 'participante',
-- de modo que el trabajador nunca veía su probabilidad y `olbi_toca` jamás
-- podía dispararse por el modelo.
update modelo_versiones
   set visible_para = array_replace(visible_para, 'participante', 'trabajador')
 where 'participante' = any(visible_para);

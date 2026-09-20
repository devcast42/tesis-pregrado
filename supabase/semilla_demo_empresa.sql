-- Semilla de DEMOSTRACIÓN para el panel del empresario (ESP-008 rev. 2).
--
-- SOLO PARA ENTORNOS DE PRUEBA. Crea 12 participantes ficticios (sin cuenta
-- de acceso: auth_user_id nulo) en la empresa del admin indicado, con seis
-- semanas de check-ins, OLBI del viernes y preguntas semanales, para que las
-- vistas agregadas superen el mínimo de reporte y el panel se vea completo.
--
-- Uso:   psql … -f supabase/semilla_demo_empresa.sql
-- Deshacer: al final hay un bloque comentado que borra todo lo creado.
--
-- Los datos siguen una historia: el agotamiento sube de ~2.0 a ~2.6 a lo
-- largo de las semanas, las jornadas se alargan y las guardias suben; el
-- apoyo del líder se mantiene. Así aparecen «a vigilar», factores fuera de
-- referencia, recomendaciones y una relación clara en «qué se mueve con qué».

do $$
declare
  v_org        uuid;
  v_admin      text := 'test+admin@tesis.local';
  v_hoy        date := (now() at time zone 'America/Lima')::date;
  v_lunes0     date;          -- lunes de hace 6 semanas
  v_p          uuid;
  v_i          int;
  v_sem        int;
  v_dia        int;
  v_ts         timestamptz;
  v_resp       uuid;
  v_olbi       jsonb;
  v_item       jsonb;
  v_base       numeric;       -- tendencia de la semana (1–5 en ítems negativos)
  v_valor      numeric;
  v_semilla    numeric;
  v_modalidad  text;
  v_rol        text;
begin
  select ur.organizacion_id into v_org
  from usuarios_rol ur join auth.users u on u.id = ur.auth_user_id
  where u.email = v_admin and ur.rol = 'admin';
  if v_org is null then
    raise exception 'no se encontro la empresa del admin %', v_admin;
  end if;

  -- Lunes de esta semana menos 6 semanas (si hoy es lunes–jueves, la semana
  -- en curso no tendrá viernes; da igual: seis semanas completas atrás).
  v_lunes0 := date_trunc('week', v_hoy)::date - 42;

  select definicion -> 'items' into v_olbi from formularios where clave = 'olbi' and version = 2;

  for v_i in 1..12 loop
    -- Participante ficticio
    insert into participantes (organizacion_id, codigo_anonimo, estado, inscrito_en)
    values (v_org, format('DEMO-%s', lpad(v_i::text, 2, '0')), 'activo', v_lunes0 - 3)
    returning id into v_p;

    insert into consentimientos (participante_id, version_texto, aceptado, registrado_en)
    values (v_p, 'demo', true, v_lunes0 - 3);

    -- Datos iniciales: mezcla de modalidades y roles
    v_modalidad := (array['remoto','hibrido','presencial'])[1 + (v_i % 3)];
    v_rol := (array['desarrollo','desarrollo','qa','datos','infraestructura','desarrollo'])[1 + (v_i % 6)];
    insert into respuestas (participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
    values (v_p, 'estable', 1, v_lunes0 - 3, v_lunes0 - 3) returning id into v_resp;
    insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto) values
      (v_resp, 'edad', 24 + (v_i * 3) % 15, null),
      (v_resp, 'rol', null, v_rol),
      (v_resp, 'antiguedad_empresa', 1 + v_i % 5, null),
      (v_resp, 'antiguedad_sector', 3 + v_i % 8, null),
      (v_resp, 'modalidad', null, v_modalidad),
      (v_resp, 'tamano_equipo', 4 + v_i % 6, null),
      (v_resp, 'personas_a_cargo', (v_i % 4 = 0)::int, null),
      (v_resp, 'minutos_traslado', case when v_modalidad = 'remoto' then 0 else 20 + v_i * 5 end, null);

    -- Seis semanas
    for v_sem in 0..5 loop
      -- Tendencia: agotamiento sube con las semanas; cada persona con su sesgo.
      v_semilla := ((v_i * 7 + v_sem * 3) % 10) / 10.0;                 -- 0.0 … 0.9 determinista
      v_base := 2.2 + v_sem * 0.28 + (v_semilla - 0.45);               -- ≈ 1.8 … 4.0 en escala 1–5

      -- Lunes a jueves: check-in diario
      for v_dia in 0..3 loop
        v_ts := ((v_lunes0 + v_sem * 7 + v_dia)::timestamp + interval '18 hours') at time zone 'America/Lima';
        insert into respuestas (participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
        values (v_p, 'diario', 2, v_ts - interval '40 seconds', v_ts) returning id into v_resp;
        insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto) values
          (v_resp, 'od_04', least(5, greatest(1, round(v_base + (v_dia % 2) * 0.4))), null),
          (v_resp, 'od_12', least(5, greatest(1, round(v_base - 0.2 + v_semilla))), null),
          (v_resp, 'od_03', least(5, greatest(1, round(v_base - 0.6))), null),
          (v_resp, 'od_06', least(5, greatest(1, round(v_base - 0.4 + (v_dia % 3) * 0.2))), null),
          (v_resp, 'horas_trabajadas', round((8.2 + v_sem * 0.3 + v_semilla * 1.5 + (v_dia % 2) * 0.4)::numeric, 1), null),
          (v_resp, 'horas_sueno', round((7.2 - v_sem * 0.15 - v_semilla * 0.8)::numeric, 1), null);
        if v_dia = 0 then
          insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto)
          values (v_resp, 'horas_fin_de_semana', round((0.5 + v_sem * 0.8 + v_semilla * 2)::numeric, 1), null);
        end if;
      end loop;

      -- Viernes: OLBI completo (16 ítems, escala 1–4) + semanal
      v_ts := ((v_lunes0 + v_sem * 7 + 4)::timestamp + interval '18 hours') at time zone 'America/Lima';
      insert into respuestas (participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
      values (v_p, 'olbi', 2, v_ts - interval '4 minutes', v_ts) returning id into v_resp;
      for v_item in select * from jsonb_array_elements(v_olbi) loop
        -- Escala 1–4. Objetivo de la dimensión en escala 1–4 ≈ (v_base * 0.8):
        -- agotamiento sigue la tendencia; desvinculación queda más baja.
        v_valor := case when v_item ->> 'dimension' = 'agotamiento'
                        then v_base * 0.78 + ((v_item ->> 'clave') ~ '[13579]$')::int * 0.3
                        else v_base * 0.62 + ((v_item ->> 'clave') ~ '[2468]$')::int * 0.3 end;
        -- Ítems invertidos: se guardan al revés para que la fórmula los devuelva.
        if coalesce((v_item ->> 'invertido')::boolean, false) then v_valor := 5 - v_valor; end if;
        insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto)
        values (v_resp, v_item ->> 'clave', least(4, greatest(1, round(v_valor))), null);
      end loop;

      insert into respuestas (participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
      values (v_p, 'semanal', 2, v_ts + interval '1 minute', v_ts + interval '2 minutes') returning id into v_resp;
      insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto) values
        (v_resp, 'horas_sobretiempo', round((1.5 + v_sem * 1.1 + v_semilla * 3)::numeric, 1), null),
        (v_resp, 'guardias', (v_semilla + v_sem * 0.08 > 0.6)::int, null),
        (v_resp, 'apoyo_lider', least(5, greatest(1, round(3.6 + (v_semilla - 0.45) * 2))), null);
    end loop;
  end loop;

  raise notice 'Semilla demo creada: 12 participantes DEMO-01..12 en la empresa % con 6 semanas', v_org;
end $$;

-- ---------------------------------------------------------------------------
-- Deshacer (descomentar y ejecutar):
-- delete from respuestas_items where respuesta_id in (select id from respuestas where participante_id in (select id from participantes where codigo_anonimo like 'DEMO-%'));
-- delete from respuestas where participante_id in (select id from participantes where codigo_anonimo like 'DEMO-%');
-- delete from consentimientos where participante_id in (select id from participantes where codigo_anonimo like 'DEMO-%');
-- delete from eventos where participante_id in (select id from participantes where codigo_anonimo like 'DEMO-%');
-- delete from participantes where codigo_anonimo like 'DEMO-%';

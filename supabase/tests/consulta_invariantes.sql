\set ON_ERROR_STOP off
-- Fixture mínimo
insert into organizaciones (id, nombre) values ('11111111-1111-1111-1111-111111111111','ACME');
insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222'),
                                   ('33333333-3333-3333-3333-333333333333');
insert into participantes (id, organizacion_id, auth_user_id, codigo_anonimo)
  values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222','P-001');
insert into psicologos (id, auth_user_id, nombre, colegiatura)
  values ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','Dra. X','CPs-123');
insert into derivaciones (id, participante_id, psicologo_id)
  values ('66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444',
          '55555555-5555-5555-5555-555555555555');
insert into sesiones_consulta (id, derivacion_id, sala_livekit)
  values ('77777777-7777-7777-7777-777777777777','66666666-6666-6666-6666-666666666666','sala-1');
insert into transcripciones (id, sesion_id, borrar_despues_de)
  values ('88888888-8888-8888-8888-888888888888','77777777-7777-7777-7777-777777777777', now() + interval '30 days');

\echo '--- 1. informe sin transcripcion lista (debe FALLAR) ---'
insert into informes (sesion_id, transcripcion_id, contenido_borrador, modelo)
  values ('77777777-7777-7777-7777-777777777777','88888888-8888-8888-8888-888888888888','{}'::jsonb,'claude-opus-5');

\echo '--- 2. segunda derivacion abierta al mismo participante (debe FALLAR) ---'
insert into derivaciones (participante_id, psicologo_id)
  values ('44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555');

update transcripciones set estado='lista', texto='hola', generada_en=now()
  where id='88888888-8888-8888-8888-888888888888';

\echo '--- 3. informe con transcripcion lista (debe PASAR) ---'
insert into informes (id, sesion_id, transcripcion_id, contenido_borrador, modelo)
  values ('99999999-9999-9999-9999-999999999999','77777777-7777-7777-7777-777777777777',
          '88888888-8888-8888-8888-888888888888','{"temas_tratados":["carga"]}'::jsonb,'claude-opus-5');

\echo '--- 4. modificar el borrador (debe FALLAR) ---'
update informes set contenido_borrador='{"alterado":true}'::jsonb
  where id='99999999-9999-9999-9999-999999999999';

\echo '--- 5. aprobar sin psicologo responsable (debe FALLAR) ---'
update informes set estado='aprobado' where id='99999999-9999-9999-9999-999999999999';

\echo '--- 6. aprobar correctamente (debe PASAR) ---'
update informes set estado='aprobado',
                    contenido_aprobado='{"temas_tratados":["carga laboral"]}'::jsonb,
                    aprobado_por='55555555-5555-5555-5555-555555555555',
                    aprobado_en=now()
  where id='99999999-9999-9999-9999-999999999999';

\echo '--- 7. borrador y aprobado coexisten ---'
select contenido_borrador->>'temas_tratados' as borrador,
       contenido_aprobado->>'temas_tratados' as aprobado
  from informes where id='99999999-9999-9999-9999-999999999999';

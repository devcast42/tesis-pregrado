-- Seguimiento por persona para la empresa, e historia clínica para el psicólogo.
--
-- RAMA version-simplificada. Esto diverge a propósito de dos reglas de la
-- tesis, y conviene que quede escrito:
--
--   RN-008-10  «la empresa nunca ve a una persona». Aquí sí: nombre,
--              adherencia y nivel. Es lo que pide un producto que una empresa
--              compra para seguir a su propia gente.
--   RN-006-02  «la identidad se revela solo dentro de una derivación abierta».
--              Aquí el admin ve nombres siempre, y el psicólogo los conserva
--              después de cerrar el caso.
--
-- Lo que NO cambia, y es la línea que sostiene el producto: el admin no ve
-- respuestas, ni puntajes, ni el informe del psicólogo. Entregar al empleador
-- la historia clínica de un trabajador rompe el secreto profesional, y ningún
-- cliente serio lo compraría: su propio abogado lo frenaría.
--
-- La base legal es el consentimiento v3-2026-10, que lo dice con todas las
-- letras. Quien aceptó v2 lo hizo bajo anonimato y tiene que volver a decidir:
-- la app ya lo exige, porque compara la versión aceptada con la vigente.

-- ---------------------------------------------------------------------------
-- 1. Seguimiento de la empresa, una fila por trabajador
-- ---------------------------------------------------------------------------

create or replace view seguimiento_empresa
with (security_invoker = off) as
with ultimo_olbi as (
  select distinct on (o.participante_id)
    o.participante_id, o.semana, o.agotamiento, o.desvinculacion
  from olbi_semana_participante o
  order by o.participante_id, o.semana desc
),
ultima_respuesta as (
  select participante_id, max((enviado_en at time zone tz_estudio())::date) as dia
  from respuestas group by participante_id
)
select
  p.id                                                as participante_id,
  p.organizacion_id,
  p.codigo_anonimo,
  i.nombre,
  p.estado,
  p.inscrito_en::date                                 as desde,
  ur.dia                                              as ultima_respuesta,
  (current_date - ur.dia)                             as dias_sin_responder,
  -- El nivel, no el puntaje. La empresa necesita saber a quién acompañar, no
  -- cuánto sacó: el número invita a comparar personas, y eso no se compra.
  nivel_empresa('agotamiento', uo.agotamiento)        as nivel_agotamiento,
  nivel_empresa('desvinculacion', uo.desvinculacion)  as nivel_desvinculacion,
  uo.semana                                           as nivel_de_la_semana,
  -- Sí/no, sin fecha de detección ni motivo: que esté en acompañamiento es
  -- gestionable; por qué lo está, no es asunto de la empresa.
  exists (select 1 from derivaciones d
          where d.participante_id = p.id and d.cerrada_en is null)
                                                      as en_acompanamiento,
  -- Lo que ya daba `participacion_empresa`, para que esta vista la sustituya
  -- entera y la pantalla no tenga que pedir dos cosas.
  i.correo_contacto,
  (select c.aceptado from consentimientos c
   where c.participante_id = p.id order by c.registrado_en desc limit 1)
                                                      as consentimiento,
  (p.estado = 'activo')                               as en_seguimiento,
  p.inscrito_en
from participantes p
left join identidades i      on i.participante_id = p.id
left join ultimo_olbi uo     on uo.participante_id = p.id
left join ultima_respuesta ur on ur.participante_id = p.id
where alcance_empresa(p.organizacion_id);

comment on view seguimiento_empresa is
  'Producto. Una fila por trabajador de la empresa del admin: nombre, adherencia '
  'y nivel. Sin puntajes, sin respuestas y sin informes. Sin mínimo de reporte: '
  'identificar es el objetivo, y la base legal es el consentimiento v3.';

grant select on seguimiento_empresa to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Historia clínica del psicólogo
-- ---------------------------------------------------------------------------

-- Hasta ahora el psicólogo veía casos sueltos y perdía el nombre al cerrarse
-- la derivación. Para atender a alguien que vuelve —y van a volver: cruzar el
-- umbral una vez no inmuniza— necesita ver qué pasó la vez anterior.
--
-- El alcance sigue siendo suyo: solo las personas que él atendió. Un psicólogo
-- no ve los pacientes de otro, ni antes ni después de cerrar.

create or replace view historia_clinica
with (security_invoker = off) as
select
  d.participante_id,
  i.nombre,
  p.codigo_anonimo,
  d.id                                           as derivacion_id,
  d.abierta_en,
  d.cerrada_en,
  d.origen,
  (select count(*) from sesiones_consulta s where s.derivacion_id = d.id)
                                                 as sesiones,
  (select max(s.finalizada_en) from sesiones_consulta s where s.derivacion_id = d.id)
                                                 as ultima_sesion,
  (select count(*) from informes inf
   join sesiones_consulta s on s.id = inf.sesion_id
   where s.derivacion_id = d.id and inf.estado = 'aprobado')
                                                 as informes_aprobados
from derivaciones d
join participantes p on p.id = d.participante_id
left join identidades i on i.participante_id = d.participante_id
where d.psicologo_id = psicologo_actual();

comment on view historia_clinica is
  'Producto. Episodios de cada persona que este psicólogo atendió, abiertos y '
  'cerrados, con el nombre siempre visible para él. El contenido de cada informe '
  'sigue en `informes`, que solo abre su autor.';

grant select on historia_clinica to authenticated;

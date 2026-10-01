-- Ficha de empresa: lo que hace falta saber de una organización participante.
--
-- `organizaciones` tenía nombre y fecha, nada más. El alta pedía solo el
-- nombre, así que todo lo que describe a la empresa —cuántos son, dónde
-- están, cómo trabajan— no se recogía en ninguna parte, y el capítulo de
-- caracterización de la muestra se quedaba sin fuente.
--
-- Nada de esto entra al modelo (ESP-005 §4 no lo contempla): es descriptivo,
-- para la tesis y para saber a quién llamar. Todo opcional salvo el nombre,
-- porque una empresa se da de alta el día que firma, no el día que se tienen
-- todos sus datos.

alter table organizaciones
  add column if not exists sector           text,
  add column if not exists tamano           text,
  add column if not exists ciudad           text,
  add column if not exists modalidad        text,
  add column if not exists contacto_nombre  text,
  add column if not exists contacto_correo  text,
  add column if not exists notas            text;

-- Rangos, no una cifra exacta: nadie sabe de memoria cuánta gente trabaja en
-- su empresa, y para describir la muestra el rango basta.
alter table organizaciones drop constraint if exists organizaciones_tamano_valido;
alter table organizaciones add constraint organizaciones_tamano_valido
  check (tamano is null or tamano in ('1-50', '51-200', '201-1000', '1000+'));

alter table organizaciones drop constraint if exists organizaciones_modalidad_valida;
alter table organizaciones add constraint organizaciones_modalidad_valida
  check (modalidad is null or modalidad in ('remoto', 'hibrido', 'presencial'));

-- Dos empresas con el mismo nombre son indistinguibles en todos los
-- selectores del panel, y el investigador elige por nombre. Sin distinguir
-- mayúsculas, que es como se teclea mal.
create unique index if not exists organizaciones_nombre_unico
  on organizaciones (lower(nombre));

comment on column organizaciones.sector is 'Actividad declarada. Descriptivo: no entra al modelo.';
comment on column organizaciones.tamano is 'Rango de empleados de la empresa entera, no de la cohorte.';
comment on column organizaciones.contacto_correo is
  'Contacto del convenio, no de un participante. Lo lee el investigador y, por la política «psicologo ve la empresa del derivado», también el psicólogo de un caso abierto.';

-- La vista del maestro expone lo nuevo. Las columnas se añaden al final para
-- no romper a quien lea por posición.
create or replace view panel_empresas
with (security_invoker = on) as
 SELECT id,
    nombre,
    creado_en,
    ( SELECT count(*) AS count
           FROM participantes p
          WHERE p.organizacion_id = o.id) AS participantes,
    ( SELECT count(*) AS count
           FROM participantes p
          WHERE p.organizacion_id = o.id AND p.estado = 'activo'::estado_participante) AS en_seguimiento,
    ( SELECT count(*) AS count
           FROM administradores a
          WHERE a.organizacion_id = o.id AND a.activo) AS administradores,
    o.sector,
    o.tamano,
    o.ciudad,
    o.modalidad,
    o.contacto_nombre,
    o.contacto_correo,
    o.notas
   FROM organizaciones o;

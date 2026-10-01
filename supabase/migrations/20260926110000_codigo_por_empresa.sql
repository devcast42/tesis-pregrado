-- El código anónimo lleva las letras de su empresa — ESP-006 RN-006-01.
--
-- EL PROBLEMA
--
-- `inscribir-participante` numeraba con `P-NNN` sobre el total del estudio,
-- mientras la semilla usaba prefijos por empresa. Inscribir a alguien de
-- verdad metía un `P-059` entre los `AD-001…AD-016`, y las dos formas
-- convivían sin que ninguna fuera la oficial.
--
-- Peor: el correlativo salía de `count(*) + 1` sobre toda la tabla. Al borrar
-- un participante, el siguiente repetía un código ya usado y chocaba contra
-- `participantes_codigo_anonimo_key`, sin que el mensaje dijera por qué.
--
-- LA FORMA
--
--   AD-001, AD-002, …    prefijo de la empresa, correlativo dentro de ella
--
-- El prefijo se fija al crear la empresa, así que al inscribir a alguien ya
-- se sabe cómo va a llamarse. Se sigue sin poder deducir quién es: dice a qué
-- empresa pertenece, que el panel ya muestra en su propia columna.

-- Iniciales del nombre, en mayúsculas y sin tildes: «Andes Data Labs» -> AD,
-- «Kuntur» -> KU. Las palabras de enlace no cuentan para las iniciales.
create or replace function prefijo_sugerido(p_nombre text)
returns text
language plpgsql
immutable
as $$
declare
  v_limpio text;
  v_palabras text[];
  v_sigla text;
begin
  v_limpio := translate(upper(coalesce(p_nombre, '')), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ', 'AAAAEEEEIIIIOOOOUUUUNC');
  v_limpio := regexp_replace(v_limpio, '[^A-Z0-9 ]', ' ', 'g');
  v_palabras := array_remove(
    array(select p from regexp_split_to_table(trim(v_limpio), '\s+') as p
          where p <> '' and p not in ('DE','DEL','LA','EL','LOS','LAS','Y','E','SAC','SA','SRL','EIRL')),
    null);

  if array_length(v_palabras, 1) is null then
    return 'EM';
  elsif array_length(v_palabras, 1) = 1 then
    v_sigla := substr(v_palabras[1], 1, 2);
  else
    v_sigla := substr(v_palabras[1], 1, 1) || substr(v_palabras[2], 1, 1);
  end if;

  -- Un nombre de una sola letra deja la sigla coja.
  if length(v_sigla) < 2 then
    v_sigla := rpad(v_sigla, 2, 'X');
  end if;
  return v_sigla;
end;
$$;

alter table organizaciones add column if not exists prefijo text;

-- Las que ya existen conservan el prefijo con el que se crearon sus códigos:
-- renombrarlas ahora rompería los códigos de su gente.
update organizaciones o set prefijo = sub.pre
from (
  select p.organizacion_id, split_part(min(p.codigo_anonimo), '-', 1) as pre
  from participantes p
  where p.codigo_anonimo like '%-%'
  group by p.organizacion_id
) sub
where sub.organizacion_id = o.id and o.prefijo is null and sub.pre ~ '^[A-Z]{2,4}$';

update organizaciones set prefijo = prefijo_sugerido(nombre) where prefijo is null;

alter table organizaciones drop constraint if exists organizaciones_prefijo_valido;
alter table organizaciones add constraint organizaciones_prefijo_valido
  check (prefijo ~ '^[A-Z][A-Z0-9]{1,3}$');

create unique index if not exists organizaciones_prefijo_unico on organizaciones (prefijo);
alter table organizaciones alter column prefijo set not null;

-- Al crear una empresa sin prefijo se le pone el sugerido; si ya está cogido,
-- se numera. Así el alta nunca falla por un choque de siglas.
create or replace function organizaciones_asignar_prefijo()
returns trigger
language plpgsql
as $$
declare
  v_base text;
  v_intento text;
  i int := 1;
begin
  if new.prefijo is not null and new.prefijo <> '' then
    new.prefijo := upper(new.prefijo);
    return new;
  end if;
  v_base := prefijo_sugerido(new.nombre);
  v_intento := v_base;
  while exists (select 1 from organizaciones where prefijo = v_intento) loop
    i := i + 1;
    if i > 99 then
      raise exception 'no hay prefijo libre para «%»', new.nombre;
    end if;
    v_intento := substr(v_base, 1, 2) || i::text;
  end loop;
  new.prefijo := v_intento;
  return new;
end;
$$;

drop trigger if exists organizaciones_prefijo on organizaciones;
create trigger organizaciones_prefijo
  before insert on organizaciones
  for each row execute function organizaciones_asignar_prefijo();

-- El siguiente código libre de una empresa. Va del MÁXIMO en uso, no de
-- `count(*)`: al dar de baja a alguien su número no se reutiliza, y dos altas
-- a la vez chocan contra el índice único en vez de duplicar en silencio.
create or replace function siguiente_codigo_participante(p_organizacion uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prefijo text;
  v_siguiente int;
begin
  select prefijo into v_prefijo from organizaciones where id = p_organizacion;
  if v_prefijo is null then
    raise exception 'la empresa % no existe o no tiene prefijo', p_organizacion;
  end if;
  select coalesce(max(substr(codigo_anonimo, length(v_prefijo) + 2)::int), 0) + 1
    into v_siguiente
    from participantes
   where organizacion_id = p_organizacion
     and codigo_anonimo ~ ('^' || v_prefijo || '-[0-9]+$');
  return v_prefijo || '-' || lpad(v_siguiente::text, 3, '0');
end;
$$;

grant execute on function siguiente_codigo_participante(uuid) to authenticated, service_role;

comment on column organizaciones.prefijo is
  'Letras del código anónimo de su gente (AD -> AD-001). Se fija al crear la empresa y no se cambia: los códigos ya repartidos dejarían de encajar.';

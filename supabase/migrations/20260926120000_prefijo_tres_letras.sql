-- El prefijo mide siempre tres — ESP-006 RN-006-01.
--
-- Con prefijos de 2 a 4 caracteres, los códigos salían de largos distintos
-- —KF-001 y ABCD-001— y en una tabla eso se nota: las columnas bailan y dos
-- códigos no se comparan de un vistazo. Fijado en tres, todo código mide seis
-- caracteres: AND-001, NEX-023.
--
-- La regla de la sigla también cambia. Antes eran las iniciales de las dos
-- primeras palabras, que con tres no llega para nombres de una o dos. Ahora
-- son las tres primeras letras del nombre, saltando palabras de enlace y
-- siguiendo por la palabra siguiente si la primera se queda corta:
--
--   Nexa Software        -> NEX
--   Andes Data Labs      -> AND
--   Consultora de la Costa -> CON
--   BI Partners          -> BIP     (la primera solo da dos)
--   Zeta                 -> ZET

create or replace function prefijo_sugerido(p_nombre text)
returns text
language plpgsql
immutable
as $$
declare
  v_limpio text;
  v_palabras text[];
  v_sigla text := '';
  v_p text;
begin
  v_limpio := translate(upper(coalesce(p_nombre, '')), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ', 'AAAAEEEEIIIIOOOOUUUUNC');
  v_limpio := regexp_replace(v_limpio, '[^A-Z0-9 ]', ' ', 'g');
  v_palabras := array(
    select p from regexp_split_to_table(trim(v_limpio), '\s+') as p
    where p <> '' and p not in ('DE','DEL','LA','EL','LOS','LAS','Y','E','SAC','SA','SRL','EIRL'));

  -- Se van tomando letras de una palabra, y si no dan para tres se sigue por
  -- la siguiente: así «BI Partners» da BIP y no se queda en dos.
  foreach v_p in array coalesce(v_palabras, array[]::text[]) loop
    v_sigla := v_sigla || substr(v_p, 1, 3 - length(v_sigla));
    exit when length(v_sigla) >= 3;
  end loop;

  if length(v_sigla) = 0 then
    return 'EMP';
  end if;
  return rpad(v_sigla, 3, 'X');
end;
$$;

-- Las empresas existentes pasan a tres. Se hace antes de apretar el check, y
-- los códigos de su gente se renumeran con el prefijo nuevo para que no
-- convivan dos formas en la misma empresa.
update organizaciones set prefijo = prefijo_sugerido(nombre)
where prefijo !~ '^[A-Z][A-Z0-9]{2}$';

update participantes p
set codigo_anonimo = o.prefijo || '-' || lpad(split_part(p.codigo_anonimo, '-', 2), 3, '0')
from organizaciones o
where o.id = p.organizacion_id
  and p.codigo_anonimo ~ '^[A-Z]+-[0-9]+$'
  and split_part(p.codigo_anonimo, '-', 1) <> o.prefijo;

alter table organizaciones drop constraint if exists organizaciones_prefijo_valido;
alter table organizaciones add constraint organizaciones_prefijo_valido
  check (prefijo ~ '^[A-Z][A-Z0-9]{2}$');

-- El desempate también respeta los tres: AND, AN2, AN3…
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
    if i > 9 then
      raise exception 'no hay prefijo libre para «%»; elige uno a mano', new.nombre;
    end if;
    v_intento := substr(v_base, 1, 2) || i::text;
  end loop;
  new.prefijo := v_intento;
  return new;
end;
$$;

comment on column organizaciones.prefijo is
  'Tres caracteres: las letras del código de su gente (AND -> AND-001). Se fija al crear la empresa y no se cambia, porque los códigos ya repartidos dejarían de encajar.';

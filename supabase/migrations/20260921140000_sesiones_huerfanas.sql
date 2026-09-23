-- Sesiones huérfanas (ESP-004 RF-004-05).
--
-- Una sala abierta y nunca finalizada (la app se cerró, nadie colgó) quedaba
-- viva para siempre: la pestaña Apoyo seguía ofreciendo «Entrar a la sala» y
-- la ficha del psicólogo la mostraba «en curso» días después. LiveKit cierra
-- la sala vacía a los minutos, así que una sesión sin fin tres horas después
-- de abrirse está terminada de hecho: se marca como tal.

create or replace function cerrar_sesiones_huerfanas() returns int
language plpgsql security definer set search_path = public as $$
declare afectadas int;
begin
  with cerradas as (
    update sesiones_consulta
       set finalizada_en = greatest(iniciada_en + interval '3 hours', now() - interval '1 minute')
     where finalizada_en is null
       and iniciada_en < now() - interval '3 hours'
    returning id
  )
  select count(*) into afectadas from cerradas;
  return afectadas;
end;
$$;

comment on function cerrar_sesiones_huerfanas() is
  'Marca como finalizadas las sesiones abiertas hace más de 3 h sin fin registrado. Ejecutar a diario junto con borrar_datos_vencidos().';

-- Al abrir una sala nueva para la misma derivación, la anterior sin cerrar
-- se da por terminada: no puede haber dos salas vivas del mismo caso.
create or replace function cerrar_sala_anterior() returns trigger
language plpgsql as $$
begin
  update sesiones_consulta
     set finalizada_en = now()
   where derivacion_id = new.derivacion_id
     and id <> new.id
     and finalizada_en is null;
  return new;
end;
$$;

drop trigger if exists sesiones_una_sala_viva on sesiones_consulta;
create trigger sesiones_una_sala_viva
  after insert on sesiones_consulta
  for each row execute function cerrar_sala_anterior();

-- Las que ya están huérfanas hoy.
select cerrar_sesiones_huerfanas();

-- La cita le dice al trabajador si su psicólogo es de su empresa.
--
-- La tarjeta decía «Psicólogo del programa» a todos. Con psicólogos que da de
-- alta la empresa eso ya no es verdad para todos, y es justo lo que una
-- persona quiere saber antes de hablar con franqueza. Cambia el tipo que
-- devuelve, así que hay que borrarla y crearla otra vez.

drop function if exists mis_citas();

create function mis_citas()
returns table(id uuid, propuesta_para timestamptz, motivo text, estado estado_cita, cancelada_por text,
              creada_en timestamptz, psicologo text, psicologo_de_empresa boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.propuesta_para, c.motivo, c.estado, c.cancelada_por, c.creada_en, p.nombre,
         p.organizacion_id is not null
  from citas c
  join psicologos p on p.id = c.psicologo_id
  where c.trabajador_id = trabajador_actual()
  order by c.creada_en desc
$$;

revoke all on function mis_citas() from public, anon;
grant execute on function mis_citas() to authenticated;

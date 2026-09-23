-- Notas clínicas que se guardan mientras se escriben (ESP-004, RF-004-10).
--
-- Hasta ahora las correcciones del psicólogo vivían solo en la pantalla: si
-- salía antes de aprobar, se perdían. Se añade una copia de trabajo,
-- `contenido_en_revision`, que la app guarda a medida que edita. El borrador
-- del modelo sigue siendo inmutable (RN-004-04) y la versión aprobada sigue
-- naciendo solo al aprobar (RN-004-02): la copia de trabajo está en medio.

alter table informes
  add column if not exists contenido_en_revision jsonb,
  add column if not exists revisado_en          timestamptz;

comment on column informes.contenido_en_revision is
  'Copia de trabajo del psicólogo: lo que va editando antes de aprobar. Solo él la ve.';
comment on column informes.revisado_en is
  'Último guardado de la copia de trabajo.';

-- Un informe aprobado queda cerrado: ni la copia de trabajo ni la versión
-- aprobada cambian después. Lo que se aprobó es lo que responde el profesional.
create or replace function proteger_borrador() returns trigger
language plpgsql as $$
begin
  if new.contenido_borrador is distinct from old.contenido_borrador then
    raise exception 'el contenido del borrador es inmutable (ESP-004 RN-004-04)';
  end if;
  if old.estado = 'aprobado' and (
       new.contenido_aprobado    is distinct from old.contenido_aprobado
    or new.contenido_en_revision is distinct from old.contenido_en_revision
    or new.estado <> 'aprobado'
  ) then
    raise exception 'un informe aprobado no se modifica (ESP-004 RN-004-02)';
  end if;
  return new;
end;
$$;

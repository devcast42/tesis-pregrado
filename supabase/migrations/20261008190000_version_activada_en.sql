-- Cuándo se puso en uso cada versión del modelo.
--
-- Cambiar de versión cambia a quién se le pide el cuestionario, y no quedaba
-- rastro de cuándo se hizo: la auditoría solo podía decir cuál está activa
-- ahora. Cada predicción ya guarda su versión; esto fecha el cambio en sí.
-- Las activaciones anteriores a esta migración quedan sin fecha.

alter table modelo_versiones add column if not exists activada_en timestamptz;

create or replace function fechar_activacion_version()
returns trigger language plpgsql as $$
begin
  if new.activa and not coalesce(old.activa, false) then
    new.activada_en := now();
  end if;
  return new;
end $$;

drop trigger if exists fechar_activacion_version on modelo_versiones;
create trigger fechar_activacion_version
  before update of activa on modelo_versiones
  for each row execute function fechar_activacion_version();

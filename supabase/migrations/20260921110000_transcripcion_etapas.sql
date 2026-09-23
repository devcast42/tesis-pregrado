-- ESP-004 — trazabilidad del circuito de grabación.
--
-- Antes solo había `estado` (pendiente/procesando/lista/fallida) y, si algo
-- se caía entre la sala y el borrador, nadie sabía en qué paso. Ahora cada
-- función deja la etapa y, si falla, el motivo. La fila se crea en cuanto
-- ambos consienten (aunque la grabación no arranque), para que la pantalla
-- del psicólogo pueda decir «no se inició» en vez de callar.
alter table transcripciones
  add column if not exists etapa text not null default 'grabando'
    check (etapa in ('sin_grabacion', 'grabando', 'audio_subido', 'transcribiendo', 'lista', 'redactando', 'informe_listo', 'fallida')),
  add column if not exists detalle text,
  add column if not exists actualizada_en timestamptz not null default now();

-- audio_ruta pasa a ser opcional al crear la fila (la ruta se fija al arrancar el egress).
alter table transcripciones alter column audio_ruta drop not null;

create or replace function transcripciones_marca_actualizada()
returns trigger language plpgsql as $$
begin new.actualizada_en := now(); return new; end $$;
drop trigger if exists transcripciones_actualizada on transcripciones;
create trigger transcripciones_actualizada before update on transcripciones
  for each row execute function transcripciones_marca_actualizada();

comment on column transcripciones.etapa is
  'Paso del circuito: sin_grabacion (faltó consentimiento o LiveKit no pudo grabar) → grabando → audio_subido → transcribiendo → lista → redactando → informe_listo; fallida con `detalle`.';

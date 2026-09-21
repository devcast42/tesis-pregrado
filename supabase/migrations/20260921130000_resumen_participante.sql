-- Resumen para el participante (ESP-004, RF-004-17).
--
-- Al terminar la sesión, el participante recibe un documento propio: NO es el
-- informe clínico (RN-004-03 sigue intacta: sin observaciones clínicas, sin
-- puntajes, sin valoraciones), sino un resumen en segunda persona con los
-- acuerdos de la sesión y recomendaciones de autocuidado, redactado por el
-- modelo a partir de la misma transcripción que alimenta el borrador del
-- psicólogo (Deepgram corre una sola vez). Si la sesión no se grabó, recibe
-- recomendaciones generales, sin inventar nada de la conversación.
--
-- La tabla lleva la etapa del circuito para que la app le diga en qué paso
-- va, igual que hace `transcripciones` con el psicólogo.

create table if not exists resumenes_participante (
  id               uuid primary key default gen_random_uuid(),
  sesion_id        uuid not null unique references sesiones_consulta(id),
  participante_id  uuid not null references participantes(id),

  etapa            text not null default 'esperando'
                   check (etapa in ('esperando', 'redactando', 'generando_pdf', 'listo', 'fallido')),
  -- 'sesion': a partir de la transcripción; 'general': la sesión no se grabó.
  origen           text check (origen in ('sesion', 'general')),
  detalle          text,

  contenido        jsonb,
  pdf_ruta         text,
  modelo           text,

  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index if not exists resumenes_participante_participante_idx
  on resumenes_participante (participante_id, creado_en desc);

alter table resumenes_participante enable row level security;

-- Solo el propio participante lo lee. Nadie lo escribe desde la app: lo
-- genera la Edge Function `resumen-participante` con service_role.
-- Ni el psicólogo, ni el investigador, ni la empresa: es un documento
-- personal del participante (RN-004-08 aplica igual).
create policy "participante lee sus resumenes"
  on resumenes_participante for select
  using (participante_id = participante_actual());

-- Bucket privado para los PDF. El participante solo puede firmar URLs de su
-- propia carpeta (<participante_id>/<sesion_id>.pdf).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumenes-participante', 'resumenes-participante', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "participante descarga su resumen" on storage.objects;
create policy "participante descarga su resumen"
  on storage.objects for select
  using (
    bucket_id = 'resumenes-participante'
    and (storage.foldername(name))[1] = participante_actual()::text
  );

-- Hito para la línea de tiempo del investigador (sin contenido).
alter type tipo_evento add value if not exists 'resumen_entregado';

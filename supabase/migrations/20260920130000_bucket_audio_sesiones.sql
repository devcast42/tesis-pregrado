-- ESP-004 RF-004-04 / RN-004-09 — bucket privado para el audio de las sesiones.
-- LiveKit lo escribe por el endpoint S3 de Supabase Storage; Deepgram lo lee
-- con una URL firmada de corta vida. Nadie lo lee desde la app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio-sesiones', 'audio-sesiones', false, 524288000, array['audio/ogg', 'audio/mpeg', 'audio/wav'])
on conflict (id) do update set public = false;

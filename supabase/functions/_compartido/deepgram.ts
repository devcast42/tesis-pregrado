// Pedir la transcripción de una sesión a Deepgram — compartido por
// egress-webhook (camino normal) y retranscribir (reintento manual).
//
// Deepgram responde por callback a transcripcion-lista; aquí solo se encola.
// El audio vive en un bucket privado: se le da una URL firmada de una hora.

import type { servicio } from './supabase.ts'

export async function solicitarTranscripcion(db: ReturnType<typeof servicio>, sesionId: string): Promise<{ ok: boolean; detalle: string }> {
  const { data: transcripcion } = await db
    .from('transcripciones')
    .select('audio_ruta')
    .eq('sesion_id', sesionId)
    .maybeSingle()
  if (!transcripcion?.audio_ruta) return { ok: false, detalle: 'sesion sin grabacion registrada' }
  await db.from('transcripciones').update({ etapa: 'audio_subido', detalle: null }).eq('sesion_id', sesionId)

  const { data: firmada, error: errorFirma } = await db.storage
    .from(Deno.env.get('S3_BUCKET')!)
    .createSignedUrl(transcripcion.audio_ruta, 60 * 60)
  if (errorFirma || !firmada?.signedUrl) {
    const detalle = `no se pudo firmar la URL del audio: ${errorFirma?.message ?? ''}`
    await db.from('transcripciones').update({ estado: 'fallida', etapa: 'fallida', detalle }).eq('sesion_id', sesionId)
    return { ok: false, detalle }
  }

  const callback = `${Deno.env.get('SUPABASE_URL')}/functions/v1/transcripcion-lista?sesion=${sesionId}&clave=${Deno.env.get('WEBHOOK_SECRET') ?? ''}`
  const respuesta = await fetch(
    'https://api.deepgram.com/v1/listen' +
      '?model=nova-3&language=es&punctuate=true&diarize=true&smart_format=true&paragraphs=true' +
      `&callback=${encodeURIComponent(callback)}`,
    {
      method: 'POST',
      headers: { Authorization: `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: firmada.signedUrl }),
    },
  )
  const texto = await respuesta.text()
  if (!respuesta.ok) {
    const detalle = `Deepgram rechazó la transcripción (${respuesta.status}): ${texto.slice(0, 200)}`
    await db.from('transcripciones').update({ estado: 'fallida', etapa: 'fallida', detalle }).eq('sesion_id', sesionId)
    return { ok: false, detalle }
  }
  await db.from('transcripciones').update({ estado: 'procesando', etapa: 'transcribiendo', detalle: null }).eq('sesion_id', sesionId)
  return { ok: true, detalle: texto.slice(0, 200) }
}

// Fin de grabación → transcripción — implementa ESP-004 RF-004-05.
//
// LiveKit avisa cuando el audio quedó subido. Aquí se pide la transcripción
// a Deepgram con callback: transcribir tarda minutos y una Edge Function se
// muere en segundos, así que nunca se espera el resultado dentro de la
// función. Deepgram responde a `transcripcion-lista`.

import { WebhookReceiver } from 'npm:livekit-server-sdk@2'
import { json, servicio } from '../_compartido/supabase.ts'

const receptor = new WebhookReceiver(
  Deno.env.get('LIVEKIT_API_KEY')!,
  Deno.env.get('LIVEKIT_API_SECRET')!,
)

Deno.serve(async (req) => {
  const cuerpo = await req.text()
  const firma = req.headers.get('Authorization') ?? ''

  let evento
  try {
    // Verificar la firma no es opcional: sin esto, cualquiera puede fabricar
    // un webhook y disparar transcripciones de sesiones ajenas.
    evento = await receptor.receive(cuerpo, firma)
  } catch {
    return json({ error: 'firma invalida' }, 401)
  }

  if (evento.event !== 'egress_ended') return json({ ignorado: evento.event })

  const sala = evento.egressInfo?.roomName
  if (!sala) return json({ error: 'sin sala' }, 400)

  const db = servicio()

  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('id')
    .eq('sala_livekit', sala)
    .maybeSingle()

  if (!sesion) return json({ error: 'sesion no encontrada' }, 404)

  // La ruta del audio la fijó token-livekit al arrancar la grabación.
  const { data: transcripcion } = await db
    .from('transcripciones')
    .select('audio_ruta')
    .eq('sesion_id', sesion.id)
    .maybeSingle()
  if (!transcripcion?.audio_ruta) return json({ error: 'sesion sin grabacion registrada' }, 404)

  // El bucket es privado (audio clínico): a Deepgram se le da una URL firmada
  // de corta vida, nunca una pública.
  const { data: firmada, error: errorFirma } = await db.storage
    .from(Deno.env.get('S3_BUCKET')!)
    .createSignedUrl(transcripcion.audio_ruta, 60 * 60)
  if (errorFirma || !firmada?.signedUrl) {
    await db.from('transcripciones').update({ estado: 'fallida' }).eq('sesion_id', sesion.id)
    return json({ error: 'no se pudo firmar la URL del audio' }, 500)
  }
  const urlAudio = firmada.signedUrl

  // Deepgram no firma su callback: una clave compartida en la URL evita que
  // cualquiera «entregue» una transcripción ajena.
  const callback = `${Deno.env.get('SUPABASE_URL')}/functions/v1/transcripcion-lista?sesion=${sesion.id}&clave=${Deno.env.get('WEBHOOK_SECRET') ?? ''}`

  const respuesta = await fetch(
    'https://api.deepgram.com/v1/listen' +
      '?model=nova-3&language=es&punctuate=true&diarize=true&smart_format=true' +
      `&callback=${encodeURIComponent(callback)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: urlAudio }),
    },
  )

  if (!respuesta.ok) {
    await db.from('transcripciones').update({ estado: 'fallida' }).eq('sesion_id', sesion.id)
    return json({ error: 'deepgram rechazo la solicitud' }, 502)
  }

  return json({ encolada: true })
})

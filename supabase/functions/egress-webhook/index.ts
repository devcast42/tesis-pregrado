// Fin de grabación → transcripción — implementa ESP-004 RF-004-05.
//
// LiveKit avisa cuando el audio quedó subido. Aquí se pide la transcripción
// a Deepgram con callback: transcribir tarda minutos y una Edge Function se
// muere en segundos, así que nunca se espera el resultado dentro de la
// función. Deepgram responde a `transcripcion-lista`.

import { WebhookReceiver } from 'npm:livekit-server-sdk@2'
import { json, servicio } from '../_compartido/supabase.ts'
import { solicitarTranscripcion } from '../_compartido/deepgram.ts'

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

  const r = await solicitarTranscripcion(db, sesion.id)
  if (!r.ok) return json({ error: r.detalle }, 502)
  return json({ encolada: true })
})

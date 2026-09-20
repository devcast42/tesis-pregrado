// Token de acceso a la sala — implementa ESP-004 RF-004-01.
//
// La clave de LiveKit nunca sale del servidor: si el cliente pudiera firmar
// sus propios tokens, podría entrar a cualquier sala del sistema.
//
// Si ambas partes autorizaron la grabación (RN-004-06), aquí se arranca el
// egress de audio. Solo audio: nunca video (RF-004-04).

import { AccessToken, EgressClient, EncodedFileType } from 'npm:livekit-server-sdk@2'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'

const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')!
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const { sesion_id } = await req.json()
  if (!sesion_id) return json({ error: 'falta sesion_id' }, 400)

  // Identidad de quien llama
  const usuario = comoUsuario(req)
  const { data: auth } = await usuario.auth.getUser()
  if (!auth?.user) return json({ error: 'no autenticado' }, 401)

  const db = servicio()

  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('id, sala_livekit, derivacion_id, consentimiento_participante, consentimiento_psicologo, finalizada_en')
    .eq('id', sesion_id)
    .maybeSingle()

  if (!sesion) return json({ error: 'sesion no encontrada' }, 404)
  if (sesion.finalizada_en) return json({ error: 'la sesion ya termino' }, 409)

  const { data: derivacion } = await db
    .from('derivaciones')
    .select('participante_id, psicologo_id, cerrada_en')
    .eq('id', sesion.derivacion_id)
    .single()

  if (derivacion.cerrada_en) return json({ error: 'la derivacion esta cerrada' }, 409)

  // Solo las dos personas de esta derivación entran a esta sala.
  const { data: participante } = await db
    .from('participantes')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()

  const { data: psicologo } = await db
    .from('psicologos')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle()

  const esParticipante = participante?.id === derivacion.participante_id
  const esPsicologo = psicologo?.id === derivacion.psicologo_id
  if (!esParticipante && !esPsicologo) return json({ error: 'sin acceso a esta sesion' }, 403)

  const identidad = esPsicologo ? `psicologo-${psicologo!.id}` : `participante-${participante!.id}`

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identidad,
    ttl: '2h',
  })
  token.addGrant({ roomJoin: true, room: sesion.sala_livekit, canPublish: true, canSubscribe: true })

  // RF-004-02 y RF-004-04 — grabación solo con doble consentimiento, y solo audio.
  // La grabación es un extra sobre la sesión, no una condición: si el
  // almacenamiento no está configurado o el egress falla, la persona entra
  // igual y se avisa con `grabacion: false`. Antes un fallo aquí devolvía 500
  // y nadie podía entrar a la sala.
  let grabacion = false
  if (sesion.consentimiento_participante && sesion.consentimiento_psicologo) {
    try {
      grabacion = await iniciarGrabacion(db, sesion.id, sesion.sala_livekit)
    } catch (e) {
      console.error('grabacion no iniciada', sesion.id, e instanceof Error ? e.message : e)
    }
  }

  return json({ url: LIVEKIT_URL, token: await token.toJwt(), sala: sesion.sala_livekit, grabacion })
})

async function iniciarGrabacion(
  db: ReturnType<typeof servicio>,
  sesionId: string,
  sala: string,
): Promise<boolean> {
  const { data: existente } = await db
    .from('transcripciones')
    .select('id')
    .eq('sesion_id', sesionId)
    .maybeSingle()

  if (existente) return true

  // Sin bucket configurado no hay dónde dejar el audio: se omite, no se rompe.
  if (!Deno.env.get('S3_ACCESS_KEY') || !Deno.env.get('S3_SECRET') || !Deno.env.get('S3_BUCKET')) {
    console.warn('grabacion omitida: faltan S3_ACCESS_KEY / S3_SECRET / S3_BUCKET')
    return false
  }

  const dias = Number(Deno.env.get('RETENCION_DIAS') ?? '30')
  const rutaAudio = `sesiones/${sesionId}.ogg`

  const egress = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  await egress.startRoomCompositeEgress(
    sala,
    {
      fileType: EncodedFileType.OGG,
      filepath: rutaAudio,
      s3: {
        accessKey: Deno.env.get('S3_ACCESS_KEY')!,
        secret: Deno.env.get('S3_SECRET')!,
        bucket: Deno.env.get('S3_BUCKET')!,
        region: Deno.env.get('S3_REGION') ?? 'auto',
        endpoint: Deno.env.get('S3_ENDPOINT'),
      },
    },
    { audioOnly: true },
  )

  // RN-004-09 — el plazo de borrado se fija al crear la fila, no después.
  await db.from('transcripciones').insert({
    sesion_id: sesionId,
    estado: 'procesando',
    audio_ruta: rutaAudio,
    borrar_despues_de: new Date(Date.now() + dias * 86_400_000).toISOString(),
  })
  return true
}

// Token de acceso a la sala — implementa ESP-004 RF-004-01.
//
// La clave de LiveKit nunca sale del servidor: si el cliente pudiera firmar
// sus propios tokens, podría entrar a cualquier sala del sistema.
//
// Si ambas partes autorizaron la grabación (RN-004-06), aquí se arranca el
// egress de audio. Solo audio: nunca video (RF-004-04).

import { AccessToken } from 'npm:livekit-server-sdk@2'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'
import { asegurarGrabacion } from '../_compartido/grabacion.ts'

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
  // Es un extra sobre la sesión, no una condición: si no arranca, la persona
  // entra igual y la etapa queda anotada para la pantalla del psicólogo.
  const grab = await asegurarGrabacion(db, sesion)

  return json({ url: LIVEKIT_URL, token: await token.toJwt(), sala: sesion.sala_livekit, grabacion: grab.grabando, grabacion_error: grab.detalle })
})

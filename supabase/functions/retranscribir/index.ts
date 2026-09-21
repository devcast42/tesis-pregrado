// Reintento manual de transcripción — solo investigador.
// Para cuando el webhook de LiveKit no llegó o Deepgram falló: vuelve a
// encolar la transcripción de una sesión cuyo audio ya está en el bucket.

import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'
import { solicitarTranscripcion } from '../_compartido/deepgram.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const { sesion_id } = await req.json()
  if (!sesion_id) return json({ error: 'falta sesion_id' }, 400)
  const usuario = comoUsuario(req)
  const { data: auth } = await usuario.auth.getUser()
  if (!auth?.user) return json({ error: 'no autenticado' }, 401)
  const db = servicio()
  const { data: rol } = await db.from('usuarios_rol').select('rol').eq('auth_user_id', auth.user.id).maybeSingle()
  if (rol?.rol !== 'investigador') return json({ error: 'solo el investigador' }, 403)
  const r = await solicitarTranscripcion(db, sesion_id)
  return json(r, r.ok ? 200 : 502)
})

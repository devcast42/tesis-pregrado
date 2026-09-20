// Estado del egress de una sala — herramienta de diagnóstico del investigador.
// Devuelve lo que LiveKit sabe de las grabaciones de una sala: estado, error
// y archivo subido. No expone audio ni llaves.

import { EgressClient } from 'npm:livekit-server-sdk@2'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const { sala } = await req.json()
  if (!sala) return json({ error: 'falta sala' }, 400)

  const usuario = comoUsuario(req)
  const { data: auth } = await usuario.auth.getUser()
  if (!auth?.user) return json({ error: 'no autenticado' }, 401)
  const { data: rol } = await servicio().from('usuarios_rol').select('rol').eq('auth_user_id', auth.user.id).maybeSingle()
  if (rol?.rol !== 'investigador') return json({ error: 'solo el investigador' }, 403)

  const egress = new EgressClient(Deno.env.get('LIVEKIT_URL')!, Deno.env.get('LIVEKIT_API_KEY')!, Deno.env.get('LIVEKIT_API_SECRET')!)
  const lista = await egress.listEgress({ roomName: sala })
  return json(lista.map((e) => ({
    egressId: e.egressId, status: e.status, error: e.error, errorCode: e.errorCode,
    startedAt: e.startedAt ? Number(e.startedAt) / 1e6 : null, endedAt: e.endedAt ? Number(e.endedAt) / 1e6 : null,
    archivos: e.fileResults?.map((f) => ({ filename: f.filename, size: Number(f.size), duration: Number(f.duration) / 1e9, location: f.location })),
  })))
})

// Fin de sesión — implementa ESP-004 RF-004-05.
//
// Marca la sesión como terminada y cierra la sala en LiveKit. Cerrarla
// importa: el egress de audio solo termina (y sube el archivo) cuando la
// sala se cierra; si se deja vacía, LiveKit tarda cinco minutos en hacerlo y
// la transcripción se retrasa otro tanto.

import { RoomServiceClient } from 'npm:livekit-server-sdk@2'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const { sesion_id } = await req.json()
  if (!sesion_id) return json({ error: 'falta sesion_id' }, 400)

  const usuario = comoUsuario(req)
  const { data: auth } = await usuario.auth.getUser()
  if (!auth?.user) return json({ error: 'no autenticado' }, 401)

  const db = servicio()
  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('id, sala_livekit, finalizada_en, derivaciones(trabajador_id, psicologo_id)')
    .eq('id', sesion_id)
    .maybeSingle()
  if (!sesion) return json({ error: 'sesion no encontrada' }, 404)

  // Solo las dos personas de la derivación pueden terminarla.
  const deriv = (sesion as any).derivaciones as { trabajador_id: string; psicologo_id: string }
  const [{ data: trabajador }, { data: psicologo }] = await Promise.all([
    db.from('trabajadores').select('id').eq('auth_user_id', auth.user.id).maybeSingle(),
    db.from('psicologos').select('id').eq('auth_user_id', auth.user.id).maybeSingle(),
  ])
  if (trabajador?.id !== deriv.trabajador_id && psicologo?.id !== deriv.psicologo_id) {
    return json({ error: 'sin acceso a esta sesion' }, 403)
  }

  if (!sesion.finalizada_en) {
    await db.from('sesiones_consulta').update({ finalizada_en: new Date().toISOString() }).eq('id', sesion.id)
  }

  // Cerrar la sala: expulsa a quien quede y dispara el fin del egress.
  let sala_cerrada = false
  try {
    const salas = new RoomServiceClient(Deno.env.get('LIVEKIT_URL')!, Deno.env.get('LIVEKIT_API_KEY')!, Deno.env.get('LIVEKIT_API_SECRET')!)
    await salas.deleteRoom(sesion.sala_livekit)
    sala_cerrada = true
  } catch (e) {
    // Si la sala ya no existe no pasa nada; LiveKit la cierra sola.
    console.warn('no se pudo cerrar la sala', sesion.sala_livekit, e instanceof Error ? e.message : e)
  }

  return json({ finalizada: true, sala_cerrada })
})

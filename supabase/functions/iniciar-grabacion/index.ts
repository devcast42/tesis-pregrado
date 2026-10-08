// Arrancar (o reintentar) la grabación de una sesión — ESP-004 RF-004-02.
//
// La llaman las apps justo después de registrar un consentimiento y al
// entrar a la sala: si ambos ya autorizaron y hay alguien dentro, el egress
// arranca aunque los tokens se hayan emitido antes. Idempotente.

import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'
import { asegurarGrabacion } from '../_compartido/grabacion.ts'

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
    .select('id, sala_livekit, consentimiento_trabajador, consentimiento_psicologo, finalizada_en, derivaciones(trabajador_id, psicologo_id)')
    .eq('id', sesion_id)
    .maybeSingle()
  if (!sesion) return json({ error: 'sesion no encontrada' }, 404)

  const deriv = (sesion as any).derivaciones as { trabajador_id: string; psicologo_id: string }
  const [{ data: trabajador }, { data: psicologo }] = await Promise.all([
    db.from('trabajadores').select('id').eq('auth_user_id', auth.user.id).maybeSingle(),
    db.from('psicologos').select('id').eq('auth_user_id', auth.user.id).maybeSingle(),
  ])
  if (trabajador?.id !== deriv.trabajador_id && psicologo?.id !== deriv.psicologo_id) {
    return json({ error: 'sin acceso a esta sesion' }, 403)
  }

  return json(await asegurarGrabacion(db, sesion as any))
})

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
  // El investigador siempre; el psicólogo, solo sobre sus propias sesiones.
  if (rol?.rol !== 'investigador') {
    const { data: ps } = await db.from('psicologos').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
    const { data: ses } = await db.from('sesiones_consulta').select('derivaciones(psicologo_id)').eq('id', sesion_id).maybeSingle()
    if (!ps || (ses as any)?.derivaciones?.psicologo_id !== ps.id) return json({ error: 'sin acceso a esta sesion' }, 403)
  }
  // Si la transcripción ya está pero falló la redacción, se reintenta solo la redacción.
  const { data: t } = await db.from('transcripciones').select('estado, texto').eq('sesion_id', sesion_id).maybeSingle()
  if (t?.estado === 'lista' && t.texto) {
    const { data: inf } = await db.from('informes').select('id').eq('sesion_id', sesion_id).maybeSingle()
    if (inf) return json({ ok: true, detalle: 'el informe ya existe' })
    const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/redactar-informe`, {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sesion_id }),
    })
    return json({ ok: resp.ok, detalle: resp.ok ? 'borrador generado' : `redacción falló (${resp.status})` }, resp.ok ? 200 : 502)
  }
  const r = await solicitarTranscripcion(db, sesion_id)
  return json(r, r.ok ? 200 : 502)
})

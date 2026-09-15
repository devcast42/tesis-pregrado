// Crea la sala de una videoconsulta — implementa ESP-004 RF-004-01.
//
// El nombre de sala lo genera el servidor: si el cliente lo eligiera, podría
// hacerse pasar por otra sesión y entrar a una consulta ajena.

import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const { derivacion_id } = await req.json()
  if (!derivacion_id) return json({ error: 'falta derivacion_id' }, 400)

  // La verificación usa el cliente del usuario: RLS solo devuelve la
  // derivación si realmente le pertenece a quien llama.
  const usuario = comoUsuario(req)
  const { data: derivacion } = await usuario
    .from('derivaciones')
    .select('id, participante_id, cerrada_en')
    .eq('id', derivacion_id)
    .maybeSingle()

  if (!derivacion) return json({ error: 'derivacion no encontrada o sin acceso' }, 403)
  if (derivacion.cerrada_en) return json({ error: 'la derivacion esta cerrada' }, 409)

  const db = servicio()
  const sala = `consulta-${crypto.randomUUID()}`

  const { data: sesion, error } = await db
    .from('sesiones_consulta')
    .insert({ derivacion_id, sala_livekit: sala })
    .select('*')
    .single()

  if (error) return json({ error: error.message }, 500)

  await db.from('eventos').insert({
    participante_id: derivacion.participante_id,
    tipo: 'sesion_iniciada',
    metadata: { sesion_id: sesion.id },
  })

  return json({ sesion })
})

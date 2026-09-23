// Diagnóstico de la conexión S3 del egress — solo investigador.
// Prueba las mismas credenciales que usa LiveKit y devuelve qué falla,
// sin revelar las llaves (solo endpoint, región y nombre del bucket).

import { AwsClient } from 'npm:aws4fetch@1'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  const usuario = comoUsuario(req)
  const { data: auth } = await usuario.auth.getUser()
  if (!auth?.user) return json({ error: 'no autenticado' }, 401)
  const { data: rol } = await servicio().from('usuarios_rol').select('rol').eq('auth_user_id', auth.user.id).maybeSingle()
  if (rol?.rol !== 'investigador') return json({ error: 'solo el investigador' }, 403)

  const endpoint = Deno.env.get('S3_ENDPOINT') ?? '', region = Deno.env.get('S3_REGION') ?? '', bucket = Deno.env.get('S3_BUCKET') ?? ''
  const resumen: Record<string, unknown> = { endpoint, region, bucket, access_key_len: (Deno.env.get('S3_ACCESS_KEY') ?? '').length, secret_len: (Deno.env.get('S3_SECRET') ?? '').length }
  // aws4fetch firma la petición (SigV4) sin cargar el SDK completo.
  const s3 = new AwsClient({ accessKeyId: Deno.env.get('S3_ACCESS_KEY') ?? '', secretAccessKey: Deno.env.get('S3_SECRET') ?? '', region, service: 's3' })
  try {
    const base = endpoint.replace(/\/$/, '')
    const r = await s3.fetch(`${base}/${bucket}?list-type=2&max-keys=5`, { method: 'GET' })
    const cuerpo = await r.text()
    resumen.ok = r.ok
    resumen.http = r.status
    resumen.respuesta = cuerpo.slice(0, 600)
  } catch (e) {
    resumen.ok = false
    resumen.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return json(resumen)
})

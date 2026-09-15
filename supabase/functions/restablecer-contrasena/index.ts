// Restablecer contraseña — implementa ESP-008.
//
// Sin correo de por medio: genera una nueva, la devuelve una vez a quien la
// pidió, y esa persona se la entrega al usuario. Es la contrapartida de haber
// elegido acceso por contraseña.
//
// Cada quien restablece dentro de su alcance: el investigador a cualquiera,
// el admin solo a participantes de su propia empresa.

import { json, preflight, rolDelSolicitante, servicio } from '../_compartido/supabase.ts'
import { generarContrasena } from '../_compartido/cuentas.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    const cuerpo = await req.json()
    if (!cuerpo.auth_user_id && !cuerpo.participante_id) {
      return json({ error: 'falta auth_user_id o participante_id' }, 400)
    }

    const quien = await rolDelSolicitante(req)
    if (quien?.rol !== 'investigador' && quien?.rol !== 'admin') {
      return json({ error: 'no autorizado' }, 403)
    }

    const db = servicio()

    // El cliente puede identificar al participante por su id de participante:
    // así no necesita conocer ids de auth para nada. Los psicólogos y admins
    // sí se piden por auth_user_id, que ya viene en su ficha.
    let auth_user_id = cuerpo.auth_user_id as string | undefined
    if (cuerpo.participante_id) {
      const { data: p } = await db
        .from('participantes')
        .select('auth_user_id')
        .eq('id', cuerpo.participante_id)
        .maybeSingle()
      if (!p?.auth_user_id) return json({ error: 'participante sin cuenta' }, 404)
      auth_user_id = p.auth_user_id
    }
    if (!auth_user_id) return json({ error: 'no se pudo resolver la cuenta' }, 400)

    // El admin solo alcanza a participantes de su empresa. Se comprueba contra
    // la base, no contra lo que diga la petición.
    if (quien.rol === 'admin') {
      const { data: objetivo } = await db
        .from('participantes')
        .select('organizacion_id')
        .eq('auth_user_id', auth_user_id)
        .maybeSingle()

      if (!objetivo || objetivo.organizacion_id !== quien.organizacion_id) {
        return json({ error: 'solo puedes restablecer cuentas de tu empresa' }, 403)
      }
    }

    const contrasena = generarContrasena()
    const { error } = await db.auth.admin.updateUserById(auth_user_id, {
      password: contrasena,
    })

    if (error) return json({ error: error.message }, 500)

    return json({ contrasena })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error inesperado' }, 500)
  }
})

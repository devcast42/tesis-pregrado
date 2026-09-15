// Crear administrador de empresa — implementa ESP-008.
//
// Solo el investigador crea admins: un admin no puede darse compañeros de
// gestión por su cuenta, porque cada uno accede a datos de participación de
// personas reales.

import { json, preflight, rolDelSolicitante, servicio } from '../_compartido/supabase.ts'
import { crearCuenta, deshacerCuenta } from '../_compartido/cuentas.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    const { organizacion_id, correo, nombre } = await req.json()
    if (!organizacion_id || !correo || !nombre) {
      return json({ error: 'faltan organizacion_id, correo o nombre' }, 400)
    }

    // El rol se verifica contra la tabla del servidor, no contra la petición.
    const quien = await rolDelSolicitante(req)
    if (quien?.rol !== 'investigador') {
      return json({ error: 'solo el investigador crea administradores' }, 403)
    }

    const db = servicio()
    const cuenta = await crearCuenta(db, correo)

    // El rol de admin lleva su empresa: sin ella, una restricción de la base
    // rechaza la fila (ESP-008).
    const { error } = await db.from('usuarios_rol').insert({
      auth_user_id: cuenta.id,
      rol: 'admin',
      organizacion_id,
    })

    if (error) {
      await deshacerCuenta(db, cuenta.id)
      return json({ error: error.message }, 500)
    }

    await db.from('administradores').insert({
      auth_user_id: cuenta.id,
      organizacion_id,
      nombre,
    })

    return json({ correo, contrasena: cuenta.contrasena })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error inesperado' }, 500)
  }
})

// Crear psicólogo — implementa ESP-008.
//
// El psicólogo pertenece al ESTUDIO, no a una empresa. Si lo creara la empresa,
// el trabajador asumiría que le reporta a su jefe — y en ese momento deja de
// hablar con franqueza en la sesión, o directamente no acepta la derivación.
// Por eso solo el investigador puede crearlos.

import { json, preflight, rolDelSolicitante, servicio } from '../_compartido/supabase.ts'
import { crearCuenta, deshacerCuenta } from '../_compartido/cuentas.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
    const { correo, nombre, colegiatura } = await req.json()
    if (!correo || !nombre || !colegiatura) {
      return json({ error: 'faltan correo, nombre o colegiatura' }, 400)
    }

    const quien = await rolDelSolicitante(req)
    if (quien?.rol !== 'investigador') {
      return json({ error: 'solo el investigador crea psicologos' }, 403)
    }

    const db = servicio()
    const cuenta = await crearCuenta(db, correo)

    const { error: errorRol } = await db.from('usuarios_rol').insert({
      auth_user_id: cuenta.id,
      rol: 'psicologo',
    })

    if (errorRol) {
      await deshacerCuenta(db, cuenta.id)
      return json({ error: errorRol.message }, 500)
    }

    const { error: errorFicha } = await db.from('psicologos').insert({
      auth_user_id: cuenta.id,
      nombre,
      colegiatura,
    })

    if (errorFicha) {
      await deshacerCuenta(db, cuenta.id)
      return json({ error: errorFicha.message }, 500)
    }

    return json({ correo, contrasena: cuenta.contrasena })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error inesperado' }, 500)
  }
})

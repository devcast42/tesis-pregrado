// Crear psicólogo — implementa ESP-008.
//
// Dos clases de psicólogo:
//   · El investigador crea psicólogos GENERALES (organizacion_id nulo), que
//     atienden a todas las empresas.
//   · El administrador de una empresa crea psicólogos DE SU EMPRESA, que solo
//     atienden a su gente. La empresa se toma de su cuenta, nunca del cuerpo
//     de la petición: un admin no puede crear psicólogos para otra.
//
// Ojo con la confianza: un psicólogo de la empresa puede parecerle al
// trabajador alguien que reporta a su jefe. Lo que sí se mantiene para los
// dos es que el admin no ve casos ni contenido de las sesiones.

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
    if (quien?.rol !== 'investigador' && quien?.rol !== 'admin') {
      return json({ error: 'solo el investigador o el administrador de una empresa crean psicologos' }, 403)
    }
    if (quien.rol === 'admin' && !quien.organizacion_id) {
      return json({ error: 'tu cuenta no esta asociada a ninguna empresa' }, 403)
    }
    const organizacion_id = quien.rol === 'admin' ? quien.organizacion_id : null

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
      organizacion_id,
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

// Inscripción de participantes — implementa ESP-006 RF-006-07.
//
// La separación entre identidad y datos de investigación se hace aquí, en una
// sola operación: el correo y el nombre van a `identidades`; `participantes`
// solo recibe un código anónimo (RN-006-01). Si esto se hiciera en dos pasos
// desde el cliente, un fallo a mitad dejaría participantes sin identidad o
// identidades huérfanas.

import { json, preflight, rolDelSolicitante, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  try {
  const { organizacion_id, correo, nombre } = await req.json()
  if (!organizacion_id || !correo || !nombre) {
    return json({ error: 'faltan organizacion_id, correo o nombre' }, 400)
  }

  // Inscriben el investigador (cualquier empresa) y el admin (solo la suya).
  // El rol y la empresa se leen de la tabla del servidor, nunca de la petición
  // (RN-006-06): si el admin pudiera declarar su propia empresa, inscribiría
  // gente en organizaciones ajenas.
  const rol = await rolDelSolicitante(req)
  if (rol?.rol !== 'investigador' && rol?.rol !== 'admin') {
    return json({ error: 'no autorizado para inscribir' }, 403)
  }

  if (rol.rol === 'admin' && rol.organizacion_id !== organizacion_id) {
    return json({ error: 'solo puedes inscribir en tu propia empresa' }, 403)
  }

  const db = servicio()
  const correoNormalizado = String(correo).trim().toLowerCase()

  // Contraseña legible, para poder dictarla por teléfono sin errores.
  // Se muestra UNA vez al investigador y no se guarda en claro en ningún lado:
  // Supabase solo conserva su hash.
  const contrasena = generarContrasena()

  // 1. Cuenta de acceso, creada en silencio y ya confirmada.
  //
  //    No se usa inviteUserByEmail: la invitación manda un ENLACE, y la app
  //    entra con CÓDIGO (ESP-001 RF-001-01). Serían dos correos por dos
  //    caminos distintos, y el participante recibiría un enlace que no encaja
  //    con lo que la pantalla le pide. Se crea la cuenta sin avisar, y el
  //    participante entra por el flujo normal cuando le toque.
  const { data: creado, error: errorCuenta } = await db.auth.admin.createUser({
    email: correoNormalizado,
    password: contrasena,
    email_confirm: true,
  })

  if (errorCuenta || !creado?.user) {
    return json({ error: errorCuenta?.message ?? 'no se pudo crear la cuenta' }, 409)
  }

  const idCuenta = creado.user.id

  // 2. Código anónimo correlativo dentro del estudio
  const { count } = await db
    .from('participantes')
    .select('id', { count: 'exact', head: true })

  const codigo = `P-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: participante, error: errorParticipante } = await db
    .from('participantes')
    .insert({
      organizacion_id,
      auth_user_id: idCuenta,
      codigo_anonimo: codigo,
    })
    .select('id')
    .single()

  if (errorParticipante) {
    await db.auth.admin.deleteUser(idCuenta)
    return json({ error: errorParticipante.message }, 500)
  }

  // 3. Identidad, en su tabla aparte
  const { error: errorIdentidad } = await db.from('identidades').insert({
    participante_id: participante.id,
    nombre,
    correo_contacto: correoNormalizado,
  })

  if (errorIdentidad) return json({ error: errorIdentidad.message }, 500)

  await db.from('usuarios_rol').insert({
    auth_user_id: idCuenta,
    rol: 'participante',
  })

  // 4. Marca de inicio del seguimiento: es la mitad del indicador de tiempo
  //    de detección de la tesis.
  await db.from('eventos').insert({
    participante_id: participante.id,
    tipo: 'inicio_seguimiento',
    metadata: { inscrito_por: rol.rol },
  })

  return json({ participante_id: participante.id, codigo_anonimo: codigo, contrasena })
  } catch (e) {
    // Sin esto, cualquier excepción sale como un 500 vacío y no hay forma de
    // saber qué pasó desde el cliente.
    return json({ error: e instanceof Error ? e.message : 'error inesperado' }, 500)
  }
})

/** Tres palabras cortas y un número: fácil de dictar por teléfono sin errores,
 *  difícil de adivinar. El participante la escribe una vez y la app guarda la
 *  sesión, así que no tiene que recordarla a diario. */
function generarContrasena(): string {
  const palabras = [
    'ancla', 'brisa', 'cedro', 'duna', 'faro', 'grano', 'hilo', 'islote',
    'lirio', 'monte', 'nube', 'ola', 'pino', 'rama', 'sauce', 'trigo',
  ]
  const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
  const elegidas = Array.from({ length: 3 }, () => palabras[azar(palabras.length)])
  return `${elegidas.join('-')}-${100 + azar(900)}`
}

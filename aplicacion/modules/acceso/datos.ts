/** Acceso — implementa ESP-001 (RF-001-01, RF-001-02, RF-001-03).
 *
 *  El correo del trabajador vive solo en `auth.users` y nunca se copia a las
 *  tablas de investigación (RN-001-01). `trabajadores` se identifica por
 *  código anónimo. */

import { idUsuario, supabase } from '../nucleo/supabase'
import type { Trabajador } from '../nucleo/tipos'
import { olvidarDesbloqueo } from './bloqueo'

/** RF-001-01 — acceso con correo y contraseña.
 *
 *  La contraseña la genera el sistema al inscribir y la entrega el equipo de
 *  investigación por el mismo canal donde ocurre el consentimiento informado
 *  (ESP-001 §3). No hay registro abierto: si el correo no está inscrito, no
 *  hay cuenta contra la que autenticar. */
export async function iniciarSesion(correo: string, contrasena: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  })
  if (error) throw error
}

export async function haySesion() {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/** El correo con el que se entró. Lo pide el perfil del psicólogo para no
 *  tener que inventarse una tabla de contacto que ya existe en `auth`. */
export async function correoActual(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.email ?? ''
}

export async function cerrarSesion() {
  olvidarDesbloqueo()
  await supabase.auth.signOut()
}

/** RF-001-03 — devuelve null si la cuenta no está vinculada al estudio.
 *
 *  El filtro por auth_user_id es imprescindible, no redundante: el
 *  investigador tiene permiso de lectura sobre toda la tabla, y sin filtro
 *  esta consulta le devolvería la fila de un trabajador cualquiera. */
export async function obtenerTrabajador(): Promise<Trabajador | null> {
  const id = await idUsuario()
  if (!id) return null

  const { data } = await supabase
    .from('trabajadores')
    .select('id, organizacion_id, codigo_anonimo, estado, inscrito_en')
    .eq('auth_user_id', id)
    .maybeSingle()

  return (data as Trabajador | null) ?? null
}

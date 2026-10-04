/** Rol del usuario autenticado — implementa ESP-006 (RF-006-13, RN-006-06).
 *
 *  El rol se lee del servidor, nunca de metadatos del token: un rol
 *  autodeclarado por el cliente no es un control de acceso. Esta función
 *  solo decide a qué pantalla ir; el acceso real lo impone RLS. */

import { idUsuario, supabase } from './supabase'

export type Rol = 'trabajador' | 'psicologo' | 'investigador' | 'admin'

export async function obtenerRol(): Promise<Rol | null> {
  const id = await idUsuario()
  if (!id) return null

  // Filtrar por auth_user_id no es redundante con RLS: el investigador ve
  // todas las filas de esta tabla, y sin filtro la consulta devolvería más de
  // una y fallaría —dejándolo sin rol.
  const { data } = await supabase
    .from('usuarios_rol')
    .select('rol')
    .eq('auth_user_id', id)
    .maybeSingle()

  return (data?.rol as Rol | undefined) ?? null
}

export const RUTA_INICIAL: Record<Rol, string> = {
  trabajador: '/hoy',
  psicologo: '/psicologo',
  investigador: '/investigador',
  admin: '/admin',
}

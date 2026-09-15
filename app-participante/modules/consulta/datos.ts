/** Videoconsulta — acceso a datos. Implementa ESP-004. */

import { supabase } from '../nucleo/supabase'
import type { Credenciales } from './tipos'

/** El token de sala lo firma el servidor. El cliente no puede firmarse su
 *  propio acceso: la clave de LiveKit nunca sale del servidor. */
export async function obtenerCredenciales(sesionId: string): Promise<Credenciales> {
  const { data, error } = await supabase.functions.invoke('token-livekit', {
    body: { sesion_id: sesionId },
  })
  if (error) throw error
  return data as Credenciales
}

export async function finalizarSesion(sesionId: string) {
  const { error } = await supabase
    .from('sesiones_consulta')
    .update({ finalizada_en: new Date().toISOString() })
    .eq('id', sesionId)

  if (error) throw error
}

export async function obtenerSesion(sesionId: string) {
  const { data, error } = await supabase
    .from('sesiones_consulta')
    .select('*')
    .eq('id', sesionId)
    .single()

  if (error) throw error
  return data
}

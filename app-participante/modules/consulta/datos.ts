/** Videoconsulta — acceso a datos. Implementa ESP-004. */

import { supabase } from '../nucleo/supabase'
import type { Credenciales } from './tipos'

/** El token de sala lo firma el servidor. El cliente no puede firmarse su
 *  propio acceso: la clave de LiveKit nunca sale del servidor. */
export async function obtenerCredenciales(sesionId: string): Promise<Credenciales> {
  const { data, error } = await supabase.functions.invoke('token-livekit', {
    body: { sesion_id: sesionId },
  })
  if (error) {
    // Mientras la función no esté desplegada con sus llaves (backlog E4), el
    // error es un 404 sin cuerpo. Un mensaje humano en lugar del código.
    const estado = (error as { context?: { status?: number } }).context?.status
    if (estado === 404) throw new Error('La videollamada todavía no está habilitada en este entorno.')
    throw new Error('No se pudo entrar a la sala. Revisa tu conexión e inténtalo de nuevo.')
  }
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

export type SesionDisponible = {
  id: string
  iniciada_en: string
  consentimiento_participante: boolean
}

/** La sesión de apoyo abierta del participante, si la hay.
 *
 *  RLS acota a las propias (política "participante ve su sesion"), así que no
 *  hace falta filtrar por participante. Se toma la más reciente sin
 *  finalizar. Null significa que no hay nada que ofrecer, y la pantalla
 *  principal simplemente no muestra la tarjeta —sin explicar por qué. */
export async function sesionDisponible(): Promise<SesionDisponible | null> {
  const { data } = await supabase
    .from('sesiones_consulta')
    .select('id, iniciada_en, consentimiento_participante')
    .is('finalizada_en', null)
    .order('iniciada_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as SesionDisponible | null) ?? null
}

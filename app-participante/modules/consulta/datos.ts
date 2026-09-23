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

/** Termina la sesión y cierra la sala en LiveKit (así el audio se sube de
 *  inmediato, no cinco minutos después). Si la función no responde, al menos
 *  se marca el fin en la base. */
export async function finalizarSesion(sesionId: string) {
  const { error } = await supabase.functions.invoke('finalizar-sesion', { body: { sesion_id: sesionId } })
  if (!error) return
  const { error: errorDb } = await supabase
    .from('sesiones_consulta')
    .update({ finalizada_en: new Date().toISOString() })
    .eq('id', sesionId)
  if (errorDb) throw errorDb
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
  // Solo una sala viva de verdad: de las últimas tres horas. Una sala que
  // nadie cerró ayer no es una invitación a entrar (la base la marca como
  // finalizada de todos modos, ver `cerrar_sesiones_huerfanas`). No se filtra
  // por derivación abierta porque el participante no lee `derivaciones`.
  const hace3h = new Date(Date.now() - 3 * 3_600_000).toISOString()
  const { data } = await supabase
    .from('sesiones_consulta')
    .select('id, iniciada_en, consentimiento_participante')
    .is('finalizada_en', null)
    .gte('iniciada_en', hace3h)
    .order('iniciada_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as SesionDisponible | null) ?? null
}

/** Pide al servidor arrancar la grabación si ya hay doble consentimiento y
 *  alguien en la sala. Idempotente; se llama al autorizar y al entrar. */
export async function iniciarGrabacion(sesionId: string): Promise<{ grabando: boolean; etapa: string; detalle?: string } | null> {
  const { data, error } = await supabase.functions.invoke('iniciar-grabacion', { body: { sesion_id: sesionId } })
  return error ? null : (data as { grabando: boolean; etapa: string; detalle?: string })
}

/** Reintenta el paso que falló (transcripción o redacción). */
export async function reintentarCircuito(sesionId: string): Promise<{ ok: boolean; detalle: string }> {
  const { data, error } = await supabase.functions.invoke('retranscribir', { body: { sesion_id: sesionId } })
  if (error) return { ok: false, detalle: 'No se pudo reintentar. Revisa tu conexión.' }
  return data as { ok: boolean; detalle: string }
}

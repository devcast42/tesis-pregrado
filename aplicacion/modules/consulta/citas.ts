/** Citas con el psicólogo pedidas por el trabajador — implementa ESP-004
 *  RF-004-13 … RF-004-16.
 *
 *  Todo pasa por funciones de base de datos: el cliente no elige psicólogo
 *  ni escribe en `citas`. Aquí solo hay llamadas y el calendario de horarios
 *  que se ofrecen. */

import { supabase } from '../nucleo/supabase'
import { ahora } from '../nucleo/reloj'

export type EstadoCita = 'solicitada' | 'confirmada' | 'cancelada' | 'atendida'

export type Cita = {
  id: string
  propuesta_para: string
  motivo: string | null
  estado: EstadoCita
  cancelada_por: 'trabajador' | 'psicologo' | null
  creada_en: string
  psicologo: string
}

export async function misCitas(): Promise<Cita[]> {
  const { data, error } = await supabase.rpc('mis_citas')
  if (error) throw error
  return (data ?? []) as Cita[]
}

/** La cita viva (pedida o confirmada), si la hay. Solo puede haber una. */
export function citaVigente(citas: Cita[]): Cita | null {
  return citas.find((c) => c.estado === 'solicitada' || c.estado === 'confirmada') ?? null
}

export async function solicitarCita(para: Date, motivo: string): Promise<Cita> {
  const { data, error } = await supabase.rpc('solicitar_cita', {
    p_para: para.toISOString(),
    p_motivo: motivo.trim() || null,
  })
  if (error) throw new Error(mensajeDe(error.message))
  return data as Cita
}

export async function cancelarCita(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_cita', { p_cita: id })
  if (error) throw new Error(mensajeDe(error.message))
}

/** Los errores de la función vienen en clave; a la persona se le habla en
 *  palabras. */
function mensajeDe(m: string): string {
  if (/pendiente/.test(m)) return 'Ya tienes una cita pendiente. Cancélala si quieres cambiar la hora.'
  if (/anticipacion/.test(m)) return 'Elige una hora con al menos una hora de anticipación.'
  if (/psicologos disponibles/.test(m)) return 'Por ahora no hay profesionales disponibles. Inténtalo más tarde.'
  return 'No se pudo guardar la cita. Revisa tu conexión e inténtalo de nuevo.'
}

// ------------------------------------------------------------- Horarios

/** Horas que se ofrecen (hora local del trabajador). Jornada laboral
 *  amplia; el psicólogo confirma o propone otra. */
export const HORAS_OFRECIDAS = [9, 10, 11, 12, 15, 16, 17, 18]

/** Próximos días hábiles a partir de mañana (hoy solo si aún quedan horas). */
export function diasOfrecidos(cantidad = 10): Date[] {
  const dias: Date[] = []
  const d = ahora()
  d.setHours(0, 0, 0, 0)
  // Hoy cuenta si todavía hay alguna hora ofrecida con una hora de margen.
  const ultimaHoraHoy = new Date(d); ultimaHoraHoy.setHours(HORAS_OFRECIDAS[HORAS_OFRECIDAS.length - 1])
  if (ultimaHoraHoy.getTime() - ahora().getTime() < 60 * 60 * 1000) d.setDate(d.getDate() + 1)
  while (dias.length < cantidad) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) dias.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return dias
}

/** Horas de un día que todavía se pueden pedir (una hora de margen). */
export function horasDisponibles(dia: Date): number[] {
  const limite = ahora().getTime() + 60 * 60 * 1000
  return HORAS_OFRECIDAS.filter((h) => {
    const t = new Date(dia); t.setHours(h, 0, 0, 0)
    return t.getTime() >= limite
  })
}

export function fechaHora(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora}`
}

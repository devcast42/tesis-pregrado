/** Datos de detalle por participante — pantalla /investigador/participante/[id]. */

import { supabase } from '../nucleo/supabase'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PerfilParticipante = {
  id: string
  codigo_anonimo: string
  organizacion: string
  estado: string
  inscrito_en: string
  // Adherencia
  dias_sin_checkin: number | null
  tasa_adherencia: number | null
  estado_adherencia: string | null
  inicio_seguimiento: string | null
  ultimo_checkin: string | null
  dias_esperados: number | null
  dias_cumplidos: number | null
  // Resumen
  olbi_respondidos: number
  dias_hasta_deteccion: number | null
}

export type PuntoCheckin = {
  dia: string
  carga_percibida: number | null
  horas_sueno: number | null
  energia: number | null
  horas_trabajadas: number | null
}

export type PuntoOlbi = {
  enviado_en: string
  agotamiento: number | null
  desvinculacion: number | null
}

export type EventoParticipante = {
  tipo: string
  ocurrido_en: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Cabecera + adherencia del participante. */
export async function obtenerPerfil(id: string): Promise<PerfilParticipante | null> {
  // panel_participantes ya une participantes + organizaciones + adherencia +
  // indicador_tiempo_deteccion, así que es una sola consulta.
  const { data: fila, error } = await supabase
    .from('panel_participantes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!fila) return null

  // Completamos con datos de adherencia que panel_participantes no incluye
  const { data: adh } = await supabase
    .from('adherencia')
    .select('inicio_seguimiento, ultimo_checkin, dias_esperados, dias_cumplidos')
    .eq('participante_id', id)
    .maybeSingle()

  return {
    ...(fila as Omit<PerfilParticipante, 'inicio_seguimiento' | 'ultimo_checkin' | 'dias_esperados' | 'dias_cumplidos'>),
    inicio_seguimiento: adh?.inicio_seguimiento ?? null,
    ultimo_checkin:     adh?.ultimo_checkin ?? null,
    dias_esperados:     adh?.dias_esperados ?? null,
    dias_cumplidos:     adh?.dias_cumplidos ?? null,
  } as PerfilParticipante
}

/** Serie diaria de check-ins. Por defecto los últimos 60 días. */
export async function obtenerHistorialCheckin(
  participanteId: string,
  dias = 60,
): Promise<PuntoCheckin[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('historial_checkin')
    .select('dia, carga_percibida, horas_sueno, energia, horas_trabajadas')
    .eq('participante_id', participanteId)
    .gte('dia', desde)
    .order('dia', { ascending: true })

  if (error) throw error
  return (data ?? []) as PuntoCheckin[]
}

/** Trayectoria OLBI — todos los registros del participante. */
export async function obtenerHistorialOlbi(participanteId: string): Promise<PuntoOlbi[]> {
  const { data, error } = await supabase
    .from('historial_olbi')
    .select('enviado_en, agotamiento, desvinculacion')
    .eq('participante_id', participanteId)
    .order('enviado_en', { ascending: true })

  if (error) throw error
  return (data ?? []) as PuntoOlbi[]
}

/** Hitos de la línea de tiempo del participante. */
export async function obtenerEventos(participanteId: string): Promise<EventoParticipante[]> {
  const { data, error } = await supabase
    .from('eventos_participante')
    .select('tipo, ocurrido_en, metadata')
    .eq('participante_id', participanteId)
    .order('ocurrido_en', { ascending: false })

  if (error) throw error
  return (data ?? []) as EventoParticipante[]
}

/** Panel del investigador — implementa ESP-006 (RF-006-07 … RF-006-11).
 *
 *  Los indicadores de la tesis se leen de vistas, nunca se recalculan aquí:
 *  si la app los recalculara habría dos verdades, y la que llegue al capítulo
 *  de resultados sería la que alguien copió a mano. */

import { supabase } from '../nucleo/supabase'

export type Resumen = {
  inscritos: number
  activos: number
  detectados: number
  empresas: number
  al_dia: number
  en_riesgo: number
  inactivos: number
  nunca_inicio: number
  adherencia_promedio: number | null
  dias_deteccion_promedio: number | null
  derivaciones_abiertas: number
  derivaciones_cerradas: number
  informes_por_revisar: number
}

export type AdherenciaEmpresa = {
  organizacion_id: string
  nombre: string
  participantes_activos: number
  al_dia: number
  en_riesgo: number
  inactivos: number
  nunca_iniciaron: number
  tasa_promedio: number | null
}

export type DeteccionReciente = {
  participante_id: string
  codigo_anonimo: string
  organizacion: string
  detectado_en: string
  agotamiento: number | null
  desvinculacion: number | null
  derivacion_id: string | null
  cerrada_en: string | null
  psicologo: string | null
}

export type FilaParticipante = {
  id: string
  codigo_anonimo: string
  organizacion: string
  estado: string
  inscrito_en: string
  dias_sin_checkin: number | null
  tasa_adherencia: number | null
  estado_adherencia: string | null
  dias_hasta_deteccion: number | null
  olbi_respondidos: number
}

export type Precision = {
  tp: number
  fp: number
  fn: number
  precision_pct: number | null
  recall_pct: number | null
  f1_pct: number | null
}

export async function obtenerResumen(): Promise<Resumen | null> {
  const { data, error } = await supabase.from('resumen_estudio').select('*').maybeSingle()
  if (error) throw error
  return (data as Resumen | null) ?? null
}

/** Urgencia de contacto, de más a menos.
 *
 *  Antes se ordenaba por `estado_adherencia` alfabético y salía bien de pura
 *  casualidad —al_dia < en_riesgo < inactivo < nunca_inicio en orden
 *  alfabético coincide con la gravedad. Renombrar un estado habría cambiado
 *  el orden de la pantalla sin que nadie lo notara. */
const URGENCIA: Record<string, number> = {
  nunca_inicio: 0,
  inactivo: 1,
  en_riesgo: 2,
  al_dia: 3,
}

export async function listarParticipantes(): Promise<FilaParticipante[]> {
  const { data, error } = await supabase.from('panel_participantes').select('*')
  if (error) throw error

  const filas = (data ?? []) as FilaParticipante[]

  // Primero quien está a punto de caerse del estudio, y dentro de cada estado
  // el de peor tasa. Un estado desconocido cae al final, a la vista, en vez de
  // colarse entre los sanos.
  return filas.sort((a, b) => {
    const ua = URGENCIA[a.estado_adherencia ?? ''] ?? 99
    const ub = URGENCIA[b.estado_adherencia ?? ''] ?? 99
    if (ua !== ub) return ua - ub
    return (a.tasa_adherencia ?? 0) - (b.tasa_adherencia ?? 0)
  })
}

/** Indicador 1 del Anexo 3. Vacío hasta que exista el modelo (ESP-005).
 *  Se reporta con recall y F1: la precisión sola es manipulable. */
export async function obtenerPrecision(): Promise<Precision | null> {
  const { data, error } = await supabase.from('indicador_precision').select('*').maybeSingle()
  if (error) throw error
  return (data as Precision | null) ?? null
}

/** Indicador 2 del Anexo 3. */
export async function obtenerVolumen(dias = 30) {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('indicador_volumen')
    .select('*')
    .gte('dia', desde)
    .order('dia', { ascending: true })

  if (error) throw error
  return (data ?? []) as { dia: string; formulario: string; profesionales_evaluados: number }[]
}

/** Indicador 3 del Anexo 3. `censurado` marca a quien terminó sin detección:
 *  no es un negativo limpio (documento de arquitectura §5.4). */
export async function obtenerTiemposDeteccion() {
  const { data, error } = await supabase
    .from('indicador_tiempo_deteccion')
    .select('codigo_anonimo, metodo, dias_hasta_deteccion, dias_hasta_derivacion, censurado')
    .order('dias_hasta_deteccion', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as {
    codigo_anonimo: string
    metodo: string | null
    dias_hasta_deteccion: number | null
    dias_hasta_derivacion: number | null
    censurado: boolean
  }[]
}

/** Adherencia agrupada por empresa. Es una métrica de operación, no un
 *  resultado: sirve para saber a qué empresa hay que llamar antes de que su
 *  cohorte se caiga del estudio.
 *
 *  Deliberadamente NO agrupa detecciones por empresa. El dato existe, pero un
 *  panel que ordena empresas por tasa de burnout es un ranking de empleadores;
 *  en cuanto una lo ve, la siguiente se lo piensa antes de entrar al estudio. */
export async function adherenciaPorEmpresa(): Promise<AdherenciaEmpresa[]> {
  const { data, error } = await supabase
    .from('adherencia_por_organizacion')
    .select('*')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as AdherenciaEmpresa[]
}

/** Detecciones con el estado de su derivación. Lo que el investigador vigila
 *  aquí es el circuito —detectado, ¿derivado?—, no el cuadro de la persona. */
export async function deteccionesRecientes(limite = 8): Promise<DeteccionReciente[]> {
  const { data, error } = await supabase
    .from('detecciones_recientes')
    .select('*')
    .limit(limite)
  if (error) throw error
  return (data ?? []) as DeteccionReciente[]
}

export async function exportarDataset() {
  const [respuestas, items, eventos] = await Promise.all([
    supabase.from('respuestas').select('*'),
    supabase.from('respuestas_items').select('*'),
    supabase.from('eventos').select('*'),
  ])

  return {
    respuestas: respuestas.data ?? [],
    respuestas_items: items.data ?? [],
    eventos: eventos.data ?? [],
    exportado_en: new Date().toISOString(),
  }
}

/** Descarga el dataset anonimizado como JSON.
 *
 *  Solo web: el panel del investigador se usa en escritorio y en nativo no hay
 *  un "descargar" equivalente sin depender del sistema de archivos. */
export async function descargarDataset() {
  const datos = await exportarDataset()
  const nombre = `dataset-burnout-${new Date().toISOString().slice(0, 10)}.json`

  if (typeof document === 'undefined') {
    throw new Error('La exportación solo está disponible en el navegador.')
  }

  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)

  return { nombre, filas: datos.respuestas.length }
}

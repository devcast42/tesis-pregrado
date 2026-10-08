/** Recolección — implementa ESP-002 (RF-002-02, RF-002-03, RF-002-04). */

import { supabase } from '../nucleo/supabase'
import type { ClaveFormulario, Formulario, Valores } from '../nucleo/tipos'
import type { Calendarios } from './agenda'
import type { Evaluacion, Prediccion } from '../trabajador/resultado'
import { ahora } from '../nucleo/reloj'

/** RF-002-02 — versión vigente del formulario, leída de base de datos.
 *  El versionado no es opcional (RN-002-02): sin él, respuestas de distintos
 *  momentos del estudio dejan de ser comparables sin que nada falle. */
export async function obtenerFormulario(clave: ClaveFormulario): Promise<Formulario> {
  const { data, error } = await supabase
    .from('formularios')
    .select('clave, version, definicion')
    .eq('clave', clave)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (error) throw error
  return data as Formulario
}

/** RF-002-04 y RN-002-03 — marca el inicio de la evaluación.
 *  Se llama al MONTAR la pantalla, no al enviar: junto con `enviado_en` define
 *  el indicador de tiempo de detección de la tesis. Capturarlo al enviar lo
 *  dejaría siempre en cero. */
export async function registrarInicio(
  trabajadorId: string,
  clave: ClaveFormulario,
): Promise<string> {
  const iniciadoEn = new Date().toISOString()

  await supabase.from('eventos').insert({
    trabajador_id: trabajadorId,
    tipo: 'evaluacion_iniciada',
    ocurrido_en: iniciadoEn,
    metadata: { formulario: clave },
  })

  return iniciadoEn
}

/** RF-002-03 — guarda la respuesta ítem por ítem. El puntaje agregado no se
 *  almacena en ninguna parte: se recalcula siempre desde estos valores, para
 *  que un cambio de umbral o de fórmula no obligue a recolectar de nuevo. */
export async function enviarRespuesta(params: {
  trabajadorId: string
  formulario: Formulario
  iniciadoEn: string
  valores: Valores
}): Promise<{ id: string; evaluacion: Evaluacion | null }> {
  const { trabajadorId, formulario, iniciadoEn, valores } = params

  const { data: respuesta, error: errorRespuesta } = await supabase
    .from('respuestas')
    .insert({
      trabajador_id: trabajadorId,
      formulario_clave: formulario.clave,
      formulario_version: formulario.version,
      iniciado_en: iniciadoEn,
    })
    .select('id')
    .single()

  if (errorRespuesta) throw errorRespuesta

  // Solo los ítems que se mostraron hoy (RF-002-09): un ítem de «solo lunes»
  // no deja fila vacía el martes.
  const filas = formulario.definicion.items.filter((item) => item.clave in valores).map((item) => {
    const valor = valores[item.clave]
    const esNumerico = typeof valor === 'number' || typeof valor === 'boolean'
    return {
      respuesta_id: respuesta.id,
      item_clave: item.clave,
      valor_num: esNumerico ? Number(valor) : null,
      valor_texto: typeof valor === 'string' ? valor : null,
    }
  })

  const { error: errorItems } = await supabase.from('respuestas_items').insert(filas)
  if (errorItems) throw errorItems

  await supabase.from('eventos').insert({
    trabajador_id: trabajadorId,
    tipo: 'evaluacion_enviada',
    metadata: {
      formulario: formulario.clave,
      formulario_version: formulario.version,
      respuesta_id: respuesta.id,
    },
  })

  // RN-002-05 — la puntuación corre en el servidor (ESP-003). El cliente
  // nunca decide una detección ni conoce los umbrales: solo recibe el
  // resultado ya calculado para mostrárselo a la persona (RF-002-12).
  let evaluacion: Evaluacion | null = null
  if (formulario.clave === 'olbi') {
    const { data } = await supabase.functions.invoke('evaluar-olbi', {
      body: { respuesta_id: respuesta.id },
    })
    if (data && typeof data.detectado === 'boolean') evaluacion = data as Evaluacion
  }

  return { id: respuesta.id as string, evaluacion }
}

/** RF-002-09 — calendario y título de la versión vigente de cada formulario.
 *  Una sola consulta: la tabla tiene un puñado de filas. */
export async function calendarios(): Promise<Calendarios> {
  const { data, error } = await supabase
    .from('formularios')
    .select('clave, version, definicion')
    .order('version', { ascending: false })
  if (error) throw error

  const resultado: Calendarios = {}
  for (const fila of data ?? []) {
    const clave = fila.clave as ClaveFormulario
    if (resultado[clave]) continue // ya tenemos la versión mayor
    const def = fila.definicion as Formulario['definicion']
    resultado[clave] = {
      titulo: def.titulo,
      descripcion: def.descripcion,
      duracion: def.duracion,
      dias: def.dias,
      gracia_dias: def.gracia_dias,
      despues_de: def.despues_de,
    }
  }
  return resultado
}

/** Fecha del último envío de cada formulario. Insumo de la agenda. */
export async function ultimosEnvios(
  trabajadorId: string,
): Promise<Partial<Record<ClaveFormulario, string>>> {
  const { data } = await supabase
    .from('respuestas')
    .select('formulario_clave, enviado_en')
    .eq('trabajador_id', trabajadorId)
    .order('enviado_en', { ascending: false })

  const ultimo: Partial<Record<ClaveFormulario, string>> = {}
  for (const fila of data ?? []) {
    const clave = fila.formulario_clave as ClaveFormulario
    if (!ultimo[clave]) ultimo[clave] = fila.enviado_en as string
  }
  return ultimo
}

/** Días de la semana en curso (lunes a domingo) con el formulario del día
 *  enviado: el `diario` de lunes a jueves o el `olbi` del viernes.
 *
 *  Devuelve índices 0–6 con 0 = lunes. Solo días respondidos: la pantalla
 *  principal no marca los que faltan, a propósito (RF-002-08 y la regla de
 *  no reprochar del diseño). Semana en horario local del dispositivo, que es
 *  el que la persona vive. */
export async function diasConCheckinEstaSemana(
  trabajadorId: string,
  referencia = ahora(),
): Promise<Set<number>> {
  const lunes = inicioDeSemana(referencia)

  const { data } = await supabase
    .from('respuestas')
    .select('enviado_en')
    .eq('trabajador_id', trabajadorId)
    .in('formulario_clave', ['diario', 'olbi'])
    .gte('enviado_en', lunes.toISOString())

  const dias = new Set<number>()
  for (const fila of data ?? []) {
    dias.add(indiceLunes(new Date(fila.enviado_en as string)))
  }
  return dias
}

/** Lunes 00:00 local de la semana que contiene la fecha. */
/** Todos los envíos de diario y OLBI del trabajador, para el detalle de
 *  registros (RF-002-07). Solo fecha y formulario: nada de respuestas. */
export async function enviosDelEstudio(trabajadorId: string): Promise<{ clave: 'diario' | 'olbi'; enviado_en: string }[]> {
  const { data } = await supabase
    .from('respuestas')
    .select('formulario_clave, enviado_en')
    .eq('trabajador_id', trabajadorId)
    .in('formulario_clave', ['diario', 'olbi'])
    .order('enviado_en')
  return (data ?? []).map((f) => ({ clave: f.formulario_clave as 'diario' | 'olbi', enviado_en: f.enviado_en as string }))
}

export function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - indiceLunes(d))
  return d
}

/** 0 = lunes … 6 = domingo. `getDay()` empieza en domingo, que aquí no sirve. */
export function indiceLunes(fecha: Date): number {
  return (fecha.getDay() + 6) % 7
}

/** ESP-005 §8 — probabilidad (nowcast) de que el OLBI del viernes cruce el
 *  umbral, con la versión activa del modelo, y su registro como evento. El
 *  cálculo vive en Postgres; aquí solo se pide. `null` si no hay modelo
 *  visible para el trabajador o no respondió ningún día esta semana. */
export async function prediccionActual(
  trabajadorId: string,
  tarea: 'nowcast' | 'pronostico' = 'nowcast',
): Promise<Prediccion | null> {
  const { data, error } = await supabase.rpc('registrar_prediccion', { p_trabajador: trabajadorId, p_tarea: tarea })
  if (error || !data) return null
  const p = data as Prediccion
  return p.probabilidad == null ? null : { ...p, tarea }
}

/** RF-002-14 — la última predicción nowcast de esta semana (la del jueves,
 *  normalmente): lo que el modelo dijo antes de que el OLBI hablara. */
export async function ultimaPrediccionSemana(
  trabajadorId: string,
): Promise<{ probabilidad: number; dia: string; n_dias: number } | null> {
  const { data, error } = await supabase.rpc('ultima_prediccion_semana', { p_trabajador: trabajadorId })
  if (error || !data) return null
  const d = data as { probabilidad: number; dia: string; n_dias: number }
  return typeof d.probabilidad === 'number' ? d : null
}

/** Última respuesta al formulario `estable`, como valores por clave, junto
 *  con la definición para poder mostrar etiquetas en lugar de códigos.
 *  Null si nunca se respondió. Se usa en Perfil (ESP-002 RF-002-16). */
export async function datosIniciales(trabajadorId: string): Promise<{ valores: Valores; enviado_en: string } | null> {
  const { data: r } = await supabase
    .from('respuestas')
    .select('id, enviado_en')
    .eq('trabajador_id', trabajadorId)
    .eq('formulario_clave', 'estable')
    .order('enviado_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!r) return null

  const { data: items } = await supabase
    .from('respuestas_items')
    .select('item_clave, valor_num, valor_texto')
    .eq('respuesta_id', r.id)

  const valores: Valores = {}
  for (const i of items ?? []) {
    valores[i.item_clave] = i.valor_texto ?? Number(i.valor_num)
  }
  return { valores, enviado_en: r.enviado_en as string }
}

export type Racha = { actual: number; mejor: number; hoy_cumplido: boolean }

/** RF-002-07 — racha de días hábiles consecutivos, calculada en el servidor. */
export async function racha(trabajadorId: string): Promise<Racha> {
  const { data, error } = await supabase.rpc('racha', { p_trabajador: trabajadorId })
  if (error || !data) return { actual: 0, mejor: 0, hoy_cumplido: false }
  return data as Racha
}


export type OlbiToca = {
  toca: boolean
  motivo?: 'modelo' | 'sorteo' | 'sin_medir' | 'ya_respondido' | 'no_toca'
  probabilidad?: number
}

/** Si hoy corresponde el cuestionario completo. Lo decide el servidor: puede
 *  tocar porque el modelo avisó, porque salió en el sorteo semanal —que es la
 *  única medida limpia que queda del modelo— o porque lleva un mes sin
 *  medirse. Nunca lo decide la app: el umbral y el sorteo viven donde viven
 *  los pesos. */
export async function olbiToca(): Promise<OlbiToca> {
  const { data, error } = await supabase.rpc('olbi_toca')
  if (error || !data) return { toca: false }
  return data as OlbiToca
}


export type DiaSemana = { dia: string; indice: number | null; sueno: number | null }

/** Los días de esta semana con su índice diario, para dibujarlos.
 *
 *  Es el promedio de las cuatro preguntas de ánimo, de 1 a 5. Se enseña al
 *  cerrar el check-in porque es lo único que esa persona construye
 *  contestando: sin esto, responder a diario es dar datos a cambio de nada. */
export async function semanaEnCurso(trabajadorId: string): Promise<DiaSemana[]> {
  const lunes = new Date()
  lunes.setHours(0, 0, 0, 0)
  lunes.setDate(lunes.getDate() - ((lunes.getDay() || 7) - 1))
  const { data } = await supabase
    .from('serie_diaria_v2')
    .select('dia, indice_diario, horas_sueno')
    .eq('trabajador_id', trabajadorId)
    .gte('dia', lunes.toISOString().slice(0, 10))
    .order('dia')
  return (data ?? []).map((r: Record<string, unknown>) => ({
    dia: String(r.dia),
    indice: r.indice_diario == null ? null : Number(r.indice_diario),
    sueno: r.horas_sueno == null ? null : Number(r.horas_sueno),
  }))
}

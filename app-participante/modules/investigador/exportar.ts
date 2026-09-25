/** Exportación del dataset anonimizado — implementa ESP-009 RF-009-13, RN-009-06.
 *
 *  Genera en el navegador un ZIP con un CSV por tabla, `diccionario.md` y
 *  `manifest.json` (fecha, filtros, esquema, conteos, hash). Antes de
 *  entregar el archivo registra la exportación en `eventos` con el mismo
 *  hash: el capítulo de resultados puede citar qué extracción usó.
 *
 *  El ZIP se escribe a mano (entradas «stored», sin compresión) para no
 *  añadir una dependencia: son texto plano y el tamaño no importa aquí. */

import { supabase } from '../nucleo/supabase'
import type { FiltroGlobal } from './panel'

export const TABLAS = [
  { clave: 'respuestas', archivo: 'tbl_respuestas.csv', titulo: 'tbl_respuestas', descripcion: 'Un envío por formulario y fecha (diario, OLBI, semanal, estable), con inicio y fin.' },
  { clave: 'respuestas_items', archivo: 'tbl_respuestas_items.csv', titulo: 'tbl_respuestas_items', descripcion: 'Respuesta ítem a ítem de cada envío: clave del ítem, valor numérico o de texto.' },
  { clave: 'puntajes_olbi', archivo: 'tbl_puntajes_olbi.csv', titulo: 'tbl_puntajes_olbi', descripcion: 'Media por dimensión del OLBI de cada aplicación, con la inversión aplicada (fuente única de la fórmula).' },
  // ESP-005 §8: `semanas_modelo` es el contrato de datos del modelo. Sustituye
  // a `ventanas_modelo`, que implementaba la formulación de ventanas de 14 días
  // de la revisión 1 (§3.4) y ya no es con lo que se entrena: exportarla daba
  // un dataset con el que los resultados de la tesis no se pueden reproducir.
  { clave: 'semanas_modelo', archivo: 'tbl_semanas_modelo.csv', titulo: 'tbl_semanas_modelo', descripcion: 'Contrato de entrenamiento: una fila por participante y semana con los rasgos de ESP-005 §4 y ambas etiquetas (nowcast y pronóstico), censurada en el primer cruce.' },
  { clave: 'predicciones_participante', archivo: 'tbl_predicciones.csv', titulo: 'tbl_predicciones', descripcion: 'Predicciones registradas en su momento (nowcast y pronóstico) confrontadas con el OLBI objetivo.' },
  { clave: 'eventos', archivo: 'tbl_eventos.csv', titulo: 'tbl_eventos', descripcion: 'Eventos de proceso: inicio, detección, derivación, sesión, informe aprobado, accesos a identidad.' },
] as const

export type ClaveTabla = (typeof TABLAS)[number]['clave']

/** Conteos por tabla con el filtro aplicado, para mostrar antes de exportar.
 *
 *  Van en serie a propósito. Cuatro de las seis fuentes son vistas y contarlas
 *  cuesta 2-3 s cada una; lanzadas en paralelo se estorban y alguna pasa el
 *  `statement_timeout` de 8 s. Cuando eso ocurría, PostgREST devolvía 500 y el
 *  `count ?? 0` lo convertía en un cero indistinguible de una tabla vacía: la
 *  pantalla anunciaba 1 913 filas para un paquete de 14 327. Un conteo que
 *  falla vale `null` y se muestra como «?», nunca como 0.
 *  La página no espera este cálculo, así que la demora no se nota. */
export async function conteos(filtro: FiltroGlobal): Promise<Record<ClaveTabla, number | null>> {
  const ids = await participantesDelFiltro(filtro)
  const out = {} as Record<ClaveTabla, number | null>
  for (const t of TABLAS) {
    // respuestas_items no tiene participante_id: se filtra a través de su envío.
    // Sin filtro de empresa no hace falta esa unión, y contar 11 000 ítems
    // uniéndolos a sus envíos sí llegaba a agotar el tiempo.
    const porEnvio = t.clave === 'respuestas_items' && !!ids
    let q = porEnvio
      ? supabase.from(t.clave).select('respuesta_id, respuestas!inner(participante_id)', { count: 'exact', head: true })
      : supabase.from(t.clave).select(t.clave === 'respuestas_items' ? 'respuesta_id' : 'participante_id', { count: 'exact', head: true })
    if (ids) q = q.in(porEnvio ? 'respuestas.participante_id' : 'participante_id', ids)
    const { count, error } = await q
    out[t.clave] = error ? null : count ?? 0
  }
  return out
}

async function participantesDelFiltro(filtro: FiltroGlobal): Promise<string[] | null> {
  if (!filtro.organizacion_id) return null
  const { data } = await supabase.from('participantes').select('id').eq('organizacion_id', filtro.organizacion_id)
  return (data ?? []).map((p) => p.id as string)
}

async function filas(tabla: ClaveTabla, ids: string[] | null): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  const PAGINA = 1000
  for (let desde = 0; ; desde += PAGINA) {
    const anidada = tabla === 'respuestas_items'
    let q = supabase.from(tabla).select(anidada ? '*, respuestas!inner(participante_id)' : '*').range(desde, desde + PAGINA - 1)
    if (ids) q = q.in(anidada ? 'respuestas.participante_id' : 'participante_id', ids)
    const { data, error } = await q
    if (error) throw error
    for (const fila of (data ?? []) as unknown as Record<string, unknown>[]) {
      // La tabla exportada lleva participante_id como columna plana, no como objeto anidado.
      if (anidada) { const r = fila.respuestas as { participante_id: string } | null; delete fila.respuestas; fila.participante_id = r?.participante_id ?? null }
      out.push(fila)
    }
    if (!data || data.length < PAGINA) break
  }
  return out
}

function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

// ------------------------------------------------------------------- ZIP

const CRC_TABLA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** ZIP sin compresión (método 0). Suficiente para CSV y JSON. */
function zip(archivos: { nombre: string; contenido: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = [] as Uint8Array[]
  let offset = 0
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
  const ahora = new Date()
  const dosTime = ((ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1)) & 0xffff
  const dosDate = (((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate()) & 0xffff

  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const datos = enc.encode(a.contenido)
    const crc = crc32(datos)
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length), ...u16(nombre.length), ...u16(0),
    ])
    partes.push(local, nombre, datos)
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length), ...u16(nombre.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), nombre)
    offset += local.length + nombre.length + datos.length
  }
  const centralLen = central.reduce((s, p) => s + p.length, 0)
  const fin = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length),
    ...u32(centralLen), ...u32(offset), ...u16(0),
  ])
  const total = offset + centralLen + fin.length
  const out = new Uint8Array(total)
  let p = 0
  for (const x of [...partes, ...central, fin]) { out.set(x, p); p += x.length }
  return out
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ------------------------------------------------------------ Diccionario

export const DICCIONARIO = [
  { variable: 'olbi_exhaustion_score', tipo: 'float64', texto: 'Promedio de los 8 ítems de la subescala de Agotamiento del Oldenburg Burnout Inventory (OLBI).', rango: 'Rango teórico: [1.0 – 4.0] · Corte clínico: ≥ 2.875 (Leclercq)' },
  { variable: 'olbi_disengagement_score', tipo: 'float64', texto: 'Promedio de los 8 ítems de la subescala de Desvinculación con el Trabajo del OLBI.', rango: 'Rango teórico: [1.0 – 4.0] · Corte clínico: ≥ 2.75 (Leclercq)' },
  { variable: 'od_04 … od_06', tipo: 'int8', texto: 'Los cuatro ítems negativos del OLBI aplicados a diario (lunes a jueves), escala 1–5.', rango: 'Rango: [1 – 5] · Fuente: Gruszczynska et al. (2021)' },
  { variable: 'weekend_hours', tipo: 'float32', texto: 'Horas de trabajo registradas entre el sábado 00:00 y el domingo 23:59 PET, declaradas el lunes.', rango: 'Rango observado: [0.0 – 18.5] h · Ventana: S1..S6' },
  { variable: 'model_probability', tipo: 'float64', texto: 'Probabilidad calibrada de que el OLBI de la semana objetivo esté sobre el umbral (nowcast: misma semana; pronóstico: siguiente).', rango: 'Registrada en su momento (RN-009-05) · Versión en cada fila' },
  { variable: 'senalado / resultado_real / acierto', tipo: 'bool', texto: 'Decisión del modelo (probabilidad ≥ umbral), resultado real del viernes objetivo, y si coincidieron.', rango: 'acierto nulo = sin resultado aún o nowcast tardío' },
]

// ------------------------------------------------------------- Exportar

export type ResultadoExportacion = { nombre: string; hash: string; conteos: Record<string, number>; bytes: number }

export type Formato = 'csv' | 'json'

export async function exportarZip(filtro: FiltroGlobal, tablas: ClaveTabla[], formato: Formato = 'csv'): Promise<ResultadoExportacion> {
  if (typeof document === 'undefined') throw new Error('La exportación solo está disponible en el navegador.')
  const ids = await participantesDelFiltro(filtro)
  const archivos: { nombre: string; contenido: string }[] = []
  const cont: Record<string, number> = {}
  for (const t of TABLAS) {
    if (!tablas.includes(t.clave)) continue
    const rows = await filas(t.clave, ids)
    cont[t.clave] = rows.length
    archivos.push(formato === 'json'
      ? { nombre: t.archivo.replace(/\.csv$/, '.json'), contenido: JSON.stringify(rows) }
      : { nombre: t.archivo, contenido: csv(rows) })
  }
  const diccionario = ['# Diccionario de variables', '', ...DICCIONARIO.map((d) => `## ${d.variable} (${d.tipo})\n${d.texto}\n${d.rango}\n`)].join('\n')
  archivos.push({ nombre: 'diccionario.md', contenido: diccionario })

  const contenidoParaHash = archivos.map((a) => `${a.nombre}\n${a.contenido}`).join('\n---\n')
  const hash = await sha256(contenidoParaHash)
  const manifest = {
    generado_en: new Date().toISOString(),
    filtros: { organizacion_id: filtro.organizacion_id, semanas: [filtro.semanaDesde, filtro.semanaHasta] },
    esquema: 'ESP-009 v1',
    formato,
    tablas: tablas,
    conteos: cont,
    sha256: hash,
  }
  archivos.push({ nombre: 'manifest.json', contenido: JSON.stringify(manifest, null, 2) })

  // RN-009-06: primero el registro, luego el archivo.
  const { error } = await supabase.rpc('registrar_exportacion', { p_filtros: { ...manifest.filtros, formato }, p_conteos: cont, p_hash: hash })
  if (error) throw error

  const bytes = zip(archivos)
  const nombre = `dataset-burnout-${manifest.generado_en.slice(0, 10)}-${hash.slice(0, 8)}.zip`
  const blob = new Blob([bytes as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { nombre, hash, conteos: cont, bytes: bytes.length }
}

/** Ficha de un participante en JSON o CSV (RF-009-09). */
export function descargarTexto(nombre: string, contenido: string, tipo = 'application/json') {
  if (typeof document === 'undefined') return
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { csv as aCsv }

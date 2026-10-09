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
  { clave: 'respuestas', archivo: 'tbl_respuestas.csv', orden: ['id'], titulo: 'tbl_respuestas', descripcion: 'Un envío por formulario, con inicio y fin: diario (check-in), olbi, semanal (las tres preguntas que siguen al OLBI) y estable (perfil al inscribirse).' },
  { clave: 'respuestas_items', archivo: 'tbl_respuestas_items.csv', orden: ['id'], titulo: 'tbl_respuestas_items', descripcion: 'Respuesta ítem a ítem de cada envío: clave del ítem, valor numérico o de texto.' },
  { clave: 'puntajes_olbi', archivo: 'tbl_puntajes_olbi.csv', orden: ['respuesta_id', 'dimension'], titulo: 'tbl_puntajes_olbi', descripcion: 'Media por dimensión del OLBI de cada aplicación, con la inversión aplicada (fuente única de la fórmula).' },
  // ESP-005 §8: `semanas_modelo` es el contrato de datos del modelo. Sustituye
  // a `ventanas_modelo`, que implementaba la formulación de ventanas de 14 días
  // de la revisión 1 (§3.4) y ya no es con lo que se entrena: exportarla daba
  // un dataset con el que los resultados de la tesis no se pueden reproducir.
  { clave: 'semanas_modelo', archivo: 'tbl_semanas_modelo.csv', orden: ['trabajador_id', 'semana'], titulo: 'tbl_semanas_modelo', descripcion: 'Una fila por trabajador y semana con los rasgos del modelo y sus etiquetas. La etiqueta solo existe las semanas con OLBI; se corta en el primer cruce.' },
  { clave: 'predicciones_trabajador', archivo: 'tbl_predicciones.csv', orden: ['evento_id'], titulo: 'tbl_predicciones', descripcion: 'Cada predicción registrada en su momento, confrontada con el OLBI de su semana, y por qué se pidió ese OLBI.' },
  { clave: 'eventos', archivo: 'tbl_eventos.csv', orden: ['id'], titulo: 'tbl_eventos', descripcion: 'Eventos de proceso: predicción, petición del OLBI, detección, derivación, citas, sesión, informe, alta y accesos a identidad.' },
] as const

export type ClaveTabla = (typeof TABLAS)[number]['clave']

/** Cuántas filas entrarían en el paquete, por tabla y con el filtro puesto.
 *
 *  Un conteo que no se pudo obtener vale `null` y la pantalla lo enseña como
 *  «?». Nunca 0: cuando esto devolvía 0 al fallar, el resumen anunciaba 1 913
 *  filas para un paquete de 14 327, y ese número es el que cita la tesis.
 *
 *  Van en serie porque cuatro de las seis fuentes son vistas y cada una cuesta
 *  unos segundos; en paralelo se estorban.
 *  La página no espera este cálculo, así que la demora no se nota. */
export async function conteos(filtro: FiltroGlobal): Promise<Record<ClaveTabla, number | null>> {
  const ids = await trabajadoresDelFiltro(filtro)
  const out = {} as Record<ClaveTabla, number | null>
  for (const t of TABLAS) out[t.clave] = await contar(t.clave, ids)
  return out
}

/** Tope del recuento manual. Muy por encima de lo que dan las vistas, que es
 *  donde hace falta; si alguna vez se alcanza, no se adivina: vale `null`. */
const TOPE_RECUENTO = 20000

async function contar(tabla: ClaveTabla, ids: string[] | null): Promise<number | null> {
  // respuestas_items no tiene trabajador_id: se filtra a través de su envío.
  // Sin filtro de empresa esa unión no hace falta.
  const porEnvio = tabla === 'respuestas_items' && !!ids
  const columna = porEnvio ? 'respuesta_id, respuestas!inner(trabajador_id)'
    : tabla === 'respuestas_items' ? 'respuesta_id' : 'trabajador_id'
  const clave = porEnvio ? 'respuestas.trabajador_id' : 'trabajador_id'

  let q = supabase.from(tabla).select(columna, { count: 'exact', head: true })
  if (ids) q = q.in(clave, ids)
  const exacto = await q
  if (!exacto.error) return exacto.count ?? 0

  // `count=exact` hace que PostgREST evalúe la consulta dos veces, una para la
  // página y otra para el total. En una vista cara eso dobla el coste y pasa
  // del `statement_timeout`: `semanas_modelo` tarda 8,4 s contándose y 5,6 s
  // si solo se piden las filas. Así que cuando el conteo falla se traen las
  // claves y se cuentan aquí, que evalúa la vista una sola vez.
  let m = supabase.from(tabla).select(columna).range(0, TOPE_RECUENTO)
  if (ids) m = m.in(clave, ids)
  const manual = await m
  if (manual.error || !manual.data) return null
  // Si vino justo el tope, la lista está cortada y el número sería menor que
  // el real: más vale decir que no se sabe.
  return manual.data.length > TOPE_RECUENTO ? null : manual.data.length
}

async function trabajadoresDelFiltro(filtro: FiltroGlobal): Promise<string[] | null> {
  if (!filtro.organizacion_id) return null
  const { data } = await supabase.from('trabajadores').select('id').eq('organizacion_id', filtro.organizacion_id)
  return (data ?? []).map((p) => p.id as string)
}

/** Vuelca una tabla entera, de mil en mil.
 *
 *  El orden es obligatorio, no cosmético: sin `order by`, Postgres no promete
 *  que dos consultas con distinto `offset` recorran las filas en el mismo
 *  orden, y una fila puede salir dos veces mientras otra no sale ninguna. El
 *  paquete es la base de los resultados de la tesis: tiene que ser el mismo
 *  cada vez que se genere. */
async function filas(tabla: ClaveTabla, ids: string[] | null): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  const PAGINA = 1000
  const orden = TABLAS.find((t) => t.clave === tabla)!.orden
  for (let desde = 0; ; desde += PAGINA) {
    const anidada = tabla === 'respuestas_items'
    let q = supabase.from(tabla).select(anidada ? '*, respuestas!inner(trabajador_id)' : '*').range(desde, desde + PAGINA - 1)
    for (const col of orden) q = q.order(col)
    if (ids) q = q.in(anidada ? 'respuestas.trabajador_id' : 'trabajador_id', ids)
    const { data, error } = await q
    if (error) throw error
    for (const fila of (data ?? []) as unknown as Record<string, unknown>[]) {
      // La tabla exportada lleva trabajador_id como columna plana, no como objeto anidado.
      if (anidada) { const r = fila.respuestas as { trabajador_id: string } | null; delete fila.respuestas; fila.trabajador_id = r?.trabajador_id ?? null }
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
  { variable: 'puntajes_olbi.puntaje', tipo: 'numeric', texto: 'Media de los 8 ítems de una subescala del OLBI, con la inversión ya aplicada. La columna `dimension` dice cuál: agotamiento o desvinculacion. Formato largo: dos filas por aplicación.', rango: 'Escala 1–4 · Corte: ≥ 2.875 agotamiento, ≥ 2.75 desvinculación (Leclercq)' },
  { variable: 'respuestas_items.item_clave', tipo: 'text', texto: 'Qué se preguntó. Diario (v4, la actual, de lunes a jueves): od_04, od_12, od_03, od_06 (ítems del OLBI en versión diaria), horas_trabajadas y horas_sueno. Las versiones 2 y 3 también traían horas_fin_de_semana, desconexion y contacto_fuera_horario, que v4 ya no pregunta. Cuando toca el OLBI: olbi_01…olbi_16 y, justo después, horas_sobretiempo, guardias, apoyo_lider. Al inscribirse: edad, antiguedad_empresa, antiguedad_sector, tamano_equipo, personas_a_cargo, minutos_traslado, rol, modalidad.', rango: 'El valor va en valor_num, salvo rol y modalidad, que van en valor_texto' },
  { variable: 'respuestas_items.valor_num', tipo: 'numeric', texto: 'El valor respondido. Los ítems diarios del OLBI van en escala 1–5; los 16 del OLBI completo en escala 1–4; contacto_fuera_horario, guardias y personas_a_cargo son 0 o 1; el resto son horas o cuentas. En v4, horas_trabajadas y horas_sueno se eligen por rangos y se guarda el punto medio.', rango: 'od_*: [1–5] · olbi_*: [1–4] · horas_sueno: [4.3–10.0] h observado' },
  { variable: 'semanas_modelo.t_media … t_pendiente', tipo: 'numeric', texto: 'Resumen semanal de los cuatro ítems diarios: media, último día, peor día y pendiente dentro de la semana. Son las entradas del modelo (ESP-005 §4.1). La columna `semana` es el lunes de esa semana ISO, no un número de 1 a 6.', rango: 'Una fila por trabajador y semana, censurada en el primer cruce' },
  { variable: 'semanas_modelo.alto_t / alto_t1', tipo: 'bool', texto: 'Las dos etiquetas. alto_t: si el OLBI de esa semana salió alto (nowcast); alto_t1: el de la semana siguiente (pronóstico). Alto = agotamiento Y desvinculación sobre su corte, como la detección. Son nulas las semanas sin OLBI, que ahora son la mayoría: el cuestionario se pide al que el modelo señala, por sorteo, al mes o tras un alta.', rango: 'Ver predicciones_trabajador.motivo · usar e_previo/d_previo solo con alto_t1' },
  { variable: 'predicciones_trabajador.probabilidad', tipo: 'numeric', texto: 'Lo que el modelo dijo en su momento, no recalculado después. `tarea` distingue nowcast de pronostico y `version` dice qué modelo lo produjo.', rango: '[0.0 – 1.0] · RN-009-05' },
  { variable: 'predicciones_trabajador.senalado / resultado_real / acierto', tipo: 'bool', texto: 'Si el modelo levantó la mano (probabilidad ≥ umbral), qué salió en el OLBI de esa semana, y si coincidieron. tardio = la predicción se dijo después de contestar el OLBI y no cuenta.', rango: 'acierto nulo = esa semana no hubo OLBI, o la predicción es tardía' },
  { variable: 'predicciones_trabajador.motivo', tipo: 'text', texto: 'Por qué se pidió el OLBI de esa semana. Importa para analizar: a quien el modelo no señala solo se le mide por sorteo, al mes o tras un alta, así que los falsos negativos salen de una muestra pequeña.', rango: 'modelo · sorteo · sin_medir · tras_alta · nulo = antes del cambio, OLBI para todos los viernes' },
]

// ------------------------------------------------------------- Exportar

export type ResultadoExportacion = { nombre: string; hash: string; conteos: Record<string, number>; bytes: number }

export type Formato = 'csv' | 'json'

export async function exportarZip(filtro: FiltroGlobal, tablas: ClaveTabla[], formato: Formato = 'csv'): Promise<ResultadoExportacion> {
  if (typeof document === 'undefined') throw new Error('La exportación solo está disponible en el navegador.')
  const ids = await trabajadoresDelFiltro(filtro)
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
    // Solo se declara lo que de verdad se aplicó. El rango de semanas de la
    // barra lateral no filtra ninguna consulta (las semanas se guardan como
    // fecha del lunes, no como número de 1 a 6), así que anotarlo aquí haría
    // que el manifiesto describiera un corte que nadie hizo.
    filtros: { organizacion_id: filtro.organizacion_id, periodo: 'todo el seguimiento' },
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

/** Ficha de un trabajador en JSON o CSV (RF-009-09). */
export function descargarTexto(nombre: string, contenido: string, tipo = 'application/json') {
  if (typeof document === 'undefined') return
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { csv as aCsv }

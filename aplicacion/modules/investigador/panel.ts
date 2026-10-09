/** Panel del investigador — acceso a datos. Implementa ESP-009.
 *
 *  Todo sale de vistas y funciones del servidor (RN-009-01). Aquí no se
 *  recalcula ningún indicador ni métrica del modelo: solo se consulta, se
 *  filtra por el filtro global y se da forma para las pantallas. */

import { supabase } from '../nucleo/supabase'

// ----------------------------------------------------------- Filtro global

/** Empresa y rango de semanas del estudio; persiste en la URL (RF-009-06). */
export type FiltroGlobal = { organizacion_id: string | null }
export const FILTRO_POR_DEFECTO: FiltroGlobal = { organizacion_id: null }

// ----------------------------------------------------------------- Bandeja

export type TipoPendiente =
  | 'inactivo' | 'sin_viernes' | 'deteccion_sin_derivacion' | 'derivacion_sin_sesion'
  | 'cita_sin_confirmar' | 'informe_pendiente' | 'consentimiento_pendiente'

export type Pendiente = {
  tipo: TipoPendiente
  trabajador_id: string
  codigo_anonimo: string
  organizacion_id: string
  empresa: string | null
  referencia_id: string
  desde: string
  dias: number
}

export async function bandeja(filtro?: FiltroGlobal): Promise<Pendiente[]> {
  let q = supabase.from('bandeja_investigador').select('*').order('dias', { ascending: false })
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { data } = await q
  return (data ?? []) as Pendiente[]
}

// ----------------------------------------------------------- Trabajadores

export type FilaTrabajadorV2 = {
  id: string
  codigo_anonimo: string
  organizacion_id: string
  organizacion: string
  estado: 'activo' | 'detectado' | 'retirado' | 'finalizado'
  inscrito_en: string
  semana: number
  dias_sin_checkin: number | null
  tasa_adherencia: number | null
  estado_adherencia: string | null
  dias_cumplidos: number | null
  dias_esperados: number | null
  olbi_semana: string | null
  olbi_agotamiento: number | null
  olbi_desvinculacion: number | null
  olbi_alto: boolean | null
  olbi_nivel: 'bajo' | 'a_vigilar' | 'alto' | null
  nowcast: number | null
  nowcast_dias: number | null
  nowcast_version: string | null
  derivacion_id: string | null
  psicologo: string | null
  estado_derivacion: string | null
  origen_derivacion: string | null
  estado_cita: 'solicitada' | 'confirmada' | null
  cita_para: string | null
  detectado_en: string | null
}

const URGENCIA_ESTADO: Record<string, number> = { detectado: 0, activo: 1, retirado: 2, finalizado: 3 }

/** Orden por defecto: urgencia / riesgo relativo (RF-009-07). */
export async function trabajadores(filtro?: FiltroGlobal): Promise<FilaTrabajadorV2[]> {
  let q = supabase.from('panel_trabajadores_v2').select('*')
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as FilaTrabajadorV2[]).sort((a, b) => {
    const ea = URGENCIA_ESTADO[a.estado] ?? 9, eb = URGENCIA_ESTADO[b.estado] ?? 9
    if (ea !== eb) return ea - eb
    const na = a.nowcast ?? -1, nb = b.nowcast ?? -1
    if (na !== nb) return nb - na
    return (b.dias_sin_checkin ?? 0) - (a.dias_sin_checkin ?? 0)
  })
}

/** Cuántos trabajadores siguen activos. Es lo único que necesita la barra
 *  superior, que la pintaba trayéndose `panel_trabajadores_v2` entera —58
 *  filas anchas con seis CTE materializadas, la consulta más cara del panel—
 *  en cada pantalla, para después contar en el navegador. Aquí cuenta la
 *  base sobre `trabajadores`, que el investigador ya puede leer. */
export async function cuantosActivos(filtro?: FiltroGlobal): Promise<number | null> {
  let q = supabase.from('trabajadores').select('id', { count: 'exact', head: true }).eq('estado', 'activo')
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { count, error } = await q
  return error ? null : count ?? 0
}

// -------------------------------------------------------------------- Ficha

export type Ficha = {
  trabajador_id: string
  codigo_anonimo: string
  empresa: string | null
  organizacion_id: string
  estado: FilaTrabajadorV2['estado']
  inscrito_en: string
  semana: number
  adherencia: { esperados: number; cumplidos: number; tasa: number | null; viernes_esperados: number; viernes_cumplidos: number; dias_sin_checkin: number | null } | null
  derivacion: { id: string; psicologo: string | null; psicologo_id: string; origen: string; estado: string; derivado_en: string } | null
  cita: { id: string; estado: string; propuesta_para: string } | null
  deteccion: { ocurrido_en: string; puntajes: Record<string, number> | null; umbrales: Record<string, number> | null } | null
  ultimo_olbi: { semana: string; agotamiento: number; desvinculacion: number; alto: boolean } | null
  ultima_prediccion: { tarea: string; dia: string; probabilidad: number; version: string; acierto: boolean | null } | null
}

export async function ficha(id: string): Promise<Ficha | null> {
  const { data, error } = await supabase.rpc('ficha_trabajador', { p_id: id })
  if (error) throw error
  return (data as Ficha | null) ?? null
}

export type Envio = { dia: string; formulario_clave: string; formulario_version: number; enviado_en: string; segundos: number | null }
export async function calendario(id: string): Promise<Envio[]> {
  const { data } = await supabase.from('calendario_respuestas').select('*').eq('trabajador_id', id).order('enviado_en')
  return (data ?? []) as Envio[]
}

export type DiaSerie = {
  dia: string; enviado_en: string
  od_04: number | null; od_12: number | null; od_03: number | null; od_06: number | null
  indice_diario: number | null; horas_trabajadas: number | null; horas_sueno: number | null; horas_fin_de_semana: number | null
}
export async function serieDiaria(id: string): Promise<DiaSerie[]> {
  const { data } = await supabase.from('serie_diaria_v2').select('*').eq('trabajador_id', id).order('dia')
  // Un día = una fila: si hubo dos envíos el mismo día (pruebas), se queda el último.
  const porDia = new Map<string, DiaSerie>()
  for (const d of (data ?? []) as DiaSerie[]) porDia.set(d.dia, d)
  return [...porDia.values()]
}

export type OlbiSemana = {
  respuesta_id: string; enviado_en: string; semana: string
  agotamiento: number; desvinculacion: number; alto: boolean
  umbral_agotamiento: number; umbral_desvinculacion: number
}
export async function olbiSemanal(id: string): Promise<OlbiSemana[]> {
  const { data } = await supabase.from('olbi_semanal_etiquetado').select('*').eq('trabajador_id', id).order('semana')
  return (data ?? []) as OlbiSemana[]
}

export type Prediccion = {
  evento_id: number; ocurrido_en: string; tarea: 'nowcast' | 'pronostico'; version: string
  dia: string; semana: string; semana_objetivo: string; n_dias: number | null
  probabilidad: number; senalado: boolean; tardio: boolean
  resultado_real: boolean | null; agotamiento_real: number | null; desvinculacion_real: number | null; acierto: boolean | null
}
export async function predicciones(id: string): Promise<Prediccion[]> {
  const { data } = await supabase.from('predicciones_trabajador').select('*').eq('trabajador_id', id).order('ocurrido_en')
  return (data ?? []) as Prediccion[]
}

export type RespuestaConItems = {
  id: string; formulario_clave: string; formulario_version: number; enviado_en: string
  items: { item_clave: string; valor_num: number | null; valor_texto: string | null }[]
}
export async function respuestasConItems(id: string): Promise<RespuestaConItems[]> {
  const { data } = await supabase
    .from('respuestas')
    .select('id, formulario_clave, formulario_version, enviado_en, respuestas_items(item_clave, valor_num, valor_texto)')
    .eq('trabajador_id', id)
    .order('enviado_en', { ascending: false })
  return ((data ?? []) as any[]).map((r) => ({ ...r, items: r.respuestas_items ?? [] }))
}

export type DefinicionItem = { clave: string; texto: string; tipo: string; dimension?: string; invertido?: boolean; escala?: { min: number; max: number }; opciones?: { valor: string; etiqueta: string }[] }
export async function definiciones(): Promise<Record<string, { version: number; titulo: string; items: DefinicionItem[] }[]>> {
  const { data } = await supabase.from('formularios').select('clave, version, definicion')
  const out: Record<string, { version: number; titulo: string; items: DefinicionItem[] }[]> = {}
  for (const f of (data ?? []) as any[]) {
    (out[f.clave] ??= []).push({ version: f.version, titulo: f.definicion.titulo, items: f.definicion.items })
  }
  return out
}

export type Hito = { tipo: string; ocurrido_en: string; metadata: Record<string, any> }
export async function lineaTiempo(id: string): Promise<Hito[]> {
  const { data } = await supabase.from('linea_tiempo_trabajador').select('*').eq('trabajador_id', id).order('ocurrido_en')
  return (data ?? []) as Hito[]
}

export async function verIdentidad(id: string): Promise<{ nombre: string; correo_contacto: string } | null> {
  const { data, error } = await supabase.rpc('obtener_identidad', { p_trabajador_id: id })
  if (error) throw error
  const fila = Array.isArray(data) ? data[0] : data
  return fila ? { nombre: fila.nombre, correo_contacto: fila.correo_contacto } : null
}

export async function cerrarSeguimiento(id: string, motivo: 'fin_de_estudio' | 'salida_empresa' | 'otro') {
  const { error } = await supabase.rpc('cerrar_seguimiento', { p_id: id, p_motivo: motivo })
  if (error) throw error
}

export async function reasignarDerivacion(derivacionId: string, psicologoId: string, motivo?: string) {
  const { error } = await supabase.rpc('reasignar_derivacion', { p_derivacion: derivacionId, p_psicologo: psicologoId, p_motivo: motivo ?? null })
  if (error) throw error
}

// ------------------------------------------------------------------ Modelo

export type VersionModelo = {
  version: string; tarea: 'nowcast' | 'pronostico'; origen: string; activa: boolean
  umbral_decision: number; visible_para: string[]; metricas: Record<string, any>
  /** Cuándo se puso en uso; nulo si fue antes de que se registrara. */
  activada_en?: string | null
  /** Ojo con el nombre: la columna es `entrenado_en`. El tipo decía
   *  `entrenada_en`, que no existe, así que la fecha salía siempre vacía en
   *  Versiones, Desempeño y Auditoría; el `as VersionModelo[]` del select lo
   *  tapaba y TypeScript no podía avisar. */
  entrenado_en: string | null
  /** De dónde salen los datos con que se entrenó. Tampoco se veía: el código
   *  pedía `notas`, que no es columna de esta tabla. */
  fuente: string | null
}
export async function versiones(): Promise<VersionModelo[]> {
  const { data } = await supabase.from('modelo_versiones').select('*').order('tarea').order('activa', { ascending: false })
  return (data ?? []) as VersionModelo[]
}

export type Desempeno = {
  tarea: string; version: string; semana: string | null; n: number
  vp: number; fp: number; vn: number; fn: number
  precision: number | null; recall: number | null; especificidad: number | null; exactitud: number | null
}
export async function desempeno(tarea: string, version?: string): Promise<Desempeno[]> {
  let q = supabase.from('desempeno_modelo').select('*').eq('tarea', tarea)
  if (version) q = q.eq('version', version)
  const { data } = await q
  return (data ?? []) as Desempeno[]
}

export type Calibracion = { tarea: string; version: string; decil: number; n: number; prob_media: number; frecuencia_observada: number }
export async function calibracion(tarea: string, version: string): Promise<Calibracion[]> {
  const { data } = await supabase.from('calibracion_modelo').select('*').eq('tarea', tarea).eq('version', version).order('decil')
  return (data ?? []) as Calibracion[]
}

/** Pares (probabilidad, resultado) para Brier e intervalos en el cliente. */
export async function evaluables(tarea: string, version: string): Promise<{ probabilidad: number; resultado_real: boolean; senalado: boolean; semana_objetivo: string; motivo: string | null }[]> {
  const { data } = await supabase.from('predicciones_evaluables').select('probabilidad, resultado_real, senalado, semana_objetivo, motivo').eq('tarea', tarea).eq('version', version)
  return (data ?? []).map((r: any) => ({ ...r, probabilidad: Number(r.probabilidad) }))
}

export async function rocAuc(tarea: string, version: string): Promise<number | null> {
  const { data } = await supabase.rpc('roc_auc_modelo', { p_tarea: tarea, p_version: version })
  return data == null ? null : Number(data)
}

export async function activarVersion(version: string, tarea: string) {
  await supabase.from('modelo_versiones').update({ activa: false }).eq('tarea', tarea)
  const { error } = await supabase.from('modelo_versiones').update({ activa: true }).eq('version', version)
  if (error) throw error
}

// ----------------------------------------------------------------- Cohorte

export type CohorteSemana = {
  organizacion_id: string | null; semana: string
  inscritos: number; activos: number; detectados: number; retirados: number; finalizados: number; respondieron_viernes: number
  olbi_agotamiento_media: number | null; olbi_desvinculacion_media: number | null; pct_alto: number | null
  horas_dia_media: number | null; sueno_media: number | null; fin_de_semana_media: number | null
  sobretiempo_media: number | null; guardia_pct: number | null; apoyo_lider_media: number | null
}
export async function cohorte(filtro?: FiltroGlobal): Promise<CohorteSemana[]> {
  let q = supabase.from('cohorte_semanal').select('*').order('semana')
  q = filtro?.organizacion_id ? q.eq('organizacion_id', filtro.organizacion_id) : q.is('organizacion_id', null)
  const { data } = await q
  return (data ?? []) as CohorteSemana[]
}

export type CircuitoApoyo = {
  derivacion_id: string; trabajador_id: string; codigo_anonimo: string; organizacion_id: string
  psicologo_id: string | null; psicologo: string | null; origen: string
  detectado_en: string | null; derivado_en: string; primera_sesion_en: string | null; informe_aprobado_en: string | null; cerrada_en: string | null
  sesiones: number; informes_pendientes: number
  dias_a_derivacion: number | null; dias_a_sesion: number | null; dias_a_informe: number | null; estado: string
  cita_confirmada_en: string | null; dias_a_cita: number | null; dias_cita_a_sesion: number | null
}
export async function circuito(filtro?: FiltroGlobal): Promise<CircuitoApoyo[]> {
  let q = supabase.from('circuito_apoyo').select('*').order('derivado_en', { ascending: false })
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { data } = await q
  return (data ?? []) as CircuitoApoyo[]
}

// ------------------------------------------------------------- Exportación

export type ExportacionRegistrada = {
  id: number; ocurrido_en: string; filtros: Record<string, any>; conteos: Record<string, number>; hash: string; formato: string | null; por: string | null
}
export async function exportaciones(): Promise<ExportacionRegistrada[]> {
  const { data } = await supabase.from('exportaciones_registradas').select('*').order('ocurrido_en', { ascending: false })
  return (data ?? []) as ExportacionRegistrada[]
}

// ------------------------------------------------------------ Citas del estudio

export type CitaEstudio = {
  id: string; trabajador_id: string; codigo_anonimo: string; organizacion_id: string; derivacion_id: string; psicologo_id: string
  propuesta_para: string
  /** El enum de la base es `atendida`, no `realizada`. El tipo decía la
   *  segunda y el `as CitaEstudio[]` lo tapaba: el desglose de Derivaciones
   *  contaba cero sesiones hechas habiendo dos, y los porcentajes no sumaban
   *  100 porque un estado entero quedaba fuera del reparto. */
  estado: 'solicitada' | 'confirmada' | 'cancelada' | 'atendida'
  cancelada_por: string | null; creada_en: string; actualizada_en: string
}
/** Citas sin el motivo escrito (§9.4): el hecho y su estado. */
export async function citasEstudio(filtro?: FiltroGlobal): Promise<CitaEstudio[]> {
  let q = supabase.from('citas_estudio').select('*').order('propuesta_para', { ascending: false })
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { data } = await q
  return (data ?? []) as CitaEstudio[]
}

/** Las citas de una persona, para su ficha.
 *
 *  `ficha_trabajador` no las trae: la función no es SECURITY DEFINER y
 *  `citas` no tiene ninguna política de RLS para el investigador —solo el
 *  trabajador y su psicólogo la leen—, así que el campo `cita` de la ficha
 *  llegaba siempre en nulo y la pantalla decía «sin cita pedida» de alguien
 *  que la tenía confirmada. La vista `citas_estudio` es la puerta que sí le
 *  corresponde (RF-009-10), y es la que se usa aquí. */
export async function citasDelTrabajador(id: string): Promise<CitaEstudio[]> {
  const { data } = await supabase.from('citas_estudio').select('*').eq('trabajador_id', id).order('propuesta_para', { ascending: false })
  return (data ?? []) as CitaEstudio[]
}

// ------------------------------------------------------------------ Maestros

export type UmbralEmpresa = { dimension: 'agotamiento' | 'desvinculacion'; a_vigilar: number; alto: number; fuente: string; actualizado_en: string }
export async function umbralesEmpresa(): Promise<UmbralEmpresa[]> {
  const { data } = await supabase.from('umbrales_empresa').select('*').order('dimension')
  return (data ?? []) as UmbralEmpresa[]
}
export async function actualizarUmbral(u: { dimension: string; a_vigilar: number; alto: number; fuente: string }) {
  const { error } = await supabase.rpc('actualizar_umbrales_empresa', { p_dimension: u.dimension, p_a_vigilar: u.a_vigilar, p_alto: u.alto, p_fuente: u.fuente })
  if (error) throw error
}

/** Último OLBI medio por empresa (cohorte_semanal, semana más reciente con dato). */
export type PulsoEmpresa = { organizacion_id: string; semana: string; activos: number; agotamiento: number | null; desvinculacion: number | null }
export async function pulsoPorEmpresa(): Promise<PulsoEmpresa[]> {
  const { data } = await supabase.from('cohorte_semanal').select('organizacion_id, semana, activos, olbi_agotamiento_media, olbi_desvinculacion_media')
    .not('organizacion_id', 'is', null).not('olbi_agotamiento_media', 'is', null).order('semana', { ascending: false })
  const out = new Map<string, PulsoEmpresa>()
  for (const r of (data ?? []) as any[]) {
    if (!out.has(r.organizacion_id)) out.set(r.organizacion_id, { organizacion_id: r.organizacion_id, semana: r.semana, activos: r.activos, agotamiento: r.olbi_agotamiento_media == null ? null : Number(r.olbi_agotamiento_media), desvinculacion: r.olbi_desvinculacion_media == null ? null : Number(r.olbi_desvinculacion_media) })
  }
  return [...out.values()]
}

/** Salida ordenada: reasigna sus casos abiertos a `destino` y lo desactiva. Devuelve cuántos reasignó. */
export async function desactivarPsicologo(id: string, destino: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('desactivar_psicologo', { p_psicologo: id, p_destino: destino })
  if (error) throw error
  return Number(data ?? 0)
}
export async function reactivarPsicologo(id: string) {
  const { error } = await supabase.rpc('reactivar_psicologo', { p_psicologo: id })
  if (error) throw error
}

/** Suma de adherencia del estudio: Σ días cumplidos / Σ días esperados. */
export async function adherenciaGlobal(filtro?: FiltroGlobal): Promise<{ cumplidos: number; esperados: number; n: number }> {
  let q = supabase.from('adherencia').select('dias_cumplidos, dias_esperados, organizacion_id')
  if (filtro?.organizacion_id) q = q.eq('organizacion_id', filtro.organizacion_id)
  const { data } = await q
  const filas = (data ?? []) as { dias_cumplidos: number; dias_esperados: number }[]
  return { cumplidos: filas.reduce((s, f) => s + Number(f.dias_cumplidos ?? 0), 0), esperados: filas.reduce((s, f) => s + Number(f.dias_esperados ?? 0), 0), n: filas.length }
}

/** Mediana simple (para tramos del circuito). */
export function mediana(v: (number | null | undefined)[]): number | null {
  const x = v.filter((n): n is number => n != null && !Number.isNaN(Number(n))).map(Number).sort((a, b) => a - b)
  if (!x.length) return null
  const m = Math.floor(x.length / 2)
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2
}

// -------------------------------------------------------------- Utilidades

/** Semana del estudio (1..) de una fecha ISO respecto a la inscripción. */
export function semanaDelEstudio(inscritoEn: string, fechaIso: string): number {
  const d = (new Date(fechaIso).getTime() - new Date(inscritoEn).getTime()) / 86_400_000
  return Math.max(1, Math.floor(d / 7) + 1)
}

export function lunesDe(fechaIso: string): Date {
  const d = new Date(`${fechaIso.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ETIQUETA_ESTADO: Record<FilaTrabajadorV2['estado'], string> = {
  activo: 'Activo', detectado: 'Detectado', retirado: 'Retirado', finalizado: 'Finalizado',
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '')
}
export function fechaHoraPET(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '')} · ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })} PET`
}

// --------------------------------------------------- Adherencia por empresa

export type AdherenciaEmpresa = {
  organizacion_id: string
  nombre: string
  trabajadores_activos: number
  al_dia: number
  en_riesgo: number
  inactivos: number
  nunca_iniciaron: number
  tasa_promedio: number | null
}

/** Adherencia agregada por empresa (ESP-007). Se ordena por nombre, nunca por
 *  tasa de burnout: un panel que ordena empresas por burnout es un ranking de
 *  empleadores, y en cuanto una lo ve, la siguiente se lo piensa antes de
 *  entrar al estudio. */
export async function adherenciaPorEmpresa(): Promise<AdherenciaEmpresa[]> {
  const { data, error } = await supabase
    .from('adherencia_por_organizacion')
    .select('*')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as AdherenciaEmpresa[]
}

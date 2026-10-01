/** Panel del empresario — datos. Implementa ESP-008 rev. 2 (RF-008-13 … 23).
 *
 *  Todo viene de vistas SECURITY DEFINER que ya aplican el mínimo de reporte:
 *  aquí no se filtra nada por tamaño, y si una semana no llega, simplemente
 *  no está (RN-008-11). Lo único que se calcula en el cliente es lo que
 *  necesita varias semanas juntas: la correlación entre factores y
 *  agotamiento (RF-008-16) y las recomendaciones (RF-008-18). */

import { supabase } from '../nucleo/supabase'

export type Nivel = 'bajo' | 'a_vigilar' | 'alto'

export type PulsoSemana = {
  semana: string
  respondientes: number
  agotamiento_media: number
  desvinculacion_media: number
  nivel_agotamiento: Nivel
  nivel_desvinculacion: Nivel
}

export type PulsoEstudio = {
  semana: string
  empresas: number
  respondientes: number
  agotamiento_media: number
  desvinculacion_media: number
}

export type FactoresSemana = {
  semana: string
  respondientes: number
  horas_dia_media: number | null
  sueno_media: number | null
  fin_de_semana_media: number | null
  sobretiempo_media: number | null
  guardia_pct: number | null
  apoyo_lider_media: number | null
}

export type Segmento = { tipo_segmento: 'modalidad' | 'rol'; segmento: string }

export type ParticipacionSemana = {
  semana: string
  /** Cuánta gente llevaba inscrita la empresa esa semana: es el denominador
   *  de la tasa. `en_seguimiento` cuenta solo a quien sigue activo hoy, y
   *  dividiendo por él salían semanas al 110 %. */
  inscritos: number
  en_seguimiento: number
  respondieron_viernes: number
  tasa_respuesta_pct: number | null
}

export type Umbral = { dimension: 'agotamiento' | 'desvinculacion'; a_vigilar: number; alto: number }

export async function pulsoEmpresa(orgId: string, segmento?: Segmento): Promise<PulsoSemana[]> {
  const base = segmento
    ? supabase.from('pulso_empresa_segmento').select('*').eq('tipo_segmento', segmento.tipo_segmento).eq('segmento', segmento.segmento)
    : supabase.from('pulso_empresa').select('*')
  const { data } = await base.eq('organizacion_id', orgId).order('semana')
  return (data ?? []) as PulsoSemana[]
}

export async function pulsoEstudio(): Promise<PulsoEstudio[]> {
  const { data } = await supabase.from('pulso_estudio').select('*').order('semana')
  return (data ?? []) as PulsoEstudio[]
}

/** Los factores por semana, solo de las semanas ya cerradas.
 *
 *  La vista incluye la semana en curso en cuanto hay un check-in del lunes,
 *  pero el sobretiempo, las guardias y el apoyo del jefe salen del
 *  formulario del viernes: hasta que llega, esas tres columnas son nulas.
 *  Dejarla pasar hacía que las pantallas que miran «la última semana»
 *  hablaran de uno a medio llenar —en Factores de Trabajo, tres de las seis
 *  tarjetas salían con un guion— y, en el Inicio, de una semana distinta a
 *  la de las cifras de arriba.
 *
 *  El corte es la fecha, no los nulos: una semana está cerrada cuando su
 *  viernes ya pasó. Así no se descarta una semana real en la que, por lo
 *  que sea, nadie contestó el formulario semanal. */
export async function factoresEmpresa(orgId: string, segmento?: Segmento): Promise<FactoresSemana[]> {
  const base = segmento
    ? supabase.from('factores_empresa_segmento').select('*').eq('tipo_segmento', segmento.tipo_segmento).eq('segmento', segmento.segmento)
    : supabase.from('factores_empresa').select('*')
  const { data } = await base.eq('organizacion_id', orgId).order('semana')
  const hoy = new Date(); hoy.setHours(23, 59, 59, 0)
  return ((data ?? []) as FactoresSemana[]).filter((f) => viernesDe(f.semana) <= hoy)
}

/** El viernes de la semana cuyo lunes llega como «2026-09-21». Se lee a
 *  mediodía: `new Date('2026-09-21')` es medianoche UTC y en Perú cae el 20. */
function viernesDe(lunesIso: string): Date {
  const d = new Date(`${lunesIso.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + 4)
  return d
}

/** Segmentos que alcanzan el mínimo en la última semana reportable (RF-008-17).
 *  Los que no llegan no se devuelven: no aparecen en el selector. */
export async function segmentosDisponibles(orgId: string): Promise<(Segmento & { respondientes: number })[]> {
  const { data } = await supabase
    .from('pulso_empresa_segmento')
    .select('tipo_segmento, segmento, respondientes, semana')
    .eq('organizacion_id', orgId)
    .order('semana', { ascending: false })
  const vistos = new Map<string, Segmento & { respondientes: number }>()
  let ultima: string | null = null
  for (const f of (data ?? []) as (Segmento & { respondientes: number; semana: string })[]) {
    ultima ??= f.semana
    if (f.semana !== ultima) break
    vistos.set(`${f.tipo_segmento}:${f.segmento}`, f)
  }
  return [...vistos.values()]
}

export async function participacionSemanal(orgId: string): Promise<ParticipacionSemana[]> {
  const { data } = await supabase.from('participacion_empresa_semanal').select('*').eq('organizacion_id', orgId).order('semana')
  return (data ?? []) as ParticipacionSemana[]
}

export async function apoyoMensual(orgId: string): Promise<{ mes: string; sesiones_aprox: number }[]> {
  const { data } = await supabase.from('apoyo_empresa_mensual').select('mes, sesiones_aprox').eq('organizacion_id', orgId).order('mes', { ascending: false })
  return (data ?? []) as { mes: string; sesiones_aprox: number }[]
}

export async function umbrales(): Promise<Umbral[]> {
  const { data } = await supabase.from('umbrales_empresa').select('dimension, a_vigilar, alto')
  return (data ?? []) as Umbral[]
}

export async function darDeBaja(participanteId: string) {
  const { error } = await supabase.rpc('dar_de_baja_participante', { p_participante: participanteId, p_motivo: 'salida_empresa' })
  if (error) throw error
}

// ----------------------------------------------------------- Referencias

/** Valor de referencia de cada factor y sentido en que «fuera» es peor. */
export const FACTORES = [
  { clave: 'horas_dia_media', nombre: 'Jornada media', unidad: 'h / día', grupo: 'Carga diaria', ref: 8.5, peorSi: 'mayor' },
  { clave: 'sueno_media', nombre: 'Sueño medio', unidad: 'h / noche', grupo: 'Recuperación', ref: 7.0, peorSi: 'menor' },
  { clave: 'fin_de_semana_media', nombre: 'Horas fin de semana', unidad: 'h / sem', grupo: 'Desconexión', ref: 2.0, peorSi: 'mayor' },
  { clave: 'sobretiempo_media', nombre: 'Sobretiempo semanal', unidad: 'h / sem', grupo: 'Intensidad', ref: 4.0, peorSi: 'mayor' },
  { clave: 'guardia_pct', nombre: 'Personas en guardia', unidad: '% del equipo', grupo: 'Disponibilidad', ref: 20, peorSi: 'mayor' },
  { clave: 'apoyo_lider_media', nombre: 'Apoyo percibido del líder', unidad: 'de 5 pts', grupo: 'Liderazgo y clima', ref: 3.5, peorSi: 'menor' },
] as const

export type ClaveFactor = (typeof FACTORES)[number]['clave']

export function fueraDeReferencia(clave: ClaveFactor, valor: number | null): boolean {
  if (valor === null) return false
  const f = FACTORES.find((x) => x.clave === clave)!
  return f.peorSi === 'mayor' ? valor > f.ref : valor < f.ref
}

// --------------------------------------------------------- Correlaciones

/** Pearson entre un factor y el agotamiento a lo largo de las semanas
 *  reportables (RF-008-16). Solo se informa con ≥ 6 semanas y |r| ≥ 0.4. */
export type Relacion = { clave: ClaveFactor; r: number; fuerza: 'fuerte' | 'moderada'; protector: boolean }

export function relaciones(pulso: PulsoSemana[], factores: FactoresSemana[]): { listas: Relacion[]; semanas: number } {
  const porSemana = new Map(factores.map((f) => [f.semana, f]))
  const pares = pulso.filter((p) => porSemana.has(p.semana))
  const n = pares.length
  if (n < 6) return { listas: [], semanas: n }

  const listas: Relacion[] = []
  for (const f of FACTORES) {
    const xs: number[] = [], ys: number[] = []
    for (const p of pares) {
      const v = porSemana.get(p.semana)![f.clave]
      if (v === null || v === undefined) continue
      xs.push(Number(v)); ys.push(Number(p.agotamiento_media))
    }
    if (xs.length < 6) continue
    const r = pearson(xs, ys)
    if (Math.abs(r) < 0.4) continue
    // «Protector»: el factor va en sentido contrario al agotamiento y eso
    // es lo esperado (más apoyo, más sueño → menos agotamiento).
    const esperadoNegativo = f.peorSi === 'menor'
    listas.push({ clave: f.clave, r, fuerza: Math.abs(r) >= 0.7 ? 'fuerte' : 'moderada', protector: esperadoNegativo && r < 0 })
  }
  listas.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
  return { listas, semanas: n }
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
}

export function fraseRelacion(rel: Relacion): string {
  const F: Record<ClaveFactor, [string, string]> = {
    horas_dia_media: ['Las semanas con jornadas más largas son las de mayor agotamiento', 'Las semanas con jornadas más largas muestran menor agotamiento'],
    sueno_media: ['Las semanas con menos sueño son las de mayor agotamiento', 'Las semanas con más sueño muestran mayor agotamiento'],
    fin_de_semana_media: ['Las semanas con más trabajo de fin de semana son las de mayor agotamiento', 'Las semanas con más fin de semana muestran menor agotamiento'],
    sobretiempo_media: ['El sobretiempo se mueve junto con el agotamiento', 'El sobretiempo va en sentido contrario al agotamiento'],
    guardia_pct: ['Las semanas con más gente de guardia son las de mayor agotamiento', 'Las semanas con más guardias muestran menor agotamiento'],
    apoyo_lider_media: ['El apoyo del líder amortigua el agotamiento: a más apoyo, menos desgaste', 'El apoyo del líder sube junto con el agotamiento'],
  }
  const esperado = FACTORES.find((f) => f.clave === rel.clave)!.peorSi === 'mayor' ? rel.r > 0 : rel.r < 0
  return F[rel.clave][esperado ? 0 : 1]
}

// ------------------------------------------------------- Recomendaciones

/** Reglas declaradas (RN-008-15): condición legible, texto y referencia.
 *  Se evalúan sobre la última semana reportable. */
export type Recomendacion = { id: string; titulo: string; texto: string; referencia: string }

export function recomendaciones(
  ultimaSemana: FactoresSemana | undefined,
  pulso: PulsoSemana[],
  participacion: ParticipacionSemana | undefined,
): Recomendacion[] {
  const r: Recomendacion[] = []
  const f = ultimaSemana
  /** Mismo criterio que «lo que más pesa»: si un factor sale de la referencia
   *  del estudio, aquí está qué hacer con él.
   *
   *  Antes cada acción tenía su propio corte, más alto que la referencia
   *  —sobretiempo ≥ 5 h cuando la referencia son 4, guardias ≥ 40 % cuando
   *  son 20—, así que la pantalla marcaba un factor como problema y luego no
   *  ofrecía nada que hacer: en Nexa Software pesaban tres factores y la
   *  sección «qué hacer esta semana» no aparecía. */
  const fuera = (clave: ClaveFactor) => f != null && fueraDeReferencia(clave, f[clave] as number | null)

  if (fuera('horas_dia_media')) r.push({
    id: 'REC-01', titulo: 'Mirar el reparto de la carga',
    texto: `La jornada media va en ${f!.horas_dia_media} h al día, por encima de las 8.5 que toma el estudio como referencia. Vale la pena revisar qué entregas se pueden mover y poner un tope al sobretiempo.`,
    referencia: 'Demerouti et al. (2001), modelo de demandas y recursos',
  })
  if (fuera('sobretiempo_media') || fuera('fin_de_semana_media')) {
    // Solo se nombra lo que de verdad se salió: citar también el factor que
    // está bien hace dudar de si el problema es ese.
    const partes: string[] = []
    if (fuera('sobretiempo_media')) partes.push(`${f!.sobretiempo_media} h de sobretiempo`)
    if (fuera('fin_de_semana_media')) partes.push(`${f!.fin_de_semana_media} h trabajadas en fin de semana`)
    r.push({
      id: 'REC-02', titulo: 'Proteger la desconexión',
      texto: `Esta semana hubo ${partes.join(' y ')}, por encima de lo previsto. Trabajar fuera de hora es lo que más se relaciona con el agotamiento: ayuda acordar que después de las 19:00 no se responde en los canales de trabajo, y dejar claro quién cubre.`,
      referencia: 'Demerouti et al. (2001)',
    })
  }
  if (fuera('guardia_pct')) r.push({
    id: 'REC-03', titulo: 'Repartir las guardias y devolver el descanso',
    texto: `El ${f!.guardia_pct} % del equipo estuvo disponible fuera de horario, cuando la referencia es 20 %. Conviene rotar los turnos y compensar con horas libres a quien estuvo de guardia.`,
    referencia: 'Bakker & Demerouti (2007)',
  })
  if (fuera('sueno_media')) r.push({
    id: 'REC-04', titulo: 'Cuidar el descanso',
    texto: `Se durmió ${f!.sueno_media} h de media, por debajo de las 7 de referencia. Suele arreglarse moviendo las horas de inicio y evitando guardias nocturnas seguidas.`,
    referencia: 'Åkerstedt (2006)',
  })
  if (fuera('apoyo_lider_media')) r.push({
    id: 'REC-05', titulo: 'Acompañar a quienes lideran',
    texto: `El apoyo que la gente siente de su jefe directo está en ${f!.apoyo_lider_media} de 5, bajo la referencia de 3.5. Es lo que más protege del agotamiento: formación para quienes lideran y espacios de uno a uno ayudan más que cualquier otra medida.`,
    referencia: 'Bakker & Demerouti (2007)',
  })

  const ultimas = pulso.slice(-2)
  if (ultimas.length === 2 && ultimas.every((p) => p.nivel_agotamiento === 'alto')) r.push({
    id: 'REC-06', titulo: 'Dos semanas seguidas en alto',
    texto: 'El agotamiento del equipo lleva dos semanas en nivel alto. Conviene hablarlo con el equipo del estudio para ver una intervención más de fondo.',
    referencia: 'Protocolo del estudio',
  })
  if (participacion?.tasa_respuesta_pct != null && participacion.tasa_respuesta_pct < 60) r.push({
    id: 'REC-07', titulo: 'Contesta poca gente',
    texto: `Solo respondió el ${participacion.tasa_respuesta_pct} % esta semana, así que la lectura es poco fiable. Recordar en la reunión de equipo que las respuestas son anónimas suele bastar.`,
    referencia: 'ESP-007, adherencia',
  })
  return r
}

// ------------------------------------------------------------- Utilidades

export const ETIQUETA_NIVEL: Record<Nivel, string> = { bajo: 'Bajo', a_vigilar: 'A vigilar', alto: 'Alto' }

/** «12–16 de setiembre» a partir del lunes ISO. */
export function rangoSemana(lunesIso: string): string {
  const l = new Date(`${lunesIso}T12:00:00`)
  const v = new Date(l); v.setDate(l.getDate() + 4)
  const mes = v.toLocaleDateString('es-PE', { month: 'long' })
  return l.getMonth() === v.getMonth()
    ? `${l.getDate()}–${v.getDate()} de ${mes}`
    : `${l.getDate()} de ${l.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')} – ${v.getDate()} de ${mes}`
}

export function etiquetaSemana(lunesIso: string): string {
  const l = new Date(`${lunesIso}T12:00:00`)
  return l.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace('.', '')
}

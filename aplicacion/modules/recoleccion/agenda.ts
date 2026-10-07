/** Agenda de instrumentos — implementa ESP-002 (RF-002-01, RF-002-08, RF-002-09, RF-002-11).
 *
 *  Decide qué le toca al trabajador hoy. Lógica pura y sin dependencias:
 *  se puede probar sin base de datos ni interfaz.
 *
 *  El calendario viene de la definición de cada formulario (`dias`,
 *  `gracia_dias`, `despues_de`). Un formulario sin `dias` cae en la cadencia
 *  fija de abajo, que es la de la revisión 1 y queda solo como respaldo. */

import type { CalendarioFormulario, ClaveFormulario } from '../nucleo/tipos'
import { ahora } from '../nucleo/reloj'

/** Respaldo para definiciones sin calendario (revisión 1 de ESP-002 §4). */
export const CADENCIA_DIAS: Record<ClaveFormulario, number> = {
  estable: Infinity, // una sola vez, al inscribirse
  diario: 1,
  semanal: 7,
  olbi: 14,
}

/** Respaldo si una definición no trae `duracion`. Lo normal es que la traiga:
 *  anunciar una duración distinta de la real es la primera causa de abandono
 *  (ESP-007), así que el texto vive junto a las preguntas que lo determinan. */
export const DURACION: Record<ClaveFormulario, string> = {
  estable: '2 minutos',
  diario: '35 segundos',
  semanal: '30 segundos',
  olbi: '4 minutos',
}

export type PresentacionFormulario = CalendarioFormulario & {
  titulo: string
  descripcion?: string
  duracion?: string
}

export type Calendarios = Partial<Record<ClaveFormulario, PresentacionFormulario>>

export type ItemAgenda = {
  clave: ClaveFormulario
  titulo: string
  descripcion?: string
  duracion: string
  completado: boolean
}

export function mismoDia(iso: string | undefined, referencia = ahora()): boolean {
  if (!iso) return false
  const fecha = new Date(iso)
  return (
    fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth() &&
    fecha.getDate() === referencia.getDate()
  )
}

/** ¿Se envió dentro de la semana en curso? El OLBI ya no tiene día fijo, así
 *  que «completado» deja de ser «hoy» y pasa a ser «esta semana». */
export function mismoDiaSemana(iso: string | undefined, referencia = ahora()): boolean {
  if (!iso) return false
  const lunes = new Date(referencia)
  lunes.setHours(0, 0, 0, 0)
  lunes.setDate(lunes.getDate() - (diaIso(lunes) - 1))
  return new Date(iso).getTime() >= lunes.getTime()
}

export function diasDesde(iso: string | undefined, referencia = ahora()): number {
  if (!iso) return Infinity
  return (referencia.getTime() - new Date(iso).getTime()) / 86_400_000
}

/** 1 = lunes … 7 = domingo (ISO). `getDay()` empieza en domingo, que aquí no sirve. */
export function diaIso(fecha: Date): number {
  return fecha.getDay() === 0 ? 7 : fecha.getDay()
}

/** El día más reciente (hoy o antes) en que el formulario correspondía, si
 *  todavía está dentro de su gracia. `null` si hoy no toca. */
export function vencimientoVigente(
  calendario: CalendarioFormulario,
  referencia = ahora(),
): Date | null {
  if (!calendario.dias || calendario.dias.length === 0) return null
  const gracia = calendario.gracia_dias ?? 0
  for (let atras = 0; atras <= gracia; atras++) {
    const dia = new Date(referencia)
    dia.setHours(0, 0, 0, 0)
    dia.setDate(dia.getDate() - atras)
    if (calendario.dias.includes(diaIso(dia))) return dia
  }
  return null
}

/** RF-002-01 y RF-002-08 — qué instrumentos corresponden hoy.
 *
 *  `estable` solo aparece si nunca se respondió. Los demás aparecen cuando
 *  su calendario lo dice; los ya enviados en este ciclo se marcan completados
 *  en vez de desaparecer, para que el trabajador vea que cumplió.
 *
 *  RF-002-11 — un formulario con `despues_de` no aparece hasta que el otro
 *  esté completado en el mismo ciclo: el viernes primero el OLBI, luego las
 *  tres preguntas de la semana. */
export function agendaDeHoy(
  ultimosEnvios: Partial<Record<ClaveFormulario, string>>,
  calendarios: Calendarios = {},
  referencia = ahora(),
  /** Si el OLBI corresponde hoy. Lo decide el servidor (`olbi_toca`), no el
   *  calendario: puede tocar porque el modelo avisó, porque salió en el
   *  sorteo semanal o porque lleva un mes sin medirse. Un formulario sin
   *  `dias` y sin esto no aparece nunca. */
  olbiToca = false,
): ItemAgenda[] {
  const claves: ClaveFormulario[] = ['estable', 'diario', 'olbi', 'semanal']
  const completado: Partial<Record<ClaveFormulario, boolean>> = {}

  const items = claves.flatMap((clave) => {
    const ultimo = ultimosEnvios[clave]
    const calendario = calendarios[clave]

    if (clave === 'estable') {
      return ultimo ? [] : [item(clave, false, calendario)]
    }

    // El OLBI y las tres preguntas que lo siguen ya no los dispara el día.
    if ((clave === 'olbi' || clave === 'semanal') && calendario && !calendario.dias) {
      if (!olbiToca) return []
      const hecho = !!ultimo && mismoDiaSemana(ultimo, referencia)
      completado[clave] = hecho
      if (calendario.despues_de && !completado[calendario.despues_de]) return []
      return [item(clave, hecho, calendario)]
    }

    if (calendario?.dias) {
      const vencimiento = vencimientoVigente(calendario, referencia)
      if (!vencimiento) return []
      const hecho = !!ultimo && new Date(ultimo).getTime() >= vencimiento.getTime()
      completado[clave] = hecho
      if (calendario.despues_de && !completado[calendario.despues_de]) return []
      // Hecho en un día anterior de la gracia (el OLBI del viernes, visto el
      // sábado): ya no es de hoy, no se lista.
      if (hecho && !mismoDia(ultimo, referencia)) return []
      return [item(clave, hecho, calendario)]
    }

    // Respaldo: cadencia fija de la revisión 1.
    if (mismoDia(ultimo, referencia)) return [item(clave, true, calendario)]
    if (diasDesde(ultimo, referencia) >= CADENCIA_DIAS[clave]) return [item(clave, false, calendario)]
    return []
  })

  return items
}

const TITULO_RESPALDO: Record<ClaveFormulario, string> = {
  estable: 'Datos iniciales',
  diario: 'Check-in de hoy',
  semanal: 'Sobre tu semana',
  olbi: 'Cuestionario completo',
}

function item(clave: ClaveFormulario, completado: boolean, p?: PresentacionFormulario): ItemAgenda {
  return {
    clave,
    titulo: p?.titulo ?? TITULO_RESPALDO[clave],
    descripcion: p?.descripcion,
    duracion: p?.duracion ?? DURACION[clave],
    completado,
  }
}

/** RF-002-07 — días consecutivos con check-in diario, hasta hoy. */
export function calcularRacha(fechasEnvioDiario: string[], referencia = ahora()): number {
  const dias = new Set(
    fechasEnvioDiario.map((iso) => {
      const f = new Date(iso)
      return `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
    }),
  )

  let racha = 0
  const cursor = new Date(referencia)

  // Si hoy aún no hay check-in, la racha se cuenta desde ayer: la del día en
  // curso no está rota, solo pendiente.
  const clave = (f: Date) => `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
  if (!dias.has(clave(cursor))) cursor.setDate(cursor.getDate() - 1)

  while (dias.has(clave(cursor))) {
    racha += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return racha
}

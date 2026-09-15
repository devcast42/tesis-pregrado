/** Agenda de instrumentos — implementa ESP-002 (RF-002-01, RF-002-08).
 *
 *  Decide qué le toca al participante hoy. Lógica pura y sin dependencias:
 *  se puede probar sin base de datos ni interfaz. */

import type { ClaveFormulario } from '../nucleo/tipos'

/** Cadencia de ESP-002 §4. Cambiarla aquí la cambia en toda la app. */
export const CADENCIA_DIAS: Record<ClaveFormulario, number> = {
  estable: Infinity, // una sola vez, al inscribirse
  diario: 1,
  semanal: 7,
  olbi: 14,
}

export const ETIQUETAS: Record<ClaveFormulario, { titulo: string; duracion: string }> = {
  estable: { titulo: 'Datos iniciales', duracion: '2 min' },
  diario: { titulo: 'Check-in de hoy', duracion: '30 s' },
  semanal: { titulo: 'Resumen semanal', duracion: '1 min' },
  olbi: { titulo: 'Cuestionario quincenal', duracion: '4 min' },
}

export type ItemAgenda = {
  clave: ClaveFormulario
  titulo: string
  duracion: string
  completado: boolean
}

export function mismoDia(iso: string | undefined, referencia = new Date()): boolean {
  if (!iso) return false
  const fecha = new Date(iso)
  return (
    fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth() &&
    fecha.getDate() === referencia.getDate()
  )
}

export function diasDesde(iso: string | undefined, referencia = new Date()): number {
  if (!iso) return Infinity
  return (referencia.getTime() - new Date(iso).getTime()) / 86_400_000
}

/** RF-002-01 y RF-002-08 — qué instrumentos corresponden hoy.
 *
 *  `estable` solo aparece si nunca se respondió. El resto aparece cuando ha
 *  pasado su cadencia; los ya enviados hoy se marcan completados en vez de
 *  desaparecer, para que el participante vea que cumplió. */
export function agendaDeHoy(
  ultimosEnvios: Partial<Record<ClaveFormulario, string>>,
  referencia = new Date(),
): ItemAgenda[] {
  const claves: ClaveFormulario[] = ['estable', 'diario', 'semanal', 'olbi']

  return claves.flatMap((clave) => {
    const ultimo = ultimosEnvios[clave]

    if (clave === 'estable') {
      return ultimo ? [] : [item(clave, false)]
    }

    if (mismoDia(ultimo, referencia)) return [item(clave, true)]
    if (diasDesde(ultimo, referencia) >= CADENCIA_DIAS[clave]) return [item(clave, false)]
    return []
  })
}

function item(clave: ClaveFormulario, completado: boolean): ItemAgenda {
  return { clave, ...ETIQUETAS[clave], completado }
}

/** RF-002-07 — días consecutivos con check-in diario, hasta hoy. */
export function calcularRacha(fechasEnvioDiario: string[], referencia = new Date()): number {
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

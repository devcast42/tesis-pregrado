/** Recordatorios locales — implementa ESP-002 (RF-002-06).
 *
 *  La adherencia es el mayor riesgo de campo del estudio: sin recordatorio,
 *  la serie temporal de cada participante se llena de huecos y el modelo de
 *  trayectoria pierde su insumo.
 *
 *  ⚠️ EL MÓDULO SE CARGA PEREZOSAMENTE, Y ESO NO ES UN DETALLE.
 *
 *  `expo-notifications` no existe en todas partes: Expo Go dejó de traer las
 *  notificaciones push de Android en el SDK 53, y en web nunca las tuvo.
 *  Importarlo arriba hacía que el módulo lanzara al cargarse, y como
 *  `consentimiento.tsx` lo importa, la pantalla del consentimiento se caía
 *  entera.
 *
 *  Eso es peor de lo que parece: el consentimiento es la puerta al estudio.
 *  Que un recordatorio no se pueda programar no puede impedir que alguien
 *  acepte participar. Aquí se degrada —se avisa y se sigue— en lugar de
 *  romperse. */

const ID_DIARIO = 'checkin-diario'

export const HORA_POR_DEFECTO = 19
export const MINUTO_POR_DEFECTO = 0

type ModuloNotificaciones = typeof import('expo-notifications')

let modulo: ModuloNotificaciones | null | undefined
let handlerPuesto = false

/** Devuelve el módulo, o null si esta plataforma no puede con él. */
function notificaciones(): ModuloNotificaciones | null {
  if (modulo !== undefined) return modulo

  try {
    // require y no import: un import estático se evalúa al cargar el archivo,
    // que es exactamente lo que hay que evitar.
    modulo = require('expo-notifications') as ModuloNotificaciones
  } catch {
    modulo = null
    return null
  }

  if (!handlerPuesto) {
    try {
      modulo.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      })
      handlerPuesto = true
    } catch {
      // El módulo existe pero no está operativo. Se sigue sin handler.
    }
  }

  return modulo
}

/** ¿Se pueden programar recordatorios en este dispositivo?
 *
 *  Falso en Expo Go (Android) y en navegador. Para probarlos de verdad hace
 *  falta un development build: `npx expo run:android`. */
export function recordatoriosDisponibles(): boolean {
  return notificaciones() !== null
}

export async function pedirPermiso(): Promise<boolean> {
  const n = notificaciones()
  if (!n) return false

  try {
    const actual = await n.getPermissionsAsync()
    if (actual.granted) return true

    const solicitado = await n.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    })
    return solicitado.granted
  } catch {
    return false
  }
}

/** Programa el recordatorio diario. Idempotente: reemplaza el anterior,
 *  así llamarlo en cada arranque no acumula notificaciones duplicadas.
 *
 *  Devuelve false si no se pudo —sin permiso, o sin módulo— y nunca lanza:
 *  quien lo llama está a mitad de un flujo que no debe interrumpirse. */
export async function programarDiario(
  hora = HORA_POR_DEFECTO,
  minuto = MINUTO_POR_DEFECTO,
): Promise<boolean> {
  const n = notificaciones()
  if (!n) return false
  if (!(await pedirPermiso())) return false

  try {
    await n.cancelScheduledNotificationAsync(ID_DIARIO).catch(() => {})

    await n.scheduleNotificationAsync({
      identifier: ID_DIARIO,
      content: {
        title: 'Check-in de hoy',
        body: 'Son 30 segundos. Gracias por participar en el estudio.',
      },
      trigger: {
        type: n.SchedulableTriggerInputTypes.DAILY,
        hour: hora,
        minute: minuto,
      },
    })

    return true
  } catch {
    return false
  }
}

/** Al retirar el consentimiento o finalizar el seguimiento, deja de molestar. */
export async function cancelarTodos(): Promise<void> {
  const n = notificaciones()
  if (!n) return

  try {
    await n.cancelAllScheduledNotificationsAsync()
  } catch {
    // Nada que cancelar, o plataforma sin soporte.
  }
}

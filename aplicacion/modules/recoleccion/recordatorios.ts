/** Recordatorios locales — implementa ESP-002 (RF-002-06).
 *
 *  La adherencia es el mayor riesgo del producto: sin recordatorio,
 *  la serie temporal de cada trabajador se llena de huecos y el modelo de
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
 *  Eso es peor de lo que parece: el consentimiento es la puerta de entrada.
 *  Que un recordatorio no se pueda programar no puede impedir que alguien
 *  acepte participar. Aquí se degrada —se avisa y se sigue— en lugar de
 *  romperse. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const ID_DIARIO = 'checkin-diario'
const ID_PRUEBA = 'checkin-prueba'
const CANAL = 'recordatorios'
const CLAVE_HORA = 'recordatorio.hora'
const CLAVE_MINUTO = 'recordatorio.minuto'

/** Duraciones de respaldo si no se pudo leer la definición (sin red, por
 *  ejemplo). Lo normal es que `sincronizarRecordatorios` las reciba de la
 *  base: prometer un tiempo distinto del real es la primera causa de que
 *  alguien deje de responder. */
const DURACION_RESPALDO: Record<'diario' | 'olbi', string> = {
  diario: '15 segundos',
  olbi: '4 minutos',
}

function recordatorios(duraciones: Partial<Record<'diario' | 'olbi', string>> = {}) {
  const diario = duraciones.diario ?? DURACION_RESPALDO.diario
  const olbi = duraciones.olbi ?? DURACION_RESPALDO.olbi
  void olbi
  // Solo de lunes a jueves. El aviso del viernes («Cuestionario del
  // viernes») llegaba a todos, y el cuestionario ya no es para todos ni cae
  // en viernes: se ofrece tras el check-in el día que toca.
  return [2, 3, 4, 5].map((weekday) => ({
    id: `checkin-${weekday}`,
    weekday,
    titulo: 'Check-in de hoy',
    cuerpo: `Son ${diario}.`,
  }))
}

/** Solo para cancelar: los identificadores no dependen de la duración.
 *  `checkin-6` era el aviso del viernes; se sigue cancelando para que
 *  desaparezca de los teléfonos que ya lo tenían programado. */
const RECORDATORIOS = [...recordatorios(), { id: 'checkin-6' }]

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

// ----------------------------------------------------------- Preferencia

export type HoraRecordatorio = { hora: number; minuto: number }

/** Hora elegida por el trabajador (por defecto 19:00). Vive en el
 *  dispositivo: el servidor no necesita saber a qué hora suena el teléfono. */
export async function horaRecordatorio(): Promise<HoraRecordatorio> {
  try {
    const [h, m] = await Promise.all([AsyncStorage.getItem(CLAVE_HORA), AsyncStorage.getItem(CLAVE_MINUTO)])
    return {
      hora: h !== null && Number.isFinite(Number(h)) ? Number(h) : HORA_POR_DEFECTO,
      minuto: m !== null && Number.isFinite(Number(m)) ? Number(m) : MINUTO_POR_DEFECTO,
    }
  } catch {
    return { hora: HORA_POR_DEFECTO, minuto: MINUTO_POR_DEFECTO }
  }
}

export async function guardarHoraRecordatorio(hora: number, minuto: number): Promise<boolean> {
  await AsyncStorage.multiSet([[CLAVE_HORA, String(hora)], [CLAVE_MINUTO, String(minuto)]]).catch(() => {})
  return programarDiario(hora, minuto)
}

/** Reprograma con la hora guardada. Se llama al abrir la pantalla principal:
 *  los recordatorios viven en el sistema operativo y se pierden al
 *  reinstalar la app o borrar sus datos; así se recuperan solos. */
export async function sincronizarRecordatorios(
  duraciones: Partial<Record<'diario' | 'olbi', string>> = {},
): Promise<boolean> {
  const { hora, minuto } = await horaRecordatorio()
  return programarDiario(hora, minuto, duraciones)
}

/** Manda una notificación de prueba en `segundos`, para comprobar que el
 *  teléfono las deja pasar (permiso, canal, ahorro de batería). */
export async function probarRecordatorio(segundos = 10): Promise<boolean> {
  const n = notificaciones()
  if (!n) return false
  if (!(await pedirPermiso())) return false
  try {
    await asegurarCanal(n)
    await n.cancelScheduledNotificationAsync(ID_PRUEBA).catch(() => {})
    await n.scheduleNotificationAsync({
      identifier: ID_PRUEBA,
      content: { title: 'Prueba de recordatorio', body: 'Así se verá tu aviso diario. Todo funciona.', ...(Platform.OS === 'android' ? { channelId: CANAL } : {}) },
      trigger: { type: n.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: segundos, channelId: CANAL },
    })
    return true
  } catch {
    return false
  }
}

/** Android 8+ exige un canal; sin él la notificación se descarta en
 *  silencio. Importancia alta para que aparezca como aviso y no solo en la
 *  bandeja. Idempotente. */
async function asegurarCanal(n: ModuloNotificaciones) {
  if (Platform.OS !== 'android') return
  await n.setNotificationChannelAsync(CANAL, {
    name: 'Recordatorio diario',
    importance: n.AndroidImportance.HIGH,
    // Sin `sound`: el canal usa el tono por defecto del sistema. Pasar
    // 'default' hace que expo busque un archivo con ese nombre y avise.
    vibrationPattern: [0, 200],
  }).catch(() => {})
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
  duraciones: Partial<Record<'diario' | 'olbi', string>> = {},
): Promise<boolean> {
  const n = notificaciones()
  if (!n) return false
  if (!(await pedirPermiso())) return false

  try {
    await asegurarCanal(n)
    // Un recordatorio semanal por día de check-in, de lunes a jueves. De
    // viernes a domingo no hay nada que responder, y avisar sin motivo es la
    // forma más rápida de que silencien la app. `weekday` de
    // expo-notifications: 1 = domingo … 7 = sábado.
    await Promise.all(
      RECORDATORIOS.map((r) => n.cancelScheduledNotificationAsync(r.id).catch(() => {})),
    )
    await n.cancelScheduledNotificationAsync(ID_DIARIO).catch(() => {}) // versión anterior

    for (const r of recordatorios(duraciones)) {
      await n.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.titulo, body: r.cuerpo },
        trigger: {
          type: n.SchedulableTriggerInputTypes.WEEKLY,
          weekday: r.weekday,
          hour: hora,
          minute: minuto,
          channelId: CANAL,
        },
      })
    }

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

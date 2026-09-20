/** Bloqueo con huella — implementa ESP-001 RF-001-08.
 *
 *  No es autenticación: la sesión de Supabase ya está guardada en el
 *  dispositivo y sigue siendo la misma. La huella (o rostro, o PIN del
 *  teléfono) solo decide si esa sesión guardada se puede *usar* ahora. Por
 *  eso nunca toca la red y por eso, si el teléfono no tiene biometría
 *  configurada, simplemente no se pide: el dato que protege es el que ya
 *  está en el aparato, y sin biometría no hay con qué protegerlo mejor.
 *
 *  Cuándo se pide: al abrir la app en frío y al volver del segundo plano
 *  después de `SEGUNDO_PLANO_MAXIMO`. Un check-in de un minuto no debería
 *  pedir la huella dos veces. */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Autenticacion from 'expo-local-authentication'

const CLAVE_ACTIVO = 'bloqueo.huella'
/** Minutos en segundo plano tras los que se vuelve a pedir la huella. */
export const SEGUNDO_PLANO_MAXIMO = 5 * 60 * 1000

let desbloqueadoEn: number | null = null
let alFondoEn: number | null = null

/** Hay sensor y hay una huella/rostro/PIN registrados. En web no existe. */
export async function disponible(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    return (await Autenticacion.hasHardwareAsync()) && (await Autenticacion.isEnrolledAsync())
  } catch {
    return false
  }
}

/** Preferencia del usuario. Activada por defecto: proteger es lo esperado. */
export async function activo(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE_ACTIVO)) !== 'no'
  } catch {
    return true
  }
}

export async function fijarActivo(valor: boolean) {
  await AsyncStorage.setItem(CLAVE_ACTIVO, valor ? 'si' : 'no').catch(() => {})
}

/** ¿Hay que pedir la huella antes de mostrar nada? */
export async function necesitaDesbloqueo(): Promise<boolean> {
  if (desbloqueadoEn !== null) return false
  return (await activo()) && (await disponible())
}

/** Pide la huella al sistema. `true` si la persona se identificó. */
export async function verificar(): Promise<boolean> {
  try {
    const r = await Autenticacion.authenticateAsync({
      promptMessage: 'Confirma que eres tú',
      cancelLabel: 'Cancelar',
      // Si la huella falla varias veces, el sistema ofrece el PIN del
      // teléfono: es el mismo nivel de protección que el dispositivo.
      disableDeviceFallback: false,
    })
    if (r.success) marcarDesbloqueo()
    return r.success
  } catch {
    return false
  }
}

export function marcarDesbloqueo() {
  desbloqueadoEn = Date.now()
}

/** Al cerrar sesión: la próxima persona que entre con contraseña empieza limpia. */
export function olvidarDesbloqueo() {
  desbloqueadoEn = null
}

export function registrarSegundoPlano() {
  alFondoEn = Date.now()
}

/** Al volver del segundo plano: ¿estuvo fuera tanto como para volver a pedir? */
export function volvioTrasMucho(): boolean {
  if (alFondoEn === null) return false
  const fuera = Date.now() - alFondoEn
  alFondoEn = null
  if (fuera > SEGUNDO_PLANO_MAXIMO) {
    desbloqueadoEn = null
    return true
  }
  return false
}

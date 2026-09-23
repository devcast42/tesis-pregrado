/** Reloj de la app — con desfase simulado SOLO en desarrollo.
 *
 *  Toda la lógica de calendario (agenda, ítems por día, ritmo semanal)
 *  pregunta la hora aquí y no a `new Date()` directamente. En desarrollo se
 *  puede sumar o restar días desde Ajustes para probar un lunes en viernes.
 *  En una compilación de producción `__DEV__` es false y `ahora()` es
 *  exactamente `new Date()`: no existe forma de activar el desfase.
 *
 *  Límite que hay que tener presente: la base de datos usa su propio
 *  `now()` (predicción, adherencia, retrospectiva). El desfase mueve solo
 *  la app. Para mover los datos, `supabase/avanzar_dia.sql`. */

import AsyncStorage from '@react-native-async-storage/async-storage'

const CLAVE = 'dev.desfase_dias'
let desfaseDias = 0

export function ahora(): Date {
  const d = new Date()
  if (__DEV__ && desfaseDias !== 0) d.setDate(d.getDate() + desfaseDias)
  return d
}

export function desfaseActual(): number {
  return __DEV__ ? desfaseDias : 0
}

export async function cargarDesfase(): Promise<number> {
  if (!__DEV__) return 0
  try {
    const v = await AsyncStorage.getItem(CLAVE)
    desfaseDias = v ? Number(v) || 0 : 0
  } catch {
    desfaseDias = 0
  }
  return desfaseDias
}

export async function fijarDesfase(dias: number): Promise<void> {
  if (!__DEV__) return
  desfaseDias = dias
  await AsyncStorage.setItem(CLAVE, String(dias)).catch(() => {})
}

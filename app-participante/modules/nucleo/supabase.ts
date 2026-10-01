/** Cliente Supabase compartido. Único punto de acceso a la base de datos. */

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env',
  )
}

/** Cuántas consultas pueden estar en vuelo a la vez.
 *
 *  Las vistas del panel del investigador cuestan segundos cada una, y el rol
 *  `authenticated` tiene `statement_timeout` de 8 s. Una pantalla que lanza
 *  seis a la vez con `Promise.all` no las acelera: se reparten el mismo
 *  servidor, cada una tarda el triple y alguna se pasa del límite. Lo que
 *  llega entonces es un 500 con el código 57014, y la pantalla se queda
 *  cargando para siempre.
 *
 *  Con tres en vuelo el total tarda lo mismo —el trabajo es el que es— pero
 *  ninguna se acerca al límite. No es un ajuste fino: es la diferencia entre
 *  que la pantalla cargue o no cargue. */
const EN_VUELO_MAX = 3

const cola: (() => void)[] = []
let enVuelo = 0

function turno(): Promise<void> {
  if (enVuelo < EN_VUELO_MAX) { enVuelo++; return Promise.resolve() }
  return new Promise((seguir) => cola.push(() => { enVuelo++; seguir() }))
}

function liberar() {
  enVuelo--
  cola.shift()?.()
}

/** `fetch` con la cola puesta. Solo afecta a las peticiones de Supabase. */
const fetchEnCola: typeof fetch = async (entrada, opciones) => {
  await turno()
  try {
    return await fetch(entrada, opciones)
  } finally {
    liberar()
  }
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchEnCola },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

/** Id del usuario autenticado, o null si no hay sesión.
 *
 *  ⚠️ Úsalo siempre que una consulta deba devolver "lo mío". RLS acota lo que
 *  cada rol PUEDE ver, no lo que una consulta concreta DEBE devolver: el
 *  investigador ve todas las filas de usuarios_rol y de participantes por
 *  diseño, así que un select sin filtro le devuelve la fila de otra persona. */
export async function idUsuario(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

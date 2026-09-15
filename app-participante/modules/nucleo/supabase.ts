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

export const supabase = createClient(url, anonKey, {
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

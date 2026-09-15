/** Creación de cuentas — lógica común a los tres tipos de usuario.
 *
 *  Siempre es la misma secuencia: crear la cuenta, asignar el rol, crear la
 *  ficha. Si falla a mitad hay que deshacer la cuenta, o quedan usuarios
 *  huérfanos que después nadie sabe de dónde salieron. */

import { servicio } from './supabase.ts'

/** Tres palabras cortas y un número: fácil de dictar por teléfono sin errores,
 *  difícil de adivinar. Se muestra UNA vez a quien la crea; Supabase solo
 *  guarda su hash. */
export function generarContrasena(): string {
  const palabras = [
    'ancla', 'brisa', 'cedro', 'duna', 'faro', 'grano', 'hilo', 'islote',
    'lirio', 'monte', 'nube', 'ola', 'pino', 'rama', 'sauce', 'trigo',
  ]
  const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
  const elegidas = Array.from({ length: 3 }, () => palabras[azar(palabras.length)])
  return `${elegidas.join('-')}-${100 + azar(900)}`
}

export type CuentaCreada = { id: string; contrasena: string }

/** Crea la cuenta ya confirmada. No manda ningún correo: la contraseña se
 *  entrega por el mismo canal donde ocurre el consentimiento informado. */
export async function crearCuenta(
  db: ReturnType<typeof servicio>,
  correo: string,
): Promise<CuentaCreada> {
  const contrasena = generarContrasena()
  const { data, error } = await db.auth.admin.createUser({
    email: correo.trim().toLowerCase(),
    password: contrasena,
    email_confirm: true,
  })

  if (error || !data?.user) {
    throw new Error(error?.message ?? 'no se pudo crear la cuenta')
  }

  return { id: data.user.id, contrasena }
}

export async function deshacerCuenta(db: ReturnType<typeof servicio>, id: string) {
  await db.auth.admin.deleteUser(id).catch(() => {})
}

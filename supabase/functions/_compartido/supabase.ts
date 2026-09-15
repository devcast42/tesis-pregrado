/** Cliente con service_role para las Edge Functions.
 *
 *  Este cliente ignora RLS por diseño: las funciones hacen cosas que ningún
 *  rol puede hacer desde el cliente (registrar detecciones, abrir
 *  derivaciones, escribir informes). Por eso cada función verifica por su
 *  cuenta quién la está llamando antes de actuar. */

import { createClient } from 'jsr:@supabase/supabase-js@2'

export function servicio() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/** Cliente que actúa como el usuario que llamó, para verificar identidad. */
export function comoUsuario(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
}

/** Rol de quien llama, resuelto contra la base con su propio JWT.
 *
 *  ⚠️ El filtro por auth_user_id NO es redundante con RLS. El investigador
 *  tiene permiso de lectura sobre toda `usuarios_rol`, así que un
 *  `select('rol').maybeSingle()` sin filtro le devuelve varias filas, falla, y
 *  la función acaba negándole el acceso a la única persona que sí lo tiene.
 *  Toda comprobación de rol pasa por aquí para no repetir ese error. */
export async function rolDelSolicitante(
  req: Request,
): Promise<{ auth_user_id: string; rol: string; organizacion_id: string | null } | null> {
  const usuario = comoUsuario(req)

  const { data: sesion } = await usuario.auth.getUser()
  const id = sesion.user?.id
  if (!id) return null

  const { data } = await usuario
    .from('usuarios_rol')
    .select('rol, organizacion_id')
    .eq('auth_user_id', id)
    .maybeSingle()

  if (!data) return null
  return { auth_user_id: id, rol: data.rol, organizacion_id: data.organizacion_id ?? null }
}

/** Cabeceras CORS.
 *
 *  El navegador manda un preflight OPTIONS antes de cada llamada cross-origin
 *  y bloquea la petición si no recibe permiso. Sin esto, la app falla con
 *  "Failed to send a request to the Edge Function" y la petición ni siquiera
 *  llega al servidor — no hay log que revisar.
 *
 *  Se permite cualquier origen porque el control de acceso real es el JWT que
 *  cada función verifica; el origen no autoriza nada por sí solo. */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Responde el preflight. Llamar como primera línea de cada función. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null
}

export function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

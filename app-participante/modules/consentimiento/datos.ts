/** Consentimiento informado — implementa ESP-001 (RF-001-04 … RF-001-07).
 *
 *  Tabla append-only y versionada (RN-001-02): un comité de ética puede pedir
 *  prueba de qué versión del texto aceptó cada participante. Un rechazo se
 *  registra como fila, no como ausencia de fila (RN-001-03). */

import { supabase } from '../nucleo/supabase'

/** Versión del texto vigente. Al cambiar el consentimiento se incrementa,
 *  y los participantes vuelven a decidir sobre el texto nuevo. */
// v3 cambia el trato: la empresa pasa a ver nombre, adherencia y nivel.
// Quien aceptó v2 lo hizo bajo anonimato, así que tiene que volver a decidir.
export const VERSION_TEXTO = 'v3-2026-10'

export type RegistroConsentimiento = {
  aceptado: boolean
  version_texto: string
  registrado_en: string
}

/** Última decisión del participante. null si nunca decidió. */
export async function obtenerVigente(
  participanteId: string,
): Promise<RegistroConsentimiento | null> {
  const { data } = await supabase
    .from('consentimientos')
    .select('aceptado, version_texto, registrado_en')
    .eq('participante_id', participanteId)
    .order('registrado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as RegistroConsentimiento | null) ?? null
}

/** RN-001-04 — puerta de acceso a toda recolección. Exige decisión afirmativa
 *  sobre la versión vigente del texto: si el texto cambió, hay que reconsentir. */
export async function puedeRecolectar(participanteId: string) {
  const vigente = await obtenerVigente(participanteId)
  return vigente?.aceptado === true && vigente.version_texto === VERSION_TEXTO
}

/** RF-001-05 y RF-001-07 — registra aceptación, rechazo o retiro.
 *  Nunca actualiza: siempre agrega. */
export async function registrarDecision(participanteId: string, aceptado: boolean) {
  const { error } = await supabase.from('consentimientos').insert({
    participante_id: participanteId,
    version_texto: VERSION_TEXTO,
    aceptado,
  })
  if (error) throw error
}

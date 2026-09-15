/** Recolección — implementa ESP-002 (RF-002-02, RF-002-03, RF-002-04). */

import { supabase } from '../nucleo/supabase'
import type { ClaveFormulario, Formulario, Valores } from '../nucleo/tipos'

/** RF-002-02 — versión vigente del formulario, leída de base de datos.
 *  El versionado no es opcional (RN-002-02): sin él, respuestas de distintos
 *  momentos del estudio dejan de ser comparables sin que nada falle. */
export async function obtenerFormulario(clave: ClaveFormulario): Promise<Formulario> {
  const { data, error } = await supabase
    .from('formularios')
    .select('clave, version, definicion')
    .eq('clave', clave)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (error) throw error
  return data as Formulario
}

/** RF-002-04 y RN-002-03 — marca el inicio de la evaluación.
 *  Se llama al MONTAR la pantalla, no al enviar: junto con `enviado_en` define
 *  el indicador de tiempo de detección de la tesis. Capturarlo al enviar lo
 *  dejaría siempre en cero. */
export async function registrarInicio(
  participanteId: string,
  clave: ClaveFormulario,
): Promise<string> {
  const iniciadoEn = new Date().toISOString()

  await supabase.from('eventos').insert({
    participante_id: participanteId,
    tipo: 'evaluacion_iniciada',
    ocurrido_en: iniciadoEn,
    metadata: { formulario: clave },
  })

  return iniciadoEn
}

/** RF-002-03 — guarda la respuesta ítem por ítem. El puntaje agregado no se
 *  almacena en ninguna parte: se recalcula siempre desde estos valores, para
 *  que un cambio de umbral o de fórmula no obligue a recolectar de nuevo. */
export async function enviarRespuesta(params: {
  participanteId: string
  formulario: Formulario
  iniciadoEn: string
  valores: Valores
}): Promise<string> {
  const { participanteId, formulario, iniciadoEn, valores } = params

  const { data: respuesta, error: errorRespuesta } = await supabase
    .from('respuestas')
    .insert({
      participante_id: participanteId,
      formulario_clave: formulario.clave,
      formulario_version: formulario.version,
      iniciado_en: iniciadoEn,
    })
    .select('id')
    .single()

  if (errorRespuesta) throw errorRespuesta

  const filas = formulario.definicion.items.map((item) => {
    const valor = valores[item.clave]
    const esNumerico = typeof valor === 'number' || typeof valor === 'boolean'
    return {
      respuesta_id: respuesta.id,
      item_clave: item.clave,
      valor_num: esNumerico ? Number(valor) : null,
      valor_texto: typeof valor === 'string' ? valor : null,
    }
  })

  const { error: errorItems } = await supabase.from('respuestas_items').insert(filas)
  if (errorItems) throw errorItems

  await supabase.from('eventos').insert({
    participante_id: participanteId,
    tipo: 'evaluacion_enviada',
    metadata: {
      formulario: formulario.clave,
      formulario_version: formulario.version,
      respuesta_id: respuesta.id,
    },
  })

  // RN-002-05 — la puntuación corre en el servidor (ESP-003). El cliente
  // nunca decide una detección ni conoce los umbrales.
  if (formulario.clave === 'olbi') {
    await supabase.functions.invoke('evaluar-olbi', {
      body: { respuesta_id: respuesta.id },
    })
  }

  return respuesta.id as string
}

/** Fecha del último envío de cada formulario. Insumo de la agenda. */
export async function ultimosEnvios(
  participanteId: string,
): Promise<Partial<Record<ClaveFormulario, string>>> {
  const { data } = await supabase
    .from('respuestas')
    .select('formulario_clave, enviado_en')
    .eq('participante_id', participanteId)
    .order('enviado_en', { ascending: false })

  const ultimo: Partial<Record<ClaveFormulario, string>> = {}
  for (const fila of data ?? []) {
    const clave = fila.formulario_clave as ClaveFormulario
    if (!ultimo[clave]) ultimo[clave] = fila.enviado_en as string
  }
  return ultimo
}

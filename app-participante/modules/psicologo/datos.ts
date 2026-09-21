/** Módulo del psicólogo — implementa ESP-006 (RF-006-02 … RF-006-06) y ESP-004.
 *
 *  Todo el acceso está acotado por derivación abierta. Este módulo no impone
 *  esa restricción: la impone RLS. Aquí solo se consulta lo que el servidor
 *  ya decidió que este psicólogo puede ver. */

import { supabase } from '../nucleo/supabase'

export type Derivacion = {
  id: string
  participante_id: string
  abierta_en: string
  cerrada_en: string | null
  codigo_anonimo: string
}

export type PuntajeOlbi = {
  respuesta_id: string
  enviado_en: string
  dimension: string
  puntaje: number
}

export type Informe = {
  id: string
  sesion_id: string
  contenido_borrador: Record<string, unknown>
  contenido_aprobado: Record<string, unknown> | null
  estado: 'sin_revisar' | 'aprobado' | 'descartado'
  modelo: string
  generado_en: string
}

export type SesionConsulta = {
  id: string
  derivacion_id: string
  consentimiento_participante: boolean
  consentimiento_psicologo: boolean
  sala_livekit: string
  iniciada_en: string
  finalizada_en: string | null
}

/** RF-006-02 — solo las derivaciones asignadas a este psicólogo. */
export async function listarDerivaciones(soloAbiertas = true): Promise<Derivacion[]> {
  let consulta = supabase
    .from('derivaciones')
    .select('id, participante_id, abierta_en, cerrada_en, participantes(codigo_anonimo)')
    .order('abierta_en', { ascending: false })

  if (soloAbiertas) consulta = consulta.is('cerrada_en', null)

  const { data, error } = await consulta
  if (error) throw error

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    participante_id: fila.participante_id,
    abierta_en: fila.abierta_en,
    cerrada_en: fila.cerrada_en,
    codigo_anonimo: fila.participantes?.codigo_anonimo ?? '—',
  }))
}

/** RF-006-12 y RN-006-03 — única puerta a los datos personales.
 *  El servidor verifica la derivación y registra el acceso antes de responder;
 *  si no hay derivación abierta, esto lanza. */
export async function obtenerIdentidad(participanteId: string) {
  const { data, error } = await supabase.rpc('obtener_identidad', {
    p_participante_id: participanteId,
  })
  if (error) throw error
  return (data?.[0] as { nombre: string; correo_contacto: string } | undefined) ?? null
}

/** RF-006-03 — trayectoria de puntajes. El cálculo vive en la vista
 *  `puntajes_olbi`, no aquí: el cliente nunca puntúa (ESP-002 RN-002-05). */
export async function trayectoriaOlbi(participanteId: string): Promise<PuntajeOlbi[]> {
  const { data, error } = await supabase
    .from('puntajes_olbi')
    .select('respuesta_id, enviado_en, dimension, puntaje')
    .eq('participante_id', participanteId)
    .order('enviado_en', { ascending: true })

  if (error) throw error
  return (data ?? []) as PuntajeOlbi[]
}

export async function eventoDeteccion(participanteId: string) {
  const { data } = await supabase
    .from('eventos')
    .select('ocurrido_en, metadata')
    .eq('participante_id', participanteId)
    .eq('tipo', 'deteccion')
    .order('ocurrido_en', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data as { ocurrido_en: string; metadata: Record<string, unknown> } | null
}

export async function sesionesDe(derivacionId: string): Promise<SesionConsulta[]> {
  const { data, error } = await supabase
    .from('sesiones_consulta')
    .select('*')
    .eq('derivacion_id', derivacionId)
    .order('iniciada_en', { ascending: false })

  if (error) throw error
  return (data ?? []) as SesionConsulta[]
}

/** La sala la crea el servidor: el cliente no puede inventarse una sala
 *  ni firmar su propio token de acceso. */
export async function crearSesion(derivacionId: string): Promise<SesionConsulta> {
  const { data, error } = await supabase.functions.invoke('crear-sesion', {
    body: { derivacion_id: derivacionId },
  })
  if (error) throw error
  return data.sesion as SesionConsulta
}

/** RF-004-02 — el consentimiento de grabación es por sesión y de ambas partes. */
export async function consentirGrabacion(sesionId: string, quien: 'psicologo' | 'participante') {
  const campo =
    quien === 'psicologo' ? 'consentimiento_psicologo' : 'consentimiento_participante'

  const { error } = await supabase
    .from('sesiones_consulta')
    .update({ [campo]: true })
    .eq('id', sesionId)

  if (error) throw error
}

/** Transcripción de la sesión (solo el psicólogo de la derivación, RN-004-08). */
export type Transcripcion = { estado: string; etapa: string; detalle: string | null; texto: string | null; proveedor: string | null; creada_en: string; actualizada_en: string }
export async function obtenerTranscripcion(sesionId: string): Promise<Transcripcion | null> {
  const { data } = await supabase
    .from('transcripciones')
    .select('estado, etapa, detalle, texto, proveedor, creada_en, actualizada_en')
    .eq('sesion_id', sesionId)
    .maybeSingle()
  return (data as Transcripcion | null) ?? null
}

export async function obtenerInforme(sesionId: string): Promise<Informe | null> {
  const { data } = await supabase
    .from('informes')
    .select('*')
    .eq('sesion_id', sesionId)
    .maybeSingle()

  return (data as Informe | null) ?? null
}

/** RF-004-11 y RN-004-02 — solo el psicólogo aprueba, y al aprobar queda
 *  registrado quién responde por el contenido. El borrador original no se
 *  toca: un disparador en la base de datos lo impide. */
export async function aprobarInforme(
  informeId: string,
  contenidoCorregido: Record<string, unknown>,
  psicologoId: string,
) {
  const { error } = await supabase
    .from('informes')
    .update({
      contenido_aprobado: contenidoCorregido,
      estado: 'aprobado',
      aprobado_por: psicologoId,
      aprobado_en: new Date().toISOString(),
    })
    .eq('id', informeId)

  if (error) throw error
}

/** RF-006-06 — al cerrar, el psicólogo pierde el acceso a este participante. */
export async function cerrarDerivacion(derivacionId: string) {
  const { error } = await supabase
    .from('derivaciones')
    .update({ cerrada_en: new Date().toISOString() })
    .eq('id', derivacionId)

  if (error) throw error
}

export async function psicologoActual() {
  const { data } = await supabase.from('psicologos').select('id, nombre').maybeSingle()
  return (data as { id: string; nombre: string } | null) ?? null
}

export async function obtenerDerivacion(derivacionId: string): Promise<Derivacion | null> {
  const { data } = await supabase
    .from('derivaciones')
    .select('id, participante_id, abierta_en, cerrada_en, participantes(codigo_anonimo)')
    .eq('id', derivacionId)
    .maybeSingle()

  if (!data) return null
  const fila = data as any
  return {
    id: fila.id,
    participante_id: fila.participante_id,
    abierta_en: fila.abierta_en,
    cerrada_en: fila.cerrada_en,
    codigo_anonimo: fila.participantes?.codigo_anonimo ?? '—',
  }
}

// ------------------------------------------------------- Vista móvil (rev. 2)

export type EstadoCaso = 'sesion_pendiente' | 'cita_por_confirmar' | 'cita_confirmada' | 'sala_lista' | 'informe_por_aprobar' | 'cerrado'

/** Una fila de `casos_psicologo` (ESP-006 RF-006-13). */
export type Caso = {
  derivacion_id: string
  participante_id: string
  codigo_anonimo: string
  empresa: string | null
  abierta_en: string
  cerrada_en: string | null
  detectado_en: string | null
  puntajes: Partial<Record<'agotamiento' | 'desvinculacion', number>> | null
  umbrales: Partial<Record<'agotamiento' | 'desvinculacion', number | null>> | null
  sesion_id: string | null
  sesion_iniciada_en: string | null
  sesion_finalizada_en: string | null
  consentimiento_participante: boolean | null
  consentimiento_psicologo: boolean | null
  informe_estado: 'sin_revisar' | 'aprobado' | 'descartado' | null
  /** deteccion: la abrió el modelo. solicitud: la pidió el participante (ESP-004 RF-004-13). */
  origen: 'deteccion' | 'solicitud'
  cita_id: string | null
  cita_para: string | null
  cita_motivo: string | null
  cita_estado: 'solicitada' | 'confirmada' | null
  estado_caso: EstadoCaso
}

/** RF-004-15 — el psicólogo confirma la hora pedida o la cancela (y el
 *  participante puede pedir otra). Ambas son funciones de base de datos. */
export async function confirmarCita(citaId: string) {
  const { error } = await supabase.rpc('confirmar_cita', { p_cita: citaId })
  if (error) throw error
}

export async function cancelarCitaComoPsicologo(citaId: string) {
  const { error } = await supabase.rpc('cancelar_cita', { p_cita: citaId })
  if (error) throw error
}

export type PerfilCaso = {
  rol: string | null
  modalidad: string | null
  antiguedad_empresa: number | null
  antiguedad_sector: number | null
}

export async function listarCasos(): Promise<Caso[]> {
  const { data, error } = await supabase
    .from('casos_psicologo')
    .select('*')
    .order('abierta_en', { ascending: false })
  if (error) throw error
  return (data ?? []) as Caso[]
}

export async function obtenerCaso(derivacionId: string): Promise<Caso | null> {
  const { data } = await supabase
    .from('casos_psicologo')
    .select('*')
    .eq('derivacion_id', derivacionId)
    .maybeSingle()
  return (data as Caso | null) ?? null
}

/** RF-006-14 — rol, modalidad y antigüedad (excepción acotada a RN-006-07). */
export async function perfilCaso(participanteId: string): Promise<PerfilCaso | null> {
  const { data } = await supabase.rpc('perfil_caso', { p_participante: participanteId })
  return (data as PerfilCaso | null) ?? null
}

/** ESP-005 — pronóstico para la próxima semana, con la versión activa. Se
 *  consulta sin registrar evento: la predicción «oficial» del día la registra
 *  la app del participante; el psicólogo solo la lee. */
export async function pronosticoCaso(participanteId: string) {
  const { data } = await supabase.rpc('probabilidad_semana', {
    p_participante: participanteId,
    p_tarea: 'pronostico',
  })
  return data && data.probabilidad != null ? (data as import('../participante/resultado').Prediccion) : null
}

/** RF-004-12 — informe manual cuando no hubo grabación: borrador vacío,
 *  lo escrito va directo a `contenido_aprobado` al aprobar. */
export async function abrirInformeManual(sesionId: string): Promise<Informe> {
  const { data, error } = await supabase
    .from('informes')
    .insert({ sesion_id: sesionId, transcripcion_id: null, contenido_borrador: {}, modelo: 'manual' })
    .select('*')
    .single()
  if (error) throw error
  return data as Informe
}

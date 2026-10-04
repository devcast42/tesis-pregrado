/** Resumen para el trabajador — implementa ESP-004 RF-004-17.
 *
 *  No es el informe clínico (RN-004-03): es un documento propio, en segunda
 *  persona, con acuerdos y recomendaciones de autocuidado, generado a partir
 *  de la misma transcripción que usa el psicólogo. Solo el trabajador lo lee. */

import { Linking, Platform } from 'react-native'
import { supabase } from '../nucleo/supabase'

export type EtapaResumen = 'esperando' | 'redactando' | 'generando_pdf' | 'listo' | 'fallido'

export type EstadoResumen = {
  etapa: EtapaResumen
  origen: 'sesion' | 'general' | null
  detalle: string | null
  pdf_ruta: string | null
  transcripcion_etapa: string | null
  sesion_finalizada: boolean
}

export type Resumen = {
  id: string
  sesion_id: string
  etapa: EtapaResumen
  origen: 'sesion' | 'general' | null
  detalle: string | null
  pdf_ruta: string | null
  creado_en: string
  actualizado_en: string
}

const BUCKET = 'resumenes-trabajador'

/** Pide (o consulta) el resumen de una sesión. Idempotente: si ya está
 *  listo devuelve el estado; si falta algo, dice qué se espera. */
export async function solicitarResumen(sesionId: string): Promise<EstadoResumen> {
  const { data, error } = await supabase.functions.invoke('resumen-trabajador', { body: { sesion_id: sesionId } })
  if (error) throw new Error('No se pudo consultar el resumen. Revisa tu conexión.')
  return data as EstadoResumen
}

export async function misResumenes(): Promise<Resumen[]> {
  const { data, error } = await supabase
    .from('resumenes_trabajador')
    .select('id, sesion_id, etapa, origen, detalle, pdf_ruta, creado_en, actualizado_en')
    .order('creado_en', { ascending: false })
  if (error) throw error
  return (data ?? []) as Resumen[]
}

/** Abre el PDF con una URL firmada de corta vida. En el teléfono lo abre el
 *  navegador (que lo descarga o lo muestra); en web, una pestaña nueva. */
export async function abrirPdf(ruta: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300, { download: true })
  if (error || !data?.signedUrl) throw new Error('No se pudo preparar la descarga. Inténtalo de nuevo.')
  if (Platform.OS === 'web') window.open(data.signedUrl, '_blank')
  else await Linking.openURL(data.signedUrl)
}

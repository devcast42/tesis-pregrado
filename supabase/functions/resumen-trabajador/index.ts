// Resumen para el trabajador — implementa ESP-004 RF-004-17.
//
// Documento personal del trabajador, distinto del informe clínico
// (RN-004-03): en segunda persona, con los acuerdos de la sesión y
// recomendaciones de autocuidado. Sin puntajes, sin observaciones clínicas,
// sin diagnósticos: el esquema JSON no tiene dónde ponerlos.
//
// Lo llama la app del trabajador al salir de la videollamada (y cada pocos
// segundos mientras no esté listo) y `transcripcion-lista` cuando la
// transcripción termina. Es idempotente: quien llegue primero redacta; el
// resto solo lee el estado.
//
// Fuente: la MISMA transcripción que alimenta el borrador del psicólogo
// (Deepgram corre una vez). Si la sesión no se grabó, o la transcripción
// falló, se generan recomendaciones generales sin inventar nada de la
// conversación.

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'
import { comoUsuario, json, preflight, servicio } from '../_compartido/supabase.ts'
import { generarPdfResumen } from '../_compartido/pdf.ts'

const MODELO = 'claude-haiku-4-5-20251001'
const BUCKET = 'resumenes-trabajador'
// Si la transcripción no llega en este tiempo, se entrega el resumen general
// para que la persona no espere en vano. El psicólogo sí puede reintentar lo suyo.
const ESPERA_MAX_MIN = 12

const ESQUEMA = {
  type: 'object',
  properties: {
    lo_que_conversamos: { type: 'array', items: { type: 'string' }, description: 'De qué hablaste en la sesión, en 2 a 4 frases neutras y breves, en segunda persona. Vacío si no hay transcripción.' },
    acuerdos: { type: 'array', items: { type: 'string' }, description: 'Acuerdos explícitos a los que llegaste con el profesional. Solo los que se dijeron. Vacío si no hubo.' },
    recomendaciones: {
      type: 'array',
      items: { type: 'object', properties: { titulo: { type: 'string' }, detalle: { type: 'string' } }, required: ['titulo', 'detalle'], additionalProperties: false },
      description: 'Entre 4 y 6 recomendaciones de autocuidado concretas y realizables esta semana, conectadas con lo que se conversó cuando haya transcripción.',
    },
    recursos: { type: 'array', items: { type: 'string' }, description: 'Apoyos con los que la persona dijo contar o que puede activar (personas, hábitos, espacios). 2 a 4.' },
    mensaje_final: { type: 'string', description: 'Una o dos frases cálidas de cierre, sin promesas clínicas.' },
  },
  required: ['lo_que_conversamos', 'acuerdos', 'recomendaciones', 'recursos', 'mensaje_final'],
  additionalProperties: false,
}

const INSTRUCCIONES = `Escribes un resumen breve para la persona que acaba de tener una sesión de apoyo psicológico dentro de un estudio universitario sobre bienestar laboral en el sector tecnológico. Ella lo leerá sola, en su teléfono.

Tu tarea es acompañar, no evaluar.

Reglas estrictas:
- Escribe en segunda persona ("conversaste", "acordaste"), en español neutro, cálido y directo. Frases cortas.
- No diagnostiques, no clasifiques severidad, no uses etiquetas clínicas ("burnout severo", "ansiedad", "depresión"), no menciones puntajes ni niveles de riesgo.
- No recomiendes medicación ni tratamientos. No des instrucciones médicas.
- No inventes nada que no esté en la transcripción. Si la transcripción es corta, entrecortada o no existe, deja "lo_que_conversamos" y "acuerdos" con lo poco que haya (o vacíos) y apóyate en recomendaciones generales de autocuidado para profesionales de tecnología (pausas, límites con el trabajo, sueño, movimiento, conexión con otras personas, pedir ayuda).
- Las recomendaciones deben ser concretas y pequeñas: algo que la persona pueda hacer esta semana, no cambios de vida.
- No alarmes ni minimices. No prometas resultados.
- No incluyas emojis ni símbolos especiales.`

async function redactar(texto: string | null) {
  const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
  const respuesta = await claude.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: INSTRUCCIONES,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: texto
        ? `Transcripción de la sesión:\n\n${texto}`
        : 'Esta sesión no se grabó, así que no hay transcripción. Redacta el resumen solo con recomendaciones generales y deja vacías las secciones que dependen de la conversación.',
    }],
  })
  if (respuesta.stop_reason === 'refusal') throw new Error('El modelo declinó redactar el resumen')
  const bloque = respuesta.content.find((b) => b.type === 'text')
  if (!bloque || bloque.type !== 'text') throw new Error('El modelo no devolvió contenido')
  const limpiar = (v: unknown): unknown =>
    typeof v === 'string' ? v.trim()
    : Array.isArray(v) ? v.map(limpiar)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, limpiar(x)]))
    : v
  return limpiar(JSON.parse(bloque.text)) as {
    lo_que_conversamos: string[]; acuerdos: string[]; recomendaciones: { titulo: string; detalle: string }[]; recursos: string[]; mensaje_final: string
  }
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' })

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const { sesion_id } = await req.json().catch(() => ({}))
  if (!sesion_id) return json({ error: 'falta sesion_id' }, 400)

  const db = servicio()
  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('id, iniciada_en, finalizada_en, consentimiento_trabajador, consentimiento_psicologo, derivaciones(trabajador_id, psicologos(nombre))')
    .eq('id', sesion_id)
    .maybeSingle()
  if (!sesion) return json({ error: 'sesion no encontrada' }, 404)
  const deriv = (sesion as any).derivaciones as { trabajador_id: string; psicologos: { nombre: string } | null }

  // Quién llama: el propio trabajador, o el servidor (transcripcion-lista).
  const cabecera = req.headers.get('Authorization') ?? ''
  const esServidor = cabecera === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  if (!esServidor) {
    const { data: auth } = await comoUsuario(req).auth.getUser()
    if (!auth?.user) return json({ error: 'no autenticado' }, 401)
    const { data: p } = await db.from('trabajadores').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
    if (p?.id !== deriv.trabajador_id) return json({ error: 'sin acceso a esta sesion' }, 403)
  }

  const { data: tr } = await db.from('transcripciones').select('estado, etapa, detalle, texto').eq('sesion_id', sesion_id).maybeSingle()
  const { data: previo } = await db.from('resumenes_trabajador').select('*').eq('sesion_id', sesion_id).maybeSingle()

  const responder = (fila: any, extra: Record<string, unknown> = {}) =>
    json({ etapa: fila.etapa, origen: fila.origen, detalle: fila.detalle, pdf_ruta: fila.pdf_ruta, transcripcion_etapa: tr?.etapa ?? null, sesion_finalizada: !!sesion.finalizada_en, ...extra })

  if (previo?.etapa === 'listo') return responder(previo)
  // Otro proceso ya está redactando (hace menos de 3 min): solo informar.
  if (previo && (previo.etapa === 'redactando' || previo.etapa === 'generando_pdf')
      && Date.now() - new Date(previo.actualizado_en).getTime() < 3 * 60_000) {
    return responder(previo)
  }

  // ¿Qué fuente hay?
  const ambosConsintieron = sesion.consentimiento_trabajador && sesion.consentimiento_psicologo
  const transcripcionLista = tr?.estado === 'lista' && !!tr.texto
  const sinGrabacion = !ambosConsintieron || !tr || tr.etapa === 'sin_grabacion' || tr.etapa === 'fallida'
  const minutosDesdeFin = sesion.finalizada_en ? (Date.now() - new Date(sesion.finalizada_en).getTime()) / 60_000 : 0
  const esperoDemasiado = !!sesion.finalizada_en && minutosDesdeFin > ESPERA_MAX_MIN

  let origen: 'sesion' | 'general'
  if (transcripcionLista) origen = 'sesion'
  else if (sesion.finalizada_en && (sinGrabacion || esperoDemasiado)) origen = 'general'
  else {
    // Todavía no hay con qué redactar: dejar constancia y que la app vuelva a preguntar.
    const detalle = !sesion.finalizada_en ? 'esperando a que termine la sesión'
      : tr?.etapa === 'transcribiendo' ? 'transcribiendo la conversación'
      : 'esperando el audio de la sesión'
    const fila = { sesion_id, trabajador_id: deriv.trabajador_id, etapa: 'esperando', detalle, actualizado_en: new Date().toISOString() }
    const { data } = await db.from('resumenes_trabajador').upsert(fila, { onConflict: 'sesion_id' }).select('*').single()
    return responder(data ?? fila)
  }

  // Reclamar la redacción (idempotencia entre app y webhook).
  const { data: reclamo } = await db
    .from('resumenes_trabajador')
    .upsert({ sesion_id, trabajador_id: deriv.trabajador_id, etapa: 'redactando', origen, detalle: null, actualizado_en: new Date().toISOString() }, { onConflict: 'sesion_id' })
    .select('*')
    .single()
  if (!reclamo) return json({ error: 'no se pudo registrar el resumen' }, 500)

  try {
    const contenido = await redactar(origen === 'sesion' ? tr!.texto : null)
    await db.from('resumenes_trabajador').update({ etapa: 'generando_pdf', contenido, modelo: MODELO, actualizado_en: new Date().toISOString() }).eq('sesion_id', sesion_id)

    const psicologo = deriv.psicologos?.nombre
    const pdf = await generarPdfResumen({
      titulo: 'Tu resumen de la sesión',
      subtitulo: `${fecha(sesion.finalizada_en ?? sesion.iniciada_en)}${psicologo ? ` · Sesión con ${psicologo}` : ''} · Estudio de bienestar · UNT`,
      introduccion: origen === 'sesion'
        ? 'Este resumen es solo para ti. Recoge lo que conversaste y algunas ideas pequeñas para los próximos días. No es un diagnóstico ni reemplaza lo que hablaste con el profesional.'
        : 'Esta sesión no se grabó, así que este resumen no recoge lo que conversaste: son ideas generales de autocuidado que suelen ayudar a quienes trabajan en tecnología. No es un diagnóstico.',
      secciones: [
        { titulo: 'Lo que conversaste', puntos: contenido.lo_que_conversamos },
        { titulo: 'Lo que acordaste', puntos: contenido.acuerdos },
        { titulo: 'Recomendaciones para los próximos días', puntos: contenido.recomendaciones },
        { titulo: 'Apoyos con los que cuentas', puntos: contenido.recursos },
      ],
      cierre: contenido.mensaje_final,
      piePagina: [
        'Recomendaciones generadas con apoyo de inteligencia artificial a partir de tu sesión y revisables con tu psicólogo. Si algo no te representa, coméntaselo en la próxima cita.',
        'Si sientes que necesitas ayuda inmediata, comunícate con la Línea 113 (opción 5) del Ministerio de Salud, gratuita y disponible las 24 horas.',
        'Este documento es tuyo: tu empresa no lo recibe y el estudio no lo usa como dato.',
      ],
    })

    const ruta = `${deriv.trabajador_id}/${sesion_id}.pdf`
    const { error: errorSubida } = await db.storage.from(BUCKET).upload(ruta, pdf, { contentType: 'application/pdf', upsert: true })
    if (errorSubida) throw new Error(`No se pudo guardar el PDF: ${errorSubida.message}`)

    const { data: listo } = await db
      .from('resumenes_trabajador')
      .update({ etapa: 'listo', pdf_ruta: ruta, detalle: null, actualizado_en: new Date().toISOString() })
      .eq('sesion_id', sesion_id)
      .select('*')
      .single()

    await db.from('eventos').insert({
      trabajador_id: deriv.trabajador_id,
      tipo: 'resumen_entregado',
      metadata: { sesion_id, origen, modelo: MODELO },
    })
    return responder(listo)
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    console.error('resumen-trabajador', sesion_id, detalle)
    const { data } = await db.from('resumenes_trabajador').update({ etapa: 'fallido', detalle, actualizado_en: new Date().toISOString() }).eq('sesion_id', sesion_id).select('*').single()
    return responder(data ?? { etapa: 'fallido', origen, detalle, pdf_ruta: null })
  }
})

// Borrador de informe de apoyo — implementa ESP-004 RF-004-08.
//
// ⚠️ El informe es un apoyo administrativo, no un diagnóstico (RN-004-01).
// La salida va con esquema JSON fijo y no con prosa libre: con prosa libre un
// modelo que escribe sobre la salud mental de alguien termina deslizando
// valoraciones ("muestra signos de agotamiento severo"), y en ese momento el
// sistema pasa a hacer justo lo que la tesis declara que no hace. El esquema
// lo impide estructuralmente, no por instrucción.
//
// Nace en estado `sin_revisar`. La base de datos impide aprobarlo sin un
// psicólogo responsable, y el borrador queda inmutable (RN-004-02, RN-004-04).

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'
import { json, servicio } from '../_compartido/supabase.ts'

const MODELO = 'claude-haiku-4-5-20251001' // ~USD 0.02 por informe; Opus solo si el borrador queda pobre

const ESQUEMA = {
  type: 'object',
  properties: {
    temas_tratados: {
      type: 'array',
      items: { type: 'string' },
      description: 'Temas que se conversaron, en las palabras de la sesión.',
    },
    situaciones_laborales_mencionadas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Hechos concretos del trabajo que la persona mencionó.',
    },
    recursos_de_apoyo_mencionados: {
      type: 'array',
      items: { type: 'string' },
      description: 'Apoyos con los que la persona dijo contar.',
    },
    acuerdos_de_la_sesion: {
      type: 'array',
      items: { type: 'string' },
      description: 'Acuerdos explícitos a los que llegaron en la sesión.',
    },
    citas_textuales_relevantes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          contexto: { type: 'string' },
        },
        required: ['texto', 'contexto'],
        additionalProperties: false,
      },
    },
    nota_del_borrador: {
      type: 'string',
      description: 'Una o dos frases sobre qué tan completa es la transcripción (audio claro, fragmentaria, ininteligible, muy corta) y por qué alguna sección quedó vacía. Vacío si no hay nada que advertir.',
    },
  },
  required: [
    'temas_tratados',
    'situaciones_laborales_mencionadas',
    'recursos_de_apoyo_mencionados',
    'acuerdos_de_la_sesion',
    'citas_textuales_relevantes',
    'nota_del_borrador',
  ],
  additionalProperties: false,
}

const INSTRUCCIONES = `Organizas transcripciones de sesiones de apoyo psicológico para que el profesional que las condujo tenga un borrador administrativo de lo conversado.

Tu tarea es ORGANIZAR lo que se dijo, no interpretarlo.

Reglas:
- No emitas diagnósticos, no clasifiques severidad, no valores el estado psicológico de nadie.
- No recomiendes tratamiento, medicación ni intervenciones.
- No infieras lo que la persona "realmente" siente. Registra lo que dijo.
- Si algo no se mencionó en la sesión, deja el arreglo vacío. No completes con lo que suele ocurrir en casos parecidos.
- En "temas_tratados" registra de qué se habló aunque sea breve o la transcripción esté entrecortada: es la sección que resume la sesión.
- Si la transcripción es fragmentaria, muy corta o ininteligible, dilo en "nota_del_borrador" para que el profesional sepa por qué el borrador viene incompleto. No lo compenses inventando.
- Las citas textuales deben ser literales de la transcripción.
- Escribe en español neutro, en tercera persona, sin adjetivos valorativos.

El profesional revisa y corrige este borrador antes de que valga como registro.`

Deno.serve(async (req) => {
  const { sesion_id } = await req.json()
  if (!sesion_id) return json({ error: 'falta sesion_id' }, 400)

  const db = servicio()

  const { data: transcripcion } = await db
    .from('transcripciones')
    .select('id, estado, texto')
    .eq('sesion_id', sesion_id)
    .maybeSingle()

  // RN-004-05 — sin transcripción completa no hay informe.
  if (!transcripcion || transcripcion.estado !== 'lista' || !transcripcion.texto) {
    return json({ error: 'transcripcion no disponible' }, 409)
  }

  const { data: existente } = await db
    .from('informes')
    .select('id')
    .eq('sesion_id', sesion_id)
    .maybeSingle()

  if (existente) return json({ ya_existe: true, informe_id: existente.id })

  const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  const respuesta = await claude.messages.create({
    model: MODELO,
    max_tokens: 16000,
    system: INSTRUCCIONES,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [
      {
        role: 'user',
        content: `Transcripción de la sesión:\n\n${transcripcion.texto}`,
      },
    ],
  })

  // Una negativa del modelo deja `content` vacío: leer content[0] sin
  // comprobar stop_reason rompería aquí.
  if (respuesta.stop_reason === 'refusal') {
    await db.from('transcripciones').update({ etapa: 'fallida', detalle: 'El modelo declinó redactar el borrador' }).eq('sesion_id', sesion_id)
    return json({ error: 'el modelo declino generar el informe' }, 422)
  }

  const bloque = respuesta.content.find((b) => b.type === 'text')
  if (!bloque || bloque.type !== 'text') return json({ error: 'sin contenido' }, 502)

  // El modelo a veces deja espacios iniciales en las cadenas del JSON.
  const limpiar = (v: unknown): unknown =>
    typeof v === 'string' ? v.trim()
    : Array.isArray(v) ? v.map(limpiar)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, limpiar(x)]))
    : v
  const contenido = limpiar(JSON.parse(bloque.text))

  const { data: informe, error } = await db
    .from('informes')
    .insert({
      sesion_id,
      transcripcion_id: transcripcion.id,
      contenido_borrador: contenido,
      modelo: MODELO,
    })
    .select('id')
    .single()

  // Deepgram puede llamar dos veces al callback: si otra ejecución ya insertó
  // el informe entre nuestra comprobación y este insert, no es un fallo.
  if (error?.code === '23505') {
    await db.from('transcripciones').update({ etapa: 'informe_listo', detalle: null }).eq('sesion_id', sesion_id)
    const { data: otro } = await db.from('informes').select('id').eq('sesion_id', sesion_id).maybeSingle()
    return json({ ya_existe: true, informe_id: otro?.id })
  }
  if (error) return json({ error: error.message }, 500)

  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('derivaciones(trabajador_id)')
    .eq('id', sesion_id)
    .single()

  await db.from('eventos').insert({
    trabajador_id: (sesion as any).derivaciones.trabajador_id,
    tipo: 'informe_generado',
    metadata: { sesion_id, informe_id: informe.id, modelo: MODELO },
  })

  await db.from('transcripciones').update({ etapa: 'informe_listo', detalle: null }).eq('sesion_id', sesion_id)

  return json({ informe_id: informe.id })
})

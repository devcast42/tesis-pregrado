// Evaluación por umbral OLBI — método tradicional (línea base del pretest).
// Implementa ESP-003 y, al detectar, abre la derivación de ESP-006.
//
// NO es el modelo de machine learning. Es la regla de puntuación del
// instrumento, que en el diseño preexperimental hace de método convencional
// contra el cual se compara el sistema propuesto.
//
// La fórmula (inversión de ítems y media por dimensión) vive en la vista
// `puntajes_olbi`, no aquí: tenerla en dos lugares la habría hecho divergir.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const METODO = 'olbi_umbral'

type Umbrales = Record<string, number | null>

Deno.serve(async (req) => {
  // El navegador manda un preflight antes de cada llamada cross-origin.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { respuesta_id } = await req.json()
  if (!respuesta_id) return json({ error: 'falta respuesta_id' }, 400)

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Respuesta
  const { data: respuesta } = await db
    .from('respuestas')
    .select('id, participante_id, formulario_clave, formulario_version')
    .eq('id', respuesta_id)
    .single()

  if (!respuesta) return json({ error: 'respuesta no encontrada' }, 404)
  if (respuesta.formulario_clave !== 'olbi') {
    return json({ error: 'la respuesta no corresponde al OLBI' }, 400)
  }

  // 2. Definición vigente: de aquí salen los umbrales
  const { data: formulario } = await db
    .from('formularios')
    .select('definicion')
    .eq('clave', 'olbi')
    .eq('version', respuesta.formulario_version)
    .single()

  const definicion = formulario?.definicion as
    | { items: { dimension?: string }[]; umbrales: Umbrales; version_umbral: string }
    | undefined

  if (!definicion) return json({ error: 'definicion no encontrada' }, 500)

  // 3. Puntajes calculados por la vista
  const { data: puntajesFilas } = await db
    .from('puntajes_olbi')
    .select('dimension, puntaje, items_contados')
    .eq('respuesta_id', respuesta_id)

  if (!puntajesFilas?.length) return json({ error: 'sin puntajes calculables' }, 422)

  // RF-003-07 — si falta cualquier ítem, no se puntúa parcialmente. Una
  // dimensión incompleta produce una media que parece válida y no lo es.
  const esperadosPorDimension = new Map<string, number>()
  for (const item of definicion.items) {
    if (!item.dimension) continue
    esperadosPorDimension.set(
      item.dimension,
      (esperadosPorDimension.get(item.dimension) ?? 0) + 1,
    )
  }

  for (const fila of puntajesFilas) {
    const esperados = esperadosPorDimension.get(fila.dimension) ?? 0
    if (fila.items_contados !== esperados) {
      return json(
        { error: `dimension ${fila.dimension} incompleta`, esperados, recibidos: fila.items_contados },
        422,
      )
    }
  }
  if (puntajesFilas.length !== esperadosPorDimension.size) {
    return json({ error: 'faltan dimensiones completas' }, 422)
  }

  const puntajes: Record<string, number> = {}
  for (const fila of puntajesFilas) puntajes[fila.dimension] = Number(fila.puntaje)

  // 4. Comparación contra umbrales.
  // RN-003-04: sin umbral configurado no se detecta. Un umbral inventado
  // produce detecciones sin respaldo que después se toman por reales.
  const dimensionesConUmbral = Object.entries(definicion.umbrales ?? {}).filter(
    ([, valor]) => valor !== null && valor !== undefined,
  ) as [string, number][]

  const detectado =
    dimensionesConUmbral.length > 0 &&
    dimensionesConUmbral.every(([dim, umbral]) => (puntajes[dim] ?? -Infinity) >= umbral)

  if (!detectado) {
    return json({ detectado: false, metodo: METODO, puntajes, umbrales: definicion.umbrales })
  }

  // 5. Detección
  const { data: evento } = await db
    .from('eventos')
    .insert({
      participante_id: respuesta.participante_id,
      tipo: 'deteccion',
      metadata: {
        metodo: METODO,
        version_umbral: definicion.version_umbral,
        formulario_version: respuesta.formulario_version,
        respuesta_id,
        puntajes,
        umbrales: definicion.umbrales,
      },
    })
    .select('id')
    .single()

  await db.from('participantes').update({ estado: 'detectado' }).eq('id', respuesta.participante_id)

  // 6. Derivación automática al psicólogo con menos casos abiertos.
  // Se registra su propia marca de tiempo: el indicador de tiempo de
  // detección puede reportarse con o sin este tramo (ESP-006 §11.2).
  const derivacion = await derivar(db, respuesta.participante_id, evento?.id ?? null)

  return json({
    detectado: true,
    metodo: METODO,
    puntajes,
    umbrales: definicion.umbrales,
    derivacion_id: derivacion,
  })
})

async function derivar(
  db: ReturnType<typeof createClient>,
  participanteId: string,
  eventoId: number | null,
): Promise<string | null> {
  const { data: abierta } = await db
    .from('derivaciones')
    .select('id')
    .eq('participante_id', participanteId)
    .is('cerrada_en', null)
    .maybeSingle()

  if (abierta) return abierta.id as string

  const { data: psicologos } = await db.from('psicologos').select('id').eq('activo', true)
  if (!psicologos?.length) return null

  const { data: cargas } = await db
    .from('derivaciones')
    .select('psicologo_id')
    .is('cerrada_en', null)

  const conteo = new Map<string, number>(psicologos.map((p) => [p.id as string, 0]))
  for (const fila of cargas ?? []) {
    const id = fila.psicologo_id as string
    conteo.set(id, (conteo.get(id) ?? 0) + 1)
  }

  const elegido = [...conteo.entries()].sort((a, b) => a[1] - b[1])[0][0]

  const { data: nueva } = await db
    .from('derivaciones')
    .insert({
      participante_id: participanteId,
      psicologo_id: elegido,
      evento_deteccion_id: eventoId,
    })
    .select('id')
    .single()

  await db.from('eventos').insert({
    participante_id: participanteId,
    tipo: 'derivacion_psicologo',
    metadata: { psicologo_id: elegido, automatica: true },
  })

  return (nueva?.id as string) ?? null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

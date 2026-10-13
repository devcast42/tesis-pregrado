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

  // `derivar: false` lo manda la app en navegador, donde no hay apoyo
  // psicológico: la detección se registra igual —es el dato—, pero no se
  // abre un caso que nadie va a atender ni se corta el check-in.
  const { respuesta_id, derivar: conDerivacion = true } = await req.json()
  if (!respuesta_id) return json({ error: 'falta respuesta_id' }, 400)

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Respuesta
  const { data: respuesta } = await db
    .from('respuestas')
    .select('id, trabajador_id, formulario_clave, formulario_version')
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
      trabajador_id: respuesta.trabajador_id,
      tipo: 'deteccion',
      metadata: {
        metodo: METODO,
        version_umbral: definicion.version_umbral,
        formulario_version: respuesta.formulario_version,
        respuesta_id,
        puntajes,
        umbrales: definicion.umbrales,
        ...(conDerivacion ? {} : { sin_derivar: true }),
      },
    })
    .select('id')
    .single()

  if (!conDerivacion) {
    return json({ detectado: true, metodo: METODO, puntajes, umbrales: definicion.umbrales, derivacion_id: null, sin_derivar: true })
  }

  await db.from('trabajadores').update({ estado: 'detectado' }).eq('id', respuesta.trabajador_id)

  // 6. Derivación automática al psicólogo con menos casos abiertos.
  // Se registra su propia marca de tiempo: el indicador de tiempo de
  // detección puede reportarse con o sin este tramo (ESP-006 §11.2).
  const derivacion = await derivar(db, respuesta.trabajador_id, evento?.id ?? null)

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
  trabajadorId: string,
  eventoId: number | null,
): Promise<string | null> {
  const { data: abierta } = await db
    .from('derivaciones')
    .select('id')
    .eq('trabajador_id', trabajadorId)
    .is('cerrada_en', null)
    .maybeSingle()

  if (abierta) return abierta.id as string

  // La regla vive en la base (`elegir_psicologo`), la misma que usa la cita
  // que pide el trabajador: su psicólogo anterior si puede atenderle; si no,
  // uno de su empresa; si su empresa no tiene, uno general. Sin ninguno
  // disponible no se deriva y el investigador lo ve en su bandeja.
  const { data: elegidoRpc } = await db.rpc('elegir_psicologo', { p_trabajador: trabajadorId })
  if (!elegidoRpc) return null
  const elegido = elegidoRpc as string

  const { data: anterior } = await db
    .from('derivaciones')
    .select('psicologo_id')
    .eq('trabajador_id', trabajadorId)
    .not('cerrada_en', 'is', null)
    .order('cerrada_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nueva } = await db
    .from('derivaciones')
    .insert({
      trabajador_id: trabajadorId,
      psicologo_id: elegido,
      evento_deteccion_id: eventoId,
    })
    .select('id')
    .single()

  await db.from('eventos').insert({
    trabajador_id: trabajadorId,
    tipo: 'derivacion_psicologo',
    metadata: { psicologo_id: elegido, automatica: true, mismo_psicologo: !!anterior && anterior.psicologo_id === elegido },
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

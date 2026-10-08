// Callback de Deepgram — implementa ESP-004 RF-004-05 y RF-004-06.
//
// Deepgram llama aquí cuando termina. Si la transcripción salió bien, se
// dispara la redacción del informe; si no, la sesión queda como fallida y no
// se genera informe (RN-004-05): uno redactado desde media conversación
// puede omitir justo lo importante y parecer completo.

import { json, servicio } from '../_compartido/supabase.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const sesionId = url.searchParams.get('sesion')
  if (!sesionId) return json({ error: 'falta sesion' }, 400)

  const clave = Deno.env.get('WEBHOOK_SECRET')
  if (!clave || url.searchParams.get('clave') !== clave) return json({ error: 'clave invalida' }, 401)

  const db = servicio()
  const cuerpo = await req.json().catch(() => null)

  const texto = cuerpo?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript
    ?? cuerpo?.results?.channels?.[0]?.alternatives?.[0]?.transcript
    ?? null

  if (!texto) {
    await db.from('transcripciones').update({ estado: 'fallida', etapa: 'fallida', detalle: 'Deepgram no devolvió texto (¿audio en silencio?)' }).eq('sesion_id', sesionId)
    return json({ error: 'sin texto en la respuesta' }, 422)
  }

  const { data: transcripcion, error } = await db
    .from('transcripciones')
    .update({
      estado: 'lista',
      etapa: 'redactando',
      detalle: null,
      texto,
      proveedor: 'deepgram-nova-3',
      generada_en: new Date().toISOString(),
    })
    .eq('sesion_id', sesionId)
    .select('id, sesion_id')
    .single()

  if (error) return json({ error: error.message }, 500)

  const { data: sesion } = await db
    .from('sesiones_consulta')
    .select('derivacion_id, derivaciones(trabajador_id)')
    .eq('id', sesionId)
    .single()

  await db.from('eventos').insert({
    trabajador_id: (sesion as any).derivaciones.trabajador_id,
    tipo: 'transcripcion_lista',
    metadata: { sesion_id: sesionId, transcripcion_id: transcripcion.id },
  })

  // Dos redacciones sobre la misma transcripción, en paralelo: el borrador
  // del psicólogo y el resumen del trabajador (RF-004-17). Deepgram ya no
  // vuelve a correr.
  const llamar = (fn: string) => fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sesion_id: sesionId }),
  })
  const [respuesta, resumen] = await Promise.all([
    llamar('redactar-informe'),
    llamar('resumen-trabajador').catch((e) => { console.error('resumen-trabajador', e); return null }),
  ])

  if (!respuesta.ok) {
    const detalle = `No se pudo generar el borrador (${respuesta.status}): ${(await respuesta.text()).slice(0, 200)}`
    await db.from('transcripciones').update({ etapa: 'fallida', detalle }).eq('sesion_id', sesionId)
  }
  return json({ transcrita: true, informe_solicitado: respuesta.ok, resumen_solicitado: !!resumen?.ok })
})

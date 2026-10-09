/** Nota clínica de la sesión — ESP-004 (RF-004-09 … RF-004-12).
 *
 *  El borrador que sale de la transcripción se revisa, se corrige, se valora
 *  y se aprueba; el borrador original no se toca (RN-004-04). Sin grabación,
 *  la misma estructura vacía para escribirla a mano (RF-004-12). La persona
 *  atendida nunca la ve (RN-004-03).
 *
 *  Antes, para llegar al texto había que pasar por cinco bloques —un rótulo,
 *  un título, un aviso de confidencialidad, una «ficha de encuentro» y el
 *  tamizaje OLBI— y cada sección se editaba con un botón Editar/Listo. Y al
 *  aprobar no pasaba nada visible: el informe quedaba aprobado y la pantalla
 *  intentaba volver atrás sin decir nada, así que parecía que el botón no
 *  funcionaba.
 *
 *  Ahora el texto va primero, cada sección se edita tocándola, y aprobar deja
 *  la nota en pantalla con un sello que dice que quedó aprobada y cómo se
 *  valoró, y un botón para volver al caso. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { obtenerSesion, reintentarCircuito } from '../../../modules/consulta/datos'
import {
  abrirInformeManual, aprobarInforme, guardarRevision, obtenerCaso, obtenerInforme, obtenerTranscripcion, VALORACIONES,
  type Caso, type Informe, type Transcripcion, type Valoracion,
} from '../../../modules/psicologo/datos'
import { Tarjeta, haceCuanto } from '../../../modules/psicologo/piezas'
import { Boton, Cargando, OpcionHoja, confirmar } from '../../../modules/nucleo/ui'
import { color, espacio, fuente, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoCheck, IconoNota } from '../../../modules/nucleo/iconos'

/** Secciones que se muestran, en este orden. Las del generador (ESP-004
 *  `redactar-informe`) y las del informe manual conviven: cada informe trae
 *  las suyas. */
const ETIQUETAS: Record<string, string> = {
  motivo: 'Motivo',
  temas_tratados: 'Lo que se conversó',
  situaciones_laborales_mencionadas: 'Situaciones laborales mencionadas',
  recursos_de_apoyo_mencionados: 'Recursos de apoyo mencionados',
  observaciones: 'Observaciones clínicas',
  acuerdos_de_la_sesion: 'Acuerdos y seguimiento',
  citas_textuales_relevantes: 'Citas textuales',
}
const SECCIONES_MANUAL = ['motivo', 'temas_tratados', 'observaciones', 'acuerdos_de_la_sesion']

export default function RevisionInforme() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [informe, setInforme] = useState<Informe | null>(null)
  const [caso, setCaso] = useState<Caso | null>(null)
  const [sesion, setSesion] = useState<any>(null)
  const [transcripcion, setTranscripcion] = useState<Transcripcion | null>(null)
  const [reintentando, setReintentando] = useState(false)
  const [valoracion, setValoracion] = useState<Valoracion | null>(null)
  const [ahoraTick, setAhoraTick] = useState(Date.now())
  const [verTranscripcion, setVerTranscripcion] = useState(false)
  const [nota, setNota] = useState<string>('')
  const [secciones, setSecciones] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()
  // Guardado de la copia de trabajo: cada edición se anota en la base ~1,5 s
  // después de la última tecla, y siempre al pulsar «Listo» o salir.
  const [guardado, setGuardado] = useState<{ estado: 'limpio' | 'pendiente' | 'guardando' | 'guardado' | 'error'; en?: string }>({ estado: 'limpio' })
  const pendiente = useRef<{ informeId: string; contenido: Record<string, string> } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback(async () => {
    const [i, s, tr] = await Promise.all([obtenerInforme(id), obtenerSesion(id), obtenerTranscripcion(id).catch(() => null)])
    setSesion(s); setTranscripcion(tr)
    if (s?.derivacion_id) setCaso(await obtenerCaso(s.derivacion_id).catch(() => null))
    setInforme(i)
    if (i) {
      // Aprobado > copia de trabajo guardada > borrador del modelo. Si hay una
      // edición sin guardar en pantalla, no se pisa con lo que llegue.
      if (pendiente.current?.informeId === i.id) { setCargando(false); return }
      const borrador = i.contenido_borrador as Record<string, unknown>
      const base = (i.contenido_aprobado ?? i.contenido_en_revision ?? borrador) as Record<string, unknown>
      // La nota del borrador no es una sección del informe: es el modelo avisando
      // qué tan completa venía la transcripción.
      setNota(typeof borrador.nota_del_borrador === 'string' ? borrador.nota_del_borrador : '')
      // Siempre en el mismo orden: la base guarda el contenido en jsonb, que
      // reordena las claves, y la nota aprobada salía con «Observaciones»
      // antes que «Lo que se conversó».
      const orden = Object.keys(ETIQUETAS)
      const claves = (Object.keys(base).length > 0 ? Object.keys(base) : SECCIONES_MANUAL)
        .filter((k) => k !== 'nota_del_borrador')
        .sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99))
      const t: Record<string, string> = {}
      for (const clave of claves) t[clave] = aTexto(base[clave])
      setSecciones(t)
      if (i.revisado_en && i.estado !== 'aprobado') setGuardado({ estado: 'guardado', en: i.revisado_en })
    }
    setCargando(false)
  }, [id])

  const guardarAhora = useCallback(async () => {
    if (temporizador.current) { clearTimeout(temporizador.current); temporizador.current = null }
    const p = pendiente.current
    if (!p) return
    setGuardado({ estado: 'guardando' })
    try {
      await guardarRevision(p.informeId, aContenido(p.contenido))
      // Si mientras se guardaba llegó otra tecla, queda pendiente para el siguiente ciclo.
      if (pendiente.current === p) pendiente.current = null
      setGuardado({ estado: 'guardado', en: new Date().toISOString() })
    } catch {
      setGuardado({ estado: 'error' })
    }
  }, [])

  function editar(clave: string, valor: string) {
    if (!informe) return
    const siguiente = { ...secciones, [clave]: valor }
    setSecciones(siguiente)
    pendiente.current = { informeId: informe.id, contenido: siguiente }
    setGuardado({ estado: 'pendiente' })
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(guardarAhora, 1500)
  }

  // Al salir de la pantalla se guarda lo que quede pendiente.
  useFocusEffect(useCallback(() => {
    cargar()
    return () => { if (pendiente.current) guardarAhora() }
  }, [cargar, guardarAhora]))

  // El borrador llega ~30 s después de colgar (subida → transcripción →
  // redacción). Mientras no exista, se vuelve a consultar cada 10 s para que
  // el psicólogo no tenga que salir y volver a entrar.
  useEffect(() => {
    if (informe || cargando) return
    const t = setInterval(() => { cargar(); setAhoraTick(Date.now()) }, 10_000)
    return () => clearInterval(t)
  }, [informe, cargando, cargar])

  async function reintentar() {
    setReintentando(true)
    try {
      const r = await reintentarCircuito(id)
      if (!r.ok) setError(`No se pudo reintentar: ${r.detalle}`)
      await cargar()
    } finally { setReintentando(false) }
  }

  async function empezarManual() {
    setOcupado(true)
    try {
      await abrirInformeManual(id)
      await cargar()
    } catch {
      setError('No se pudo abrir la nota. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  async function aprobar() {
    if (!informe || !valoracion) return
    const ok = await confirmar({
      titulo: 'Aprobar la nota',
      mensaje: 'Quedará registrada a tu nombre y ya no se podrá editar. El borrador original se conserva.',
      aceptar: 'Aprobar',
    })
    if (!ok) return
    setOcupado(true); setError(null)
    try {
      // Lo que se aprueba es exactamente lo que está en pantalla.
      await guardarAhora()
      await aprobarInforme(informe.id, aContenido(secciones), valoracion)
      setEditando(null)
      // Se queda aquí y se recarga: la pantalla pasa a «aprobada» con su
      // sello. Volver atrás sin decir nada era lo que hacía parecer muerto el
      // botón.
      await cargar()
    } catch {
      setError('No se pudo aprobar la nota. Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  function volverAlCaso() {
    if (router.canGoBack()) router.back()
    else if (sesion?.derivacion_id) router.replace(`/psicologo/caso/${sesion.derivacion_id}`)
    else router.replace('/psicologo')
  }

  if (cargando) return <Cargando />

  const codigo = caso?.codigo_anonimo ?? ''
  const aprobado = informe?.estado === 'aprobado'
  const manual = informe?.modelo === 'manual'
  const duracion = sesion?.iniciada_en && sesion?.finalizada_en
    ? Math.max(1, Math.round((new Date(sesion.finalizada_en).getTime() - new Date(sesion.iniciada_en).getTime()) / 60000))
    : null
  const meta = [
    sesion?.iniciada_en ? fechaHora(sesion.iniciada_en) : null,
    duracion ? `${duracion} min` : null,
    manual ? 'escrita a mano' : informe ? 'borrador automático' : null,
  ].filter(Boolean).join(' · ')

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.fondo }} behavior="padding">
      <Stack.Screen options={{ title: codigo ? `Nota · ${codigo}` : 'Nota clínica' }} />
      <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]} keyboardShouldPersistTaps="handled">

        {/* Aprobada: lo primero que se ve es que quedó hecha. */}
        {aprobado && informe && (
          <View style={e.sello}>
            <View style={e.selloIcono}><IconoCheck tamano={14} color="#FFFFFF" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.exito }]}>Nota aprobada</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                {informe.aprobado_en ? `${fechaHora(informe.aprobado_en)} · ` : ''}
                {informe.valoracion && informe.valoracion in VALORACIONES ? VALORACIONES[informe.valoracion as Valoracion] : 'Sin valoración'}
              </Text>
            </View>
          </View>
        )}

        {/* Una línea con lo que antes era una tarjeta entera. */}
        {!!meta && <Text style={[texto.apoyo, { color: color.textoMedio }]}>{meta}</Text>}

        {!!nota && !aprobado && (
          <View style={e.aviso}>
            <IconoNota tamano={14} color={color.textoArena} />
            <Text style={[texto.apoyo, { color: color.textoArena, flex: 1 }]}>{nota}</Text>
          </View>
        )}

        {!!error && <View style={e.error}><Text style={[texto.apoyo, { color: color.tierra }]}>{error}</Text></View>}

        {!informe ? (
          <EstadoCircuito
            sesion={sesion}
            transcripcion={transcripcion}
            ahora={ahoraTick}
            reintentando={reintentando}
            onReintentar={reintentar}
            onManual={empezarManual}
            ocupado={ocupado}
          />
        ) : (
          <>
            {!aprobado && (
              <Text style={[texto.apoyo, { color: color.textoSuave }]}>
                Toca una sección para corregirla. Se guarda sola mientras escribes.
              </Text>
            )}
            {Object.entries(secciones).map(([clave, t]) => (
              <View key={clave} style={[e.seccion, editando === clave && e.seccionEditando]}>
                <Text style={[texto.etiqueta, { color: color.textoSuave }]}>{(ETIQUETAS[clave] ?? clave).toUpperCase()}</Text>
                {editando === clave ? (
                  <TextInput
                    style={e.entrada}
                    value={t}
                    onChangeText={(v) => editar(clave, v)}
                    onBlur={() => { guardarAhora(); setEditando(null) }}
                    multiline
                    autoFocus
                    placeholder="Una línea por punto"
                    placeholderTextColor={color.textoSuave}
                  />
                ) : (
                  <Pressable
                    disabled={aprobado}
                    onPress={() => setEditando(clave)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${ETIQUETAS[clave] ?? clave}`}
                  >
                    <Puntos texto={t} citas={clave === 'citas_textuales_relevantes'} editable={!aprobado} />
                  </Pressable>
                )}
              </View>
            ))}

            {!aprobado && guardado.estado !== 'limpio' && (
              <View style={[e.fila, { gap: 6 }]}>
                {guardado.estado === 'guardado' && <IconoCheck tamano={12} color={color.exito} />}
                <Text style={[texto.apoyo, { color: guardado.estado === 'error' ? color.tierra : color.textoSuave }]}>
                  {guardado.estado === 'guardando' || guardado.estado === 'pendiente' ? 'Guardando…'
                    : guardado.estado === 'error' ? 'No se pudo guardar. Se reintentará al seguir escribiendo.'
                    : `Guardado ${guardado.en ? cuandoGuardado(guardado.en) : ''}. Puedes salir y seguir después.`}
                </Text>
              </View>
            )}
          </>
        )}

        {transcripcion?.texto && (
          <Tarjeta suave>
            <Pressable onPress={() => setVerTranscripcion((v) => !v)} style={[e.fila, { gap: 8 }]} accessibilityRole="button">
              <IconoNota tamano={16} color={color.textoMedio} />
              <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Transcripción</Text>
              <Text style={[texto.apoyo, { color: color.primarioProfundo }]}>{verTranscripcion ? 'Ocultar' : 'Ver'}</Text>
            </Pressable>
            {verTranscripcion && <Text style={[texto.cuerpo, { color: color.textoMedio }]} selectable>{transcripcion.texto.trim()}</Text>}
          </Tarjeta>
        )}

        {informe && !aprobado && (
          <View style={{ gap: espacio.sm, marginTop: espacio.sm }}>
            {/* La única etiqueta de verdad que hay para el burnout: el juicio
                de quien habló con la persona. Obligatoria, porque un campo
                opcional no lo rellena nadie. */}
            <Text style={[texto.etiqueta, { color: color.textoSuave }]}>TU VALORACIÓN</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              ¿Lo que viste es burnout? Solo lo ves tú; queda guardado con la nota.
            </Text>
            {(Object.keys(VALORACIONES) as Valoracion[]).map((k) => (
              <OpcionHoja key={k} texto={VALORACIONES[k]} activa={valoracion === k} onPress={() => setValoracion(k)} />
            ))}
            <View style={{ marginTop: espacio.sm }}>
              <Boton onPress={aprobar} cargando={ocupado} inhabilitado={!valoracion}>
                {valoracion ? 'Aprobar la nota' : 'Elige una valoración para aprobar'}
              </Boton>
            </View>
          </View>
        )}

        {aprobado && <Boton variante="secundario" onPress={volverAlCaso}>Volver al caso</Boton>}

        <Text style={[texto.apoyo, { color: color.textoSuave, textAlign: 'center' }]}>
          La persona atendida nunca ve esta nota, ni tampoco su empresa.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function fechaHora(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
}

/** Dónde está el circuito grabación → audio → transcripción → borrador, cuánto
 *  lleva ahí y, si falló, por qué. Con más de 5 minutos en un paso se ofrece
 *  reintentar; la nota manual siempre está a mano. */
function EstadoCircuito({ sesion, transcripcion, ahora, reintentando, onReintentar, onManual, ocupado }: {
  sesion: any; transcripcion: Transcripcion | null; ahora: number; reintentando: boolean; onReintentar: () => void; onManual: () => void; ocupado: boolean
}) {
  const ambos = !!(sesion?.consentimiento_trabajador && sesion?.consentimiento_psicologo)
  const terminada = !!sesion?.finalizada_en
  const etapa = transcripcion?.etapa ?? (ambos ? 'sin_grabacion' : 'sin_consentimiento')
  const desde = transcripcion ? new Date(transcripcion.actualizada_en).getTime() : (sesion?.finalizada_en ? new Date(sesion.finalizada_en).getTime() : ahora)
  const minutos = Math.max(0, Math.floor((ahora - desde) / 60_000))
  const ATASCO = 5

  const PASOS = [
    { clave: 'grabando', titulo: 'Grabación de audio', en: 'Grabando mientras dura la sesión' },
    { clave: 'audio_subido', titulo: 'Audio guardado', en: 'Subiendo el audio al almacenamiento cifrado' },
    { clave: 'transcribiendo', titulo: 'Transcripción', en: 'Deepgram está transcribiendo (1–3 min)' },
    { clave: 'redactando', titulo: 'Borrador del informe', en: 'Redactando el borrador (menos de 1 min)' },
  ]
  const ORDEN = ['grabando', 'audio_subido', 'transcribiendo', 'lista', 'redactando', 'informe_listo']
  const indice = ORDEN.indexOf(etapa === 'lista' ? 'redactando' : etapa)
  const fallo = etapa === 'fallida'
  const sinGrabacion = etapa === 'sin_grabacion' || etapa === 'sin_consentimiento'
  const atascado = !fallo && !sinGrabacion && indice >= 0 && minutos >= ATASCO && (terminada || etapa !== 'grabando')

  return (
    <Tarjeta>
      <View style={[e.fila, { gap: 8 }]}>
        <IconoNota tamano={16} color={fallo ? color.tierra : color.textoMedio} />
        <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>
          {fallo ? 'El borrador automático falló' : sinGrabacion ? 'Esta sesión no se grabó' : 'Preparando el borrador'}
        </Text>
        {!fallo && !sinGrabacion && <Text style={[texto.apoyo, { color: atascado ? color.tierra : color.textoMedio }]}>{minutos < 1 ? 'hace un momento' : `${minutos} min en este paso`}</Text>}
      </View>

      {sinGrabacion ? (
        <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
          {etapa === 'sin_consentimiento'
            ? 'Faltó una de las dos autorizaciones de grabación, así que no hay audio ni borrador automático.'
            : `Ambos autorizaron, pero la grabación no llegó a iniciarse${transcripcion?.detalle ? ` (${transcripcion.detalle})` : ''}.`}
          {' '}Puedes redactar la nota a mano con la misma estructura.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {PASOS.map((p, i) => {
            const hecho = indice > ORDEN.indexOf(p.clave) || etapa === 'informe_listo'
            const activo = !hecho && ORDEN.indexOf(p.clave) === indice
            const roto = fallo && i === PASOS.findIndex((x) => ORDEN.indexOf(x.clave) >= indiceFallo(transcripcion))
            return (
              <View key={p.clave} style={[e.fila, { gap: 10, alignItems: 'flex-start' }]}>
                <View style={[e.paso, hecho && e.pasoHecho, activo && e.pasoActivo, roto && e.pasoRoto]}>
                  {hecho ? <IconoCheck tamano={9} color="#FFFFFF" /> : <Text style={[texto.dato, { color: roto ? '#FFFFFF' : activo ? color.primarioProfundo : color.textoSuave, fontSize: 10 }]}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[texto.cuerpo, { color: hecho || activo || roto ? color.texto : color.textoSuave }]}>{p.titulo}</Text>
                  {activo && !fallo && <Text style={[texto.apoyo, { color: color.textoMedio }]}>{p.en}</Text>}
                  {roto && !!transcripcion?.detalle && <Text style={[texto.apoyo, { color: color.tierra }]}>{transcripcion.detalle}</Text>}
                </View>
              </View>
            )
          })}
        </View>
      )}

      {(fallo || atascado) && (
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>
          {fallo ? 'Puedes reintentar el paso que falló o escribir la nota a mano.' : `Lleva más de ${ATASCO} minutos en este paso: algo puede haberse perdido por el camino. Reintentar no duplica nada.`}
        </Text>
      )}
      <View style={{ gap: 8 }}>
        {(fallo || atascado) && <Boton onPress={onReintentar} cargando={reintentando}>Reintentar</Boton>}
        <Boton variante="secundario" onPress={onManual} cargando={ocupado}>Redactar nota manual</Boton>
      </View>
      {!fallo && !sinGrabacion && !atascado && <Text style={[texto.apoyo, { color: color.textoSuave }]}>Esta pantalla se actualiza sola cada 10 segundos.</Text>}
    </Tarjeta>
  )
}

/** Para pintar en rojo el paso donde se cayó: el último que llegó a empezar. */
function indiceFallo(t: Transcripcion | null): number {
  const ORDEN = ['grabando', 'audio_subido', 'transcribiendo', 'lista', 'redactando']
  const d = (t?.detalle ?? '').toLowerCase()
  if (d.includes('borrador') || d.includes('modelo')) return ORDEN.indexOf('redactando')
  if (d.includes('deepgram') || d.includes('texto')) return ORDEN.indexOf('transcribiendo')
  if (d.includes('audio') || d.includes('firmar')) return ORDEN.indexOf('audio_subido')
  return 0
}

/** Cada línea del texto es un punto. Las citas van como bloque con la
 *  frase literal y, debajo, el contexto en gris («texto — contexto»). */
function Puntos({ texto: t, citas, editable = true }: { texto: string; citas: boolean; editable?: boolean }) {
  const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lineas.length === 0) return <Text style={[texto.cuerpo, { color: color.textoSuave }]}>{editable ? 'Toca para escribir.' : 'Sin contenido.'}</Text>
  return (
    <View style={{ gap: citas ? 10 : 6 }}>
      {lineas.map((linea, i) => {
        if (citas) {
          const [frase, ...resto] = linea.split(' — ')
          const contexto = resto.join(' — ')
          return (
            <View key={i} style={e.cita}>
              <Text style={[texto.cuerpo, { color: color.texto, fontStyle: 'italic' }]}>«{frase.replace(/^[«"“]|[»"”]$/g, '')}»</Text>
              {!!contexto && <Text style={[texto.apoyo, { color: color.textoMedio, marginTop: 2 }]}>{contexto}</Text>}
            </View>
          )
        }
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={e.vineta} />
            <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>{linea}</Text>
          </View>
        )
      })}
    </View>
  )
}

function cuandoGuardado(iso: string): string {
  const d = new Date(iso)
  // En 24 h: «a. m.» ya acaba en punto y el texto salía «01:23 a. m..».
  if (d.toDateString() === new Date().toDateString()) return `a las ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  return haceCuanto(iso)
}

/** Texto de una sección → lista de puntos (una línea por punto). */
function aContenido(secciones: Record<string, string>): Record<string, unknown> {
  const contenido: Record<string, unknown> = {}
  for (const [clave, t] of Object.entries(secciones)) {
    contenido[clave] = t.split('\n').map((l) => l.trim()).filter(Boolean)
  }
  return contenido
}

function aTexto(valor: unknown): string {
  if (valor == null) return ''
  if (Array.isArray(valor)) {
    return valor
      .map((v) => (typeof v === 'object' && v !== null ? Object.values(v as Record<string, unknown>).join(' — ') : String(v)))
      .join('\n')
  }
  return typeof valor === 'string' ? valor : JSON.stringify(valor)
}

const e = StyleSheet.create({
  contenido: {
    paddingHorizontal: 20, paddingTop: espacio.sm, gap: espacio.md,
    width: '100%', maxWidth: 480, alignSelf: 'center', flexGrow: 1,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  sello: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: color.exitoSuave, borderRadius: radio.lg, padding: espacio.base,
  },
  selloIcono: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.exito, alignItems: 'center', justifyContent: 'center' },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: color.arena, borderRadius: radio.md, padding: 12 },
  error: { backgroundColor: color.tierraSuave, borderRadius: radio.md, padding: 12 },
  seccion: {
    backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base,
    gap: espacio.sm, borderWidth: 1, borderColor: color.borde,
  },
  seccionEditando: { borderColor: color.primario },
  vineta: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.primario, marginTop: 9 },
  paso: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pasoHecho: { backgroundColor: color.primario },
  pasoActivo: { backgroundColor: color.primarioSuave, borderWidth: 1.5, borderColor: color.primario },
  pasoRoto: { backgroundColor: color.tierra },
  cita: { borderLeftWidth: 3, borderLeftColor: color.primarioClaro, paddingLeft: 12, paddingVertical: 2 },
  entrada: {
    minHeight: 120, padding: espacio.sm, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde,
    backgroundColor: color.superficieSuave, fontFamily: fuente.regular, fontSize: 15, lineHeight: 22, color: color.texto, textAlignVertical: 'top',
  },
})

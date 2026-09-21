/** Informe de sesión — implementa ESP-004 (RF-004-09 … RF-004-12).
 *
 *  Diseño: Figma «Informe Clínico». El borrador que generó la transcripción
 *  se revisa sección por sección y se aprueba; el borrador original nunca se
 *  toca (RN-004-04). Si no hubo grabación, la misma estructura vacía para
 *  redacción manual (RF-004-12). El participante nunca lo ve (RN-004-03). */

import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { obtenerSesion, reintentarCircuito } from '../../../modules/consulta/datos'
import {
  abrirInformeManual, aprobarInforme, obtenerCaso, obtenerInforme, obtenerTranscripcion, psicologoActual, type Caso, type Informe, type Transcripcion,
} from '../../../modules/psicologo/datos'
import { BarraUmbral, Pastilla, Tarjeta } from '../../../modules/psicologo/piezas'
import { Boton, Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, fuente, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoCalendario, IconoCheck, IconoEscudo, IconoGrafica, IconoNota, IconoReloj, IconoVideo } from '../../../modules/nucleo/iconos'

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
  const [ahoraTick, setAhoraTick] = useState(Date.now())
  const [verTranscripcion, setVerTranscripcion] = useState(false)
  const [nota, setNota] = useState<string>('')
  const [secciones, setSecciones] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const [i, s, tr] = await Promise.all([obtenerInforme(id), obtenerSesion(id), obtenerTranscripcion(id).catch(() => null)])
    setSesion(s); setTranscripcion(tr)
    if (s?.derivacion_id) setCaso(await obtenerCaso(s.derivacion_id).catch(() => null))
    setInforme(i)
    if (i) {
      const base = (i.contenido_aprobado ?? i.contenido_borrador) as Record<string, unknown>
      // La nota del borrador no es una sección del informe: es el modelo avisando
      // qué tan completa venía la transcripción.
      setNota(typeof base.nota_del_borrador === 'string' ? base.nota_del_borrador : '')
      const claves = (Object.keys(base).length > 0 ? Object.keys(base) : SECCIONES_MANUAL).filter((k) => k !== 'nota_del_borrador')
      const t: Record<string, string> = {}
      for (const clave of claves) t[clave] = aTexto(base[clave])
      setSecciones(t)
    }
    setCargando(false)
  }, [id])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

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
      if (!r.ok) Alert.alert('No se pudo reintentar', r.detalle)
      await cargar()
    } finally { setReintentando(false) }
  }

  async function empezarManual() {
    setOcupado(true)
    try {
      await abrirInformeManual(id)
      await cargar()
    } catch {
      Alert.alert('No se pudo abrir el informe', 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  function aprobar() {
    Alert.alert('Aprobar informe', 'Quedará registrado a tu nombre. El borrador original se conserva sin cambios.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar', onPress: aprobarAhora },
    ])
  }

  async function aprobarAhora() {
    if (!informe) return
    setOcupado(true)
    try {
      const yo = await psicologoActual()
      if (!yo) throw new Error('sin psicólogo')
      const contenido: Record<string, unknown> = {}
      for (const [clave, t] of Object.entries(secciones)) {
        contenido[clave] = t.split('\n').map((l) => l.trim()).filter(Boolean)
      }
      await aprobarInforme(informe.id, contenido, yo.id)
      router.back()
    } catch {
      Alert.alert('No se pudo aprobar', 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) return <Cargando />

  const codigo = caso?.codigo_anonimo ?? ''
  const aprobado = informe?.estado === 'aprobado'
  const manual = informe?.modelo === 'manual'
  const agot = caso?.puntajes?.agotamiento
  const desv = caso?.puntajes?.desvinculacion
  const duracion = sesion?.iniciada_en && sesion?.finalizada_en
    ? Math.max(1, Math.round((new Date(sesion.finalizada_en).getTime() - new Date(sesion.iniciada_en).getTime()) / 60000))
    : null

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
    <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
      <View style={e.fila}>
        <Text style={[texto.etiqueta, { color: color.primarioProfundo, flex: 1 }]}>INVESTIGACIÓN DE BIENESTAR · UNT</Text>
        <Pastilla
          texto={aprobado ? 'Aprobado' : manual ? 'Nota manual' : 'Borrador clínico'}
          fondo={aprobado ? color.exitoSuave : color.arena}
          tinta={aprobado ? color.exito : color.textoArena}
        />
      </View>
      <Text style={texto.titulo}>Informe de sesión{codigo ? ` · ${codigo}` : ''}</Text>

      <View style={e.confidencial}>
        <IconoEscudo tamano={20} color={color.textoArena} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Confidencialidad garantizada</Text>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
            {manual ? 'Nota redactada por ti.' : 'Borrador generado automáticamente.'} Nada se comparte hasta que lo apruebes; el participante nunca lo ve.
          </Text>
        </View>
      </View>

      <Tarjeta>
        <View style={[e.fila, e.separador]}>
          <Text style={[texto.etiqueta, { color: color.textoSuave, flex: 1 }]}>FICHA DE ENCUENTRO</Text>
          <Text style={[texto.dato, { color: color.primarioProfundo }]}>
            {manual ? 'Sin grabación' : informe ? 'Transcripción procesada' : 'Sin informe'}
          </Text>
        </View>
        <View style={e.fila}>
          <View style={[e.fila, { flex: 1 }]}>
            <IconoCalendario tamano={16} color={color.textoMedio} />
            <Text style={[texto.cuerpo, { color: color.texto }]}>{sesion?.iniciada_en ? fechaHora(sesion.iniciada_en) : '—'}</Text>
          </View>
          <View style={e.fila}>
            <IconoReloj tamano={16} color={color.textoMedio} />
            <Text style={[texto.cuerpo, { color: color.texto }]}>{duracion ? `Duración: ${duracion} min` : 'En curso'}</Text>
          </View>
        </View>
        <View style={e.fila}>
          <IconoVideo tamano={16} color={color.textoMedio} />
          <Text style={[texto.cuerpo, { color: color.texto }]}>Modalidad: Videollamada de apoyo</Text>
        </View>
      </Tarjeta>

      {!!nota && !aprobado && (
        <Tarjeta suave>
          <View style={[e.fila, { gap: 8 }]}>
            <IconoNota tamano={16} color={color.textoArena} />
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Nota del borrador</Text>
          </View>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{nota}</Text>
        </Tarjeta>
      )}

      {transcripcion?.texto && (
        <Tarjeta suave>
          <Pressable onPress={() => setVerTranscripcion((v) => !v)} style={[e.fila, { gap: 8 }]}>
            <IconoNota tamano={16} color={color.textoMedio} />
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Transcripción de la sesión</Text>
            <Text style={[texto.apoyo, { color: color.primarioProfundo }]}>{verTranscripcion ? 'Ocultar' : 'Ver'}</Text>
          </Pressable>
          {verTranscripcion && <Text style={[texto.cuerpo, { color: color.textoMedio }]} selectable>{transcripcion.texto.trim()}</Text>}
          <Text style={[texto.apoyo, { color: color.textoSuave }]}>Solo tú la ves. Se borra junto con el audio al vencer el plazo de retención.</Text>
        </Tarjeta>
      )}

      {(typeof agot === 'number' || typeof desv === 'number') && (
        <Tarjeta suave>
          <View style={[e.fila, { gap: 8 }]}>
            <IconoGrafica tamano={16} color={color.textoMedio} />
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>TAMIZAJE OLBI PREVIO</Text>
          </View>
          {typeof agot === 'number' && <BarraUmbral dimension="agotamiento" puntaje={agot} umbral={caso?.umbrales?.agotamiento} />}
          {typeof desv === 'number' && <BarraUmbral dimension="desvinculacion" puntaje={desv} umbral={caso?.umbrales?.desvinculacion} />}
        </Tarjeta>
      )}

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
        Object.entries(secciones).map(([clave, t], i) => (
          <Tarjeta key={clave}>
            <View style={e.fila}>
              <View style={e.numero}><Text style={[texto.dato, { color: color.textoMedio }]}>{i + 1}</Text></View>
              <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>{ETIQUETAS[clave] ?? clave}</Text>
              {!aprobado && (
                <Pressable onPress={() => setEditando(editando === clave ? null : clave)} style={e.editar} accessibilityRole="button">
                  <IconoNota tamano={14} color={color.primarioProfundo} />
                  <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>{editando === clave ? 'Listo' : 'Editar'}</Text>
                </Pressable>
              )}
            </View>
            {editando === clave ? (
              <TextInput
                style={e.entrada}
                value={t}
                onChangeText={(v) => setSecciones((s) => ({ ...s, [clave]: v }))}
                multiline
                autoFocus
                placeholder="Una línea por punto"
                placeholderTextColor={color.textoSuave}
              />
            ) : (
              <Puntos texto={t} citas={clave === 'citas_textuales_relevantes'} />
            )}
          </Tarjeta>
        ))
      )}

      {informe && !aprobado && (
        <Text style={[texto.apoyo, { color: color.textoSuave, paddingHorizontal: 4 }]}>
          {manual
            ? 'Esta nota no tiene borrador automático: lo que escribas es la versión final.'
            : 'Si no hubo grabación de audio, esta misma estructura se presenta vacía para redacción manual directa.'}
        </Text>
      )}

      {informe && (aprobado ? (
        <Text style={[texto.apoyo, { color: color.textoMedio, textAlign: 'center' }]}>
          Informe aprobado. El borrador original se conserva sin cambios.
        </Text>
      ) : (
        <Boton onPress={aprobar} cargando={ocupado}>Aprobar informe</Boton>
      ))}
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
  const ambos = !!(sesion?.consentimiento_participante && sesion?.consentimiento_psicologo)
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
function Puntos({ texto: t, citas }: { texto: string; citas: boolean }) {
  const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lineas.length === 0) return <Text style={[texto.cuerpo, { color: color.textoSuave }]}>Sin contenido. Toca «Editar» para escribir.</Text>
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
  contenido: { padding: 20, paddingBottom: espacio.xxl, gap: espacio.md, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.fondo, flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  separador: { paddingBottom: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde },
  confidencial: { flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start', backgroundColor: color.arena, borderRadius: radio.xl, padding: espacio.md },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  vineta: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.primario, marginTop: 9 },
  paso: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pasoHecho: { backgroundColor: color.primario },
  pasoActivo: { backgroundColor: color.primarioSuave, borderWidth: 1.5, borderColor: color.primario },
  pasoRoto: { backgroundColor: color.tierra },
  cita: { borderLeftWidth: 3, borderLeftColor: color.primarioClaro, paddingLeft: 12, paddingVertical: 2 },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radio.md, backgroundColor: color.superficieSuave },
  entrada: {
    minHeight: 120, padding: espacio.sm, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde,
    backgroundColor: color.superficieSuave, fontFamily: fuente.regular, fontSize: 15, lineHeight: 22, color: color.texto, textAlignVertical: 'top',
  },
})

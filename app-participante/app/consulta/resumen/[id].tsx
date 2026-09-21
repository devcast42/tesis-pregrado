/** Resumen de la sesión para el participante — implementa ESP-004 RF-004-17.
 *
 *  Se abre al salir de la videollamada. Muestra el circuito paso a paso
 *  (procesar la conversación → recomendaciones con IA → PDF) y, al final, el
 *  botón para descargar. Si cierra antes, el resumen lo espera en Apoyo. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { abrirPdf, solicitarResumen, type EstadoResumen } from '../../../modules/consulta/resumen'
import { Boton } from '../../../modules/nucleo/ui'
import { IconoCandado, IconoCheck, IconoCerrar } from '../../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

const PASOS = [
  { clave: 'fin', titulo: 'Sesión finalizada' },
  { clave: 'conversacion', titulo: 'Procesando la conversación' },
  { clave: 'ia', titulo: 'Generando recomendaciones con IA' },
  { clave: 'pdf', titulo: 'Preparando tu PDF' },
] as const

/** Índice del paso en curso según lo que responde el servidor. */
function pasoActual(r: EstadoResumen | null): number {
  // Sin respuesta aún: la primera llamada puede estar redactando ya (tarda
  // 10–20 s), así que se muestra el circuito en marcha, no en cero.
  if (!r) return 1
  if (r.etapa === 'listo') return PASOS.length
  if (r.etapa === 'generando_pdf') return 3
  if (r.etapa === 'redactando') return 2
  if (!r.sesion_finalizada) return 0
  return 1
}

export default function ResumenSesion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [estado, setEstado] = useState<EstadoResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [inicio] = useState(Date.now())
  const [, setTick] = useState(0)
  const vivo = useRef(true)

  const consultar = useCallback(async () => {
    try {
      const r = await solicitarResumen(id)
      if (vivo.current) { setEstado(r); setError(null) }
      return r
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : 'Sin conexión')
      return null
    }
  }, [id])

  // Primera consulta al abrir; luego cada 6 s hasta que esté listo o falle.
  useEffect(() => {
    vivo.current = true
    let temporizador: ReturnType<typeof setTimeout> | null = null
    const ciclo = async () => {
      const r = await consultar()
      setTick((t) => t + 1)
      if (!vivo.current) return
      if (r?.etapa === 'listo' || r?.etapa === 'fallido') return
      temporizador = setTimeout(ciclo, 6000)
    }
    ciclo()
    return () => { vivo.current = false; if (temporizador) clearTimeout(temporizador) }
  }, [consultar])

  async function descargar() {
    if (!estado?.pdf_ruta) return
    setAbriendo(true)
    try { await abrirPdf(estado.pdf_ruta) } catch (e) {
      Alert.alert('No se pudo abrir', e instanceof Error ? e.message : 'Inténtalo de nuevo.')
    } finally { setAbriendo(false) }
  }

  const listo = estado?.etapa === 'listo'
  const fallido = estado?.etapa === 'fallido'
  const actual = pasoActual(estado)
  const minutos = Math.floor((Date.now() - inicio) / 60000)

  const subtitulo = listo
    ? (estado?.origen === 'general'
      ? 'Esta sesión no se grabó, así que preparamos recomendaciones generales de autocuidado.'
      : 'Tu resumen está listo: lo que conversaste, lo que acordaste y algunas ideas para los próximos días.')
    : fallido
      ? 'No pudimos preparar tu resumen esta vez. Puedes reintentarlo ahora o más tarde desde Apoyo.'
      : 'Estamos preparando un resumen personal con recomendaciones. Suele tardar entre uno y tres minutos; si cierras, te esperará en Apoyo.'

  return (
    <View style={[e.fondo, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={e.contenido}>
        <View style={e.tarjeta}>
          <View style={e.cabecera}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>TU RESUMEN DE LA SESIÓN</Text>
              <Text style={[texto.titulo, { color: color.texto }]}>{listo ? 'Listo para ti' : fallido ? 'Algo no salió bien' : 'Un momento…'}</Text>
            </View>
            <Pressable onPress={() => router.replace('/hoy')} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <IconoCerrar tamano={18} color={color.textoMedio} />
            </Pressable>
          </View>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{subtitulo}</Text>

          <View style={e.pasos}>
            {PASOS.map((p, i) => {
              const hecho = i < actual || listo
              const enCurso = !listo && !fallido && i === actual
              const fallo = fallido && i === actual
              return (
                <View key={p.clave} style={e.paso}>
                  <View style={[e.punto, hecho && e.puntoHecho, enCurso && e.puntoActual, fallo && e.puntoFallo]}>
                    {hecho ? <IconoCheck tamano={10} color="#FFFFFF" />
                      : enCurso ? <ActivityIndicator size="small" color={color.primarioProfundo} />
                      : fallo ? <IconoCerrar tamano={12} color="#FFFFFF" />
                      : <View style={e.puntoVacio} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[texto.cuerpoFuerte, { color: hecho || enCurso || fallo ? color.texto : color.textoSuave }]}>{p.titulo}</Text>
                    {enCurso && i === 1 && (
                      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                        {!estado ? 'Revisando cómo quedó la sesión…'
                          : estado.transcripcion_etapa === 'transcribiendo' ? 'Transcribiendo el audio de la sesión.'
                          : estado.transcripcion_etapa === 'grabando' || estado.transcripcion_etapa === 'audio_subido' ? 'Recibiendo el audio de la sesión.'
                          : estado.detalle ?? 'Esperando el audio de la sesión.'}
                        {minutos >= 5 ? ' Está tardando más de lo habitual; puedes cerrar y volver desde Apoyo.' : ''}
                      </Text>
                    )}
                    {enCurso && i === 0 && (
                      <Text style={[texto.apoyo, { color: color.textoMedio }]}>Esperando a que el profesional cierre la sala.</Text>
                    )}
                    {fallo && !!estado?.detalle && <Text style={[texto.apoyo, { color: color.tierra }]}>{estado.detalle}</Text>}
                  </View>
                </View>
              )
            })}
          </View>

          {!!error && <Text style={[texto.apoyo, { color: color.tierra }]}>{error}</Text>}

          {listo ? (
            <Boton onPress={descargar} cargando={abriendo}>Descargar mi resumen en PDF</Boton>
          ) : fallido ? (
            <Boton onPress={consultar}>Reintentar</Boton>
          ) : null}
          <Boton variante="texto" onPress={() => router.replace('/hoy')}>{listo ? 'Volver al inicio' : 'Cerrar y seguir después'}</Boton>

          <View style={e.privacidad}>
            <IconoCandado tamano={13} color={color.textoMedio} />
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              Este resumen es solo tuyo: no es el informe del psicólogo, tu empresa no lo recibe y el estudio no lo usa como dato. Las recomendaciones se generan con IA y no son un diagnóstico.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.55)', justifyContent: 'center' },
  contenido: { flexGrow: 1, justifyContent: 'center', padding: espacio.lg },
  tarjeta: { backgroundColor: color.superficie, borderRadius: 28, padding: espacio.lg, gap: espacio.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm },
  cerrar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  pasos: { gap: espacio.sm, paddingVertical: espacio.xs },
  paso: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm },
  punto: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  puntoHecho: { backgroundColor: color.primario },
  puntoActual: { backgroundColor: color.primarioSuave },
  puntoFallo: { backgroundColor: color.peligro },
  puntoVacio: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.puntoFuturo },
  privacidad: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.sm },
})

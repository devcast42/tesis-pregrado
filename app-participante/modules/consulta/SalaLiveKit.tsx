/** Sala LiveKit — implementación nativa (iOS/Android).
 *  Implementa ESP-004 RF-004-01. Diseño: Figma «En la Videollamada».
 *
 *  ⚠️ NO IMPORTAR ESTE ARCHIVO DIRECTAMENTE. Se carga desde `Llamada.tsx`
 *  con un require dentro de un try: los imports de abajo arrastran el módulo
 *  nativo de WebRTC, que no existe en Expo Go, y un import estático haría
 *  caer la pantalla al cargarse en lugar de mostrar un aviso.
 *
 *  Pantalla oscura: la persona al otro lado ocupa todo; el propio video va
 *  pequeño en una esquina y al tocarlo se intercambian. Los controles al
 *  alcance del pulgar; micrófono y cámara apagados se ven en rojo y tachados
 *  para que no quede duda. «Finalizar» es claro pero no rojo. */

import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  registerGlobals,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/react-native'
import { Track } from 'livekit-client'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { color, fuente } from '../nucleo/diseno'
import { IconoCandado, IconoColgar, IconoMicrofono, IconoMicrofonoTachado, IconoVideo, IconoVideoTachado } from '../nucleo/iconos'
import type { PropsLlamada } from './tipos'

// Instala los polyfills de WebRTC. Debe correr antes de conectar.
registerGlobals()

export function SalaLiveKit({ url, token, onSalir, onFallo, etiqueta, grabando }: PropsLlamada) {
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let vigente = true
    AudioSession.startAudioSession()
      .then(() => vigente && setListo(true))
      .catch(() => vigente && setListo(true))

    return () => {
      vigente = false
      AudioSession.stopAudioSession()
    }
  }, [])

  if (!listo) {
    return (
      <View style={e.centro}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  return (
    <View style={e.sala}>
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio
        video
        onDisconnected={onSalir}
        // Un fallo de conexión (sala cerrada, misma identidad conectada desde
        // otro dispositivo, red caída) se dice en palabras y se sale; sin
        // esto LiveKit lo lanza a consola y en desarrollo aparece la
        // pantalla roja.
        onError={(error) => {
          Alert.alert(
            'No se pudo conectar a la sala',
            /leave|mismatch|duplicate/i.test(String(error?.message))
              ? 'Parece que ya estás conectado a esta sala desde otro dispositivo. Cierra la sesión allí y vuelve a entrar.'
              : 'Revisa tu conexión e inténtalo de nuevo.',
            [{ text: 'Volver', onPress: onFallo ?? onSalir }],
          )
        }}
      >
        <Escena onSalir={onSalir} etiqueta={etiqueta} grabando={grabando} />
      </LiveKitRoom>
    </View>
  )
}

function Escena({ onSalir, etiqueta, grabando }: Pick<PropsLlamada, 'onSalir' | 'etiqueta' | 'grabando'>) {
  const pistas = useTracks([Track.Source.Camera])
  const remotos = useRemoteParticipants()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant()
  const [inicio] = useState(() => Date.now())
  const insets = useSafeAreaInsets()
  const [transcurrido, setTranscurrido] = useState('00:00')

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000)
      setTranscurrido(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(t)
  }, [inicio])

  const remota = pistas.find((p) => !p.participant.isLocal)
  const propia = pistas.find((p) => p.participant.isLocal)
  const enCurso = remotos.length > 0
  // Tocar la miniatura intercambia cuál se ve en grande.
  const [intercambiado, setIntercambiado] = useState(false)
  const grande = intercambiado ? propia : remota
  const chica = intercambiado ? remota : propia
  const grandeEsPropia = intercambiado

  return (
    <View style={e.sala}>
      {grande ? (
        <VideoTrack trackRef={grande} style={e.videoRemoto} objectFit="cover" mirror={grandeEsPropia} zOrder={0} />
      ) : (
        <View style={[e.videoRemoto, e.centro]}>
          {grandeEsPropia ? (
            <><IconoVideoTachado tamano={28} color="rgba(255,255,255,0.7)" /><Text style={e.espera}>Tu cámara está apagada</Text></>
          ) : enCurso ? (
            // La otra persona está conectada pero no envía video: cámara apagada o sin permiso.
            <><IconoVideoTachado tamano={28} color="rgba(255,255,255,0.7)" /><Text style={e.espera}>La otra persona tiene la cámara apagada</Text><Text style={e.esperaSub}>El audio sigue funcionando</Text></>
          ) : (
            <><ActivityIndicator color="rgba(255,255,255,0.7)" /><Text style={e.espera}>Esperando a la otra persona…</Text>{etiqueta && <Text style={e.esperaSub}>{etiqueta}</Text>}</>
          )}
        </View>
      )}

      {/* Cabecera: quién y estado */}
      <View style={[e.cabecera, { top: 24 + insets.top }]}>
        <View style={{ flex: 1, gap: 4 }}>
          {etiqueta && <Text style={e.codigo}>{etiqueta}</Text>}
          <View style={e.fila}>
            <View style={[e.punto, { backgroundColor: enCurso ? color.primarioClaro : color.textoSuave }]} />
            <Text style={e.estado}>{enCurso ? 'EN CURSO' : 'ESPERANDO'} · {transcurrido}</Text>
          </View>
        </View>
        <Pressable onPress={() => setIntercambiado((v) => !v)} style={e.propio} accessibilityRole="button" accessibilityLabel="Intercambiar videos">
          {chica ? (
            // zOrder=1: en Android cada video es una superficie propia; sin esto la
            // miniatura queda debajo del video grande y se ve vacía.
            <VideoTrack trackRef={chica} style={e.videoPropio} objectFit="cover" mirror={!grandeEsPropia} zOrder={1} />
          ) : (
            <View style={[e.videoPropio, e.centro, { backgroundColor: '#2A2E33' }]}><IconoVideoTachado tamano={20} color="rgba(255,255,255,0.6)" /></View>
          )}
          {Platform.OS === 'android' && <MascaraRedondeada ancho={MINI_ANCHO} alto={MINI_ALTO} radio={MINI_RADIO} />}
          <Text style={e.propioEtiqueta}>{grandeEsPropia ? (etiqueta ?? 'Psicólogo') : 'Tú'}</Text>
        </Pressable>
      </View>

      {grabando && (
        <View style={e.grabando}>
          <View style={[e.punto, { backgroundColor: '#E8A87C' }]} />
          <IconoMicrofono tamano={14} color="#FFFFFF" />
          <Text style={e.grabandoTexto}>Transcripción clínica confidencial activa</Text>
        </View>
      )}

      {/* Controles */}
      <View style={[e.controles, { bottom: 64 + insets.bottom }]}>
        <Control
          activo={isMicrophoneEnabled}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          etiqueta={isMicrophoneEnabled ? 'Silenciar' : 'Activar micrófono'}
        >
          {isMicrophoneEnabled ? <IconoMicrofono tamano={22} color="#FFFFFF" /> : <IconoMicrofonoTachado tamano={22} color="#FFFFFF" />}
        </Control>
        <Control
          activo={isCameraEnabled}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          etiqueta={isCameraEnabled ? 'Apagar cámara' : 'Encender cámara'}
        >
          {isCameraEnabled ? <IconoVideo tamano={22} color="#FFFFFF" /> : <IconoVideoTachado tamano={22} color="#FFFFFF" />}
        </Control>
        <Pressable onPress={onSalir} style={e.finalizar} accessibilityRole="button" accessibilityLabel="Finalizar sesión">
          <IconoColgar tamano={20} color="#FFFFFF" />
          <Text style={e.finalizarTexto}>Finalizar</Text>
        </Pressable>
      </View>
      <View style={[e.fila, e.pie, { bottom: 24 + insets.bottom }]}>
        <IconoCandado tamano={11} color="rgba(255,255,255,0.55)" />
        <Text style={e.pieTexto}>CANAL CIFRADO DE EXTREMO A EXTREMO</Text>
      </View>
    </View>
  )
}

const MINI_ANCHO = 96, MINI_ALTO = 128, MINI_RADIO = 16

/** En Android el video es una superficie nativa que ignora el recorte
 *  redondeado del contenedor. Las vistas normales sí se pintan encima, así que
 *  se tapa lo que sobra: un SVG del tamaño de la miniatura relleno del color
 *  de fondo con un agujero redondeado (regla evenodd) y el borde encima. */
function MascaraRedondeada({ ancho, alto, radio }: { ancho: number; alto: number; radio: number }) {
  const r = radio
  const interior = `M${r} 0 H${ancho - r} A${r} ${r} 0 0 1 ${ancho} ${r} V${alto - r} A${r} ${r} 0 0 1 ${ancho - r} ${alto} H${r} A${r} ${r} 0 0 1 0 ${alto - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M0 0 H${ancho} V${alto} H0 Z ${interior}`} fill="#14171A" fillRule="evenodd" />
      <Rect x={0.5} y={0.5} width={ancho - 1} height={alto - 1} rx={r} ry={r} stroke="rgba(255,255,255,0.28)" strokeWidth={1} fill="none" />
    </Svg>
  )
}

function Control({ activo, onPress, etiqueta, children }: { activo: boolean; onPress: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={[e.control, !activo && e.controlApagado]} accessibilityRole="button" accessibilityLabel={etiqueta}>
      {children}
    </Pressable>
  )
}

const e = StyleSheet.create({
  sala: { flex: 1, backgroundColor: '#14171A' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14171A', gap: 6 },
  videoRemoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  espera: { color: '#FFFFFF', fontFamily: fuente.media, fontSize: 16 },
  esperaSub: { color: 'rgba(255,255,255,0.6)', fontFamily: fuente.regular, fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cabecera: { position: 'absolute', top: 24, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  codigo: { color: '#FFFFFF', fontFamily: fuente.fuerte, fontSize: 20 },
  estado: { color: color.primarioClaro, fontFamily: fuente.media, fontSize: 12, letterSpacing: 1 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  propio: { width: 96, height: 128, borderRadius: 16, overflow: 'hidden', backgroundColor: '#2A2E33', borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: 'rgba(255,255,255,0.25)' },
  videoPropio: { width: '100%', height: '100%' },
  propioEtiqueta: {
    position: 'absolute', bottom: 8, left: 8, color: '#FFFFFF', fontFamily: fuente.media, fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  grabando: {
    position: 'absolute', top: 172, left: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  grabandoTexto: { color: '#FFFFFF', fontFamily: fuente.media, fontSize: 13 },
  controles: { position: 'absolute', bottom: 64, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  control: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  // Apagado = rojo lleno con el icono tachado: es el único rojo de la app además de los errores, y aquí significa lo mismo: «algo no está funcionando».
  controlApagado: { backgroundColor: '#B91C1C' },
  finalizar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 60, paddingHorizontal: 26, borderRadius: 30, backgroundColor: '#A8663D' },
  finalizarTexto: { color: '#FFFFFF', fontFamily: fuente.fuerte, fontSize: 17 },
  pie: { position: 'absolute', bottom: 24, left: 0, right: 0, justifyContent: 'center' },
  pieTexto: { color: 'rgba(255,255,255,0.55)', fontFamily: fuente.media, fontSize: 11, letterSpacing: 1.2 },
})

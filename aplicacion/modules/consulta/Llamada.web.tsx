/** Videollamada — implementación para navegador.
 *  Implementa ESP-004 RF-004-01.
 *
 *  `@livekit/react-native` no tiene build de navegador: depende de
 *  react-native-webrtc, que solo existe en nativo. En web se usa
 *  `livekit-client` directamente contra elementos <video> del DOM.
 *  Metro resuelve este archivo por la extensión `.web`.
 *
 *  Misma lógica que la sala nativa: la otra persona en grande, uno mismo en
 *  la miniatura (clic para intercambiar), micrófono y cámara con estado
 *  apagado en rojo y tachado, y un aviso claro cuando la otra persona no
 *  envía video. */

import { createElement, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fuente } from '../nucleo/diseno'
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type LocalTrackPublication,
} from 'livekit-client'
import { IconoCandado, IconoColgar, IconoMicrofono, IconoMicrofonoTachado, IconoVideo, IconoVideoTachado } from '../nucleo/iconos'
import type { PropsLlamada } from './tipos'

export function Llamada({ url, token, onSalir, etiqueta, grabando }: PropsLlamada) {
  const grande = useRef<HTMLVideoElement | null>(null)
  const chica = useRef<HTMLVideoElement | null>(null)
  const sala = useRef<Room | null>(null)
  const pistaRemota = useRef<RemoteTrack | null>(null)
  const pistaPropia = useRef<Track | null>(null)
  const [conectado, setConectado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayRemoto, setHayRemoto] = useState(false)
  const [videoRemoto, setVideoRemoto] = useState(false)
  const [videoPropio, setVideoPropio] = useState(false)
  const [micActivo, setMicActivo] = useState(true)
  const [camActiva, setCamActiva] = useState(true)
  const [intercambiado, setIntercambiado] = useState(false)
  const [audioBloqueado, setAudioBloqueado] = useState(false)
  const [transcurrido, setTranscurrido] = useState('00:00')
  const [inicio] = useState(() => Date.now())

  // Qué pista va en cada <video>. Se recalcula al cambiar pistas o al intercambiar.
  function colocar() {
    const enGrande = intercambiado ? pistaPropia.current : pistaRemota.current
    const enChica = intercambiado ? pistaRemota.current : pistaPropia.current
    for (const p of [pistaRemota.current, pistaPropia.current]) p?.detach()
    if (enGrande && grande.current) enGrande.attach(grande.current)
    if (enChica && chica.current) enChica.attach(chica.current)
  }
  useEffect(() => { colocar() }, [intercambiado, videoRemoto, videoPropio, conectado])

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000)
      setTranscurrido(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(t)
  }, [inicio])

  useEffect(() => {
    let vigente = true
    const room = new Room({ adaptiveStream: true, dynacast: true })
    sala.current = room

    const actualizarRemotos = () => vigente && setHayRemoto(room.remoteParticipants.size > 0)

    room
      .on(RoomEvent.TrackSubscribed, (pista: RemoteTrack) => {
        if (pista.kind === Track.Kind.Video) { pistaRemota.current = pista; setVideoRemoto(true) }
        if (pista.kind === Track.Kind.Audio) pista.attach()
      })
      .on(RoomEvent.TrackUnsubscribed, (pista: RemoteTrack) => {
        if (pista.kind === Track.Kind.Video) { pista.detach(); pistaRemota.current = null; setVideoRemoto(false) }
      })
      // La otra persona apagó o encendió su cámara sin dejar de publicar.
      .on(RoomEvent.TrackMuted, (pub) => { if (pub.kind === Track.Kind.Video && !(pub as RemoteTrackPublication).isLocal) setVideoRemoto(false) })
      .on(RoomEvent.TrackUnmuted, (pub) => { if (pub.kind === Track.Kind.Video && !(pub as RemoteTrackPublication).isLocal) setVideoRemoto(!!pistaRemota.current) })
      .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        if (pub.kind === Track.Kind.Video && pub.track) { pistaPropia.current = pub.track; setVideoPropio(true) }
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.kind === Track.Kind.Video) { pub.track?.detach(); pistaPropia.current = null; setVideoPropio(false) }
      })
      // Safari (sobre todo en iPhone) no deja reproducir audio sin un toque de la
      // persona: LiveKit avisa y `startAudio` se llama desde ese toque.
      .on(RoomEvent.AudioPlaybackStatusChanged, () => vigente && setAudioBloqueado(!room.canPlaybackAudio))
      .on(RoomEvent.ParticipantConnected, actualizarRemotos)
      .on(RoomEvent.ParticipantDisconnected, actualizarRemotos)
      .on(RoomEvent.Disconnected, () => vigente && onSalir())

    room
      .connect(url, token)
      .then(async () => {
        actualizarRemotos()
        // Sin cámara o micrófono (permiso denegado) se entra igual: se avisa en los controles.
        try { await room.localParticipant.setMicrophoneEnabled(true) } catch { setMicActivo(false) }
        try { await room.localParticipant.setCameraEnabled(true) } catch { setCamActiva(false) }
        if (vigente) setConectado(true)
      })
      .catch(() => vigente && setError('No se pudo conectar a la sesión.'))

    return () => {
      vigente = false
      room.disconnect()
    }
  }, [url, token, onSalir])

  async function alternarMic() {
    const room = sala.current; if (!room) return
    try { await room.localParticipant.setMicrophoneEnabled(!micActivo); setMicActivo(!micActivo) } catch { setMicActivo(false) }
  }
  async function alternarCam() {
    const room = sala.current; if (!room) return
    try {
      await room.localParticipant.setCameraEnabled(!camActiva)
      setCamActiva(!camActiva)
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera)
      pistaPropia.current = !camActiva && pub?.track ? pub.track : null
      setVideoPropio(!camActiva && !!pub?.track)
    } catch { setCamActiva(false) }
  }
  function colgar() {
    sala.current?.disconnect()
    onSalir()
  }

  const grandeEsPropia = intercambiado
  const grandeTieneVideo = grandeEsPropia ? videoPropio && camActiva : videoRemoto
  const chicaTieneVideo = grandeEsPropia ? videoRemoto : videoPropio && camActiva
  const estado = sala.current?.state === ConnectionState.Connected && hayRemoto ? 'EN CURSO' : 'ESPERANDO'

  return (
    <View style={estilos.sala}>
      <View style={estilos.escenario}>
        {createElement('video', {
          ref: grande, autoPlay: true, playsInline: true, muted: grandeEsPropia,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: grandeEsPropia ? 'scaleX(-1)' : undefined, display: grandeTieneVideo ? 'block' : 'none' },
        })}
        {!grandeTieneVideo && (
          <View style={estilos.centro}>
            <IconoVideoTachado tamano={30} color="rgba(255,255,255,0.7)" />
            <Text style={estilos.espera}>
              {error ? error : grandeEsPropia ? 'Tu cámara está apagada' : hayRemoto ? 'La otra persona tiene la cámara apagada' : conectado ? 'Esperando a la otra persona…' : 'Conectando…'}
            </Text>
            {!grandeEsPropia && hayRemoto && !error && <Text style={estilos.esperaSub}>El audio sigue funcionando</Text>}
          </View>
        )}

        {audioBloqueado && (
          <Pressable
            onPress={() => { sala.current?.startAudio().then(() => setAudioBloqueado(false)).catch(() => {}) }}
            style={estilos.activarAudio}
            accessibilityRole="button"
            accessibilityLabel="Activar el audio de la sesión"
          >
            <IconoMicrofono tamano={18} color="#FFFFFF" />
            <Text style={estilos.activarAudioTexto}>Toca para activar el audio</Text>
          </Pressable>
        )}

        {/* Cabecera */}
        <View style={estilos.cabecera}>
          <View style={{ flex: 1, gap: 4 }}>
            {etiqueta && <Text style={estilos.codigo}>{etiqueta}</Text>}
            <View style={estilos.fila}>
              <View style={[estilos.punto, { backgroundColor: estado === 'EN CURSO' ? '#7FD1B9' : 'rgba(255,255,255,0.4)' }]} />
              <Text style={estilos.estado}>{estado} · {transcurrido}</Text>
            </View>
            {grabando && (
              <View style={[estilos.fila, estilos.grabando]}>
                <View style={[estilos.punto, { backgroundColor: '#E8A87C' }]} />
                <Text style={estilos.grabandoTexto}>Grabando audio · transcripción clínica confidencial</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => setIntercambiado((v) => !v)} style={estilos.miniatura} accessibilityRole="button" accessibilityLabel="Intercambiar videos">
            {createElement('video', {
              ref: chica, autoPlay: true, playsInline: true, muted: !grandeEsPropia,
              style: { width: '100%', height: '100%', objectFit: 'cover', transform: !grandeEsPropia ? 'scaleX(-1)' : undefined, display: chicaTieneVideo ? 'block' : 'none' },
            })}
            {!chicaTieneVideo && <View style={[estilos.centro, { backgroundColor: '#2A2E33' }]}><IconoVideoTachado tamano={20} color="rgba(255,255,255,0.6)" /></View>}
            <Text style={estilos.miniaturaEtiqueta}>{grandeEsPropia ? (etiqueta ?? 'Trabajador') : 'Tú'}</Text>
          </Pressable>
        </View>

        {/* Controles */}
        <View style={estilos.controles}>
          <Pressable onPress={alternarMic} style={[estilos.control, !micActivo && estilos.controlApagado]} accessibilityRole="button" accessibilityLabel={micActivo ? 'Silenciar' : 'Activar micrófono'}>
            {micActivo ? <IconoMicrofono tamano={22} color="#FFFFFF" /> : <IconoMicrofonoTachado tamano={22} color="#FFFFFF" />}
          </Pressable>
          <Pressable onPress={alternarCam} style={[estilos.control, !camActiva && estilos.controlApagado]} accessibilityRole="button" accessibilityLabel={camActiva ? 'Apagar cámara' : 'Encender cámara'}>
            {camActiva ? <IconoVideo tamano={22} color="#FFFFFF" /> : <IconoVideoTachado tamano={22} color="#FFFFFF" />}
          </Pressable>
          <Pressable onPress={colgar} style={estilos.finalizar} accessibilityRole="button" accessibilityLabel="Finalizar sesión">
            <IconoColgar tamano={20} color="#FFFFFF" />
            <Text style={estilos.finalizarTexto}>Finalizar sesión</Text>
          </Pressable>
        </View>
        <View style={[estilos.fila, estilos.pie]}>
          <IconoCandado tamano={11} color="rgba(255,255,255,0.55)" />
          <Text style={estilos.pieTexto}>CANAL CIFRADO DE EXTREMO A EXTREMO</Text>
        </View>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  sala: { flex: 1, backgroundColor: '#14171A' },
  escenario: { flex: 1, margin: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1B1F24' },
  centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  espera: { color: '#FFFFFF', fontFamily: fuente.media, fontSize: 16 },
  esperaSub: { color: 'rgba(255,255,255,0.6)', fontFamily: fuente.regular, fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cabecera: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  codigo: { color: '#FFFFFF', fontFamily: fuente.fuerte, fontSize: 20 },
  estado: { color: '#7FD1B9', fontFamily: fuente.media, fontSize: 12, letterSpacing: 1 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  grabando: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 6 },
  grabandoTexto: { color: '#FFFFFF', fontFamily: fuente.media, fontSize: 12 },
  miniatura: { width: 180, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#2A2E33', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  miniaturaEtiqueta: {
    position: 'absolute', bottom: 8, left: 8, color: '#FFFFFF', fontFamily: fuente.media, fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  controles: { position: 'absolute', bottom: 48, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  control: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  // Apagado = rojo lleno con el icono tachado.
  controlApagado: { backgroundColor: '#B91C1C' },
  finalizar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 24, borderRadius: 28, backgroundColor: '#A8663D' },
  activarAudio: { position: 'absolute', alignSelf: 'center', top: '42%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999, backgroundColor: '#0F766E', zIndex: 5 },
  activarAudioTexto: { color: '#FFFFFF', fontFamily: fuente.fuerte, fontSize: 15 },
  finalizarTexto: { color: '#FFFFFF', fontFamily: fuente.fuerte, fontSize: 16 },
  pie: { position: 'absolute', bottom: 16, left: 0, right: 0, justifyContent: 'center' },
  pieTexto: { color: 'rgba(255,255,255,0.55)', fontFamily: fuente.media, fontSize: 11, letterSpacing: 1.2 },
})

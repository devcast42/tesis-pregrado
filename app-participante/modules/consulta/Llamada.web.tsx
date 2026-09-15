/** Videollamada — implementación para navegador.
 *  Implementa ESP-004 RF-004-01.
 *
 *  `@livekit/react-native` no tiene build de navegador: depende de
 *  react-native-webrtc, que solo existe en nativo. En web se usa
 *  `livekit-client` directamente contra elementos <video> del DOM.
 *  Metro resuelve este archivo por la extensión `.web`. */

import { createElement, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fuente } from '../nucleo/diseno'
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type LocalTrackPublication,
} from 'livekit-client'
import type { PropsLlamada } from './tipos'

export function Llamada({ url, token, onSalir }: PropsLlamada) {
  const remoto = useRef<HTMLVideoElement | null>(null)
  const local = useRef<HTMLVideoElement | null>(null)
  const sala = useRef<Room | null>(null)
  const [conectado, setConectado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const room = new Room({ adaptiveStream: true, dynacast: true })
    sala.current = room

    room
      .on(RoomEvent.TrackSubscribed, (pista: RemoteTrack) => {
        if (pista.kind === Track.Kind.Video && remoto.current) pista.attach(remoto.current)
        if (pista.kind === Track.Kind.Audio) pista.attach()
      })
      .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        if (pub.kind === Track.Kind.Video && pub.track && local.current) {
          pub.track.attach(local.current)
        }
      })
      .on(RoomEvent.Disconnected, () => vigente && onSalir())

    room
      .connect(url, token)
      .then(() => room.localParticipant.enableCameraAndMicrophone())
      .then(() => vigente && setConectado(true))
      .catch(() => vigente && setError('No se pudo conectar a la sesión.'))

    return () => {
      vigente = false
      room.disconnect()
    }
  }, [url, token, onSalir])

  function colgar() {
    sala.current?.disconnect()
    onSalir()
  }

  return (
    <View style={estilos.sala}>
      <View style={estilos.rejilla}>
        {createElement('video', {
          ref: remoto,
          autoPlay: true,
          playsInline: true,
          style: { width: '100%', flex: 1, borderRadius: 12, background: '#111827' },
        })}
        {createElement('video', {
          ref: local,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: {
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 180,
            borderRadius: 10,
            background: '#111827',
          },
        })}
      </View>

      {!conectado && !error && <Text style={estilos.espera}>Conectando…</Text>}
      {error && <Text style={estilos.error}>{error}</Text>}

      <Pressable onPress={colgar} style={estilos.colgar} accessibilityRole="button">
        <Text style={estilos.colgarTexto}>Finalizar sesión</Text>
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  sala: { flex: 1, backgroundColor: '#0b0f19' },
  rejilla: { flex: 1, padding: 8 },
  espera: { color: '#9ca3af', textAlign: 'center', paddingVertical: 8, fontSize: 15 },
  error: { color: '#fca5a5', textAlign: 'center', paddingVertical: 8, fontSize: 15 },
  colgar: {
    margin: 20,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colgarTexto: { color: '#ffffff', fontSize: 16, fontFamily: fuente.fuerte },
})

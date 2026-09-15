/** Sala LiveKit — implementación nativa (iOS/Android).
 *  Implementa ESP-004 RF-004-01.
 *
 *  ⚠️ NO IMPORTAR ESTE ARCHIVO DIRECTAMENTE. Se carga desde `Llamada.tsx`
 *  con un require dentro de un try: los imports de abajo arrastran el módulo
 *  nativo de WebRTC, que no existe en Expo Go, y un import estático haría
 *  caer la pantalla al cargarse en lugar de mostrar un aviso. */

import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  registerGlobals,
  useTracks,
} from '@livekit/react-native'
import { fuente } from '../nucleo/diseno'
import { Track } from 'livekit-client'
import type { PropsLlamada } from './tipos'

// Instala los polyfills de WebRTC. Debe correr antes de conectar.
registerGlobals()

export function SalaLiveKit({ url, token, onSalir }: PropsLlamada) {
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
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  return (
    <View style={estilos.sala}>
      <LiveKitRoom serverUrl={url} token={token} connect audio video onDisconnected={onSalir}>
        <Pistas onSalir={onSalir} />
      </LiveKitRoom>
    </View>
  )
}

function Pistas({ onSalir }: { onSalir: () => void }) {
  const pistas = useTracks([Track.Source.Camera])

  return (
    <View style={estilos.sala}>
      <View style={estilos.rejilla}>
        {pistas.map((pista, i) => (
          <VideoTrack
            key={pista.participant.identity + i}
            trackRef={pista}
            style={estilos.video}
          />
        ))}
        {pistas.length === 0 && (
          <Text style={estilos.espera}>Esperando a la otra persona…</Text>
        )}
      </View>

      <Pressable onPress={onSalir} style={estilos.colgar} accessibilityRole="button">
        <Text style={estilos.colgarTexto}>Finalizar sesión</Text>
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  sala: { flex: 1, backgroundColor: '#0b0f19' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f19' },
  rejilla: { flex: 1, gap: 8, padding: 8 },
  video: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111827' },
  espera: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 15 },
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

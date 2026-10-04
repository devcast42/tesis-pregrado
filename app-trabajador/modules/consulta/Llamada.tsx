/** Videollamada — puerta de entrada en nativo (iOS/Android).
 *  Implementa ESP-004 RF-004-01.
 *
 *  ⚠️ POR QUÉ ESTE ARCHIVO NO HACE NADA MÁS QUE UN require.
 *
 *  `@livekit/react-native` depende de `react-native-webrtc`, que es un módulo
 *  nativo: existe en un development build y NO existe en Expo Go. Antes la
 *  implementación vivía aquí con imports estáticos, así que el error del
 *  módulo nativo ocurría al cargar el archivo —y se llevaba por delante
 *  `consulta/[id].tsx` y `psicologo/consulta/[id].tsx` completas, que se
 *  quedaban sin default export.
 *
 *  Con el require dentro de un try, el fallo queda acotado a este componente
 *  y la pantalla puede explicar qué hace falta en lugar de romperse. El resto
 *  de la app —consentimiento, check-ins, OLBI— se prueba en Expo Go sin
 *  problema. */

import { StyleSheet, View } from 'react-native'
import { Apoyo, Aviso, Boton, Parrafo, Titulo } from '../nucleo/ui'
import { color, espacio } from '../nucleo/diseno'
import type { PropsLlamada } from './tipos'

type Componente = (props: PropsLlamada) => React.ReactElement | null

let sala: Componente | null | undefined

function cargarSala(): Componente | null {
  if (sala !== undefined) return sala

  try {
    sala = (require('./SalaLiveKit') as { SalaLiveKit: Componente }).SalaLiveKit
  } catch {
    sala = null
  }

  return sala
}

export function Llamada(props: PropsLlamada) {
  const Sala = cargarSala()

  if (Sala) return <Sala {...props} />

  return (
    <View style={e.aviso}>
      <Titulo>La videollamada necesita otra versión de la app</Titulo>

      <Aviso tono="alerta">
        Estás usando Expo Go, que no incluye el módulo de vídeo (WebRTC).
      </Aviso>

      <Parrafo suave>
        Para probar la videoconsulta hace falta un development build. El resto
        de la aplicación funciona con normalidad aquí.
      </Parrafo>

      <Apoyo>
        Desde la carpeta del proyecto: npx expo run:android
      </Apoyo>

      <Boton variante="secundario" onPress={props.onSalir}>
        Volver
      </Boton>
    </View>
  )
}

const e = StyleSheet.create({
  aviso: {
    flex: 1,
    justifyContent: 'center',
    gap: espacio.base,
    padding: espacio.lg,
    backgroundColor: color.fondo,
  },
})

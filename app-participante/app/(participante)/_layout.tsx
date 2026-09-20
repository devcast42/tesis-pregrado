/** Pestañas del participante — implementa ESP-002 RF-002-15.
 *  Diseño: Figma IcncrzVKVbewGGc6RkImCM (barra inferior de Apoyo y Perfil).
 *
 *  Tres lugares, no más: Hoy (lo que toca responder), Apoyo (pedir o entrar
 *  a una sesión con el psicólogo) y Perfil (datos iniciales, preferencias,
 *  derechos, salir). Los formularios y la videollamada NO llevan pestañas:
 *  se abren encima, a pantalla completa, y se vuelve al terminar. */

import { Tabs } from 'expo-router'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, fuente } from '../../modules/nucleo/diseno'
import {
  IconoBurbuja, IconoBurbujaLlena, IconoCalendarioLinea, IconoCalendarioLleno, IconoCredencial,
} from '../../modules/nucleo/iconos'

/** Etiqueta con el punto de «estás aquí» debajo, como en el diseño. */
function Etiqueta({ texto, activo }: { texto: string; activo: boolean }) {
  return (
    <View style={e.etiqueta}>
      <Text style={[e.etiquetaTexto, { color: activo ? color.primarioProfundo : color.textoMedio }]}>{texto}</Text>
      <View style={[e.punto, { backgroundColor: activo ? color.primarioProfundo : 'transparent' }]} />
    </View>
  )
}

export default function PestanasParticipante() {
  const insets = useSafeAreaInsets()
  // En web la pestaña no tiene barra del sistema debajo; en Android con
  // borde a borde sí, y la barra tiene que subir por encima de ella.
  const abajo = Platform.OS === 'web' ? 6 : Math.max(insets.bottom, 6)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primarioProfundo,
        tabBarInactiveTintColor: color.textoMedio,
        tabBarStyle: {
          backgroundColor: color.superficie,
          borderTopColor: color.borde,
          height: 62 + abajo,
          paddingBottom: abajo,
          paddingTop: 8,
        },
        tabBarItemStyle: { gap: 2 },
        sceneStyle: { backgroundColor: color.fondo },
      }}
    >
      <Tabs.Screen
        name="hoy"
        options={{
          tabBarLabel: ({ focused }) => <Etiqueta texto="Hoy" activo={focused} />,
          tabBarIcon: ({ color: c, focused }) => focused
            ? <IconoCalendarioLleno tamano={22} color={String(c)} />
            : <IconoCalendarioLinea tamano={22} color={String(c)} />,
        }}
      />
      <Tabs.Screen
        name="apoyo"
        options={{
          tabBarLabel: ({ focused }) => <Etiqueta texto="Apoyo" activo={focused} />,
          tabBarIcon: ({ color: c, focused }) => focused
            ? <IconoBurbujaLlena tamano={22} color={String(c)} />
            : <IconoBurbuja tamano={22} color={String(c)} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarLabel: ({ focused }) => <Etiqueta texto="Perfil" activo={focused} />,
          tabBarIcon: ({ color: c }) => <IconoCredencial tamano={22} color={String(c)} />,
        }}
      />
    </Tabs>
  )
}

const e = StyleSheet.create({
  etiqueta: { alignItems: 'center', gap: 3 },
  etiquetaTexto: { fontFamily: fuente.media, fontSize: 11, lineHeight: 14 },
  punto: { width: 4, height: 4, borderRadius: 2 },
})

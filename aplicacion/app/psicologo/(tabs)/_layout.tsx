/** Pestañas del psicólogo — misma forma que las del trabajador.
 *
 *  Tres lugares, los mismos tres que tiene el trabajador traducidos a su
 *  oficio: Hoy (qué me toca: las citas del día y quién está esperando),
 *  Casos (su gente, toda) y Perfil (cuenta y salir).
 *
 *  Antes había una sola pantalla con todo dentro —la lista de casos con la
 *  agenda metida como tarjeta— y para moverse había que volver atrás.
 *
 *  La ficha del caso, la nota clínica, la historia y la videollamada no son
 *  pestañas: están en el Stack de `psicologo/_layout`, se abren encima a
 *  pantalla completa y se vuelve con la flecha, igual que los formularios
 *  del trabajador. */

import { Tabs } from 'expo-router'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, fuente } from '../../../modules/nucleo/diseno'
import {
  IconoCalendarioLinea, IconoCalendarioLleno, IconoCredencial, IconoEquipo, IconoPersonaLlena,
} from '../../../modules/nucleo/iconos'

function Etiqueta({ texto, activo }: { texto: string; activo: boolean }) {
  return (
    <View style={e.etiqueta}>
      <Text style={[e.etiquetaTexto, { color: activo ? color.primarioProfundo : color.textoMedio }]}>{texto}</Text>
      <View style={[e.punto, { backgroundColor: activo ? color.primarioProfundo : 'transparent' }]} />
    </View>
  )
}

export default function PestanasPsicologo() {
  const insets = useSafeAreaInsets()
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
        name="index"
        options={{
          tabBarLabel: ({ focused }) => <Etiqueta texto="Hoy" activo={focused} />,
          tabBarIcon: ({ color: c, focused }) => focused
            ? <IconoCalendarioLleno tamano={22} color={String(c)} />
            : <IconoCalendarioLinea tamano={22} color={String(c)} />,
        }}
      />
      <Tabs.Screen
        name="casos"
        options={{
          tabBarLabel: ({ focused }) => <Etiqueta texto="Casos" activo={focused} />,
          tabBarIcon: ({ color: c, focused }) => focused
            ? <IconoPersonaLlena tamano={22} color={String(c)} />
            : <IconoEquipo tamano={22} color={String(c)} />,
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

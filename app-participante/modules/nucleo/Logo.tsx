/** Logo de la app — la misma geometría que `assets/logo.svg`, como componente
 *  para poder pintarlo a cualquier tamaño sin depender de un PNG.
 *
 *  Si se cambia el logo, se cambia aquí Y en assets/logo.svg (de donde salen
 *  los íconos de la app). Son la misma figura en dos formatos. */

import { View, StyleSheet } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg'

export function Logo({ tamano = 64 }: { tamano?: number }) {
  return (
    <View style={[e.halo, { width: tamano * 1.5, height: tamano * 1.5, borderRadius: tamano * 0.75 }]}>
      <Svg width={tamano} height={tamano} viewBox="0 0 64 64">
        <Defs>
          <RadialGradient id="fondo" cx="38%" cy="32%" r="75%">
            <Stop offset="0" stopColor="#F5F6DC" />
            <Stop offset="0.55" stopColor="#EAF3EA" />
            <Stop offset="1" stopColor="#DDEFEA" />
          </RadialGradient>
          <LinearGradient id="gota" x1="0.2" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="#1B776C" />
            <Stop offset="1" stopColor="#3B9E8F" />
          </LinearGradient>
        </Defs>
        <Circle cx="32" cy="32" r="31.25" fill="url(#fondo)" stroke="#FFFFFF" strokeWidth="1.5" />
        <Path fill="url(#gota)"
          d="M32 7 C 40.5 19, 48 27.5, 48 38 A 16 16 0 1 1 16 38 C 16 27.5, 23.5 19, 32 7 Z" />
        <Path fill="#FBFBF8"
          d="M32 17.5 C 36.6 25, 39.5 31, 39.5 40 A 7.5 7.5 0 1 1 24.5 40 C 24.5 31, 27.4 25, 32 17.5 Z" />
        <Circle cx="32" cy="35.5" r="2.7" fill="#22867A" />
      </Svg>
    </View>
  )
}

const e = StyleSheet.create({
  // El halo suave alrededor de la insignia, como en el diseño.
  halo: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(234,243,234,0.55)',
  },
})

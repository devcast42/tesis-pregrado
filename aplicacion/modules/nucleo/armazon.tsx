/** Barra superior del producto, compartida por los roles que usan la app en
 *  el teléfono (el trabajador y el psicólogo).
 *
 *  Vivía en `modules/trabajador/piezas` porque solo la usaba el trabajador.
 *  Cuando el psicólogo pasó a tener pestañas abajo, pedirle a su pantalla que
 *  importara del módulo del trabajador era la forma rápida de que las dos
 *  barras se fueran separando con el tiempo. */

import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Logo } from './Logo'
import { IconoPersona } from './iconos'
import { color, espacio, texto } from './diseno'

/** Logo, nombre del producto en mayúsculas, el nombre de la pantalla debajo
 *  y, a la derecha, un acceso a Perfil (omitido en Perfil mismo). */
export function BarraSuperior({ titulo, onPerfil, derecha }: {
  titulo: string
  onPerfil?: () => void
  derecha?: ReactNode
}) {
  return (
    <View style={e.barraSuperior}>
      <View style={e.barraLogo}><Logo tamano={22} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 10, lineHeight: 14 }]}>BIENESTAR TECH</Text>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
      </View>
      {derecha}
      {!derecha && onPerfil && (
        <Pressable onPress={onPerfil} accessibilityRole="button" accessibilityLabel="Perfil" style={e.barraPersona} hitSlop={8}>
          <IconoPersona tamano={16} color={color.primarioProfundo} />
        </Pressable>
      )}
    </View>
  )
}

/** El bloque de bienvenida: fecha arriba, saludo grande y una línea de apoyo.
 *  `derecha` es lo que cada rol quiera poner junto a la fecha — el código
 *  anónimo en el trabajador, nada en el psicólogo. */
export function Saludo({ fecha, titulo, subtitulo, derecha }: {
  fecha: string
  titulo: string
  subtitulo: string
  derecha?: ReactNode
}) {
  return (
    <View style={e.saludo}>
      <View style={e.saludoFila}>
        <Text style={[texto.etiqueta, e.saludoFecha]} numberOfLines={1}>{fecha.toUpperCase()}</Text>
        {derecha}
      </View>
      <Text style={[texto.titulo, { color: color.texto }]}>{titulo}</Text>
      <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{subtitulo}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  barraSuperior: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: color.superficie,
    borderBottomWidth: 1, borderBottomColor: color.borde,
  },
  barraLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  barraPersona: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  saludo: { gap: espacio.xs },
  saludoFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.sm },
  saludoFecha: { color: color.textoMedio, flex: 1, letterSpacing: 0.5 },
})

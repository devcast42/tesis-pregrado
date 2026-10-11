/** Invitación a instalar la aplicación — solo web, y solo si hace falta.
 *
 *  · iPhone (Safari): no existe un botón de instalación que una página pueda
 *    disparar; hay que decirle a la persona dónde está en el menú Compartir.
 *  · Android / escritorio (Chrome, Edge): el navegador avisa cuándo se puede
 *    instalar y aquí se ofrece un botón que lo lanza.
 *
 *  No aparece si ya está instalada, ni en la app móvil, y se puede descartar:
 *  la decisión se recuerda en el dispositivo. */

import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { alCambiarInstalacion, esIPhone, estaInstalada, instalar, puedeInstalarDirecto } from './pwa'
import { color, espacio, radio, texto } from './diseno'

const CLAVE = 'pwa.invitacion.descartada'

function leerDescartada(): boolean {
  try { return window.localStorage.getItem(CLAVE) === '1' } catch { return false }
}

export function InstalarPwa() {
  const web = Platform.OS === 'web' && typeof window !== 'undefined'
  const [, repintar] = useState(0)
  const [descartada, setDescartada] = useState(() => (web ? leerDescartada() : true))

  useEffect(() => (web ? alCambiarInstalacion(() => repintar((n) => n + 1)) : undefined), [web])

  if (!web || descartada || estaInstalada()) return null

  const iphone = esIPhone()
  const directo = puedeInstalarDirecto()
  if (!iphone && !directo) return null

  function descartar() {
    try { window.localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento: se vuelve a mostrar */ }
    setDescartada(true)
  }

  return (
    <View style={e.tarjeta} accessibilityRole="summary">
      <View style={{ flex: 1, gap: espacio.xs }}>
        <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>Instálala en tu teléfono</Text>
        {iphone ? (
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Toca el botón Compartir de Safari y luego «Añadir a pantalla de inicio». Se abre como una app, sin barra del navegador.
          </Text>
        ) : (
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Ábrela desde la pantalla de inicio, como cualquier otra app.
          </Text>
        )}
        {!iphone && (
          <Pressable onPress={() => { instalar().catch(() => {}) }} style={e.boton} accessibilityRole="button">
            <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>Instalar</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={descartar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
        <Text style={[texto.cuerpoFuerte, { color: color.textoSuave }]}>✕</Text>
      </Pressable>
    </View>
  )
}

const e = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md,
    backgroundColor: color.primarioSuave, borderRadius: radio.lg,
    borderWidth: 1, borderColor: color.borde, padding: espacio.base,
  },
  boton: {
    alignSelf: 'flex-start', marginTop: espacio.xs,
    backgroundColor: color.primario, borderRadius: radio.completo,
    paddingVertical: espacio.sm, paddingHorizontal: espacio.lg,
  },
})

/** Bloqueo con huella — implementa ESP-001 RF-001-08.
 *
 *  Aparece entre la sesión guardada y el contenido. Pide la huella al
 *  entrar; si la persona cancela, se queda aquí con dos salidas: volver a
 *  intentar, o cerrar sesión y entrar con contraseña. Nunca muestra datos:
 *  ni el código anónimo ni el nombre del psicólogo. */

import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cerrarSesion } from '../modules/acceso/datos'
import { olvidarDesbloqueo, verificar } from '../modules/acceso/bloqueo'
import { Boton } from '../modules/nucleo/ui'
import { Logo } from '../modules/nucleo/Logo'
import { IconoHuella } from '../modules/nucleo/iconos'
import { ancho, color, espacio, texto } from '../modules/nucleo/diseno'

export default function Bloqueo() {
  // `volver=1`: se llegó desde el segundo plano y hay una pantalla debajo a
  // la que regresar (por ejemplo, un formulario a medias). Sin él, es un
  // arranque en frío y se vuelve a la puerta de entrada.
  const { volver } = useLocalSearchParams<{ volver?: string }>()
  const [fallo, setFallo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const insets = useSafeAreaInsets()

  const pedir = useCallback(async () => {
    setOcupado(true)
    const ok = await verificar()
    setOcupado(false)
    if (!ok) return setFallo(true)
    if (volver === '1' && router.canGoBack()) router.back()
    else router.replace('/')
  }, [volver])

  useEffect(() => { pedir() }, [pedir])

  async function conContrasena() {
    olvidarDesbloqueo()
    await cerrarSesion()
    // Si había pantallas debajo (volver=1), se descartan: sin sesión no valen.
    if (router.canDismiss()) router.dismissAll()
    router.replace('/acceso')
  }

  return (
    <View style={[e.pantalla, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={e.centro}>
        <Logo tamano={56} />
        <View style={e.huella}>
          <IconoHuella tamano={44} color={color.primarioProfundo} />
        </View>
        <Text style={[texto.titulo, { color: color.texto, textAlign: 'center' }]}>Confirma que eres tú</Text>
        <Text style={[texto.cuerpo, { color: color.textoMedio, textAlign: 'center' }]}>
          {fallo
            ? 'No se pudo confirmar. Inténtalo de nuevo o entra con tu contraseña.'
            : 'Usa tu huella o el bloqueo de tu teléfono para abrir la app.'}
        </Text>
      </View>

      <View style={e.acciones}>
        <Boton onPress={pedir} cargando={ocupado}>Usar huella</Boton>
        <Pressable onPress={conContrasena} accessibilityRole="button" style={e.enlace}>
          <Text style={[texto.cuerpoFuerte, { color: color.primario }]}>Entrar con contraseña</Text>
        </Pressable>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: {
    flex: 1, backgroundColor: color.fondo, paddingHorizontal: 20,
    width: '100%', maxWidth: ancho.formulario, alignSelf: 'center',
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.md, paddingHorizontal: espacio.base },
  huella: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: color.primarioSuave,
    alignItems: 'center', justifyContent: 'center', marginTop: espacio.sm,
  },
  acciones: { gap: espacio.sm },
  enlace: { alignItems: 'center', paddingVertical: 12 },
})

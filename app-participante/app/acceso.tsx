/** Acceso — implementa ESP-001 (RF-001-01, RF-001-02). */

import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { iniciarSesion } from '../modules/acceso/datos'
import { Apoyo, Aviso, Boton, Entrada, Parrafo, Titulo } from '../modules/nucleo/ui'
import { ancho, color, espacio } from '../modules/nucleo/diseno'

export default function Acceso() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar() {
    setOcupado(true)
    setError(null)
    try {
      await iniciarSesion(correo, contrasena)
      router.replace('/')
    } catch {
      // Mensaje deliberadamente genérico: no revela si el correo está inscrito.
      setError('Correo o contraseña incorrectos.')
    } finally {
      setOcupado(false)
    }
  }

  const inhabilitado = !correo.includes('@') || contrasena.length === 0

  return (
    <KeyboardAvoidingView
      style={e.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={e.cuerpo}>
        <View style={e.encabezado}>
          <Titulo>Bienestar laboral</Titulo>
          <Parrafo suave>
            Ingresa con el correo y la contraseña que te dio el equipo de investigación.
          </Parrafo>
        </View>

        <View style={e.campos}>
          <Entrada
            value={correo}
            onChangeText={setCorreo}
            placeholder="Correo"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            invalida={Boolean(error)}
          />
          <Entrada
            value={contrasena}
            onChangeText={setContrasena}
            placeholder="Contraseña"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            onSubmitEditing={() => !inhabilitado && entrar()}
            returnKeyType="go"
            invalida={Boolean(error)}
          />

          {error && <Aviso>{error}</Aviso>}

          <Boton onPress={entrar} inhabilitado={inhabilitado} cargando={ocupado}>
            Entrar
          </Boton>
        </View>

        <View style={e.pie}>
          <Apoyo>
            ¿Olvidaste tu contraseña? Escríbele al equipo de investigación y te la restablecen.
          </Apoyo>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  cuerpo: {
    flex: 1,
    justifyContent: 'center',
    padding: espacio.lg,
    gap: espacio.xl,
    width: '100%',
    maxWidth: ancho.formulario,
    alignSelf: 'center',
  },
  encabezado: { gap: espacio.sm },
  campos: { gap: espacio.md },
  pie: { alignItems: 'center' },
})

/** Acceso — implementa ESP-001 (RF-001-01, RF-001-02), con el diseño de
 *  Figma (archivo VXFnbiXKzb0Hj92s2r2ulL, frame "Html → Body → Main").
 *
 *  Lo que se conserva del diseño: la insignia con el logo, el aviso de acceso
 *  seguro, los campos con ícono, el ojo para ver la contraseña y la tarjeta
 *  de privacidad al pie. Lo que no: el código "CEI-2024-089" del comité de
 *  ética era un ejemplo; se muestra solo cuando exista uno real. */

import { useState } from 'react'
import {
  KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { iniciarSesion } from '../modules/acceso/datos'
import { Aviso, Boton } from '../modules/nucleo/ui'
import { Logo } from '../modules/nucleo/Logo'
import { InstalarPwa } from '../modules/nucleo/InstalarPwa'
import {
  IconoCandado, IconoCorreo, IconoEscudo, IconoFlecha, IconoOjo, IconoOjoTachado,
} from '../modules/nucleo/iconos'
import { ancho, color, espacio, radio, texto, TOQUE_MINIMO } from '../modules/nucleo/diseno'

/** Código de aprobación del comité de ética. Vacío hasta que exista (ESP-001
 *  §9, pendiente 1): mostrar uno inventado sería peor que no mostrar nada. */
const CODIGO_COMITE = ''

export default function Acceso() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
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
  const insets = useSafeAreaInsets()

  // `padding` también en Android: con borde a borde (Android 15) el sistema ya
  // no encoge la ventana al abrir el teclado, y el campo de contraseña quedaba
  // tapado.
  return (
    <KeyboardAvoidingView style={e.pantalla} behavior="padding">
      <ScrollView contentContainerStyle={[e.cuerpo, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={e.barra}>
          <View style={e.pastilla}>
            <IconoCandado tamano={12} color={color.textoMedio} />
            <Text style={[texto.dato, { color: color.textoMedio }]}>Acceso seguro</Text>
          </View>
          {CODIGO_COMITE !== '' && (
            <Text style={[texto.dato, { color: color.textoSuave }]}>{CODIGO_COMITE}</Text>
          )}
        </View>

        <View style={e.encabezado}>
          <Logo tamano={64} />
          <Text style={[texto.titulo, e.titulo]}>Bienestar laboral</Text>
          <Text style={[texto.apoyo, e.subtitulo]}>
            Ingresa con las credenciales que te entregó tu empresa.
          </Text>
        </View>

        <InstalarPwa />

        <View style={e.campos}>
          <View style={e.campo}>
            <Text style={[texto.apoyo, e.etiqueta]}>Correo institucional o personal</Text>
            <View style={[e.entrada, error && e.entradaInvalida]}>
              <IconoCorreo tamano={20} color={color.textoSuave} />
              <TextInput
                style={e.entradaTexto}
                value={correo}
                onChangeText={setCorreo}
                placeholder="nombre@empresa.com"
                placeholderTextColor={color.textoSuave}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={e.campo}>
            <Text style={[texto.apoyo, e.etiqueta]}>Contraseña</Text>
            <View style={[e.entrada, error && e.entradaInvalida]}>
              <IconoCandado tamano={16} color={color.textoSuave} />
              <TextInput
                style={e.entradaTexto}
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Tu contraseña"
                placeholderTextColor={color.textoSuave}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoComplete="current-password"
                onSubmitEditing={() => !inhabilitado && entrar()}
                returnKeyType="go"
              />
              <Pressable
                onPress={() => setVerContrasena((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={10}
                style={e.ojo}
              >
                {verContrasena
                  ? <IconoOjoTachado tamano={20} color={color.textoMedio} />
                  : <IconoOjo tamano={20} color={color.textoMedio} />}
              </Pressable>
            </View>
          </View>

          {error && <Aviso>{error}</Aviso>}

          <Boton onPress={entrar} inhabilitado={inhabilitado} cargando={ocupado}>
            Entrar  →
          </Boton>

          <Text style={[texto.apoyo, e.ayuda]}>
            ¿Olvidaste tu contraseña?{' '}
            <Text style={{ color: color.primario }}>Escríbele a tu empresa</Text> y te la
            restablecen.
          </Text>
        </View>

        <View style={e.privacidad}>
          <View style={e.privacidadIcono}>
            <IconoEscudo tamano={20} color={color.primarioProfundo} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[texto.apoyoFuerte, { color: color.texto }]}>
              Privacidad e independencia
            </Text>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              Tus respuestas están disociadas de tu empresa: nadie en ella puede ver lo que
              contestas.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  cuerpo: {
    flexGrow: 1,
    paddingHorizontal: 20, paddingTop: espacio.base, paddingBottom: espacio.xl,
    gap: espacio.lg,
    width: '100%', maxWidth: ancho.formulario, alignSelf: 'center',
  },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pastilla: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: espacio.md, paddingVertical: 6,
    borderRadius: radio.completo, borderWidth: 1, borderColor: color.borde,
    backgroundColor: color.superficie,
  },
  encabezado: { alignItems: 'center', gap: espacio.sm, paddingTop: espacio.sm },
  titulo: { color: color.texto, textAlign: 'center', marginTop: espacio.xs },
  subtitulo: { color: color.textoMedio, textAlign: 'center', paddingHorizontal: espacio.base },

  campos: { gap: espacio.base },
  campo: { gap: espacio.xs },
  etiqueta: { color: color.textoMedio },
  entrada: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    minHeight: TOQUE_MINIMO, paddingHorizontal: espacio.base,
    borderRadius: radio.md, borderWidth: 1, borderColor: color.bordeFuerte,
    backgroundColor: color.superficie,
  },
  entradaInvalida: { borderColor: color.peligro },
  entradaTexto: { flex: 1, ...texto.cuerpo, color: color.texto, paddingVertical: 12 },
  ojo: { padding: espacio.xs },
  ayuda: { color: color.textoMedio, textAlign: 'center', paddingHorizontal: espacio.base },

  privacidad: {
    flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start',
    padding: espacio.base, borderRadius: radio.md,
    backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde,
    marginTop: 'auto',
  },
  privacidadIcono: {
    width: 36, height: 36, borderRadius: radio.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.primarioSuave,
  },
})

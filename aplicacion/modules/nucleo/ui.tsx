/** Componentes base. Toda pantalla se arma con estos; ninguna define colores
 *  ni tamaños por su cuenta. Cambiar el aspecto de la app es cambiar este
 *  archivo y `diseno.ts`, no doce pantallas. */

import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ancho, color, espacio, radio, sombra, texto, TOQUE_MINIMO, veloModal } from './diseno'

// ---------------------------------------------------------------- Estructura

export function Pantalla({
  children,
  ancho: anchoMax = ancho.formulario,
  centrado = false,
}: {
  children: ReactNode
  ancho?: number
  centrado?: boolean
}) {
  return (
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={[
        e.contenido,
        { maxWidth: anchoMax },
        centrado && e.contenidoCentrado,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

export function Cargando() {
  return (
    <View style={e.cargando}>
      <ActivityIndicator size="large" color={color.primario} />
    </View>
  )
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={[texto.titulo, { color: color.texto }]}>{children}</Text>
}

export function Parrafo({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return (
    <Text style={[texto.cuerpo, { color: suave ? color.textoMedio : color.texto }]}>
      {children}
    </Text>
  )
}

export function Apoyo({ children }: { children: ReactNode }) {
  return <Text style={[texto.apoyo, { color: color.textoSuave }]}>{children}</Text>
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <Text style={[texto.etiqueta, { color: color.textoSuave, textTransform: 'uppercase' }]}>
      {children}
    </Text>
  )
}

export function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <View style={e.seccion}>
      {titulo && <Etiqueta>{titulo}</Etiqueta>}
      {children}
    </View>
  )
}

export function Tarjeta({
  children,
  onPress,
  tono,
}: {
  children: ReactNode
  onPress?: () => void
  tono?: 'suave' | 'exito' | 'alerta'
}) {
  const fondo =
    tono === 'exito' ? color.exitoSuave
    : tono === 'alerta' ? color.alertaSuave
    : tono === 'suave' ? color.superficieSuave
    : color.superficie

  const cuerpo = (
    <View style={[e.tarjeta, { backgroundColor: fondo }, !tono && sombra.suave]}>
      {children}
    </View>
  )

  if (!onPress) return cuerpo
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && e.presionado}>
      {cuerpo}
    </Pressable>
  )
}

// -------------------------------------------------------------------- Acción

export function Boton({
  children,
  onPress,
  variante = 'principal',
  inhabilitado,
  cargando,
  pequeno,
}: {
  children: ReactNode
  onPress: () => void
  variante?: 'principal' | 'secundario' | 'texto'
  inhabilitado?: boolean
  cargando?: boolean
  /** Para acciones dentro de una fila de tabla, donde la altura de toque
   *  completa rompería el ritmo vertical. No usar en pantallas táctiles. */
  pequeno?: boolean
}) {
  const bloqueado = inhabilitado || cargando

  return (
    <Pressable
      onPress={onPress}
      disabled={bloqueado}
      accessibilityRole="button"
      style={({ pressed }) => [
        e.boton,
        pequeno && e.botonPequeno,
        variante === 'principal' && e.botonPrincipal,
        variante === 'secundario' && e.botonSecundario,
        variante === 'texto' && e.botonTexto,
        bloqueado && e.botonBloqueado,
        pressed && !bloqueado && e.presionado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator
          size={pequeno ? 'small' : undefined}
          color={variante === 'principal' ? '#FFFFFF' : color.primario}
        />
      ) : (
        <Text
          style={[
            pequeno ? texto.apoyoFuerte : texto.cuerpoFuerte,
            variante === 'principal' ? { color: '#FFFFFF' } : { color: color.primario },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  )
}

export function Entrada(props: TextInputProps & { invalida?: boolean }) {
  const { invalida, style, ...resto } = props
  return (
    <TextInput
      {...resto}
      placeholderTextColor={color.textoSuave}
      style={[e.entrada, invalida && e.entradaInvalida, style]}
    />
  )
}

export function Aviso({ children, tono = 'peligro' }: { children: ReactNode; tono?: 'peligro' | 'alerta' | 'exito' }) {
  const paleta =
    tono === 'exito' ? { fondo: color.exitoSuave, texto: color.exito }
    : tono === 'alerta' ? { fondo: color.alertaSuave, texto: color.alerta }
    : { fondo: color.peligroSuave, texto: color.peligro }

  return (
    <View style={[e.aviso, { backgroundColor: paleta.fondo }]}>
      <Text style={[texto.apoyo, { color: paleta.texto }]}>{children}</Text>
    </View>
  )
}

/** Cifra grande con su etiqueta. La unidad del panel del investigador. */
export function Cifra({
  valor,
  etiqueta,
  tono,
}: {
  valor: number | string
  etiqueta: string
  tono?: string
}) {
  return (
    <View style={e.cifra}>
      <Text style={[texto.cifra, { color: tono ?? color.texto }]}>{valor}</Text>
      <Text style={[texto.apoyo, { color: color.textoSuave }]}>{etiqueta}</Text>
    </View>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <View style={e.vacio}>
      <Text style={[texto.cuerpo, { color: color.textoSuave, textAlign: 'center' }]}>
        {children}
      </Text>
    </View>
  )
}

export const estiloFila: ViewStyle = { flexDirection: 'row', alignItems: 'center' }

const e = StyleSheet.create({
  hojaVelo: { ...veloModal, backgroundColor: 'rgba(28, 25, 23, 0.55)', justifyContent: 'flex-end' },
  hoja: {
    backgroundColor: color.fondo, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, gap: espacio.md,
    width: '100%', maxWidth: 520, alignSelf: 'center',
  },
  hojaAsa: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.borde, marginBottom: 4 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingVertical: 14, paddingHorizontal: espacio.base, borderRadius: radio.lg,
    borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie,
  },
  opcionActiva: { borderColor: color.primario, backgroundColor: color.primarioSuave },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.borde, alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: color.primario },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.primario },
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: {
    padding: espacio.lg,
    paddingBottom: espacio.xxl,
    gap: espacio.base,
    width: '100%',
    alignSelf: 'center',
  },
  contenidoCentrado: { flexGrow: 1, justifyContent: 'center' },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.fondo },
  seccion: { gap: espacio.md, paddingVertical: espacio.sm },
  tarjeta: {
    padding: espacio.base,
    borderRadius: radio.lg,
    borderWidth: 1,
    borderColor: color.borde,
    gap: espacio.xs,
  },
  presionado: { opacity: 0.75 },
  boton: {
    minHeight: TOQUE_MINIMO,
    borderRadius: radio.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio.lg,
  },
  botonPequeno: { minHeight: 38, paddingHorizontal: espacio.base, borderRadius: radio.sm },
  botonPrincipal: { backgroundColor: color.primario },
  botonSecundario: { borderWidth: 1, borderColor: color.bordeFuerte, backgroundColor: color.superficie },
  botonTexto: { minHeight: 44 },
  botonBloqueado: { opacity: 0.4 },
  entrada: {
    minHeight: TOQUE_MINIMO,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: color.bordeFuerte,
    backgroundColor: color.superficie,
    paddingHorizontal: espacio.base,
    fontSize: 16,
    color: color.texto,
  },
  entradaInvalida: { borderColor: color.peligro },
  aviso: { padding: espacio.md, borderRadius: radio.md },
  cifra: { gap: 2, minWidth: 96 },
  vacio: { paddingVertical: espacio.xl, paddingHorizontal: espacio.base },
})

// ------------------------------------------------------------- Confirmación

/** Pide confirmación y devuelve si se aceptó.
 *
 *  En web `Alert.alert` con botones no hace nada: react-native-web no lo
 *  implementa, así que cualquier acción que se confirmaba así era un botón
 *  muerto en el navegador. Aquí cae a `window.confirm`. */
export function confirmar({ titulo, mensaje, aceptar = 'Aceptar', destructivo = false }: {
  titulo: string
  mensaje: string
  aceptar?: string
  destructivo?: boolean
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${titulo}\n\n${mensaje}`))
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
      { text: aceptar, style: destructivo ? 'destructive' : 'default', onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) })
  })
}

// ------------------------------------------------------------ Hoja inferior

/** Una hoja que sube desde abajo, con su título y lo que se le ponga dentro.
 *
 *  Para elegir entre más de dos o tres cosas. `Alert` en Android corta a tres
 *  botones sin avisar: cerrar un caso con cuatro desenlaces dejaba tres de
 *  ellos fuera de la pantalla, y en web no salía ninguno. */
export function Hoja({ visible, titulo, onCerrar, children }: {
  visible: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable style={e.hojaVelo} onPress={onCerrar} accessibilityLabel="Cerrar">
        <Pressable style={[e.hoja, { paddingBottom: espacio.lg + insets.bottom }]} onPress={() => {}}>
          <View style={e.hojaAsa} />
          <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Opción de una hoja: una fila con su marca de seleccionada. */
export function OpcionHoja({ texto: t, ayuda, activa, onPress }: {
  texto: string
  ayuda?: string
  activa: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activa }}
      style={({ pressed }) => [e.opcion, activa && e.opcionActiva, pressed && { opacity: 0.8 }]}
    >
      <View style={[e.radio, activa && e.radioActivo]}>{activa && <View style={e.radioPunto} />}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[texto.cuerpo, { color: activa ? color.primarioProfundo : color.texto }]}>{t}</Text>
        {!!ayuda && <Text style={[texto.apoyo, { color: color.textoMedio }]}>{ayuda}</Text>}
      </View>
    </Pressable>
  )
}

/** Perfil del psicólogo.
 *
 *  La tercera pestaña, en el mismo sitio que la del trabajador. Antes salir
 *  era un botón redondo en la esquina de la lista de casos, sin confirmar:
 *  un toque mal dado y a volver a escribir la contraseña. */

import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cerrarSesion, correoActual } from '../../../modules/acceso/datos'
import { listarCasos, psicologoActual } from '../../../modules/psicologo/datos'
import { BarraSuperior } from '../../../modules/nucleo/armazon'
import { Cargando, confirmar } from '../../../modules/nucleo/ui'
import { IconoCandado, IconoEscudo, IconoSalir } from '../../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

export default function PerfilPsicologo() {
  const [nombre, setNombre] = useState<string | null>(null)
  const [correo, setCorreo] = useState('')
  const [activos, setActivos] = useState(0)
  const [cerrados, setCerrados] = useState(0)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    const [yo, mail, casos] = await Promise.all([
      psicologoActual(), correoActual().catch(() => ''), listarCasos().catch(() => []),
    ])
    setNombre(yo?.nombre ?? '—')
    setCorreo(mail ?? '')
    setActivos(casos.filter((c) => c.estado_caso !== 'cerrado').length)
    setCerrados(casos.filter((c) => c.estado_caso === 'cerrado').length)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function confirmarSalida() {
    const ok = await confirmar({ titulo: 'Cerrar sesión', mensaje: 'Para volver a entrar necesitarás tu correo y contraseña.', aceptar: 'Cerrar sesión', destructivo: true })
    if (!ok) return
    await cerrarSesion()
    router.replace('/')
  }

  if (nombre === null) return <Cargando />

  return (
    <View style={e.pantalla}>
      <BarraSuperior titulo="Perfil" />

      <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}>
        <Text style={[texto.titulo, { color: color.texto }]}>Tu perfil</Text>

        <View style={e.tarjeta}>
          <View style={e.fila}>
            <View style={e.iniciales}>
              <Text style={[texto.seccion, { color: '#FFFFFF' }]}>{iniciales(nombre)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.seccion, { color: color.texto }]}>{nombre}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>Psicólogo · {correo || 'sin correo'}</Text>
            </View>
          </View>
          <View style={e.cifras}>
            <View style={e.cifra}>
              <Text style={[texto.seccion, { color: color.texto }]}>{activos}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>{activos === 1 ? 'caso abierto' : 'casos abiertos'}</Text>
            </View>
            <View style={e.separador} />
            <View style={e.cifra}>
              <Text style={[texto.seccion, { color: color.texto }]}>{cerrados}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>{cerrados === 1 ? 'cerrado' : 'cerrados'}</Text>
            </View>
          </View>
        </View>

        <View style={e.tarjeta}>
          <View style={e.fila}>
            <View style={e.cuadroIcono}><IconoEscudo tamano={22} color={color.primarioProfundo} /></View>
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Lo que ves y lo que no</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Ves el nombre y el correo de quien se te deriva, para poder contactarle, y cada
            acceso queda registrado. La empresa nunca ve tus notas ni lo que se habla en sesión.
          </Text>
          <View style={e.nota}>
            <IconoCandado tamano={14} color={color.textoMedio} />
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              El audio y la transcripción se borran al vencer su plazo de retención.
            </Text>
          </View>
        </View>

        <Pressable onPress={confirmarSalida} style={e.botonBorde} accessibilityRole="button">
          <IconoSalir tamano={18} color={color.texto} />
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

/** «Psicologo Test» → «PT». El psicólogo sí tiene nombre a la vista: es su
 *  propia cuenta. */
function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '·'
}

const e = StyleSheet.create({
  iniciales: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: {
    paddingHorizontal: 20, paddingTop: espacio.base, paddingBottom: espacio.xxl, gap: espacio.md,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  tarjeta: {
    backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.base,
    gap: espacio.sm, borderWidth: 1, borderColor: color.borde,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  cuadroIcono: { width: 44, height: 44, borderRadius: radio.md, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  cifras: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.superficieSuave, borderRadius: radio.md, paddingVertical: 12 },
  cifra: { flex: 1, alignItems: 'center', gap: 2 },
  separador: { width: 1, alignSelf: 'stretch', backgroundColor: color.borde },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: 12 },
  botonBorde: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm,
    paddingVertical: 14, borderRadius: radio.lg, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie,
  },
})

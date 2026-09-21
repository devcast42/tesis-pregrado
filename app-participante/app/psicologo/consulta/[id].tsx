/** Videoconsulta del psicólogo — implementa ESP-004 (RF-004-01 … RF-004-03).
 *
 *  Diseño: Figma «Antes de la Videollamada». Una pantalla de preparación, no
 *  de configuración: qué pasa con la grabación, quién autorizó, y entrar.
 *  Sin doble consentimiento la sesión ocurre igual, sin grabar. */

import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Llamada } from '../../../modules/consulta/Llamada'
import { finalizarSesion, iniciarGrabacion, obtenerCredenciales, obtenerSesion } from '../../../modules/consulta/datos'
import { consentirGrabacion, obtenerCaso, type Caso } from '../../../modules/psicologo/datos'
import type { Credenciales } from '../../../modules/consulta/tipos'
import { Boton, Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import {
  IconoCandado, IconoCheck, IconoEscudo, IconoMicrofono, IconoNota, IconoVideo, IconoWifi,
} from '../../../modules/nucleo/iconos'

export default function Consulta() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [sesion, setSesion] = useState<any>(null)
  const [caso, setCaso] = useState<Caso | null>(null)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)
  const [enLlamada, setEnLlamada] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const s = await obtenerSesion(id)
    setSesion(s)
    if (s?.derivacion_id) setCaso(await obtenerCaso(s.derivacion_id).catch(() => null))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function autorizar() {
    await consentirGrabacion(id, 'psicologo')
    await cargar()
    // Si el participante ya autorizó y hay alguien en la sala, arranca ya.
    iniciarGrabacion(id).catch(() => {})
  }

  async function entrar() {
    setOcupado(true)
    try {
      setCredenciales(await obtenerCredenciales(id))
      setEnLlamada(true)
      setTimeout(() => { iniciarGrabacion(id).catch(() => {}) }, 4000)
    } catch (e) {
      Alert.alert('No se pudo entrar', e instanceof Error ? e.message : 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  const salir = useCallback(async () => {
    setEnLlamada(false)
    await finalizarSesion(id)
    router.replace(`/psicologo/informe/${id}`)
  }, [id])

  if (!sesion) return <Cargando />

  const ambos = sesion.consentimiento_participante && sesion.consentimiento_psicologo
  const codigo = caso?.codigo_anonimo ?? ''

  if (enLlamada && credenciales) {
    return (
      <Llamada
        url={credenciales.url}
        token={credenciales.token}
        onSalir={salir}
        onFallo={() => setEnLlamada(false)}
        etiqueta={[codigo, caso?.empresa].filter(Boolean).join(' · ')}
        grabando={ambos && credenciales.grabacion !== false}
      />
    )
  }

  return (
    <ScrollView contentContainerStyle={e.contenido}>
      <View style={e.fila}>
        <View style={e.enlace}>
          <View style={e.punto} />
          <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>ENLACE SEGURO · TLS 1.3</Text>
        </View>
        <View style={{ flex: 1 }} />
        {!!codigo && <Text style={[texto.etiqueta, { color: color.textoMedio }]}>ID: {codigo}</Text>}
      </View>

      <Text style={texto.titulo}>Preparación de sesión{codigo ? ` · ${codigo}` : ''}</Text>
      <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
        Sesión de apoyo confidencial e independiente de la empresa.
      </Text>

      <View style={e.marco}>
        <View style={[e.fila, { gap: 8 }]}>
          <IconoEscudo tamano={16} color={color.primarioProfundo} />
          <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>MARCO DE PRIVACIDAD Y CONSENTIMIENTO</Text>
        </View>
        <Text style={[texto.cuerpo, { color: color.texto }]}>La sesión se graba solo en audio y únicamente si ambos la autorizan.</Text>
        <Text style={[texto.cuerpo, { color: color.texto }]}>El audio se utiliza para generar un borrador de informe que tú revisas y apruebas.</Text>
        <Text style={[texto.cuerpo, { color: color.texto }]}>El participante nunca tiene acceso a la grabación ni a los apuntes clínicos.</Text>
      </View>

      <Autorizacion
        titulo="Tu autorización"
        detalle={sesion.consentimiento_psicologo ? 'Autorizaste la grabación en audio' : 'Pendiente de tu decisión'}
        dada={sesion.consentimiento_psicologo}
        accion={!sesion.consentimiento_psicologo ? { texto: 'Autorizar audio', onPress: autorizar } : undefined}
      />
      <Autorizacion
        titulo="Autorización del participante"
        detalle={sesion.consentimiento_participante ? 'Consentimiento otorgado en app' : 'Aún no la ha dado desde su app'}
        dada={sesion.consentimiento_participante}
      />

      <View style={e.nota}>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>
          {ambos ? (
            <><Text style={texto.cuerpoFuerte}>Ambos autorizaron: </Text>la sesión se grabará en audio y se transcribirá para el borrador del informe.</>
          ) : (
            <><Text style={texto.cuerpoFuerte}>Si nadie autoriza o tú decides no grabar: </Text>la sesión no se grabará bajo ninguna circunstancia. Puedes entrar de todas formas con normalidad clínica.</>
          )}
        </Text>
      </View>

      <View style={e.equipo}>
        <Text style={[texto.etiqueta, { color: color.textoSuave }]}>COMPROBACIÓN RÁPIDA DEL EQUIPO</Text>
        <View style={[e.fila, { gap: 8 }]}>
          <Chequeo icono={<IconoMicrofono tamano={16} color={color.texto} />} nombre="Micrófono" estado="Al entrar" />
          <Chequeo icono={<IconoVideo tamano={16} color={color.texto} />} nombre="Cámara" estado="Al entrar" />
          <Chequeo icono={<IconoWifi tamano={16} color={color.texto} />} nombre="Conexión" estado="Estable" />
        </View>
      </View>

      <Boton onPress={entrar} cargando={ocupado}>Entrar a la videollamada</Boton>
      {caso && (
        <Pressable onPress={() => router.push(`/psicologo/caso/${caso.derivacion_id}`)} style={[e.fila, { justifyContent: 'center' }]} accessibilityRole="link">
          <IconoNota tamano={14} color={color.textoMedio} />
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>Revisar ficha del caso antes de entrar</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

function Autorizacion({ titulo, detalle, dada, accion }: {
  titulo: string; detalle: string; dada: boolean; accion?: { texto: string; onPress: () => void }
}) {
  return (
    <View style={e.autorizacion}>
      <View style={[e.icono, dada && { backgroundColor: color.primario }]}>
        {dada ? <IconoCheck tamano={12} color="#FFFFFF" /> : <IconoCandado tamano={16} color={color.textoMedio} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
        <Text style={[texto.apoyo, { color: dada ? color.primarioProfundo : color.textoMedio }]}>{detalle}</Text>
      </View>
      {accion && (
        <Pressable onPress={accion.onPress} style={e.botonChico} accessibilityRole="button">
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{accion.texto}</Text>
        </Pressable>
      )}
      {dada && !accion && (
        <View style={[e.pastilla, { backgroundColor: color.primarioSuave }]}>
          <Text style={[texto.dato, { color: color.primarioProfundo }]}>Dada</Text>
        </View>
      )}
    </View>
  )
}

function Chequeo({ icono, nombre, estado }: { icono: React.ReactNode; nombre: string; estado: string }) {
  return (
    <View style={e.chequeo}>
      <View style={[e.fila, { gap: 4 }]}>{icono}<IconoCheck tamano={10} color={color.primario} /></View>
      <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{nombre}</Text>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>{estado}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: espacio.xxl, gap: espacio.md, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.fondo, flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficieSuave, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.primario },
  marco: { backgroundColor: color.primarioSuave, borderRadius: radio.xl, padding: espacio.md, gap: espacio.sm },
  autorizacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.md, borderWidth: 1, borderColor: color.borde },
  icono: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  botonChico: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radio.md, backgroundColor: color.superficieSuave },
  pastilla: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  nota: { backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.md },
  equipo: { backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.md, gap: espacio.sm, borderWidth: 1, borderColor: color.borde },
  chequeo: { flex: 1, backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.sm, gap: 2 },
})

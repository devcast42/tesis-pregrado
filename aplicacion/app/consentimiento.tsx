/** Consentimiento informado — producto.
 *
 *  ATENCIÓN: texto de trabajo. El definitivo lo revisa un abogado antes de
 *  venderlo, porque es la única base legal de que la empresa vea nombres.
 *  Al reemplazarlo, subir VERSION_TEXTO en modules/consentimiento/datos.ts.
 *
 *  Esta versión cambia lo más delicado del diseño anterior: aquí la empresa
 *  SÍ ve quién eres, si respondes y en qué nivel estás. En la rama de la
 *  tesis no lo ve nunca —solo promedios con un mínimo de diez respuestas—,
 *  y ese era el núcleo de lo que la hacía defendible ante un comité de ética.
 *
 *  Lo que no cambia, y es lo que hay que decir con todas las letras, es que
 *  la empresa no ve lo que respondiste ni lo que hablas con el psicólogo. El
 *  informe clínico es del psicólogo y del trabajador; entregárselo al
 *  empleador rompería el secreto profesional. Por eso el tercer punto está
 *  redactado en negativo: lo importante no es lo que se comparte, es lo que
 *  no. */

import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { obtenerTrabajador } from '../modules/acceso/datos'
import { registrarDecision } from '../modules/consentimiento/datos'
import { programarDiario, cancelarTodos } from '../modules/recoleccion/recordatorios'
import { Boton, Parrafo, Titulo } from '../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../modules/nucleo/diseno'

const PUNTOS = [
  'Responderás seis preguntas cada día, de lunes a viernes. Son unos 15 segundos. De vez en cuando, justo después, te pediremos un cuestionario algo más largo: cuando tus respuestas lo sugieran, por sorteo o si llevas un mes sin hacerlo.',
  'Tu empresa verá tu nombre, si vas respondiendo y en qué nivel estás: bajo, a vigilar o alto.',
  'Tu empresa NO verá lo que respondiste a cada pregunta, ni tus puntajes, ni nada de lo que hables con el psicólogo. Eso queda entre tú y él.',
  'Si aparecen señales de riesgo se te ofrecerá una sesión con un profesional de psicología. Aceptarla es voluntario, y tu empresa solo sabrá que estás en acompañamiento, nunca por qué.',
  'Puedes darte de baja cuando quieras, sin dar explicaciones. Tu empresa verá que dejaste de responder, nunca por qué.',
  'Cada sesión se graba solo en audio y solo si tú y el psicólogo lo autorizan en ese momento. El audio se transcribe con Deepgram y un borrador de informe se redacta con Claude (Anthropic) para que el psicólogo lo revise; la videollamada usa LiveKit y los datos se guardan en Supabase. El audio y la transcripción se borran al vencer su plazo.',
]

export default function Consentimiento() {
  const [trabajadorId, setTrabajadorId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [rechazado, setRechazado] = useState(false)

  useEffect(() => {
    obtenerTrabajador().then((p) => setTrabajadorId(p?.id ?? null))
  }, [])

  async function decidir(aceptado: boolean) {
    if (!trabajadorId) return
    setOcupado(true)
    try {
      // RN-001-03 — el rechazo se registra, no se omite.
      await registrarDecision(trabajadorId, aceptado)
      if (aceptado) {
        // El recordatorio es importante para la adherencia, pero no puede
        // bloquear la entrada: la decisión ya quedó registrada.
        // En Expo Go y en web devuelve false sin lanzar.
        await programarDiario().catch(() => false)
        router.replace('/hoy')
      } else {
        await cancelarTodos()
        setRechazado(true)
      }
    } finally {
      setOcupado(false)
    }
  }

  // RF-001-06 — al rechazar no se pide ningún dato, y se explica cómo volver.
  if (rechazado) {
    return (
      <View style={e.centro}>
        <Titulo>Gracias por tu tiempo</Titulo>
        <Parrafo suave>
          No registraremos ninguna información tuya. Si cambias de opinión, puedes volver a
          abrir la app y aceptar las condiciones en cualquier momento.
        </Parrafo>
        <Boton variante="texto" onPress={() => setRechazado(false)}>
          Volver a leer las condiciones
        </Boton>
      </View>
    )
  }

  return (
    <View style={e.pantalla}>
      <ScrollView contentContainerStyle={e.scroll}>
        <Titulo>Antes de empezar</Titulo>

        <Parrafo>
          Esta app busca detectar a tiempo las señales de agotamiento laboral y ponerte en
          contacto con un psicólogo si hace falta.
        </Parrafo>

        <View style={e.puntos}>
          {PUNTOS.map((punto, i) => (
            <View key={i} style={e.punto}>
              <View style={e.vineta} />
              <Text style={[texto.cuerpo, e.puntoTexto]}>{punto}</Text>
            </View>
          ))}
        </View>

        <View style={e.nota}>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Este sistema es una herramienta de apoyo y no constituye un diagnóstico clínico.
          </Text>
        </View>

      </ScrollView>

      <View style={e.pie}>
        <Boton onPress={() => decidir(true)} inhabilitado={!trabajadorId} cargando={ocupado}>
          Acepto y continúo
        </Boton>
        <Boton variante="texto" onPress={() => decidir(false)} inhabilitado={!trabajadorId}>
          Ahora no
        </Boton>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: espacio.lg, gap: espacio.base, backgroundColor: color.fondo,
    maxWidth: ancho.formulario, alignSelf: 'center',
  },
  scroll: {
    padding: espacio.lg, gap: espacio.base, paddingBottom: espacio.xl,
    width: '100%', maxWidth: ancho.formulario, alignSelf: 'center',
  },
  puntos: { gap: espacio.md, paddingVertical: espacio.sm },
  punto: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start' },
  vineta: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: color.primario, marginTop: 9,
  },
  puntoTexto: { flex: 1, color: color.textoMedio },
  nota: {
    padding: espacio.base, borderRadius: radio.md,
    backgroundColor: color.primarioSuave,
  },
  pie: {
    padding: espacio.lg, gap: espacio.sm,
    borderTopWidth: 1, borderTopColor: color.borde,
    backgroundColor: color.superficie,
    width: '100%', maxWidth: ancho.formulario, alignSelf: 'center',
  },
})

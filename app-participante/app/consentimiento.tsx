/** Consentimiento informado — implementa ESP-001 (RF-001-04 … RF-001-06).
 *
 *  ATENCIÓN: el texto de abajo es un marcador de posición. El definitivo debe
 *  ser el aprobado por el comité de ética (ESP-001 §9, pendiente 1). Al
 *  reemplazarlo, incrementar VERSION_TEXTO en modules/consentimiento/datos.ts
 *  para que quede registro de qué versión aceptó cada participante. */

import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { obtenerParticipante } from '../modules/acceso/datos'
import { registrarDecision } from '../modules/consentimiento/datos'
import { programarDiario, cancelarTodos } from '../modules/recoleccion/recordatorios'
import { Boton, Parrafo, Titulo } from '../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../modules/nucleo/diseno'

const PUNTOS = [
  'Responderás un check-in breve cada día (unos 30 segundos) y un cuestionario más completo cada dos semanas.',
  'Tus respuestas se guardan bajo un código anónimo. Tu empresa no accede a tus respuestas individuales.',
  'Puedes retirar tu consentimiento en cualquier momento, sin dar explicaciones y sin consecuencia alguna.',
  'Si el sistema identifica señales de riesgo, se te ofrecerá una sesión de apoyo con un profesional de psicología. Aceptarla es voluntario.',
  // RN-004-07 — los proveedores se declaran aquí, antes de reclutar (PB-28).
  'Cada sesión de apoyo se graba solo en audio y solo si tú y el psicólogo lo autorizan en ese momento. El audio se transcribe con Deepgram y un borrador de informe se redacta con Claude (Anthropic) para que el psicólogo lo revise; la videollamada usa LiveKit y los datos se guardan en Supabase. El audio y la transcripción se borran automáticamente al vencer el plazo fijado por el comité de ética.',
]

export default function Consentimiento() {
  const [participanteId, setParticipanteId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [rechazado, setRechazado] = useState(false)

  useEffect(() => {
    obtenerParticipante().then((p) => setParticipanteId(p?.id ?? null))
  }, [])

  async function decidir(aceptado: boolean) {
    if (!participanteId) return
    setOcupado(true)
    try {
      // RN-001-03 — el rechazo se registra, no se omite.
      await registrarDecision(participanteId, aceptado)
      if (aceptado) {
        // El recordatorio es importante para la adherencia, pero no puede
        // bloquear la entrada al estudio: la decisión ya quedó registrada.
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
          abrir la app y aceptar el consentimiento en cualquier momento.
        </Parrafo>
        <Boton variante="texto" onPress={() => setRechazado(false)}>
          Volver a leer el consentimiento
        </Boton>
      </View>
    )
  }

  return (
    <View style={e.pantalla}>
      <ScrollView contentContainerStyle={e.scroll}>
        <Titulo>Antes de empezar</Titulo>

        <Parrafo>
          Este estudio busca detectar de forma temprana señales de agotamiento laboral en
          profesionales del sector tecnológico.
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

        <Text style={[texto.apoyo, { color: color.textoSuave }]}>
          [Texto pendiente de aprobación por el comité de ética]
        </Text>
      </ScrollView>

      <View style={e.pie}>
        <Boton onPress={() => decidir(true)} inhabilitado={!participanteId} cargando={ocupado}>
          Acepto participar
        </Boton>
        <Boton variante="texto" onPress={() => decidir(false)} inhabilitado={!participanteId}>
          No deseo participar
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

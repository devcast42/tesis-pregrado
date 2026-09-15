/** Pantalla de formulario — implementa ESP-002 (RF-002-03, RF-002-04).
 *
 *  Sirve a los cuatro instrumentos: la ruta recibe la clave y todo lo demás
 *  proviene de la definición almacenada en base de datos. */

import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { obtenerParticipante } from '../../modules/acceso/datos'
import { enviarRespuesta, obtenerFormulario, registrarInicio } from '../../modules/recoleccion/datos'
import { Formulario as FormularioUI } from '../../modules/recoleccion/componentes/Formulario'
import type { ClaveFormulario, Formulario, Valores } from '../../modules/nucleo/tipos'
import { Cargando } from '../../modules/nucleo/ui'

export default function PantallaFormulario() {
  const { clave } = useLocalSearchParams<{ clave: ClaveFormulario }>()
  const navegacion = useNavigation()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [participanteId, setParticipanteId] = useState<string | null>(null)
  const [iniciadoEn, setIniciadoEn] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // RN-002-03 — `iniciado_en` se captura al MONTAR, no al enviar. Es la mitad
  // del indicador de tiempo de detección de la tesis.
  useEffect(() => {
    let vigente = true

    async function preparar() {
      const participante = await obtenerParticipante()
      if (!participante || !vigente) return

      const def = await obtenerFormulario(clave)
      if (!vigente) return

      const marca = await registrarInicio(participante.id, clave)
      if (!vigente) return

      setParticipanteId(participante.id)
      setFormulario(def)
      setIniciadoEn(marca)
      navegacion.setOptions({ title: def.definicion.titulo })
    }

    preparar().catch(() => {
      Alert.alert('No se pudo cargar', 'Revisa tu conexión e inténtalo de nuevo.')
      router.back()
    })

    return () => {
      vigente = false
    }
  }, [clave, navegacion])

  async function enviar(valores: Valores) {
    if (!formulario || !participanteId || !iniciadoEn) return

    setEnviando(true)
    try {
      await enviarRespuesta({ participanteId, formulario, iniciadoEn, valores })
      router.back()
    } catch {
      Alert.alert(
        'No se pudo enviar',
        'Tus respuestas no se han perdido. Revisa tu conexión e inténtalo de nuevo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  if (!formulario) return <Cargando />

  return (
    <FormularioUI
      definicion={formulario.definicion}
      enviando={enviando}
      onEnviar={enviar}
    />
  )
}

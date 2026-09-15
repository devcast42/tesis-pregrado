/** Puerta de entrada — implementa ESP-001 (RF-001-03) y ESP-006 (RF-006-13).
 *  Solo decide a dónde va cada quien; no contiene lógica de dominio. */

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Cargando } from '../modules/nucleo/ui'
import { color, espacio, texto } from '../modules/nucleo/diseno'
import { haySesion, obtenerParticipante } from '../modules/acceso/datos'
import { obtenerRol, RUTA_INICIAL } from '../modules/nucleo/rol'
import { puedeRecolectar } from '../modules/consentimiento/datos'

export default function Index() {
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function decidir() {
      if (!(await haySesion())) return router.replace('/acceso')

      // RF-006-13 — enrutamiento por rol, sin selector manual.
      const rol = await obtenerRol()
      if (!vigente) return

      if (rol === 'psicologo' || rol === 'investigador' || rol === 'admin') {
        return router.replace(RUTA_INICIAL[rol])
      }

      const participante = await obtenerParticipante()
      if (!vigente) return

      // RF-001-03 — la inscripción la hace el equipo de investigación.
      if (!participante) {
        return setMensaje(
          'Tu cuenta aún no está vinculada al estudio. Contacta al equipo de investigación.',
        )
      }

      if (participante.estado !== 'activo') {
        return setMensaje(
          'Tu seguimiento ha finalizado. El equipo de investigación se pondrá en contacto contigo.',
        )
      }

      const consentido = await puedeRecolectar(participante.id)
      if (!vigente) return

      router.replace(consentido ? '/hoy' : '/consentimiento')
    }

    decidir().catch(() =>
      setMensaje('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'),
    )

    return () => {
      vigente = false
    }
  }, [])

  if (!mensaje) return <Cargando />

  return (
    <View style={estilos.centro}>
      <Text style={estilos.mensaje}>{mensaje}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: espacio.xl, backgroundColor: color.fondo,
  },
  mensaje: { ...texto.cuerpo, color: color.textoMedio, textAlign: 'center', maxWidth: 420 },
})

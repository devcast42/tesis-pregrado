/** Puerta de entrada — implementa ESP-001 (RF-001-03) y ESP-006 (RF-006-13).
 *  Solo decide a dónde va cada quien; no contiene lógica de dominio. */

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Cargando } from '../modules/nucleo/ui'
import { color, espacio, texto } from '../modules/nucleo/diseno'
import { haySesion, obtenerTrabajador } from '../modules/acceso/datos'
import { necesitaDesbloqueo } from '../modules/acceso/bloqueo'
import { obtenerRol, RUTA_INICIAL } from '../modules/nucleo/rol'
import { puedeRecolectar } from '../modules/consentimiento/datos'

export default function Index() {
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function decidir() {
      if (!(await haySesion())) return router.replace('/acceso')

      // RF-001-08 — con sesión guardada, la huella va antes que cualquier dato.
      if (await necesitaDesbloqueo()) return router.replace('/bloqueo')

      // RF-006-13 — enrutamiento por rol, sin selector manual.
      const rol = await obtenerRol()
      if (!vigente) return

      if (rol === 'psicologo' || rol === 'investigador' || rol === 'admin') {
        return router.replace(RUTA_INICIAL[rol])
      }

      const trabajador = await obtenerTrabajador()
      if (!vigente) return

      // RF-001-03 — la inscripción la hace el equipo de investigación.
      if (!trabajador) {
        return setMensaje(
          'Tu cuenta aún no está vinculada al estudio. Contacta al equipo de investigación.',
        )
      }

      // Un trabajador detectado sigue entrando: ve su resultado, recibe la
      // sesión de apoyo y la atiende desde aquí (ESP-002 RF-002-12, ESP-004).
      // Solo quien se retiró o terminó el estudio ve el cierre.
      if (trabajador.estado === 'retirado' || trabajador.estado === 'finalizado') {
        return setMensaje(
          trabajador.estado === 'retirado'
            ? 'Te retiraste del estudio. Si fue un error, escríbele al equipo de investigación.'
            : 'El estudio terminó. Gracias por acompañarnos estas semanas.',
        )
      }

      const consentido = await puedeRecolectar(trabajador.id)
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

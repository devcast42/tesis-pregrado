/** Puerta de entrada — implementa ESP-001 (RF-001-03) y ESP-006 (RF-006-13).
 *  Solo decide a dónde va cada quien; no contiene lógica de dominio. */

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Cargando } from '../modules/nucleo/ui'
import { color, espacio, texto } from '../modules/nucleo/diseno'
import { cerrarSesion, haySesion, obtenerTrabajador } from '../modules/acceso/datos'
import { SOLO_TRABAJADOR } from '../modules/nucleo/pwa'
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
        // La PWA se publica solo para trabajadores: los demás roles entran por
        // la aplicación móvil o el panel web.
        if (SOLO_TRABAJADOR) {
          await cerrarSesion()
          return setMensaje('Esta versión es solo para trabajadores. Ingresa desde la aplicación o el panel web de tu rol.')
        }
        return router.replace(RUTA_INICIAL[rol])
      }

      const trabajador = await obtenerTrabajador()
      if (!vigente) return

      // RF-001-03 — el alta la hace la empresa.
      if (!trabajador) {
        return setMensaje(
          'Tu cuenta aún no está activa. Pídele a tu empresa que te dé de alta.',
        )
      }

      // Un trabajador detectado sigue entrando: ve su resultado, recibe la
      // sesión de apoyo y la atiende desde aquí (ESP-002 RF-002-12, ESP-004).
      // Solo quien se dio de baja o terminó su seguimiento ve el cierre.
      if (trabajador.estado === 'retirado' || trabajador.estado === 'finalizado') {
        return setMensaje(
          trabajador.estado === 'retirado'
            ? 'Diste de baja tu cuenta. Si fue un error, avísale a tu empresa.'
            : 'Tu seguimiento terminó. Gracias por acompañarnos estas semanas.',
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

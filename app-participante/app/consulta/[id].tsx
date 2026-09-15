/** Videoconsulta, lado del participante — implementa ESP-004 RF-004-02.
 *
 *  El participante consiente su propia grabación aquí. Nunca ve el informe
 *  (RN-004-03): esta pantalla termina al colgar. */

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Llamada } from '../../modules/consulta/Llamada'
import { obtenerCredenciales, obtenerSesion } from '../../modules/consulta/datos'
import { supabase } from '../../modules/nucleo/supabase'
import type { Credenciales } from '../../modules/consulta/tipos'
import { Apoyo, Boton, Cargando, Pantalla, Parrafo, Titulo } from '../../modules/nucleo/ui'
import { espacio } from '../../modules/nucleo/diseno'

export default function ConsultaParticipante() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [sesion, setSesion] = useState<any>(null)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)
  const [enLlamada, setEnLlamada] = useState(false)

  const cargar = useCallback(async () => {
    setSesion(await obtenerSesion(id))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function autorizar() {
    await supabase
      .from('sesiones_consulta')
      .update({ consentimiento_participante: true })
      .eq('id', id)
    await cargar()
  }

  async function entrar() {
    setCredenciales(await obtenerCredenciales(id))
    setEnLlamada(true)
  }

  const salir = useCallback(() => {
    setEnLlamada(false)
    router.replace('/hoy')
  }, [])

  if (!sesion) return <Cargando />

  if (enLlamada && credenciales) {
    return <Llamada url={credenciales.url} token={credenciales.token} onSalir={salir} />
  }

  return (
    <Pantalla centrado>
      <Titulo>Sesión de apoyo</Titulo>

      <Parrafo suave>
        Vas a hablar con un profesional de psicología. La conversación puede grabarse
        solo en audio, y únicamente si tú lo autorizas, para que el profesional cuente
        con un resumen de la sesión.
      </Parrafo>

      <Parrafo suave>
        Puedes negarte y la sesión ocurre igual. La grabación se borra pasado el plazo
        acordado, y tu empresa nunca accede a ella.
      </Parrafo>

      <View style={e.acciones}>
        {sesion.consentimiento_participante ? (
          <Apoyo>Autorizaste la grabación de esta sesión.</Apoyo>
        ) : (
          <Boton variante="secundario" onPress={autorizar}>
            Autorizo que se grabe el audio
          </Boton>
        )}

        <Boton onPress={entrar}>Entrar a la sesión</Boton>
      </View>
    </Pantalla>
  )
}

const e = StyleSheet.create({
  acciones: { gap: espacio.md, paddingTop: espacio.sm },
})

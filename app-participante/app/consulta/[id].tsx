/** Videoconsulta, lado del participante — implementa ESP-004 RF-004-02.
 *
 *  El participante consiente su propia grabación aquí. Nunca ve el informe
 *  (RN-004-03): esta pantalla termina al colgar. */

import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Llamada } from '../../modules/consulta/Llamada'
import { iniciarGrabacion, obtenerCredenciales, obtenerSesion } from '../../modules/consulta/datos'
import { supabase } from '../../modules/nucleo/supabase'
import type { Credenciales } from '../../modules/consulta/tipos'
import { Apoyo, Boton, Cargando, Pantalla, Parrafo, Titulo } from '../../modules/nucleo/ui'
import { espacio } from '../../modules/nucleo/diseno'

export default function ConsultaParticipante() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [sesion, setSesion] = useState<any>(null)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)
  const [enLlamada, setEnLlamada] = useState(false)
  const [ocupado, setOcupado] = useState<'autorizar' | 'entrar' | null>(null)

  const cargar = useCallback(async () => {
    setSesion(await obtenerSesion(id))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function autorizar() {
    if (ocupado) return
    setOcupado('autorizar')
    try {
      await supabase
        .from('sesiones_consulta')
        .update({ consentimiento_participante: true })
        .eq('id', id)
      await cargar()
      // Si la otra parte ya autorizó y ya hay alguien en la sala, la
      // grabación arranca ahora; si no, lo hará el siguiente que entre.
      iniciarGrabacion(id).catch(() => {})
    } finally { setOcupado(null) }
  }

  // Pedir el token tarda unos segundos (y arranca la grabación): el botón se
  // bloquea mientras tanto para que no se pida dos veces.
  async function entrar() {
    if (ocupado) return
    setOcupado('entrar')
    try {
      setCredenciales(await obtenerCredenciales(id))
      setEnLlamada(true)
      // Ya dentro (la sala existe): un intento más por si el token salió antes de que existiera.
      setTimeout(() => { iniciarGrabacion(id).catch(() => {}) }, 4000)
    } catch (e) {
      Alert.alert('No se pudo entrar', e instanceof Error ? e.message : 'Inténtalo de nuevo.')
    } finally { setOcupado(null) }
  }

  const salir = useCallback(() => {
    setEnLlamada(false)
    router.replace('/hoy')
  }, [])

  if (!sesion) return <Cargando />

  if (enLlamada && credenciales) {
    return <Llamada url={credenciales.url} token={credenciales.token} onSalir={salir} onFallo={() => setEnLlamada(false)} />
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
          <Boton variante="secundario" onPress={autorizar} cargando={ocupado === 'autorizar'} inhabilitado={ocupado === 'entrar'}>
            Autorizo que se grabe el audio
          </Boton>
        )}

        <Boton onPress={entrar} cargando={ocupado === 'entrar'} inhabilitado={ocupado === 'autorizar'}>Entrar a la sesión</Boton>
      </View>
    </Pantalla>
  )
}

const e = StyleSheet.create({
  acciones: { gap: espacio.md, paddingTop: espacio.sm },
})

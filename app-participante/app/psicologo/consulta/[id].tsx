/** Videoconsulta, lado del psicólogo — implementa ESP-004 RF-004-01 … RF-004-04.
 *
 *  La grabación exige consentimiento de ambas partes (RN-004-06). Si falta
 *  alguno, la sesión ocurre igual pero sin grabar ni transcribir. */

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Llamada } from '../../../modules/consulta/Llamada'
import {
  finalizarSesion,
  obtenerCredenciales,
  obtenerSesion,
} from '../../../modules/consulta/datos'
import { consentirGrabacion } from '../../../modules/psicologo/datos'
import type { Credenciales } from '../../../modules/consulta/tipos'
import { Apoyo, Boton, Cargando, Pantalla, Parrafo, Titulo } from '../../../modules/nucleo/ui'
import { color, espacio, texto } from '../../../modules/nucleo/diseno'

export default function Consulta() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [sesion, setSesion] = useState<any>(null)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)
  const [enLlamada, setEnLlamada] = useState(false)

  const cargar = useCallback(async () => {
    setSesion(await obtenerSesion(id))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function marcarConsentimiento() {
    await consentirGrabacion(id, 'psicologo')
    await cargar()
  }

  async function entrar() {
    setCredenciales(await obtenerCredenciales(id))
    setEnLlamada(true)
  }

  const salir = useCallback(async () => {
    setEnLlamada(false)
    await finalizarSesion(id)
    router.replace(`/psicologo/informe/${id}`)
  }, [id])

  if (!sesion) return <Cargando />

  if (enLlamada && credenciales) {
    return <Llamada url={credenciales.url} token={credenciales.token} onSalir={salir} />
  }

  const ambos = sesion.consentimiento_participante && sesion.consentimiento_psicologo

  return (
    <Pantalla centrado>
      <Titulo>Antes de comenzar</Titulo>

      <Parrafo suave>
        Esta sesión se graba solo en audio, y únicamente si tanto tú como la persona
        participante lo autorizan. La grabación se transcribe para generar un borrador
        de informe que tú revisas y corriges.
      </Parrafo>

      <View style={e.estado}>
        <Marca hecha={sesion.consentimiento_psicologo}>Tu autorización</Marca>
        <Marca hecha={sesion.consentimiento_participante}>Autorización del participante</Marca>
      </View>

      {!sesion.consentimiento_psicologo && (
        <Boton variante="secundario" onPress={marcarConsentimiento}>
          Autorizo la grabación
        </Boton>
      )}

      {/* RF-004-03 — sin ambos consentimientos la sesión ocurre igual, sin grabar. */}
      <Apoyo>
        {ambos
          ? 'La sesión se grabará y transcribirá.'
          : 'La sesión no se grabará. Puedes entrar de todas formas.'}
      </Apoyo>

      <Boton onPress={entrar}>Entrar a la videollamada</Boton>
    </Pantalla>
  )
}

function Marca({ hecha, children }: { hecha: boolean; children: string }) {
  return (
    <View style={e.marca}>
      <Text style={[texto.cuerpoFuerte, { color: hecha ? color.exito : color.textoSuave }]}>
        {hecha ? '✓' : '○'}
      </Text>
      <Text style={[texto.cuerpo, { color: hecha ? color.texto : color.textoMedio }]}>
        {children}
      </Text>
    </View>
  )
}

const e = StyleSheet.create({
  estado: { gap: espacio.sm, paddingVertical: espacio.sm },
  marca: { flexDirection: 'row', gap: espacio.md, alignItems: 'center' },
})

/** Pantalla principal del participante — implementa ESP-002 (RF-002-01, RF-002-08).
 *
 *  Se abre a diario, muchas veces con prisa. Lo primero que debe quedar claro
 *  es si queda algo por hacer o no; todo lo demás es secundario. */

import { useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { obtenerParticipante } from '../modules/acceso/datos'
import { ultimosEnvios } from '../modules/recoleccion/datos'
import { agendaDeHoy, type ItemAgenda } from '../modules/recoleccion/agenda'
import { Apoyo, Cargando, Pantalla, Parrafo, Tarjeta, Titulo } from '../modules/nucleo/ui'
import { color, espacio, texto } from '../modules/nucleo/diseno'
import { Text } from 'react-native'

export default function Hoy() {
  const [agenda, setAgenda] = useState<ItemAgenda[] | null>(null)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    const participante = await obtenerParticipante()
    if (!participante) return router.replace('/')
    setCodigo(participante.codigo_anonimo)
    setAgenda(agendaDeHoy(await ultimosEnvios(participante.id)))
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function refrescar() {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  if (!agenda) return <Cargando />

  const pendientes = agenda.filter((i) => !i.completado)
  const todoListo = pendientes.length === 0

  return (
    <Pantalla>
      <View style={e.encabezado}>
        <Titulo>{todoListo ? 'Todo listo por hoy' : 'Hoy te toca'}</Titulo>
        <Parrafo suave>
          {todoListo
            ? 'Gracias. Te avisaremos mañana para el siguiente check-in.'
            : pendientes.length === 1
              ? 'Una cosa pendiente. No toma más de un par de minutos.'
              : `${pendientes.length} cosas pendientes. No toman más de unos minutos.`}
        </Parrafo>
      </View>

      <View style={e.lista}>
        {agenda.map((item) => (
          <Tarjeta
            key={item.clave}
            tono={item.completado ? 'suave' : undefined}
            onPress={item.completado ? undefined : () => router.push(`/formulario/${item.clave}`)}
          >
            <View style={e.fila}>
              <View style={e.filaTexto}>
                <Text
                  style={[
                    texto.cuerpoFuerte,
                    { color: item.completado ? color.textoSuave : color.texto },
                  ]}
                >
                  {item.titulo}
                </Text>
                <Text style={[texto.apoyo, { color: color.textoSuave }]}>
                  {item.completado ? 'Completado' : item.duracion}
                </Text>
              </View>
              <Text
                style={[
                  texto.cuerpoFuerte,
                  { color: item.completado ? color.exito : color.primario },
                ]}
              >
                {item.completado ? '✓' : '→'}
              </Text>
            </View>
          </Tarjeta>
        ))}
      </View>

      {codigo && (
        <View style={e.pie}>
          <Apoyo>Tu código de participante: {codigo}</Apoyo>
        </View>
      )}
    </Pantalla>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm, paddingBottom: espacio.sm },
  lista: { gap: espacio.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, minHeight: 44 },
  filaTexto: { flex: 1, gap: 2 },
  pie: { alignItems: 'center', paddingTop: espacio.xl },
})

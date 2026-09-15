/** Casos asignados — implementa ESP-006 RF-006-02.
 *  Solo aparecen las derivaciones de este psicólogo: lo impone RLS. */

import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { listarDerivaciones, psicologoActual, type Derivacion } from '../../modules/psicologo/datos'
import { Cargando, Pantalla, Parrafo, Tarjeta, Titulo, Vacio } from '../../modules/nucleo/ui'
import { ancho, color, espacio, texto } from '../../modules/nucleo/diseno'

export default function CasosAsignados() {
  const [derivaciones, setDerivaciones] = useState<Derivacion[] | null>(null)
  const [nombre, setNombre] = useState('')

  const cargar = useCallback(async () => {
    const [lista, yo] = await Promise.all([listarDerivaciones(true), psicologoActual()])
    setDerivaciones(lista)
    setNombre(yo?.nombre ?? '')
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!derivaciones) return <Cargando />

  return (
    <Pantalla ancho={ancho.panel}>
      <View style={e.encabezado}>
        <Titulo>Casos asignados</Titulo>
        {nombre !== '' && <Parrafo suave>{nombre}</Parrafo>}
      </View>

      {derivaciones.length === 0 ? (
        <Vacio>No tienes casos abiertos. Te avisaremos cuando se te asigne uno.</Vacio>
      ) : (
        <View style={e.lista}>
          {derivaciones.map((d) => (
            <Tarjeta key={d.id} onPress={() => router.push(`/psicologo/caso/${d.id}`)}>
              <View style={e.fila}>
                <View style={e.filaTexto}>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                    {d.codigo_anonimo}
                  </Text>
                  <Text style={[texto.apoyo, { color: color.textoSuave }]}>
                    Derivado el {new Date(d.abierta_en).toLocaleDateString('es-PE')}
                  </Text>
                </View>
                <Text style={[texto.cuerpoFuerte, { color: color.primario }]}>→</Text>
              </View>
            </Tarjeta>
          ))}
        </View>
      )}
    </Pantalla>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.xs, paddingBottom: espacio.sm },
  lista: { gap: espacio.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, minHeight: 44 },
  filaTexto: { flex: 1, gap: 2 },
})

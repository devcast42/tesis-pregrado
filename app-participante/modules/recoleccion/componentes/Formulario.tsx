/** Formulario genérico — implementa ESP-002 (RF-002-02, RF-002-05).
 *
 *  Sirve a los cuatro instrumentos. Recibe la definición y devuelve los
 *  valores; no sabe nada de Supabase ni de qué instrumento está mostrando.
 *
 *  El OLBI son 16 preguntas: una barra de avance fija arriba evita la
 *  sensación de scroll interminable, que es lo que hace abandonar. */

import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { DefinicionFormulario, ValorItem, Valores } from '../../nucleo/tipos'
import { ancho, color, espacio, texto } from '../../nucleo/diseno'
import { Boton, Parrafo } from '../../nucleo/ui'
import { Campo } from './Campo'

type Props = {
  definicion: DefinicionFormulario
  enviando: boolean
  onEnviar: (valores: Valores) => void
}

export function Formulario({ definicion, enviando, onEnviar }: Props) {
  const [valores, setValores] = useState<Valores>({})
  const [faltantes, setFaltantes] = useState<string[]>([])

  function cambiar(clave: string, valor: ValorItem) {
    setValores((previos) => ({ ...previos, [clave]: valor }))
    setFaltantes((previos) => previos.filter((c) => c !== clave))
  }

  // RF-002-05 — no se admite envío incompleto. Un ítem vacío en un instrumento
  // psicométrico invalida la dimensión completa, no solo esa pregunta.
  function intentarEnviar() {
    const sinResponder = definicion.items
      .filter((item) => {
        const valor = valores[item.clave]
        return valor === undefined || valor === ''
      })
      .map((item) => item.clave)

    if (sinResponder.length > 0) return setFaltantes(sinResponder)
    onEnviar(valores)
  }

  const total = definicion.items.length
  const respondidos = definicion.items.filter(
    (i) => valores[i.clave] !== undefined && valores[i.clave] !== '',
  ).length
  const avance = total === 0 ? 0 : respondidos / total

  return (
    <View style={e.contenedor}>
      <View style={e.barra}>
        <View style={e.pista}>
          <View style={[e.avance, { width: `${avance * 100}%` }]} />
        </View>
        <Text style={[texto.apoyo, { color: color.textoSuave }]}>
          {respondidos} de {total}
        </Text>
      </View>

      <ScrollView contentContainerStyle={e.scroll} keyboardShouldPersistTaps="handled">
        {definicion.descripcion && (
          <View style={e.intro}>
            <Parrafo suave>{definicion.descripcion}</Parrafo>
          </View>
        )}

        {definicion.items.map((item) => (
          <Campo
            key={item.clave}
            item={item}
            valor={valores[item.clave]}
            onChange={(valor) => cambiar(item.clave, valor)}
            faltante={faltantes.includes(item.clave)}
          />
        ))}
      </ScrollView>

      <View style={e.pie}>
        {faltantes.length > 0 && (
          <Text style={[texto.apoyo, e.faltan]}>
            {faltantes.length === 1
              ? 'Falta una respuesta'
              : `Faltan ${faltantes.length} respuestas`}
          </Text>
        )}
        <Boton onPress={intentarEnviar} cargando={enviando}>
          Enviar
        </Boton>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: color.fondo },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingHorizontal: espacio.lg,
    paddingVertical: espacio.md,
    backgroundColor: color.fondo,
    borderBottomWidth: 1,
    borderBottomColor: color.borde,
  },
  pista: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.superficieSuave,
    overflow: 'hidden',
  },
  avance: { height: '100%', borderRadius: 3, backgroundColor: color.primario },
  scroll: {
    padding: espacio.lg,
    paddingBottom: espacio.xl,
    gap: espacio.md,
    width: '100%',
    maxWidth: ancho.formulario,
    alignSelf: 'center',
  },
  intro: { paddingBottom: espacio.xs },
  pie: {
    padding: espacio.lg,
    paddingTop: espacio.md,
    gap: espacio.sm,
    borderTopWidth: 1,
    borderTopColor: color.borde,
    backgroundColor: color.superficie,
    width: '100%',
    maxWidth: ancho.formulario,
    alignSelf: 'center',
  },
  faltan: { color: color.peligro, textAlign: 'center' },
})

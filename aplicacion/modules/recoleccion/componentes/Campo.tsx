/** Campo de formulario — implementa ESP-002 (RF-002-02).
 *
 *  Renderiza un ítem según su `tipo`. No conoce ningún instrumento concreto:
 *  agregar una pregunta al estudio es editar un JSON, no tocar este archivo. */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ItemDef, ValorItem } from '../../nucleo/tipos'
import { color, espacio, radio, texto, TOQUE_MINIMO } from '../../nucleo/diseno'
import { Entrada } from '../../nucleo/ui'

type Props = {
  item: ItemDef
  valor: ValorItem | undefined
  onChange: (valor: ValorItem) => void
  faltante?: boolean
}

export function Campo({ item, valor, onChange, faltante }: Props) {
  return (
    <View style={[e.campo, faltante && e.campoFaltante]}>
      <Text style={[texto.cuerpo, { color: color.texto }]}>{item.texto}</Text>

      {item.tipo === 'escala' && <Escala item={item} valor={valor} onChange={onChange} />}
      {item.tipo === 'booleano' && <Booleano valor={valor} onChange={onChange} />}
      {item.tipo === 'numero' && <Numero valor={valor} onChange={onChange} />}
      {item.tipo === 'opcion' && <Opciones item={item} valor={valor} onChange={onChange} />}

      {faltante && (
        <Text style={[texto.apoyo, { color: color.peligro }]}>Falta responder</Text>
      )}
    </View>
  )
}

/** Emojis de los extremos cuando la definición no los trae.
 *
 *  La mayoría de los ítems son negativos —cuanto más de acuerdo, peor—, así
 *  que el extremo izquierdo es el bueno. Pero la mitad del OLBI está escrita
 *  en positivo («me siento lleno de energía») y lleva `invertido`: ahí el
 *  recorrido va al revés y los emojis también, o la barra dice lo contrario
 *  de lo que la frase pregunta. */
const EXTREMOS: [string, string] = ['🙂', '😫']

function extremosDe(item: ItemDef): [string, string] {
  const propios = (item.escala as { emojis?: [string, string] } | undefined)?.emojis
  if (propios) return propios
  return item.invertido ? [EXTREMOS[1], EXTREMOS[0]] : EXTREMOS
}

/** Barra de tramos, no deslizador de verdad.
 *
 *  Se ve como un deslizador —se rellena, lleva emojis en las puntas— pero se
 *  contesta de un toque. Arrastrar es más lento y más impreciso, y esto se
 *  responde cuatro veces al día.
 *
 *  El valor sigue siendo un entero. No es cosmético: los pesos preentrenados
 *  se calcularon sobre la escala de 1 a 5, y un continuo cambiaría la
 *  distribución de las respuestas. */
function Barra({
  puntos, valor, onChange, emojis, etiquetas,
}: {
  puntos: (number | string)[]
  valor: ValorItem | undefined
  onChange: (v: ValorItem) => void
  emojis?: [string, string]
  etiquetas?: string[]
}) {
  const seleccionado = puntos.findIndex((p) => p === valor)
  const [izq, der] = emojis ?? EXTREMOS

  return (
    <View style={e.barraGrupo}>
      <View style={e.barraFila}>
        <Text style={e.emoji}>{izq}</Text>
        <View style={e.barra}>
          {puntos.map((punto, i) => (
            <Pressable
              key={String(punto)}
              onPress={() => onChange(punto)}
              accessibilityRole="radio"
              accessibilityState={{ selected: i === seleccionado }}
              accessibilityLabel={etiquetas?.[i] ?? String(punto)}
              style={({ pressed }) => [
                e.tramo,
                i === 0 && e.tramoPrimero,
                i === puntos.length - 1 && e.tramoUltimo,
                // Se rellena hasta donde tocaste: eso es lo que un deslizador
                // comunica y una fila de botones no.
                seleccionado >= 0 && i <= seleccionado && e.tramoLleno,
                i === seleccionado && e.tramoPunta,
                pressed && e.tramoPresionado,
              ]}
            />
          ))}
        </View>
        <Text style={e.emoji}>{der}</Text>
      </View>
      <Text style={[texto.apoyo, e.piePista]}>
        {seleccionado >= 0 ? (etiquetas?.[seleccionado] ?? String(puntos[seleccionado])) : 'Toca la barra'}
      </Text>
    </View>
  )
}

function Escala({ item, valor, onChange }: Pick<Props, 'item' | 'valor' | 'onChange'>) {
  const min = item.escala?.min ?? 1
  const max = item.escala?.max ?? 5
  return (
    <Barra
      puntos={Array.from({ length: max - min + 1 }, (_, i) => min + i)}
      valor={valor}
      onChange={onChange}
      emojis={extremosDe(item)}
      etiquetas={(item.escala as { etiquetas?: string[] } | undefined)?.etiquetas}
    />
  )
}

function Booleano({ valor, onChange }: Pick<Props, 'valor' | 'onChange'>) {
  return (
    <View style={e.fila}>
      <Opcion etiqueta="Sí" activo={valor === true} onPress={() => onChange(true)} />
      <Opcion etiqueta="No" activo={valor === false} onPress={() => onChange(false)} />
    </View>
  )
}

/** Sueño y jornada van en la misma barra: son rangos ordenados, y una lista
 *  vertical de cuatro botones comunica peor que un recorrido de menos a más.
 *  Las opciones sin orden —rol, modalidad— siguen como lista. */
function Opciones({ item, valor, onChange }: Pick<Props, 'item' | 'valor' | 'onChange'>) {
  const opciones = item.opciones ?? []
  if (!opciones.every((o) => typeof o.valor === 'number')) {
    return (
      <View style={e.columna}>
        {opciones.map((opcion) => (
          <Opcion
            key={String(opcion.valor)}
            etiqueta={opcion.etiqueta}
            activo={valor === opcion.valor}
            onPress={() => onChange(opcion.valor)}
            alineadoIzquierda
          />
        ))}
      </View>
    )
  }
  return (
    <Barra
      puntos={opciones.map((o) => o.valor)}
      valor={valor}
      onChange={onChange}
      emojis={extremosDe(item)}
      etiquetas={opciones.map((o) => o.etiqueta)}
    />
  )
}

function Numero({ valor, onChange }: Pick<Props, 'valor' | 'onChange'>) {
  return (
    <Entrada
      keyboardType="numeric"
      inputMode="decimal"
      value={valor === undefined ? '' : String(valor)}
      onChangeText={(t) => {
        const limpio = t.replace(',', '.')
        if (limpio === '') return onChange('')
        const numero = Number(limpio)
        if (!Number.isNaN(numero)) onChange(numero)
      }}
      placeholder="0"
    />
  )
}

function Opcion({
  etiqueta,
  activo,
  onPress,
  estilo,
  alineadoIzquierda,
}: {
  etiqueta: string
  activo: boolean
  onPress: () => void
  estilo?: object
  alineadoIzquierda?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={etiqueta}
      style={({ pressed }) => [
        e.opcion,
        alineadoIzquierda && e.opcionIzquierda,
        estilo,
        activo && e.opcionActiva,
        pressed && !activo && e.opcionPresionada,
      ]}
    >
      <Text
        style={[
          texto.cuerpoFuerte,
          { color: activo ? '#FFFFFF' : color.textoMedio },
        ]}
      >
        {etiqueta}
      </Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  barraGrupo: { gap: espacio.xs, marginTop: espacio.sm },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  emoji: { fontSize: 22 },
  barra: { flex: 1, flexDirection: 'row', gap: 3, height: TOQUE_MINIMO },
  tramo: { flex: 1, backgroundColor: color.superficieSuave, borderWidth: 1, borderColor: color.borde },
  tramoPrimero: { borderTopLeftRadius: radio.md, borderBottomLeftRadius: radio.md },
  tramoUltimo: { borderTopRightRadius: radio.md, borderBottomRightRadius: radio.md },
  tramoLleno: { backgroundColor: color.primarioSuave, borderColor: color.primario },
  tramoPunta: { backgroundColor: color.primario, borderColor: color.primario },
  tramoPresionado: { opacity: 0.7 },
  piePista: { color: color.textoMedio, textAlign: 'center' },
  campo: {
    gap: espacio.md,
    paddingVertical: espacio.base,
    paddingHorizontal: espacio.base,
    borderRadius: radio.lg,
    backgroundColor: color.superficie,
    borderWidth: 1,
    borderColor: color.borde,
  },
  campoFaltante: { borderColor: color.peligro },
  grupoEscala: { gap: espacio.sm },
  fila: { flexDirection: 'row', gap: espacio.sm },
  columna: { gap: espacio.sm },
  extremos: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.base },
  extremo: { color: color.textoSuave, flex: 1 },
  opcion: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: espacio.base,
    borderRadius: radio.md,
    borderWidth: 1,
    borderColor: color.bordeFuerte,
    backgroundColor: color.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  opcionIzquierda: { alignItems: 'flex-start' },
  opcionActiva: { backgroundColor: color.primario, borderColor: color.primario },
  opcionPresionada: { backgroundColor: color.primarioSuave, borderColor: color.primario },
  punto: { flex: 1, paddingHorizontal: 0 },
})

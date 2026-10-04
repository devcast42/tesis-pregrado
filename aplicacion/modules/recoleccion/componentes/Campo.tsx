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

function Escala({ item, valor, onChange }: Pick<Props, 'item' | 'valor' | 'onChange'>) {
  const min = item.escala?.min ?? 1
  const max = item.escala?.max ?? 5
  const puntos = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <View style={e.grupoEscala}>
      <View style={e.fila}>
        {puntos.map((punto) => (
          <Opcion
            key={punto}
            etiqueta={String(punto)}
            activo={valor === punto}
            onPress={() => onChange(punto)}
            estilo={e.punto}
          />
        ))}
      </View>

      {(item.escala?.etiquetaMin || item.escala?.etiquetaMax) && (
        <View style={e.extremos}>
          <Text style={[texto.apoyo, e.extremo]}>{item.escala?.etiquetaMin}</Text>
          <Text style={[texto.apoyo, e.extremo, { textAlign: 'right' }]}>
            {item.escala?.etiquetaMax}
          </Text>
        </View>
      )}
    </View>
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

function Opciones({ item, valor, onChange }: Pick<Props, 'item' | 'valor' | 'onChange'>) {
  return (
    <View style={e.columna}>
      {(item.opciones ?? []).map((opcion) => (
        <Opcion
          key={opcion.valor}
          etiqueta={opcion.etiqueta}
          activo={valor === opcion.valor}
          onPress={() => onChange(opcion.valor)}
          alineadoIzquierda
        />
      ))}
    </View>
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

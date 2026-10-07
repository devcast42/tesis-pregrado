/** Campo de formulario — implementa ESP-002 (RF-002-02).
 *
 *  Renderiza un ítem según su `tipo`. No conoce ningún instrumento concreto:
 *  agregar una pregunta al estudio es editar un JSON, no tocar este archivo. */

import { useCallback, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
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

/** La cara del pomo, de mejor a peor.
 *
 *  Se elige una rampa del largo de la escala para que los extremos siempre
 *  sean la mejor y la peor cara: con cinco puntos hay un neutro en medio, con
 *  cuatro no, que es exactamente la diferencia entre el diario y el OLBI. */
const RAMPAS: Record<number, string[]> = {
  2: ['🙂', '😫'],
  3: ['🙂', '😐', '😫'],
  4: ['😄', '🙂', '😟', '😫'],
  5: ['😄', '🙂', '😐', '😟', '😫'],
}

/** La rampa de un ítem, volteada si hace falta.
 *
 *  La mayoría de las preguntas son negativas —cuanto más de acuerdo, peor—,
 *  pero media del OLBI está escrita en positivo («me siento lleno de energía»)
 *  y lleva `invertido`. Sin voltear, esos ítems pondrían la cara triste en el
 *  extremo bueno y la barra diría lo contrario de lo que pregunta la frase. */
function rampaDe(item: ItemDef, n: number): string[] {
  const propia = (item.escala as { emojis?: string[] } | undefined)?.emojis
  const base = propia ?? RAMPAS[n] ?? RAMPAS[5]
  return item.invertido ? [...base].reverse() : base
}

/** Deslizador: se arrastra o se toca, y el pomo lleva la cara del valor.
 *
 *  El valor sigue siendo un entero —se ajusta al punto más cercano—. No es
 *  cosmético: los pesos preentrenados se calcularon sobre la escala de 1 a 5,
 *  y un continuo cambiaría la distribución de las respuestas.
 *
 *  Los tramos no reciben toques: el contenedor es quien responde, y así
 *  `locationX` llega siempre relativo a la barra entera y no al trozo que se
 *  tocó, que es lo que hacía saltar el valor al arrastrar. */
function Barra({
  puntos, valor, onChange, rampa, etiquetas,
}: {
  puntos: (number | string)[]
  valor: ValorItem | undefined
  onChange: (v: ValorItem) => void
  rampa: string[]
  etiquetas?: string[]
}) {
  const [ancho, setAncho] = useState(0)
  const n = puntos.length
  const seleccionado = puntos.findIndex((p) => p === valor)

  const indiceEn = useCallback((x: number) => {
    if (!ancho) return 0
    return Math.max(0, Math.min(n - 1, Math.round((x / ancho) * (n - 1))))
  }, [ancho, n])

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => mover(e.nativeEvent.locationX),
      onPanResponderMove: (e) => mover(e.nativeEvent.locationX),
    }),
  )
  // El responder se crea una vez; `mover` tiene que ver siempre el ancho y los
  // puntos actuales, así que vive en una ref en vez de capturarse.
  const moverRef = useRef<(x: number) => void>(() => {})
  const mover = (x: number) => moverRef.current(x)
  moverRef.current = (x: number) => {
    const i = indiceEn(x)
    if (i !== seleccionado) onChange(puntos[i])
  }

  const cara = seleccionado >= 0 ? rampa[seleccionado] : null
  const pie = seleccionado >= 0 ? (etiquetas?.[seleccionado] ?? String(puntos[seleccionado])) : 'Arrastra o toca'

  return (
    <View style={e.barraGrupo}>
      <View
        style={e.pista}
        onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)}
        {...responder.current.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: n - 1, now: Math.max(0, seleccionado) }}
      >
        <View style={e.riel} pointerEvents="none">
          {seleccionado >= 0 && (
            <View style={[e.rielLleno, { width: `${(seleccionado / (n - 1)) * 100}%` }]} />
          )}
        </View>
        <View style={e.paradas} pointerEvents="none">
          {puntos.map((punto, i) => (
            <View key={String(punto)} style={[e.parada, i <= seleccionado && e.paradaLlena]} />
          ))}
        </View>
        {seleccionado >= 0 && ancho > 0 && (
          <View
            pointerEvents="none"
            style={[e.pomo, { left: (seleccionado / (n - 1)) * (ancho - POMO) }]}
          >
            <Text style={e.pomoCara}>{cara}</Text>
          </View>
        )}
      </View>

      {/* Las etiquetas de los extremos, siempre visibles: en sueño y jornada
          son rangos («menos de 6 h»), y sin ellas el deslizador no dice qué
          se está eligiendo hasta que ya lo elegiste. */}
      {etiquetas && etiquetas.length > 0 && (
        <View style={e.extremosFila}>
          <Text style={[texto.dato, e.extremoTexto]}>{etiquetas[0]}</Text>
          <Text style={[texto.dato, e.extremoTexto, { textAlign: 'right' }]}>{etiquetas[n - 1]}</Text>
        </View>
      )}
      <Text style={[texto.apoyo, e.piePista]}>{pie}</Text>
    </View>
  )
}

function Escala({ item, valor, onChange }: Pick<Props, 'item' | 'valor' | 'onChange'>) {
  const min = item.escala?.min ?? 1
  const max = item.escala?.max ?? 5
  const puntos = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <Barra
      puntos={puntos}
      valor={valor}
      onChange={onChange}
      rampa={rampaDe(item, puntos.length)}
      etiquetas={(item.escala as { etiquetas?: string[] } | undefined)?.etiquetas}
    />
  )
}

/** Sueño y jornada van en el mismo deslizador: son rangos ordenados, y una
 *  lista vertical de cuatro botones comunica peor que un recorrido de menos a
 *  más. Las opciones sin orden —rol, modalidad— siguen como lista. */
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
      rampa={rampaDe(item, opciones.length)}
      etiquetas={opciones.map((o) => o.etiqueta)}
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

/** Diámetro del pomo. Vive fuera de los estilos porque la posición se
 *  calcula con él: el centro no puede salirse de la pista. */
const POMO = 34

const e = StyleSheet.create({
  barraGrupo: { gap: espacio.xs, marginTop: espacio.sm },
  // La pista es más alta que el riel a propósito: lo que se arrastra tiene
  // que aceptar un dedo entero, no la línea de 6 px que se ve.
  pista: { height: TOQUE_MINIMO, justifyContent: 'center' },
  riel: { height: 6, borderRadius: 3, backgroundColor: color.superficieSuave, overflow: 'hidden' },
  rielLleno: { height: 6, borderRadius: 3, backgroundColor: color.primario },
  paradas: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  parada: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.borde },
  paradaLlena: { backgroundColor: color.primarioProfundo },
  pomo: { position: 'absolute', width: POMO, height: POMO, borderRadius: POMO / 2, backgroundColor: color.superficie, borderWidth: 2, borderColor: color.primario, alignItems: 'center', justifyContent: 'center' },
  pomoCara: { fontSize: 20, lineHeight: 26 },
  extremosFila: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.sm },
  extremoTexto: { color: color.textoSuave, flex: 1 },
  piePista: { color: color.texto, textAlign: 'center' },
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

/** Piezas del panel del investigador.
 *
 *  Viven aquí y no en `nucleo/ui` porque solo tienen sentido en un panel de
 *  escritorio: una tarjeta de indicador o una barra de distribución no
 *  aparecen nunca en la app del participante. */

import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Tarjeta } from '../nucleo/ui'
import { color, espacio, radio, texto } from '../nucleo/diseno'

/** Tarjeta de indicador: rótulo arriba, cifra grande, nota al pie.
 *
 *  La nota no es decorativa. Un número sin denominador —"86"— invita a
 *  leerlo como grande o pequeño según el ánimo de quien mira; "86 · 6.9% del
 *  total" ya no. */
export function Indicador({
  rotulo, valor, nota, tono, tonoRotulo,
}: {
  rotulo: string
  valor: number | string
  nota?: string
  tono?: string
  tonoRotulo?: string
}) {
  return (
    <View style={e.indicador}>
      <Tarjeta>
        <View style={e.indicadorCuerpo}>
          <Text style={[texto.etiqueta, { color: tonoRotulo ?? color.textoSuave }]}>
            {rotulo.toUpperCase()}
          </Text>
          <Text style={[texto.cifra, { color: tono ?? color.texto }]}>{valor}</Text>
          {nota && (
            <Text style={[texto.apoyo, e.indicadorNota]}>{nota}</Text>
          )}
        </View>
      </Tarjeta>
    </View>
  )
}

/** Fila de la distribución: etiqueta, conteo y barra proporcional. */
export function Barra({
  etiqueta, cantidad, total, tono,
}: {
  etiqueta: string
  cantidad: number
  total: number
  tono: string
}) {
  const proporcion = total === 0 ? 0 : cantidad / total
  const porcentaje = (proporcion * 100).toFixed(1)

  return (
    <View style={e.barra}>
      <View style={e.barraCabecera}>
        <Text style={[texto.datoFuerte, { color: color.texto, flex: 1 }]}>{etiqueta}</Text>
        <Text style={[texto.dato, { color: color.textoSuave }]}>
          {cantidad} {cantidad === 1 ? 'participante' : 'participantes'} ({porcentaje}%)
        </Text>
      </View>
      <View style={e.barraPista}>
        <View
          style={[
            e.barraRelleno,
            { width: `${proporcion * 100}%`, backgroundColor: tono },
          ]}
        />
      </View>
    </View>
  )
}

/** Cuadrado con las iniciales. No es adorno: en una lista de doce empresas
 *  el ojo salta de monograma en monograma mucho más rápido que leyendo
 *  nombres que empiezan todos parecido. */
export function Monograma({ nombre }: { nombre: string }) {
  return (
    <View style={e.monograma}>
      <Text style={[texto.datoFuerte, { color: color.primario }]}>{iniciales(nombre)}</Text>
    </View>
  )
}

export function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '·'
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

/** Celda de tabla que identifica una entidad: monograma, nombre y una línea
 *  de contexto debajo. */
export function CeldaEntidad({
  nombre, detalle,
}: {
  nombre: string
  detalle?: string
}) {
  return (
    <View style={e.entidad}>
      <Monograma nombre={nombre} />
      <View style={e.entidadTexto}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]} numberOfLines={1}>
          {nombre}
        </Text>
        {detalle && (
          <Text style={[texto.dato, { color: color.textoSuave }]} numberOfLines={1}>
            {detalle}
          </Text>
        )}
      </View>
    </View>
  )
}

export type TonoInsignia = 'neutro' | 'exito' | 'alerta' | 'peligro' | 'primario'

const PALETA: Record<TonoInsignia, { fondo: string; borde: string; texto: string }> = {
  neutro:   { fondo: color.superficieSuave, borde: color.borde,     texto: color.textoMedio },
  exito:    { fondo: color.exitoSuave,      borde: '#DCFCE7',       texto: color.exito },
  alerta:   { fondo: color.alertaSuave,     borde: '#FEF3C7',       texto: color.alerta },
  peligro:  { fondo: color.peligroSuave,    borde: '#FEE2E2',       texto: color.peligro },
  primario: { fondo: color.primarioSuave,   borde: '#D0EDE7',       texto: color.primario },
}

export function Insignia({ children, tono = 'neutro' }: { children: string; tono?: TonoInsignia }) {
  const p = PALETA[tono]
  return (
    <View style={[e.insignia, { backgroundColor: p.fondo, borderColor: p.borde }]}>
      <Text style={[texto.insignia, { color: p.texto }]}>{children}</Text>
    </View>
  )
}

/** Iniciales de un nombre en un cuadro de color.
 *
 *  No identifica nada por sí sola —dos empresas pueden compartir iniciales—,
 *  pero da a cada fila un ancla visual: en una lista de cuatro nombres
 *  parecidos, el ojo vuelve al sitio correcto sin releer. */
export function Iniciales({ nombre }: { nombre: string }) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  const texto2 =
    palabras.length >= 2
      ? (palabras[0][0] + palabras[1][0])
      : (palabras[0] ?? '·').slice(0, 2)

  return (
    <View style={e.iniciales}>
      <Text style={[texto.datoFuerte, { color: color.primario }]}>
        {texto2.toUpperCase()}
      </Text>
    </View>
  )
}

/** Nombre con un segundo renglón de contexto, precedido por sus iniciales.
 *  La fila principal de los maestros que listan entidades con nombre. */
export function FilaEntidad({ nombre, detalle }: { nombre: string; detalle: string }) {
  return (
    <View style={e.filaEntidad}>
      <Iniciales nombre={nombre} />
      <View style={e.filaEntidadTexto}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]} numberOfLines={1}>
          {nombre}
        </Text>
        <Text style={[texto.dato, { color: color.textoSuave }]} numberOfLines={1}>
          {detalle}
        </Text>
      </View>
    </View>
  )
}

/** Tarjeta con título y descripción propios. El bloque que el panel repite
 *  para cada cosa que enseña. */
export function Bloque({
  titulo, descripcion, children, ancho,
}: {
  titulo: string
  descripcion?: string
  children: ReactNode
  /** flexBasis mínimo cuando el bloque comparte fila con otro. */
  ancho?: number
}) {
  return (
    <View style={ancho ? { flex: 1, minWidth: ancho } : undefined}>
      <Tarjeta>
        <View style={e.bloqueCabecera}>
          <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
          {descripcion && (
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>{descripcion}</Text>
          )}
        </View>
        {children}
      </Tarjeta>
    </View>
  )
}

/** Fila de lista con texto a la izquierda e insignia a la derecha. */
export function FilaLista({
  titulo, detalle, insignia, tono, ultima,
}: {
  titulo: string
  detalle: string
  insignia?: string
  tono?: TonoInsignia
  ultima?: boolean
}) {
  return (
    <View style={[e.filaLista, ultima && e.filaListaUltima]}>
      <View style={e.filaListaTexto}>
        <Text style={[texto.apoyoFuerte, { color: color.texto }]} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={[texto.dato, { color: color.textoSuave }]}>{detalle}</Text>
      </View>
      {insignia && <Insignia tono={tono}>{insignia}</Insignia>}
    </View>
  )
}

const e = StyleSheet.create({
  // Sin CSS grid: en React Native la rejilla se hace con flex que envuelve.
  // flexBasis marca el ancho deseado y minWidth el punto en que baja de fila.
  indicador: { flexGrow: 1, flexBasis: 200, minWidth: 200 },
  indicadorCuerpo: { gap: espacio.sm },
  indicadorNota: { color: color.textoSuave, marginTop: espacio.xs },

  barra: { gap: espacio.sm },
  barraCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.sm },
  barraPista: {
    height: 10, borderRadius: radio.sm,
    backgroundColor: color.superficieSuave, overflow: 'hidden',
  },
  barraRelleno: { height: '100%', borderRadius: radio.sm },

  insignia: {
    paddingHorizontal: espacio.sm, paddingVertical: 3,
    borderRadius: radio.sm, borderWidth: 1, alignSelf: 'flex-start',
  },

  iniciales: {
    width: 32, height: 32, borderRadius: radio.sm,
    backgroundColor: color.primarioSuave,
    alignItems: 'center', justifyContent: 'center',
  },
  filaEntidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  filaEntidadTexto: { flex: 1, gap: 1 },

  monograma: {
    width: 32, height: 32, borderRadius: radio.sm,
    backgroundColor: color.primarioSuave,
    alignItems: 'center', justifyContent: 'center',
  },
  entidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  entidadTexto: { flex: 1, gap: 1 },

  bloqueCabecera: { gap: espacio.xs, paddingBottom: espacio.sm },

  filaLista: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingVertical: espacio.md,
    borderBottomWidth: 1, borderBottomColor: color.borde,
  },
  filaListaUltima: { borderBottomWidth: 0, paddingBottom: 0 },
  filaListaTexto: { flex: 1, gap: 2 },
})

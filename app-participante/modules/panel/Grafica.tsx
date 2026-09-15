/** Componente de gráfica de línea — panel del investigador.
 *
 *  Implementado con SVG nativo del navegador vía createElement de React.
 *  Funciona porque react-native-web mapea las llamadas de React al DOM real,
 *  y createElement('svg', ...) produce un elemento SVG válido en web.
 *
 *  No se usa en la app móvil del participante: el panel del investigador
 *  corre solo en web. Si se llama desde nativo, muestra un placeholder. */

import { createElement } from 'react'
import { Platform, Text, View } from 'react-native'
import { color, espacio, texto } from '../nucleo/diseno'

export type PuntoGrafica = {
  x: string     // etiqueta del eje X (fecha ISO o string corto)
  y: number | null
}

export type SerieGrafica = {
  etiqueta: string
  color: string
  puntos: PuntoGrafica[]
}

type Props = {
  series: SerieGrafica[]
  /** Mínimo del eje Y. Por defecto: mínimo de los datos. */
  yMin?: number
  /** Máximo del eje Y. Por defecto: máximo de los datos. */
  yMax?: number
  /** Línea horizontal punteada (umbral OLBI, etc.). */
  umbral?: number
  umbralEtiqueta?: string
  alto?: number
  /** Mostrar etiquetas del eje X (solo primero y último). */
  mostrarEjeX?: boolean
}

const MARGEN = { top: 12, right: 12, bottom: 28, left: 36 }

export function GraficaLinea({
  series,
  yMin,
  yMax,
  umbral,
  umbralEtiqueta,
  alto = 180,
  mostrarEjeX = true,
}: Props) {
  // En nativo, degradar a texto. El panel es web.
  if (Platform.OS !== 'web') {
    return (
      <View style={{ height: alto, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[texto.apoyo, { color: color.textoSuave }]}>
          Gráfica disponible solo en el panel web.
        </Text>
      </View>
    )
  }

  // Recopilar todos los puntos con valor para calcular dominio
  const todosLosValores = series
    .flatMap((s) => s.puntos.map((p) => p.y))
    .filter((v): v is number => v != null)

  if (todosLosValores.length === 0) {
    return (
      <View style={{ height: alto, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[texto.apoyo, { color: color.textoSuave }]}>Sin datos aún.</Text>
      </View>
    )
  }

  // Eje X: unión ordenada de todas las etiquetas X presentes
  const etiquetasX = [...new Set(
    series.flatMap((s) => s.puntos.map((p) => p.x))
  )].sort()

  const minVal = yMin ?? Math.floor(Math.min(...todosLosValores, umbral ?? Infinity) * 10) / 10
  const maxVal = yMax ?? Math.ceil(Math.max(...todosLosValores, umbral ?? -Infinity) * 10) / 10
  const rango = maxVal - minVal || 1

  // Dimensiones del área de trazado
  const W = 600 // viewBox width (se escala con CSS)
  const H = alto
  const pw = W - MARGEN.left - MARGEN.right
  const ph = H - MARGEN.top - MARGEN.bottom

  function cx(etiqueta: string): number {
    const i = etiquetasX.indexOf(etiqueta)
    if (etiquetasX.length === 1) return MARGEN.left + pw / 2
    return MARGEN.left + (i / (etiquetasX.length - 1)) * pw
  }

  function cy(valor: number): number {
    return MARGEN.top + ph - ((valor - minVal) / rango) * ph
  }

  // Construir polyline points para cada serie
  function puntos(serie: SerieGrafica): string {
    return serie.puntos
      .filter((p) => p.y != null)
      .map((p) => `${cx(p.x).toFixed(1)},${cy(p.y!).toFixed(1)}`)
      .join(' ')
  }

  // Líneas de cuadrícula horizontales (4 niveles)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + t * rango
    const y = cy(val)
    return { y, label: Number(val.toFixed(1)) }
  })

  // SVG construido con createElement para compatibilidad con react-native-web
  const e = (tag: string, props: Record<string, unknown>, ...children: unknown[]) =>
    createElement(tag, props, ...children)

  const svgContent = e('svg', {
    viewBox: `0 0 ${W} ${H}`,
    style: { width: '100%', height: alto, display: 'block', overflow: 'visible' },
    'aria-label': series.map((s) => s.etiqueta).join(' y '),
  },
    // Cuadrícula
    ...gridLines.map(({ y, label }) =>
      e('g', { key: `grid-${y}` },
        e('line', {
          x1: MARGEN.left, y1: y.toFixed(1),
          x2: W - MARGEN.right, y2: y.toFixed(1),
          stroke: '#E8E5E0', strokeWidth: 1,
        }),
        e('text', {
          x: MARGEN.left - 6, y: (y + 4).toFixed(1),
          textAnchor: 'end',
          fontSize: 11, fill: '#8A8580',
          fontFamily: 'Inter, system-ui, sans-serif',
        }, label),
      )
    ),

    // Umbral
    umbral != null && e('g', { key: 'umbral' },
      e('line', {
        x1: MARGEN.left, y1: cy(umbral).toFixed(1),
        x2: W - MARGEN.right, y2: cy(umbral).toFixed(1),
        stroke: '#B45309', strokeWidth: 1.5,
        strokeDasharray: '5 4',
      }),
      umbralEtiqueta && e('text', {
        x: W - MARGEN.right + 4, y: (cy(umbral) + 4).toFixed(1),
        fontSize: 10, fill: '#B45309',
        fontFamily: 'Inter, system-ui, sans-serif',
      }, umbralEtiqueta),
    ),

    // Series
    ...series.map((s) =>
      e('g', { key: s.etiqueta },
        // Línea
        e('polyline', {
          points: puntos(s),
          fill: 'none',
          stroke: s.color,
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }),
        // Puntos
        ...s.puntos
          .filter((p) => p.y != null)
          .map((p) =>
            e('circle', {
              key: p.x,
              cx: cx(p.x).toFixed(1),
              cy: cy(p.y!).toFixed(1),
              r: 3.5,
              fill: s.color,
              stroke: '#FAF9F7',
              strokeWidth: 1.5,
            })
          ),
      )
    ),

    // Eje X: solo primera y última etiqueta
    mostrarEjeX && etiquetasX.length > 0 && e('g', { key: 'ejeX' },
      e('text', {
        x: cx(etiquetasX[0]).toFixed(1),
        y: (H - 6).toFixed(1),
        textAnchor: 'middle',
        fontSize: 11, fill: '#8A8580',
        fontFamily: 'Inter, system-ui, sans-serif',
      }, etiquetaFecha(etiquetasX[0])),
      etiquetasX.length > 1 && e('text', {
        x: cx(etiquetasX[etiquetasX.length - 1]).toFixed(1),
        y: (H - 6).toFixed(1),
        textAnchor: 'middle',
        fontSize: 11, fill: '#8A8580',
        fontFamily: 'Inter, system-ui, sans-serif',
      }, etiquetaFecha(etiquetasX[etiquetasX.length - 1])),
    ),
  )

  return (
    <View>
      {svgContent as React.ReactNode}
      {/* Leyenda */}
      <View style={{ flexDirection: 'row', gap: espacio.base, paddingTop: espacio.sm, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <View key={s.etiqueta} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={[texto.dato, { color: color.textoSuave }]}>{s.etiqueta}</Text>
          </View>
        ))}
        {umbral != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <View style={{ width: 12, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: color.alerta }} />
            <Text style={[texto.dato, { color: color.alerta }]}>{umbralEtiqueta ?? 'Umbral'} (provisional)</Text>
          </View>
        )}
      </View>
    </View>
  )
}

/** Convierte '2026-09-11' en '11 sep' */
function etiquetaFecha(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  } catch {
    return iso.slice(5) // 'MM-DD'
  }
}

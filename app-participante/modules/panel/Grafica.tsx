/** Componente de gráfica de línea — panel del investigador.
 *
 *  Implementado con SVG nativo del navegador vía createElement de React.
 *  Funciona porque react-native-web mapea las llamadas de React al DOM real,
 *  y createElement('svg', ...) produce un elemento SVG válido en web.
 *
 *  No se usa en la app móvil del participante: el panel del investigador
 *  corre solo en web. Si se llama desde nativo, muestra un placeholder. */

import { createElement, type ReactNode } from 'react'
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
  /** Línea punteada, sin puntos: para referencias (promedio del estudio). */
  punteada?: boolean
}

/** Banda horizontal suave entre dos valores (umbrales de empresa). */
export type BandaGrafica = { desde: number; hasta: number; color: string; etiqueta?: string }

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
  /** Bandas de fondo (a vigilar / alto). Se pintan antes que todo. */
  bandas?: BandaGrafica[]
  /** Etiquetas del eje X en todos los puntos (semanas). */
  todasLasEtiquetasX?: boolean
  /** Texto de cada etiqueta del eje X (por defecto la fecha corta). */
  etiquetaX?: (x: string, i: number) => string
  /** Área suave bajo la primera serie. */
  area?: boolean
  /** Línea horizontal gris punteada (benchmark), sin etiqueta. */
  referencia?: number
  /** Sin cuadrícula ni eje Y (mini gráficas). */
  desnuda?: boolean
  /** Sin leyenda. */
  sinLeyenda?: boolean
  /** Línea vertical punteada en esta x (semana actual) con su etiqueta. */
  marcarX?: { x: string; etiqueta?: string }
  /** Colores de las etiquetas del eje X por posición (p. ej., la semana sin dato). */
  colorEtiquetaX?: (x: string, i: number) => string | undefined
}

const MARGEN_BASE = { top: 12, right: 12, bottom: 28, left: 36 }

export function GraficaLinea({
  series,
  yMin,
  yMax,
  umbral,
  umbralEtiqueta,
  alto = 180,
  mostrarEjeX = true,
  bandas = [],
  todasLasEtiquetasX = false,
  etiquetaX,
  area = false,
  referencia,
  desnuda = false,
  sinLeyenda = false,
  marcarX,
  colorEtiquetaX,
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

  const MARGEN = desnuda ? { top: 10, right: 10, bottom: mostrarEjeX ? 22 : 6, left: 10 } : MARGEN_BASE
  const minVal = yMin ?? Math.floor(Math.min(...todosLosValores, umbral ?? Infinity, referencia ?? Infinity, ...bandas.map((b) => b.desde)) * 10) / 10
  const maxVal = yMax ?? Math.ceil(Math.max(...todosLosValores, umbral ?? -Infinity, referencia ?? -Infinity, ...bandas.map((b) => b.hasta)) * 10) / 10
  const rango = maxVal - minVal || 1

  // Dimensiones del área de trazado
  // viewBox: las mini gráficas usan uno más angosto para que el texto no
  // se encoja al escalar al ancho de la tarjeta.
  const W = desnuda ? 340 : 600
  const H = alto
  const pw = W - MARGEN.left - MARGEN.right
  const ph = H - MARGEN.top - MARGEN.bottom

  function cx(etiqueta: string): number {
    const i = etiquetasX.indexOf(etiqueta)
    if (etiquetasX.length === 1) return MARGEN.left + pw / 2
    return MARGEN.left + (i / (etiquetasX.length - 1)) * pw
  }

  function cy(valor: number): number {
    // Acotado al área de trazado. Sin esto, un valor por debajo de `yMin`
    // —precisión cerca de 0 en una gráfica que empezaba en 40— se dibujaba
    // fuera de la caja, encima del texto que hubiera debajo.
    const y = MARGEN.top + ph - ((valor - minVal) / rango) * ph
    return Math.max(MARGEN.top, Math.min(MARGEN.top + ph, y))
  }

  // Construir polylines por tramo: un hueco (y nulo) corta la línea en lugar
  // de interpolarse — la discontinuidad es deliberada (RN-008-11).
  function tramos(serie: SerieGrafica): string[] {
    const orden = [...serie.puntos].sort((a, b) => etiquetasX.indexOf(a.x) - etiquetasX.indexOf(b.x))
    const out: string[] = []
    let actual: string[] = []
    for (const p of orden) {
      if (p.y == null) { if (actual.length) out.push(actual.join(' ')); actual = []; continue }
      actual.push(`${cx(p.x).toFixed(1)},${cy(p.y).toFixed(1)}`)
    }
    if (actual.length) out.push(actual.join(' '))
    return out
  }

  // Líneas de cuadrícula horizontales (4 niveles)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + t * rango
    const y = cy(val)
    return { y, label: Number(val.toFixed(1)) }
  })

  // SVG construido con createElement para compatibilidad con react-native-web
  const e = (tag: string, props: Record<string, unknown>, ...children: ReactNode[]) =>
    createElement(tag, props, ...children)

  const svgContent = e('svg', {
    viewBox: `0 0 ${W} ${H}`,
    style: { width: '100%', height: alto, display: 'block', overflow: 'visible' },
    'aria-label': series.map((s) => s.etiqueta).join(' y '),
  },
    // Bandas de fondo
    ...bandas.map((b, i) =>
      e('g', { key: `banda-${i}` },
        e('rect', {
          x: MARGEN.left, y: cy(Math.min(b.hasta, maxVal)).toFixed(1),
          width: pw, height: Math.max(0, cy(Math.max(b.desde, minVal)) - cy(Math.min(b.hasta, maxVal))).toFixed(1),
          fill: b.color,
        }),
        b.etiqueta && e('text', {
          x: W - MARGEN.right - 4, y: (cy(Math.min(b.hasta, maxVal)) + 11).toFixed(1),
          textAnchor: 'end', fontSize: 10, fill: '#8A8580',
          fontFamily: 'Inter, system-ui, sans-serif',
        }, b.etiqueta),
      )
    ),

    // Área bajo la primera serie
    area && series[0] && series[0].puntos.some((p) => p.y != null) && e('polygon', {
      key: 'area',
      points: (() => {
        const pts = series[0].puntos.filter((p) => p.y != null)
        const primero = pts[0], ultimo = pts[pts.length - 1]
        return [
          `${cx(primero.x).toFixed(1)},${cy(minVal).toFixed(1)}`,
          ...pts.map((p) => `${cx(p.x).toFixed(1)},${cy(p.y!).toFixed(1)}`),
          `${cx(ultimo.x).toFixed(1)},${cy(minVal).toFixed(1)}`,
        ].join(' ')
      })(),
      fill: series[0].color, opacity: 0.12,
    }),

    // Referencia (benchmark)
    referencia != null && e('line', {
      key: 'referencia',
      x1: MARGEN.left, y1: cy(referencia).toFixed(1), x2: W - MARGEN.right, y2: cy(referencia).toFixed(1),
      stroke: '#BDB8B1', strokeWidth: 1, strokeDasharray: '3 3',
    }),

    // Cuadrícula
    ...(desnuda ? [] : gridLines).map(({ y, label }) =>
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
        ...tramos(s).map((pts, k) => e('polyline', {
          key: `tramo-${k}`,
          points: pts,
          fill: 'none',
          stroke: s.color,
          strokeWidth: s.punteada ? 1.5 : 2,
          strokeDasharray: s.punteada ? '4 4' : undefined,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        })),
        // Puntos
        ...(s.punteada ? [] : s.puntos)
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

    // Marca vertical (semana actual)
    marcarX && etiquetasX.includes(marcarX.x) && e('g', { key: 'marca' },
      e('line', {
        x1: cx(marcarX.x).toFixed(1), y1: MARGEN.top, x2: cx(marcarX.x).toFixed(1), y2: (H - MARGEN.bottom).toFixed(1),
        stroke: '#57534E', strokeWidth: 1, strokeDasharray: '3 3',
      }),
      marcarX.etiqueta && e('rect', {
        x: (cx(marcarX.x) - 28).toFixed(1), y: (MARGEN.top - 2).toFixed(1), width: 56, height: 16, rx: 4, fill: '#3F3A36',
      }),
      marcarX.etiqueta && e('text', {
        x: cx(marcarX.x).toFixed(1), y: (MARGEN.top + 9.5).toFixed(1), textAnchor: 'middle',
        fontSize: 9, fontWeight: 600, fill: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif',
      }, marcarX.etiqueta),
    ),

    // Eje X: todas las etiquetas (semanas) …
    mostrarEjeX && todasLasEtiquetasX && e('g', { key: 'ejeXTodas' },
      ...etiquetasX.map((x, i) => e('text', {
        key: x,
        x: cx(x).toFixed(1), y: (H - 6).toFixed(1),
        textAnchor: i === 0 && desnuda ? 'start' : i === etiquetasX.length - 1 && desnuda ? 'end' : 'middle',
        fontSize: 10, fill: colorEtiquetaX?.(x, i) ?? (i === etiquetasX.length - 1 && etiquetaX && desnuda ? '#1C1917' : '#8A8580'),
        fontWeight: colorEtiquetaX?.(x, i) || (i === etiquetasX.length - 1 && etiquetaX && desnuda) ? 600 : 400,
        fontFamily: 'Inter, system-ui, sans-serif',
      }, etiquetaX ? etiquetaX(x, i) : etiquetaFecha(x))),
    ),
    // … o solo primera y última
    mostrarEjeX && !todasLasEtiquetasX && etiquetasX.length > 0 && e('g', { key: 'ejeX' },
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
      {!sinLeyenda && <View style={{ flexDirection: 'row', gap: espacio.base, paddingTop: espacio.sm, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <View key={s.etiqueta} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <View style={s.punteada
              ? { width: 12, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: s.color }
              : { width: 12, height: 3, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={[texto.dato, { color: color.textoSuave }]}>{s.etiqueta}</Text>
          </View>
        ))}
        {umbral != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <View style={{ width: 12, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: color.alerta }} />
            <Text style={[texto.dato, { color: color.alerta }]}>{umbralEtiqueta ?? 'Umbral'} (provisional)</Text>
          </View>
        )}
      </View>}
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

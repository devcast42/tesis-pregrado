/** Sistema de diseño.
 *
 *  Un solo lugar para color, tipografía, espaciado y forma. Las pantallas no
 *  inventan valores: si un tono o un tamaño no está aquí, es que no debería
 *  usarse.
 *
 *  Decisiones que responden al estudio, no al gusto:
 *
 *  · Paleta cálida y apagada. La app la abre alguien cansado, a diario,
 *    durante semanas, para hablar de su agotamiento. Un azul corporativo
 *    saturado se siente como un formulario de trabajo — justo lo que estamos
 *    midiendo. El verde azulado apagado sobre neutros cálidos se lee como
 *    cuidado, no como evaluación.
 *
 *  · Rojo reservado a errores de la app, nunca a los datos del participante.
 *    Nadie debe ver su propio estado pintado de alarma (ESP-004 RN-004-03 es
 *    la versión fuerte de esta misma idea).
 *
 *  · Objetivos táctiles de 52 px. Se responde con prisa y con una mano.
 *
 *  · Inter. En React Native el peso NO se elige con fontWeight cuando la
 *    fuente es propia: cada peso es un archivo distinto y hay que nombrarlo.
 *    Por eso los estilos de abajo llevan fontFamily y no fontWeight; mezclar
 *    ambos produce negritas sintéticas encima de la real. */

import type { TextStyle } from 'react-native'

export const color = {
  fondo: '#FAF9F7',
  superficie: '#FFFFFF',
  superficieSuave: '#F5F4F1',

  texto: '#1C1917',
  textoMedio: '#57534E',
  textoSuave: '#8A8580',

  borde: '#E8E5E0',
  bordeFuerte: '#D6D2CC',

  primario: '#0F766E',
  primarioOscuro: '#115E59',
  primarioSuave: '#EFF9F7',

  // Del rediseño de la app del participante (Figma). El primario profundo
  // es el color de tinta sobre fondos claros; los claros son fondos de
  // acento sobre el primario y del "hoy" en el ritmo semanal.
  primarioProfundo: '#005C55',
  primarioClaro: '#9CF2E8',
  primarioTenue: '#A3FAEF',

  // Arena: la insignia "Revisión quincenal". Cálido, sin competir con el verde.
  arena: '#E5DED8',
  // Tierra: la barra y el énfasis del nivel alto. Serio sin ser rojo.
  tierra: '#9A5B2B',
  tierraSuave: '#FBF3E6',
  textoArena: '#66625D',
  puntoFuturo: '#BDC9C6',

  exito: '#15803D',
  exitoSuave: '#F0FDF4',
  alerta: '#B45309',
  alertaSuave: '#FFFBEB',
  peligro: '#B4413C',
  peligroSuave: '#FEF2F2',
} as const

/** Un archivo por peso. Ver la nota de arriba. */
export const fuente = {
  regular: 'Inter_400Regular',
  media: 'Inter_500Medium',
  fuerte: 'Inter_600SemiBold',
} as const

/** Cifras alineadas en columna: sin esto, un 1 ocupa menos que un 8 y las
 *  tablas de números bailan. */
const tabular = { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] }

export const texto = {
  titulo:       { fontFamily: fuente.fuerte,  fontSize: 27, lineHeight: 34, letterSpacing: -0.4 },
  seccion:      { fontFamily: fuente.fuerte,  fontSize: 20, lineHeight: 27, letterSpacing: -0.2 },
  cuerpo:       { fontFamily: fuente.regular, fontSize: 16, lineHeight: 24 },
  cuerpoFuerte: { fontFamily: fuente.media,   fontSize: 16, lineHeight: 24 },
  apoyo:        { fontFamily: fuente.regular, fontSize: 14, lineHeight: 21 },
  apoyoFuerte:  { fontFamily: fuente.media,   fontSize: 14, lineHeight: 21 },
  dato:         { fontFamily: fuente.regular, fontSize: 13, lineHeight: 18, ...tabular },
  datoFuerte:   { fontFamily: fuente.media,   fontSize: 13, lineHeight: 18, ...tabular },
  etiqueta:     { fontFamily: fuente.fuerte,  fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  insignia:     { fontFamily: fuente.fuerte,  fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  cifra:        { fontFamily: fuente.fuerte,  fontSize: 34, lineHeight: 40, letterSpacing: -1, ...tabular },
} as const

/** Escala de 4. Usar los nombres, no los números. */
export const espacio = {
  xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48,
} as const

export const radio = { sm: 8, md: 12, lg: 16, xl: 20, completo: 999 } as const

/** Sombras muy tenues: dan profundidad sin ensuciar. */
export const sombra = {
  suave: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const

/** Ancho máximo de lectura. En web sin esto el texto se estira a 1400 px y
 *  se vuelve imposible de seguir. */
export const ancho = { formulario: 560, panel: 960 } as const

export const TOQUE_MINIMO = 52

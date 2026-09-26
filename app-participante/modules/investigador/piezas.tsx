/** Piezas del panel del investigador — ESP-009.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA.
 *
 *  Nada de aquí muestra nombres: códigos, empresas, cifras y fechas. */

import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { color, espacio, radio, texto } from '../nucleo/diseno'
import type { FilaParticipanteV2 } from './panel'

export const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

export const TONO = {
  tierra: { fondo: '#F3DDD2', tinta: '#8C4A2B' },
  tierraSuave: { fondo: '#FBEDE6', tinta: '#8C4A2B' },
  verde: { fondo: '#DDF3EA', tinta: color.primarioProfundo },
  verdeSuave: { fondo: '#EAF4EF', tinta: color.primarioProfundo },
  ambar: { fondo: '#FBEFD9', tinta: '#8A5A12' },
  gris: { fondo: '#EDEBE7', tinta: color.textoMedio },
  grisOscuro: { fondo: '#E4E1DC', tinta: color.texto },
}

export function Pastilla({ children, tono = TONO.gris, punto, icono, mono }: {
  children: string; tono?: { fondo: string; tinta: string }; punto?: boolean; icono?: ReactNode; mono?: boolean
}) {
  return (
    <View style={[e.pastilla, { backgroundColor: tono.fondo }]}>
      {punto && <View style={[e.punto, { backgroundColor: tono.tinta }]} />}
      {icono}
      <Text style={[texto.datoFuerte, { color: tono.tinta, fontSize: 11 }, mono && { fontFamily: MONO }]}>{children}</Text>
    </View>
  )
}

export function PastillaEstado({ estado }: { estado: FilaParticipanteV2['estado'] }) {
  const t = estado === 'detectado' ? TONO.tierra : estado === 'activo' ? TONO.verde : TONO.gris
  const nombre = { activo: 'Activo', detectado: 'Detectado', retirado: 'Retirado', finalizado: 'Finalizado' }[estado]
  return <Pastilla tono={t}>{nombre}</Pastilla>
}

export function PastillaNivel({ nivel }: { nivel: 'bajo' | 'a_vigilar' | 'alto' | null }) {
  if (!nivel) return <Text style={[texto.dato, { color: color.textoSuave }]}>—</Text>
  const t = nivel === 'alto' ? TONO.tierra : nivel === 'a_vigilar' ? TONO.ambar : TONO.verde
  return <Pastilla tono={t}>{nivel === 'alto' ? 'Alto' : nivel === 'a_vigilar' ? 'A vigilar' : 'Bajo'}</Pastilla>
}

export function Codigo({ children, tono = color.primarioProfundo, grande = false }: { children: string; tono?: string; grande?: boolean }) {
  return <Text style={[{ fontFamily: MONO, fontWeight: '700', color: tono, fontSize: grande ? 20 : 12, letterSpacing: 0.5 }]}>{children}</Text>
}

export function Mono({ children, tono = color.textoMedio, tamano = 11 }: { children: ReactNode; tono?: string; tamano?: number }) {
  return <Text style={{ fontFamily: MONO, color: tono, fontSize: tamano }}>{children}</Text>
}

export function Caja({ children, estilo, suave = false }: { children: ReactNode; estilo?: object; suave?: boolean }) {
  return <View style={[e.caja, suave && e.cajaSuave, estilo]}>{children}</View>
}

export function Rotulo({ children, tinta = color.textoMedio }: { children: string; tinta?: string }) {
  return <Text style={[texto.etiqueta, { color: tinta, fontSize: 10.5, letterSpacing: 1 }]}>{children.toUpperCase()}</Text>
}

/** Encabezado de página: eyebrow con punto, título y subtítulo; a la derecha, lo que sea. */
export function Encabezado({ eyebrow, titulo, subtitulo, derecha }: { eyebrow: string; titulo: string; subtitulo?: string; derecha?: ReactNode }) {
  return (
    <View style={e.encabezado}>
      <View style={{ flex: 1, gap: 6, minWidth: 300 }}>
        <View style={[e.fila, { gap: 6 }]}>
          <View style={[e.punto, { backgroundColor: color.primario }]} />
          <Rotulo>{eyebrow}</Rotulo>
        </View>
        <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>{titulo}</Text>
        {subtitulo && <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 620 }]}>{subtitulo}</Text>}
      </View>
      {derecha}
    </View>
  )
}

/** Cifra con rótulo e ícono (tarjetas del encabezado de Hoy y Desempeño). */
export function Cifra({ rotulo, valor, nota, icono, tinta = color.texto, fondoIcono = '#EAF4EF' }: {
  rotulo: string; valor: string; nota?: string; icono?: ReactNode; tinta?: string; fondoIcono?: string
}) {
  return (
    <Caja estilo={{ flex: 1, minWidth: 180, paddingVertical: 14 }}>
      <View style={[e.fila, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Rotulo>{rotulo}</Rotulo>
          <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}>
            <Text style={[texto.cifra, { color: tinta, fontSize: 28, lineHeight: 32 }]}>{valor}</Text>
            {nota && <Text style={[texto.dato, { color: color.textoMedio }]}>{nota}</Text>}
          </View>
        </View>
        {icono && <View style={[e.cuadroIcono, { backgroundColor: fondoIcono }]}>{icono}</View>}
      </View>
    </Caja>
  )
}

export function BotonChico({ children, onPress, tono = 'borde', icono }: {
  children: string; onPress: () => void; tono?: 'borde' | 'tierra' | 'verde' | 'suave'; icono?: ReactNode
}) {
  const estilo = tono === 'tierra' ? e.botonTierra : tono === 'verde' ? e.botonVerde : tono === 'suave' ? e.botonSuave : e.botonBorde
  const tinta = tono === 'tierra' || tono === 'verde' ? '#FFFFFF' : color.texto
  return (
    <Pressable onPress={onPress} style={[e.boton, estilo]} accessibilityRole="button">
      {icono}
      <Text style={[texto.datoFuerte, { color: tinta }]}>{children}</Text>
    </Pressable>
  )
}

/** Barra de adherencia (tabla de participantes). */
/** Barra de adherencia. Recibe la TASA tal como la da la base: una fracción
 *  de 0 a 1, no un porcentaje.
 *
 *  Antes recibía «pct» y cada pantalla decidía si convertir. La lista de
 *  Participantes pasaba el 0.95 de la vista sin tocarlo y `Math.round` lo
 *  dejaba en «1%», con la barra vacía, para los 53 participantes. Con el
 *  nombre del parámetro diciendo qué espera, no hay dónde equivocarse. */
export function BarraPct({ tasa, tinta = color.primarioProfundo }: { tasa: number | null; tinta?: string }) {
  const pct = tasa == null ? null : Number(tasa) * 100
  return (
    <View style={[e.fila, { gap: 6 }]}>
      {/* 34 px no dan para «100%» y se partía en dos líneas, dejando esa fila
          más alta que las demás. */}
      <Text numberOfLines={1} style={[texto.datoFuerte, { color: color.texto, width: 42, textAlign: 'right' }]}>{pct == null ? '—' : `${Math.round(pct)}%`}</Text>
      <View style={e.pista}><View style={[e.lleno, { width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: pct != null && pct < 60 ? '#B0532F' : tinta }]} /></View>
    </View>
  )
}

export function Separador() { return <View style={e.separadorH} /> }

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  caja: { backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base, borderWidth: 1, borderColor: '#EEECE8' },
  cajaSuave: { backgroundColor: '#F5F4F1', borderColor: 'transparent' },
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  cuadroIcono: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  boton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 8 },
  botonBorde: { borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  botonSuave: { backgroundColor: '#F1EFEB' },
  botonTierra: { backgroundColor: '#8C4A2B' },
  botonVerde: { backgroundColor: color.primarioProfundo },
  pista: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden', minWidth: 40 },
  lleno: { height: 5, borderRadius: 3 },
  separadorH: { height: 1, backgroundColor: color.borde },
})

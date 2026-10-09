/** Piezas de la vista móvil del psicólogo — ESP-006 RF-006-13 … RF-006-15.
 *
 *  Diseño: Figma VXFnbiXKzb0Hj92s2r2ulL, frames «Casos Derivados», «Detalle
 *  del Caso». Misma familia visual que el trabajador, más densa: quien la
 *  usa es un profesional con prisa. Nunca rojo: la urgencia se dice con
 *  jerarquía y tono tierra. */

import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Polyline } from 'react-native-svg'
import { color, espacio, radio, sombra, texto } from '../nucleo/diseno'
import { IconoFlecha } from '../nucleo/iconos'
import type { Caso, EstadoCaso, PuntajeOlbi } from './datos'
import { Avatar } from './calendario'

export const NOMBRE_DIMENSION = { agotamiento: 'Agotamiento', desvinculacion: 'Desvinculación' } as const
type Dimension = keyof typeof NOMBRE_DIMENSION

export type Nivel = 'bajo' | 'moderado' | 'alto'

export function nivelDe(puntaje: number, umbral: number | null | undefined): Nivel {
  if (umbral == null) return 'bajo'
  if (puntaje >= umbral) return 'alto'
  if (puntaje >= umbral - 0.5) return 'moderado'
  return 'bajo'
}

export const TONO_NIVEL: Record<Nivel, { fondo: string; tinta: string; barra: string; etiqueta: string }> = {
  bajo: { fondo: color.exitoSuave, tinta: color.exito, barra: color.primario, etiqueta: 'Bajo' },
  moderado: { fondo: color.alertaSuave, tinta: color.alerta, barra: color.textoMedio, etiqueta: 'A vigilar' },
  alto: { fondo: color.tierraSuave, tinta: color.tierra, barra: color.tierra, etiqueta: 'Alto' },
}

export const ESTADO_CASO: Record<EstadoCaso, { etiqueta: string; fondo: string; tinta: string; accion: string }> = {
  sesion_pendiente: { etiqueta: 'Sesión pendiente', fondo: color.tierraSuave, tinta: color.tierra, accion: 'Atender caso' },
  cita_por_confirmar: { etiqueta: 'Cita por confirmar', fondo: color.alertaSuave, tinta: color.alerta, accion: 'Revisar cita' },
  cita_confirmada: { etiqueta: 'Cita confirmada', fondo: color.exitoSuave, tinta: color.exito, accion: 'Ver ficha' },
  sala_lista: { etiqueta: 'Sala lista', fondo: color.primarioSuave, tinta: color.primarioProfundo, accion: 'Ver ficha' },
  informe_por_aprobar: { etiqueta: 'Informe por aprobar', fondo: color.arena, tinta: color.textoArena, accion: 'Revisar nota' },
  cerrado: { etiqueta: 'Cerrado', fondo: color.superficieSuave, tinta: color.textoMedio, accion: 'Ver ficha' },
}

export function fechaHoraCorta(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export function haceCuanto(iso: string, ahora = new Date()): string {
  const dias = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

// ----------------------------------------------------------- Rótulos comunes

export function Rotulo({ children, derecha }: { children: string; derecha?: ReactNode }) {
  return (
    <View style={e.fila}>
      <Text style={[texto.etiqueta, { color: color.textoSuave, flex: 1 }]}>{children}</Text>
      {derecha}
    </View>
  )
}

export function Pastilla({ texto: t, fondo, tinta }: { texto: string; fondo: string; tinta: string }) {
  return (
    <View style={[e.pastilla, { backgroundColor: fondo }]}>
      <Text style={[texto.dato, { color: tinta }]}>{t}</Text>
    </View>
  )
}

export function Tarjeta({ children, suave, borde }: { children: ReactNode; suave?: boolean; borde?: string }) {
  return (
    <View style={[e.tarjeta, suave && e.tarjetaSuave, borde ? { borderLeftWidth: 4, borderLeftColor: borde } : null]}>
      {children}
    </View>
  )
}

// ------------------------------------------------------------ Lista de casos

/** Una persona, una fila. La tarjeta entera se toca.
 *
 *  La anterior metía dentro el estado, la fecha de derivación, una banda con
 *  el OLBI, otra con la cita y un pie con texto y botón propio. Cinco casos
 *  eran un muro, y con todo gritando a la vez no se veía cuál urgía. Aquí la
 *  jerarquía la pone la sección en la que cae la fila; dentro solo va quién
 *  es y qué pasa con esa persona.
 *
 *  El OLBI no aparece: es dato clínico y vive en la ficha, a un toque. */
export function FilaCaso({ caso, onPress }: { caso: Caso; onPress: () => void }) {
  const estado = ESTADO_CASO[caso.estado_caso]
  const cerrado = caso.estado_caso === 'cerrado'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caso.codigo_anonimo}, ${estado.etiqueta}`}
      style={({ pressed }) => [e.fila2, cerrado && e.fila2Apagada, pressed && { opacity: 0.7 }]}
    >
      <Avatar empresa={caso.empresa} codigo={caso.codigo_anonimo} tamano={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={e.fila}>
          <Text style={[texto.cuerpoFuerte, { color: cerrado ? color.textoMedio : color.texto }]}>{caso.codigo_anonimo}</Text>
          {!!caso.empresa && <Text style={[texto.apoyo, { color: color.textoSuave, flexShrink: 1 }]} numberOfLines={1}>{caso.empresa}</Text>}
        </View>
        <Text style={[texto.apoyo, { color: cerrado ? color.textoSuave : estado.tinta }]} numberOfLines={1}>
          {detalleCaso(caso)}
        </Text>
      </View>
      <IconoFlecha tamano={13} color={color.textoSuave} />
    </Pressable>
  )
}

/** La línea de debajo del código: qué pasa con esta persona, en concreto.
 *  Un estado a secas («Cita por confirmar») obliga a entrar para saber de
 *  cuándo hablamos. */
function detalleCaso(caso: Caso): string {
  switch (caso.estado_caso) {
    case 'sesion_pendiente':
      return `Sin contactar · derivado ${haceCuanto(caso.abierta_en)}`
    case 'cita_por_confirmar':
      return caso.cita_para ? `Pidió hora · ${fechaHoraCorta(caso.cita_para)}` : 'Pidió una hora'
    case 'cita_confirmada':
      return caso.cita_para ? `Confirmada · ${fechaHoraCorta(caso.cita_para)}` : 'Cita confirmada'
    case 'sala_lista':
      return caso.consentimiento_trabajador ? 'Sala lista · consentimiento firmado' : 'Sala lista · falta su consentimiento'
    case 'informe_por_aprobar':
      return 'Borrador listo para tu revisión'
    default:
      return caso.cerrada_en ? `Cerrado ${haceCuanto(caso.cerrada_en)}` : 'Cerrado'
  }
}

/** Cabecera de sección con su cuenta: «TE ESPERAN 2». */
export function Seccion({ titulo, cuenta }: { titulo: string; cuenta: number }) {
  return (
    <View style={[e.fila, { paddingTop: espacio.xs }]}>
      <Text style={[texto.etiqueta, { color: color.textoSuave, flex: 1 }]}>{titulo}</Text>
      <Text style={[texto.datoFuerte, { color: color.textoMedio }]}>{cuenta}</Text>
    </View>
  )
}


export function TarjetaCaso({ caso, onPress }: { caso: Caso; onPress: () => void }) {
  const estado = ESTADO_CASO[caso.estado_caso]
  const agot = caso.puntajes?.agotamiento
  const umbralAgot = caso.umbrales?.agotamiento
  const urgente = caso.estado_caso === 'sesion_pendiente' || caso.estado_caso === 'cita_por_confirmar'

  return (
    <Tarjeta borde={urgente ? color.tierra : undefined}>
      <View style={e.fila}>
        <Text style={[texto.seccion, { color: color.texto }]}>{caso.codigo_anonimo}</Text>
        {caso.empresa && <Pastilla texto={caso.empresa} fondo={color.superficieSuave} tinta={color.textoMedio} />}
        <View style={{ flex: 1 }} />
        <Pastilla texto={estado.etiqueta} fondo={estado.fondo} tinta={estado.tinta} />
      </View>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>Derivado {haceCuanto(caso.abierta_en)}</Text>

      {typeof agot === 'number' && (
        <View style={e.franja}>
          <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>OLBI · Agotamiento</Text>
          <Text style={[texto.datoFuerte, { color: nivelDe(agot, umbralAgot) === 'alto' ? color.tierra : color.texto, fontSize: 16 }]}>
            {agot.toFixed(1)}<Text style={[texto.dato, { color: color.textoMedio }]}> / 4.0</Text>
          </Text>
        </View>
      )}
      {caso.cita_para && (caso.estado_caso === 'cita_por_confirmar' || caso.estado_caso === 'cita_confirmada') && (
        <View style={[e.franja, { backgroundColor: caso.estado_caso === 'cita_confirmada' ? color.exitoSuave : color.alertaSuave }]}>
          <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>Cita pedida por el trabajador</Text>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>{fechaHoraCorta(caso.cita_para)}</Text>
        </View>
      )}
      {caso.estado_caso === 'sala_lista' && (
        <View style={[e.franja, { backgroundColor: color.primarioSuave }]}>
          <Text style={[texto.cuerpo, { color: color.primarioProfundo, flex: 1 }]}>Videollamada lista</Text>
          <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>SALA LISTA</Text>
        </View>
      )}
      {caso.estado_caso === 'informe_por_aprobar' && (
        <View style={e.franja}>
          <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>Revisión clínica requerida</Text>
          <Text style={[texto.etiqueta, { color: color.textoMedio }]}>BORRADOR LISTO</Text>
        </View>
      )}

      <View style={e.fila}>
        <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
          {caso.estado_caso === 'sesion_pendiente' ? 'Prioridad de contacto'
            : caso.estado_caso === 'cita_por_confirmar' ? 'Confirma o propón otra hora'
            : caso.estado_caso === 'cita_confirmada' ? 'Abre la sala a la hora acordada'
            : caso.estado_caso === 'sala_lista' ? (caso.consentimiento_trabajador ? 'Consentimiento firmado' : 'Consentimiento pendiente')
            : caso.estado_caso === 'informe_por_aprobar' ? 'Fase de cierre' : 'Caso cerrado'}
        </Text>
        <Pressable onPress={onPress} style={[e.boton, urgente && e.botonLleno]} accessibilityRole="button">
          <Text style={[texto.cuerpoFuerte, { color: urgente ? '#FFFFFF' : color.texto }]}>{estado.accion}</Text>
          <IconoFlecha tamano={12} color={urgente ? '#FFFFFF' : color.texto} />
        </Pressable>
      </View>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ Umbral

/** Una dimensión con su puntaje contra el umbral, como en «Motivo de alerta». */
export function BarraUmbral({ dimension, puntaje, umbral }: { dimension: Dimension; puntaje: number; umbral: number | null | undefined }) {
  const nivel = nivelDe(puntaje, umbral)
  const tono = TONO_NIVEL[nivel]
  const pct = ((puntaje - 1) / 3) * 100
  const marca = umbral != null ? ((umbral - 1) / 3) * 100 : null
  const delta = umbral != null ? puntaje - umbral : null

  return (
    <View style={e.umbral}>
      <View style={e.fila}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{NOMBRE_DIMENSION[dimension]}</Text>
        <Pastilla texto={tono.etiqueta} fondo={tono.fondo} tinta={tono.tinta} />
        <View style={{ flex: 1 }} />
        <Text style={[texto.datoFuerte, { color: tono.tinta, fontSize: 20, lineHeight: 24 }]}>
          {puntaje.toFixed(1)}<Text style={[texto.dato, { color: color.textoMedio }]}> / 4.0</Text>
        </Text>
      </View>
      <View style={e.pista}>
        <View style={[e.avance, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: tono.barra }]} />
        {marca != null && <View style={[e.marca, { left: `${marca}%` }]} />}
      </View>
      <View style={e.fila}>
        <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
          {umbral != null ? `Umbral de corte: ${umbral.toFixed(2)}` : 'Sin umbral configurado'}
        </Text>
        {delta != null && (
          <Text style={[texto.apoyo, { color: delta >= 0 ? color.tierra : color.textoMedio }]}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(2)} s/corte
          </Text>
        )}
      </View>
    </View>
  )
}

// --------------------------------------------------------------- Evolución

/** Seis semanas de las dos dimensiones, como lectura de tendencia. Cada
 *  aplicación del OLBI es una semana; se toman las últimas seis. */
export function Evolucion({ puntajes, umbrales }: {
  puntajes: PuntajeOlbi[]
  umbrales: Partial<Record<Dimension, number | null>> | null
}) {
  const porMedicion = new Map<string, { fecha: string; agotamiento?: number; desvinculacion?: number }>()
  for (const p of puntajes) {
    const m = porMedicion.get(p.respuesta_id) ?? { fecha: p.enviado_en }
    if (p.dimension === 'agotamiento' || p.dimension === 'desvinculacion') m[p.dimension] = Number(p.puntaje)
    porMedicion.set(p.respuesta_id, m)
  }
  const semanas = [...porMedicion.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-6)
  if (semanas.length === 0) {
    return <Text style={[texto.apoyo, { color: color.textoMedio }]}>Aún no hay mediciones.</Text>
  }

  const W = 320, H = 120, PX = 8, PY = 10
  const x = (i: number) => PX + (semanas.length === 1 ? (W - 2 * PX) / 2 : (i * (W - 2 * PX)) / (semanas.length - 1))
  const y = (v: number) => PY + (H - 2 * PY) * (1 - (v - 1) / 3)
  const puntos = (dim: Dimension) =>
    semanas.map((s, i) => (typeof s[dim] === 'number' ? `${x(i)},${y(s[dim] as number)}` : null)).filter(Boolean).join(' ')
  const umbralAgot = umbrales?.agotamiento

  const ultima = semanas[semanas.length - 1]
  const primera = semanas[0]
  const tendencia = ultima.agotamiento != null && primera.agotamiento != null
    ? ultima.agotamiento - primera.agotamiento : 0
  // Son mediciones, no semanas: el OLBI ya no se contesta cada viernes, y
  // seis mediciones pueden abarcar meses. Se dice desde cuándo.
  const corta = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace('.', '')
  const n = semanas.length
  const desde = n ? corta(semanas[0].fecha) : ''

  return (
    <View style={{ gap: espacio.sm }}>
      <View style={e.fila}>
        <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>Evolución ({n} {n === 1 ? 'medición' : 'mediciones'})</Text>
        <Leyenda tinta={color.tierra} nombre="Agot." />
        <Leyenda tinta={color.textoMedio} nombre="Desv." />
      </View>
      <View style={e.grafica}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[1.75, 2.5, 3.25].map((v) => (
            <Line key={v} x1={PX} x2={W - PX} y1={y(v)} y2={y(v)} stroke={color.borde} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {umbralAgot != null && (
            <Line x1={PX} x2={W - PX} y1={y(umbralAgot)} y2={y(umbralAgot)} stroke={color.tierra} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
          )}
          <Polyline points={puntos('desvinculacion')} fill="none" stroke={color.textoMedio} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={puntos('agotamiento')} fill="none" stroke={color.tierra} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {typeof ultima.desvinculacion === 'number' && <Circle cx={x(semanas.length - 1)} cy={y(ultima.desvinculacion)} r={5} fill={color.textoMedio} />}
          {typeof ultima.agotamiento === 'number' && <Circle cx={x(semanas.length - 1)} cy={y(ultima.agotamiento)} r={5} fill={color.tierra} />}
        </Svg>
        <View style={e.ejeX}>
          {semanas.map((s, i) => (
            <Text key={s.fecha} style={[texto.etiqueta, { color: i === semanas.length - 1 ? color.texto : color.textoSuave }]}>
              {corta(s.fecha)}
            </Text>
          ))}
        </View>
      </View>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        {semanas.length < 2 ? 'Una sola medición: todavía no hay tendencia.'
          : tendencia > 0.3 ? `Alza en agotamiento en sus últimas ${n} mediciones, desde el ${desde}.`
          : tendencia < -0.3 ? `Descenso en agotamiento en sus últimas ${n} mediciones, desde el ${desde}.`
          : `Agotamiento estable en sus últimas ${n} mediciones, desde el ${desde}.`}
      </Text>
    </View>
  )
}

function Leyenda({ tinta, nombre }: { tinta: string; nombre: string }) {
  return (
    <View style={[e.fila, { gap: 4 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tinta }} />
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>{nombre}</Text>
    </View>
  )
}

/** Número de semana ISO. */
export function numeroSemana(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia)
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - inicio.getTime()) / 86_400_000 + 1) / 7)
}

// ------------------------------------------------------------------ Estilos

const e = StyleSheet.create({
  fila2: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    backgroundColor: color.superficie, borderRadius: radio.lg,
    paddingVertical: 12, paddingHorizontal: espacio.md,
    ...sombra.suave,
  },
  fila2Apagada: { backgroundColor: color.superficieSuave, borderColor: 'transparent' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  pastilla: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tarjeta: {
    backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.md, gap: espacio.sm,
    borderWidth: 1, borderColor: color.borde,
  },
  tarjetaSuave: { backgroundColor: '#F6F5F2' },
  franja: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: color.superficieSuave, borderRadius: radio.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  boton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radio.md, backgroundColor: color.superficieSuave,
  },
  botonLleno: { backgroundColor: color.primario },
  umbral: { gap: 8, backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.sm },
  pista: { height: 8, borderRadius: 4, backgroundColor: color.borde, overflow: 'visible', position: 'relative' },
  avance: { height: 8, borderRadius: 4 },
  marca: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: color.texto, borderRadius: 1 },
  grafica: { backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.sm, gap: 6 },
  ejeX: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
})

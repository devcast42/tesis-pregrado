/** Calendario del psicólogo: la semana arriba, el día debajo.
 *
 *  Es la forma en que cualquier profesional mira su agenda —el teléfono, el
 *  calendario del correo, la libreta—, así que no hay nada que aprender. Una
 *  lista de citas obliga a leer cada fecha para saber si hay un hueco a las
 *  cuatro; una columna de horas lo enseña sin leer.
 *
 *  Tres piezas que se usan juntas o por separado:
 *    - `Avatar`: la inicial de la empresa en un círculo de su color. La
 *      identidad de la persona está protegida y solo se tiene un código; la
 *      empresa es lo que distingue a un caso de otro de un vistazo.
 *    - `SemanaCalendario`: lunes a domingo, con flechas para cambiar de
 *      semana y un punto bajo los días que tienen algo.
 *    - `LineaDelDia`: las horas en columna y cada cita como un bloque en su
 *      sitio, con una línea en la hora actual. */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { color, espacio, fuente, radio, sombra, texto } from '../nucleo/diseno'
import { IconoVideo } from '../nucleo/iconos'
import type { CitaAgenda } from './datos'

// --------------------------------------------------------------------- Avatar

/** Paleta de avatares: tonos suaves con su tinta, todos legibles. Se elige
 *  por un hash de la empresa, así que la misma empresa siempre sale igual. */
const TONOS = [
  { fondo: '#DDF3EF', tinta: '#005C55' },
  { fondo: '#FBEBDD', tinta: '#9A5B2B' },
  { fondo: '#E4ECFB', tinta: '#2F4F8F' },
  { fondo: '#F1E6F7', tinta: '#6B3F86' },
  { fondo: '#E9F2DD', tinta: '#4D6B26' },
  { fondo: '#F7E4E4', tinta: '#8A3B3B' },
] as const

export function tonoDe(clave: string | null | undefined) {
  const s = clave ?? ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TONOS[h % TONOS.length]
}

export function Avatar({ empresa, codigo, tamano = 40 }: { empresa?: string | null; codigo: string; tamano?: number }) {
  const t = tonoDe(empresa ?? codigo.split('-')[0])
  const inicial = (empresa?.trim()[0] ?? codigo[0] ?? '·').toUpperCase()
  return (
    <View style={[e.avatar, { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: t.fondo }]}>
      <Text style={{ fontFamily: fuente.fuerte, fontSize: tamano * 0.42, color: t.tinta }}>{inicial}</Text>
    </View>
  )
}

// ------------------------------------------------------------------- Fechas

export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function lunesDe(d: Date): Date {
  const l = new Date(d); l.setHours(12, 0, 0, 0)
  const dow = l.getDay() === 0 ? 7 : l.getDay()
  l.setDate(l.getDate() - (dow - 1))
  return l
}

function sumarDias(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

const INICIAL_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// ------------------------------------------------------------------- Semana

/** Los siete días de una semana. `marcas` dice qué días tienen algo y de qué
 *  color va su punto: ámbar si hay algo por confirmar, verde si solo hay
 *  citas cerradas. */
export function SemanaCalendario({ lunes, seleccionado, onSeleccionar, onSemana, marcas, deshabilitar }: {
  lunes: Date
  seleccionado: string
  onSeleccionar: (iso: string) => void
  onSemana: (delta: -1 | 1) => void
  marcas?: Record<string, 'pendiente' | 'cita'>
  /** Días que no se pueden elegir (para proponer hora: el pasado y el fin de semana). */
  deshabilitar?: (d: Date) => boolean
}) {
  const hoy = isoDia(new Date())
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  const mes = mesDeLaSemana(dias)

  return (
    <View style={{ gap: espacio.sm }}>
      <View style={e.semanaCabecera}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>{mes}</Text>
        <Pressable onPress={() => onSemana(-1)} hitSlop={8} style={e.flecha} accessibilityRole="button" accessibilityLabel="Semana anterior">
          <Text style={e.flechaTexto}>‹</Text>
        </Pressable>
        <Pressable onPress={() => onSemana(1)} hitSlop={8} style={e.flecha} accessibilityRole="button" accessibilityLabel="Semana siguiente">
          <Text style={e.flechaTexto}>›</Text>
        </Pressable>
      </View>
      <View style={e.semana}>
        {dias.map((d, i) => {
          const iso = isoDia(d)
          const activo = iso === seleccionado
          const esHoy = iso === hoy
          const apagado = deshabilitar?.(d) ?? false
          const marca = marcas?.[iso]
          return (
            <Pressable
              key={iso}
              disabled={apagado}
              onPress={() => onSeleccionar(iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo, disabled: apagado }}
              accessibilityLabel={d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              style={e.diaCol}
            >
              <Text style={[texto.dato, { color: apagado ? color.puntoFuturo : color.textoSuave }]}>{INICIAL_DIA[i]}</Text>
              <View style={[e.diaNum, esHoy && !activo && e.diaHoy, activo && e.diaActivo]}>
                <Text style={[texto.cuerpoFuerte, {
                  color: activo ? '#FFFFFF' : apagado ? color.puntoFuturo : esHoy ? color.primarioProfundo : color.texto,
                }]}>{d.getDate()}</Text>
              </View>
              <View style={[e.marca, marca === 'pendiente' && { backgroundColor: color.alerta }, marca === 'cita' && { backgroundColor: color.primario }]} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function mesDeLaSemana(dias: Date[]): string {
  const a = dias[0], b = dias[6]
  const m = (d: Date) => d.toLocaleDateString('es-PE', { month: 'long' })
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (a.getMonth() === b.getMonth()) return `${cap(m(a))} ${a.getFullYear()}`
  return `${cap(m(a))} – ${m(b)} ${b.getFullYear()}`
}

// ----------------------------------------------------------------- El día

const ALTO_HORA = 64
const ESTADO_BLOQUE: Record<CitaAgenda['estado'] | 'sala', { fondo: string; borde: string; tinta: string; etiqueta: string }> = {
  solicitada: { fondo: color.alertaSuave, borde: color.alerta, tinta: color.alerta, etiqueta: 'Por confirmar' },
  confirmada: { fondo: color.primarioSuave, borde: color.primario, tinta: color.primarioProfundo, etiqueta: 'Confirmada' },
  atendida: { fondo: color.superficieSuave, borde: color.bordeFuerte, tinta: color.textoMedio, etiqueta: 'Atendida' },
  sala: { fondo: color.primarioProfundo, borde: color.primarioProfundo, tinta: '#FFFFFF', etiqueta: 'Sala abierta · entra ahora' },
}

/** Las horas del día en columna y cada cita en su sitio.
 *
 *  La rejilla se ciñe a las citas —una hora antes de la primera, una después
 *  de la última, cuatro como mínimo—, y un día libre no tiene rejilla: once
 *  horas en blanco ocupaban la pantalla entera para decir «no hay nada» y
 *  empujaban lo pendiente fuera de la vista. */
export function LineaDelDia({ dia, citas, onCita }: {
  dia: string
  citas: CitaAgenda[]
  onCita: (c: CitaAgenda) => void
}) {
  const ahora = new Date()
  const esHoy = dia === isoDia(ahora)

  if (citas.length === 0) {
    const pasado = dia < isoDia(ahora)
    return (
      <View style={e.libre}>
        <Text style={[texto.apoyo, { color: color.textoSuave }]}>
          {pasado ? 'No hubo citas este día.' : esHoy ? 'Hoy no tienes citas.' : 'Día libre.'}
        </Text>
      </View>
    )
  }

  const horaDe = (c: CitaAgenda) => { const d = new Date(c.propuesta_para); return d.getHours() + d.getMinutes() / 60 }
  let desde = Math.max(0, Math.floor(Math.min(...citas.map(horaDe))) - 1)
  let hasta = Math.min(24, Math.ceil(Math.max(...citas.map(horaDe))) + 2)
  if (hasta - desde < 4) hasta = Math.min(24, desde + 4)
  if (hasta - desde < 4) desde = Math.max(0, hasta - 4)
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i)
  const ahoraH = ahora.getHours() + ahora.getMinutes() / 60

  return (
    <View style={{ height: horas.length * ALTO_HORA, position: 'relative' }}>
      {horas.map((h, i) => (
        <View key={h} style={[e.franja, { top: i * ALTO_HORA }]}>
          <Text style={[texto.dato, e.franjaHora]}>{`${String(h).padStart(2, '0')}:00`}</Text>
          <View style={e.franjaLinea} />
        </View>
      ))}

      {esHoy && ahoraH >= desde && ahoraH <= hasta && (
        <View pointerEvents="none" style={[e.ahora, { top: (ahoraH - desde) * ALTO_HORA }]}>
          <View style={e.ahoraPunto} />
          <View style={e.ahoraLinea} />
        </View>
      )}

      {citas.map((c) => {
        const tono = c.sesion_en_curso && c.estado !== 'atendida' ? ESTADO_BLOQUE.sala : ESTADO_BLOQUE[c.estado]
        const top = (horaDe(c) - desde) * ALTO_HORA + 2
        const hora = new Date(c.propuesta_para).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
        return (
          <Pressable
            key={c.cita_id}
            onPress={() => onCita(c)}
            accessibilityRole="button"
            accessibilityLabel={`${hora}, ${c.codigo_anonimo}, ${tono.etiqueta}`}
            style={({ pressed }) => [e.bloque, { top, backgroundColor: tono.fondo, borderLeftColor: tono.borde }, pressed && { opacity: 0.8 }]}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[texto.datoFuerte, { color: tono.tinta }]} numberOfLines={1}>
                {hora} · {c.codigo_anonimo}{c.empresa ? <Text style={{ fontFamily: fuente.regular }}>{`  ${c.empresa}`}</Text> : null}
              </Text>
              <Text style={[texto.dato, { color: tono.tinta, opacity: 0.85 }]} numberOfLines={1}>{tono.etiqueta}</Text>
            </View>
            {c.sesion_en_curso && c.estado !== 'atendida' && <IconoVideo tamano={16} color="#FFFFFF" />}
          </Pressable>
        )
      })}

    </View>
  )
}

const COLUMNA_HORA = 48

const e = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },

  semanaCabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  flecha: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficieSuave },
  flechaTexto: { fontFamily: fuente.media, fontSize: 20, lineHeight: 22, color: color.textoMedio },
  semana: { flexDirection: 'row' },
  diaCol: { flex: 1, alignItems: 'center', gap: 4 },
  diaNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  diaHoy: { backgroundColor: color.primarioSuave },
  diaActivo: { backgroundColor: color.primarioProfundo },
  marca: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },

  franja: { position: 'absolute', left: 0, right: 0, height: ALTO_HORA, flexDirection: 'row', alignItems: 'flex-start' },
  franjaHora: { width: COLUMNA_HORA, color: color.textoSuave, marginTop: -8 },
  franjaLinea: { flex: 1, height: 1, backgroundColor: color.borde },

  ahora: { position: 'absolute', left: COLUMNA_HORA - 5, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 3 },
  ahoraPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.peligro },
  ahoraLinea: { flex: 1, height: 2, backgroundColor: color.peligro },

  bloque: {
    position: 'absolute', left: COLUMNA_HORA + 4, right: 0, height: ALTO_HORA - 6,
    borderRadius: radio.sm, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2, ...sombra.suave,
  },
  libre: { alignItems: 'center', paddingVertical: espacio.base, backgroundColor: color.superficieSuave, borderRadius: radio.md },
})

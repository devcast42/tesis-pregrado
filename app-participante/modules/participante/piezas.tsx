/** Piezas de la pantalla principal del participante.
 *
 *  Implementan el diseño de Figma (archivo H3QiUxtgPeSzpbeIyBfWpk, nodos 1:2
 *  y 1:138). Las medidas, radios y colores vienen de ahí; los textos que el
 *  diseño traía como ejemplo se sustituyen por los reales del estudio.
 *
 *  Lo que estas piezas NO hacen, a propósito (ESP-004 RN-004-03): mostrar
 *  puntajes, estados, rachas ni ningún dato sobre cómo va la persona. */

import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { color, espacio, fuente, radio, texto } from '../nucleo/diseno'
import { Logo } from '../nucleo/Logo'
import {
  IconoAbrir, IconoApoyo, IconoCandado, IconoCheck, IconoDestello,
  IconoFlecha, IconoFormulario, IconoHoja, IconoLlama, IconoPersona, IconoAjustes,
} from '../nucleo/iconos'

// ------------------------------------------------------------------ Cabecera

/** Cabecera propia de 64 px: título centrado y avatar que abre ajustes. No
 *  hay flecha de volver porque esta es la raíz de la app. */
export function Cabecera({ titulo, onAjustes }: { titulo: string; onAjustes?: () => void }) {
  return (
    <View style={e.cabecera}>
      <View style={e.cabeceraHueco} />
      <Text style={[texto.seccion, e.cabeceraTitulo]} numberOfLines={1}>{titulo}</Text>
      {onAjustes ? (
        <Pressable onPress={onAjustes} accessibilityRole="button" accessibilityLabel="Perfil"
          style={e.avatar} hitSlop={8}>
          <IconoPersona tamano={12} color="#FFFFFF" />
        </Pressable>
      ) : <View style={e.cabeceraHueco} />}
    </View>
  )
}

// -------------------------------------------------------------------- Saludo

export function Saludo({
  fecha, semana, codigo, titulo, subtitulo, onAjustes,
}: {
  fecha: string
  semana: number
  codigo: string
  titulo: string
  subtitulo: string
  onAjustes: () => void
}) {
  return (
    <View style={e.saludo}>
      <View style={e.saludoFila}>
        <Text style={[texto.etiqueta, e.saludoFecha]} numberOfLines={1}>
          {`${fecha} · SEMANA ${semana}`.toUpperCase()}
        </Text>
        <Pressable onPress={onAjustes} accessibilityRole="button"
          accessibilityLabel={`Ajustes de participante ${codigo}`} style={e.pastillaCodigo}>
          <Text style={[texto.etiqueta, { color: color.textoMedio }]}>{codigo}</Text>
          <IconoAjustes tamano={13.5} color={color.textoMedio} />
        </Pressable>
      </View>
      <Text style={[texto.titulo, { color: color.texto }]}>{titulo}</Text>
      <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{subtitulo}</Text>
    </View>
  )
}

// ------------------------------------------------------------- Ritmo semanal

export type EstadoDia = 'respondido' | 'hoy_pendiente' | 'hoy_respondido' | 'otro'

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Siete círculos, uno por día de la semana en curso.
 *
 *  Solo se marcan los días respondidos y el de hoy. Un día pasado sin
 *  respuesta se ve igual que uno futuro: un punto neutro (RN-007: la
 *  adherencia la vigila el investigador, no la app avergonzando a nadie).
 *
 *  Racha (RF-002-07): los días que forman la racha vigente se pintan en tono
 *  tierra y quedan unidos por una línea; si la racha viene de la semana
 *  anterior, el lunes trae una cola por la izquierda. Con `celebrar`, al
 *  volver de un formulario, los círculos de la racha «prenden» uno a uno y
 *  la llama de la cabecera late una vez. Después la escena se queda quieta:
 *  la animación es un premio, no un adorno permanente. */
export function RitmoSemanal({ dias, racha = 0, celebrar = false, onPress }: {
  dias: EstadoDia[]
  /** Días hábiles consecutivos, contando hoy si ya se respondió. */
  racha?: number
  celebrar?: boolean
  /** Abre el detalle de todos los registros. */
  onPress?: () => void
}) {
  const hoy = dias.findIndex((d) => d.startsWith('hoy'))
  const hoyHecho = dias[hoy] === 'hoy_respondido'
  // Días de esta semana que pertenecen a la racha: hacia atrás desde hoy
  // (o desde ayer si hoy sigue pendiente). Solo lunes a viernes.
  const ultimo = hoyHecho ? hoy : hoy - 1
  const enRacha = new Set<number>()
  for (let i = ultimo, n = 0; i >= 0 && n < racha; i--, n++) enRacha.add(i)
  const vieneDeAntes = racha > enRacha.size && enRacha.has(0)

  const escalas = useRef(dias.map(() => new Animated.Value(1))).current
  const llama = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!celebrar || enRacha.size === 0) return
    const orden = [...enRacha].sort((a, b) => a - b)
    orden.forEach((i) => escalas[i].setValue(0.6))
    Animated.sequence([
      Animated.stagger(90, orden.map((i) =>
        Animated.spring(escalas[i], { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      )),
      Animated.sequence([
        Animated.timing(llama, { toValue: 1.35, duration: 180, useNativeDriver: true }),
        Animated.spring(llama, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]),
    ]).start()
  // Solo cuando llega la orden de celebrar; el resto son derivados estables.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrar])

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [e.ritmo, pressed && { opacity: 0.85 }]} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel="Ver todos mis registros">
      <View style={e.ritmoCabecera}>
        <Text style={[texto.etiqueta, { color: color.textoMedio }]}>RITMO SEMANAL{onPress ? '  ›' : ''}</Text>
        {racha > 0 && hoyHecho ? (
          <Animated.View style={[e.ritmoRacha, { transform: [{ scale: llama }] }]}>
            <IconoLlama tamano={13} color={color.tierra} />
            <Text style={[texto.datoFuerte, { color: color.tierra }]}>
              {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}
            </Text>
          </Animated.View>
        ) : (
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>Días de observación</Text>
        )}
      </View>
      <View style={e.ritmoDias}>
        {dias.map((estado, i) => {
          const racheado = enRacha.has(i)
          const uneIzquierda = racheado && (enRacha.has(i - 1) || (i === 0 && vieneDeAntes))
          const uneDerecha = racheado && enRacha.has(i + 1)
          return (
            <View key={i} style={e.dia}>
              <Text style={[
                texto.etiqueta,
                { color: estado.startsWith('hoy') ? color.primarioProfundo : racheado ? color.tierra : color.textoMedio },
                estado.startsWith('hoy') && { fontFamily: fuente.fuerte },
              ]}>
                {INICIALES[i]}
              </Text>
              <View style={e.diaFila}>
                <View style={[e.union, uneIzquierda && e.unionActiva]} />
                <Animated.View style={{ transform: [{ scale: escalas[i] }] }}>
                  <Circulo estado={estado} racheado={racheado} />
                </Animated.View>
                <View style={[e.union, uneDerecha && e.unionActiva]} />
              </View>
            </View>
          )
        })}
      </View>
    </Pressable>
  )
}

function Circulo({ estado, racheado }: { estado: EstadoDia; racheado: boolean }) {
  if (racheado && (estado === 'respondido' || estado === 'hoy_respondido')) {
    const hoy = estado === 'hoy_respondido'
    return (
      <View style={[e.circulo, { backgroundColor: hoy ? color.tierra : color.tierraSuave }, hoy && e.circuloHoyRacha]}>
        {hoy ? <IconoLlama tamano={16} color="#FFFFFF" /> : <IconoCheck tamano={9} color={color.tierra} />}
      </View>
    )
  }
  if (estado === 'respondido') {
    return (
      <View style={[e.circulo, { backgroundColor: color.superficieSuave }]}>
        <IconoCheck tamano={9} color={color.primarioProfundo} />
      </View>
    )
  }
  if (estado === 'hoy_respondido') {
    return (
      <View style={[e.circulo, { backgroundColor: color.primarioProfundo }]}>
        <IconoCheck tamano={9} color="#FFFFFF" />
      </View>
    )
  }
  if (estado === 'hoy_pendiente') {
    return (
      <View style={[e.circulo, { backgroundColor: color.primarioClaro }]}>
        <View style={e.puntoHoy} />
      </View>
    )
  }
  return (
    <View style={[e.circulo, { backgroundColor: color.superficieSuave }]}>
      <View style={e.puntoOtro} />
    </View>
  )
}

// --------------------------------------------------------------------- Hero

/** La acción principal del día, sobre fondo primario con un aura orgánica. */
export function TarjetaHero({
  titulo, descripcion, accion, onPress,
}: {
  titulo: string
  descripcion: string
  accion: string
  onPress: () => void
}) {
  return (
    <View style={e.hero}>
      <View style={e.heroAura} />
      <View style={e.heroPastilla}>
        <IconoDestello tamano={12.5} color={color.primarioTenue} />
        <Text style={[texto.etiqueta, { color: color.primarioTenue }]}>ACCIÓN PRINCIPAL DE HOY</Text>
      </View>
      <Text style={[texto.seccion, { color: '#FFFFFF' }]}>{titulo}</Text>
      <Text style={[texto.cuerpo, e.heroDescripcion]}>{descripcion}</Text>
      <BotonFila onPress={onPress} fondo="#FFFFFF" tono={color.primarioProfundo}
        alto={56} icono={<IconoFlecha tamano={14.67} color={color.primarioProfundo} />}>
        {accion}
      </BotonFila>
    </View>
  )
}

// --------------------------------------------------------------- Secundaria

export function TarjetaSecundaria({
  insignia, titulo, descripcion, accion, onPress,
}: {
  insignia: string
  titulo: string
  descripcion: string
  accion: string
  onPress: () => void
}) {
  return (
    <View style={e.tarjeta}>
      <View style={e.insigniaArena}>
        <Text style={[texto.etiqueta, { color: color.textoArena }]}>{insignia.toUpperCase()}</Text>
      </View>
      <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
      <Text style={[texto.cuerpo, e.tarjetaDescripcion]}>{descripcion}</Text>
      <BotonFila onPress={onPress} fondo={color.superficieSuave} tono={color.texto}
        icono={<IconoFormulario tamano={13.33} color={color.textoMedio} />}>
        {accion}
      </BotonFila>
    </View>
  )
}

// -------------------------------------------------------------------- Apoyo

/** Sesión de apoyo disponible. Nunca dice por qué se ofrece. */
export function TarjetaApoyo({ onPress }: { onPress: () => void }) {
  return (
    <View style={[e.tarjeta, e.tarjetaApoyo]}>
      <View style={e.apoyoTitulo}>
        <IconoApoyo tamano={18.8} color={color.primarioProfundo} />
        <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>
          Tienes una sesión de apoyo disponible
        </Text>
      </View>
      <Text style={[texto.cuerpo, e.tarjetaDescripcion]}>
        Un espacio confidencial de escucha e intercambio con un profesional de la salud
        mental, enteramente independiente de tu trabajo.
      </Text>
      <BotonFila onPress={onPress} fondo="#FFFFFF" tono={color.primarioProfundo}
        icono={<IconoAbrir tamano={15} color={color.primarioProfundo} />}>
        Entrar
      </BotonFila>
    </View>
  )
}

// -------------------------------------------------------------- Pensamiento

export function Pensamiento({ frase }: { frase: string }) {
  return (
    <View style={e.pensamiento}>
      <IconoHoja tamano={20} color={color.textoMedio} />
      <Text style={[texto.cuerpo, e.pensamientoFrase]}>“{frase}”</Text>
      <Text style={[texto.etiqueta, { color: color.textoMedio }]}>PAUSA PARA LA REFLEXIÓN</Text>
    </View>
  )
}

// ------------------------------------------------------------------- Cierre

/** Estado "todo listo": el bloque de cierre y gratitud del nodo 1:138. */
export function BloqueCierre({ mensaje, nota }: { mensaje: string; nota: string }) {
  return (
    <View style={e.cierre}>
      <View style={e.halo}>
        <View style={e.haloInterior}>
          <View style={e.haloNucleo}>
            <IconoCheck tamano={11} color="#FFFFFF" />
          </View>
        </View>
      </View>
      <Text style={[texto.seccion, { color: color.texto, textAlign: 'center' }]}>
        Todo listo por hoy
      </Text>
      <Text style={[texto.cuerpo, e.cierreMensaje]}>{mensaje}</Text>
      <View style={e.cierreNota}>
        <IconoHoja tamano={16.7} color={color.primarioProfundo} />
        <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>{nota}</Text>
      </View>
    </View>
  )
}

export function RegistrosDelDia({
  registros,
}: {
  registros: { titulo: string; detalle: string; estado: string }[]
}) {
  return (
    <View style={e.tarjeta}>
      <Text style={[texto.cuerpoFuerte, { color: color.texto, marginBottom: espacio.md }]}>
        Registros de hoy
      </Text>
      <View style={{ gap: espacio.sm }}>
        {registros.map((r) => (
          <View key={r.titulo} style={e.registro}>
            <IconoCheck tamano={12} color={color.primarioProfundo} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{r.titulo}</Text>
              <Text style={[texto.dato, { color: color.textoSuave }]}>{r.detalle}</Text>
            </View>
            <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>{r.estado}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------- Pie

export function PieEtico({ codigo, onAjustes }: { codigo: string; onAjustes: () => void }) {
  return (
    <View style={e.pie}>
      <View style={e.pieFila}>
        <IconoCandado tamano={14} color={color.textoMedio} />
        <Text style={[texto.apoyo, e.pieTexto]}>
          Tu código de participante: {codigo} · Datos protegidos y disociados
        </Text>
      </View>
      <Pressable onPress={onAjustes} accessibilityRole="link" style={e.pieEnlace}>
        <Text style={[texto.apoyo, e.pieEnlaceTexto]}>Ajustes y derechos éticos</Text>
      </Pressable>
    </View>
  )
}

// ------------------------------------------------------------------ Interno

/** Botón ancho con el texto a la izquierda y un ícono a la derecha, como en
 *  todas las tarjetas del diseño. */
function BotonFila({
  children, onPress, fondo, tono, icono, alto = 52,
}: {
  children: string
  onPress: () => void
  fondo: string
  tono: string
  icono: ReactNode
  alto?: number
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        e.botonFila,
        { backgroundColor: fondo, minHeight: alto },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[texto.cuerpoFuerte, { color: tono }]}>{children}</Text>
      {icono}
    </Pressable>
  )
}

const SOMBRA_TENUE = {
  shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 1,
  shadowOffset: { width: 0, height: 1 }, elevation: 1,
}

const e = StyleSheet.create({
  barraSuperior: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: color.superficie,
    borderBottomWidth: 1, borderBottomColor: color.borde,
  },
  barraLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  racha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999 },
  barraPersona: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  cabecera: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: color.fondo,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde,
  },
  cabeceraHueco: { width: 32 },
  cabeceraTitulo: { flex: 1, textAlign: 'center', color: color.texto, letterSpacing: -0.5 },
  avatar: {
    width: 32, height: 32, borderRadius: radio.completo,
    backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center',
  },

  saludo: { gap: espacio.xs, paddingTop: espacio.base },
  saludoFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.sm },
  saludoFecha: { color: color.textoMedio, letterSpacing: 0.3, flex: 1 },
  pastillaCodigo: {
    height: 44, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: espacio.md, borderRadius: radio.completo,
    backgroundColor: color.superficieSuave,
  },

  ritmo: {
    backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base,
    gap: espacio.sm, ...SOMBRA_TENUE,
  },
  ritmoCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ritmoDias: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: espacio.xs },
  dia: { alignItems: 'center', gap: 6, flex: 1 },
  diaFila: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  union: { flex: 1, height: 3, backgroundColor: 'transparent' },
  unionActiva: { backgroundColor: color.tierraSuave },
  circulo: { width: 40, height: 40, borderRadius: radio.completo, alignItems: 'center', justifyContent: 'center' },
  circuloHoyRacha: { shadowColor: color.tierra, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  ritmoRacha: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.tierraSuave, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  puntoHoy: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.primarioProfundo },
  puntoOtro: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.puntoFuturo },

  hero: {
    backgroundColor: color.primario, borderRadius: radio.md, padding: espacio.lg,
    gap: espacio.xs, overflow: 'hidden',
    shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  heroAura: {
    position: 'absolute', right: -40, bottom: -40, width: 176, height: 176,
    borderRadius: 88, backgroundColor: 'rgba(163,250,239,0.10)',
  },
  heroPastilla: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.completo,
    backgroundColor: 'rgba(163,250,239,0.15)', marginBottom: espacio.xs,
  },
  heroDescripcion: { color: 'rgba(163,250,239,0.9)', paddingTop: espacio.xs, paddingBottom: espacio.base },

  tarjeta: {
    backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.lg,
    gap: espacio.xs, ...SOMBRA_TENUE,
  },
  tarjetaDescripcion: { color: color.textoMedio, paddingTop: espacio.xs, paddingBottom: espacio.base },
  insigniaArena: {
    alignSelf: 'flex-start', backgroundColor: color.arena, borderRadius: 6,
    paddingHorizontal: espacio.sm, paddingVertical: 2, marginBottom: espacio.xs,
  },
  tarjetaApoyo: { backgroundColor: 'rgba(156,242,232,0.2)' },
  apoyoTitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },

  pensamiento: {
    backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.lg,
    alignItems: 'center', gap: espacio.sm,
  },
  pensamientoFrase: {
    color: color.texto, textAlign: 'center', fontFamily: fuente.media, fontStyle: 'italic',
    lineHeight: 26,
  },

  cierre: { alignItems: 'center', gap: espacio.md, paddingTop: espacio.lg },
  halo: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(156,242,232,0.25)',
  },
  haloInterior: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(156,242,232,0.5)',
  },
  haloNucleo: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.primarioProfundo,
  },
  cierreMensaje: { color: color.textoMedio, textAlign: 'center', paddingHorizontal: espacio.base },
  cierreNota: {
    flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start',
    backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base,
    marginTop: espacio.sm, width: '100%', ...SOMBRA_TENUE,
  },
  registro: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    padding: 14, borderRadius: radio.sm, backgroundColor: color.superficieSuave,
  },

  pie: { alignItems: 'center', gap: espacio.sm, paddingTop: espacio.xs },
  pieFila: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: espacio.lg },
  pieTexto: { color: color.textoMedio, textAlign: 'center', flex: 1 },
  pieEnlace: { minHeight: 52, justifyContent: 'center', paddingHorizontal: espacio.base },
  pieEnlaceTexto: { color: color.primarioProfundo, textDecorationLine: 'underline' },

  botonFila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: espacio.base, borderRadius: radio.sm, ...SOMBRA_TENUE,
  },
})

// -------------------------------------------------------- Barra superior

/** Racha de días hábiles consecutivos (RF-002-07), como pastilla para la
 *  barra superior. Con 0 no reprocha: muestra la llama apagada y «Empieza
 *  hoy». La llama se enciende cuando el día de hoy ya está respondido. */
export function PastillaRacha({ actual, hoyCumplido, onPress }: { actual: number; hoyCumplido: boolean; onPress?: () => void }) {
  const encendida = hoyCumplido && actual > 0
  const tono = encendida ? color.tierra : color.textoMedio
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`Racha de ${actual} ${actual === 1 ? 'día' : 'días'}`}
      style={[e.racha, { backgroundColor: encendida ? color.tierraSuave : color.superficieSuave }]}>
      <IconoLlama tamano={16} color={tono} />
      <Text style={[texto.datoFuerte, { color: tono }]}>
        {actual === 0 ? 'Empieza hoy' : `${actual} ${actual === 1 ? 'día' : 'días'}`}
      </Text>
    </Pressable>
  )
}

/** Barra de Apoyo y Perfil (Figma IcncrzVKVbewGGc6RkImCM): logo, nombre del
 *  estudio en mayúsculas, el nombre de la pantalla debajo y, a la derecha,
 *  un acceso a Perfil (omitido en Perfil mismo). */
export function BarraSuperior({ titulo, onPerfil, derecha }: { titulo: string; onPerfil?: () => void; derecha?: ReactNode }) {
  return (
    <View style={e.barraSuperior}>
      <View style={e.barraLogo}><Logo tamano={22} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 10, lineHeight: 14 }]}>ESTUDIO BIENESTAR TECH</Text>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
      </View>
      {derecha}
      {!derecha && onPerfil && (
        <Pressable onPress={onPerfil} accessibilityRole="button" accessibilityLabel="Perfil" style={e.barraPersona} hitSlop={8}>
          <IconoPersona tamano={16} color={color.primarioProfundo} />
        </Pressable>
      )}
    </View>
  )
}

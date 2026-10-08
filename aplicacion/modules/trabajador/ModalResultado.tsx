/** Modal de cierre y retroalimentación — implementa ESP-002 (RF-002-12, RF-002-13, RF-002-14).
 *
 *  Diseño: Figma VXFnbiXKzb0Hj92s2r2ulL, frames «Modal Cierre Semanal ·
 *  Nivel Alto / A Vigilar / Bajo» y «Modal Cierre Diario · Lunes a Jueves».
 *  La exportación de Stitch recortó los modales semanales debajo de «Para
 *  la próxima semana»; de ahí hacia abajo se sigue el mismo lenguaje y el
 *  bloque de probabilidad del modal diario, que sí está completo.
 *
 *  Se abre sobre la pantalla principal, ocupa casi toda la altura y se
 *  cierra con la X, tocando fuera o con el botón atrás. Dos modos:
 *   · `resultado` — el viernes, tras el OLBI: nivel por dimensión, mensaje,
 *     retrospectiva, pronóstico y recomendaciones.
 *   · `cierre` — de lunes a jueves, tras el check-in: gracias, consejo del
 *     día y probabilidad con su confianza. */

import { useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Boton } from '../nucleo/ui'
import type { DiaSemana } from '../recoleccion/datos'
import { color, espacio, radio, texto, veloModal } from '../nucleo/diseno'
import {
  IconoCerrar, IconoCheck, IconoCorazon, IconoEscudo, IconoInfo,
} from '../nucleo/iconos'
import {
  ETIQUETA_CONFIANZA, ETIQUETA_NIVEL, EXPLICACION_DIMENSION, MENSAJE_GENERAL, NOMBRE_DIMENSION,
  confianzaDe, fraseRetrospectiva, metricasAplicables, nivelGeneral, recomendacionesDe,
  type Confianza as NivelConfianza, type Nivel, type Prediccion, type ResultadoSemana,
} from './resultado'

export type ModoModal = 'resultado' | 'cierre'

type Props = {
  modo: ModoModal | null
  resultado: ResultadoSemana | null
  consejo: string | null
  prediccion: Prediccion | null
  /** Por qué toca el cuestionario, si toca. */
  motivoOlbi?: string | null
  onResponderOlbi?: () => void
  /** Los días de esta semana con su índice, para la gráfica. */
  semana?: DiaSemana[]
  onCerrar: () => void
}

/** Temperatura visual por nivel: bajo verde, a vigilar ámbar, alto tierra.
 *  Nunca rojo (el rojo es de los errores de la app). */
const TONO: Record<Nivel, { fondo: string; tinta: string; barra: string; balance: string }> = {
  bajo: { fondo: color.exitoSuave, tinta: color.exito, barra: color.primario, balance: 'Ritmo sostenible' },
  moderado: { fondo: color.alertaSuave, tinta: color.alerta, barra: '#D97706', balance: 'Señales tempranas' },
  alto: { fondo: color.tierraSuave, tinta: color.tierra, barra: color.tierra, balance: 'Desgaste significativo' },
}

const TONO_CONFIANZA: Record<NivelConfianza, { borde: string; tinta: string; fondo: string }> = {
  baja: { borde: color.arena, tinta: color.textoArena, fondo: '#FBFAF8' },
  media: { borde: '#F3D98A', tinta: color.alerta, fondo: color.alertaSuave },
  alta: { borde: '#BBE5C8', tinta: color.exito, fondo: color.exitoSuave },
}

export function ModalResultado({ modo, resultado, consejo, prediccion, motivoOlbi, onResponderOlbi, semana, onCerrar }: Props) {
  const insets = useSafeAreaInsets()
  const visible = modo !== null
  const mostrarResultado = modo === 'resultado' && resultado !== null
  const fecha = resultado ? new Date(resultado.fecha) : new Date()
  const cabecera = mostrarResultado
    ? `TU SEMANA · ${fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }).toUpperCase()}`
    : 'CHECK-IN DE HOY'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={e.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <View style={e.hoja}>
          <View style={e.asa} />
          <View style={e.barra}>
            <Text style={[texto.etiqueta, e.cabecera]}>{cabecera}</Text>
            <Pressable onPress={onCerrar} hitSlop={12} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <IconoCerrar tamano={18} color={color.texto} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]} showsVerticalScrollIndicator={false}>
            {mostrarResultado
              ? <Resultado r={resultado} />
              : <Cierre consejo={consejo} prediccion={prediccion} motivoOlbi={motivoOlbi} onResponderOlbi={onResponderOlbi} semana={semana} />}
            {/* Un solo botón relleno por pantalla. Con dos iguales, el que
                importa deja de distinguirse. */}
            {mostrarResultado || !motivoOlbi
              ? <Boton onPress={onCerrar}>Volver al inicio</Boton>
              : (
                <Pressable onPress={onCerrar} style={e.volver} accessibilityRole="button">
                  <Text style={[texto.cuerpoFuerte, { color: color.textoMedio }]}>Ahora no, volver al inicio</Text>
                </Pressable>
              )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ------------------------------------------------------------ Cierre diario

/** Por qué toca el cuestionario, dicho tras el check-in.
 *
 *  Antes aparecía sin aviso en la pantalla principal: respondías tus seis
 *  toques, volvías, y había un cuestionario de cuatro minutos esperando sin
 *  explicación. Avisar aquí, con el motivo, convierte una sorpresa en una
 *  consecuencia de lo que acabas de responder. */
const AVISO_OLBI: Record<string, { titulo: string; texto: string }> = {
  modelo: {
    titulo: 'Cuestionario completo',
    texto: 'Por cómo va tu semana conviene mirarlo con más detalle.',
  },
  sorteo: {
    titulo: 'Cuestionario completo',
    texto: 'Cada semana le toca a una parte del equipo, y esta vez saliste tú.',
  },
  sin_medir: {
    titulo: 'Cuestionario completo',
    texto: 'Hace un mes que no lo respondes. Conviene medir aunque todo vaya bien.',
  },
}

const LETRA_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Cómo viene la semana, en barras.
 *
 *  Es el promedio de las cuatro preguntas de ánimo de cada día, de 1 a 5.
 *  Existe porque hasta ahora responder a diario era dar datos a cambio de
 *  nada: esto es lo único que la persona construye contestando, y lo ve
 *  crecer cada día.
 *
 *  Más alto es peor, así que la barra se tiñe al subir. Sin números: lo que
 *  importa es la forma —si viene subiendo o bajando—, no el 3.4. */
function SemanaEnBarras({ dias }: { dias: DiaSemana[] }) {
  const porDia = new Map(dias.map((d) => [new Date(`${d.dia}T12:00:00`).getDay(), d.indice]))
  // Lunes a viernes siempre, aunque falten. Con solo los días respondidos la
  // gráfica se veía coja los lunes y los martes; así se entiende de un
  // vistazo lo que llevas y lo que falta.
  const semana = [1, 2, 3, 4, 5].map((d) => ({ letra: LETRA_DIA[d - 1], valor: porDia.get(d) ?? null }))
  const conDato = semana.filter((d) => d.valor != null)
  if (conDato.length < 2) return null

  const ultimo = conDato[conDato.length - 1].valor as number
  const previo = conDato[conDato.length - 2].valor as number
  const lectura = ultimo - previo > 0.4 ? 'Hoy terminaste peor que ayer'
    : previo - ultimo > 0.4 ? 'Hoy terminaste mejor que ayer'
    : 'Vienes estable'

  return (
    <View style={e.tarjeta}>
      <Rotulo punto>CÓMO VIENE TU SEMANA</Rotulo>
      <View style={e.barras}>
        {semana.map((d, i) => {
          const v = d.valor
          // De 1 a 5 sobre 60 px, con un mínimo visible para que un día bueno
          // no se confunda con uno sin responder.
          const alto = v == null ? 0 : Math.max(10, ((v - 1) / 4) * 60)
          const tinta = v == null ? 'transparent' : v >= 3.5 ? color.tierra : v >= 2.5 ? '#C9A227' : color.primario
          return (
            <View key={i} style={e.barraDia}>
              <View style={e.barraPista}>
                {v != null && <View style={[e.barraVal, { height: alto, backgroundColor: tinta }]} />}
              </View>
              <Text style={[texto.dato, { color: v == null ? color.textoSuave : color.textoMedio, fontSize: 11 }]}>
                {d.letra}
              </Text>
            </View>
          )
        })}
      </View>
      <Text style={[texto.cuerpo, { color: color.texto }]}>{lectura}</Text>
    </View>
  )
}

/** Las dos cifras sobre las que se puede hacer algo.
 *
 *  El ánimo es el resultado; dormir y las horas son la causa, y son lo único
 *  de este check-in que la persona puede cambiar esta misma noche. Se comparan
 *  con las referencias del estudio —7 h de sueño, 8.5 de jornada— porque un
 *  «6.2 h» suelto no dice si está bien o mal. */
const REFERENCIA = { sueno: 7, horas: 8.5 }

function media(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function CifrasSemana({ dias }: { dias: DiaSemana[] }) {
  const sueno = media(dias.map((d) => d.sueno))
  const horas = media(dias.map((d) => d.horas))
  if (sueno == null && horas == null) return null

  return (
    <View style={e.cifras}>
      {sueno != null && (
        <Cifra
          emoji="😴"
          valor={`${sueno.toFixed(1)} h`}
          rotulo="de sueño"
          nota={sueno < REFERENCIA.sueno ? `bajo las ${REFERENCIA.sueno} recomendadas` : 'en lo recomendable'}
          alerta={sueno < REFERENCIA.sueno}
        />
      )}
      {horas != null && (
        <Cifra
          emoji="⏱️"
          valor={`${horas.toFixed(1)} h`}
          rotulo="de jornada"
          nota={horas > REFERENCIA.horas ? `sobre las ${REFERENCIA.horas} de referencia` : 'dentro de lo previsto'}
          alerta={horas > REFERENCIA.horas}
        />
      )}
    </View>
  )
}

function Cifra({ emoji, valor, rotulo, nota, alerta }: {
  emoji: string; valor: string; rotulo: string; nota: string; alerta: boolean
}) {
  return (
    <View style={[e.cifra, alerta && e.cifraAlerta]}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[texto.seccion, { color: alerta ? color.tierra : color.texto, fontSize: 20 }]}>{valor}</Text>
      <Text style={[texto.dato, { color: color.textoMedio }]}>{rotulo}</Text>
      <Text style={[texto.dato, { color: alerta ? color.tierra : color.textoSuave, fontSize: 11 }]}>{nota}</Text>
    </View>
  )
}

function Cierre({ consejo, prediccion, motivoOlbi, onResponderOlbi, semana }: {
  consejo: string | null
  prediccion: Prediccion | null
  motivoOlbi?: string | null
  onResponderOlbi?: () => void
  semana?: DiaSemana[]
}) {
  const aviso = motivoOlbi ? AVISO_OLBI[motivoOlbi] : null
  return (
    <>
      {/* El acuse va en una línea. Lo que importa de esta pantalla es lo que
          viene después, no felicitar a nadie por quince segundos. */}
      <View style={e.acuse}>
        <View style={e.acuseSello}><IconoCheck tamano={13} color="#FFFFFF" /></View>
        <Text style={[texto.seccion, { color: color.texto }]}>Listo por hoy</Text>
      </View>

      {aviso && (
        <View style={e.siguiente}>
          <Text style={[texto.etiqueta, { color: '#1E4D8C' }]}>LO SIGUIENTE</Text>
          <Text style={[texto.seccion, { color: color.texto, fontSize: 19 }]}>{aviso.titulo}</Text>
          <Text style={[texto.dato, { color: color.textoMedio }]}>16 preguntas · 4 minutos</Text>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{aviso.texto}</Text>
          {onResponderOlbi && <Boton onPress={onResponderOlbi}>Responder ahora</Boton>}
        </View>
      )}

      {semana && <SemanaEnBarras dias={semana} />}
      {semana && <CifrasSemana dias={semana} />}

      {consejo && (
        <View style={e.tarjeta}>
          <Rotulo punto>PARA HOY</Rotulo>
          <Text style={[texto.cuerpo, { color: color.texto }]}>{consejo}</Text>
        </View>
      )}
    </>
  )
}

// ---------------------------------------------------------- Resultado viernes

function Resultado({ r }: { r: ResultadoSemana }) {
  const general = nivelGeneral(r)
  const mensaje = MENSAJE_GENERAL[general]
  const retro = fraseRetrospectiva(r)

  return (
    <>
      <View style={[e.pastilla, { backgroundColor: TONO[general].fondo }]}>
        <View style={[e.punto, { backgroundColor: TONO[general].tinta }]} />
        <Text style={[texto.dato, { color: TONO[general].tinta }]}>Nivel general · {ETIQUETA_NIVEL[general]}</Text>
      </View>
      <Text style={texto.titulo}>{mensaje.titulo}</Text>
      <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{mensaje.cuerpo}</Text>

      {r.detectado && (
        <View style={[e.tarjeta, e.tarjetaSuave, { flexDirection: 'row', gap: espacio.sm }]}>
          <View style={e.corazon}><IconoCorazon tamano={18} color={color.textoMedio} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>APOYO DEL ESTUDIO</Text>
            <Text style={[texto.cuerpo, { color: color.texto }]}>
              Un psicólogo del estudio te ofrecerá una sesión de apoyo. La verás en tu pantalla de
              inicio en cuanto esté disponible.
            </Text>
            <Text style={[texto.apoyo, { color: color.textoSuave }]}>
              Completamente confidencial, sin mediación ni aviso a tu empresa.
            </Text>
          </View>
        </View>
      )}

      <View style={e.tarjeta}>
        <View style={[e.fila, e.separador]}>
          <Text style={[texto.etiqueta, { color: color.textoSuave, flex: 1 }]}>BALANCE DE LA SEMANA</Text>
          <View style={[e.insignia, { backgroundColor: TONO[general].fondo }]}>
            <Text style={[texto.dato, { color: TONO[general].tinta }]}>{TONO[general].balance}</Text>
          </View>
        </View>
        {r.dimensiones.map((d, i) => (
          <View key={d.clave} style={[e.dimension, i > 0 && e.separadorArriba]}>
            <View style={e.fila}>
              <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>{NOMBRE_DIMENSION[d.clave]}</Text>
              <View style={[e.insignia, { backgroundColor: TONO[d.nivel].fondo }]}>
                <Text style={[texto.dato, { color: TONO[d.nivel].tinta }]}>{ETIQUETA_NIVEL[d.nivel]}</Text>
              </View>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>{d.indice} de 100</Text>
            </View>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>{EXPLICACION_DIMENSION[d.clave]}</Text>
            <View style={e.pista}>
              <View style={[e.avance, { width: `${d.indice}%`, backgroundColor: TONO[d.nivel].barra }]} />
            </View>
          </View>
        ))}
      </View>

      {retro && (
        <View style={[e.tarjeta, e.tarjetaSuave]}>
          <Rotulo punto>RETROSPECTIVA DEL MODELO</Rotulo>
          <Text style={[texto.cuerpo, { color: color.texto }]}>{retro}</Text>
        </View>
      )}

      {r.pronostico && r.pronostico.probabilidad != null && (
        <BloqueProbabilidad p={r.pronostico} titulo="PARA LA PRÓXIMA SEMANA" />
      )}

      <Titular>PARA ESTA SEMANA</Titular>
      <View style={e.tarjeta}>
        {recomendacionesDe(r).flatMap((bloque) =>
          bloque.textos.map((t, i) => (
            <View key={`${bloque.dimension}-${i}`} style={e.recomendacion}>
              <View style={e.vineta}><IconoCheck tamano={9} color="#FFFFFF" /></View>
              <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>{t}</Text>
            </View>
          )),
        )}
      </View>

      <View style={[e.fila, { alignItems: 'flex-start', paddingHorizontal: 4 }]}>
        <IconoEscudo tamano={16} color={color.textoSuave} />
        <Text style={[texto.apoyo, { color: color.textoSuave, flex: 1 }]}>
          No es un diagnóstico. Solo tú y el equipo del estudio lo ven; tu empresa no.
        </Text>
      </View>
    </>
  )
}

// --------------------------------------------------------------- Piezas

/** «Tu semana hasta hoy»: la tarjeta completa del nowcast, con su confianza.
 *  La usa el modal de cierre y la pantalla principal de lunes a jueves. */
export function TarjetaProbabilidad({ p }: { p: Prediccion }) {
  return <BloqueProbabilidad p={p} titulo="TU SEMANA HASTA HOY" />
}

/** Un bloque de probabilidad: cabecera (título, (i), confianza) y el
 *  número. Lo que hay que ver cabe en dos líneas; lo que hay que saber
 *  —qué significa, cuánto acierta, con qué se entrenó— se abre con el (i).
 *  Una persona cerrando su día no está leyendo un informe (RF-002-13). */
function BloqueProbabilidad({ p, titulo }: { p: Prediccion; titulo: string }) {
  const [explicar, setExplicar] = useState(false)
  return (
    <View style={e.tarjeta}>
      <View style={e.fila}>
        <View style={[e.fila, { gap: 6, flex: 1 }]}>
          <Text style={[texto.etiqueta, { color: color.textoSuave }]}>{titulo}</Text>
          <Pressable
            onPress={() => setExplicar((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={explicar ? 'Ocultar explicación' : 'Qué significa este número'}
            style={[e.info, explicar && e.infoActivo]}
          >
            <IconoInfo tamano={12} color={explicar ? '#FFFFFF' : color.primario} />
          </Pressable>
        </View>
        <Confianza p={p} />
      </View>
      <Probabilidad p={p} />
      {explicar && <Explicacion p={p} />}
    </View>
  )
}

/** RF-002-13 — la probabilidad como anillo, con el anillo pequeño de
 *  «detección» (recall) al lado, como en el diseño. Solo el número y una
 *  frase; la letra pequeña vive en `Explicacion`. */
export function Probabilidad({ p }: { p: Prediccion }) {
  const pct = Math.round((p.probabilidad ?? 0) * 100)
  const tinta = pct >= 50 ? color.tierra : color.primario

  // Fuera el anillo de «6 de cada 10 detecta». Era la precisión del modelo
  // puesta delante de quien responde: a esa persona no le sirve de nada saber
  // cuántos casos se le escapan al sistema, y a quien compra el producto le
  // suena a disculpa. Sigue existiendo donde tiene sentido: en el panel del
  // investigador, y en el detalle que se abre con el botón de información.
  return (
    <View style={e.probabilidad}>
      <Anillo tamano={78} grosor={7} fraccion={pct / 100} tinta={tinta}>
        <Text style={[texto.titulo, { color: color.texto, fontSize: 22, lineHeight: 26 }]}>
          {pct}<Text style={[texto.dato, { color: color.textoMedio }]}>%</Text>
        </Text>
      </Anillo>
      <Text style={[texto.cuerpo, { color: color.texto, flex: 1 }]}>
        de probabilidad de que el cuestionario te saliera alto
      </Text>
    </View>
  )
}

/** Lo que se abre con el (i): tres frases, cada una responde una pregunta. */
function Explicacion({ p }: { p: Prediccion }) {
  const m = metricasAplicables(p)
  const c = confianzaDe(p)
  const pronostico = p.tarea === 'pronostico'
  const lineas: { titulo: string; cuerpo: string }[] = [
    {
      titulo: '¿Qué es este número?',
      cuerpo: pronostico
        ? 'La probabilidad de que el cuestionario completo te saliera alto si lo respondieras hoy. Se calcula con lo que llevas contestado esta semana, y es lo que decide cuándo se te pide.'
        : 'La probabilidad, según el modelo del estudio, de que tu cuestionario de este viernes salga alto. Se actualiza con cada check-in.',
    },
  ]
  if (m) {
    lineas.push({
      titulo: `¿Por qué confianza ${ETIQUETA_CONFIANZA[c].split(' ')[1]}?`,
      cuerpo: pronostico
        ? `De cada 10 avisos que da, se confirman unos ${Math.round(m.precision * 10)}; y detecta unos ${Math.round(m.recall * 10)} de cada 10 casos altos.`
        : `Con ${p.n_dias} ${p.n_dias === 1 ? 'día respondido' : 'días respondidos'}, de cada 10 avisos que da se confirman unos ${Math.round(m.precision * 10)}; y detecta unos ${Math.round(m.recall * 10)} de cada 10 casos altos. Con más días, acierta más.`,
    })
  }
  if (p.origen === 'preentrenamiento') {
    lineas.push({
      titulo: '¿Con qué aprendió?',
      cuerpo: 'Por ahora, con datos de otro estudio. Cada semana que respondes lo entrena con los de este.',
    })
  }
  return (
    <View style={e.explicacion}>
      {lineas.map((l) => (
        <View key={l.titulo} style={{ gap: 2 }}>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>{l.titulo}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>{l.cuerpo}</Text>
        </View>
      ))}
    </View>
  )
}

function Confianza({ p }: { p: Prediccion }) {
  const c = confianzaDe(p)
  return (
    <View style={[e.confianza, { borderColor: TONO_CONFIANZA[c].borde, backgroundColor: TONO_CONFIANZA[c].fondo }]}>
      <Text style={[texto.etiqueta, { color: TONO_CONFIANZA[c].tinta }]}>{ETIQUETA_CONFIANZA[c].toUpperCase()}</Text>
    </View>
  )
}

function Anillo({
  tamano, grosor, fraccion, tinta, children,
}: { tamano: number; grosor: number; fraccion: number; tinta: string; children: ReactNode }) {
  const r = (tamano - grosor) / 2
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraccion))
  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tamano} height={tamano} style={StyleSheet.absoluteFill}>
        <Circle cx={tamano / 2} cy={tamano / 2} r={r} stroke={color.superficieSuave} strokeWidth={grosor} fill="none" />
        <Circle
          cx={tamano / 2} cy={tamano / 2} r={r} stroke={tinta} strokeWidth={grosor} fill="none"
          strokeLinecap="round" strokeDasharray={`${c * f} ${c}`}
          transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}
        />
      </Svg>
      {children}
    </View>
  )
}

function Rotulo({ children, punto }: { children: string; punto?: boolean }) {
  return (
    <View style={[e.fila, { gap: 8 }]}>
      {punto && <View style={[e.punto, { backgroundColor: color.primario }]} />}
      <Text style={[texto.etiqueta, { color: color.textoMedio }]}>{children}</Text>
    </View>
  )
}

function Titular({ children }: { children: string }) {
  return (
    <View style={[e.fila, { gap: 12, marginTop: espacio.xs }]}>
      <Text style={[texto.etiqueta, { color: color.textoSuave }]}>{children}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: color.borde }} />
    </View>
  )
}

const e = StyleSheet.create({
  cifras: { flexDirection: 'row', gap: espacio.sm },
  cifra: { flex: 1, gap: 2, alignItems: 'flex-start', backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base, borderWidth: 1, borderColor: color.borde },
  cifraAlerta: { borderColor: '#E8CFC2', backgroundColor: '#FDF6F2' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.sm, paddingTop: espacio.xs },
  barraDia: { alignItems: 'center', gap: 6, flex: 1 },
  // La pista vacía da el hueco de los días que faltan, para que las barras
  // no bailen de sitio según cuántas haya.
  barraPista: { height: 60, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color.borde },
  barraVal: { width: '66%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  acuse: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, marginTop: espacio.xs },
  acuseSello: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.primario, alignItems: 'center', justifyContent: 'center' },
  volver: { alignItems: 'center', paddingVertical: espacio.md },
  siguiente: { gap: espacio.sm, backgroundColor: '#EEF5FF', borderRadius: radio.lg, padding: espacio.base, borderWidth: 1, borderColor: '#B9D4F5' },
  fondo: { ...veloModal, backgroundColor: 'rgba(28, 25, 23, 0.55)', justifyContent: 'flex-end' },
  hoja: {
    maxHeight: '92%', backgroundColor: color.fondo,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    width: '100%', maxWidth: 520, alignSelf: 'center',
  },
  asa: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.borde, marginTop: 10 },
  barra: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  cabecera: { color: color.textoMedio, flex: 1, letterSpacing: 1.2 },
  cerrar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: color.superficie,
    borderWidth: 1, borderColor: color.borde, alignItems: 'center', justifyContent: 'center',
  },
  contenido: { padding: 20, paddingTop: 12, paddingBottom: espacio.xxl, gap: espacio.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  pastilla: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  tarjeta: {
    backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.md, gap: espacio.sm,
    borderWidth: 1, borderColor: color.borde,
  },
  tarjetaSuave: { backgroundColor: '#F6F5F2' },
  separador: { paddingBottom: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde },
  separadorArriba: { paddingTop: espacio.sm, borderTopWidth: 1, borderTopColor: color.borde },
  dimension: { gap: 6 },
  insignia: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pista: { height: 8, borderRadius: 4, backgroundColor: color.superficieSuave, overflow: 'hidden', marginTop: 4 },
  avance: { height: 8, borderRadius: 4 },
  corazon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficie,
    borderWidth: 1, borderColor: color.borde, alignItems: 'center', justifyContent: 'center',
  },
  probabilidad: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.md,
    backgroundColor: color.fondo, borderRadius: radio.lg, padding: espacio.md,
    borderWidth: 1, borderColor: color.borde,
  },
  anillos: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confianza: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  info: { width: 20, height: 20, borderRadius: 10, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  infoActivo: { backgroundColor: color.primario },
  explicacion: { gap: espacio.sm, paddingTop: espacio.xs, borderTopWidth: 1, borderTopColor: color.borde },
  recomendacion: { flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start' },
  vineta: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: color.primario,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  gracias: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start', marginTop: espacio.xs },
  check: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: color.primarioSuave,
    alignItems: 'center', justifyContent: 'center',
  },
  notaCentrada: { color: color.textoSuave, textAlign: 'center', paddingHorizontal: 12 },
})

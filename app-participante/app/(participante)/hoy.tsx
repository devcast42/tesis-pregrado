/** Pantalla principal del participante — implementa ESP-002 (RF-002-01,
 *  RF-002-08) con el diseño de Figma (nodos 1:2 y 1:138).
 *
 *  Se abre a diario, muchas veces con prisa. Lo primero que debe quedar claro
 *  es si queda algo por hacer o no; todo lo demás es secundario.
 *
 *  La pantalla tiene dos estados:
 *  · Con pendientes: la primera tarea es la tarjeta principal (hero) y las
 *    demás van en tarjetas secundarias.
 *  · Todo hecho: un bloque de cierre y la lista de lo registrado hoy.
 *
 *  En ninguno de los dos aparece un puntaje, un estado, una racha o un
 *  reproche (ESP-004 RN-004-03, ESP-007). */

import { useCallback, useEffect, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { obtenerParticipante } from '../../modules/acceso/datos'
import {
  calendarios, diasConCheckinEstaSemana, indiceLunes, inicioDeSemana, prediccionActual, racha as consultarRacha, ultimaPrediccionSemana, ultimosEnvios, type Racha,
} from '../../modules/recoleccion/datos'
import { agendaDeHoy, type ItemAgenda } from '../../modules/recoleccion/agenda'
import { sincronizarRecordatorios } from '../../modules/recoleccion/recordatorios'
import { sesionDisponible, type SesionDisponible } from '../../modules/consulta/datos'
import {
  BarraSuperior, BloqueCierre, PastillaRacha, PieEtico, Pensamiento, RegistrosDelDia, RitmoSemanal,
  Saludo, TarjetaApoyo, TarjetaHero, TarjetaSecundaria, type EstadoDia,
} from '../../modules/participante/piezas'
import { fechaLarga, fraseDelDia, saludoPorHora, semanaDelEstudio } from '../../modules/participante/textos'
import { Cargando } from '../../modules/nucleo/ui'
import { ahora, cargarDesfase } from '../../modules/nucleo/reloj'
import {
  ultimoResultado, guardarResultado, nivelGeneral, ETIQUETA_NIVEL, tomarConsejo, type Prediccion, type ResultadoSemana,
} from '../../modules/participante/resultado'
import { ModalResultado, TarjetaProbabilidad, type ModoModal } from '../../modules/participante/ModalResultado'
import { color, espacio } from '../../modules/nucleo/diseno'
import type { Participante } from '../../modules/nucleo/tipos'

/** Cómo se presenta cada instrumento en la pantalla. Los tiempos y textos son
 *  los reales; el diseño traía ejemplos. */
const PRESENTACION: Record<string, { insignia: string; titulo: string; descripcion: string; accion: string }> = {
  estable: {
    insignia: 'Solo una vez',
    titulo: 'Datos iniciales · 2 minutos',
    descripcion: 'Ocho preguntas sobre tu contexto de trabajo. Solo las responderás esta vez.',
    accion: 'Responder ahora',
  },
  diario: {
    insignia: 'Lunes a jueves',
    titulo: 'Check-in de hoy · 35 segundos',
    descripcion: 'Cuatro frases sobre tu día y unos datos. Responde con lo primero que se te venga.',
    accion: 'Comenzar check-in',
  },
  olbi: {
    insignia: 'Cada viernes',
    titulo: 'Cuestionario del viernes · 4 minutos',
    descripcion: 'Un espacio más profundo para cerrar la semana: dieciséis afirmaciones sobre tu relación con el trabajo.',
    accion: 'Responder ahora',
  },
  semanal: {
    insignia: 'Cierre de la semana',
    titulo: 'Sobre tu semana · 30 segundos',
    descripcion: 'Tres preguntas más y terminaste por esta semana.',
    accion: 'Responder ahora',
  },
}

export default function Hoy() {
  const [participante, setParticipante] = useState<Participante | null>(null)
  const [agenda, setAgenda] = useState<ItemAgenda[] | null>(null)
  const [diasRespondidos, setDiasRespondidos] = useState<Set<number>>(new Set())
  const [sesion, setSesion] = useState<SesionDisponible | null>(null)
  const [refrescando, setRefrescando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoSemana | null>(null)
  const [modal, setModal] = useState<ModoModal | null>(null)
  const [consejo, setConsejo] = useState<string | null>(null)
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)
  const [rachaActual, setRachaActual] = useState<Racha | null>(null)
  // La celebración de la racha se dispara al cerrar el modal de cierre, no
  // debajo de él, donde nadie la vería.
  const [celebrarPendiente, setCelebrarPendiente] = useState(false)
  const [celebrar, setCelebrar] = useState(false)
  const { mostrar } = useLocalSearchParams<{ mostrar?: string }>()
  const insets = useSafeAreaInsets()

  // RF-002-12 — al volver de un formulario con `mostrar`, se abre el modal
  // de cierre. El parámetro se consume una vez: cerrar el modal no lo reabre.
  useEffect(() => {
    if (mostrar !== 'resultado' && mostrar !== 'cierre') return
    router.setParams({ mostrar: '' })
    setCelebrarPendiente(true)
    if (mostrar === 'cierre') {
      setConsejo(tomarConsejo())
      setModal('cierre')
      return
    }
    // El resultado se lee antes de abrir, para no mostrar un instante el
    // cierre genérico mientras carga.
    abrirResultado()
  }, [mostrar])

  /** Abre el modal del resultado. Si al guardado le falta la retrospectiva
   *  o el pronóstico (RF-002-14) —versión anterior, red caída al enviar, o
   *  check-ins que llegaron después— los vuelve a pedir y los guarda. Son
   *  dos llamadas baratas; el resultado del OLBI en sí no se recalcula. */
  async function abrirResultado() {
    let r = await ultimoResultado()
    if (r && participante) {
      const [retrospectiva, pronostico] = await Promise.all([
        ultimaPrediccionSemana(participante.id),
        r.pronostico ?? prediccionActual(participante.id, 'pronostico'),
      ])
      r = { ...r, retrospectiva, pronostico }
      await guardarResultado(r)
    }
    setResultado(r)
    setModal('resultado')
  }

  const cargar = useCallback(async () => {
    await cargarDesfase()
    const p = await obtenerParticipante()
    if (!p) return router.replace('/')
    // El nowcast solo tiene sentido de lunes a jueves: el viernes el OLBI
    // resuelve la semana y una predicción nueva pisaría la del jueves, que
    // es la que la retrospectiva confronta (RF-002-14).
    const esDiaDeNowcast = indiceLunes(ahora()) < 4
    const [envios, cal, dias, s, pred, rachaHoy] = await Promise.all([
      ultimosEnvios(p.id),
      calendarios(),
      diasConCheckinEstaSemana(p.id),
      sesionDisponible(),
      esDiaDeNowcast ? prediccionActual(p.id) : Promise.resolve(null),
      consultarRacha(p.id),
    ])
    setPrediccion(pred)
    setRachaActual(rachaHoy)
    // RF-002-06 — los recordatorios viven en el sistema y se pierden al
    // reinstalar; se reprograman en cada apertura, sin bloquear la pantalla.
    if (p.estado === 'activo') sincronizarRecordatorios().catch(() => {})
    setParticipante(p)
    setAgenda(agendaDeHoy(envios, cal))
    setDiasRespondidos(dias)
    setSesion(s)
    // RF-002-12 — el resultado del viernes se puede volver a ver toda la
    // semana siguiente; después ya no es «tu semana».
    const r = await ultimoResultado()
    const limite = inicioDeSemana(ahora()); limite.setDate(limite.getDate() - 7)
    setResultado(r && new Date(r.fecha) >= limite ? r : null)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function refrescar() {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  const irAAjustes = () => router.push('/perfil')

  if (!agenda || !participante) return <Cargando />

  const ahoraMismo = ahora()
  // RN-007-04 — quien fue detectado sale del seguimiento diario: sin
  // formularios, pero con su resultado y su sesión de apoyo.
  const enSeguimiento = participante.estado === 'activo'
  const pendientes = enSeguimiento ? agenda.filter((i) => !i.completado) : []
  const completados = agenda.filter((i) => i.completado)
  const todoListo = pendientes.length === 0
  const [principal, ...secundarios] = pendientes
  const saludo = saludoPorHora(ahoraMismo)

  // Estado de cada día de la semana en curso. El formulario del día ya
  // enviado (el diario, o el OLBI el viernes) se refleja también aquí.
  const hoy = indiceLunes(ahoraMismo)
  const hoyHecho = agenda.some((i) => (i.clave === 'diario' || i.clave === 'olbi') && i.completado)
  const finDeSemana = hoy >= 5
  const dias: EstadoDia[] = Array.from({ length: 7 }, (_, i) => {
    if (i === hoy && !finDeSemana) return hoyHecho ? 'hoy_respondido' : 'hoy_pendiente'
    return diasRespondidos.has(i) ? 'respondido' : 'otro'
  })
  const cierre = finDeSemana
    ? 'No hay nada que responder el fin de semana. Nos vemos el lunes; te avisaremos con una notificación.'
    : hoy === 4
      ? 'Ya cerraste tu semana. No hay nada más hasta el lunes; te avisaremos con una notificación.'
      : 'Ya registraste todo lo de hoy. No hay nada más que hacer hasta mañana; te avisaremos con una notificación.'

  return (
    <View style={[e.pantalla, { paddingTop: insets.top }]}>
      <BarraSuperior
        titulo="Hoy"
        onPerfil={irAAjustes}
        derecha={rachaActual && enSeguimiento ? (
          <PastillaRacha actual={rachaActual.actual} hoyCumplido={rachaActual.hoy_cumplido} onPress={() => Alert.alert(
            rachaActual.actual === 0 ? 'Tu racha' : `Racha de ${rachaActual.actual} ${rachaActual.actual === 1 ? 'día' : 'días'}`,
            `Días hábiles seguidos con tu registro del día. El fin de semana no la rompe.${rachaActual.mejor > rachaActual.actual ? ` Tu mejor racha: ${rachaActual.mejor} días.` : ''}${!rachaActual.hoy_cumplido && rachaActual.actual > 0 ? ' Responde hoy para mantenerla.' : ''}`,
          )} />
        ) : undefined}
      />

      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <Saludo
          fecha={fechaLarga(ahoraMismo)}
          semana={semanaDelEstudio(participante.inscrito_en, ahoraMismo)}
          codigo={participante.codigo_anonimo}
          titulo={saludo.titulo}
          subtitulo={todoListo ? 'Gracias por tu tiempo de hoy.' : saludo.subtitulo}
          onAjustes={irAAjustes}
        />

        {!enSeguimiento && (
          <BloqueCierre
            mensaje="Tu seguimiento de check-ins terminó por ahora. El equipo del estudio te acompaña desde aquí: revisa tu resultado y, cuando esté disponible, tu sesión de apoyo."
            nota="Tus respuestas anteriores siguen protegidas y disociadas de tu empresa."
          />
        )}

        {todoListo && enSeguimiento && (
          <BloqueCierre
            mensaje={cierre}
            nota="Responder cada día es lo que le da valor a este estudio. Si un día no puedes, no pasa nada: responde al siguiente."
          />
        )}

        {enSeguimiento && <RitmoSemanal dias={dias} racha={rachaActual?.actual ?? 0} celebrar={celebrar} onPress={() => router.push('/registros')} />}

        {principal && (
          <TarjetaHero
            titulo={PRESENTACION[principal.clave].titulo}
            descripcion={PRESENTACION[principal.clave].descripcion}
            accion={PRESENTACION[principal.clave].accion}
            onPress={() => router.push(`/formulario/${principal.clave}`)}
          />
        )}

        {secundarios.map((item) => (
          <TarjetaSecundaria
            key={item.clave}
            insignia={PRESENTACION[item.clave].insignia}
            titulo={PRESENTACION[item.clave].titulo}
            descripcion={PRESENTACION[item.clave].descripcion}
            accion={PRESENTACION[item.clave].accion}
            onPress={() => router.push(`/formulario/${item.clave}`)}
          />
        ))}

        {todoListo && enSeguimiento && completados.length > 0 && (
          <RegistrosDelDia
            registros={completados.map((i) => ({
              titulo: i.titulo,
              detalle: PRESENTACION[i.clave].insignia,
              estado: 'HOY',
            }))}
          />
        )}

        {sesion && <TarjetaApoyo onPress={() => router.push(`/consulta/${sesion.id}`)} />}

        {prediccion && !finDeSemana && hoy < 4 && <TarjetaProbabilidad p={prediccion} />}

        {resultado && (
          <TarjetaSecundaria
            insignia={`Nivel ${ETIQUETA_NIVEL[nivelGeneral(resultado)].toLowerCase()}`}
            titulo="Tu resultado del viernes"
            descripcion="Cómo cerró tu semana y qué puedes hacer con eso."
            accion="Ver de nuevo"
            onPress={abrirResultado}
          />
        )}

        <Pensamiento frase={fraseDelDia(ahoraMismo)} />

        <PieEtico codigo={participante.codigo_anonimo} onAjustes={irAAjustes} />
      </ScrollView>

      <ModalResultado modo={modal} resultado={resultado} consejo={consejo} prediccion={prediccion} onCerrar={() => {
        setModal(null)
        if (celebrarPendiente) { setCelebrarPendiente(false); setCelebrar(true); setTimeout(() => setCelebrar(false), 2000) }
      }} />
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: {
    paddingHorizontal: 20, paddingBottom: espacio.xxl, gap: espacio.lg,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
})

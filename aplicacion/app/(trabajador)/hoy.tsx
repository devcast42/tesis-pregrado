/** Pantalla principal del trabajador — implementa ESP-002 (RF-002-01,
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
import { obtenerTrabajador } from '../../modules/acceso/datos'
import {
  calendarios, diasConCheckinEstaSemana, indiceLunes, inicioDeSemana, olbiToca, prediccionActual,
  estadosDelDia, historial, racha as consultarRacha, semanaEnCurso, ultimaPrediccionSemana, ultimosEnvios,
  type DiaDelHistorial, type DiaSemana, type Racha,
} from '../../modules/recoleccion/datos'
import { agendaDeHoy, type ItemAgenda } from '../../modules/recoleccion/agenda'
import { citaVigente, fechaHora, misCitas, type Cita } from '../../modules/consulta/citas'
import { sincronizarRecordatorios } from '../../modules/recoleccion/recordatorios'
import { sesionDisponible, type SesionDisponible } from '../../modules/consulta/datos'
import {
  BarraSuperior, BloqueCierre, PastillaRacha, PieEtico, Pensamiento, RegistrosDelDia, RitmoSemanal,
  NavegadorDias, Saludo, TarjetaApoyo, TarjetaHero, TarjetaSecundaria, type EstadoDia,
} from '../../modules/trabajador/piezas'
import { fechaLarga, fraseDelDia, saludoPorHora, semanaDelEstudio } from '../../modules/trabajador/textos'
import { Cargando } from '../../modules/nucleo/ui'
import { ahora, cargarDesfase } from '../../modules/nucleo/reloj'
import {
  ultimoResultado, guardarResultado, nivelGeneral, ETIQUETA_NIVEL, tomarConsejo, type Prediccion, type ResultadoSemana,
} from '../../modules/trabajador/resultado'
import { ModalResultado, TarjetaProbabilidad, type ModoModal } from '../../modules/trabajador/ModalResultado'
import { color, espacio } from '../../modules/nucleo/diseno'
import type { Trabajador } from '../../modules/nucleo/tipos'

/** Lo único que la pantalla aporta de su cuenta: la insignia de cadencia y el
 *  verbo del botón. El título, la descripción y la duración salen de la
 *  definición del formulario (ESP-002 RF-002-02), porque son lo que cambia
 *  cuando cambian las preguntas: tenerlos copiados aquí hizo que la tarjeta
 *  siguiera prometiendo «25 segundos y dos datos» después de pasar el diario
 *  a nueve preguntas. */
/** Por qué apareció el cuestionario hoy. Decirlo importa: aparecer sin más
 *  en un día cualquiera se lee como un fallo, y «porque te tocó en el sorteo»
 *  no es lo mismo que «porque tus respuestas de esta semana lo sugieren». */
const POR_QUE: Record<string, string> = {
  modelo: 'Por cómo va tu semana',
  sorteo: 'Te tocó esta semana',
  sin_medir: 'Hace un mes que no lo respondes',
}

function etiquetaDia(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const TITULO_TAREA = { diario: 'Check-in', olbi: 'Cuestionario completo', cita: 'Pedir tu cita' } as const

/** Un día de atrás, en solo lectura.
 *
 *  Lo que caducó no se puede responder desde aquí: el check-in preguntaba por
 *  aquel día y contestarlo hoy sería inventar. Lo que sigue pendiente se hace
 *  desde hoy, donde aparece como retrasado. */
function DiaPasado({ d, hoy }: { d: DiaDelHistorial; hoy: string }) {
  const est = estadosDelDia(d, hoy)
  const filas = (['diario', 'olbi', 'cita'] as const)
    .map((k) => ({ k, estado: est[k] }))
    .filter((x) => x.estado !== null)

  if (filas.length === 0) {
    return (
      <TarjetaSecundaria
        estado="caducado" insignia="" titulo="Nada que hacer ese día"
        pie="Fin de semana o fuera del seguimiento" descripcion="" accion="" onPress={() => {}}
      />
    )
  }
  return (
    <>
      {filas.map(({ k, estado }) => (
        <TarjetaSecundaria
          key={k}
          estado={estado === 'hecho' ? undefined : 'caducado'}
          completado={estado === 'hecho'}
          insignia=""
          titulo={TITULO_TAREA[k]}
          pie={estado === 'hecho' ? 'Respondido ese día' : 'Se quedó sin responder'}
          descripcion=""
          accion=""
          onPress={() => {}}
        />
      ))}
    </>
  )
}

function insigniaDe(clave: string, motivo: string | null): string {
  if (clave === 'olbi' && motivo) return POR_QUE[motivo] ?? PRESENTACION.olbi.insignia
  return PRESENTACION[clave].insignia
}

const PRESENTACION: Record<string, { insignia: string; accion: string; descripcion: string }> = {
  estable: {
    insignia: 'Solo una vez',
    descripcion: 'Ocho preguntas sobre tu contexto de trabajo. Solo las responderás esta vez.',
    accion: 'Responder ahora',
  },
  diario: {
    insignia: 'Lunes a jueves',
    descripcion: 'Cuatro frases sobre tu día y unos datos. Responde con lo primero que se te venga.',
    accion: 'Comenzar check-in',
  },
  olbi: {
    // Sustituida en tiempo de ejecución por `insigniaDe`: el cuestionario ya
    // no cae un día fijo, así que la insignia dice POR QUÉ apareció.
    insignia: 'De vez en cuando',
    descripcion: 'Un espacio más profundo para cerrar la semana: dieciséis afirmaciones sobre tu relación con el trabajo.',
    accion: 'Responder ahora',
  },
  semanal: {
    insignia: 'Cierre de la semana',
    descripcion: 'Tres preguntas más y terminaste por esta semana.',
    accion: 'Responder ahora',
  },
}

/** «Check-in de hoy · 35 segundos». Ambas mitades salen de la definición. */
function encabezado(item: ItemAgenda): string {
  return item.duracion ? `${item.titulo} · ${item.duracion}` : item.titulo
}

export default function Hoy() {
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null)
  const [agenda, setAgenda] = useState<ItemAgenda[] | null>(null)
  const [motivoOlbi, setMotivoOlbi] = useState<string | null>(null)
  const [semana, setSemana] = useState<DiaSemana[]>([])
  const [cita, setCita] = useState<Cita | null>(null)
  // 0 = hoy, −1 = ayer. Mirar atrás es solo lectura: lo que caducó no se
  // puede responder, y lo que sigue pendiente se hace desde hoy.
  const [offsetDia, setOffsetDia] = useState(0)
  const [historialDias, setHistorialDias] = useState<DiaDelHistorial[]>([])
  const [derivado, setDerivado] = useState(false)
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
  const diaMirado = offsetDia < 0 ? historialDias[-offsetDia] : null
  const hoyMismo = offsetDia === 0

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
    if (r && trabajador) {
      const [retrospectiva, pronostico] = await Promise.all([
        ultimaPrediccionSemana(trabajador.id),
        r.pronostico ?? prediccionActual(trabajador.id, 'pronostico'),
      ])
      r = { ...r, retrospectiva, pronostico }
      await guardarResultado(r)
    }
    setResultado(r)
    setModal('resultado')
  }

  const cargar = useCallback(async () => {
    await cargarDesfase()
    const p = await obtenerTrabajador()
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
    if (p.estado === 'activo') {
      // Los recordatorios anuncian la duración: se la pasamos desde la misma
      // definición que pinta la tarjeta, para que no puedan contradecirla.
      sincronizarRecordatorios({ diario: cal.diario?.duracion, olbi: cal.olbi?.duracion }).catch(() => {})
    }
    setTrabajador(p)
    const [olbi, serieSemana, citas, hist] = await Promise.all([
      olbiToca(), semanaEnCurso(p.id), misCitas(), historial(p.id),
    ])
    setHistorialDias(hist)
    setCita(citaVigente(citas))
    setDerivado(p.estado === 'detectado')
    setMotivoOlbi(olbi.motivo ?? null)
    setSemana(serieSemana)
    setAgenda(agendaDeHoy(envios, cal, undefined, olbi.toca))
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

  if (!agenda || !trabajador) return <Cargando />

  const ahoraMismo = ahora()
  // RN-007-04 — quien fue detectado sale del seguimiento diario: sin
  // formularios, pero con su resultado y su sesión de apoyo.
  const enSeguimiento = trabajador.estado === 'activo'
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
          semana={semanaDelEstudio(trabajador.inscrito_en, ahoraMismo)}
          codigo={trabajador.codigo_anonimo}
          titulo={saludo.titulo}
          subtitulo={todoListo ? 'Gracias por tu tiempo de hoy.' : saludo.subtitulo}
          onAjustes={irAAjustes}
        />

        {historialDias.length > 1 && (
          <NavegadorDias
            offset={offsetDia}
            onCambiar={(n) => setOffsetDia(Math.max(-(historialDias.length - 1), Math.min(0, n)))}
            etiqueta={offsetDia === 0 ? 'Hoy' : offsetDia === -1 ? 'Ayer' : etiquetaDia(historialDias[-offsetDia]?.dia)}
          />
        )}

        {offsetDia < 0 && diaMirado && (
          <DiaPasado d={diaMirado} hoy={historialDias[0]?.dia ?? ''} />
        )}

        {offsetDia === 0 && !enSeguimiento && (
          <BloqueCierre
            mensaje="Tu seguimiento de check-ins terminó por ahora. El equipo del estudio te acompaña desde aquí: revisa tu resultado y, cuando esté disponible, tu sesión de apoyo."
            nota="Tus respuestas anteriores siguen protegidas y disociadas de tu empresa."
          />
        )}

        {hoyMismo && todoListo && enSeguimiento && (
          <BloqueCierre
            mensaje={cierre}
            nota="Responder cada día es lo que le da valor a este estudio. Si un día no puedes, no pasa nada: responde al siguiente."
          />
        )}

        {hoyMismo && enSeguimiento && <RitmoSemanal dias={dias} racha={rachaActual?.actual ?? 0} celebrar={celebrar} onPress={() => router.push('/registros')} />}

        {hoyMismo && principal && (
          <TarjetaHero
            insignia={principal.clave === 'olbi' && motivoOlbi ? POR_QUE[motivoOlbi] : undefined}
            titulo={encabezado(principal)}
            descripcion={principal.descripcion ?? PRESENTACION[principal.clave].descripcion}
            accion={PRESENTACION[principal.clave].accion}
            onPress={() => router.push(`/formulario/${principal.clave}`)}
          />
        )}

        {hoyMismo && secundarios.map((item) => (
          <TarjetaSecundaria
            key={item.clave}
            destacada={item.clave === 'olbi'}
            insignia={insigniaDe(item.clave, motivoOlbi)}
            titulo={encabezado(item)}
            descripcion={item.descripcion ?? PRESENTACION[item.clave].descripcion}
            accion={PRESENTACION[item.clave].accion}
            onPress={() => router.push(`/formulario/${item.clave}`)}
          />
        ))}

        {/* Lo ya respondido se queda donde estaba, apagado y con su marca.
            Mandarlo a una lista aparte justo después de enviarlo hacía dudar
            de si se había guardado. */}
        {hoyMismo && enSeguimiento && completados.map((item) => (
          <TarjetaSecundaria
            key={item.clave}
            completado
            insignia={insigniaDe(item.clave, motivoOlbi)}
            titulo={item.titulo}
            descripcion={item.descripcion ?? PRESENTACION[item.clave].descripcion}
            accion={PRESENTACION[item.clave].accion}
            // Volver a abrir lo que respondiste: el cierre se veía una vez y
            // desaparecía, y con él el consejo del día.
            onPress={() => setModal(item.clave === 'olbi' ? 'resultado' : 'cierre')}
          />
        ))}

        {/* Pedir la cita es una acción más del día, no algo escondido en
            otra pestaña: si al salir del resultado no la pide, aquí la tiene
            esperando. Y una vez pedida se queda, hecha, como los demás. */}
        {hoyMismo && derivado && !cita && (
          <TarjetaSecundaria
            destacada
            insignia="Tu sesión de apoyo"
            titulo="Elige cuándo hablar con el psicólogo"
            descripcion="Ya tiene tu caso. Solo falta que digas qué día y a qué hora te viene bien."
            accion="Elegir día y hora"
            onPress={() => router.push('/apoyo')}
          />
        )}
        {hoyMismo && cita && (
          <TarjetaSecundaria
            completado
            insignia="Tu sesión de apoyo"
            titulo={fechaHora(cita.propuesta_para)}
            pie={cita.estado === 'confirmada' ? 'Confirmada · toca para verla' : 'Pedida, falta que la confirmen'}
            descripcion=""
            accion=""
            onPress={() => router.push('/apoyo')}
          />
        )}

        {hoyMismo && sesion && <TarjetaApoyo onPress={() => router.push(`/consulta/${sesion.id}`)} />}

        {hoyMismo && prediccion && !finDeSemana && hoy < 4 && <TarjetaProbabilidad p={prediccion} />}

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

        <PieEtico codigo={trabajador.codigo_anonimo} onAjustes={irAAjustes} />
      </ScrollView>

      <ModalResultado modo={modal} resultado={resultado} consejo={consejo} prediccion={prediccion} motivoOlbi={motivoOlbi} semana={semana}
        onResponderOlbi={() => { setModal(null); router.push('/formulario/olbi') }}
        onPedirCita={() => { setModal(null); router.push('/apoyo') }} onCerrar={() => {
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

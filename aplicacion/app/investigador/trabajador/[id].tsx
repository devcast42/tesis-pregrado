/** Ficha del trabajador — implementa ESP-009 RF-009-08, RF-009-09.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Ficha del Trabajador».
 *
 *  La pantalla contesta, en este orden: qué le pasa a esta persona, qué se
 *  ha hecho, y con qué pruebas. Antes empezaba por la prueba —una matriz de
 *  seis semanas— y quien la abría tenía que armar solo la conclusión.
 *
 *  Por eso arriba va «En resumen»: cuánto ha respondido, cómo salió su
 *  último OLBI frente al umbral, qué dijo el modelo y en qué va el apoyo.
 *  Debajo, las seis secciones de siempre —las que pide RF-009-08— pero con
 *  nombres que se entienden sin haber leído la tesis: «qué días respondió»
 *  en vez de «matriz longitudinal», «qué dijo el modelo y si acertó» en vez
 *  de «inteligencia predictiva».
 *
 *  Solo código (RN-009-02); la identidad se abre con evento de auditoría. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../../modules/investigador/filtro'
import {
  calendario, cerrarSeguimiento, citasDelTrabajador, definiciones, ficha as cargarFicha, fechaCorta, fechaHoraPET, isoLocal, lineaTiempo, lunesDe,
  olbiSemanal, trabajadores as listar, predicciones, respuestasConItems, serieDiaria, verIdentidad,
  type CitaEstudio, type DefinicionItem, type DiaSerie, type Envio, type Ficha, type Hito, type OlbiSemana, type Prediccion, type RespuestaConItems,
} from '../../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../../modules/investigador/exportar'
import { DialogoReasignar, type PedidoReasignacion } from '../../../modules/investigador/DialogoReasignar'
import { BotonChico, Caja, Mono, Pastilla, PastillaEstado, Rotulo, TONO } from '../../../modules/investigador/piezas'
import { GraficaLinea } from '../../../modules/panel/Grafica'
import { Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import {
  IconoArchivo, IconoCandado, IconoCheckCirculo, IconoEquipo, IconoEscudoCheck, IconoVolver,
} from '../../../modules/nucleo/iconos'

const SEMANAS_ESTUDIO = 6
const TIERRA = '#8C4A2B'

/** Los títulos son los del índice lateral y los de cada sección: una sola
 *  lista, para que nadie los desincronice. */
const SECCIONES = [
  { id: 'calendario', titulo: 'Qué días respondió' },
  { id: 'serie', titulo: 'Cómo se sintió cada día' },
  { id: 'olbi', titulo: 'El OLBI, viernes a viernes' },
  { id: 'modelo', titulo: 'Qué dijo el modelo y si acertó' },
  { id: 'items', titulo: 'Respuesta por respuesta' },
  { id: 'linea', titulo: 'Todo lo que pasó, en orden' },
]

export default function FichaTrabajador() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { filtro } = useFiltro()
  const { width } = useWindowDimensions()
  const conRail = width >= 1100
  const scroll = useRef<ScrollView>(null)
  const posiciones = useRef<Record<string, number>>({})
  const [f, setF] = useState<Ficha | null>(null)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [serie, setSerie] = useState<DiaSerie[]>([])
  const [olbi, setOlbi] = useState<OlbiSemana[]>([])
  const [preds, setPreds] = useState<Prediccion[]>([])
  const [respuestas, setRespuestas] = useState<RespuestaConItems[]>([])
  const [defs, setDefs] = useState<Record<string, { version: number; titulo: string; items: DefinicionItem[] }[]>>({})
  const [hitos, setHitos] = useState<Hito[]>([])
  const [citas, setCitas] = useState<CitaEstudio[]>([])
  const [vecinos, setVecinos] = useState<{ anterior?: string; siguiente?: string; posicion: number; total: number }>({ posicion: 0, total: 0 })
  const [identidad, setIdentidad] = useState<{ nombre: string; correo_contacto: string } | null>(null)
  const [reasignacion, setReasignacion] = useState<PedidoReasignacion | null>(null)
  const [activa, setActiva] = useState('calendario')

  const cargar = useCallback(async () => {
    if (!id) return
    const [fi, ca, se, ol, pr, re, de, li, ci, lista] = await Promise.all([
      cargarFicha(id), calendario(id), serieDiaria(id), olbiSemanal(id), predicciones(id), respuestasConItems(id), definiciones(), lineaTiempo(id),
      citasDelTrabajador(id).catch(() => [] as CitaEstudio[]), listar(filtro).catch(() => []),
    ])
    setF(fi); setEnvios(ca); setSerie(se); setOlbi(ol); setPreds(pr); setRespuestas(re); setDefs(de); setHitos(li); setCitas(ci)
    const i = lista.findIndex((x) => x.id === id)
    setVecinos({ anterior: lista[i - 1]?.id, siguiente: lista[i + 1]?.id, posicion: i + 1, total: lista.length })
  }, [id, filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  const confirmar = (t: string, m: string, ok: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${t}\n\n${m}`)) ok(); return }
    Alert.alert(t, m, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', style: 'destructive', onPress: ok }])
  }

  if (!f) return <Panel rol="investigador"><Cargando /></Panel>

  const semanaReal = semanaDe(f.inscrito_en, new Date())
  const semanaActual = Math.min(semanaReal, SEMANAS_ESTUDIO)
  const detectadoEn = f.deteccion ? semanaDe(f.inscrito_en, f.deteccion.ocurrido_en) : null
  const cal = construirCalendario(f, envios)
  // `f.cita` llega siempre en nulo (ver `citasDelTrabajador`); estas salen
  // de `citas_estudio`, que es lo que el investigador sí puede leer.
  const citaPendiente = citas.find((c) => c.estado === 'solicitada' || c.estado === 'confirmada') ?? null
  const citaPasada = citas.find((c) => c.estado === 'atendida') ?? null
  // `f.derivacion` solo trae la abierta. Sin esto, a quien ya completó el
  // circuito se le decía «no hay derivación abierta. Se abriría sola si pasa
  // el umbral», que es justo lo que ya le pasó.
  const hitoDerivacion = hitos.find((h) => h.tipo === 'derivacion_psicologo')
  const hitoInforme = hitos.find((h) => h.tipo === 'informe_aprobado')
  const enMarcha = f.estado === 'activo' || f.estado === 'detectado'
  /** Se cruza el umbral cuando las dos dimensiones pasan el suyo, igual que
   *  en `evaluar-olbi` y en `olbi_semanal_etiquetado`. `queCruzo` conserva
   *  los casos de una sola dimensión para las detecciones antiguas. */
  const umbralAg = Number(olbi[0]?.umbral_agotamiento ?? f.deteccion?.umbrales?.agotamiento ?? 2.875)
  const umbralDes = Number(olbi[0]?.umbral_desvinculacion ?? f.deteccion?.umbrales?.desvinculacion ?? 2.75)

  /** La vista `adherencia` de ESP-007 solo mide a quien sigue activo, así que
   *  para un detectado o un finalizado llega en nulo. Antes eso se pintaba
   *  como «0 / 0 días» y un anillo al 0 %: decía que no había respondido
   *  nunca alguien con tres semanas de check-ins. Cuando falta, se cuenta
   *  aquí con los mismos envíos que dibujan el calendario, y se avisa. */
  const oficial = f.adherencia
  const cumplidos = oficial?.cumplidos ?? cal.cumplidos
  const esperados = oficial?.esperados ?? cal.esperados
  const pct = esperados > 0 ? Math.round((cumplidos / esperados) * 100) : null
  const sinResponder = oficial?.dias_sin_checkin ?? cal.diasSinResponder
  const irA = (sec: string) => { setActiva(sec); scroll.current?.scrollTo({ y: (posiciones.current[sec] ?? 0) - 8, animated: true }) }

  async function abrirIdentidad() {
    confirmar('Ver quién es', 'Queda registrado: este acceso aparecerá en la línea de tiempo de la persona y en la auditoría del estudio, con la hora y tu nombre. ¿Seguimos?', async () => {
      try {
        const id = await verIdentidad(f!.trabajador_id)
        // Sin fila en `identidades` no hay error: la consulta responde vacío.
        // Decirlo tal cual, que es distinto de «no se pudo».
        if (!id) return aviso('No hay nombre guardado', `${f!.codigo_anonimo} no tiene nombre ni correo en el sistema. El acceso quedó registrado igualmente.`)
        setIdentidad(id)
      } catch (e) {
        // Los errores de Supabase son objetos planos, no instancias de Error:
        // con `instanceof` se perdía el motivo y salía siempre el genérico.
        aviso('No disponible', mensajeDe(e) || 'No se pudo abrir la identidad.')
      }
      cargar()
    })
  }
  function exportarFicha() {
    // `ficha.cita` va en nulo por RLS; las de verdad son estas.
    const paquete = { ficha: f, citas, calendario: envios, serie_diaria: serie, olbi_semanal: olbi, predicciones: preds, respuestas, linea_tiempo: hitos, exportado_en: new Date().toISOString() }
    descargarTexto(`ficha-${f!.codigo_anonimo}.json`, JSON.stringify(paquete, null, 2))
    descargarTexto(`ficha-${f!.codigo_anonimo}-serie.csv`, aCsv(serie as any), 'text/csv')
  }
  function cerrar() {
    confirmar('Cerrar el seguimiento', `${f!.codigo_anonimo} pasará a «finalizado» y dejará de recibir check-ins. Sus respuestas se conservan, y si tiene una derivación abierta sigue su curso. Motivo: fin de estudio.`, async () => {
      try { await cerrarSeguimiento(f!.trabajador_id, 'fin_de_estudio'); cargar() } catch (e) { aviso('No se pudo cerrar', mensajeDe(e)) }
    })
  }

  return (
    <Panel rol="investigador">
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        {/* Volver y moverse por la lista: arriba del todo, fuera de la tarjeta. */}
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Pressable onPress={() => router.push(conFiltro('/investigador/trabajadores', filtro) as never)} style={[e.fila, { gap: 6 }]} accessibilityRole="link">
            <IconoVolver tamano={13} color={color.textoMedio} />
            <Text style={[texto.dato, { color: color.textoMedio }]}>Volver a trabajadores</Text>
          </Pressable>
          <View style={[e.fila, { gap: 6 }]}>
            <BotonChico onPress={() => vecinos.anterior && router.replace(conFiltro(`/investigador/trabajador/${vecinos.anterior}`, filtro) as never)}>‹ Anterior</BotonChico>
            <Text style={[texto.dato, { color: color.textoMedio }]}>{vecinos.posicion} de {vecinos.total}</Text>
            <BotonChico onPress={() => vecinos.siguiente && router.replace(conFiltro(`/investigador/trabajador/${vecinos.siguiente}`, filtro) as never)}>Siguiente ›</BotonChico>
          </View>
        </View>

        {/* Encabezado */}
        <View style={e.cabecera}>
          <Text style={[texto.titulo, { color: color.texto, fontSize: 26 }]}>
            {f.codigo_anonimo} · {f.empresa ?? '—'} · <Text style={{ color: color.primarioProfundo }}>Semana {semanaActual} de {SEMANAS_ESTUDIO}</Text>
            {semanaReal > SEMANAS_ESTUDIO ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>{`  · lleva ${semanaReal} semanas, más de las 6 previstas`}</Text> : null}
          </Text>
          <View style={[e.fila, { gap: 6 }]}>
            <PastillaEstado estado={f.estado} />
            {detectadoEn && <Pastilla tono={TONO.tierraSuave} punto>{`Pasó el umbral en la semana ${detectadoEn}`}</Pastilla>}
            {f.derivacion && <Pastilla tono={TONO.verdeSuave}>{f.derivacion.psicologo ? `Con ${f.derivacion.psicologo}` : 'Derivado, sin psicólogo'}</Pastilla>}
            {citaPendiente && <Pastilla tono={citaPendiente.estado === 'confirmada' ? TONO.verde : TONO.ambar} punto>{`Cita ${citaPendiente.estado === 'confirmada' ? 'confirmada' : 'pedida'} · ${fechaCorta(citaPendiente.propuesta_para)}`}</Pastilla>}
          </View>

          {/* Lo que pasó, en una frase, donde se lee primero. */}
          {f.deteccion && (
            <View style={e.suceso}>
              <Text style={[texto.apoyo, { color: color.texto }]}>
                El {new Date(f.deteccion.ocurrido_en).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} {queCruzo(f, umbralAg, umbralDes)}, y el sistema abrió la derivación al psicólogo. Es el motivo por el que esta ficha está marcada.
              </Text>
            </View>
          )}

          {identidad && (
            <View style={e.identidad}>
              <Rotulo tinta={TIERRA}>Identidad · el acceso quedó registrado</Rotulo>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{identidad.nombre}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>{identidad.correo_contacto}</Text>
            </View>
          )}

          {/* En resumen: las cuatro respuestas, antes de las pruebas. */}
          <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
            <Tarjeta titulo="Ha respondido" anillo={pct}>
              <Text style={[texto.seccion, { color: color.texto }]}>{cumplidos} de {esperados} <Text style={[texto.dato, { color: color.textoMedio }]}>días</Text></Text>
              <Text style={[texto.dato, { color: sinResponder != null && sinResponder >= 4 ? TIERRA : color.textoMedio }]}>
                {sinResponder == null ? 'sin check-ins todavía'
                  : sinResponder === 0 ? 'respondió hoy'
                  : `${sinResponder} ${sinResponder === 1 ? 'día' : 'días'} sin responder`}
              </Text>
              {!oficial && esperados > 0 && <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>contado aquí: el estudio solo la mide en activos</Text>}
            </Tarjeta>

            <Tarjeta titulo="Su último OLBI">
              {f.ultimo_olbi ? (
                <>
                  <View style={{ flexDirection: 'row' }}>
                    <Pastilla tono={f.ultimo_olbi.alto ? TONO.tierra : TONO.verde}>{f.ultimo_olbi.alto ? 'Pasó el umbral' : 'Por debajo del umbral'}</Pastilla>
                  </View>
                  <Nota nombre="Agotamiento" valor={Number(f.ultimo_olbi.agotamiento)} umbral={umbralAg} />
                  <Nota nombre="Desvinculación" valor={Number(f.ultimo_olbi.desvinculacion)} umbral={umbralDes} />
                  <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>{`semana ${semanaDe(f.inscrito_en, f.ultimo_olbi.semana)}`}</Text>
                </>
              ) : <Text style={[texto.apoyo, { color: color.textoSuave }]}>Todavía no ha contestado ningún OLBI del viernes.</Text>}
            </Tarjeta>

            <Tarjeta titulo="Qué dijo el modelo">
              {f.ultima_prediccion ? (
                <>
                  <Text style={[texto.seccion, { color: Number(f.ultima_prediccion.probabilidad) >= 0.5 ? TIERRA : color.texto }]}>
                    {Math.round(Number(f.ultima_prediccion.probabilidad) * 100)}% <Text style={[texto.dato, { color: color.textoMedio }]}>de riesgo</Text>
                  </Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    {Number(f.ultima_prediccion.probabilidad) >= 0.5 ? 'esperaba que pasara el umbral' : 'esperaba que se mantuviera abajo'}
                  </Text>
                  <Text style={[texto.dato, { color: f.ultima_prediccion.acierto === false ? TIERRA : f.ultima_prediccion.acierto ? color.primarioProfundo : color.textoSuave, fontSize: 11 }]}>
                    {f.ultima_prediccion.acierto == null ? 'aún sin comprobar' : f.ultima_prediccion.acierto ? 'y acertó' : 'y falló'}
                  </Text>
                </>
              ) : <Text style={[texto.apoyo, { color: color.textoSuave }]}>El modelo todavía no se ha pronunciado sobre esta persona.</Text>}
            </Tarjeta>

            <Tarjeta titulo="Cómo va el apoyo">
              {f.derivacion ? (
                <>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{f.derivacion.psicologo ?? 'Sin psicólogo asignado'}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    {citaPendiente ? `Cita ${citaPendiente.estado === 'confirmada' ? 'confirmada' : 'pedida'} para el ${fechaHoraPET(citaPendiente.propuesta_para)}`
                      : citaPasada ? `Ya tuvo su sesión el ${fechaCorta(citaPasada.propuesta_para)}`
                      : 'Sin cita pedida todavía'}
                  </Text>
                  <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>{`derivado el ${fechaCorta(f.derivacion.derivado_en)} · ${f.derivacion.origen === 'solicitud' ? 'lo pidió la persona' : 'lo abrió el sistema'}`}</Text>
                </>
              ) : hitoDerivacion ? (
                <>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Su derivación ya está cerrada</Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    {hitoInforme ? `El psicólogo cerró el informe el ${fechaCorta(hitoInforme.ocurrido_en)}.` : 'Pasó por el circuito de apoyo y se cerró.'}
                  </Text>
                  <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>{`empezó el ${fechaCorta(hitoDerivacion.ocurrido_en)}`}</Text>
                </>
              ) : <Text style={[texto.apoyo, { color: color.textoSuave }]}>No hay derivación abierta. Se abriría sola si pasa el umbral, o si la persona la pide.</Text>}
            </Tarjeta>
          </View>

          <View style={e.acciones}>
            <BotonChico onPress={exportarFicha} icono={<IconoArchivo tamano={13} color={color.texto} />}>Descargar la ficha</BotonChico>
            <BotonChico onPress={() => f.derivacion ? setReasignacion({ derivaciones: [f.derivacion.id], titulo: f.codigo_anonimo, actualId: f.derivacion.psicologo_id, actualNombre: f.derivacion.psicologo }) : aviso('Sin derivación abierta', 'No hay ninguna derivación que pasar a otro psicólogo.')} icono={<IconoEquipo tamano={13} color={color.texto} />}>Cambiar de psicólogo</BotonChico>
            {enMarcha && <BotonChico onPress={cerrar} icono={<IconoCheckCirculo tamano={13} color={color.texto} />}>Cerrar el seguimiento</BotonChico>}
            <View style={{ flex: 1 }} />
            <BotonChico onPress={abrirIdentidad} tono="suave" icono={<IconoCandado tamano={12} color={color.texto} />}>Ver quién es · queda registrado</BotonChico>
          </View>
        </View>

        <View style={[e.cuerpo, !conRail && { flexDirection: 'column' }]}>
          {conRail && (
            <View style={e.rail}>
              <Caja estilo={{ gap: 4, padding: 12 }}>
                <Rotulo>Ir a</Rotulo>
                {SECCIONES.map((s, i) => (
                  <Pressable key={s.id} onPress={() => irA(s.id)} style={[e.railItem, activa === s.id && e.railActivo]} accessibilityRole="button">
                    <Text style={[texto.dato, { color: activa === s.id ? color.primarioProfundo : color.texto, flex: 1 }]}>{`${i + 1}. ${s.titulo}`}</Text>
                    <Mono tono={color.textoSuave} tamano={10}>{s.id === 'calendario' ? `${semanaActual} sem` : s.id === 'serie' ? `${serie.length}` : s.id === 'olbi' ? `${olbi.length}` : s.id === 'modelo' ? `${preds.length}` : s.id === 'items' ? `${respuestas.length}` : `${hitos.length}`}</Mono>
                  </Pressable>
                ))}
              </Caja>
              <Caja suave estilo={{ gap: 6 }}>
                <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={14} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Aquí no hay nombres</Text></View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  Todo lo que se ve son respuestas que la persona escribió día a día desde su móvil, guardadas bajo su código. Su nombre está aparte y cifrado; abrirlo es una acción registrada.
                </Text>
              </Caja>
            </View>
          )}

          <View style={{ flex: 1, gap: espacio.lg, minWidth: 0 }}>
            <View onLayout={(ev) => { posiciones.current.calendario = ev.nativeEvent.layout.y + 340 }}>
              <Calendario cal={cal} detectada={detectadoEn} semanaActual={semanaActual} />
            </View>
            <View onLayout={(ev) => { posiciones.current.serie = ev.nativeEvent.layout.y + 340 }}>
              <SerieDiaria f={f} serie={serie} />
            </View>
            <View onLayout={(ev) => { posiciones.current.olbi = ev.nativeEvent.layout.y + 340 }}>
              <TrayectoriaOlbi f={f} olbi={olbi} detectadoEn={detectadoEn} umbralAg={umbralAg} umbralDes={umbralDes} />
            </View>
            <View onLayout={(ev) => { posiciones.current.modelo = ev.nativeEvent.layout.y + 340 }}>
              <Modelo f={f} preds={preds} />
            </View>
            <View onLayout={(ev) => { posiciones.current.items = ev.nativeEvent.layout.y + 340 }}>
              <Items respuestas={respuestas} defs={defs} />
            </View>
            <View onLayout={(ev) => { posiciones.current.linea = ev.nativeEvent.layout.y + 340 }}>
              <LineaTiempo hitos={hitos} f={f} citas={citas} citaPendiente={citaPendiente} />
            </View>
          </View>
        </View>
      </ScrollView>
      <DialogoReasignar pedido={reasignacion} onCerrar={() => setReasignacion(null)} onHecho={(nuevo) => { setReasignacion(null); cargar(); aviso('Listo', `${f?.codigo_anonimo ?? 'El caso'} ahora está a cargo de ${nuevo.nombre}. Lo verá en su lista al instante o al refrescarla.`) }} />
    </Panel>
  )
}

// -------------------------------------------------------------- Piezas base

/** Tarjeta del resumen: rótulo arriba, la cifra grande y su explicación. */
function Tarjeta({ titulo, anillo, children }: { titulo: string; anillo?: number | null; children: React.ReactNode }) {
  return (
    <View style={e.tarjeta}>
      <Rotulo>{titulo}</Rotulo>
      {/* Sin `flexWrap`: con él, el anillo se descolgaba a otra línea y la
          cifra quedaba flotando encima suyo. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm }}>
        {anillo !== undefined && <Anillo pct={anillo} />}
        <View style={{ flex: 1, gap: 2 }}>{children}</View>
      </View>
    </View>
  )
}

/** «Agotamiento 1.38 de 2.88», en tierra si lo pasó. */
function Nota({ nombre, valor, umbral }: { nombre: string; valor: number; umbral: number }) {
  const paso = valor >= umbral
  return (
    <Text style={[texto.dato, { color: paso ? TIERRA : color.texto }]}>
      {nombre} <Text style={[texto.datoFuerte, { color: paso ? TIERRA : color.texto }]}>{valor.toFixed(2)}</Text>
      <Text style={{ color: color.textoMedio }}>{` de ${umbral.toFixed(2)}`}</Text>
    </Text>
  )
}

/** Qué dimensión disparó la detección, dicho en una frase. Puede ser una,
 *  la otra o las dos: la regla es un OR. */
function queCruzo(f: Ficha, umbralAg: number, umbralDes: number): string {
  const ag = Number(f.deteccion?.puntajes?.agotamiento ?? NaN)
  const de = Number(f.deteccion?.puntajes?.desvinculacion ?? NaN)
  const cruzoAg = !Number.isNaN(ag) && ag >= umbralAg
  const cruzoDe = !Number.isNaN(de) && de >= umbralDes
  if (cruzoAg && cruzoDe) return `su agotamiento (${ag.toFixed(2)}) y su desvinculación (${de.toFixed(2)}) pasaron sus umbrales (${umbralAg.toFixed(2)} y ${umbralDes.toFixed(2)})`
  if (cruzoDe) return `su desvinculación llegó a ${de.toFixed(2)}, por encima del umbral de ${umbralDes.toFixed(2)}`
  if (cruzoAg) return `su agotamiento llegó a ${ag.toFixed(2)}, por encima del umbral de ${umbralAg.toFixed(2)}`
  return 'el OLBI de esa semana pasó el umbral del estudio'
}

function Anillo({ pct }: { pct: number | null }) {
  const lado = 46, r = 18, c = 2 * Math.PI * r
  const v = pct ?? 0
  const tinta = pct == null ? '#BDB8B1' : v < 60 ? TIERRA : '#005C55'
  if (Platform.OS !== 'web') return <View style={[e.anilloFallback, { borderColor: tinta }]}><Text style={[texto.datoFuerte, { color: tinta }]}>{pct == null ? '—' : `${v}%`}</Text></View>
  const { createElement } = require('react') as typeof import('react')
  return (
    <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }}>
      {createElement('svg', { viewBox: `0 0 ${lado} ${lado}`, width: lado, height: lado },
        createElement('circle', { cx: lado / 2, cy: lado / 2, r, fill: 'none', stroke: '#E4E1DC', strokeWidth: 5 }),
        createElement('circle', { cx: lado / 2, cy: lado / 2, r, fill: 'none', stroke: tinta, strokeWidth: 5, strokeDasharray: `${(c * v) / 100} ${c}`, strokeLinecap: 'round', transform: `rotate(-90 ${lado / 2} ${lado / 2})` }),
        createElement('text', { x: lado / 2, y: lado / 2 + 4, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: '#1C1917', fontFamily: 'Inter, system-ui' }, pct == null ? '—' : `${v}%`),
      )}
    </View>
  )
}

/** Semana del protocolo por semana calendario: la semana 1 es la del lunes en que se inscribió. */
function semanaDe(inscrito: string, fecha: string | Date) {
  const f = typeof fecha === 'string' && fecha.length === 10 ? fecha : isoLocal(new Date(fecha))
  const ins = isoLocal(new Date(inscrito))
  return Math.max(1, Math.round((lunesDe(f).getTime() - lunesDe(ins).getTime()) / (7 * 86_400_000)) + 1)
}

function Seccion({ numero, titulo, subtitulo, children, derecha }: { numero: number; titulo: string; subtitulo: string; children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <Caja estilo={{ gap: espacio.md, padding: espacio.lg }}>
      <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 2, minWidth: 260 }}>
          <View style={[e.fila, { gap: 8 }]}>
            <View style={e.numero}><Text style={[texto.datoFuerte, { color: color.primarioProfundo, fontSize: 11 }]}>{numero}</Text></View>
            <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>{subtitulo}</Text>
        </View>
        {derecha}
      </View>
      {children}
    </Caja>
  )
}

function Leyenda({ tinta, texto: t, hueco }: { tinta: string; texto: string; hueco?: boolean }) {
  return <View style={[e.fila, { gap: 4 }]}><View style={[e.puntoLeyenda, hueco ? { borderWidth: 1.5, borderColor: tinta } : { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio, fontSize: 11 }]}>{t}</Text></View>
}

// -------------------------------------------------------------- Calendario

type Celda = { estado: 'checkin' | 'olbi' | 'omitido' | 'finde' | 'futuro' | 'previo'; hora?: string }
type DatosCalendario = {
  semanas: Celda[][]
  desglose: { n: number; cumplidos: number; esperados: number; pendiente: boolean }[]
  cumplidos: number; esperados: number
  tardes: number; diarios: number
  diasSinResponder: number | null
}

/** El calendario y la adherencia salen del mismo sitio: los envíos. Antes la
 *  cabecera leía la vista `adherencia` y esta sección contaba por su cuenta,
 *  así que para un detectado la cabecera decía 0 % y la tabla de al lado,
 *  40 %. Ahora esta función es la única que cuenta. */
function construirCalendario(f: Ficha, envios: Envio[]): DatosCalendario {
  const lunes0 = lunesDe(isoLocal(new Date(f.inscrito_en)))
  const inscripcion = isoLocal(new Date(f.inscrito_en))
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const hoyIso = isoLocal(hoy)
  const porDia = new Map<string, Envio[]>()
  for (const en of envios) (porDia.get(en.dia) ?? porDia.set(en.dia, []).get(en.dia)!).push(en)

  const semanas: Celda[][] = []
  const desglose: DatosCalendario['desglose'] = []
  const nSemanas = Math.min(8, Math.max(SEMANAS_ESTUDIO, semanaDe(f.inscrito_en, new Date())))
  for (let s = 0; s < nSemanas; s++) {
    const fila: Celda[] = []
    let cumplidos = 0, esperados = 0
    for (let d = 0; d < 7; d++) {
      const dia = new Date(lunes0); dia.setDate(lunes0.getDate() + s * 7 + d)
      const iso = isoLocal(dia)
      if (d >= 5) { fila.push({ estado: 'finde' }); continue }
      if (dia > hoy) { fila.push({ estado: 'futuro' }); continue }
      if (iso < inscripcion) { fila.push({ estado: 'previo' }); continue }
      const es = porDia.get(iso) ?? []
      const hora = es[0] ? new Date(es[0].enviado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined
      const clave = d === 4 ? 'olbi' : 'diario'
      const ok = es.some((x) => x.formulario_clave === clave)
      // Hoy se ve pero no se cuenta: queda el día entero por delante, y así
      // esta cuenta da lo mismo que la vista `adherencia` de ESP-007, que
      // solo mira los días ya cerrados. Contándolo, la cabecera decía «9 de
      // 12» y el desglose de al lado «9 de 13».
      if (iso !== hoyIso) { esperados++; if (ok) cumplidos++ }
      fila.push({ estado: ok ? (d === 4 ? 'olbi' : 'checkin') : iso === hoyIso ? 'futuro' : 'omitido', hora: ok ? hora : undefined })
    }
    semanas.push(fila)
    const pendiente = fila.every((c) => c.estado === 'futuro' || c.estado === 'finde' || c.estado === 'previo')
    desglose.push({ n: s + 1, cumplidos, esperados, pendiente })
  }

  const ultimo = envios.length ? envios.map((x) => x.dia).sort().at(-1)! : null
  const diasSinResponder = ultimo == null ? null
    : Math.max(0, Math.round((hoy.getTime() - new Date(`${ultimo}T12:00:00`).getTime()) / 86_400_000))

  return {
    semanas, desglose,
    cumplidos: desglose.reduce((a, b) => a + b.cumplidos, 0),
    esperados: desglose.reduce((a, b) => a + b.esperados, 0),
    tardes: envios.filter((x) => x.formulario_clave === 'diario' && new Date(x.enviado_en).getHours() >= 20).length,
    diarios: envios.filter((x) => x.formulario_clave === 'diario').length,
    diasSinResponder,
  }
}

function Calendario({ cal, detectada, semanaActual }: { cal: DatosCalendario; detectada: number | null; semanaActual: number }) {
  const tardePct = cal.diarios ? Math.round((cal.tardes / cal.diarios) * 100) : 0
  return (
    <Seccion numero={1} titulo={SECCIONES[0].titulo}
      subtitulo={`De lunes a jueves toca un check-in corto; los viernes, el cuestionario OLBI. Cada cuadro es un día, y la hora es cuando lo envió.`}>
      <View style={[e.fila, { gap: espacio.base }]}>
        <Leyenda tinta="#A8DFCF" texto="Respondió el check-in" />
        <Leyenda tinta="#005C55" texto="Respondió el OLBI del viernes" />
        <Leyenda tinta={TIERRA} texto="No respondió" hueco />
        <Leyenda tinta="#E4E1DC" texto="Fin de semana" />
        <Leyenda tinta="#F1EFEB" texto="Aún no toca" />
      </View>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.lg }]}>
        <View style={{ flex: 1.6, minWidth: 320 }}>
          <View style={[e.calFila, { paddingLeft: 66 }]}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
              <Text key={`${d}-${i}`} style={[texto.dato, { color: d === 'Vie' ? color.primarioProfundo : color.textoMedio, flex: 1, textAlign: 'center', fontWeight: d === 'Vie' ? '600' : '400' }]}>{d}</Text>
            ))}
          </View>
          {cal.semanas.map((sem, i) => (
            <View key={i} style={e.calFila}>
              <View style={{ width: 66 }}>
                <Text style={[texto.datoFuerte, { color: detectada === i + 1 ? TIERRA : color.texto }]}>{`Semana ${i + 1}`}</Text>
              </View>
              {sem.map((c, j) => (
                <View key={j} style={[e.celda,
                  c.estado === 'checkin' && e.celdaCheckin, c.estado === 'olbi' && e.celdaOlbi, c.estado === 'omitido' && e.celdaOmitida,
                  (c.estado === 'finde' || c.estado === 'previo') && e.celdaFinde, c.estado === 'futuro' && e.celdaFuturo,
                ]}>
                  {(c.estado === 'checkin' || c.estado === 'olbi') && (
                    <Text style={{ color: c.estado === 'olbi' ? '#FFFFFF' : '#0F5B4C', fontSize: 9 }}>{c.hora}</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={[e.desglose, { flex: 1, minWidth: 210 }]}>
          <Rotulo>Semana a semana</Rotulo>
          {cal.desglose.map((d) => (
            <View key={d.n} style={[e.fila, { justifyContent: 'space-between' }]}>
              <Text style={[texto.dato, { color: detectada === d.n ? TIERRA : color.texto, flex: 1 }]} numberOfLines={1}>
                {`Semana ${d.n}`}
                {d.n === 1 ? ' · empezó aquí' : detectada === d.n ? ' · pasó el umbral' : d.n === semanaActual ? ' · en curso' : ''}
              </Text>
              {d.pendiente
                ? <Text style={[texto.dato, { color: color.textoSuave }]}>aún no toca</Text>
                : <Mono tono={color.texto}>{`${d.cumplidos} de ${d.esperados}`}</Mono>}
            </View>
          ))}
          <View style={e.separador} />
          <Text style={[texto.dato, { color: color.textoMedio }]}>
            {`En total respondió ${cal.cumplidos} de ${cal.esperados} días. `}
            {cal.diarios === 0 ? 'Todavía no hay check-ins para ver a qué hora responde.'
              : tardePct === 0 ? 'Siempre responde antes de las 20:00.'
              : `El ${tardePct}% de sus check-ins llegó pasadas las 20:00.`}
          </Text>
        </View>
      </View>
    </Seccion>
  )
}

// ------------------------------------------------------------ Serie diaria

function SerieDiaria({ f, serie }: { f: Ficha; serie: DiaSerie[] }) {
  const items: { clave: keyof DiaSerie; etiqueta: string; c: string }[] = [
    { clave: 'od_04', etiqueta: 'Agotamiento físico', c: TIERRA }, { clave: 'od_12', etiqueta: 'Carga mental', c: '#B0532F' },
    { clave: 'od_03', etiqueta: 'Desconexión al salir', c: '#005C55' }, { clave: 'od_06', etiqueta: 'Presión que siente', c: '#3F7F72' },
  ]
  const viernes = new Set(serie.filter((d) => new Date(`${d.dia}T12:00:00`).getDay() === 5).map((d) => d.dia))
  const sem = (dia: string) => `S${semanaDe(f.inscrito_en, dia)}`
  const promedio = (k: keyof DiaSerie) => { const v = serie.map((d) => d[k]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null }
  const trab = promedio('horas_trabajadas'), sueno = promedio('horas_sueno')

  return (
    <Seccion numero={2} titulo={SECCIONES[1].titulo}
      subtitulo="Cada día contesta cuatro frases cortas, de 1 («nada») a 5 («muchísimo»), y cuántas horas trabajó y durmió. Esto es lo que el modelo mira para adelantarse al viernes.">
      <View style={[e.fila, { gap: espacio.base }]}>{items.map((i) => <Leyenda key={i.clave} tinta={i.c} texto={i.etiqueta} />)}</View>
      <View style={e.panelGris}>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Rotulo>Las cuatro frases del día, de 1 a 5</Rotulo>
          <Text style={[texto.dato, { color: color.textoSuave }]}>La línea de puntos marca cada viernes</Text>
        </View>
        {serie.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no ha hecho ningún check-in diario.</Text> : (
          <GraficaLinea
            series={items.map((i) => ({ etiqueta: i.etiqueta, color: i.c, puntos: serie.map((d) => ({ x: d.dia, y: d[i.clave] == null ? null : Number(d[i.clave]) })) }))}
            yMin={1} yMax={5} alto={200} sinLeyenda todasLasEtiquetasX
            etiquetaX={(x, i) => (i === 0 || (i > 0 && sem(x) !== sem(serie[i - 1].dia))) ? sem(x) : ''}
            colorEtiquetaX={(x) => viernes.has(x) ? color.primarioProfundo : undefined}
          />
        )}
      </View>
      <View style={e.panelGris}>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Rotulo>Horas de trabajo y de sueño que declara</Rotulo>
          <View style={[e.fila, { gap: espacio.base }]}>
            <Leyenda tinta="#005C55" texto="Trabajo" /><Leyenda tinta="#BDB8B1" texto="Sueño" /><Leyenda tinta={TIERRA} texto="Fin de semana (lo dice el lunes)" />
          </View>
        </View>
        {serie.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin datos todavía.</Text> : (
          <>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              {`De media, ${trab?.toFixed(1) ?? '—'} h de trabajo y ${sueno?.toFixed(1) ?? '—'} h de sueño al día. Cada barra es un día; llenas, 12 horas.`}
            </Text>
            <View style={e.barras}>
              {serie.map((d, i) => (
                <View key={`${d.dia}-${i}`} style={e.barraCol}>
                  <Text style={[texto.dato, { color: TIERRA, fontSize: 9, height: 12 }]}>{d.horas_fin_de_semana != null && Number(d.horas_fin_de_semana) > 0 ? `+${Number(d.horas_fin_de_semana).toFixed(1)}` : ''}</Text>
                  <View style={[e.fila, { gap: 2, alignItems: 'flex-end', height: 70 }]}>
                    <View style={[e.barra, { height: Math.min(70, (Number(d.horas_trabajadas ?? 0) / 12) * 70), backgroundColor: '#005C55' }]} />
                    <View style={[e.barra, { height: Math.min(70, (Number(d.horas_sueno ?? 0) / 12) * 70), backgroundColor: '#BDB8B1' }]} />
                    {d.horas_fin_de_semana != null && Number(d.horas_fin_de_semana) > 0 && <View style={[e.barra, { height: Math.min(70, (Number(d.horas_fin_de_semana) / 12) * 70), backgroundColor: TIERRA }]} />}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </Seccion>
  )
}

// ---------------------------------------------------------- Trayectoria OLBI

function TrayectoriaOlbi({ f, olbi, detectadoEn, umbralAg, umbralDes }: { f: Ficha; olbi: OlbiSemana[]; detectadoEn: number | null; umbralAg: number; umbralDes: number }) {
  const semanaN = (s: OlbiSemana) => semanaDe(f.inscrito_en, s.enviado_en)
  // «Cerca» es estar a menos de 0.6 de cualquiera de los dos umbrales.
  const cerca = (ag: number, de: number) => ag >= umbralAg - 0.6 || de >= umbralDes - 0.6
  const comoQueda = (ag: number, de: number, alto: boolean) => alto ? 'Pasó el umbral' : cerca(ag, de) ? 'Cerca del umbral' : 'Bien'
  const tono = (ag: number, de: number, alto: boolean) => alto ? TONO.tierra : cerca(ag, de) ? TONO.ambar : TONO.verde

  return (
    <Seccion numero={3} titulo={SECCIONES[2].titulo}
      subtitulo={`Cada vez que contesta el OLBI salen dos notas, de 1 a 4. La derivación se abre cuando las dos pasan su umbral: ${umbralAg.toFixed(2)} en agotamiento y ${umbralDes.toFixed(2)} en desvinculación.`}>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.lg }]}>
        <View style={[e.panelGris, { flex: 1.3, minWidth: 320 }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Rotulo>Cómo han ido las dos notas</Rotulo>
              <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>{`Línea marrón: umbral de agotamiento (${umbralAg.toFixed(2)}). Línea gris: el de desvinculación (${umbralDes.toFixed(2)}).`}</Text>
            </View>
            <View style={[e.fila, { gap: espacio.base }]}><Leyenda tinta={TIERRA} texto="Agotamiento" /><Leyenda tinta="#005C55" texto="Desvinculación" /></View>
          </View>
          {olbi.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no ha contestado ningún OLBI del viernes.</Text> : (
            <GraficaLinea
              series={[
                { etiqueta: 'Agotamiento', color: TIERRA, puntos: olbi.map((s) => ({ x: s.semana, y: Number(s.agotamiento) })) },
                { etiqueta: 'Desvinculación', color: '#005C55', puntos: olbi.map((s) => ({ x: s.semana, y: Number(s.desvinculacion) })) },
              ]}
              yMin={1} yMax={4} alto={220} sinLeyenda todasLasEtiquetasX
              bandas={[
                { desde: Math.min(umbralAg, umbralDes), hasta: 4, color: '#FBEDE6', etiqueta: 'Pasa el umbral' },
                { desde: Math.min(umbralAg, umbralDes) - 0.6, hasta: Math.min(umbralAg, umbralDes), color: '#FBF3E6', etiqueta: 'Cerca' },
                { desde: 1, hasta: Math.min(umbralAg, umbralDes) - 0.6, color: '#E8F3EE', etiqueta: 'Bien' },
              ]}
              umbral={umbralAg} referencia={umbralDes} etiquetaX={(x) => `S${semanaN(olbi.find((o) => o.semana === x)!)}`}
              marcarX={detectadoEn && olbi.find((o) => semanaN(o) === detectadoEn) ? { x: olbi.find((o) => semanaN(o) === detectadoEn)!.semana, etiqueta: 'Aquí' } : undefined}
            />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 260, gap: espacio.sm }}>
          <Rotulo>Viernes a viernes</Rotulo>
          <View style={e.tablaCab}>
            {[['Semana', 1.1, color.textoMedio], ['Fecha', 1, color.textoMedio], ['Agotam.', 1, TIERRA], ['Desvinc.', 1, '#005C55'], ['Cómo queda', 1.3, color.textoMedio]].map(([h, fl, c]) => (
              <Text key={String(h)} style={[texto.etiqueta, { color: String(c), fontSize: 9.5, flex: Number(fl) }]}>{String(h)}</Text>
            ))}
          </View>
          {olbi.map((s) => {
            const n = semanaN(s); const esDet = detectadoEn === n
            const ag = Number(s.agotamiento), de = Number(s.desvinculacion)
            return (
              <View key={s.respuesta_id} style={[e.tablaFila, esDet && { backgroundColor: '#FBEDE6' }]}>
                <Text style={[texto.datoFuerte, { color: esDet ? TIERRA : color.texto, flex: 1.1 }]}>{`Semana ${n}`}</Text>
                <View style={{ flex: 1 }}><Mono tono={esDet ? TIERRA : color.textoMedio}>{fechaCorta(s.enviado_en)}</Mono></View>
                <View style={{ flex: 1 }}><Mono tono={ag >= umbralAg ? TIERRA : color.texto}>{ag.toFixed(2)}</Mono></View>
                <View style={{ flex: 1 }}><Mono tono={de >= umbralDes ? TIERRA : color.texto}>{de.toFixed(2)}</Mono></View>
                <View style={{ flex: 1.3 }}><Pastilla tono={tono(ag, de, s.alto)}>{comoQueda(ag, de, s.alto)}</Pastilla></View>
              </View>
            )
          })}
          {olbi.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin OLBI todavía.</Text>}
        </View>
      </View>
    </Seccion>
  )
}

// ------------------------------------------------------------------ Modelo

function Modelo({ f, preds }: { f: Ficha; preds: Prediccion[] }) {
  const nowcasts = preds.filter((p) => p.tarea === 'nowcast' && !p.tardio)
  const pronos = preds.filter((p) => p.tarea === 'pronostico')
  // Última predicción por semana (la que se confronta).
  const porSemana = (lista: Prediccion[]) => { const m = new Map<string, Prediccion>(); for (const p of lista) m.set(p.semana, p); return [...m.values()] }
  const nw = porSemana(nowcasts), pr = porSemana(pronos)
  const aciertos = (l: Prediccion[]) => ({ ok: l.filter((p) => p.acierto === true).length, n: l.filter((p) => p.acierto !== null).length })
  const aN = aciertos(nw), aP = aciertos(pr)
  const version = preds[preds.length - 1]?.version ?? '—'
  const semanaN = (iso: string) => semanaDe(f.inscrito_en, `${iso}T12:00:00`)

  const FilaPred = ({ p, pron }: { p: Prediccion; pron?: boolean }) => {
    const pct = Math.round(Number(p.probabilidad) * 100)
    const tinta = p.acierto === false ? TIERRA : p.acierto === true ? color.primarioProfundo : color.textoMedio
    return (
      <View style={[e.pred, p.senalado && { borderLeftWidth: 3, borderLeftColor: TIERRA }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>
            {pron ? `Al acabar la semana ${semanaN(p.semana)}, para la ${semanaN(p.semana_objetivo)}` : `Semana ${semanaN(p.semana)}, con ${p.n_dias ?? 0} ${p.n_dias === 1 ? 'día' : 'días'} de check-ins`}
          </Text>
          <Text style={[texto.dato, { color: color.textoMedio }]}>
            {p.senalado ? 'Dijo que pasaría el umbral' : 'Dijo que se mantendría por debajo'} · <Text style={{ color: p.senalado ? TIERRA : color.texto, fontWeight: '600' }}>{pct}%</Text> de riesgo
          </Text>
          <View style={e.pista}><View style={[e.lleno, { width: `${pct}%`, backgroundColor: p.senalado ? TIERRA : color.primarioProfundo }]} /></View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 124 }}>
          <Text style={[texto.datoFuerte, { color: tinta }]}>{p.acierto === null ? 'Sin comprobar' : p.acierto ? 'Acertó' : 'Falló'}</Text>
          <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11, textAlign: 'right' }]}>
            {p.resultado_real == null ? 'sin OLBI con que compararlo'
              : `de verdad salió ${p.resultado_real ? 'por encima' : 'por debajo'} (${Number(p.agotamiento_real).toFixed(2)})`}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <Seccion numero={4} titulo={SECCIONES[3].titulo}
      subtitulo="El modelo intenta adivinar, antes de que llegue el viernes, si el OLBI de esa semana va a pasar el umbral. Aquí está cada intento y lo que pasó de verdad."
      derecha={<View style={[e.fila, { gap: 6 }]}><Text style={[texto.dato, { color: color.textoMedio }]}>Versión</Text><Pastilla tono={TONO.gris} mono>{version}</Pastilla></View>}>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
        <View style={[e.panelGris, { flex: 1, minWidth: 280, gap: espacio.sm }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Durante la semana</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>De lunes a jueves, con los check-ins que lleva.</Text>
            </View>
            <Pastilla tono={aN.n === 0 ? TONO.gris : aN.ok === aN.n ? TONO.verde : TONO.ambar}>{aN.n === 0 ? 'sin comprobar' : `acertó ${aN.ok} de ${aN.n}`}</Pastilla>
          </View>
          {nw.length === 0 ? <Text style={[texto.dato, { color: color.textoMedio }]}>Sin intentos todavía: se generan cuando abre la app de lunes a jueves.</Text> : nw.map((p) => <FilaPred key={p.evento_id} p={p} />)}
        </View>
        <View style={[e.panelGris, { flex: 1, minWidth: 280, gap: espacio.sm }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Para la semana siguiente</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>El viernes, ya con el OLBI contestado.</Text>
            </View>
            <Pastilla tono={aP.n === 0 ? TONO.gris : aP.ok === aP.n ? TONO.verde : TONO.ambar}>{aP.n === 0 ? 'sin comprobar' : `acertó ${aP.ok} de ${aP.n}`}</Pastilla>
          </View>
          {pr.length === 0 ? <Text style={[texto.dato, { color: color.textoMedio }]}>Sin intentos todavía: se generan al responder el OLBI del viernes.</Text> : pr.map((p) => <FilaPred key={p.evento_id} p={p} pron />)}
        </View>
      </View>
    </Seccion>
  )
}

// ------------------------------------------------------------------- Ítems

function Items({ respuestas, defs }: { respuestas: RespuestaConItems[]; defs: Record<string, { version: number; titulo: string; items: DefinicionItem[] }[]> }) {
  // Por defecto, el último OLBI (el cuestionario completo); si no hay, la última respuesta.
  const porDefecto = () => (respuestas.find((r) => r.formulario_clave === 'olbi') ?? respuestas[0])?.id ?? null
  const [abierta, setAbierta] = useState<string | null>(porDefecto)
  useEffect(() => { if (!abierta && respuestas[0]) setAbierta(porDefecto()) }, [respuestas])
  const def = (r: RespuestaConItems) => defs[r.formulario_clave]?.find((d) => d.version === r.formulario_version)
  const NOMBRE: Record<string, string> = { olbi: 'OLBI del viernes', diario: 'Check-in del día', semanal: 'Sobre tu semana', estable: 'Datos del inicio' }
  const literal = (it: DefinicionItem | undefined, v: number | null, t: string | null) => {
    if (t != null) return it?.opciones?.find((o) => o.valor === t)?.etiqueta ?? t
    if (v == null) return '—'
    if (it?.tipo === 'booleano') return v ? 'Sí' : 'No'
    if (it?.escala && it.escala.max === 4) return ['', 'Totalmente en desacuerdo', 'En desacuerdo', 'De acuerdo', 'Totalmente de acuerdo'][v] ?? String(v)
    if (it?.escala && it.escala.max === 5) return ['', 'Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'][v] ?? String(v)
    return String(v)
  }
  return (
    <Seccion numero={5} titulo={SECCIONES[4].titulo}
      subtitulo="Lo que contestó, frase por frase. Elige arriba qué envío quieres mirar; por defecto, el último OLBI completo.">
      <View style={[e.fila, { gap: 6 }]}>
        {respuestas.slice(0, 12).map((r) => (
          <Pressable key={r.id} onPress={() => setAbierta(r.id)} style={[e.chipEval, abierta === r.id && e.chipEvalActivo]} accessibilityRole="button" accessibilityState={{ selected: abierta === r.id }}>
            <Text style={[texto.dato, { color: abierta === r.id ? '#FFFFFF' : color.texto }]}>{fechaCorta(r.enviado_en)} · {NOMBRE[r.formulario_clave] ?? r.formulario_clave}</Text>
          </Pressable>
        ))}
      </View>
      {respuestas.filter((r) => r.id === abierta).map((r) => {
        const d = def(r)
        return (
          <View key={r.id} style={e.tablaItems}>
            <View style={[e.tablaCab, { paddingHorizontal: 10 }]}>
              {[['', 0.3], ['La frase que leyó', 3], ['Qué mide', 1], ['Puntos', 0.8], ['Lo que marcó', 1.3]].map(([h, fl]) => (
                <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(fl) }]}>{String(h)}</Text>
              ))}
            </View>
            {(d?.items ?? []).filter((it) => r.items.some((x) => x.item_clave === it.clave)).map((it, i) => {
              const x = r.items.find((y) => y.item_clave === it.clave)!
              const puntaje = x.valor_num
              const alto = puntaje != null && it.escala && puntaje >= it.escala.max - 0.5 && !it.invertido
              return (
                <View key={it.clave} style={[e.tablaFila, { paddingHorizontal: 10 }]}>
                  <View style={{ flex: 0.3 }}><Mono tono={color.textoSuave}>{String(i + 1).padStart(2, '0')}</Mono></View>
                  <View style={{ flex: 3 }}>
                    <Text style={[texto.dato, { color: color.texto }]}>{it.texto}</Text>
                    {it.invertido && <Text style={[texto.dato, { color: color.textoSuave, fontSize: 10 }]}>Esta se puntúa al revés: estar de acuerdo resta.</Text>}
                  </View>
                  <Text style={[texto.dato, { color: it.dimension === 'agotamiento' ? TIERRA : it.dimension === 'desvinculacion' ? '#005C55' : color.textoMedio, flex: 1 }]}>
                    {it.dimension === 'agotamiento' ? 'Agotamiento' : it.dimension === 'desvinculacion' ? 'Desvinculación' : '—'}
                  </Text>
                  <View style={{ flex: 0.8 }}><View style={[e.puntaje, { backgroundColor: alto ? TIERRA : '#EDEBE7' }]}><Text style={[texto.datoFuerte, { color: alto ? '#FFFFFF' : color.texto, fontSize: 11 }]}>{puntaje ?? x.valor_texto ?? '—'}</Text></View></View>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1.3 }]}>{literal(it, puntaje, x.valor_texto)}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
      {respuestas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no ha enviado nada.</Text>}
    </Seccion>
  )
}

// ----------------------------------------------------------- Línea de tiempo

function LineaTiempo({ hitos, f, citas, citaPendiente }: { hitos: Hito[]; f: Ficha; citas: CitaEstudio[]; citaPendiente: CitaEstudio | null }) {
  const TIPO: Record<string, { titulo: (h: Hito) => string; etiqueta: string; tono: { fondo: string; tinta: string }; detalle: (h: Hito) => string }> = {
    consentimiento: { titulo: (h) => h.metadata.aceptado ? 'Aceptó participar y firmó el consentimiento' : 'No aceptó participar', etiqueta: 'Consentimiento', tono: TONO.gris, detalle: (h) => `Versión del texto que leyó: ${h.metadata.version_texto ?? '—'}.` },
    inicio_seguimiento: { titulo: () => `Empezó el seguimiento en ${f.empresa ?? 'su empresa'}`, etiqueta: 'Inicio', tono: TONO.gris, detalle: () => 'Desde aquí le toca el check-in de lunes a jueves y el OLBI los viernes.' },
    deteccion: { titulo: () => 'Su agotamiento pasó el umbral', etiqueta: 'Detección', tono: TONO.tierra, detalle: (h) => `${Object.entries(h.metadata.puntajes ?? {}).map(([k, v]) => `${k === 'desvinculacion' ? 'desvinculación' : k} ${Number(v).toFixed(2)}`).join(' · ')}. El sistema abrió la derivación y avisó al psicólogo.` },
    derivacion_psicologo: { titulo: (h) => h.metadata.origen === 'solicitud' ? 'Pidió hablar con un psicólogo' : 'Se le asignó un psicólogo', etiqueta: 'Derivación', tono: TONO.gris, detalle: () => 'Va al profesional con menos casos abiertos. Solo con esta derivación puede él ver quién es.' },
    cita_solicitada: {
      titulo: () => 'Pidió una cita', etiqueta: 'Cita', tono: TONO.verdeSuave,
      // El evento solo guarda el `cita_id`; la hora propuesta vive en la cita,
      // así que antes esta línea acababa en «Propuso el —.».
      detalle: (h) => {
        const cuando = h.metadata.propuesta_para ?? citas.find((c) => c.id === h.metadata.cita_id)?.propuesta_para
        return cuando ? `Propuso el ${fechaHoraPET(cuando)}.` : 'A la espera de que el psicólogo la confirme.'
      },
    },
    cita_confirmada: { titulo: () => 'El psicólogo confirmó la cita', etiqueta: 'Cita', tono: TONO.verde, detalle: () => 'La videollamada se abre a esa hora desde la app.' },
    cita_cancelada: { titulo: (h) => `Se canceló la cita (${h.metadata.por ?? '—'})`, etiqueta: 'Cita', tono: TONO.gris, detalle: () => 'Puede pedir otra cuando quiera.' },
    sesion_iniciada: { titulo: () => 'Se abrió la sala de la videollamada', etiqueta: 'Sesión', tono: TONO.verdeSuave, detalle: () => 'Solo queda el hecho: de qué hablaron no se guarda nada aquí.' },
    sesion_finalizada: { titulo: (h) => `Tuvieron la sesión (${h.metadata.minutos ?? '—'} min)`, etiqueta: 'Sesión', tono: TONO.verde, detalle: () => 'Queda la duración y nada más (RN-009-03).' },
    sesion_realizada: { titulo: () => 'Tuvieron la sesión', etiqueta: 'Sesión', tono: TONO.verde, detalle: () => 'Solo el hecho.' },
    informe_aprobado: { titulo: () => 'El psicólogo cerró su informe', etiqueta: 'Cierre', tono: TONO.verde, detalle: () => 'Lo que dice queda entre la persona y su psicólogo.' },
    acceso_identidad: { titulo: (h) => `${h.metadata.por === 'investigador' ? 'El investigador' : 'El psicólogo'} miró quién es`, etiqueta: 'Acceso', tono: TONO.ambar, detalle: () => 'Queda anotado aquí y en la auditoría del estudio.' },
    salida_seguimiento: { titulo: (h) => `Salió del seguimiento (${h.metadata.motivo ?? '—'})`, etiqueta: 'Cierre', tono: TONO.gris, detalle: (h) => `Lo registró ${h.metadata.por ?? 'el sistema'}. Sus respuestas se conservan sin nombre.` },
    alerta_adherencia: { titulo: () => 'Llevaba demasiados días sin responder', etiqueta: 'Adherencia', tono: TONO.ambar, detalle: () => 'Salta cuando pasa del corte de días hábiles sin ningún registro.' },
    reasignacion_psicologo: { titulo: () => 'Pasó a otro psicólogo', etiqueta: 'Cambio', tono: TONO.gris, detalle: () => 'Lo decidió el investigador; las citas vigentes van con él.' },
  }
  const enCurso = citaPendiente?.estado === 'confirmada'
  return (
    <Seccion numero={6} titulo={SECCIONES[5].titulo}
      subtitulo="Desde que aceptó participar hasta hoy, incluidas las veces que alguien miró su nombre."
      derecha={<Pastilla tono={TONO.gris}>{`${hitos.length} ${hitos.length === 1 ? 'hecho registrado' : 'hechos registrados'}`}</Pastilla>}>
      <View style={{ gap: 4 }}>
        {hitos.map((h, i) => {
          const t = TIPO[h.tipo] ?? { titulo: () => h.tipo, etiqueta: h.tipo, tono: TONO.gris, detalle: () => '' }
          const destacado = h.tipo === 'deteccion'
          return (
            <View key={`${h.tipo}-${h.ocurrido_en}-${i}`} style={[e.hito, destacado && { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10, marginLeft: -10 }]}>
              <View style={e.hitoCol}>
                <View style={[e.hitoPunto, { backgroundColor: destacado ? TIERRA : h.tipo.startsWith('cita') || h.tipo.startsWith('sesion') || h.tipo === 'informe_aprobado' ? color.primarioProfundo : '#BDB8B1' }]} />
                {i < hitos.length - 1 && <View style={e.hitoLinea} />}
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: 12 }}>
                <View style={[e.fila, { gap: 8 }]}><Mono tono={destacado ? TIERRA : color.textoMedio}>{fechaHoraPET(h.ocurrido_en)}</Mono><Pastilla tono={t.tono}>{t.etiqueta}</Pastilla></View>
                <Text style={[texto.datoFuerte, { color: color.texto }]}>{t.titulo(h)}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{t.detalle(h)}</Text>
              </View>
            </View>
          )
        })}
        {enCurso && citaPendiente && (
          <View style={[e.hito, { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10, marginLeft: -10 }]}>
            <View style={e.hitoCol}><View style={[e.hitoPunto, { backgroundColor: color.primarioProfundo }]} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={[e.fila, { gap: 8 }]}><Mono tono={color.primarioProfundo}>Lo que viene</Mono><Pastilla tono={TONO.verde}>Cita</Pastilla></View>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>{`Tiene sesión el ${fechaHoraPET(citaPendiente.propuesta_para)}`}</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>El psicólogo abre la sala a esa hora; cuando terminen, aparecerá aquí.</Text>
            </View>
          </View>
        )}
        {hitos.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay nada registrado.</Text>}
      </View>
    </Seccion>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cabecera: { backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.lg, gap: espacio.md, borderWidth: 1, borderColor: '#EEECE8' },
  suceso: { backgroundColor: '#FBEDE6', borderRadius: radio.md, padding: espacio.md, borderLeftWidth: 3, borderLeftColor: TIERRA },
  tarjeta: { flex: 1, minWidth: 185, gap: 6, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md },
  anilloFallback: { width: 46, height: 46, borderRadius: 23, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  identidad: { backgroundColor: '#FBEDE6', borderRadius: radio.md, padding: espacio.md, gap: 2, alignSelf: 'flex-start' },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  numero: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  cuerpo: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.lg },
  rail: { width: 220, gap: espacio.md },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6 },
  railActivo: { backgroundColor: '#EAF4EF' },
  panelGris: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, gap: espacio.sm },
  calFila: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  celda: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEB' },
  celdaCheckin: { backgroundColor: '#A8DFCF' },
  celdaOlbi: { backgroundColor: '#005C55' },
  celdaOmitida: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: TIERRA },
  celdaFinde: { backgroundColor: '#E4E1DC' },
  celdaFuturo: { backgroundColor: '#F1EFEB' },
  desglose: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, gap: 6 },
  separador: { height: 1, backgroundColor: '#E4E1DC', marginVertical: 2 },
  puntoLeyenda: { width: 9, height: 9, borderRadius: 3 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' },
  barraCol: { alignItems: 'center', gap: 2 },
  barra: { width: 5, borderRadius: 2 },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.borde },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: 4 },
  pred: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#EEECE8' },
  pista: { height: 4, borderRadius: 2, backgroundColor: '#EDEBE7', overflow: 'hidden', marginTop: 2 },
  lleno: { height: 4, borderRadius: 2 },
  chipEval: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F1EFEB' },
  chipEvalActivo: { backgroundColor: color.primarioProfundo },
  tablaItems: { borderWidth: 1, borderColor: '#EEECE8', borderRadius: 8, overflow: 'hidden' },
  puntaje: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hito: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start' },
  hitoCol: { width: 14, alignItems: 'center', alignSelf: 'stretch' },
  hitoPunto: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  hitoLinea: { flex: 1, width: 2, backgroundColor: '#E4E1DC', marginTop: 2 },
})

/** El motivo de un fallo, venga como Error o como el objeto plano que
 *  devuelve Supabase. Con `e instanceof Error` a secas se perdía siempre. */
function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message ?? '')
  return ''
}

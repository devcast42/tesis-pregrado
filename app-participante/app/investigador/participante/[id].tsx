/** Ficha del participante — implementa ESP-009 RF-009-08, RF-009-09.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Ficha del Participante · P-042».
 *
 *  Una sola narrativa vertical: lo que la persona hizo (calendario), lo que
 *  respondió (serie diaria, OLBI), lo que el modelo dijo (predicciones
 *  confrontadas), lo que declaró ítem a ítem y lo que pasó después (línea de
 *  tiempo). Encabezado con acciones registradas. Solo código (RN-009-02);
 *  la identidad se abre con evento de auditoría. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../../modules/investigador/filtro'
import {
  calendario, cerrarSeguimiento, definiciones, ficha as cargarFicha, fechaCorta, fechaHoraPET, isoLocal, lineaTiempo, lunesDe,
  olbiSemanal, participantes as listar, predicciones, reasignarDerivacion, respuestasConItems, serieDiaria, verIdentidad,
  type DefinicionItem, type DiaSerie, type Envio, type Ficha, type Hito, type OlbiSemana, type Prediccion, type RespuestaConItems,
} from '../../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../../modules/investigador/exportar'
import { DialogoReasignar, type PedidoReasignacion } from '../../../modules/investigador/DialogoReasignar'
import { BotonChico, Caja, Codigo, Mono, Pastilla, PastillaEstado, Rotulo, TONO } from '../../../modules/investigador/piezas'
import { GraficaLinea } from '../../../modules/panel/Grafica'
import { Cargando, Pantalla } from '../../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import {
  IconoArchivo, IconoCandado, IconoCheckCirculo, IconoChevronAbajo, IconoEquipo, IconoEscudoCheck, IconoGrafica, IconoNota, IconoReloj,
} from '../../../modules/nucleo/iconos'

const SECCIONES = [
  { id: 'calendario', titulo: '1. Calendario de Respuestas' },
  { id: 'serie', titulo: '2. Serie Diaria Microdatos' },
  { id: 'olbi', titulo: '3. Trayectoria OLBI y Punto S4' },
  { id: 'modelo', titulo: '4. Predicciones Nowcast & Pronóstico' },
  { id: 'items', titulo: '5. Respuestas Ítem a Ítem' },
  { id: 'linea', titulo: '6. Línea de Tiempo Ética' },
]

export default function FichaParticipante() {
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
  const [vecinos, setVecinos] = useState<{ anterior?: string; siguiente?: string; posicion: number; total: number }>({ posicion: 0, total: 0 })
  const [identidad, setIdentidad] = useState<{ nombre: string; correo_contacto: string } | null>(null)
  const [reasignacion, setReasignacion] = useState<PedidoReasignacion | null>(null)
  const [activa, setActiva] = useState('calendario')

  const cargar = useCallback(async () => {
    if (!id) return
    const [fi, ca, se, ol, pr, re, de, li, lista] = await Promise.all([
      cargarFicha(id), calendario(id), serieDiaria(id), olbiSemanal(id), predicciones(id), respuestasConItems(id), definiciones(), lineaTiempo(id),
      listar(filtro).catch(() => []),
    ])
    setF(fi); setEnvios(ca); setSerie(se); setOlbi(ol); setPreds(pr); setRespuestas(re); setDefs(de); setHitos(li)
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
  const semanaActual = Math.min(semanaReal, 6)
  const detectadoEn = f.deteccion ? semanaDe(f.inscrito_en, f.deteccion.ocurrido_en) : null
  const adh = f.adherencia
  const pct = adh?.tasa != null ? Math.round(Number(adh.tasa) * (Number(adh.tasa) <= 1 ? 100 : 1)) : null
  const omisiones = adh ? Math.max(0, adh.esperados - adh.cumplidos) : null
  const irA = (sec: string) => { setActiva(sec); scroll.current?.scrollTo({ y: (posiciones.current[sec] ?? 0) - 8, animated: true }) }

  async function abrirIdentidad() {
    confirmar('Ver identidad · Auditado', 'Este acceso queda registrado en la línea de tiempo del participante y en la auditoría del estudio. ¿Continuar?', async () => {
      try { setIdentidad(await verIdentidad(f!.participante_id)); cargar() } catch (e) { aviso('No disponible', e instanceof Error ? e.message : 'No se pudo abrir la identidad.') }
    })
  }
  function exportarFicha() {
    const paquete = { ficha: f, calendario: envios, serie_diaria: serie, olbi_semanal: olbi, predicciones: preds, respuestas, linea_tiempo: hitos, exportado_en: new Date().toISOString() }
    descargarTexto(`ficha-${f!.codigo_anonimo}.json`, JSON.stringify(paquete, null, 2))
    descargarTexto(`ficha-${f!.codigo_anonimo}-serie.csv`, aCsv(serie as any), 'text/csv')
  }
  function cerrar() {
    confirmar('Cerrar seguimiento', `${f!.codigo_anonimo} pasará a «finalizado». Sus respuestas se conservan y una derivación abierta sigue su curso. Motivo: fin de estudio.`, async () => {
      try { await cerrarSeguimiento(f!.participante_id, 'fin_de_estudio'); cargar() } catch (e) { aviso('No se pudo cerrar', e instanceof Error ? e.message : '') }
    })
  }

  const insignias = (
    <View style={[e.fila, { gap: 6 }]}>
      <PastillaEstado estado={f.estado} />
      {detectadoEn && <Pastilla tono={TONO.tierraSuave} punto>{`Umbral superado en S${detectadoEn}`}</Pastilla>}
      {f.derivacion && <Pastilla tono={TONO.gris} icono={<IconoEquipo tamano={11} color={color.textoMedio} />}>Derivado</Pastilla>}
      {f.cita && <Pastilla tono={TONO.gris} icono={<IconoReloj tamano={11} color={color.textoMedio} />}>{`Cita ${f.cita.estado === 'confirmada' ? 'confirmada' : 'pedida'} (${new Date(f.cita.propuesta_para).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })})`}</Pastilla>}
    </View>
  )

  return (
    <Panel rol="investigador">
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        {/* Encabezado */}
        <View style={e.cabecera}>
          <View style={[e.fila, { gap: 10 }]}>
            <Pastilla tono={TONO.verde} mono>{`PROTOCOLO ESP-009`}</Pastilla>
            <Text style={[texto.dato, { color: color.textoMedio }]}>ID Muestra: <Mono tono={color.texto}>{f.codigo_anonimo}</Mono></Text>
          </View>
          <Text style={[texto.titulo, { color: color.texto, fontSize: 26 }]}>
            {f.codigo_anonimo} · {f.empresa ?? '—'} · <Text style={{ color: color.primarioProfundo }}>Semana {semanaActual} de 6</Text>{semanaReal > 6 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>  · seguimiento extendido (S{semanaReal})</Text> : null}
          </Text>
          {insignias}
          <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
            <View style={e.adherencia}>
              <Anillo pct={pct ?? 0} />
              <View>
                <Rotulo>Adherencia global</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>{adh?.cumplidos ?? 0} / {adh?.esperados ?? 0} días</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{omisiones ?? 0} omisiones consentidas</Text>
              </View>
            </View>
            {identidad && (
              <View style={e.identidad}>
                <Rotulo tinta="#8C4A2B">Identidad · acceso registrado</Rotulo>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{identidad.nombre}</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>{identidad.correo_contacto}</Text>
              </View>
            )}
          </View>
          <View style={e.acciones}>
            <View style={[e.fila, { gap: 6, flexShrink: 1 }]}>
              <BotonChico onPress={() => vecinos.anterior && router.replace(conFiltro(`/investigador/participante/${vecinos.anterior}`, filtro) as never)}>‹ Anterior</BotonChico>
              <Text style={[texto.dato, { color: color.textoMedio }]}>{vecinos.posicion} de {vecinos.total} participantes</Text>
              <BotonChico onPress={() => vecinos.siguiente && router.replace(conFiltro(`/investigador/participante/${vecinos.siguiente}`, filtro) as never)}>Siguiente ›</BotonChico>
            </View>
            <View style={[e.fila, { gap: 6, flexShrink: 1 }]}>
              <BotonChico onPress={exportarFicha} icono={<IconoArchivo tamano={13} color={color.texto} />}>Exportar ficha (JSON/CSV)</BotonChico>
              <BotonChico onPress={() => f.derivacion ? setReasignacion({ derivaciones: [f.derivacion.id], titulo: f.codigo_anonimo, actualId: f.derivacion.psicologo_id, actualNombre: f.derivacion.psicologo }) : aviso('Sin derivación', 'Este participante no tiene una derivación abierta que reasignar.')} icono={<IconoEquipo tamano={13} color={color.texto} />}>Reasignar psicólogo</BotonChico>
              <BotonChico onPress={cerrar} icono={<IconoCheckCirculo tamano={13} color={color.texto} />}>Cerrar seguimiento</BotonChico>
              <BotonChico onPress={abrirIdentidad} tono="suave" icono={<IconoCandado tamano={12} color={color.texto} />}>Ver identidad · Auditado</BotonChico>
            </View>
          </View>
        </View>

        <View style={[e.cuerpo, !conRail && { flexDirection: 'column' }]}>
          {/* Navegación por secciones */}
          {conRail && (
            <View style={e.rail}>
              <Caja estilo={{ gap: 4, padding: 12 }}>
                <Rotulo>Estructura del caso</Rotulo>
                {SECCIONES.map((s) => (
                  <Pressable key={s.id} onPress={() => irA(s.id)} style={[e.railItem, activa === s.id && e.railActivo]}>
                    <Text style={[texto.dato, { color: activa === s.id ? color.primarioProfundo : color.texto, flex: 1 }]}>{s.titulo}</Text>
                    <Mono tono={color.textoSuave} tamano={10}>{s.id === 'calendario' ? `S1-S${semanaActual}` : s.id === 'serie' ? `${serie.length} días` : s.id === 'olbi' ? `${olbi.length} OLBI` : s.id === 'modelo' ? `${preds.length}` : s.id === 'items' ? `${respuestas.length}` : `${hitos.length}`}</Mono>
                  </Pressable>
                ))}
              </Caja>
              <Caja suave estilo={{ gap: 6 }}>
                <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={14} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Tratamiento pseudonimizado</Text></View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>La información expuesta corresponde a registros ecológicos momentáneos (EMA) con fines de investigación académica. La identidad real se mantiene cifrada en la base de datos del estudio.</Text>
              </Caja>
            </View>
          )}

          <View style={{ flex: 1, gap: espacio.lg, minWidth: 0 }}>
            <View onLayout={(ev) => { posiciones.current.calendario = ev.nativeEvent.layout.y + 340 }}>
              <Calendario f={f} envios={envios} />
            </View>
            <View onLayout={(ev) => { posiciones.current.serie = ev.nativeEvent.layout.y + 340 }}>
              <SerieDiaria f={f} serie={serie} />
            </View>
            <View onLayout={(ev) => { posiciones.current.olbi = ev.nativeEvent.layout.y + 340 }}>
              <TrayectoriaOlbi f={f} olbi={olbi} detectadoEn={detectadoEn} />
            </View>
            <View onLayout={(ev) => { posiciones.current.modelo = ev.nativeEvent.layout.y + 340 }}>
              <Modelo f={f} preds={preds} />
            </View>
            <View onLayout={(ev) => { posiciones.current.items = ev.nativeEvent.layout.y + 340 }}>
              <Items respuestas={respuestas} defs={defs} />
            </View>
            <View onLayout={(ev) => { posiciones.current.linea = ev.nativeEvent.layout.y + 340 }}>
              <LineaTiempo hitos={hitos} f={f} />
            </View>
          </View>
        </View>
      </ScrollView>
      <DialogoReasignar pedido={reasignacion} onCerrar={() => setReasignacion(null)} onHecho={() => { setReasignacion(null); cargar() }} />
    </Panel>
  )
}

// ------------------------------------------------------------- Encabezado

function Anillo({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r
  if (Platform.OS !== 'web') return <View style={e.anilloFallback}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{pct}%</Text></View>
  const { createElement } = require('react') as typeof import('react')
  return (
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      {createElement('svg', { viewBox: '0 0 56 56', width: 56, height: 56 },
        createElement('circle', { cx: 28, cy: 28, r, fill: 'none', stroke: '#E4E1DC', strokeWidth: 6 }),
        createElement('circle', { cx: 28, cy: 28, r, fill: 'none', stroke: '#005C55', strokeWidth: 6, strokeDasharray: `${(c * pct) / 100} ${c}`, strokeLinecap: 'round', transform: 'rotate(-90 28 28)' }),
        createElement('text', { x: 28, y: 32, textAnchor: 'middle', fontSize: 12, fontWeight: 700, fill: '#1C1917', fontFamily: 'Inter, system-ui' }, `${pct}%`),
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

function Seccion({ eyebrow, titulo, subtitulo, children, derecha }: { eyebrow: string; titulo: string; subtitulo: string; children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <Caja estilo={{ gap: espacio.md, padding: espacio.lg }}>
      <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 2, minWidth: 260 }}>
          <Rotulo>{eyebrow}</Rotulo>
          <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>{subtitulo}</Text>
        </View>
        {derecha}
      </View>
      {children}
    </Caja>
  )
}

// -------------------------------------------------------------- Calendario

type Celda = { estado: 'checkin' | 'olbi' | 'omitido' | 'finde' | 'futuro' | 'previo'; hora?: string; alerta?: boolean }

function Calendario({ f, envios }: { f: Ficha; envios: Envio[] }) {
  const lunes0 = lunesDe(isoLocal(new Date(f.inscrito_en)))
  const inscripcion = isoLocal(new Date(f.inscrito_en))
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const porDia = new Map<string, Envio[]>()
  for (const en of envios) (porDia.get(en.dia) ?? porDia.set(en.dia, []).get(en.dia)!).push(en)
  const semanas: Celda[][] = []
  const desglose: { n: number; cumplidos: number; esperados: number; etiqueta: string }[] = []
  const nSemanas = Math.min(8, Math.max(6, semanaDe(f.inscrito_en, new Date())))
  for (let s = 0; s < nSemanas; s++) {
    const fila: Celda[] = []
    let cumplidos = 0, esperados = 0
    for (let d = 0; d < 7; d++) {
      const dia = new Date(lunes0); dia.setDate(lunes0.getDate() + s * 7 + d)
      const iso = isoLocal(dia)
      if (d >= 5) { fila.push({ estado: 'finde' }); continue }
      if (dia > hoy) { fila.push({ estado: 'futuro' }); continue }
      if (iso < inscripcion) { fila.push({ estado: 'previo' }); continue }
      esperados++
      const es = porDia.get(iso) ?? []
      const hora = es[0] ? new Date(es[0].enviado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : undefined
      if (d === 4) { const ok = es.some((x) => x.formulario_clave === 'olbi'); if (ok) cumplidos++; fila.push({ estado: ok ? 'olbi' : 'omitido', hora, alerta: !ok }) }
      else { const ok = es.some((x) => x.formulario_clave === 'diario'); if (ok) cumplidos++; fila.push({ estado: ok ? 'checkin' : 'omitido', hora }) }
    }
    semanas.push(fila)
    const fut = fila.every((c) => c.estado === 'futuro' || c.estado === 'finde' || c.estado === 'previo')
    desglose.push({ n: s + 1, cumplidos, esperados, etiqueta: fut ? 'Pendiente' : `${Math.round((cumplidos / Math.max(1, esperados)) * 100)}%` })
  }
  const detectada = f.deteccion ? semanaDe(f.inscrito_en, f.deteccion.ocurrido_en) : null
  const total = desglose.reduce((a, b) => a + b.cumplidos, 0), esperadoTotal = desglose.reduce((a, b) => a + b.esperados, 0)
  const tardes = envios.filter((x) => x.formulario_clave === 'diario' && new Date(x.enviado_en).getHours() >= 20).length
  const diarios = envios.filter((x) => x.formulario_clave === 'diario').length

  return (
    <Seccion eyebrow="Matriz longitudinal" titulo="Calendario de Respuestas del Protocolo" subtitulo="Seguimiento de 6 semanas (Check-in diario Lun-Jue y Cuestionario OLBI semanal los Viernes).">
      <View style={[e.fila, { gap: espacio.base }]}>
        <Leyenda tinta="#A8DFCF" texto="Check-in diario" /><Leyenda tinta="#005C55" texto="OLBI Completo" /><Leyenda tinta="#8C4A2B" texto="Omitida" hueco /><Leyenda tinta="#E4E1DC" texto="Fin de semana" /><Leyenda tinta="#F1EFEB" texto="Futuro" />
      </View>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.lg }]}>
        <View style={{ flex: 1.6, minWidth: 320 }}>
          <View style={[e.calFila, { paddingLeft: 60 }]}>{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <Text key={d} style={[texto.dato, { color: d === 'Vie' ? color.primarioProfundo : color.textoMedio, flex: 1, textAlign: 'center', fontWeight: d === 'Vie' ? '600' : '400' }]}>{d}</Text>)}</View>
          {semanas.map((sem, i) => (
            <View key={i} style={e.calFila}>
              <View style={{ width: 60 }}><Text style={[texto.datoFuerte, { color: detectada === i + 1 ? '#8C4A2B' : color.texto }]}>Sem {String(i + 1).padStart(2, '0')}{detectada === i + 1 ? ' !' : ''}</Text></View>
              {sem.map((c, j) => (
                <View key={j} style={[e.celda,
                  c.estado === 'checkin' && e.celdaCheckin, c.estado === 'olbi' && e.celdaOlbi, c.estado === 'omitido' && e.celdaOmitida,
                  (c.estado === 'finde' || c.estado === 'previo') && e.celdaFinde, c.estado === 'futuro' && e.celdaFuturo, c.estado === 'omitido' && j === 4 && e.celdaOlbiOmitido,
                ]}>
                  {c.estado === 'omitido' ? <Text style={[texto.datoFuerte, { color: '#8C4A2B', fontSize: 9 }]}>OMIT</Text>
                    : c.estado === 'finde' || c.estado === 'previo' ? <Text style={[texto.dato, { color: color.textoSuave, fontSize: 9 }]}>—</Text>
                    : c.estado === 'futuro' ? <Text style={[texto.dato, { color: color.textoSuave, fontSize: 9 }]}>fut</Text>
                    : <>{c.estado === 'olbi' && <Text style={{ color: '#FFFFFF', fontSize: 8 }}>★</Text>}<Text style={{ color: c.estado === 'olbi' ? '#FFFFFF' : '#0F5B4C', fontSize: 8 }}>{c.hora}</Text></>}
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={[e.desglose, { flex: 1, minWidth: 200 }]}>
          <Rotulo>Desglose por semana</Rotulo>
          {desglose.map((d) => (
            <View key={d.n} style={[e.fila, { justifyContent: 'space-between' }]}>
              <Text style={[texto.dato, { color: detectada === d.n ? '#8C4A2B' : color.texto }]}>Semana {d.n}{d.n === 1 ? ' (Lanzamiento)' : detectada === d.n ? ' (Detección)' : d.n === Math.min(semanaDe(f.inscrito_en, new Date()), 6) ? ' (Actual)' : ''}</Text>
              <Mono tono={d.etiqueta === 'Pendiente' ? color.textoSuave : color.texto}>{d.etiqueta}{d.etiqueta !== 'Pendiente' ? ` (${d.cumplidos}/${d.esperados})` : ''}</Mono>
            </View>
          ))}
          <Text style={[texto.dato, { color: color.textoMedio, paddingTop: 6 }]}>
            Patrón temporal de llenado: el {diarios ? Math.round((tardes / diarios) * 100) : 0}% de registros se completaron pasadas las 20:00 PET. Cumplimiento global {esperadoTotal ? Math.round((total / esperadoTotal) * 100) : 0}%.
          </Text>
        </View>
      </View>
    </Seccion>
  )
}

function Leyenda({ tinta, texto: t, hueco }: { tinta: string; texto: string; hueco?: boolean }) {
  return <View style={[e.fila, { gap: 4 }]}><View style={[e.puntoLeyenda, hueco ? { borderWidth: 1.5, borderColor: tinta } : { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio, fontSize: 11 }]}>{t}</Text></View>
}

// ------------------------------------------------------------ Serie diaria

function SerieDiaria({ f, serie }: { f: Ficha; serie: DiaSerie[] }) {
  const items: { clave: keyof DiaSerie; etiqueta: string; c: string }[] = [
    { clave: 'od_04', etiqueta: 'Agotamiento físico', c: '#8C4A2B' }, { clave: 'od_12', etiqueta: 'Carga mental', c: '#B0532F' },
    { clave: 'od_03', etiqueta: 'Desconexión vespertina', c: '#005C55' }, { clave: 'od_06', etiqueta: 'Presión percibida', c: '#3F7F72' },
  ]
  const viernes = new Set(serie.filter((d) => new Date(`${d.dia}T12:00:00`).getDay() === 5).map((d) => d.dia))
  const sem = (dia: string) => `S${semanaDe(f.inscrito_en, dia)}`
  const promedio = (k: keyof DiaSerie) => { const v = serie.map((d) => d[k]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null }
  const semanas = [...new Set(serie.map((d) => sem(d.dia)))]
  return (
    <Seccion eyebrow="Evolución micro-longitudinal" titulo={`Serie Diaria de Microdatos (${semanas.length} Semanas Observadas)`}
      subtitulo="Dinámica diaria de los 4 indicadores micro-OLBI (escala 1 a 5) y acoplamiento con balance sueño / horas laborales.">
      <View style={[e.fila, { gap: espacio.base }]}>{items.map((i) => <Leyenda key={i.clave} tinta={i.c} texto={i.etiqueta} />)}</View>
      <View style={e.panelGris}>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Rotulo>Intensidad micro-ítems (escala 1.0 – 5.0)</Rotulo>
          <Mono tono={color.textoSuave}>Corte de evaluación semanal cada Viernes (línea vertical)</Mono>
        </View>
        {serie.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin check-ins diarios todavía.</Text> : (
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
          <Rotulo>Balance biométrico auto-reportado</Rotulo>
          <View style={[e.fila, { gap: espacio.base }]}><Leyenda tinta="#005C55" texto="Horas trabajadas / día" /><Leyenda tinta="#BDB8B1" texto="Horas de sueño" /><Leyenda tinta="#8C4A2B" texto="Horas fin de semana (Lunes)" /></View>
          <Mono tono={color.textoMedio}>Promedio: {promedio('horas_trabajadas')?.toFixed(1) ?? '—'} h trab. / {promedio('horas_sueno')?.toFixed(1) ?? '—'} h sueño</Mono>
        </View>
        <View style={e.barras}>
          {serie.map((d, i) => (
            <View key={`${d.dia}-${i}`} style={e.barraCol}>
              <Text style={[texto.dato, { color: '#8C4A2B', fontSize: 9, height: 12 }]}>{d.horas_fin_de_semana != null && Number(d.horas_fin_de_semana) > 0 ? `+${Number(d.horas_fin_de_semana).toFixed(1)}h` : ''}</Text>
              <View style={[e.fila, { gap: 2, alignItems: 'flex-end', height: 70 }]}>
                <View style={[e.barra, { height: Math.min(70, (Number(d.horas_trabajadas ?? 0) / 12) * 70), backgroundColor: '#005C55' }]} />
                <View style={[e.barra, { height: Math.min(70, (Number(d.horas_sueno ?? 0) / 12) * 70), backgroundColor: '#BDB8B1' }]} />
                {d.horas_fin_de_semana != null && Number(d.horas_fin_de_semana) > 0 && <View style={[e.barra, { height: Math.min(70, (Number(d.horas_fin_de_semana) / 12) * 70), backgroundColor: '#8C4A2B' }]} />}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Seccion>
  )
}

// ---------------------------------------------------------- Trayectoria OLBI

function TrayectoriaOlbi({ f, olbi, detectadoEn }: { f: Ficha; olbi: OlbiSemana[]; detectadoEn: number | null }) {
  const uAg = olbi[0]?.umbral_agotamiento ?? 2.875
  const semanaN = (s: OlbiSemana) => semanaDe(f.inscrito_en, s.enviado_en)
  const nivel = (v: number, u: number) => v >= u ? 'ALTO' : v >= u - 0.6 ? 'Vigilar' : 'Sostenible'
  return (
    <Seccion eyebrow="Diagnóstico metodológico" titulo={`Trayectoria Longitudinal OLBI${detectadoEn ? ` y Detección S${detectadoEn}` : ''}`}
      subtitulo={`Evolución de puntajes viernes tras viernes (escala validada 1.0 a 4.0). Umbral clínico establecido en ${uAg.toFixed(2)}.`}>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.lg }]}>
        <View style={[e.panelGris, { flex: 1.3, minWidth: 320 }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <Text style={[texto.datoFuerte, { color: color.texto }]}>Curvas de Corte{'\n'}Semanal (S1 - S{olbi.length})</Text>
            <View style={[e.fila, { gap: espacio.base }]}><Leyenda tinta="#8C4A2B" texto="Agotamiento" /><Leyenda tinta="#005C55" texto="Desvinculación" /></View>
          </View>
          {olbi.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin OLBI del viernes todavía.</Text> : (
            <GraficaLinea
              series={[
                { etiqueta: 'Agotamiento', color: '#8C4A2B', puntos: olbi.map((s) => ({ x: s.semana, y: Number(s.agotamiento) })) },
                { etiqueta: 'Desvinculación', color: '#005C55', puntos: olbi.map((s) => ({ x: s.semana, y: Number(s.desvinculacion) })) },
              ]}
              yMin={1} yMax={4} alto={220} sinLeyenda todasLasEtiquetasX
              bandas={[{ desde: uAg, hasta: 4, color: '#FBEDE6', etiqueta: `Zona Alta (≥ ${uAg.toFixed(2)})` }, { desde: uAg - 0.6, hasta: uAg, color: '#FBF3E6', etiqueta: `A vigilar (${(uAg - 0.6).toFixed(2)} – ${uAg.toFixed(2)})` }, { desde: 1, hasta: uAg - 0.6, color: '#E8F3EE', etiqueta: `Zona Sostenible (< ${(uAg - 0.6).toFixed(2)})` }]}
              umbral={uAg} etiquetaX={(x) => `S${semanaN(olbi.find((o) => o.semana === x)!)}`}
              marcarX={detectadoEn && olbi.find((o) => semanaN(o) === detectadoEn) ? { x: olbi.find((o) => semanaN(o) === detectadoEn)!.semana, etiqueta: 'Detección' } : undefined}
            />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 260, gap: espacio.sm }}>
          <Rotulo>Matriz de puntuaciones semanales</Rotulo>
          <View style={e.tablaCab}>{['Semana', 'Fecha', 'Agot.', 'Desv.', 'Clasif.'].map((h, i) => <Text key={h} style={[texto.etiqueta, { color: i === 2 ? '#8C4A2B' : i === 3 ? '#005C55' : color.textoMedio, fontSize: 9.5, flex: i === 0 ? 1.1 : 1 }]}>{h}</Text>)}</View>
          {olbi.map((s) => {
            const n = semanaN(s); const esDet = detectadoEn === n
            return (
              <View key={s.respuesta_id} style={[e.tablaFila, esDet && { backgroundColor: '#FBEDE6' }]}>
                <Text style={[texto.datoFuerte, { color: esDet ? '#8C4A2B' : color.texto, flex: 1.1 }]}>Semana {n}{esDet ? ' ⚑' : ''}</Text>
                <Mono tono={esDet ? '#8C4A2B' : color.textoMedio}>{fechaCorta(s.enviado_en)}</Mono>
                <Mono tono={Number(s.agotamiento) >= uAg ? '#8C4A2B' : color.texto}>{Number(s.agotamiento).toFixed(2)}</Mono>
                <Mono tono={color.texto}>{Number(s.desvinculacion).toFixed(2)}</Mono>
                <View style={{ flex: 1 }}><Pastilla tono={s.alto ? TONO.tierra : nivel(Number(s.agotamiento), uAg) === 'Vigilar' ? TONO.ambar : TONO.verde}>{s.alto ? 'ALTO CLÍNICO' : nivel(Number(s.agotamiento), uAg)}</Pastilla></View>
              </View>
            )
          })}
          {f.deteccion && (
            <View style={e.criterio}>
              <Text style={[texto.dato, { color: color.texto }]}>
                <Text style={texto.datoFuerte}>Criterio de Inferencia:</Text> El participante superó el umbral ético de agotamiento el {new Date(f.deteccion.ocurrido_en).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} (Semana {detectadoEn}), activando el canal de derivación de acuerdo al protocolo de protección de la salud mental.
              </Text>
            </View>
          )}
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
    const tinta = p.acierto === false ? '#8C4A2B' : p.acierto === true ? color.primarioProfundo : color.textoMedio
    return (
      <View style={[e.pred, p.senalado && { borderLeftWidth: 3, borderLeftColor: '#8C4A2B' }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>{pron ? `Proyección S${semanaN(p.semana)} → S${semanaN(p.semana_objetivo)}` : `Semana ${semanaN(p.semana)} (Nowcast, ${p.n_dias ?? ''} días):`} <Text style={{ color: tinta }}>{pct}%</Text></Text>
          <Text style={[texto.dato, { color: color.textoMedio }]}>{p.senalado ? 'Predijo cruce de umbral' : 'Predijo estabilidad'} (P: {pct}%) · v {p.version}</Text>
          <View style={e.pista}><View style={[e.lleno, { width: `${pct}%`, backgroundColor: p.senalado ? '#8C4A2B' : color.primarioProfundo }]} /></View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 110 }}>
          <Text style={[texto.datoFuerte, { color: tinta }]}>{p.acierto === null ? 'Pendiente' : p.acierto ? '✓ Acertó' : '✗ Falló'}</Text>
          <Mono tono={color.textoMedio}>{p.resultado_real == null ? 'sin OLBI aún' : `real: ${p.resultado_real ? 'Alto' : 'Sostenible'} (${Number(p.agotamiento_real).toFixed(2)})`}</Mono>
        </View>
      </View>
    )
  }

  return (
    <Seccion eyebrow="Inteligencia predictiva" titulo="Desempeño del Modelo de Inferencia" subtitulo="Evaluación comparativa entre probabilidad proyectada y corte real observado de los viernes."
      derecha={<View style={[e.fila, { gap: 6 }]}><Mono>Motor:</Mono><Pastilla tono={TONO.gris} mono>{version}</Pastilla></View>}>
      <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
        <View style={[e.panelGris, { flex: 1, minWidth: 280, gap: espacio.sm }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>A) Nowcast Intra-semanal (Lun → Jue)</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Predicción anticipada del resultado de agotamiento del viernes.</Text></View>
            <Pastilla tono={TONO.verde}>{`${aN.ok} / ${aN.n} Aciertos`}</Pastilla>
          </View>
          {nw.length === 0 ? <Text style={[texto.dato, { color: color.textoMedio }]}>Sin nowcasts registrados: se generan al abrir la app de lunes a jueves.</Text> : nw.map((p) => <FilaPred key={p.evento_id} p={p} />)}
        </View>
        <View style={[e.panelGris, { flex: 1, minWidth: 280, gap: espacio.sm }]}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>B) Pronóstico Inter-semanal (S → S+1)</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Proyección generada el viernes para la semana entrante.</Text></View>
            <Pastilla tono={TONO.verde}>{`${aP.ok} / ${aP.n} Aciertos`}</Pastilla>
          </View>
          {pr.length === 0 ? <Text style={[texto.dato, { color: color.textoMedio }]}>Sin pronósticos registrados: se generan al responder el OLBI del viernes.</Text> : pr.map((p) => <FilaPred key={p.evento_id} p={p} pron />)}
        </View>
      </View>
    </Seccion>
  )
}

// ------------------------------------------------------------------- Items

function Items({ respuestas, defs }: { respuestas: RespuestaConItems[]; defs: Record<string, { version: number; titulo: string; items: DefinicionItem[] }[]> }) {
  // Por defecto, el último OLBI (el instrumento validado); si no hay, la última respuesta.
  const porDefecto = () => (respuestas.find((r) => r.formulario_clave === 'olbi') ?? respuestas[0])?.id ?? null
  const [abierta, setAbierta] = useState<string | null>(porDefecto)
  useEffect(() => { if (!abierta && respuestas[0]) setAbierta(porDefecto()) }, [respuestas])
  const def = (r: RespuestaConItems) => defs[r.formulario_clave]?.find((d) => d.version === r.formulario_version)
  const NOMBRE: Record<string, string> = { olbi: 'Cuestionario OLBI Completo', diario: 'Check-in diario', semanal: 'Sobre tu semana', estable: 'Datos iniciales' }
  const literal = (it: DefinicionItem | undefined, v: number | null, t: string | null) => {
    if (t != null) return it?.opciones?.find((o) => o.valor === t)?.etiqueta ?? t
    if (v == null) return '—'
    if (it?.tipo === 'booleano') return v ? 'Sí' : 'No'
    if (it?.escala && it.escala.max === 4) return ['', 'Totalmente en desacuerdo', 'En desacuerdo', 'De acuerdo', 'Totalmente de acuerdo'][v] ?? String(v)
    if (it?.escala && it.escala.max === 5) return ['', 'Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'][v] ?? String(v)
    return String(v)
  }
  return (
    <Seccion eyebrow="Inspección psicométrica" titulo="Respuestas Ítem a Ítem" subtitulo="Fila de detalle granular de reactivos según el instrumento validado y la escala psicométrica en uso.">
      <View style={[e.fila, { gap: 6 }]}>
        <Rotulo>Evaluación:</Rotulo>
        {respuestas.slice(0, 12).map((r) => (
          <Pressable key={r.id} onPress={() => setAbierta(r.id)} style={[e.chipEval, abierta === r.id && e.chipEvalActivo]}>
            <Text style={[texto.dato, { color: abierta === r.id ? '#FFFFFF' : color.texto }]}>{fechaCorta(r.enviado_en)} · {NOMBRE[r.formulario_clave] ?? r.formulario_clave}</Text>
          </Pressable>
        ))}
      </View>
      {respuestas.filter((r) => r.id === abierta).map((r) => {
        const d = def(r)
        return (
          <View key={r.id} style={e.tablaItems}>
            <View style={[e.tablaCab, { paddingHorizontal: 10 }]}>{['#', 'Reactivo textual del instrumento', 'Dimensión', 'Puntaje', 'Respuesta literal'].map((h, i) => <Text key={h} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: i === 0 ? 0.3 : i === 1 ? 3 : 1 }]}>{h}</Text>)}</View>
            {(d?.items ?? []).filter((it) => r.items.some((x) => x.item_clave === it.clave)).map((it, i) => {
              const x = r.items.find((y) => y.item_clave === it.clave)!
              const puntaje = x.valor_num
              const alto = puntaje != null && it.escala && puntaje >= it.escala.max - 0.5 && !it.invertido
              return (
                <View key={it.clave} style={[e.tablaFila, { paddingHorizontal: 10 }]}>
                  <Mono tono={color.textoSuave}>{String(i + 1).padStart(2, '0')}</Mono>
                  <View style={{ flex: 3 }}><Text style={[texto.dato, { color: color.texto }]}>{it.texto}</Text>{it.invertido && <Text style={[texto.dato, { color: color.textoSuave, fontSize: 10 }]}>(Invertido)</Text>}</View>
                  <Text style={[texto.dato, { color: it.dimension === 'agotamiento' ? '#8C4A2B' : it.dimension === 'desvinculacion' ? '#005C55' : color.textoMedio, flex: 1 }]}>{it.dimension ? (it.dimension === 'agotamiento' ? 'Agotamiento' : 'Desvinculación') : '—'}</Text>
                  <View style={{ flex: 1 }}><View style={[e.puntaje, { backgroundColor: alto ? '#8C4A2B' : '#EDEBE7' }]}><Text style={[texto.datoFuerte, { color: alto ? '#FFFFFF' : color.texto, fontSize: 11 }]}>{puntaje ?? x.valor_texto ?? '—'}</Text></View></View>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{literal(it, puntaje, x.valor_texto)}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
      {respuestas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin respuestas registradas.</Text>}
    </Seccion>
  )
}

// ----------------------------------------------------------- Línea de tiempo

function LineaTiempo({ hitos, f }: { hitos: Hito[]; f: Ficha }) {
  const TIPO: Record<string, { titulo: (h: Hito) => string; etiqueta: string; tono: { fondo: string; tinta: string }; detalle: (h: Hito) => string }> = {
    consentimiento: { titulo: (h) => h.metadata.aceptado ? 'Inscripción y firma de consentimiento informado' : 'Consentimiento rechazado', etiqueta: 'Ética/Protocolo', tono: TONO.gris, detalle: (h) => `Versión del texto: ${h.metadata.version_texto ?? '—'}.` },
    inicio_seguimiento: { titulo: () => `Inicio formal de monitoreo en cohorte ${f.empresa ?? ''}`, etiqueta: 'Seguimiento', tono: TONO.gris, detalle: () => 'Activación del calendario semanal de check-ins y OLBI.' },
    deteccion: { titulo: () => 'Detección del sistema (umbral OLBI superado)', etiqueta: 'Detección disparada', tono: TONO.tierra, detalle: (h) => `Puntajes: ${Object.entries(h.metadata.puntajes ?? {}).map(([k, v]) => `${k} ${Number(v).toFixed(2)}`).join(' · ')}. Activación del canal de derivación y notificación al psicólogo.` },
    derivacion_psicologo: { titulo: (h) => h.metadata.origen === 'solicitud' ? 'Derivación por solicitud del participante' : 'Derivación automática al psicólogo asignado', etiqueta: 'Derivación', tono: TONO.gris, detalle: () => 'Asignación al profesional con menos casos abiertos. El psicólogo accede a la identidad solo con esta derivación.' },
    cita_solicitada: { titulo: () => 'Cita solicitada por el participante', etiqueta: 'Solicitud participante', tono: TONO.verdeSuave, detalle: (h) => `Franja propuesta: ${h.metadata.propuesta_para ? fechaHoraPET(h.metadata.propuesta_para) : '—'}.` },
    cita_confirmada: { titulo: () => 'Cita confirmada por el psicólogo', etiqueta: 'Agendado', tono: TONO.verde, detalle: () => 'La videollamada se abre a la hora acordada desde la app.' },
    cita_cancelada: { titulo: (h) => `Cita cancelada por ${h.metadata.por ?? '—'}`, etiqueta: 'Cancelación', tono: TONO.gris, detalle: () => 'El participante puede pedir otra cuando quiera.' },
    sesion_iniciada: { titulo: () => 'Sala de videollamada abierta', etiqueta: 'Sesión', tono: TONO.verdeSuave, detalle: () => 'Solo el hecho: el contenido de la sesión no es visible para el estudio.' },
    sesion_finalizada: { titulo: (h) => `Sesión de apoyo realizada (${h.metadata.minutos ?? '—'} min)`, etiqueta: 'Sesión', tono: TONO.verde, detalle: () => 'Duración registrada; sin transcripción ni notas en este panel (RN-009-03).' },
    sesion_realizada: { titulo: () => 'Sesión de apoyo registrada', etiqueta: 'Sesión', tono: TONO.verde, detalle: () => 'Solo el hecho.' },
    informe_aprobado: { titulo: () => 'Informe clínico aprobado por el psicólogo', etiqueta: 'Cierre documental', tono: TONO.verde, detalle: () => 'El contenido queda en la relación terapéutica.' },
    acceso_identidad: { titulo: (h) => `Acceso a identidad consultado por ${h.metadata.por === 'investigador' ? 'el investigador' : 'el psicólogo'}`, etiqueta: 'Registro de acceso', tono: TONO.ambar, detalle: () => 'Motivo: salvaguarda clínica o coordinación. Queda en la auditoría del estudio.' },
    salida_seguimiento: { titulo: (h) => `Salida del seguimiento (${h.metadata.motivo ?? '—'})`, etiqueta: 'Cierre', tono: TONO.gris, detalle: (h) => `Registrado por ${h.metadata.por ?? 'el sistema'}. Las respuestas se conservan anonimizadas.` },
    alerta_adherencia: { titulo: () => 'Alerta de adherencia', etiqueta: 'Adherencia', tono: TONO.ambar, detalle: () => 'Días hábiles sin registro por encima del corte.' },
    reasignacion_psicologo: { titulo: () => 'Derivación reasignada a otro psicólogo', etiqueta: 'Reasignación', tono: TONO.gris, detalle: () => 'Por el investigador; las citas vigentes pasan al nuevo profesional.' },
  }
  const enCurso = f.cita?.estado === 'confirmada'
  return (
    <Seccion eyebrow="Trazabilidad operativa" titulo="Línea de Tiempo del Participante y Auditoría" subtitulo="Hitos cronológicos, criterios de derivación y controles de acceso. Sin datos clínicos previos expuestos."
      derecha={<Pastilla tono={TONO.gris} mono>{`${hitos.length} eventos auditados`}</Pastilla>}>
      <View style={{ gap: 4 }}>
        {hitos.map((h, i) => {
          const t = TIPO[h.tipo] ?? { titulo: () => h.tipo, etiqueta: h.tipo, tono: TONO.gris, detalle: () => '' }
          const destacado = h.tipo === 'deteccion'
          return (
            <View key={`${h.tipo}-${h.ocurrido_en}-${i}`} style={[e.hito, destacado && { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10, marginLeft: -10 }]}>
              <View style={e.hitoCol}>
                <View style={[e.hitoPunto, { backgroundColor: destacado ? '#8C4A2B' : h.tipo.startsWith('cita') || h.tipo.startsWith('sesion') || h.tipo === 'informe_aprobado' ? color.primarioProfundo : '#BDB8B1' }]} />
                {i < hitos.length - 1 && <View style={e.hitoLinea} />}
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: 12 }}>
                <View style={[e.fila, { gap: 8 }]}><Mono tono={destacado ? '#8C4A2B' : color.textoMedio}>{fechaHoraPET(h.ocurrido_en)}</Mono><Pastilla tono={t.tono}>{t.etiqueta}</Pastilla></View>
                <Text style={[texto.datoFuerte, { color: color.texto }]}>{t.titulo(h)}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{t.detalle(h)}</Text>
              </View>
            </View>
          )
        })}
        {enCurso && f.cita && (
          <View style={[e.hito, { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10, marginLeft: -10 }]}>
            <View style={e.hitoCol}><View style={[e.hitoPunto, { backgroundColor: color.primarioProfundo }]} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={[e.fila, { gap: 8 }]}><Mono tono={color.primarioProfundo}>En curso</Mono><Pastilla tono={TONO.verde}>Próximo hito</Pastilla></View>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>Sesión de apoyo psicológico programada para el {fechaHoraPET(f.cita.propuesta_para)}</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>El psicólogo abre la sala a esa hora; la sesión quedará registrada aquí al terminar.</Text>
            </View>
          </View>
        )}
        {hitos.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin eventos todavía.</Text>}
      </View>
    </Seccion>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cabecera: { backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.lg, gap: espacio.md, borderWidth: 1, borderColor: '#EEECE8' },
  adherencia: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, alignSelf: 'flex-start' },
  anilloFallback: { width: 56, height: 56, borderRadius: 28, borderWidth: 6, borderColor: '#005C55', alignItems: 'center', justifyContent: 'center' },
  identidad: { backgroundColor: '#FBEDE6', borderRadius: radio.md, padding: espacio.md, gap: 2, alignSelf: 'flex-start' },
  acciones: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap', backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 10 },
  menu: { position: 'absolute', top: 38, left: 0, minWidth: 220, backgroundColor: color.superficie, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 20, elevation: 6 },
  cuerpo: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.lg },
  rail: { width: 220, gap: espacio.md },
  railItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6 },
  railActivo: { backgroundColor: '#EAF4EF' },
  panelGris: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, gap: espacio.sm },
  calFila: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  celda: { flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEB' },
  celdaCheckin: { backgroundColor: '#A8DFCF' },
  celdaOlbi: { backgroundColor: '#005C55' },
  celdaOmitida: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#8C4A2B' },
  celdaOlbiOmitido: { backgroundColor: '#FBEDE6' },
  celdaFinde: { backgroundColor: '#E4E1DC' },
  celdaFuturo: { backgroundColor: '#F1EFEB' },
  desglose: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, gap: 6 },
  puntoLeyenda: { width: 9, height: 9, borderRadius: 3 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' },
  barraCol: { alignItems: 'center', gap: 2 },
  barra: { width: 5, borderRadius: 2 },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.borde },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: 4 },
  criterio: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, marginTop: 6 },
  pred: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#EEECE8' },
  pista: { height: 4, borderRadius: 2, backgroundColor: '#EDEBE7', overflow: 'hidden', marginTop: 4 },
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

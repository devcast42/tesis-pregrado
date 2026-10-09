/** Desempeño del modelo — implementa ESP-009 RF-009-12 (RN-009-05).
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Desempeño del Modelo · Investigador Principal».
 *
 *  Todo se calcula sobre predicciones registradas en su momento y
 *  confrontadas con el OLBI objetivo (vista `predicciones_evaluables`):
 *  nunca se recalcula post-hoc con el modelo actual.
 *
 *  Solo el modelo que decide cuándo pedir el cuestionario: el pronóstico de
 *  la semana siguiente ya no se usa, y el selector entre los dos hablaba de
 *  un «OLBI del viernes» que ya no existe. Ahora el OLBI llega el día en que
 *  el modelo cruza el corte, por sorteo, al mes o tras un alta, y eso cambia
 *  cómo se leen las cifras: a quien el modelo no avisa se le mide poco, así
 *  que la pantalla dice de dónde salió cada OLBI evaluado. */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import {
  activarVersion, calibracion as cargarCalibracion, desempeno as cargarDesempeno, evaluables as cargarEvaluables, rocAuc,
  versiones as cargarVersiones, type Calibracion, type Desempeno, type VersionModelo,
} from '../../modules/investigador/panel'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCandado, IconoCheckCirculo, IconoEscudoCheck, IconoInfo } from '../../modules/nucleo/iconos'

type Tarea = 'nowcast' | 'pronostico'

const TIERRA = '#8C4A2B'
/** Por debajo de esto las métricas no se pueden leer (ESP-005, potencia). */
const MINIMO_POSITIVOS = 20

export default function DesempenoModelo() {
  const { filtro } = useFiltro()
  const tarea: Tarea = 'nowcast'
  const [versiones, setVersiones] = useState<VersionModelo[] | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [filas, setFilas] = useState<Desempeno[]>([])
  const [todas, setTodas] = useState<Desempeno[]>([])
  const [cal, setCal] = useState<Calibracion[]>([])
  const [auc, setAuc] = useState<number | null>(null)
  const [pares, setPares] = useState<{ probabilidad: number; resultado_real: boolean; senalado: boolean; motivo: string | null }[]>([])
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  // Hasta tener las cifras de la versión, «Cargando»: antes se pintaba la
  // matriz a cero y el aviso de «0 casos reales» durante varios segundos.
  const [listo, setListo] = useState(false)

  const deTarea = useMemo(() => (versiones ?? []).filter((v) => v.tarea === tarea), [versiones, tarea])
  const activa = deTarea.find((v) => v.activa) ?? deTarea[0]
  const elegida = deTarea.find((v) => v.version === version) ?? activa

  const cargar = useDatosDelFiltro(() => { setVersiones(null); setListo(false) }, async (vigente) => {
    const [vs, td, emps] = await Promise.all([cargarVersiones(), cargarDesempeno(tarea), listarEmpresas().catch(() => [] as Empresa[])])
    if (!vigente()) return
    setVersiones(vs); setTodas(td)
    setEmpresa(emps.find((e) => e.id === filtro.organizacion_id) ?? null)
    const v = vs.filter((x) => x.tarea === tarea)
    const ver = v.find((x) => x.version === version) ?? v.find((x) => x.activa) ?? v[0]
    if (!ver) { setFilas([]); setCal([]); setAuc(null); setPares([]); setListo(true); return }
    // No se guarda la versión elegida por defecto: cambiar `version` vuelve a
    // lanzar esta carga, y eso duplicaba todas las consultas al entrar.
    const [f, c, a, p] = await Promise.all([cargarDesempeno(tarea, ver.version), cargarCalibracion(tarea, ver.version), rocAuc(tarea, ver.version), cargarEvaluables(tarea, ver.version)])
    if (!vigente()) return
    setFilas(f); setCal(c); setAuc(a); setPares(p); setListo(true)
  }, [tarea, version, filtro.organizacion_id])

  if (!versiones || !listo) return <Panel rol="investigador"><Cargando /></Panel>

  const total = filas.find((f) => f.semana === null) ?? { n: 0, vp: 0, fp: 0, vn: 0, fn: 0, precision: null, recall: null, especificidad: null, exactitud: null }
  const porSemana = filas.filter((f) => f.semana !== null).sort((a, b) => (a.semana! < b.semana! ? -1 : 1))
  const brier = pares.length ? pares.reduce((s, p) => s + (p.probabilidad - (p.resultado_real ? 1 : 0)) ** 2, 0) / pares.length : null
  const prevalencia = total.n ? (total.vp + total.fn) / total.n : null
  // Los casos reales son el cuello de botella de todas estas métricas: con
  // pocos, precisión y recall saltan decenas de puntos por un solo acierto.
  // El análisis de potencia de ESP-005 pide del orden de 20 para empezar.
  const positivos = total.vp + total.fn
  const umbral = elegida?.umbral_decision ?? 0.5
  const semanas = porSemana.map((f) => new Date(`${f.semana}T12:00:00`))
  const ventana = semanas.length ? `${semanas.length} semanas · ${total.n} ventanas` : `${total.n} ventanas`

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function activar(v: VersionModelo) {
    const ok = Platform.OS === 'web' ? window.confirm(`Activar ${v.version}.\n\nLas predicciones nuevas se registrarán con esta versión. Las anteriores conservan la suya.`) : true
    if (!ok) return
    try { await activarVersion(v.version, tarea); cargar() } catch (e) { aviso('No se pudo activar', e instanceof Error ? e.message : '') }
  }

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Modelo · ESP-009" titulo="Desempeño del modelo"
          subtitulo="Qué acertó y qué falló al decidir a quién pedirle el cuestionario."
          derecha={empresa ? (
            <View style={e.notaCohorte}>
              <IconoInfo tamano={14} color={color.primarioProfundo} />
              <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>
                Estás filtrando por <Text style={texto.datoFuerte}>{empresa.nombre}</Text>, pero el modelo se evalúa sobre toda la cohorte: no se puede partir por empresa (RN-009-04).
              </Text>
            </View>
          ) : undefined} />

        {/* Lo primero que hay que saber, antes que ninguna cifra. */}
        {positivos < MINIMO_POSITIVOS ? (
          <View style={[e.veredicto, { backgroundColor: '#FBEDE6', borderColor: '#EBC9B6' }]}>
            <Text style={[e.cifraGrande, { color: TIERRA }]}>{positivos}</Text>
            <View style={{ flex: 1, gap: 2, minWidth: 260 }}>
              <Text style={[texto.cuerpoFuerte, { color: TIERRA }]}>
                {positivos === 1 ? 'Un solo caso real: las cifras de abajo no concluyen nada' : 'Muy pocos casos reales: las cifras de abajo no concluyen nada'}
              </Text>
              <Text style={[texto.dato, { color: TIERRA }]}>
                {`Todo lo que sigue se calcula sobre ${positivos} ${positivos === 1 ? 'semana' : 'semanas'} en que alguien cruzó el umbral, de ${total.n} evaluadas. Un acierto de más o de menos mueve la precisión decenas de puntos. Hacen falta unos ${MINIMO_POSITIVOS} para empezar a leerlas.`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[e.veredicto, { backgroundColor: '#EAF4EF', borderColor: '#CFE6DA' }]}>
            <View style={e.escudo}><IconoEscudoCheck tamano={20} color={color.primarioProfundo} /></View>
            <View style={{ flex: 1, gap: 2, minWidth: 260 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{`${positivos} casos reales sobre ${total.n} semanas evaluadas`}</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Muestra suficiente para leer las cifras con cautela. El intervalo de cada una va bajo su número.</Text>
            </View>
          </View>
        )}

        {/* Controles */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'flex-end' }]}>
          <View style={{ gap: 6, zIndex: 20 }}>
            <Rotulo>Versión</Rotulo>
            <Pressable onPress={() => setMenu((m) => !m)} disabled={deTarea.length < 2} style={e.selector}>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>{elegida ? `${elegida.activa ? 'En uso' : 'Versión'}: ${elegida.version}` : 'Sin versiones registradas'}</Text>
              {deTarea.length > 1 && <Text style={{ color: color.textoMedio }}>▾</Text>}
            </Pressable>
            {menu && (
              <View style={e.menu}>
                {deTarea.map((v) => (
                  <Pressable key={v.version} onPress={() => { setVersion(v.version); setMenu(false) }} style={e.menuItem}>
                    <Text style={[texto.dato, { color: color.texto }]}>{v.version} · {v.origen}{v.activa ? ' · activa' : ''}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Rotulo>Periodo</Rotulo>
            <View style={e.selector}><Text style={[texto.datoFuerte, { color: color.texto }]}>Todo el seguimiento</Text><Mono>{ventana}</Mono></View>
          </View>
        </View>

        <View style={e.nota}>
          <IconoCandado tamano={13} color={color.primarioProfundo} />
          <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>
            <Text style={texto.datoFuerte}>Sin trampa: </Text>
            Cada cifra sale de lo último que el modelo dijo antes de que la persona contestara el OLBI. Nada se recalcula después.
          </Text>
        </View>

        <Origen pares={pares} />

        {/* Bloque 1: matriz + métricas */}
        <View style={[e.fila, { alignItems: 'stretch', gap: espacio.base }]}>
          <Caja estilo={{ flex: 1, minWidth: 300, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Rotulo>Aciertos y fallos</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>Lo que dijo frente a lo que pasó</Text>
              </View>
              <View style={e.cuadroN}><Mono tono={color.textoMedio}>N =</Mono><Mono tono={color.texto}>{String(total.n)}</Mono></View>
            </View>
            <View style={[e.fila, { gap: 6 }]}><Text style={[texto.dato, { color: color.textoMedio }]}>Avisa a partir de:</Text><Pastilla tono={TONO.gris} mono>{`τ ≥ ${umbral.toFixed(2)}`}</Pastilla></View>
            <Matriz total={total} />
            <View style={[e.fila, { justifyContent: 'space-between', paddingTop: 4 }]}>
              <View style={[e.fila, { gap: 6 }]}><View style={e.puntoVerde} /><Text style={[texto.dato, { color: color.textoMedio }]}>Acertó en: <Mono tono={color.texto}>{total.vp + total.vn}</Mono></Text></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Semanas con cruce: <Mono tono={color.texto}>{prevalencia == null ? '—' : `${(prevalencia * 100).toFixed(1)}%`}</Mono></Text>
            </View>
          </Caja>
          <View style={{ flex: 1.3, minWidth: 320, gap: espacio.base }}>
            <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
              <Metrica rotulo="De cada aviso, cuántos eran" valor={total.precision} n={total.vp + total.fp} k={total.vp} texto="Cuando el modelo avisa, con qué frecuencia esa persona sí cruzó el umbral." />
              <Metrica rotulo="De los que cruzaron, cuántos pilló" valor={total.recall} n={total.vp + total.fn} k={total.vp} texto="Lo que más importa. Los que se le escapan solo se ven si les toca el sorteo o el control del mes." tinta="#8C4A2B" />
            </View>
            <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
              <Metrica rotulo="De los que estaban bien, cuántos dejó en paz" valor={total.especificidad} n={total.vn + total.fp} k={total.vn} texto="Si baja, el psicólogo recibe avisos de gente que está bien." />
              <Caja estilo={{ flex: 1, minWidth: 150, gap: 6 }}>
                <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>Capacidad de ordenar (AUC)</Rotulo><IconoInfo tamano={13} color={color.textoSuave} /></View>
                <View style={[e.fila, { alignItems: 'baseline', gap: 8 }]}>
                  <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 26 }]}>{auc == null ? '—' : auc.toFixed(3)}</Text>
                  {auc != null && <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{auc >= 0.9 ? 'Excelente' : auc >= 0.8 ? 'Bueno' : auc >= 0.7 ? 'Aceptable' : 'Débil'}</Text>}
                </View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Si tomo una semana mala y una buena al azar, cuántas veces le da más riesgo a la mala. 0,5 es una moneda al aire.</Text>
                <View style={[e.fila, { justifyContent: 'space-between' }]}><Mono>Mann-Whitney (N={total.n})</Mono><Mono tono={color.texto}>{total.vp + total.fn} +  ·  {total.vn + total.fp} −</Mono></View>
                <View style={e.pista}><View style={[e.lleno, { width: `${Math.round((auc ?? 0) * 100)}%`, backgroundColor: color.primarioProfundo }]} /></View>
              </Caja>
            </View>
          </View>
        </View>

        {/* Bloque 2: por semana + calibración */}
        <View style={[e.fila, { alignItems: 'stretch', gap: espacio.base }]}>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Rotulo>Semana a semana</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>¿Mejora con el tiempo?</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Cada punto usa solo las semanas evaluables de esa fecha, no el acumulado.</Text>
              </View>
              <View style={[e.fila, { gap: 10 }]}><Leyenda tinta={color.primarioProfundo} texto="Precisión" /><Leyenda tinta="#8C4A2B" texto="Recall" /></View>
            </View>
            <View style={e.panelGris}>
              {/* El eje va de 0 a 100: la precisión de un modelo con pocos
                  positivos vive cerca de cero, y empezando en 40 se salía. */}
              {porSemana.length === 0 ? <Vacio /> : (
                <GraficaLinea
                  series={[
                    { etiqueta: 'Precisión', color: color.primarioProfundo, puntos: porSemana.map((f) => ({ x: f.semana!, y: f.precision == null ? null : Number(f.precision) * 100 })) },
                    { etiqueta: 'Recall', color: '#8C4A2B', puntos: porSemana.map((f) => ({ x: f.semana!, y: f.recall == null ? null : Number(f.recall) * 100 })) },
                  ]}
                  yMin={0} yMax={100} alto={200} sinLeyenda todasLasEtiquetasX etiquetaX={(x) => `Sem ${semanaCorta(x)}`}
                />
              )}
            </View>
            <View style={[e.fila, { justifyContent: 'space-between' }]}>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Cambio de recall, de la primera semana a la última: <Mono tono={color.texto}>{delta(porSemana.map((f) => f.recall))}</Mono></Text>
              <Mono>sin mirar el futuro</Mono>
            </View>
          </Caja>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Rotulo>¿Se puede creer el porcentaje?</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>Lo que dijo frente a lo que ocurrió</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Cuando dice «60 %», ¿cruza el umbral el 60 % de las veces? Cuanto más pegada a la línea gris, mejor.</Text>
              </View>
              <View style={e.cuadroN}><Mono tono={color.textoMedio}>Brier{'\n'}Score:</Mono><Mono tono={color.texto}>{brier == null ? '—' : brier.toFixed(3)}</Mono></View>
            </View>
            <View style={e.panelGris}>
              {cal.length === 0 ? <Vacio /> : (
                <GraficaLinea
                  series={[
                    { etiqueta: 'Observado', color: color.primarioProfundo, puntos: cal.map((c) => ({ x: String(c.decil), y: Number(c.frecuencia_observada) })) },
                    { etiqueta: 'Ideal', color: '#BDB8B1', punteada: true, puntos: cal.map((c) => ({ x: String(c.decil), y: Number(c.prob_media) })) },
                  ]}
                  yMin={0} yMax={1} alto={200} sinLeyenda todasLasEtiquetasX etiquetaX={(x) => (Number(x) / 10).toFixed(1)}
                />
              )}
            </View>
            <View style={[e.fila, { justifyContent: 'space-between' }]}>
              {cal.some((c) => c.n < 20)
                ? <Text style={[texto.dato, { color: '#8C4A2B', flex: 1 }]}>⚠ Deciles con n &lt; 20 ({cal.filter((c) => c.n < 20).map((c) => `${(c.decil / 10).toFixed(1)}: n=${c.n}`).join(' · ')}) presentan varianza por bajo soporte.</Text>
                : <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Todos los deciles con n ≥ 20.</Text>}
              <Mono>Deciles: {cal.length} / 10</Mono>
            </View>
          </Caja>
        </View>

        {/* Bloque 3: comparativa de versiones */}
        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Rotulo>Cuándo pedir el cuestionario</Rotulo>
              <Text style={[texto.seccion, { color: color.texto }]}>Comparar versiones</Text>
            </View>
            <Pastilla tono={TONO.verdeSuave} icono={<IconoEscudoCheck tamano={12} color={color.primarioProfundo} />}>{`Medido sobre ${todas.filter((t) => t.semana === null).reduce((s, t) => s + t.n, 0)} semanas evaluables`}</Pastilla>
          </View>
          <View style={e.tablaCab}>
            {[['Versión', 2.2], ['Entrenada con', 1], ['Precisión', 1], ['Recall', 0.8], ['AUC', 0.8], ['F1', 0.8], ['Falsas alarmas', 1], ['', 1]].map(([h, f]) => (
              <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f), textAlign: h === 'Versión' ? 'left' : 'right' }]}>{String(h).toUpperCase()}</Text>
            ))}
          </View>
          {deTarea.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 10 }]}>Sin versiones registradas para esta tarea.</Text>}
          {deTarea.map((v) => {
            const t = todas.find((x) => x.version === v.version && x.semana === null)
            const m: Record<string, any> = (v.metricas?.global as Record<string, any>) ?? v.metricas ?? {}
            const prec = t?.precision != null ? Number(t.precision) : num(m.precision)
            const rec = t?.recall != null ? Number(t.recall) : num(m.recall)
            const f1 = prec != null && rec != null && prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : num(m.f1)
            const fpTasa = t && t.vn + t.fp > 0 ? t.fp / (t.vn + t.fp) : null
            const aucV = v.version === elegida?.version ? auc : num(m.auc ?? m.roc_auc)
            const esElegida = v.version === elegida?.version
            return (
              <View key={v.version} style={[e.tablaFila, esElegida && { backgroundColor: '#F5F4F1' }]}>
                <View style={{ flex: 2.2, gap: 2 }}>
                  <View style={[e.fila, { gap: 8 }]}>
                    <View style={[e.puntoVerde, { backgroundColor: v.activa ? color.primarioProfundo : '#BDB8B1' }]} />
                    <Mono tono={color.texto} tamano={12}>{v.version}</Mono>
                    {v.activa ? <Pastilla tono={TONO.verde}>ACTIVO</Pastilla> : <Pastilla tono={TONO.ambar}>CANDIDATO</Pastilla>}
                  </View>
                  <Text style={[texto.dato, { color: color.textoMedio, paddingLeft: 16 }]}>{v.origen}</Text>
                </View>
                <Mono tono={color.texto}>{m.n != null ? `${m.n} vtas (entren.)` : t ? `${t.n} vtas (vivo)` : '—'}</Mono>
                <Text style={[texto.datoFuerte, { color: esElegida ? color.primarioProfundo : color.texto, flex: 1, textAlign: 'right', fontFamily: MONO }]}>{pct(prec)}</Text>
                <Text style={[texto.datoFuerte, { color: esElegida ? color.primarioProfundo : color.texto, flex: 0.8, textAlign: 'right', fontFamily: MONO }]}>{pct(rec)}</Text>
                <Text style={[texto.datoFuerte, { color: esElegida ? color.primarioProfundo : color.texto, flex: 0.8, textAlign: 'right', fontFamily: MONO }]}>{aucV == null ? '—' : aucV.toFixed(3)}</Text>
                <Text style={[texto.datoFuerte, { color: esElegida ? color.primarioProfundo : color.texto, flex: 0.8, textAlign: 'right', fontFamily: MONO }]}>{f1 == null ? '—' : f1.toFixed(3)}</Text>
                <Text style={[texto.datoFuerte, { color: fpTasa != null && fpTasa > 0.1 ? '#8C4A2B' : color.primarioProfundo, flex: 0.8, textAlign: 'right', fontFamily: MONO }]}>{pct(fpTasa)}</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  {v.activa ? <View style={[e.fila, { gap: 4 }]}><IconoCheckCirculo tamano={13} color={color.primarioProfundo} /><Text style={[texto.dato, { color: color.textoMedio }]}>En uso</Text></View>
                    : <BotonChico onPress={() => activar(v)}>Activar</BotonChico>}
                </View>
              </View>
            )
          })}
          {elegida && (
            <View style={[e.panelGris, { flexDirection: 'row', alignItems: 'center', gap: espacio.md }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Detalle de la versión {elegida.version}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  Origen: {elegida.origen} · Avisa a partir de {Number(elegida.umbral_decision).toFixed(2)} · Entrenada: {elegida.entrenado_en ? new Date(elegida.entrenado_en).toLocaleDateString('es-PE') : '—'} · Visible para: {elegida.visible_para?.join(', ') || '—'}
                  {elegida.fuente ? `\nDatos de entrenamiento: ${elegida.fuente}` : ''}
                </Text>
              </View>
              <BotonChico onPress={() => aviso(`Métricas registradas · ${elegida.version}`, JSON.stringify(elegida.metricas ?? {}, null, 2) || 'Sin métricas registradas.')}>Ficha técnica</BotonChico>
            </View>
          )}
        </Caja>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Text style={[texto.dato, { color: color.textoSuave, flex: 1, minWidth: 280 }]}>Solo cuentan las predicciones que el modelo registró en su momento (RN-009-05). Una semana sin OLBI no se puede evaluar y queda fuera.</Text>
          <Mono tono={color.textoSuave}>Fuente: predicciones_evaluables · desempeno_modelo · calibracion_modelo · roc_auc_modelo()</Mono>
        </View>
      </ScrollView>
    </Panel>
  )
}

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

function Matriz({ total }: { total: { vp: number; fp: number; vn: number; fn: number; n: number } }) {
  const pctDe = (k: number, d: number) => (d ? `${((k / d) * 100).toFixed(1)}%` : '—')
  const Celda = ({ titulo, valor, nota, tono, icono }: { titulo: string; valor: number; nota: string; tono: 'verde' | 'gris' | 'tierra'; icono?: string }) => (
    <View style={[e.celdaMatriz, tono === 'verde' && { backgroundColor: '#EAF4EF' }, tono === 'tierra' && { backgroundColor: '#FBEDE6' }]}>
      <Text style={[texto.datoFuerte, { color: tono === 'tierra' ? '#8C4A2B' : tono === 'verde' ? color.primarioProfundo : color.texto, fontSize: 11 }]}>{titulo} {icono}</Text>
      <View style={[e.fila, { alignItems: 'baseline', gap: 4 }]}><Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 22 }]}>{valor}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>casos</Text></View>
      <Mono tono={tono === 'tierra' ? '#8C4A2B' : color.textoMedio} tamano={10}>{nota}</Mono>
    </View>
  )
  return (
    <View style={{ gap: 6 }}>
      <View style={[e.fila, { gap: 6 }]}>
        <View style={{ width: 44 }} />
        <View style={[e.cabMatriz, { flex: 1 }]}><Text style={[texto.datoFuerte, { color: color.texto, fontSize: 10.5, textAlign: 'center' }]}>REAL: AGOTADO (+)</Text></View>
        <View style={[e.cabMatriz, { flex: 1 }]}><Text style={[texto.datoFuerte, { color: color.texto, fontSize: 10.5, textAlign: 'center' }]}>REAL: NO AGOTADO (−)</Text></View>
      </View>
      <View style={[e.fila, { gap: 6, alignItems: 'stretch' }]}>
        <View style={[e.cabMatriz, { width: 44, justifyContent: 'center' }]}><Text style={[texto.datoFuerte, { color: color.texto, fontSize: 10.5, textAlign: 'center' }]}>PRED{'\n'}(+)</Text></View>
        <Celda titulo="VP (VERDADEROS +)" valor={total.vp} nota={`${pctDe(total.vp, total.vp + total.fp)} de las alertas`} tono="verde" icono="✓" />
        <Celda titulo="FP (FALSOS +)" valor={total.fp} nota={`${pctDe(total.fp, total.vp + total.fp)} de las alertas`} tono="gris" />
      </View>
      <View style={[e.fila, { gap: 6, alignItems: 'stretch' }]}>
        <View style={[e.cabMatriz, { width: 44, justifyContent: 'center' }]}><Text style={[texto.datoFuerte, { color: color.texto, fontSize: 10.5, textAlign: 'center' }]}>PRED{'\n'}(−)</Text></View>
        <Celda titulo="FN (FALSOS −)" valor={total.fn} nota={`${pctDe(total.fn, total.vp + total.fn)} no detectados`} tono="tierra" icono="⚠" />
        <Celda titulo="VN (VERDADEROS −)" valor={total.vn} nota={`${pctDe(total.vn, total.n)} del total`} tono="verde" icono="✓" />
      </View>
    </View>
  )
}

function Metrica({ rotulo, valor, n, k, texto: t, tinta = color.primarioProfundo }: { rotulo: string; valor: number | null; n: number; k: number; texto: string; tinta?: string }) {
  const ic = wilson(k, n)
  return (
    <Caja estilo={{ flex: 1, minWidth: 150, gap: 6 }}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><IconoInfo tamano={13} color={color.textoSuave} /></View>
      <View style={[e.fila, { alignItems: 'baseline', gap: 8 }]}>
        <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 26 }]}>{valor == null ? '—' : `${(Number(valor) * 100).toFixed(1)}%`}</Text>
        <Mono>n = {n}</Mono>
      </View>
      <Text style={[texto.dato, { color: color.textoMedio }]}>{t}</Text>
      <View style={[e.fila, { justifyContent: 'space-between' }]}><Mono>IC 95% Wilson:</Mono><Mono tono={color.texto}>{ic ? `${(ic[0] * 100).toFixed(1)}% – ${(ic[1] * 100).toFixed(1)}%` : '—'}</Mono></View>
      <View style={e.pista}><View style={[e.lleno, { width: `${Math.round(Number(valor ?? 0) * 100)}%`, backgroundColor: tinta }]} /></View>
    </Caja>
  )
}

/** De dónde salió cada OLBI evaluado. Sin esto la matriz parece una
 *  muestra de todo el equipo, y no lo es: a quien el modelo avisa se le mide
 *  siempre; a quien no, solo por sorteo (una de cada cuatro semanas), al mes
 *  sin medirse o tras un alta. */
const ORIGENES: { clave: string | null; titulo: string; nota: string }[] = [
  { clave: 'modelo', titulo: 'Avisó el modelo', nota: 'cruzó el corte tras un check-in' },
  { clave: 'sorteo', titulo: 'Sorteo', nota: 'una de cada cuatro semanas, al azar' },
  { clave: 'sin_medir', titulo: 'Un mes sin medirse', nota: 'control a quien nadie ha medido' },
  { clave: 'tras_alta', titulo: 'Tras un alta', nota: 'a los 14 días de cerrar el caso' },
  { clave: null, titulo: 'Antes del cambio', nota: 'cuando el OLBI era para todos los viernes' },
]
function Origen({ pares }: { pares: { senalado: boolean; motivo: string | null }[] }) {
  if (!pares.length) return null
  const filas = ORIGENES.map((o) => ({ ...o, n: pares.filter((p) => (p.motivo ?? null) === o.clave).length })).filter((o) => o.n > 0)
  const sinAviso = pares.filter((p) => !p.senalado && p.motivo != null).length
  return (
    <Caja estilo={{ gap: espacio.sm }}>
      <View>
        <Rotulo>De dónde sale cada OLBI evaluado</Rotulo>
        <Text style={[texto.dato, { color: color.textoMedio }]}>
          A quien el modelo avisa se le mide siempre. A quien no, solo por sorteo, al mes o tras un alta: por eso los fallos se ven en pocos casos.
        </Text>
      </View>
      <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
        {filas.map((o) => (
          <View key={o.titulo} style={e.origen}>
            <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 22 }]}>{o.n}</Text>
            <Text style={[texto.datoFuerte, { color: color.texto }]}>{o.titulo}</Text>
            <Text style={[texto.dato, { color: color.textoMedio, fontSize: 12 }]}>{o.nota}</Text>
          </View>
        ))}
      </View>
      {pares.some((p) => p.motivo != null) && (
        <Mono>{`Semanas sin aviso medidas desde el cambio: ${sinAviso}`}</Mono>
      )}
    </Caja>
  )
}

function Leyenda({ tinta, texto: t }: { tinta: string; texto: string }) {
  return <View style={[e.fila, { gap: 4 }]}><View style={{ width: 10, height: 2, backgroundColor: tinta }} /><Mono tono={tinta}>{t}</Mono></View>
}
function Vacio() {
  return <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><Text style={[texto.apoyo, { color: color.textoSuave, textAlign: 'center' }]}>Sin predicciones evaluables todavía.{'\n'}Aparecen cuando una predicción registrada se confronta con el OLBI de esa semana.</Text></View>
}

/** Intervalo de Wilson para una proporción k/n. */
function wilson(k: number, n: number): [number, number] | null {
  if (!n) return null
  const z = 1.96, p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
function semanaCorta(iso: string) { const d = new Date(`${iso}T12:00:00`); return `${d.getDate()}/${d.getMonth() + 1}` }
function delta(v: (number | null)[]) {
  const a = v.find((x) => x != null), b = [...v].reverse().find((x) => x != null)
  if (a == null || b == null || a === b) return '—'
  const d = (Number(b) - Number(a)) * 100
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)} pp`
}
function num(x: unknown): number | null { const n = Number(x); return x == null || Number.isNaN(n) ? null : n }
function pct(x: number | null) { return x == null ? '—' : `${(x * 100).toFixed(1)}%` }

const e = StyleSheet.create({
  veredicto: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, flexWrap: 'wrap', borderWidth: 1, borderRadius: radio.md, padding: espacio.base },
  cifraGrande: { ...texto.cifra, fontFamily: MONO, fontSize: 40, lineHeight: 44 },
  escudo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DDF3EA', alignItems: 'center', justifyContent: 'center' },
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  notaCohorte: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12, maxWidth: 300 },
  origen: { flex: 1, minWidth: 150, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 2 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  menu: { position: 'absolute', top: 66, left: 0, minWidth: 260, backgroundColor: color.superficie, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 30, elevation: 6 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10 },
  cuadroN: { backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'flex-end' },
  cabMatriz: { backgroundColor: '#F1EFEB', borderRadius: 6, padding: 8 },
  celdaMatriz: { flex: 1, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 2 },
  puntoVerde: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.primarioProfundo },
  pista: { height: 5, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden' },
  lleno: { height: 5, borderRadius: 3 },
  panelGris: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: 6 },
})

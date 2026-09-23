/** Desempeño del modelo — implementa ESP-009 RF-009-12 (RN-009-05).
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Desempeño del Modelo · Investigador Principal».
 *
 *  Todo se calcula sobre predicciones registradas en su momento y
 *  confrontadas con el OLBI objetivo (vista `predicciones_evaluables`):
 *  nunca se recalcula post-hoc con el modelo actual. */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro } from '../../modules/investigador/filtro'
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

export default function DesempenoModelo() {
  const { filtro } = useFiltro()
  const [tarea, setTarea] = useState<Tarea>('nowcast')
  const [versiones, setVersiones] = useState<VersionModelo[] | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [filas, setFilas] = useState<Desempeno[]>([])
  const [todas, setTodas] = useState<Desempeno[]>([])
  const [cal, setCal] = useState<Calibracion[]>([])
  const [auc, setAuc] = useState<number | null>(null)
  const [pares, setPares] = useState<{ probabilidad: number; resultado_real: boolean }[]>([])
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  const deTarea = useMemo(() => (versiones ?? []).filter((v) => v.tarea === tarea), [versiones, tarea])
  const activa = deTarea.find((v) => v.activa) ?? deTarea[0]
  const elegida = deTarea.find((v) => v.version === version) ?? activa

  const cargar = useCallback(async () => {
    const [vs, td, emps] = await Promise.all([cargarVersiones(), cargarDesempeno(tarea), listarEmpresas().catch(() => [] as Empresa[])])
    setVersiones(vs); setTodas(td)
    setEmpresa(emps.find((e) => e.id === filtro.organizacion_id) ?? null)
    const v = vs.filter((x) => x.tarea === tarea)
    const ver = v.find((x) => x.version === version) ?? v.find((x) => x.activa) ?? v[0]
    if (!ver) { setFilas([]); setCal([]); setAuc(null); setPares([]); return }
    setVersion(ver.version)
    const [f, c, a, p] = await Promise.all([cargarDesempeno(tarea, ver.version), cargarCalibracion(tarea, ver.version), rocAuc(tarea, ver.version), cargarEvaluables(tarea, ver.version)])
    setFilas(f); setCal(c); setAuc(a); setPares(p)
  }, [tarea, version, filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!versiones) return <Panel rol="investigador"><Cargando /></Panel>

  const total = filas.find((f) => f.semana === null) ?? { n: 0, vp: 0, fp: 0, vn: 0, fn: 0, precision: null, recall: null, especificidad: null, exactitud: null }
  const porSemana = filas.filter((f) => f.semana !== null).sort((a, b) => (a.semana! < b.semana! ? -1 : 1))
  const brier = pares.length ? pares.reduce((s, p) => s + (p.probabilidad - (p.resultado_real ? 1 : 0)) ** 2, 0) / pares.length : null
  const prevalencia = total.n ? (total.vp + total.fn) / total.n : null
  const umbral = elegida?.umbral_decision ?? 0.5
  const semanas = porSemana.map((f) => new Date(`${f.semana}T12:00:00`))
  const ventana = semanas.length ? `${semanas.length} semanas · ${total.n} ventanas` : `${total.n} ventanas`

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function activar(v: VersionModelo) {
    const ok = Platform.OS === 'web' ? window.confirm(`Activar ${v.version} para ${tarea === 'nowcast' ? 'nowcast' : 'pronóstico'}.\n\nLas predicciones nuevas se registrarán con esta versión. Las anteriores conservan la suya.`) : true
    if (!ok) return
    try { await activarVersion(v.version, tarea); cargar() } catch (e) { aviso('No se pudo activar', e instanceof Error ? e.message : '') }
  }

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow={`Auditoría de inferencia clínica · UNT Lab Salud  /  ID protocolo: ESP-009`} titulo="Evaluación Empírica y Rendimiento de Modelos"
          subtitulo="Métricas de validación prospectiva y rendimiento en tiempo real sobre la cohorte tech."
          derecha={(
            <View style={e.notaCohorte}>
              <IconoInfo tamano={14} color={color.primarioProfundo} />
              <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>
                {empresa ? <><Text style={texto.datoFuerte}>Subgrupo {empresa.nombre}.</Text> Las métricas del modelo se calculan sobre toda la cohorte: el filtro de empresa no las segmenta (RN-009-04).</>
                  : <><Text style={texto.datoFuerte}>Toda la cohorte.</Text> Cifras consolidadas sobre las predicciones registradas en su momento.</>}
              </Text>
            </View>
          )} />

        {/* Controles */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'flex-end' }]}>
          <View style={{ gap: 6 }}>
            <Rotulo>Horizonte de inferencia</Rotulo>
            <View style={e.segmentos}>
              {([['nowcast', 'Nowcast intra-semanal', '(L-J → Vie)'], ['pronostico', 'Pronóstico inter-semanal', '(Vie → Sem sig)']] as const).map(([k, t, s]) => (
                <Pressable key={k} onPress={() => { setTarea(k); setVersion(null) }} style={[e.segmento, tarea === k && e.segmentoActivo]}>
                  <Text style={[texto.datoFuerte, { color: tarea === k ? color.texto : color.textoMedio }]}>{t}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11 }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 6, zIndex: 20 }}>
            <Rotulo>Arquitectura evaluada</Rotulo>
            <Pressable onPress={() => setMenu((m) => !m)} style={e.selector}>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>{elegida ? `${elegida.activa ? 'Modelo activo' : 'Versión'}: ${elegida.version} (${elegida.origen})` : 'Sin versiones registradas'}</Text>
              <Text style={{ color: color.textoMedio }}>▾</Text>
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
            <Rotulo>Ventana longitudinal</Rotulo>
            <View style={e.selector}><Text style={[texto.datoFuerte, { color: color.texto }]}>Semanas {filtro.semanaDesde} a {filtro.semanaHasta}</Text><Mono>{ventana}</Mono></View>
          </View>
        </View>

        <View style={e.nota}>
          <IconoCandado tamano={13} color={color.primarioProfundo} />
          <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>
            <Text style={texto.datoFuerte}>Criterio prospectivo estricto: </Text>
            Calculado estrictamente con las predicciones registradas de manera prospectiva en su momento temporal; nunca recalculado post-hoc con el modelo actual.
          </Text>
        </View>

        {/* Bloque 1: matriz + métricas */}
        <View style={[e.fila, { alignItems: 'stretch', gap: espacio.base }]}>
          <Caja estilo={{ flex: 1, minWidth: 300, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Rotulo>Matriz diagnóstica 2×2</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>Desempeño Observado vs Inferencia</Text>
              </View>
              <View style={e.cuadroN}><Mono tono={color.textoMedio}>N =</Mono><Mono tono={color.texto}>{String(total.n)}</Mono></View>
            </View>
            <View style={[e.fila, { gap: 6 }]}><Text style={[texto.dato, { color: color.textoMedio }]}>Punto de corte probabilístico calibrado:</Text><Pastilla tono={TONO.gris} mono>{`τ ≥ ${umbral.toFixed(2)}`}</Pastilla></View>
            <Matriz total={total} />
            <View style={[e.fila, { justifyContent: 'space-between', paddingTop: 4 }]}>
              <View style={[e.fila, { gap: 6 }]}><View style={e.puntoVerde} /><Text style={[texto.dato, { color: color.textoMedio }]}>Casos esperados concordantes: <Mono tono={color.texto}>{total.vp + total.vn}</Mono></Text></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Prevalencia muestral: <Mono tono={color.texto}>{prevalencia == null ? '—' : `${(prevalencia * 100).toFixed(1)}%`}</Mono></Text>
            </View>
          </Caja>
          <View style={{ flex: 1.3, minWidth: 320, gap: espacio.base }}>
            <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
              <Metrica rotulo="Precisión (PPV)" valor={total.precision} n={total.vp + total.fp} k={total.vp} texto="Probabilidad de agotamiento confirmado ante una alerta generada." />
              <Metrica rotulo="Recall (Sensibilidad)" valor={total.recall} n={total.vp + total.fn} k={total.vp} texto="Capacidad de detección de casos reales de alto estrés agudo." tinta="#8C4A2B" />
            </View>
            <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
              <Metrica rotulo="Especificidad" valor={total.especificidad} n={total.vn + total.fp} k={total.vn} texto="Preservación de ventanas estables sin sobre-alertar al psicólogo." />
              <Caja estilo={{ flex: 1, minWidth: 150, gap: 6 }}>
                <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>Área bajo la curva (ROC-AUC)</Rotulo><IconoInfo tamano={13} color={color.textoSuave} /></View>
                <View style={[e.fila, { alignItems: 'baseline', gap: 8 }]}>
                  <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 26 }]}>{auc == null ? '—' : auc.toFixed(3)}</Text>
                  {auc != null && <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{auc >= 0.9 ? 'Excelente' : auc >= 0.8 ? 'Bueno' : auc >= 0.7 ? 'Aceptable' : 'Débil'}</Text>}
                </View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Poder discriminativo entre ventanas sintomáticas y eutímicas.</Text>
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
                <Rotulo>Dinámica temporal longitudinal</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>Precisión y Recall por Semana del Estudio</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Evolución prospectiva por semana objetivo. Cada punto usa solo las ventanas evaluables de esa semana.</Text>
              </View>
              <View style={[e.fila, { gap: 10 }]}><Leyenda tinta={color.primarioProfundo} texto="Precisión" /><Leyenda tinta="#8C4A2B" texto="Recall" /></View>
            </View>
            <View style={e.panelGris}>
              {porSemana.length === 0 ? <Vacio /> : (
                <GraficaLinea
                  series={[
                    { etiqueta: 'Precisión', color: color.primarioProfundo, puntos: porSemana.map((f) => ({ x: f.semana!, y: f.precision == null ? null : Number(f.precision) * 100 })) },
                    { etiqueta: 'Recall', color: '#8C4A2B', puntos: porSemana.map((f) => ({ x: f.semana!, y: f.recall == null ? null : Number(f.recall) * 100 })) },
                  ]}
                  yMin={40} yMax={100} alto={200} sinLeyenda todasLasEtiquetasX etiquetaX={(x) => `Sem ${semanaCorta(x)}`}
                />
              )}
            </View>
            <View style={[e.fila, { justifyContent: 'space-between' }]}>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Delta de recall (primera → última semana): <Mono tono={color.texto}>{delta(porSemana.map((f) => f.recall))}</Mono></Text>
              <Mono>Validación continua sin fuga de datos</Mono>
            </View>
          </Caja>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Rotulo>Confiabilidad bayesiana</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>Curva de Calibración de Probabilidades</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Dispersión decil a decil: probabilidad estimada vs tasa real observada en los OLBI del viernes.</Text>
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
              <Rotulo>{`Versiones registradas · ${tarea === 'nowcast' ? 'Nowcast' : 'Pronóstico'}`}</Rotulo>
              <Text style={[texto.seccion, { color: color.texto }]}>Comparativa de Arquitecturas</Text>
            </View>
            <Pastilla tono={TONO.verdeSuave} icono={<IconoEscudoCheck tamano={12} color={color.primarioProfundo} />}>{`Métricas en vivo sobre ${todas.filter((t) => t.semana === null).reduce((s, t) => s + t.n, 0)} ventanas evaluables`}</Pastilla>
          </View>
          <View style={e.tablaCab}>
            {[['Versión del modelo', 2.2], ['N entrenamiento', 1], ['Precisión (PPV)', 1], ['Recall', 0.8], ['AUC-ROC', 0.8], ['F1-score', 0.8], ['Tasa FP', 0.8], ['', 1]].map(([h, f]) => (
              <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f), textAlign: h === 'Versión del modelo' ? 'left' : 'right' }]}>{String(h).toUpperCase()}</Text>
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
                  <Text style={[texto.dato, { color: color.textoMedio, paddingLeft: 16 }]}>{v.notas ?? v.origen}</Text>
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
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Ficha de la versión {elegida.version}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  Origen: {elegida.origen} · Umbral de decisión τ = {Number(elegida.umbral_decision).toFixed(2)} · Entrenada: {elegida.entrenada_en ? new Date(elegida.entrenada_en).toLocaleDateString('es-PE') : '—'} · Visible para: {elegida.visible_para?.join(', ') || '—'}
                  {elegida.notas ? `\n${elegida.notas}` : ''}
                </Text>
              </View>
              <BotonChico onPress={() => aviso(`Métricas registradas · ${elegida.version}`, JSON.stringify(elegida.metricas ?? {}, null, 2) || 'Sin métricas registradas.')}>Ficha técnica</BotonChico>
            </View>
          )}
        </Caja>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Text style={[texto.dato, { color: color.textoSuave, flex: 1, minWidth: 280 }]}>Validación prospectiva para el protocolo ESP-009. Solo predicciones registradas en su momento (RN-009-05); las ventanas sin OLBI objetivo no cuentan.</Text>
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

function Leyenda({ tinta, texto: t }: { tinta: string; texto: string }) {
  return <View style={[e.fila, { gap: 4 }]}><View style={{ width: 10, height: 2, backgroundColor: tinta }} /><Mono tono={tinta}>{t}</Mono></View>
}
function Vacio() {
  return <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><Text style={[texto.apoyo, { color: color.textoSuave, textAlign: 'center' }]}>Sin predicciones evaluables todavía.{'\n'}Aparecen cuando una predicción registrada se confronta con el OLBI de su viernes objetivo.</Text></View>
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
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  notaCohorte: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12, maxWidth: 300 },
  segmentos: { flexDirection: 'row', backgroundColor: '#F1EFEB', borderRadius: 8, padding: 3 },
  segmento: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  segmentoActivo: { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde },
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

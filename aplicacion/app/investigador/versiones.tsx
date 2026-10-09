/** Versiones del modelo — implementa ESP-009 RF-009-11.
 *
 *  El producto usa un solo modelo: el que, tras cada check-in, estima con
 *  los días de la semana que van si la persona está cruzando el umbral, y
 *  si pasa del corte le pide el OLBI ese mismo día. Ya no hay «OLBI del
 *  viernes» ni «check-ins de lunes a jueves», que es lo que decía antes.
 *
 *  El pronóstico de la semana siguiente sigue guardado, pero el producto no
 *  lo usa: salía como «Ninguna versión activa» en rojo, como si faltara
 *  algo. Ahora es una línea al pie, sin botón para activarlo, porque
 *  activarlo añadiría un bloque al resultado del trabajador.
 *
 *  Activar una versión no toca las predicciones ya registradas: cada una
 *  lleva la suya (RN-009-05). */

import { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import { activarVersion, versiones as cargarVersiones, type VersionModelo } from '../../modules/investigador/panel'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCheckCirculo, IconoGrafica, IconoHoja } from '../../modules/nucleo/iconos'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/** Qué hace el modelo en el producto, dicho sin jerga. */
const TAREAS = [
  { tarea: 'nowcast' as const, titulo: 'Cuándo pedir el cuestionario', nota: 'Tras cada check-in estima, con los días de la semana que van, si la persona está cruzando el umbral de burnout. Si pasa del corte, le pide el OLBI ese mismo día.' },
]

export default function Versiones() {
  const { filtro } = useFiltro()
  const [lista, setLista] = useState<VersionModelo[] | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const cargar = useCallback(async () => setLista(await cargarVersiones()), [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function activar(v: VersionModelo) {
    const ok = Platform.OS === 'web' ? window.confirm(`Activar ${v.version}.\n\nDesde ahora las predicciones nuevas de esta tarea se registran con ella. Las ya registradas conservan la suya.`) : true
    if (!ok) return
    try { await activarVersion(v.version, v.tarea); cargar() } catch (e) { aviso('No se pudo activar', e instanceof Error ? e.message : '') }
  }

  if (!lista) return <Panel rol="investigador"><Cargando /></Panel>

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Modelo · ESP-009" titulo="Versiones del modelo"
          subtitulo="El modelo que decide a quién pedirle el cuestionario, con qué se entrenó y qué tal le fue entonces."
          derecha={<BotonChico onPress={() => router.push(conFiltro('/investigador/desempeno', filtro) as never)} icono={<IconoGrafica tamano={13} color={color.texto} />}>Ver cómo va ahora</BotonChico>} />

        {TAREAS.map((t) => {
          const filas = lista.filter((v) => v.tarea === t.tarea)
          const activa = filas.find((v) => v.activa)
          const otras = filas.filter((v) => !v.activa)
          return (
            <Caja key={t.tarea} estilo={{ gap: espacio.base }}>
              <View>
                <Rotulo>Predice</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>{t.titulo}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{t.nota}</Text>
              </View>

              {!activa ? (
                <View style={e.sinActiva}>
                  <Text style={[texto.cuerpoFuerte, { color: '#8C4A2B' }]}>Ninguna versión activa</Text>
                  <Text style={[texto.dato, { color: '#8C4A2B' }]}>Sin una versión activa nadie recibe el cuestionario por el modelo; solo por sorteo, al mes sin medirse o tras un alta.</Text>
                </View>
              ) : (
                <View style={e.activa}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <View style={[e.fila, { gap: 8 }]}>
                      <IconoCheckCirculo tamano={15} color={color.primarioProfundo} />
                      <Mono tono={color.texto} tamano={14}>{activa.version}</Mono>
                      <Pastilla tono={TONO.verde}>En uso</Pastilla>
                    </View>
                    <Mono>{activa.entrenado_en ? `Entrenada el ${new Date(activa.entrenado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Sin fecha de entrenamiento'}</Mono>
                  </View>

                  <View style={[e.fila, { gap: espacio.lg, alignItems: 'flex-start' }]}>
                    <Cifra rotulo="Pide el OLBI desde" valor={Number(activa.umbral_decision).toFixed(2)}
                      apoyo="de probabilidad" />
                    <Metricas m={(activa.metricas?.global as Record<string, unknown>) ?? activa.metricas ?? {}} />
                  </View>

                  {activa.fuente && (
                    <View style={e.fuente}>
                      <IconoHoja tamano={14} color={color.primarioProfundo} />
                      <View style={{ flex: 1, minWidth: 220 }}>
                        <Rotulo>Entrenada con</Rotulo>
                        <Text style={[texto.dato, { color: color.texto }]}>{activa.fuente}</Text>
                      </View>
                    </View>
                  )}

                  <Pressable onPress={() => setAbierta(abierta === activa.version ? null : activa.version)}>
                    <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>
                      {abierta === activa.version ? 'Ocultar todas las métricas ⌃' : 'Ver todas las métricas ⌄'}
                    </Text>
                  </Pressable>
                  {abierta === activa.version && (
                    <TodasLasMetricas m={activa.metricas ?? {}} />
                  )}
                </View>
              )}

              {otras.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Rotulo>{`${otras.length} ${otras.length === 1 ? 'versión guardada' : 'versiones guardadas'}, sin usar`}</Rotulo>
                  {otras.map((v) => (
                    <View key={v.version} style={e.otra}>
                      <Mono tono={color.texto} tamano={12}>{v.version}</Mono>
                      <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 120 }]}>{v.origen}</Text>
                      <Mono>{v.entrenado_en ? new Date(v.entrenado_en).toLocaleDateString('es-PE') : '—'}</Mono>
                      <BotonChico onPress={() => activar(v)}>Poner en uso</BotonChico>
                    </View>
                  ))}
                </View>
              )}
            </Caja>
          )
        })}

        {lista.some((v) => v.tarea === 'pronostico') && (
          <View style={e.otra}>
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 220 }]}>
              {`También hay ${lista.filter((v) => v.tarea === 'pronostico').length === 1 ? 'una versión guardada' : 'versiones guardadas'} del pronóstico de la semana siguiente. El producto no lo usa.`}
            </Text>
            <Mono>{lista.filter((v) => v.tarea === 'pronostico').map((v) => v.version).join(', ')}</Mono>
          </View>
        )}

        <Text style={[texto.dato, { color: color.textoSuave }]}>
          Cambiar de versión no recalcula nada hacia atrás: cada predicción conserva la versión con la que se hizo (RN-009-05). Las cifras de aquí son las del entrenamiento; cómo va con datos reales está en Desempeño.
        </Text>
      </ScrollView>
    </Panel>
  )
}

/** Las métricas que dejó el entrenamiento, con su nombre en llano. */
function Metricas({ m }: { m: Record<string, unknown> }) {
  const num = (k: string) => (typeof m[k] === 'number' ? Number(m[k]) : null)
  const campos: { k: string; rotulo: string; apoyo: string; dec?: number }[] = [
    { k: 'roc_auc', rotulo: 'Ordena bien', apoyo: '1 es perfecto, 0,5 es azar' },
    { k: 'recall', rotulo: 'Pilla a', apoyo: 'de los que sí cruzaron' },
    { k: 'precision', rotulo: 'Acierta en', apoyo: 'de los que señaló' },
    { k: 'n', rotulo: 'Con', apoyo: 'semanas de entrenamiento', dec: 0 },
  ]
  const hay = campos.filter((c) => num(c.k) != null)
  if (hay.length === 0) return <Text style={[texto.dato, { color: color.textoSuave }]}>Sin métricas de entrenamiento.</Text>
  return (
    <View style={[e.fila, { gap: espacio.lg, flex: 1, minWidth: 260 }]}>
      {hay.map((c) => {
        const v = num(c.k) as number
        const esPct = c.k === 'recall' || c.k === 'precision'
        return <Cifra key={c.k} rotulo={c.rotulo} apoyo={c.apoyo}
          valor={c.dec === 0 ? v.toLocaleString('es-PE') : esPct ? `${Math.round(v * 100)}%` : v.toFixed(3)} />
      })}
    </View>
  )
}

/** El detalle del entrenamiento como tabla. Antes era el JSON tal cual en
 *  una caja de alto fijo, y el texto se salía por encima del pie. */
function TodasLasMetricas({ m }: { m: Record<string, unknown> }) {
  const g = ((m.global as Record<string, unknown>) ?? m) as Record<string, unknown>
  const dias = (m.por_dias_respondidos as Record<string, Record<string, number>>) ?? {}
  const n = (v: unknown, pct = false) => (typeof v === 'number' ? (pct ? `${Math.round(v * 100)}%` : v.toFixed(3)) : '—')
  const generales: [string, string, string][] = [
    ['Ordena bien', n(g.roc_auc), 'ROC-AUC'],
    ['Pilla a', n(g.recall, true), 'recall'],
    ['Acierta en', n(g.precision, true), 'precisión'],
    ['F1', n(g.f1), 'equilibrio de las dos anteriores'],
    ['PR-AUC', n(g.pr_auc), 'útil cuando los positivos son pocos'],
    ['Brier', n(g.brier), 'error de la probabilidad; menos es mejor'],
    ['Positivos', n(g.positivos, true), 'semanas que cruzaron el umbral'],
  ]
  const filasDias = Object.keys(dias).sort()
  if (!Object.keys(m).length) return <Text style={[texto.dato, { color: color.textoSuave }]}>Sin métricas registradas.</Text>
  return (
    <View style={e.detalle}>
      <View style={{ gap: 4 }}>
        {generales.filter(([, v]) => v !== '—').map(([r, v, nota]) => (
          <View key={r} style={e.filaTabla}>
            <Text style={[texto.dato, { color: color.texto, width: 110 }]}>{r}</Text>
            <Text style={{ fontFamily: MONO, fontSize: 13, color: color.texto, width: 70 }}>{v}</Text>
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 160 }]}>{nota}</Text>
          </View>
        ))}
      </View>
      {filasDias.length > 0 && (
        <View style={{ gap: 4 }}>
          <Rotulo>Según cuántos días de la semana lleva respondidos</Rotulo>
          <View style={[e.filaTabla, e.cabezaTabla]}>
            {['Días', 'Ordena bien', 'Pilla a', 'Acierta en'].map((c) => (
              <Text key={c} style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{c}</Text>
            ))}
          </View>
          {filasDias.map((d) => (
            <View key={d} style={e.filaTabla}>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: color.texto, flex: 1 }}>{d}</Text>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: color.texto, flex: 1 }}>{n(dias[d].roc_auc)}</Text>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: color.texto, flex: 1 }}>{n(dias[d].recall, true)}</Text>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: color.texto, flex: 1 }}>{n(dias[d].precision, true)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function Cifra({ rotulo, valor, apoyo }: { rotulo: string; valor: string; apoyo: string }) {
  return (
    <View style={{ minWidth: 92, gap: 1 }}>
      <Rotulo>{rotulo}</Rotulo>
      <Text style={[texto.cuerpoFuerte, { color: color.texto, fontFamily: MONO }]}>{valor}</Text>
      <Text style={[texto.dato, { color: color.textoMedio, fontSize: 12 }]}>{apoyo}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  activa: { backgroundColor: '#F7F6F3', borderRadius: radio.md, borderWidth: 1, borderColor: '#E6E3DE', padding: espacio.base, gap: espacio.sm },
  sinActiva: { backgroundColor: '#FBEDE6', borderRadius: radio.md, padding: espacio.base, gap: 2 },
  fuente: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: color.superficie, borderRadius: 8, padding: 10, flexWrap: 'wrap' },
  detalle: { backgroundColor: color.superficie, borderRadius: 8, borderWidth: 1, borderColor: '#E6E3DE', padding: 12, gap: espacio.base },
  filaTabla: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap', paddingVertical: 2 },
  cabezaTabla: { borderBottomWidth: 1, borderBottomColor: '#E6E3DE', paddingBottom: 4 },
  otra: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F7F6F3', flexWrap: 'wrap' },
})

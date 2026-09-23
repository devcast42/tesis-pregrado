/** Versiones del modelo — implementa ESP-009 RF-009-11.
 *
 *  Registro de cada versión (nowcast y pronóstico): origen, umbral de
 *  decisión, para quién es visible, métricas guardadas al entrenar y si es
 *  la activa. Activar una versión no toca las predicciones ya registradas:
 *  cada una lleva la suya (RN-009-05). */

import { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import { activarVersion, versiones as cargarVersiones, type VersionModelo } from '../../modules/investigador/panel'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCheckCirculo, IconoGrafica } from '../../modules/nucleo/iconos'

export default function Versiones() {
  const { filtro } = useFiltro()
  const [lista, setLista] = useState<VersionModelo[] | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const cargar = useCallback(async () => setLista(await cargarVersiones()), [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function activar(v: VersionModelo) {
    const ok = Platform.OS === 'web' ? window.confirm(`Activar ${v.version} para ${v.tarea}.\n\nDesde ahora las predicciones nuevas de esta tarea se registran con ${v.version}. Las ya registradas conservan su versión.`) : true
    if (!ok) return
    try { await activarVersion(v.version, v.tarea); cargar() } catch (e) { aviso('No se pudo activar', e instanceof Error ? e.message : '') }
  }

  if (!lista) return <Panel rol="investigador"><Cargando /></Panel>

  const grupos: { tarea: VersionModelo['tarea']; titulo: string; nota: string }[] = [
    { tarea: 'nowcast', titulo: 'Nowcast intra-semanal (L–J → viernes)', nota: 'Con los check-ins de lunes a jueves estima si el OLBI del viernes cruzará el umbral.' },
    { tarea: 'pronostico', titulo: 'Pronóstico inter-semanal (viernes → semana siguiente)', nota: 'Con la semana cerrada proyecta el OLBI del viernes siguiente.' },
  ]

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Modelo · registro de versiones" titulo="Versiones del Modelo Predictivo"
          subtitulo="Cada versión lleva su origen, umbral de decisión, visibilidad y métricas de entrenamiento. Solo una está activa por tarea."
          derecha={<BotonChico onPress={() => router.push(conFiltro('/investigador/desempeno', filtro) as never)} icono={<IconoGrafica tamano={13} color={color.texto} />}>Ver desempeño en vivo</BotonChico>} />

        {grupos.map((g) => {
          const filas = lista.filter((v) => v.tarea === g.tarea)
          return (
            <Caja key={g.tarea} estilo={{ gap: espacio.sm }}>
              <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <Rotulo>{g.tarea}</Rotulo>
                  <Text style={[texto.seccion, { color: color.texto }]}>{g.titulo}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>{g.nota}</Text>
                </View>
                <Pastilla tono={TONO.gris} mono>{`${filas.length} versión${filas.length === 1 ? '' : 'es'}`}</Pastilla>
              </View>
              <View style={e.tablaCab}>
                {[['Versión', 2], ['Origen', 1], ['Umbral τ', 0.8], ['Entrenada', 1], ['Visible para', 1.4], ['Métricas', 1.6], ['Estado', 1.2]].map(([h, f]) => (
                  <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
                ))}
              </View>
              {filas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 10 }]}>Sin versiones registradas para esta tarea.</Text>}
              {filas.map((v) => {
                const m = v.metricas ?? {}
                // Las métricas de entrenamiento viven en metricas.global (ESP-005); se aceptan también planas.
                const g: Record<string, unknown> = (m.global as Record<string, unknown>) ?? m
                const resumen = ['roc_auc', 'precision', 'recall', 'f1', 'n'].filter((k) => g[k] != null).map((k) => `${k === 'n' ? 'n' : k.replace('_', '-')} ${typeof g[k] === 'number' ? Number(g[k]).toFixed(k === 'n' ? 0 : 3) : String(g[k])}`).join(' · ')
                const desplegada = abierta === v.version
                return (
                  <View key={v.version}>
                    <Pressable onPress={() => setAbierta(desplegada ? null : v.version)} style={[e.tablaFila, v.activa && { backgroundColor: '#F5F4F1' }]}>
                      <View style={{ flex: 2, gap: 2 }}>
                        <View style={[e.fila, { gap: 6 }]}><View style={[e.punto, { backgroundColor: v.activa ? color.primarioProfundo : '#BDB8B1' }]} /><Mono tono={color.texto} tamano={12}>{v.version}</Mono></View>
                        {v.notas ? <Text style={[texto.dato, { color: color.textoMedio, paddingLeft: 13 }]} numberOfLines={desplegada ? undefined : 1}>{v.notas}</Text> : null}
                      </View>
                      <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>{v.origen}</Text>
                      <Mono tono={color.texto}>{Number(v.umbral_decision).toFixed(2)}</Mono>
                      <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>{v.entrenada_en ? new Date(v.entrenada_en).toLocaleDateString('es-PE') : '—'}</Text>
                      <View style={[e.fila, { flex: 1.4, gap: 4 }]}>{(v.visible_para ?? []).map((q) => <Pastilla key={q} tono={TONO.gris}>{q}</Pastilla>)}</View>
                      <Mono tono={color.textoMedio}>{resumen || '—'}</Mono>
                      <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                        {v.activa ? <View style={[e.fila, { gap: 4 }]}><IconoCheckCirculo tamano={13} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>Activa</Text></View>
                          : <BotonChico onPress={() => activar(v)}>Activar</BotonChico>}
                      </View>
                    </Pressable>
                    {desplegada && (
                      <View style={e.detalle}>
                        <Rotulo>Métricas registradas al entrenar</Rotulo>
                        <Text style={{ fontFamily: MONO, fontSize: 11, color: color.texto }} selectable>{Object.keys(m).length ? JSON.stringify(m, null, 2) : 'Sin métricas registradas.'}</Text>
                        <Text style={[texto.dato, { color: color.textoSuave }]}>Las métricas en vivo (sobre predicciones registradas y confrontadas) están en Desempeño.</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </Caja>
          )
        })}
        <Text style={[texto.dato, { color: color.textoSuave }]}>Activar una versión no recalcula nada: cada predicción registrada conserva la versión con la que se hizo (RN-009-05). El cambio queda en la tabla de versiones con su fecha.</Text>
      </ScrollView>
    </Panel>
  )
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  punto: { width: 7, height: 7, borderRadius: 4 },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: radio.sm },
  detalle: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 12, gap: 6, marginTop: 4 },
})

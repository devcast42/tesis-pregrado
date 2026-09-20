/** Cohorte semanal — implementa ESP-009 RF-009-07.
 *
 *  Una fila por semana calendario del filtro activo (todas las empresas o
 *  una): cuántos estaban inscritos, cuántos respondieron el viernes, media
 *  OLBI, % alto y los factores declarados (horas, sueño, fin de semana,
 *  sobretiempo, guardias, apoyo del líder). Sin mínimo de reporte para el
 *  investigador (RN-009-04). */

import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro } from '../../modules/investigador/filtro'
import { cohorte as cargarCohorte, fechaCorta, type CohorteSemana } from '../../modules/investigador/panel'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { Caja, Cifra, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoEquipo, IconoGrafica, IconoPersona, IconoTendenciaArriba } from '../../modules/nucleo/iconos'

const UMBRAL_AGOTAMIENTO = 2.875

export default function Cohorte() {
  const { filtro } = useFiltro()
  const [filas, setFilas] = useState<CohorteSemana[] | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([cargarCohorte(filtro), listarEmpresas().catch(() => [] as Empresa[])])
    setFilas(c); setEmpresas(e)
  }, [filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const empresa = empresas.find((e) => e.id === filtro.organizacion_id)
  const ultima = filas[filas.length - 1]
  const n = (x: number | null | undefined) => (x == null ? null : Number(x))
  const f1 = (x: number | null | undefined) => (x == null ? '—' : Number(x).toFixed(1))
  const f2 = (x: number | null | undefined) => (x == null ? '—' : Number(x).toFixed(2))
  const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(Number(x) * (Number(x) <= 1 ? 100 : 1))}%`)
  const etiquetaSemana = (iso: string) => `S${filas.findIndex((f) => f.semana === iso) + 1}`

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow={`Cohorte · ${empresa ? empresa.nombre : 'todas las empresas'}`} titulo="Evolución Semanal de la Cohorte"
          subtitulo="Inscripción, respuesta del viernes, OLBI medio y factores declarados, semana a semana. Sin mínimo de reporte: aquí se ve todo (RN-009-04)."
          derecha={<Pastilla tono={TONO.gris} mono>{`${filas.length} semanas con datos`}</Pastilla>} />

        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Cifra rotulo="Inscritos (última semana)" valor={String(ultima?.inscritos ?? 0)} nota={`${ultima?.activos ?? 0} activos`} icono={<IconoEquipo tamano={18} color={color.primarioProfundo} />} />
          <Cifra rotulo="Respondieron el viernes" valor={String(ultima?.respondieron_viernes ?? 0)} nota={ultima?.activos ? `${Math.round((ultima.respondieron_viernes / ultima.activos) * 100)}% de activos` : undefined} icono={<IconoPersona tamano={18} color={color.primarioProfundo} />} />
          <Cifra rotulo="OLBI agotamiento (media)" valor={f2(ultima?.olbi_agotamiento_media)} nota={`umbral ${UMBRAL_AGOTAMIENTO}`} tinta={n(ultima?.olbi_agotamiento_media) != null && n(ultima?.olbi_agotamiento_media)! >= UMBRAL_AGOTAMIENTO ? '#8C4A2B' : color.texto} icono={<IconoGrafica tamano={18} color="#8C4A2B" />} fondoIcono="#FBEDE6" />
          <Cifra rotulo="% sobre el umbral" valor={pct(ultima?.pct_alto)} nota={`${ultima?.detectados ?? 0} detectados`} tinta="#8C4A2B" icono={<IconoTendenciaArriba tamano={18} color="#8C4A2B" />} fondoIcono="#FBEDE6" />
        </View>

        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 1.2, minWidth: 320, gap: espacio.sm }}>
            <Rotulo>Trayectoria OLBI de la cohorte</Rotulo>
            <Text style={[texto.seccion, { color: color.texto }]}>Agotamiento y desvinculación medios por semana</Text>
            {filas.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin OLBI del viernes en este corte.</Text> : (
              <GraficaLinea
                series={[
                  { etiqueta: 'Agotamiento', color: '#8C4A2B', puntos: filas.map((f) => ({ x: f.semana, y: n(f.olbi_agotamiento_media) })) },
                  { etiqueta: 'Desvinculación', color: color.primarioProfundo, puntos: filas.map((f) => ({ x: f.semana, y: n(f.olbi_desvinculacion_media) })) },
                ]}
                yMin={1} yMax={4} alto={220} umbral={UMBRAL_AGOTAMIENTO} umbralEtiqueta="Umbral agotamiento" todasLasEtiquetasX etiquetaX={etiquetaSemana}
              />
            )}
          </Caja>
          <Caja estilo={{ flex: 1, minWidth: 300, gap: espacio.sm }}>
            <Rotulo>Participación y detección</Rotulo>
            <Text style={[texto.seccion, { color: color.texto }]}>% sobre el umbral y respuesta del viernes</Text>
            {filas.length === 0 ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin datos.</Text> : (
              <GraficaLinea
                series={[
                  { etiqueta: '% alto', color: '#8C4A2B', puntos: filas.map((f) => ({ x: f.semana, y: f.pct_alto == null ? null : Number(f.pct_alto) * (Number(f.pct_alto) <= 1 ? 100 : 1) })) },
                  { etiqueta: '% respondieron', color: color.primarioProfundo, puntos: filas.map((f) => ({ x: f.semana, y: f.activos ? Math.round((f.respondieron_viernes / f.activos) * 100) : null })) },
                ]}
                yMin={0} yMax={100} alto={220} todasLasEtiquetasX etiquetaX={etiquetaSemana}
              />
            )}
          </Caja>
        </View>

        <Caja estilo={{ gap: 4 }}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View><Rotulo>Tabla semanal</Rotulo><Text style={[texto.seccion, { color: color.texto }]}>Factores declarados y estado de la cohorte</Text></View>
            <Mono>Fuente: cohorte_semanal</Mono>
          </View>
          <View style={e.tablaCab}>
            {['Semana', 'Inscritos', 'Activos', 'Detect.', 'Retir.', 'Viernes', 'Agot.', 'Desv.', '% alto', 'Horas/día', 'Sueño', 'Fin de sem.', 'Sobretiempo', 'Guardia', 'Apoyo líder'].map((h, i) => (
              <Text key={h} style={[texto.etiqueta, { color: i === 6 ? '#8C4A2B' : i === 7 ? color.primarioProfundo : color.textoMedio, fontSize: 9, flex: i === 0 ? 1.3 : 1, textAlign: i === 0 ? 'left' : 'right' }]}>{h.toUpperCase()}</Text>
            ))}
          </View>
          {filas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 10 }]}>Sin semanas con datos para este corte.</Text>}
          {filas.map((f, i) => {
            const alto = n(f.olbi_agotamiento_media) != null && n(f.olbi_agotamiento_media)! >= UMBRAL_AGOTAMIENTO
            const celda = (v: string, tinta: string = color.texto, fuerte = false) => <Text style={[fuerte ? texto.datoFuerte : texto.dato, { color: tinta, flex: 1, textAlign: 'right', fontFamily: MONO }]}>{v}</Text>
            return (
              <View key={f.semana} style={[e.tablaFila, alto && { backgroundColor: '#FBEDE6' }]}>
                <View style={{ flex: 1.3 }}><Text style={[texto.datoFuerte, { color: color.texto }]}>S{i + 1}</Text><Mono>{fechaCorta(`${f.semana}T12:00:00`)}</Mono></View>
                {celda(String(f.inscritos))}{celda(String(f.activos))}{celda(String(f.detectados), f.detectados ? '#8C4A2B' : color.texto, !!f.detectados)}{celda(String(f.retirados))}{celda(String(f.respondieron_viernes))}
                {celda(f2(f.olbi_agotamiento_media), alto ? '#8C4A2B' : color.texto, alto)}{celda(f2(f.olbi_desvinculacion_media))}{celda(pct(f.pct_alto), alto ? '#8C4A2B' : color.texto)}
                {celda(f1(f.horas_dia_media))}{celda(f1(f.sueno_media))}{celda(f1(f.fin_de_semana_media))}{celda(f1(f.sobretiempo_media))}{celda(pct(f.guardia_pct))}{celda(f1(f.apoyo_lider_media))}
              </View>
            )
          })}
          <Text style={[texto.dato, { color: color.textoSuave, paddingTop: 8 }]}>Medias sobre quienes respondieron esa semana. Horas y sueño vienen del check-in diario; sobretiempo, guardia y apoyo del líder, del formulario semanal. Una fila en tierra indica agotamiento medio sobre el umbral.</Text>
        </Caja>
      </ScrollView>
    </Panel>
  )
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: radio.sm },
})

/** Resumen del estudio — implementa ESP-006 RF-006-09 y ESP-009 RF-009-04.
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Resumen · Investigador Principal».
 *
 *  Es lo que el investigador enseña a su asesor: los tres indicadores de la
 *  tesis con su fórmula visible, la cohorte semana a semana, la adherencia
 *  por empresa, el embudo del circuito, el modelo activo y la distribución
 *  del último OLBI. Todo por código; nada clínico; nada rojo. */

import { useCallback, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import {
  adherenciaGlobal, circuito as cargarCircuito, cohorte as cargarCohorte, desempeno as cargarDesempeno, mediana, participantes as cargarParticipantes,
  versiones as cargarVersiones, type CircuitoApoyo, type CohorteSemana, type Desempeno, type FilaParticipanteV2, type VersionModelo,
} from '../../modules/investigador/panel'
import { adherenciaPorEmpresa, type AdherenciaEmpresa } from '../../modules/investigador/datos'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCheckCirculo, IconoEscudoCheck, IconoInfo, IconoNota } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const META_ADHERENCIA = 0.8
const LIMITE_CIRCUITO = 3

export default function Resumen() {
  const { filtro } = useFiltro()
  const [datos, setDatos] = useState<{
    cohorte: CohorteSemana[]; adherencia: { cumplidos: number; esperados: number; n: number }; empresas: AdherenciaEmpresa[]
    circuito: CircuitoApoyo[]; participantes: FilaParticipanteV2[]; versiones: VersionModelo[]; desempeno: Desempeno[]
  } | null>(null)

  const cargar = useCallback(async () => {
    const [cohorte, adherencia, empresas, circuito, participantes, versiones, dNow, dPro] = await Promise.all([
      cargarCohorte(filtro), adherenciaGlobal(filtro), adherenciaPorEmpresa().catch(() => [] as AdherenciaEmpresa[]), cargarCircuito(filtro),
      cargarParticipantes(filtro), cargarVersiones(), cargarDesempeno('nowcast'), cargarDesempeno('pronostico'),
    ])
    setDatos({ cohorte, adherencia, empresas: filtro.organizacion_id ? empresas.filter((e) => e.organizacion_id === filtro.organizacion_id) : empresas, circuito, participantes, versiones, desempeno: [...dNow, ...dPro] })
  }, [filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!datos) return <Panel rol="investigador"><Cargando /></Panel>
  const { cohorte, adherencia, empresas, circuito, participantes, versiones, desempeno } = datos

  const semanas = cohorte.slice(-8)
  const ultima = semanas[semanas.length - 1]
  const nSemana = semanas.length
  const tasaAdh = adherencia.esperados ? adherencia.cumplidos / adherencia.esperados : null
  // pct_alto viene en 0–100 (cohorte_semanal).
  const detectadosSemana = ultima?.pct_alto != null && ultima.respondieron_viernes ? Math.round((Number(ultima.pct_alto) / 100) * ultima.respondieron_viernes) : 0
  const tasaDeteccion = ultima?.respondieron_viernes ? detectadosSemana / ultima.respondieron_viernes : null
  const tiempos = circuito.map((c) => c.detectado_en && c.primera_sesion_en ? (new Date(c.primera_sesion_en).getTime() - new Date(c.detectado_en).getTime()) / 86_400_000 : null)
  const medCircuito = mediana(tiempos)
  const ordenados = tiempos.filter((t): t is number => t != null).sort((a, b) => a - b)
  const q = (p: number) => (ordenados.length ? ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))] : null)
  const mediaEmpresas = empresas.length ? empresas.reduce((s, e) => s + Number(e.tasa_promedio ?? 0), 0) / empresas.length : null
  const activos = participantes.filter((p) => p.estado === 'activo' || p.estado === 'detectado')
  const detectados = participantes.filter((p) => p.detectado_en).length
  const embudo = [
    { n: 1, titulo: 'Detectados por Modelo / OLBI', nota: 'Puntaje sostenido de agotamiento', valor: detectados },
    { n: 2, titulo: 'Derivados a Gabinete Psicológico', nota: 'Notificación y consentimiento remitido', valor: circuito.filter((c) => c.origen === 'deteccion').length },
    { n: 3, titulo: 'Con Cita Agendada', nota: 'Horario confirmado con profesional', valor: circuito.filter((c) => c.cita_confirmada_en).length },
    { n: 4, titulo: 'Con Sesión Realizada', nota: 'Intervención clínica de contención', valor: circuito.filter((c) => c.primera_sesion_en).length },
    { n: 5, titulo: 'Con Informe Aprobado', nota: 'Documentación ética anonimizada', valor: circuito.filter((c) => c.informe_aprobado_en).length },
  ]
  const niveles = { bajo: 0, a_vigilar: 0, alto: 0 } as Record<string, number>
  for (const p of participantes) if (p.olbi_nivel) niveles[p.olbi_nivel] = (niveles[p.olbi_nivel] ?? 0) + 1
  const conOlbi = niveles.bajo + niveles.a_vigilar + niveles.alto
  const activa = (t: string) => versiones.find((v) => v.tarea === t && v.activa)
  const totalDe = (t: string) => desempeno.find((d) => d.tarea === t && d.semana === null && d.version === activa(t)?.version)
  const pct = (x: number | null | undefined, d = 1) => (x == null ? '—' : `${(Number(x) * 100).toFixed(d)}%`)

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <View style={[e.fila, { gap: 8 }]}>
          <View style={e.pastillaProtocolo}><Text style={[texto.datoFuerte, { color: color.primarioProfundo, fontSize: 10.5, letterSpacing: 0.8 }]}>PROTOCOLO ESP-009 · CORTE SEMANA {nSemana || '—'}</Text></View>
          <Mono>UNT · Lab de Salud Digital</Mono>
        </View>
        <Encabezado eyebrow="Resumen ejecutivo" titulo="Resumen Ejecutivo del Estado del Estudio"
          subtitulo="Consolidado epidemiológico, adherencia al monitoreo ecológico momentáneo (EMA) y desempeño del circuito de contención clínica en cohortes de tecnología."
          derecha={<View style={e.asesor}><View><Rotulo>Corte de datos</Rotulo><Text style={[texto.datoFuerte, { color: color.texto, textAlign: 'right' }]}>{new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</Text></View><View style={e.cuadroIcono}><IconoNota tamano={18} color={color.primarioProfundo} /></View></View>} />

        {/* Tres indicadores de la tesis */}
        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Indicador rotulo="Adherencia longitudinal" valor={pct(tasaAdh)} etiqueta={`Meta ≥ ${META_ADHERENCIA * 100}%`} tonoEtiqueta={tasaAdh != null && tasaAdh >= META_ADHERENCIA ? TONO.gris : TONO.ambar}
            n={`n = ${adherencia.n} en seguimiento`}
            formula={<Text style={e.formula}><Text style={{ color: color.primarioProfundo }}>Σ días con check-in: {adherencia.cumplidos.toLocaleString('es-PE')}</Text> / días hábiles esperados: {adherencia.esperados.toLocaleString('es-PE')}</Text>}
            pie={`Ventana consolidada: semanas ${filtro.semanaDesde} → ${filtro.semanaHasta}`} />
          <Indicador rotulo="Tasa de detección semanal" valor={pct(tasaDeteccion)} etiqueta={`${detectadosSemana} casos S${nSemana || '—'}`} tonoEtiqueta={detectadosSemana ? TONO.tierraSuave : TONO.gris} tinta={detectadosSemana ? '#8C4A2B' : color.texto}
            n={`n = ${detectadosSemana} detectados`}
            formula={<Text style={e.formula}><Text style={{ color: '#8C4A2B' }}>Participantes con OLBI sobre el umbral: {detectadosSemana}</Text> / cuestionarios del viernes: {ultima?.respondieron_viernes ?? 0}</Text>}
            pie={`Punto de corte individual (ESP-003) · última semana con OLBI`} />
          <Indicador rotulo="Tiempo de respuesta del circuito" valor={medCircuito == null ? '—' : medCircuito.toFixed(1)} sufijo="días" etiqueta={`Protocolo < ${LIMITE_CIRCUITO.toFixed(1)} d`} tonoEtiqueta={medCircuito != null && medCircuito > LIMITE_CIRCUITO ? TONO.ambar : TONO.gris}
            n={`n = ${ordenados.length} derivaciones con sesión`}
            formula={<Text style={e.formula}><Text style={{ color: color.primarioProfundo }}>Mediana (fecha detección → fecha 1ª sesión)</Text></Text>}
            pie={ordenados.length ? `Rango intercuartílico: ${q(0.25)?.toFixed(1)} – ${q(0.75)?.toFixed(1)} d · ${medCircuito != null && medCircuito <= LIMITE_CIRCUITO ? 'cumple protocolo' : 'fuera de protocolo'}` : 'Sin sesiones registradas todavía'} />
        </View>

        {/* Cohorte por semana + semana en curso */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 2, minWidth: 380, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, minWidth: 260 }}><Rotulo>Dinámica longitudinal de cohorte</Rotulo><Text style={[texto.seccion, { color: color.texto }]}>Distribución de Participantes por Semana (S1 → S{nSemana || 6})</Text></View>
              <View style={[e.fila, { gap: 10 }]}><Leyenda tinta={color.primarioProfundo} texto="Activos" /><Leyenda tinta="#8C4A2B" texto="Detectados" /><Leyenda tinta="#8A8580" texto="Retirados" /><Leyenda tinta="#E4E1DC" texto="Finalizados" /></View>
            </View>
            {semanas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Semana 1 del estudio: la cohorte aparecerá aquí cuando haya inscritos.</Text>}
            {semanas.map((s, i) => {
              const esUltima = i === semanas.length - 1
              const total = Math.max(1, s.inscritos)
              const seg = (n: number, c: string) => n > 0 ? <View style={{ flex: n, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>{esUltima && <Text style={{ color: c === '#E4E1DC' ? color.texto : '#FFFFFF', fontSize: 9, fontFamily: MONO }}>{n}</Text>}</View> : null
              return (
                <View key={s.semana} style={[{ gap: 4 }, esUltima && e.semanaActual]}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <View style={[e.fila, { gap: 8 }]}><Text style={[texto.datoFuerte, { color: esUltima ? color.primarioProfundo : color.texto }]}>S{i + 1}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{esUltima ? 'Corte actual' : i === 0 ? 'Línea base e inscripción' : `Semana del ${new Date(`${s.semana}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`}</Text>{esUltima && <Pastilla tono={TONO.verde}>VIGENTE</Pastilla>}</View>
                    <Mono tono={color.texto}>{s.activos + s.detectados} / {s.inscritos} ({Math.round(((s.activos + s.detectados) / total) * 100)}%)</Mono>
                  </View>
                  <View style={[e.barraApilada, esUltima && { height: 18 }]}>
                    {seg(s.activos, color.primarioProfundo)}{seg(s.detectados, '#8C4A2B')}{seg(s.retirados, '#8A8580')}{seg(s.finalizados, '#E4E1DC')}
                  </View>
                </View>
              )
            })}
            {ultima && (
              <View style={[e.fila, { justifyContent: 'space-between', paddingTop: 4 }]}>
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Retención: {ultima.inscritos ? Math.round(((ultima.activos + ultima.detectados) / ultima.inscritos) * 100) : 0}% de los inscritos siguen activos al corte.</Text>
                <Mono>Pérdida acumulada: {ultima.inscritos ? ((ultima.retirados / ultima.inscritos) * 100).toFixed(2) : '0.00'}%</Mono>
              </View>
            )}
          </Caja>
          <View style={[e.tarjetaVerde, { flex: 1, minWidth: 250 }]}>
            <View style={[e.fila, { justifyContent: 'space-between' }]}><View style={e.pastillaClara}><Text style={[texto.datoFuerte, { color: '#FFFFFF', fontSize: 10.5 }]}>SEMANA EN CURSO S{nSemana || '—'}</Text></View>{ultima && <Mono tono="#DDF3EA">{new Date(`${ultima.semana}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</Mono>}</View>
            <Text style={[texto.dato, { color: '#DDF3EA' }]}>Tasa de respuesta efectiva del viernes</Text>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={[texto.cifra, { color: '#FFFFFF', fontFamily: MONO, fontSize: 34 }]}>{ultima?.activos ? `${((ultima.respondieron_viernes / ultima.activos) * 100).toFixed(1)}%` : '—'}</Text><Text style={[texto.dato, { color: '#DDF3EA' }]}>de participantes activos</Text></View>
            <FilaVerde k="Participantes inscritos:" v={String(ultima?.inscritos ?? participantes.length)} />
            <FilaVerde k="Activos completando EMA:" v={String(activos.length)} />
            <FilaVerde k="Detectados con alerta activa:" v={`${participantes.filter((p) => p.estado === 'detectado').length} (${participantes.length ? ((participantes.filter((p) => p.estado === 'detectado').length / participantes.length) * 100).toFixed(1) : 0}%)`} tierra />
            <FilaVerde k="Retiros acumulados:" v={`${participantes.filter((p) => p.estado === 'retirado').length} (${participantes.length ? ((participantes.filter((p) => p.estado === 'retirado').length / participantes.length) * 100).toFixed(1) : 0}%)`} />
            <View style={e.notaVerde}><IconoEscudoCheck tamano={13} color="#DDF3EA" /><Text style={[texto.dato, { color: '#DDF3EA', flex: 1 }]}>{participantes.length >= 30 ? 'Suficiencia estadística alcanzada para validación cruzada k-fold según protocolo.' : `Con ${participantes.length} participantes la validación del modelo es exploratoria (n < 30).`}</Text></View>
          </View>
        </View>

        {/* Adherencia por empresa + embudo */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}><Rotulo>Desagregación por organización</Rotulo><Text style={[texto.seccion, { color: color.texto }]}>Adherencia EMA por Empresa</Text></View>
              <Mono tono={color.primarioProfundo}>Media global: {pct(mediaEmpresas)}</Mono>
            </View>
            {[...empresas].sort((a, b) => Number(b.tasa_promedio ?? 0) - Number(a.tasa_promedio ?? 0)).map((em) => {
              const t = em.tasa_promedio == null ? null : Number(em.tasa_promedio)
              const bajo = t != null && t < META_ADHERENCIA
              return (
                <View key={em.organizacion_id} style={{ gap: 4 }}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <View style={[e.fila, { gap: 8 }]}><Text style={[texto.datoFuerte, { color: color.texto }]}>{em.nombre}</Text>{bajo && <Pastilla tono={TONO.ambar}>Bajo la meta</Pastilla>}</View>
                    <Mono tono={bajo ? '#B45309' : color.primarioProfundo}>{pct(t)} <Mono tono={color.textoSuave}>(n={em.participantes_activos})</Mono></Mono>
                  </View>
                  <View style={e.pista}>
                    <View style={[e.lleno, { width: `${(t ?? 0) * 100}%`, backgroundColor: bajo ? '#B45309' : color.primarioProfundo }]} />
                    {mediaEmpresas != null && <View style={[e.marcaMedia, { left: `${mediaEmpresas * 100}%` }]} />}
                  </View>
                </View>
              )
            })}
            {empresas.length === 0 && <Text style={[texto.dato, { color: color.textoMedio }]}>Sin empresas con participantes activos.</Text>}
            {empresas.some((em) => em.tasa_promedio != null && Number(em.tasa_promedio) < META_ADHERENCIA) && (
              <View style={e.notaAmbar}><Text style={[texto.dato, { color: '#8A5A12' }]}>⚠ {empresas.filter((em) => em.tasa_promedio != null && Number(em.tasa_promedio) < META_ADHERENCIA).map((em) => em.nombre).join(', ')} por debajo de la meta de adherencia: conviene revisar los recordatorios con su administrador (sin penalización).</Text></View>
            )}
          </Caja>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}><Rotulo>Trazabilidad clínica y soporte</Rotulo><Text style={[texto.seccion, { color: color.texto }]}>Embudo del Circuito de Derivación</Text></View>
              <Mono>Corte acumulado S{nSemana || '—'}</Mono>
            </View>
            {embudo.map((paso, i) => {
              const previo = i === 0 ? null : embudo[i - 1].valor
              const conv = previo ? (paso.valor / previo) * 100 : null
              return (
                <View key={paso.n} style={{ gap: 4 }}>
                  {i > 0 && <Mono tono={color.textoSuave} tamano={10}>   ↓ Conversión: {conv == null ? '—' : `${conv.toFixed(1)}%`}</Mono>}
                  <View style={[e.pasoEmbudo, i === embudo.length - 1 && { backgroundColor: '#EAF4EF' }]}>
                    <View style={[e.numero, i === embudo.length - 1 && { backgroundColor: color.primarioProfundo }]}><Text style={[texto.datoFuerte, { color: i === embudo.length - 1 ? '#FFFFFF' : color.texto, fontSize: 11 }]}>{paso.n}</Text></View>
                    <View style={{ flex: 1 }}><Text style={[texto.datoFuerte, { color: color.texto }]}>{paso.titulo}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{paso.nota}</Text></View>
                    <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 18 }]}>{paso.valor}</Text>
                    <Pastilla tono={TONO.verdeSuave} mono>{embudo[0].valor ? `${((paso.valor / embudo[0].valor) * 100).toFixed(1)}%` : '—'}</Pastilla>
                  </View>
                </View>
              )
            })}
          </Caja>
        </View>

        {/* Modelos + distribución OLBI */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <View style={{ flex: 2, minWidth: 380, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View><Rotulo>Arquitectura predictiva</Rotulo><Text style={[texto.seccion, { color: color.texto }]}>Modelos Activos por Tarea de Detección</Text></View>
              <Pastilla tono={TONO.gris} mono>Motor: regresión logística + reglas OLBI</Pastilla>
            </View>
            <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
              {(['nowcast', 'pronostico'] as const).map((t) => {
                const v = activa(t), d = totalDe(t)
                return (
                  <Caja key={t} estilo={{ flex: 1, minWidth: 220, gap: 8 }}>
                    <View style={[e.fila, { justifyContent: 'space-between' }]}>
                      <View style={[e.fila, { gap: 6 }]}><View style={[e.punto, { backgroundColor: t === 'nowcast' ? color.primarioProfundo : '#8C4A2B' }]} /><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{t === 'nowcast' ? 'Nowcast Intra-semanal' : 'Pronóstico Inter-semanal'}</Text></View>
                      <Pastilla tono={TONO.gris} mono>{v?.version ?? 'sin versión activa'}</Pastilla>
                    </View>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>{t === 'nowcast' ? 'Predicción en tiempo real de sobrecarga emocional acumulada lunes–jueves antes del corte formal del viernes.' : 'Anticipación a 7 días de trayectorias de desapego cínico y agotamiento físico a partir de variabilidad en EMA.'}</Text>
                    <View style={e.metricas}>
                      <Metrica rotulo="Umbral τ" valor={v ? Number(v.umbral_decision).toFixed(2) : '—'} />
                      <Metrica rotulo="Precisión" valor={pct(d?.precision)} />
                      <Metrica rotulo="Recall" valor={pct(d?.recall)} />
                    </View>
                    <View style={[e.fila, { justifyContent: 'space-between' }]}>
                      <Mono>{v ? `${v.origen} · ${d ? `${d.n} ventanas` : 'sin evaluar'}` : '—'}</Mono>
                      <Pressable onPress={() => router.push(conFiltro('/investigador/desempeno', filtro) as never)}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>Ver desempeño →</Text></Pressable>
                    </View>
                  </Caja>
                )
              })}
            </View>
          </View>
          <Caja estilo={{ flex: 1, minWidth: 260, gap: espacio.sm }}>
            <Rotulo>Tamizaje psicométrico</Rotulo>
            <Text style={[texto.seccion, { color: color.texto }]}>Distribución Último OLBI</Text>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Evaluación multidimensional de agotamiento y desvinculación por participante (última aplicación).</Text>
            {([['bajo', 'Nivel Bajo', 'Bajo ambos umbrales', color.primarioProfundo, '#F5F4F1'], ['a_vigilar', 'A Vigilar', 'A menos de 0.5 del umbral', '#E4E1DC', '#F5F4F1'], ['alto', 'Nivel Alto (Riesgo)', 'Sobre el umbral individual', '#8C4A2B', '#FBEDE6']] as const).map(([k, t, s, c, f]) => (
              <View key={k} style={[e.nivel, { backgroundColor: f }]}>
                <View style={[e.punto, { backgroundColor: c }]} />
                <View style={{ flex: 1 }}><Text style={[texto.datoFuerte, { color: k === 'alto' ? '#8C4A2B' : color.texto }]}>{t}</Text><Mono>{s}</Mono></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={[texto.cifra, { color: k === 'alto' ? '#8C4A2B' : color.texto, fontFamily: MONO, fontSize: 18 }]}>{niveles[k]}</Text><Mono>{conOlbi ? `${((niveles[k] / conOlbi) * 100).toFixed(1)}%` : '—'}</Mono></View>
              </View>
            ))}
            <View style={[e.fila, { justifyContent: 'space-between' }]}><Mono>Escala: Oldenburg Burnout Inventory</Mono><Mono tono={color.texto}>n = {conOlbi}</Mono></View>
          </Caja>
        </View>

        <View style={e.piePagina}>
          <View style={[e.fila, { gap: 8, flex: 1 }]}><IconoCheckCirculo tamano={14} color={color.primarioProfundo} /><Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Indicadores leídos de las vistas del estudio (`adherencia`, `cohorte_semanal`, `circuito_apoyo`, `desempeno_modelo`); nunca recalculados a mano. Solo códigos anónimos.</Text></View>
          <BotonChico onPress={() => router.push(conFiltro('/investigador/exportacion', filtro) as never)} tono="suave">Exportar corte</BotonChico>
        </View>
      </ScrollView>
    </Panel>
  )
}

function Indicador({ rotulo, valor, sufijo, etiqueta, tonoEtiqueta, tinta = color.texto, n, formula, pie }: {
  rotulo: string; valor: string; sufijo?: string; etiqueta: string; tonoEtiqueta: { fondo: string; tinta: string }; tinta?: string; n: string; formula: React.ReactNode; pie: string
}) {
  return (
    <Caja estilo={{ flex: 1, minWidth: 260, gap: 8 }}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><IconoInfo tamano={14} color={color.textoSuave} /></View>
      <View style={[e.fila, { alignItems: 'baseline', gap: 8 }]}>
        <Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 32 }]}>{valor}</Text>
        {sufijo && <Text style={[texto.dato, { color: color.textoMedio }]}>{sufijo}</Text>}
        <Pastilla tono={tonoEtiqueta}>{etiqueta}</Pastilla>
      </View>
      <View style={e.cajaFormula}>
        <View style={[e.fila, { justifyContent: 'space-between' }]}><Mono tono={color.textoMedio}>FÓRMULA DE TESIS:</Mono><Mono>{n}</Mono></View>
        {formula}
        <Text style={[texto.dato, { color: color.textoMedio }]}>{pie}</Text>
      </View>
    </Caja>
  )
}
function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <View style={{ flex: 1, alignItems: 'center' }}><Rotulo>{rotulo}</Rotulo><Text style={[texto.datoFuerte, { color: color.texto, fontFamily: MONO, fontSize: 14 }]}>{valor}</Text></View>
}
function FilaVerde({ k, v, tierra }: { k: string; v: string; tierra?: boolean }) {
  return <View style={e.filaVerde}><Text style={[texto.dato, { color: '#FFFFFF', flex: 1 }]}>{k}</Text><Text style={[texto.datoFuerte, { color: tierra ? '#F3DDD2' : '#FFFFFF', fontFamily: MONO }]}>{v}</Text></View>
}
function Leyenda({ tinta, texto: t }: { tinta: string; texto: string }) {
  return <View style={[e.fila, { gap: 5 }]}><View style={[e.punto, { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio }]}>{t}</Text></View>
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  pastillaProtocolo: { backgroundColor: '#DDF3EA', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  asesor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cuadroIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  cajaFormula: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 4 },
  formula: { ...texto.dato, color: color.texto, fontFamily: MONO },
  semanaActual: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, marginHorizontal: -6 },
  barraApilada: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', backgroundColor: '#EDEBE7' },
  tarjetaVerde: { backgroundColor: color.primarioProfundo, borderRadius: radio.md, padding: espacio.md, gap: 8 },
  pastillaClara: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  filaVerde: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8, padding: 10 },
  notaVerde: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: 10, marginTop: 4 },
  pista: { height: 8, borderRadius: 4, backgroundColor: '#EDEBE7', overflow: 'visible' },
  lleno: { height: 8, borderRadius: 4 },
  marcaMedia: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: color.texto },
  notaAmbar: { backgroundColor: '#FBEFD9', borderRadius: 8, padding: 10 },
  pasoEmbudo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10 },
  numero: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E4E1DC', alignItems: 'center', justifyContent: 'center' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  metricas: { flexDirection: 'row', backgroundColor: '#F5F4F1', borderRadius: 8, padding: 8 },
  nivel: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, padding: 10 },
  piePagina: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: 12, flexWrap: 'wrap' },
})

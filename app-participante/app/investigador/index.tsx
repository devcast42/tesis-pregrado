/** Resumen del estudio — implementa ESP-006 RF-006-09 y ESP-009 RF-009-04.
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Resumen · Investigador Principal».
 *
 *  Es la pantalla que se le enseña al asesor, así que responde en orden:
 *  ¿se cumplen los tres indicadores de la tesis?, ¿cuánta gente sigue?,
 *  ¿responde el circuito?, ¿qué tal va el modelo?
 *
 *  Los tres indicadores conservan su fórmula a la vista, que es lo que pide
 *  RF-009-04, pero escrita para leerse: antes decía «Σ días con check-in /
 *  días hábiles esperados» y ahora dice qué se dividió entre qué.
 *
 *  Todo por código; nada clínico; nada rojo. */

import { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import {
  adherenciaGlobal, circuito as cargarCircuito, citasEstudio, cohorte as cargarCohorte, desempeno as cargarDesempeno, mediana,
  participantes as cargarParticipantes, versiones as cargarVersiones, adherenciaPorEmpresa,
  type AdherenciaEmpresa, type CircuitoApoyo, type CitaEstudio, type CohorteSemana, type Desempeno, type FilaParticipanteV2, type VersionModelo,
} from '../../modules/investigador/panel'
import { BotonChico, Caja, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCheckCirculo, IconoEscudoCheck, IconoNota } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const META_ADHERENCIA = 0.8
const LIMITE_CIRCUITO = 3
const MINIMO_PARA_CONCLUIR = 30
const TIERRA = '#8C4A2B'
const AMBAR = '#8A5A12'

export default function Resumen() {
  const { filtro } = useFiltro()
  const [datos, setDatos] = useState<{
    cohorte: CohorteSemana[]; adherencia: { cumplidos: number; esperados: number; n: number }; empresas: AdherenciaEmpresa[]
    circuito: CircuitoApoyo[]; citas: CitaEstudio[]; participantes: FilaParticipanteV2[]; versiones: VersionModelo[]; desempeno: Desempeno[]
  } | null>(null)

  useDatosDelFiltro(() => setDatos(null), async (vigente) => {
    const [cohorte, adherencia, empresas, circuito, citas, participantes, versiones, dNow, dPro] = await Promise.all([
      cargarCohorte(filtro), adherenciaGlobal(filtro), adherenciaPorEmpresa().catch(() => [] as AdherenciaEmpresa[]), cargarCircuito(filtro),
      citasEstudio(filtro).catch(() => [] as CitaEstudio[]), cargarParticipantes(filtro), cargarVersiones(), cargarDesempeno('nowcast'), cargarDesempeno('pronostico'),
    ])
    if (!vigente()) return
    setDatos({
      cohorte, adherencia, circuito, citas, participantes, versiones, desempeno: [...dNow, ...dPro],
      empresas: filtro.organizacion_id ? empresas.filter((e) => e.organizacion_id === filtro.organizacion_id) : empresas,
    })
  }, [filtro.organizacion_id])

  if (!datos) return <Panel rol="investigador"><Cargando /></Panel>
  const { cohorte, adherencia, empresas, circuito, citas, participantes, versiones, desempeno } = datos

  const semanas = cohorte.slice(-8)
  const ultima = semanas[semanas.length - 1]
  const nSemana = semanas.length
  const tasaAdh = adherencia.esperados ? adherencia.cumplidos / adherencia.esperados : null

  // pct_alto viene en 0–100 (cohorte_semanal) y es de ESA semana, no acumulado.
  const cruzaronEsaSemana = ultima?.pct_alto != null && ultima.respondieron_viernes ? Math.round((Number(ultima.pct_alto) / 100) * ultima.respondieron_viernes) : 0
  const tasaCruce = ultima?.respondieron_viernes ? cruzaronEsaSemana / ultima.respondieron_viernes : null

  const tiempos = circuito.map((c) => c.detectado_en && c.primera_sesion_en ? (new Date(c.primera_sesion_en).getTime() - new Date(c.detectado_en).getTime()) / 86_400_000 : null)
  const medCircuito = mediana(tiempos)
  const ordenados = tiempos.filter((t): t is number => t != null).sort((a, b) => a - b)
  const q = (p: number) => (ordenados.length ? ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))] : null)

  const mediaEmpresas = empresas.length ? empresas.reduce((s, e) => s + Number(e.tasa_promedio ?? 0), 0) / empresas.length : null
  const bajoLaMeta = empresas.filter((em) => em.tasa_promedio != null && Number(em.tasa_promedio) < META_ADHERENCIA)

  // Quien está detectado ya no responde el diario: su seguimiento terminó por
  // diseño (RN-007-04) y la vista `adherencia` tampoco lo incluye. Contarlo
  // aquí hacía decir «57 activos completando EMA» habiendo 53.
  const activos = participantes.filter((p) => p.estado === 'activo').length
  const detectadosAhora = participantes.filter((p) => p.estado === 'detectado').length
  const retirados = participantes.filter((p) => p.estado === 'retirado').length
  const cruzaronAlguna = participantes.filter((p) => p.detectado_en).length

  /** El paso «consiguieron cita» no sale de `circuito_apoyo`: esa vista se
   *  calcula desde `eventos`, y la semilla de demostración nunca emite
   *  `cita_confirmada` —solo `cita_solicitada`—, así que `cita_confirmada_en`
   *  es null para todos y el embudo enseñaba «0 con cita» habiendo una
   *  confirmada y dos ya atendidas. Aquí se cuenta desde `citas_estudio`,
   *  que sí lleva el estado real de cada cita. */
  const conCita = new Set(citas.filter((c) => c.estado === 'confirmada' || c.estado === 'atendida').map((c) => c.participante_id)).size

  const embudo = [
    { titulo: 'Cruzaron el umbral', nota: 'su OLBI del viernes pasó el corte del estudio', valor: cruzaronAlguna },
    { titulo: 'Se les asignó psicólogo', nota: 'la derivación se abrió sola, o la pidieron', valor: circuito.length },
    { titulo: 'Consiguieron cita', nota: 'confirmada por el psicólogo, o ya atendida', valor: conCita },
    { titulo: 'Tuvieron la sesión', nota: 'llegaron a hablar con el profesional', valor: circuito.filter((c) => c.primera_sesion_en).length },
    { titulo: 'Informe cerrado', nota: 'el psicólogo dio el caso por terminado', valor: circuito.filter((c) => c.informe_aprobado_en).length },
  ]

  const niveles = { bajo: 0, a_vigilar: 0, alto: 0 } as Record<string, number>
  for (const p of participantes) if (p.olbi_nivel) niveles[p.olbi_nivel] = (niveles[p.olbi_nivel] ?? 0) + 1
  const conOlbi = niveles.bajo + niveles.a_vigilar + niveles.alto

  const activa = (t: string) => versiones.find((v) => v.tarea === t && v.activa)
  const totalDe = (t: string) => desempeno.find((d) => d.tarea === t && d.semana === null && d.version === activa(t)?.version)
  const pct = (x: number | null | undefined, d = 1) => (x == null ? '—' : `${(Number(x) * 100).toFixed(d)}%`)
  /** Quien responde el viernes puede estar detectado o haber terminado, así
   *  que el denominador honesto son las personas inscritas. Dividiendo entre
   *  las activas salían semanas con «106 %». */
  const respuestaViernes = ultima?.inscritos ? ultima.respondieron_viernes / ultima.inscritos : null

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View style={{ gap: 4, flex: 1, minWidth: 280 }}>
            <Rotulo>Resumen del estudio · ESP-009</Rotulo>
            <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>Cómo va el estudio</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 640 }]}>
              {`Las tres cifras que hay que sostener ante el jurado, y de dónde salen. ${participantes.length} personas inscritas, ${nSemana || '—'} ${nSemana === 1 ? 'semana' : 'semanas'} de seguimiento.`}
            </Text>
          </View>
          <View style={[e.fila, { gap: 10 }]}>
            <View><Rotulo>Datos al</Rotulo><Text style={[texto.datoFuerte, { color: color.texto, textAlign: 'right' }]}>{new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</Text></View>
            <View style={e.cuadroIcono}><IconoNota tamano={18} color={color.primarioProfundo} /></View>
          </View>
        </View>

        {/* Los tres indicadores de la tesis, con su fórmula a la vista. */}
        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Indicador
            rotulo="Cuánto responde la gente"
            valor={pct(tasaAdh)}
            veredicto={tasaAdh == null ? 'sin datos todavía' : tasaAdh >= META_ADHERENCIA ? `cumple la meta de ${META_ADHERENCIA * 100}%` : `por debajo de la meta de ${META_ADHERENCIA * 100}%`}
            cumple={tasaAdh != null && tasaAdh >= META_ADHERENCIA}
            calculo={`${adherencia.cumplidos.toLocaleString('es-PE')} días respondidos ÷ ${adherencia.esperados.toLocaleString('es-PE')} días que tocaban`}
            pie={`Todo el seguimiento acumulado, sobre las ${adherencia.n} personas activas.`} />

          <Indicador
            rotulo="Cuántas cruzaron el umbral la última semana"
            valor={pct(tasaCruce)}
            veredicto={cruzaronEsaSemana === 0 ? 'ninguna, ese viernes' : `${cruzaronEsaSemana} ${cruzaronEsaSemana === 1 ? 'persona' : 'personas'} ese viernes`}
            cumple={cruzaronEsaSemana === 0}
            tinta={cruzaronEsaSemana ? TIERRA : color.texto}
            calculo={`${cruzaronEsaSemana} con el OLBI sobre el corte ÷ ${ultima?.respondieron_viernes ?? 0} que contestaron ese viernes`}
            pie={`Corte individual de ESP-003. Es de esa semana, no acumulado: en total han cruzado ${cruzaronAlguna}.`} />

          <Indicador
            rotulo="Cuánto tarda el circuito en responder"
            valor={medCircuito == null ? '—' : medCircuito.toFixed(1)}
            sufijo="días"
            veredicto={medCircuito == null ? 'sin sesiones todavía' : medCircuito <= LIMITE_CIRCUITO ? `dentro del límite de ${LIMITE_CIRCUITO} días` : `pasa el límite de ${LIMITE_CIRCUITO} días`}
            cumple={medCircuito != null && medCircuito <= LIMITE_CIRCUITO}
            calculo="Mediana de los días entre cruzar el umbral y la primera sesión"
            pie={ordenados.length
              ? `Sobre ${ordenados.length} ${ordenados.length === 1 ? 'derivación que llegó a sesión' : 'derivaciones que llegaron a sesión'}; la mitad central va de ${q(0.25)?.toFixed(1)} a ${q(0.75)?.toFixed(1)} días.`
              : 'Todavía nadie ha llegado a la primera sesión.'} />
        </View>

        {/* Quién sigue en el estudio */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 2, minWidth: 380, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Rotulo>Quién sigue, semana a semana</Rotulo>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Cada barra es una semana; su largo, la gente inscrita hasta entonces.</Text>
              </View>
              <View style={[e.fila, { gap: 10 }]}>
                <Leyenda tinta={color.primarioProfundo} texto="En seguimiento" /><Leyenda tinta={TIERRA} texto="Detectadas" />
                <Leyenda tinta="#8A8580" texto="Retiradas" /><Leyenda tinta="#E4E1DC" texto="Terminadas" />
              </View>
            </View>
            {semanas.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay semanas con datos: aparecerán cuando alguien conteste su primer OLBI del viernes.</Text>}
            {semanas.map((s, i) => {
              const esUltima = i === semanas.length - 1
              const total = Math.max(1, s.inscritos)
              const siguen = s.activos + s.detectados
              const seg = (n: number, c: string) => n > 0 ? <View style={{ flex: n, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>{esUltima && <Text style={{ color: c === '#E4E1DC' ? color.texto : '#FFFFFF', fontSize: 9, fontFamily: MONO }}>{n}</Text>}</View> : null
              return (
                <View key={s.semana} style={[{ gap: 4 }, esUltima && e.semanaActual]}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <View style={[e.fila, { gap: 8 }]}>
                      <Text style={[texto.datoFuerte, { color: esUltima ? color.primarioProfundo : color.texto }]}>{`Semana ${i + 1}`}</Text>
                      <Text style={[texto.dato, { color: color.textoMedio }]}>{rangoSemana(s.semana)}</Text>
                      {esUltima && <Pastilla tono={TONO.verde}>la más reciente</Pastilla>}
                    </View>
                    <Mono tono={color.texto}>{`${siguen} de ${s.inscritos} (${Math.round((siguen / total) * 100)}%)`}</Mono>
                  </View>
                  <View style={[e.barraApilada, esUltima && { height: 18 }]}>
                    {seg(s.activos, color.primarioProfundo)}{seg(s.detectados, TIERRA)}{seg(s.retirados, '#8A8580')}{seg(s.finalizados, '#E4E1DC')}
                  </View>
                </View>
              )
            })}
            {ultima && (
              <Text style={[texto.dato, { color: color.textoMedio, paddingTop: 4 }]}>
                {`Sigue en el estudio el ${ultima.inscritos ? Math.round(((ultima.activos + ultima.detectados) / ultima.inscritos) * 100) : 0}% de quienes se inscribieron`}
                {ultima.retirados ? `; se retiraron ${ultima.retirados}.` : '; nadie se ha retirado.'}
                {' Quien está detectado sigue contando: cruzó el umbral, no abandonó.'}
              </Text>
            )}
          </Caja>

          <View style={[e.tarjetaVerde, { flex: 1, minWidth: 250 }]}>
            <View style={[e.fila, { justifyContent: 'space-between' }]}>
              <View style={e.pastillaClara}><Text style={[texto.datoFuerte, { color: '#FFFFFF', fontSize: 10.5 }]}>LA ÚLTIMA SEMANA</Text></View>
              {ultima && <Mono tono="#DDF3EA">{rangoSemana(ultima.semana)}</Mono>}
            </View>
            <Text style={[texto.dato, { color: '#DDF3EA' }]}>Contestaron el OLBI del viernes</Text>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}>
              <Text style={[texto.cifra, { color: '#FFFFFF', fontFamily: MONO, fontSize: 34 }]}>{respuestaViernes == null ? '—' : `${Math.round(respuestaViernes * 100)}%`}</Text>
              <Text style={[texto.dato, { color: '#DDF3EA' }]}>{ultima ? `${ultima.respondieron_viernes} de ${ultima.inscritos}` : ''}</Text>
            </View>
            <FilaVerde k="Inscritas en total" v={String(participantes.length)} />
            <FilaVerde k="Respondiendo el día a día" v={String(activos)} />
            <FilaVerde k="Detectadas, con apoyo abierto" v={String(detectadosAhora)} tierra />
            <FilaVerde k="Retiradas" v={String(retirados)} />
            <View style={e.notaVerde}>
              <IconoEscudoCheck tamano={13} color="#DDF3EA" />
              <Text style={[texto.dato, { color: '#DDF3EA', flex: 1 }]}>
                {cruzaronAlguna < 10
                  ? `Con ${cruzaronAlguna} ${cruzaronAlguna === 1 ? 'caso detectado' : 'casos detectados'} en todo el estudio, las cifras del modelo son orientativas: no alcanzan para concluir nada.`
                  : participantes.length >= MINIMO_PARA_CONCLUIR
                    ? `Con ${participantes.length} personas y ${cruzaronAlguna} casos, el modelo ya se puede validar por partes, con las reservas del capítulo de límites.`
                    : `Con ${participantes.length} personas la validación del modelo es exploratoria.`}
              </Text>
            </View>
          </View>
        </View>

        {/* Empresas y circuito */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Rotulo>Cuánto responde cada empresa</Rotulo>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  {empresas.length === 1
                    ? `Meta del estudio: ${META_ADHERENCIA * 100}%.`
                    : `La marca negra es la media de las ${empresas.length}: ${pct(mediaEmpresas, 0)}.`}
                </Text>
              </View>
            </View>
            {[...empresas].sort((a, b) => Number(b.tasa_promedio ?? 0) - Number(a.tasa_promedio ?? 0)).map((em) => {
              const t = em.tasa_promedio == null ? null : Number(em.tasa_promedio)
              const bajo = t != null && t < META_ADHERENCIA
              return (
                <View key={em.organizacion_id} style={{ gap: 4 }}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <Text style={[texto.datoFuerte, { color: color.texto }]}>{em.nombre}</Text>
                    <Mono tono={bajo ? AMBAR : color.primarioProfundo}>{`${pct(t, 0)} · ${em.participantes_activos} personas`}</Mono>
                  </View>
                  <View style={e.pista}>
                    <View style={[e.lleno, { width: `${(t ?? 0) * 100}%`, backgroundColor: bajo ? AMBAR : color.primarioProfundo }]} />
                    {mediaEmpresas != null && <View style={[e.marcaMedia, { left: `${mediaEmpresas * 100}%` }]} />}
                  </View>
                </View>
              )
            })}
            {empresas.length === 0 && <Text style={[texto.dato, { color: color.textoMedio }]}>Sin empresas con participantes activos.</Text>}
            {bajoLaMeta.length > 0 && (
              <View style={e.notaAmbar}>
                <Text style={[texto.dato, { color: AMBAR }]}>
                  {bajoLaMeta.length === empresas.length && empresas.length > 1
                    ? `Ninguna llega todavía a la meta del ${META_ADHERENCIA * 100}%. Es cosa de recordatorios, no de las personas: conviene hablarlo con los administradores, sin penalizar a nadie.`
                    : `${bajoLaMeta.map((em) => em.nombre).join(', ')} ${bajoLaMeta.length === 1 ? 'está' : 'están'} por debajo de la meta del ${META_ADHERENCIA * 100}%. Conviene revisar los recordatorios con quien la administra, sin penalizar a nadie.`}
                </Text>
              </View>
            )}
          </Caja>

          <Caja estilo={{ flex: 1, minWidth: 320, gap: espacio.sm }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Qué pasó con quienes cruzaron el umbral</Rotulo>
              <Text style={[texto.dato, { color: color.textoMedio }]}>De arriba abajo, cuántas llegaron a cada paso. Acumulado de todo el estudio.</Text>
            </View>
            {embudo.map((paso, i) => {
              const previo = i === 0 ? null : embudo[i - 1].valor
              const perdidos = previo == null ? null : previo - paso.valor
              const ultimo = i === embudo.length - 1
              return (
                <View key={paso.titulo} style={{ gap: 4 }}>
                  {perdidos != null && perdidos > 0 && (
                    <Text style={[texto.dato, { color: AMBAR, fontSize: 11, paddingLeft: 34 }]}>{`↓ aquí se quedaron ${perdidos}`}</Text>
                  )}
                  <View style={[e.pasoEmbudo, ultimo && { backgroundColor: '#EAF4EF' }]}>
                    <View style={[e.numero, ultimo && { backgroundColor: color.primarioProfundo }]}><Text style={[texto.datoFuerte, { color: ultimo ? '#FFFFFF' : color.texto, fontSize: 11 }]}>{i + 1}</Text></View>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <Text style={[texto.datoFuerte, { color: color.texto }]}>{paso.titulo}</Text>
                      <Text style={[texto.dato, { color: color.textoMedio }]}>{paso.nota}</Text>
                    </View>
                    <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 18 }]}>{paso.valor}</Text>
                  </View>
                </View>
              )
            })}
          </Caja>
        </View>

        {/* Modelo y estado actual */}
        <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
          <View style={{ flex: 2, minWidth: 380, gap: espacio.sm }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Qué modelo está funcionando</Rotulo>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Uno se adelanta dentro de la semana; el otro, a la semana siguiente. Regresión logística sobre los ítems diarios.</Text>
            </View>
            <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
              {(['nowcast', 'pronostico'] as const).map((t) => {
                const v = activa(t), d = totalDe(t)
                return (
                  <Caja key={t} estilo={{ flex: 1, minWidth: 220, gap: 8 }}>
                    <View style={[e.fila, { justifyContent: 'space-between' }]}>
                      <View style={[e.fila, { gap: 6 }]}>
                        <View style={[e.punto, { backgroundColor: t === 'nowcast' ? color.primarioProfundo : TIERRA }]} />
                        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{t === 'nowcast' ? 'Dentro de la semana' : 'Para la semana siguiente'}</Text>
                      </View>
                      <Pastilla tono={v ? TONO.gris : TONO.ambar} mono>{v?.version ?? 'ninguna activa'}</Pastilla>
                    </View>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>
                      {t === 'nowcast'
                        ? 'Con los check-ins de lunes a jueves, estima si el OLBI del viernes va a pasar el umbral.'
                        : 'El viernes, ya con el OLBI contestado, estima cómo saldrá el de la semana que viene.'}
                    </Text>
                    <View style={e.metricas}>
                      <Metrica rotulo="Umbral" valor={v ? Number(v.umbral_decision).toFixed(2) : '—'} />
                      <Metrica rotulo="Acierta al avisar" valor={pct(d?.precision, 0)} />
                      <Metrica rotulo="Encuentra casos" valor={pct(d?.recall, 0)} />
                    </View>
                    <View style={[e.fila, { justifyContent: 'space-between' }]}>
                      <Mono>{d ? `sobre ${d.n} predicciones evaluadas` : 'sin evaluar todavía'}</Mono>
                      <Pressable onPress={() => router.push(conFiltro('/investigador/desempeno', filtro) as never)} accessibilityRole="link">
                        <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>Ver el detalle →</Text>
                      </Pressable>
                    </View>
                  </Caja>
                )
              })}
            </View>
            {cruzaronAlguna < 10 && (
              <View style={e.notaAmbar}>
                <Text style={[texto.dato, { color: AMBAR }]}>
                  {`Estas dos cifras se calculan sobre ${cruzaronAlguna} ${cruzaronAlguna === 1 ? 'caso real' : 'casos reales'}. Con tan pocos, un acierto o un fallo mueven el porcentaje veinte puntos: sirven para ver si el circuito funciona, no para afirmar que el modelo funciona.`}
                </Text>
              </View>
            )}
          </View>

          <Caja estilo={{ flex: 1, minWidth: 260, gap: espacio.sm }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Cómo está la gente ahora</Rotulo>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Según el último OLBI de cada quien, sea de la semana que sea.</Text>
            </View>
            {([
              ['bajo', 'Bien', 'lejos de los dos umbrales', color.primarioProfundo, '#F5F4F1'],
              ['a_vigilar', 'Cerca del umbral', 'a menos de medio punto', '#E4E1DC', '#F5F4F1'],
              ['alto', 'Pasaron el umbral', 'por agotamiento o por desvinculación', TIERRA, '#FBEDE6'],
            ] as const).map(([k, t, s, c, f]) => (
              <View key={k} style={[e.nivel, { backgroundColor: f }]}>
                <View style={[e.punto, { backgroundColor: c }]} />
                <View style={{ flex: 1, minWidth: 110 }}>
                  <Text style={[texto.datoFuerte, { color: k === 'alto' ? TIERRA : color.texto }]}>{t}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11 }]}>{s}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[texto.cifra, { color: k === 'alto' ? TIERRA : color.texto, fontFamily: MONO, fontSize: 18 }]}>{niveles[k]}</Text>
                  <Mono>{conOlbi ? `${Math.round((niveles[k] / conOlbi) * 100)}%` : '—'}</Mono>
                </View>
              </View>
            ))}
            <Text style={[texto.dato, { color: color.textoSuave }]}>
              {conOlbi === participantes.length
                ? `Las ${conOlbi} han contestado algún OLBI. La escala es el Oldenburg Burnout Inventory.`
                : `${conOlbi} de ${participantes.length} han contestado algún OLBI; del resto todavía no hay con qué medir. La escala es el Oldenburg Burnout Inventory.`}
            </Text>
          </Caja>
        </View>

        <View style={e.piePagina}>
          <View style={[e.fila, { gap: 8, flex: 1, minWidth: 280 }]}>
            <IconoCheckCirculo tamano={14} color={color.primarioProfundo} />
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
              Ninguna de estas cifras se calcula a mano: salen de las vistas del estudio (adherencia, cohorte_semanal, circuito_apoyo, citas_estudio, desempeno_modelo). Aquí no hay nombres, solo códigos.
            </Text>
          </View>
          <BotonChico onPress={() => router.push(conFiltro('/investigador/exportacion', filtro) as never)} tono="suave">Exportar el corte</BotonChico>
        </View>
      </ScrollView>
    </Panel>
  )
}

/** Indicador de la tesis: la cifra, el veredicto y —RF-009-04— cómo se
 *  calcula, escrito para leerse en voz alta. */
function Indicador({ rotulo, valor, sufijo, veredicto, cumple, tinta = color.texto, calculo, pie }: {
  rotulo: string; valor: string; sufijo?: string; veredicto: string; cumple: boolean; tinta?: string; calculo: string; pie: string
}) {
  return (
    <Caja estilo={{ flex: 1, minWidth: 260, gap: 8 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.fila, { alignItems: 'baseline', gap: 8 }]}>
        <Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 32 }]}>{valor}</Text>
        {sufijo && <Text style={[texto.dato, { color: color.textoMedio }]}>{sufijo}</Text>}
      </View>
      <View style={{ flexDirection: 'row' }}><Pastilla tono={cumple ? TONO.verde : TONO.ambar} punto>{veredicto}</Pastilla></View>
      <View style={e.cajaFormula}>
        <Rotulo>Cómo se calcula</Rotulo>
        <Text style={[texto.dato, { color: color.texto }]}>{calculo}</Text>
        <Text style={[texto.dato, { color: color.textoMedio }]}>{pie}</Text>
      </View>
    </Caja>
  )
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[texto.dato, { color: color.textoMedio, fontSize: 10.5, textAlign: 'center' }]} numberOfLines={2}>{rotulo}</Text>
      <Text style={[texto.datoFuerte, { color: color.texto, fontFamily: MONO, fontSize: 14 }]}>{valor}</Text>
    </View>
  )
}
function FilaVerde({ k, v, tierra }: { k: string; v: string; tierra?: boolean }) {
  return <View style={e.filaVerde}><Text style={[texto.dato, { color: '#FFFFFF', flex: 1 }]}>{k}</Text><Text style={[texto.datoFuerte, { color: tierra ? '#F3DDD2' : '#FFFFFF', fontFamily: MONO }]}>{v}</Text></View>
}
function Leyenda({ tinta, texto: t }: { tinta: string; texto: string }) {
  return <View style={[e.fila, { gap: 5 }]}><View style={[e.punto, { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio }]}>{t}</Text></View>
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
/** El lunes de la semana llega como fecha suelta: hay que leerla a mediodía,
 *  porque `new Date('2026-09-21')` es medianoche UTC y en Perú cae el día 20. */
function rangoSemana(iso: string): string {
  const l = new Date(`${iso.slice(0, 10)}T12:00:00`)
  const v = new Date(l); v.setDate(l.getDate() + 4)
  return l.getMonth() === v.getMonth()
    ? `${l.getDate()} – ${v.getDate()} de ${MESES[l.getMonth()]}`
    : `${l.getDate()} de ${MESES[l.getMonth()]} – ${v.getDate()} de ${MESES[v.getMonth()]}`
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cuadroIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  cajaFormula: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 3 },
  semanaActual: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, marginHorizontal: -6 },
  barraApilada: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', backgroundColor: '#EDEBE7' },
  tarjetaVerde: { backgroundColor: color.primarioProfundo, borderRadius: radio.md, padding: espacio.md, gap: 8 },
  pastillaClara: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  filaVerde: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8, padding: 10 },
  notaVerde: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: 10, marginTop: 4 },
  pista: { height: 8, borderRadius: 4, backgroundColor: '#EDEBE7', overflow: 'visible' },
  lleno: { height: 8, borderRadius: 4 },
  marcaMedia: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: color.texto },
  notaAmbar: { backgroundColor: '#FBEFD9', borderRadius: 8, padding: 10 },
  pasoEmbudo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, flexWrap: 'wrap' },
  numero: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E4E1DC', alignItems: 'center', justifyContent: 'center' },
  punto: { width: 8, height: 8, borderRadius: 4 },
  metricas: { flexDirection: 'row', backgroundColor: '#F5F4F1', borderRadius: 8, padding: 8, gap: 4 },
  nivel: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, padding: 10 },
  piePagina: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: 12, flexWrap: 'wrap' },
})

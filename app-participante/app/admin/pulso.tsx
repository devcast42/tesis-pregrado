/** Pulso organizacional — implementa ESP-008 rev. 2 (RF-008-13, RF-008-14,
 *  RF-008-17). Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x «Pulso».
 *
 *  Tendencia completa con la línea punteada del estudio y la marca de la
 *  semana actual. Una semana sin quórum deja un hueco en la línea, no se
 *  interpola ni se marca «sin datos» en el punto: solo un asterisco en el
 *  eje y una nota (RN-008-11). El selector de segmento solo lista los que
 *  alcanzan el mínimo. */

import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, type Empresa } from '../../modules/panel/datos'
import {
  ETIQUETA_NIVEL, participacionSemanal, pulsoEmpresa, pulsoEstudio, segmentosDisponibles, umbrales,
  type ParticipacionSemana, type PulsoEstudio, type PulsoSemana, type Segmento, type Umbral,
} from '../../modules/panel/empresario'
import { Caja, NotaAgregacion, PastillaNivel, Pie, SinReporte, TONO_NIVEL } from '../../modules/panel/PiezasEmpresario'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCandado, IconoGrafica, IconoInfo } from '../../modules/nucleo/iconos'

const MINIMO = 10
const ETIQUETA_SEGMENTO: Record<string, string> = {
  remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial',
  desarrollo: 'Desarrollo', qa: 'QA', datos: 'Datos', infraestructura: 'Infraestructura',
  soporte: 'Soporte', diseno: 'Diseño', gestion: 'Gestión', otro: 'Otro',
}

/** Lunes ISO + n semanas. */
function sumarSemanas(lunesIso: string, n: number): string {
  const d = new Date(`${lunesIso}T12:00:00`); d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

export default function PulsoEmpresario() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pulso, setPulso] = useState<PulsoSemana[]>([])
  const [estudio, setEstudio] = useState<PulsoEstudio[]>([])
  const [participacion, setParticipacion] = useState<ParticipacionSemana[]>([])
  const [segmentos, setSegmentos] = useState<(Segmento & { respondientes: number })[]>([])
  const [segmento, setSegmento] = useState<Segmento | null>(null)
  const [umb, setUmb] = useState<Umbral[]>([])
  const [listo, setListo] = useState(false)

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [es, seg, u, pa] = await Promise.all([pulsoEstudio(), segmentosDisponibles(em.id), umbrales(), participacionSemanal(em.id)])
      setEstudio(es); setSegmentos(seg); setUmb(u); setParticipacion(pa)
    }
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  useEffect(() => {
    if (!empresa) return
    pulsoEmpresa(empresa.id, segmento ?? undefined).then(setPulso)
  }, [empresa, segmento])

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>
  if (!empresa) return <Panel rol="admin"><Pantalla ancho={ancho.panel}><Aviso>Tu cuenta no está asociada a ninguna empresa.</Aviso></Pantalla></Panel>

  const ultima = pulso[pulso.length - 1]
  const uAg = umb.find((u) => u.dimension === 'agotamiento')
  const totalEmpresa = segmentos.length ? undefined : ultima?.respondientes

  // Eje de 12 semanas desde la primera reportable: las que faltan en medio
  // son huecos; las futuras se pintan como «sin dato».
  const primera = pulso[0]?.semana
  const semanas = primera ? Array.from({ length: 12 }, (_, i) => sumarSemanas(primera, i)) : []
  const porSemana = new Map(pulso.map((p) => [p.semana, p]))
  const porSemanaEstudio = new Map(estudio.map((s) => [s.semana, s]))
  const idxActual = ultima ? semanas.indexOf(ultima.semana) : -1
  const sinQuorum = semanas.filter((s, i) => i < idxActual && !porSemana.has(s))
  const partPor = new Map(participacion.map((s) => [s.semana, s]))

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>
              MONITOREO LONGITUDINAL · <Text style={{ color: color.primarioProfundo }}>COHORTE ACTIVA</Text> · <Text style={{ color: color.texto }}>{empresa.nombre}</Text>
            </Text>
            <Text style={[texto.titulo, { color: color.texto }]}>Pulso Organizacional</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 560 }]}>
              Evolución longitudinal de las dimensiones del estudio en las últimas semanas, calibrada con estándares psicométricos de salud ocupacional.
            </Text>
          </View>
          {ultima && (
            <Caja estilo={{ paddingVertical: 12 }}>
              <View style={[e.fila, { gap: espacio.md }]}>
                <IconoGrafica tamano={22} color={color.primarioProfundo} />
                <View>
                  <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10 }]}>ÚLTIMA LECTURA</Text>
                  <Text style={[texto.seccion, { color: color.texto, fontSize: 18 }]}>
                    Semana {pulso.length} <Text style={[texto.apoyoFuerte, { color: TONO_NIVEL[ultima.nivel_agotamiento].tinta }]}>({ETIQUETA_NIVEL[ultima.nivel_agotamiento]})</Text>
                  </Text>
                </View>
              </View>
            </Caja>
          )}
        </View>

        {/* Selector de segmento (RF-008-17) */}
        <Caja estilo={{ padding: espacio.base }}>
          <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
            <View style={[e.fila, { flex: 1, minWidth: 260 }]}>
              <Chip activo={segmento === null} onPress={() => setSegmento(null)} texto="Toda la empresa" conteo={totalEmpresa ?? ultima?.respondientes} />
              {segmentos.map((s) => (
                <Chip
                  key={`${s.tipo_segmento}:${s.segmento}`}
                  activo={segmento?.segmento === s.segmento && segmento?.tipo_segmento === s.tipo_segmento}
                  onPress={() => setSegmento({ tipo_segmento: s.tipo_segmento, segmento: s.segmento })}
                  texto={ETIQUETA_SEGMENTO[s.segmento] ?? s.segmento}
                  conteo={s.respondientes}
                />
              ))}
            </View>
            <View style={[e.fila, { alignItems: 'flex-start', maxWidth: 400 }]}>
              <IconoCandado tamano={14} color={color.textoMedio} />
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
                Segmentos disponibles con ≥{MINIMO} participantes activos para garantizar confidencialidad absoluta.
                {segmentos.length === 0 ? ' Los segmentos por modalidad y por rol permanecen encriptados.' : ''}
              </Text>
            </View>
          </View>
        </Caja>

        {!ultima ? (
          <SinReporte inscritos={0} minimo={MINIMO} />
        ) : (
          <>
            <Caja>
              <View style={{ gap: espacio.md }}>
                <View style={[e.fila, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, minWidth: 260 }}>
                    <View style={e.fila}>
                      <Text style={[texto.seccion, { color: color.texto }]}>Trayectoria Temporal (12 Semanas)</Text>
                      <IconoInfo tamano={16} color={color.textoMedio} />
                    </View>
                    <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                      Evolución semanal agregada. Las semanas sin quórum normativo ({'<'}{MINIMO} respondientes) muestran una discontinuidad deliberada.
                    </Text>
                  </View>
                  <View style={e.leyenda}>
                    <View style={e.fila}><View style={[e.trazo, { backgroundColor: '#B0532F' }]} /><Text style={[texto.dato, { color: color.texto }]}>Agotamiento</Text></View>
                    <View style={e.fila}><View style={[e.trazo, { backgroundColor: color.primarioProfundo }]} /><Text style={[texto.dato, { color: color.texto }]}>Desvinculación</Text></View>
                    <View style={e.fila}><View style={e.trazoPunteado} /><Text style={[texto.dato, { color: color.texto }]}>Benchmark estudio</Text></View>
                  </View>
                </View>
                <GraficaLinea
                  series={[
                    { etiqueta: 'Agotamiento', color: '#B0532F', puntos: semanas.map((s) => ({ x: s, y: porSemana.get(s) ? Number(porSemana.get(s)!.agotamiento_media) : null })) },
                    { etiqueta: 'Desvinculación', color: color.primarioProfundo, puntos: semanas.map((s) => ({ x: s, y: porSemana.get(s) ? Number(porSemana.get(s)!.desvinculacion_media) : null })) },
                    { etiqueta: 'Benchmark estudio', color: '#9A9590', punteada: true,
                      puntos: semanas.map((s) => ({ x: s, y: porSemanaEstudio.get(s) ? Number(porSemanaEstudio.get(s)!.agotamiento_media) : null })) },
                  ]}
                  yMin={1} yMax={4} alto={260} sinLeyenda todasLasEtiquetasX
                  etiquetaX={(_x, i) => `Sem ${i + 1}${sinQuorum.includes(semanas[i]) ? '*' : ''}`}
                  colorEtiquetaX={(x) => x === ultima.semana ? color.primarioProfundo : sinQuorum.includes(x) ? '#B4413C' : undefined}
                  marcarX={{ x: ultima.semana, etiqueta: `S${pulso.length}: ${Number(ultima.agotamiento_media).toFixed(1)}` }}
                />
                <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
                  <View style={[e.notaUmbral, { flex: 1, minWidth: 260 }]}>
                    <IconoCandado tamano={14} color={color.textoMedio} />
                    <Text style={[texto.apoyoFuerte, { color: color.texto, flex: 1 }]}>
                      Umbrales fijados por el equipo de investigación de la universidad
                      {uAg ? ` (a vigilar ≥ ${uAg.a_vigilar}, alto ≥ ${uAg.alto})` : ''}: las métricas y límites metodológicos de empresa son estrictamente inmutables.
                    </Text>
                  </View>
                  {sinQuorum.length > 0 && (
                    <View style={e.cajaSinQuorum}>
                      <Text style={[texto.dato, { color: color.textoMedio }]}>
                        *{sinQuorum.map((s) => `Semana ${semanas.indexOf(s) + 1}`).join(', ')}: sin quórum normativo
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Caja>

            <Caja>
              <View style={{ gap: espacio.sm }}>
                <View style={e.fila}>
                  <Text style={[texto.seccion, { color: color.texto }]}>Registro Longitudinal Agregado</Text>
                  <View style={e.chipGris}><Text style={[texto.datoFuerte, { color: color.textoMedio }]}>{pulso.length} semanas analizadas</Text></View>
                  <View style={{ flex: 1 }} />
                  <Text style={[texto.dato, { color: color.textoMedio }]}>Escala 1.0 (óptimo) a 4.0 (agotamiento severo)</Text>
                </View>
                <View style={e.tablaCabecera}>
                  {[['SEMANA', 1.3], ['RESPONDIENTES (N)', 1], ['TASA DE RESPUESTA', 1.1], ['AGOTAMIENTO MEDIO', 1], ['DESVINCULACIÓN MEDIA', 1], ['NIVEL RESULTANTE', 1]].map(([h, f]) => (
                    <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, flex: Number(f), fontSize: 11, textAlign: h === 'NIVEL RESULTANTE' ? 'right' : 'left' }]}>{h}</Text>
                  ))}
                </View>
                {[...pulso].reverse().map((p, i) => {
                  const n = pulso.length - i
                  const tasa = partPor.get(p.semana)?.tasa_respuesta_pct ?? null
                  return (
                    <View key={p.semana} style={e.tablaFila}>
                      <View style={[e.fila, { flex: 1.3 }]}>
                        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Semana {n}</Text>
                        {i === 0 && <View style={e.chipActual}><Text style={[texto.insignia, { color: color.primarioProfundo }]}>Actual</Text></View>}
                      </View>
                      <Text style={[texto.cuerpo, { color: color.textoMedio, flex: 1 }]}>{p.respondientes} resp.</Text>
                      <View style={[e.fila, { flex: 1.1 }]}>
                        <View style={e.barraPista}><View style={[e.barraLlena, { width: `${tasa ?? 0}%` }]} /></View>
                        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{tasa != null ? `${tasa}%` : '—'}</Text>
                      </View>
                      <Text style={[texto.cuerpo, { flex: 1, color: TONO_NIVEL[p.nivel_agotamiento].tinta }]}>{Number(p.agotamiento_media).toFixed(1)} <Text style={{ color: color.textoSuave }}>/ 4.0</Text></Text>
                      <Text style={[texto.cuerpo, { flex: 1, color: TONO_NIVEL[p.nivel_desvinculacion].tinta }]}>{Number(p.desvinculacion_media).toFixed(1)} <Text style={{ color: color.textoSuave }}>/ 4.0</Text></Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}><PastillaNivel nivel={p.nivel_agotamiento} /></View>
                    </View>
                  )
                })}
              </View>
            </Caja>

            <View style={e.tresCols}>
              <Nota titulo="AGOTAMIENTO FÍSICO/COGNITIVO" texto={`La media de ${Number(ultima.agotamiento_media).toFixed(1)} se sitúa en nivel ${ETIQUETA_NIVEL[ultima.nivel_agotamiento].toLowerCase()}. En equipos tech suele correlacionar con sprint overhauls consecutivos o fricción en guardias pasivas.`} />
              <Nota titulo="DESVINCULACIÓN DEL TRABAJO" texto={`Mantenida en ${Number(ultima.desvinculacion_media).toFixed(1)} (nivel ${ETIQUETA_NIVEL[ultima.nivel_desvinculacion].toLowerCase()}). Los profesionales reportan apego al propósito del producto y pertenencia técnica.`} />
              <Nota titulo="PROTECCIÓN DE RESPUESTAS" texto={`Toda correlación demográfica menor a ${MINIMO} respondientes es censurada por el motor del estudio previo a la ingesta en este panel directivo.`} />
            </View>
          </>
        )}

        <NotaAgregacion respondientes={ultima?.respondientes} minimo={MINIMO} />
        <Pie />
      </Pantalla>
    </Panel>
  )
}

function Chip({ activo, onPress, texto: t, conteo }: { activo: boolean; onPress: () => void; texto: string; conteo?: number }) {
  return (
    <Pressable onPress={onPress} style={[e.chip, activo && e.chipActivo]} accessibilityRole="tab" accessibilityState={{ selected: activo }}>
      <Text style={[texto.apoyoFuerte, { color: activo ? '#FFFFFF' : color.texto }]}>{t}</Text>
      {conteo != null && (
        <View style={[e.conteo, activo && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[texto.datoFuerte, { color: activo ? '#FFFFFF' : color.textoMedio }]}>{conteo}</Text>
        </View>
      )}
    </Pressable>
  )
}

function Nota({ titulo, texto: t }: { titulo: string; texto: string }) {
  return (
    <View style={{ flex: 1, minWidth: 220 }}>
      <Caja suave>
        <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 11 }]}>{titulo}</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio, marginTop: 6 }]}>{t}</Text>
      </Caja>
    </View>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radio.md, backgroundColor: '#F1EFEB' },
  chipActivo: { backgroundColor: color.primario },
  conteo: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: '#E4E1DC', alignItems: 'center', justifyContent: 'center' },
  leyenda: { gap: 6, backgroundColor: '#F5F4F1', borderRadius: radio.md, paddingHorizontal: espacio.base, paddingVertical: espacio.sm, flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.base, maxWidth: 300 },
  trazo: { width: 14, height: 3, borderRadius: 2 },
  trazoPunteado: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#9A9590' },
  notaUmbral: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md },
  cajaSinQuorum: { borderWidth: 1, borderColor: color.borde, borderRadius: radio.md, padding: espacio.md, maxWidth: 220 },
  chipGris: { backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipActual: { backgroundColor: '#DDF3EA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tablaCabecera: { flexDirection: 'row', gap: espacio.sm, paddingVertical: espacio.sm, paddingHorizontal: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.sm },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 14, paddingHorizontal: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde },
  barraPista: { width: 44, height: 6, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3, backgroundColor: color.primarioProfundo },
  tresCols: { flexDirection: 'row', gap: espacio.base, flexWrap: 'wrap' },
})

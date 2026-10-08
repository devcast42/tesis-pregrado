/** Pulso organizacional — implementa ESP-008 rev. 2 (RF-008-13, RF-008-14,
 *  RF-008-17). Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x «Pulso».
 *
 *  La pregunta de esta pantalla es «¿vamos mejor o peor que hace un mes?».
 *  Antes había que deducirlo de una gráfica con las dos dimensiones juntas,
 *  una línea punteada llamada «Benchmark estudio» que en realidad solo
 *  dibujaba el agotamiento, y una tabla de seis columnas. Ahora cada
 *  dimensión tiene su propia gráfica, con sus propias franjas de «a vigilar»
 *  y «alto» pintadas al fondo: dónde cae la línea se ve sin leer nada.
 *
 *  Una semana sin quórum deja un hueco en la línea (RN-008-11); no se
 *  interpola. El selector de segmento solo lista los que llegan al mínimo. */

import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, type Empresa } from '../../modules/panel/datos'
import {
  etiquetaSemana, participacionSemanal, pulsoEmpresa, pulsoEstudio, rangoSemana, segmentosDisponibles, umbrales,
  type ParticipacionSemana, type PulsoEstudio, type PulsoSemana, type Segmento, type Umbral,
} from '../../modules/panel/empresario'
import { EscalaNivel, Caja, NotaAgregacion, Pastilla, PastillaNivel, Pie, SinReporte, TONO_NIVEL } from '../../modules/panel/PiezasEmpresario'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCandado, IconoTendenciaAbajo, IconoTendenciaArriba } from '../../modules/nucleo/iconos'

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

/** Semanas entre la primera y la última con datos, ambas incluidas.
 *
 *  Antes el eje eran siempre 12 posiciones desde la primera, así que con
 *  cinco semanas de estudio la gráfica salía con siete huecos a la derecha
 *  que no eran huecos: eran semanas que todavía no han pasado. */
function ejeDeSemanas(pulso: PulsoSemana[]): string[] {
  if (!pulso.length) return []
  const primera = pulso[0].semana, ultima = pulso[pulso.length - 1].semana
  const out: string[] = []
  for (let s = primera; s <= ultima; s = sumarSemanas(s, 1)) out.push(s)
  return out
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
  const { width } = useWindowDimensions()
  const ancha = width >= 1000

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
  const semanas = ejeDeSemanas(pulso)
  const conDatos = new Set(pulso.map((p) => p.semana))
  const huecos = semanas.filter((s) => !conDatos.has(s))
  const partPor = new Map(participacion.map((s) => [s.semana, s]))
  const tasaUltima = ultima && !segmento ? partPor.get(ultima.semana)?.tasa_respuesta_pct ?? null : null
  const nombreSerie = segmento ? ETIQUETA_SEGMENTO[segmento.segmento] ?? segmento.segmento : 'Toda la empresa'

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>{empresa.nombre}</Text>
            <Text style={[texto.titulo, { color: color.texto }]}>Semana a semana</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 480 }]}>
              Promedio semanal de lo que contesta tu equipo, de 1 (nada) a 4 (mucho). No es un porcentaje: cuanto más bajo, mejor.
            </Text>
          </View>
          {ultima && (
            <Caja estilo={{ paddingVertical: 14 }}>
              <View style={{ gap: 4, minWidth: 180 }}>
                <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10 }]}>ÚLTIMA SEMANA CERRADA</Text>
                <Text style={[texto.seccion, { color: color.texto, fontSize: 18 }]}>{rangoSemana(ultima.semana)}</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                  Contestaron {ultima.respondientes} personas{tasaUltima != null ? ` (${tasaUltima} % del equipo)` : ''}
                </Text>
              </View>
            </Caja>
          )}
        </View>

        {/* Selector de segmento (RF-008-17) */}
        <Caja estilo={{ padding: espacio.base }}>
          <View style={[e.fila, { alignItems: 'center', gap: espacio.base }]}>
            <View style={[e.fila, { flex: 1, minWidth: 260 }]}>
              <Chip activo={segmento === null} onPress={() => setSegmento(null)} texto="Toda la empresa" />
              {segmentos.map((s) => (
                <Chip
                  key={`${s.tipo_segmento}:${s.segmento}`}
                  activo={segmento?.segmento === s.segmento && segmento?.tipo_segmento === s.tipo_segmento}
                  onPress={() => setSegmento({ tipo_segmento: s.tipo_segmento, segmento: s.segmento })}
                  texto={ETIQUETA_SEGMENTO[s.segmento] ?? s.segmento}
                />
              ))}
            </View>
            <View style={[e.fila, { alignItems: 'center', maxWidth: 360 }]}>
              <IconoCandado tamano={14} color={color.textoMedio} />
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
                {segmentos.length === 0
                  ? `Ningún grupo llega a ${MINIMO} personas, así que no se puede separar.`
                  : `Solo aparecen los grupos de ${MINIMO} personas o más.`}
              </Text>
            </View>
          </View>
        </Caja>

        {!ultima ? (
          <SinReporte inscritos={0} minimo={MINIMO} />
        ) : (
          <>
            <View style={[e.grid, ancha && e.gridFila]}>
              <View style={e.col}>
                <Tendencia dimension="agotamiento" pulso={pulso} estudio={estudio} semanas={semanas} nombre={nombreSerie}
                  umbral={umb.find((u) => u.dimension === 'agotamiento')} />
              </View>
              <View style={e.col}>
                <Tendencia dimension="desvinculacion" pulso={pulso} estudio={estudio} semanas={semanas} nombre={nombreSerie}
                  umbral={umb.find((u) => u.dimension === 'desvinculacion')} />
              </View>
            </View>

            <View style={e.notaUmbral}>
              <IconoCandado tamano={14} color={color.textoMedio} />
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1, minWidth: 240 }]}>
                Las franjas «a vigilar» y «alto» vienen del instrumento clínico, no las fija la empresa.
                {huecos.length > 0 ? ` Faltan ${huecos.length} ${huecos.length === 1 ? 'semana' : 'semanas'}: no llegaron a ${MINIMO} respuestas.` : ''}
              </Text>
            </View>

            <Caja>
              <View style={{ gap: espacio.sm }}>
                <View style={e.fila}>
                  <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>Cada semana, en números</Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>{pulso.length} semanas con datos</Text>
                </View>
                <View style={e.tablaCabecera}>
                  <Text style={[e.th, { flex: 1.4 }]}>SEMANA</Text>
                  <Text style={[e.th, { flex: 1.2 }]}>CONTESTARON</Text>
                  <Text style={[e.th, { flex: 1.2 }]}>AGOTAMIENTO</Text>
                  <Text style={[e.th, { flex: 1.2 }]}>DESVINCULACIÓN</Text>
                </View>
                {[...pulso].reverse().map((p, i) => {
                  const part = partPor.get(p.semana)
                  const tasa = segmento ? null : part?.tasa_respuesta_pct ?? null
                  return (
                    <View key={p.semana} style={e.tablaFila}>
                      <View style={[e.fila, { flex: 1.4, gap: 6 }]}>
                        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{rangoSemana(p.semana)}</Text>
                        {i === 0 && <View style={e.chipActual}><Text style={[texto.insignia, { color: color.primarioProfundo }]}>Última</Text></View>}
                      </View>
                      <View style={[e.fila, { flex: 1.2, gap: espacio.sm }]}>
                        {tasa != null && <View style={e.barraPista}><View style={[e.barraLlena, { width: `${Math.min(100, tasa)}%` }]} /></View>}
                        <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
                          {p.respondientes}{tasa != null ? ` de ${part!.inscritos}` : ' personas'}
                        </Text>
                      </View>
                      <Celda valor={p.agotamiento_media} nivel={p.nivel_agotamiento} />
                      <Celda valor={p.desvinculacion_media} nivel={p.nivel_desvinculacion} />
                    </View>
                  )
                })}
              </View>
            </Caja>
          </>
        )}

        <NotaAgregacion respondientes={ultima?.respondientes} minimo={MINIMO} />
        <Pie />
      </Pantalla>
    </Panel>
  )
}

/** Una dimensión: su nivel de ahora, cuánto cambió y su recorrido.
 *
 *  Separar las dos dimensiones no es solo estética: cada una tiene sus
 *  propios cortes —agotamiento a vigilar desde 2.25, desvinculación desde
 *  2.10—, así que una sola gráfica no podía enseñar dónde estaba la raya. */
function Tendencia({ dimension, pulso, estudio, semanas, nombre, umbral }: {
  dimension: 'agotamiento' | 'desvinculacion'
  pulso: PulsoSemana[]
  estudio: PulsoEstudio[]
  semanas: string[]
  /** Qué está dibujando la línea sólida: la empresa entera o un grupo. */
  nombre: string
  umbral?: Umbral
}) {
  const clave = `${dimension}_media` as const
  const ultima = pulso[pulso.length - 1]
  const previa = pulso[pulso.length - 2]
  const cambio = ultima && previa ? Number(ultima[clave]) - Number(previa[clave]) : null
  const porSemana = new Map(pulso.map((p) => [p.semana, p]))
  const porEstudio = new Map(estudio.map((s) => [s.semana, s]))
  const tinta = dimension === 'agotamiento' ? '#B0532F' : color.primarioProfundo

  return (
    <Caja>
      <View style={{ gap: espacio.md }}>
        <View style={{ gap: 6 }}>
          <Text style={[texto.seccion, { color: color.texto, fontSize: 19 }]}>
            {dimension === 'agotamiento' ? 'Agotamiento' : 'Desvinculación'}
          </Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            {dimension === 'agotamiento'
              ? 'Cuánto cansancio acumulado declara el equipo.'
              : 'Cuánto se ha desenganchado la gente de su trabajo.'}
          </Text>
        </View>

        <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
          <Text style={[texto.cifra, { color: tinta, fontSize: 30, lineHeight: 34 }]}>
            {Number(ultima[clave]).toFixed(1)}
          </Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 4 }]}>de 4</Text>
          <View style={{ flex: 1 }} />
          <View style={[e.fila, { gap: 6 }]}>
            <PastillaNivel nivel={ultima[`nivel_${dimension}` as const]} />
            {cambio !== null && (
              <Pastilla fondo="#EDEBE7" tinta={color.texto}
                icono={cambio > 0 ? <IconoTendenciaArriba tamano={13} color={color.tierra} /> : cambio < 0 ? <IconoTendenciaAbajo tamano={13} color={color.primario} /> : undefined}>
                {cambio === 0 ? 'igual que la semana pasada' : `${cambio > 0 ? '+' : ''}${cambio.toFixed(1)} que la semana pasada`}
              </Pastilla>
            )}
          </View>
        </View>

        <EscalaNivel dimension={dimension} valor={Number(ultima[clave])} umbral={umbral} />

        <GraficaLinea
          series={[
            { etiqueta: nombre, color: tinta, puntos: semanas.map((s) => ({ x: s, y: porSemana.has(s) ? Number(porSemana.get(s)![clave]) : null })) },
            /* No es «el promedio del estudio»: la vista excluye a la propia
               empresa (RN-008-14), así que la línea punteada son las demás.
               Por eso también puede empezar más tarde —hacen falta dos
               empresas— y llamarla «el estudio» hacía pensar en un error. */
            { etiqueta: 'Las otras empresas', color: '#9A9590', punteada: true,
              puntos: semanas.map((s) => ({ x: s, y: porEstudio.has(s) ? Number(porEstudio.get(s)![clave]) : null })) },
          ]}
          bandas={umbral ? [
            { desde: Number(umbral.alto), hasta: 4, color: '#F3D3C4', etiqueta: 'Alto' },
            { desde: Number(umbral.a_vigilar), hasta: Number(umbral.alto), color: '#FBEFE9', etiqueta: 'A vigilar' },
          ] : []}
          yMin={1} yMax={4} alto={220} todasLasEtiquetasX
          etiquetaX={(x) => etiquetaSemana(x)}
          colorEtiquetaX={(x) => x === ultima.semana ? color.texto : undefined}
        />
      </View>
    </Caja>
  )
}

function Celda({ valor, nivel }: { valor: number; nivel: PulsoSemana['nivel_agotamiento'] }) {
  return (
    <View style={[e.fila, { flex: 1.2, gap: 6 }]}>
      <Text style={[texto.cuerpoFuerte, { color: TONO_NIVEL[nivel].tinta }]}>
        {Number(valor).toFixed(1)}
      </Text>
      {/* «Bajo» es lo normal: una pastilla en cada celda de cada fila
          convertía la tabla en un muro de pastillas. */}
      {nivel !== 'bajo' && <PastillaNivel nivel={nivel} />}
    </View>
  )
}

function Chip({ activo, onPress, texto: t }: { activo: boolean; onPress: () => void; texto: string }) {
  return (
    <Pressable onPress={onPress} style={[e.chip, activo && e.chipActivo]} accessibilityRole="tab" accessibilityState={{ selected: activo }}>
      <Text style={[texto.apoyoFuerte, { color: activo ? '#FFFFFF' : color.texto }]}>{t}</Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  grid: { gap: espacio.base },
  gridFila: { flexDirection: 'row' },
  col: { flex: 1, minWidth: 300 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radio.md, backgroundColor: '#F1EFEB' },
  chipActivo: { backgroundColor: color.primario },
  notaUmbral: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, flexWrap: 'wrap' },
  chipActual: { backgroundColor: '#DDF3EA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  th: { ...texto.etiqueta, color: color.textoMedio, fontSize: 11 },
  tablaCabecera: { flexDirection: 'row', gap: espacio.sm, paddingVertical: espacio.sm, paddingHorizontal: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.sm },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 14, paddingHorizontal: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde },
  barraPista: { width: 44, height: 6, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3, backgroundColor: color.primarioProfundo },
})

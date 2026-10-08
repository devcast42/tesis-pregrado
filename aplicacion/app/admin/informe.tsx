/** Informe mensual — implementa ESP-008 rev. 2 (RF-008-21, RF-008-22).
 *  Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x «Informe Mensual».
 *
 *  Una página A4 para gerencia: cómo estuvo el equipo, qué se salió de lo
 *  previsto, uso del apoyo y qué hacer. Los títulos eran «Sección 1: Pulso
 *  y Desgaste Emocional del Mes» y «Sección 4: Intervenciones Prioritarias»
 *  —sin Sección 3, que se había quedado sin número—, y la nota del apoyo
 *  ocupaba cuatro líneas para decir que la cifra está redondeada.
 *
 *  «Descargar PDF» e «Imprimir»
 *  usan la impresión del navegador: el panel es web y así no hay que
 *  generar el documento en el servidor. Al pie, siempre, la leyenda de
 *  agregación y el mínimo de reporte. */

import { createElement, useCallback, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, resumenDeEmpresa, type Empresa, type ResumenEmpresa } from '../../modules/panel/datos'
import {
  FACTORES, apoyoMensual, factoresEmpresa, fueraDeReferencia, participacionSemanal, pulsoEmpresa, recomendaciones,
  type FactoresSemana, type Nivel, type ParticipacionSemana, type PulsoSemana,
  umbrales, type Umbral,
} from '../../modules/panel/empresario'
import { EscalaNivel, Pastilla, PastillaNivel, Pie, SinReporte, TONO_NIVEL } from '../../modules/panel/PiezasEmpresario'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoApoyo, IconoArchivo, IconoCalendario, IconoCheckCirculo, IconoChevronAbajo, IconoEquipo, IconoEscudo, IconoHoja,
  IconoImprimir, IconoTendenciaAbajo, IconoTendenciaArriba,
} from '../../modules/nucleo/iconos'

const MINIMO = 10

function mesDe(semanaIso: string) { return semanaIso.slice(0, 7) }
function nombreMes(mesIso: string, conAnio = true) {
  const d = new Date(`${mesIso}-15T12:00:00`)
  const t = d.toLocaleDateString('es-PE', conAnio ? { month: 'long', year: 'numeric' } : { month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function mesSiguiente(mesIso: string) {
  const d = new Date(`${mesIso}-15T12:00:00`); d.setMonth(d.getMonth() + 1)
  return nombreMes(d.toISOString().slice(0, 7))
}
function mesAnterior(mesIso: string) {
  const d = new Date(`${mesIso}-15T12:00:00`); d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}
function numeroSemanaIso(lunesIso: string) {
  const d = new Date(`${lunesIso}T12:00:00Z`)
  const jueves = new Date(d); jueves.setUTCDate(d.getUTCDate() + 3)
  const inicioAnio = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 1))
  return Math.ceil(((jueves.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7)
}

export default function InformeMensual() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [pulso, setPulso] = useState<PulsoSemana[]>([])
  const [factores, setFactores] = useState<FactoresSemana[]>([])
  const [participacion, setParticipacion] = useState<ParticipacionSemana[]>([])
  const [apoyo, setApoyo] = useState<{ mes: string; sesiones_aprox: number }[]>([])
  const [cortes, setCortes] = useState<Umbral[]>([])
  const [mes, setMes] = useState<string | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [listo, setListo] = useState(false)

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [r, p, f, pa, ap, u] = await Promise.all([
        resumenDeEmpresa(em.id), pulsoEmpresa(em.id), factoresEmpresa(em.id), participacionSemanal(em.id), apoyoMensual(em.id),
        umbrales().catch(() => [] as Umbral[]),
      ])
      setResumen(r); setPulso(p); setFactores(f); setParticipacion(pa); setApoyo(ap); setCortes(u)
      if (p.length) setMes((m) => m ?? mesDe(p[p.length - 1].semana))
    }
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>
  if (!empresa) return <Panel rol="admin"><Pantalla ancho={ancho.panel}><Aviso>Tu cuenta no está asociada a ninguna empresa.</Aviso></Pantalla></Panel>

  const meses = [...new Set(pulso.map((p) => mesDe(p.semana)))].sort().reverse()
  const pulsoMes = pulso.filter((p) => mes && mesDe(p.semana) === mes)
  const pulsoPrevio = pulso.filter((p) => mes && mesDe(p.semana) === mesAnterior(mes))
  const factoresMes = factores.filter((f) => mes && mesDe(f.semana) === mes)
  const partMes = participacion.filter((s) => mes && mesDe(s.semana) === mes)
  const sesiones = apoyo.find((a) => mes && a.mes.startsWith(mes))?.sesiones_aprox
  const media = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  const agMes = media(pulsoMes.map((p) => Number(p.agotamiento_media)))
  const dvMes = media(pulsoMes.map((p) => Number(p.desvinculacion_media)))
  const agPrev = media(pulsoPrevio.map((p) => Number(p.agotamiento_media)))
  const dvPrev = media(pulsoPrevio.map((p) => Number(p.desvinculacion_media)))
  /** El nivel del mes sale de la misma cifra que se enseña —la media del
   *  mes— y con los mismos cortes que la escala. Antes salía de la última
   *  semana: con desvinculación en 2.07 de media y 2.1 la última semana, la
   *  tarjeta ponía «A vigilar» encima de un número que estaba en zona baja. */
  const corteDe = (dim: 'agotamiento' | 'desvinculacion') => cortes.find((c) => c.dimension === dim)
  const nivelMes = (dim: 'agotamiento' | 'desvinculacion'): Nivel | null => {
    const v = dim === 'agotamiento' ? agMes : dvMes
    const u = corteDe(dim)
    if (v == null) return null
    if (!u) { const ult = pulsoMes[pulsoMes.length - 1]; return ult ? ult[`nivel_${dim}`] : null }
    return v >= Number(u.alto) ? 'alto' : v >= Number(u.a_vigilar) ? 'a_vigilar' : 'bajo'
  }
  const respondientesMes = media(pulsoMes.map((p) => p.respondientes))
  const tasaMes = media(partMes.map((s) => s.tasa_respuesta_pct ?? 0))
  const ultimoFactor = factoresMes[factoresMes.length - 1]
  const fuera = ultimoFactor ? FACTORES.filter((f) => fueraDeReferencia(f.clave, ultimoFactor[f.clave])).slice(0, 3) : []
  const recs = recomendaciones(ultimoFactor, pulsoMes, partMes[partMes.length - 1]).slice(0, 2)
  const semanasIso = pulsoMes.map((p) => numeroSemanaIso(p.semana))
  const inscritos = resumen?.inscritos ?? 0

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        {Platform.OS === 'web' && createElement('style', {}, `
          @media print {
            #panel-nav, #panel-top, #no-imprimir, #no-imprimir-pie { display: none !important; }
            body { background: #FFFFFF; }
            @page { size: A4; margin: 12mm; }
          }
        `)}
        <View style={[e.encabezado, { zIndex: selectorAbierto ? 30 : 1 }]} nativeID="no-imprimir">
          <View style={{ gap: 4, minWidth: 260, flex: 1 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>Para pasar a gerencia</Text>
            <Text style={[texto.titulo, { color: color.texto }]}>{mes ? `Informe de ${nombreMes(mes, false)}` : 'Informe mensual'}</Text>
          </View>
          {/* Los tres controles en una sola fila: el de PDF colgaba debajo y a
           *  la derecha, desalineado con el selector y con «Imprimir». */}
          <View style={[e.acciones, { zIndex: selectorAbierto ? 30 : 1 }]}>
            <View style={{ zIndex: selectorAbierto ? 30 : 1 }}>
              <Pressable onPress={() => setSelectorAbierto((v) => !v)} style={e.selector} accessibilityRole="button">
                <IconoCalendario tamano={16} color={color.textoMedio} />
                <Text style={[texto.apoyo, { color: color.texto }]}>{mes ? nombreMes(mes) : '—'}</Text>
                <IconoChevronAbajo tamano={18} color={color.textoMedio} />
              </Pressable>
              {selectorAbierto && (
                <View style={e.menu}>
                  {meses.map((m) => (
                    <Pressable key={m} onPress={() => { setMes(m); setSelectorAbierto(false) }} style={e.menuItem}>
                      <Text style={[texto.apoyo, { color: m === mes ? color.primarioProfundo : color.texto }]}>{nombreMes(m)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            {Platform.OS === 'web' && (
              <>
                <Pressable onPress={() => window.print()} style={e.botonBorde} accessibilityRole="button">
                  <IconoImprimir tamano={16} color={color.texto} />
                  <Text style={[texto.apoyoFuerte, { color: color.texto }]}>Imprimir</Text>
                </Pressable>
                <Pressable onPress={() => window.print()} style={e.botonPdf} accessibilityRole="button">
                  <IconoArchivo tamano={16} color="#FFFFFF" />
                  <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>Descargar PDF</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {!mes || pulsoMes.length === 0 ? (
          <SinReporte inscritos={inscritos} minimo={MINIMO} />
        ) : (
          <View style={e.hoja}>
            {/* Cabecera del documento */}
            <View style={[e.fila, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
              <View style={[e.fila, { alignItems: 'flex-start' }]}>
                <View style={e.sello}><IconoHoja tamano={20} color={color.primarioProfundo} /></View>
                <View>
                  <Text style={[texto.seccion, { color: color.texto, fontSize: 18 }]}>{empresa.nombre}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio, maxWidth: 190 }]}>Informe de bienestar · Bienestar Tech</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{nombreMes(mes)}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  {`${pulsoMes.length} ${pulsoMes.length === 1 ? 'semana' : 'semanas'} con datos`}
                </Text>
              </View>
            </View>

            {/* Intro */}
            <View style={e.intro}>
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1, minWidth: 240 }]}>
                {`Contestaron ${Math.round(respondientesMes ?? 0)} de ${inscritos} personas por semana. Todo lo que sigue son promedios del equipo.`}
              </Text>
              {tasaMes != null && (
                <View style={e.cajaMuestra}>
                  <IconoEquipo tamano={18} color={color.primarioProfundo} />
                  <View>
                    <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{Math.round(tasaMes)}% contestó</Text>
                    {tasaMes < 60 && <Text style={[texto.dato, { color: color.alerta }]}>bajo el 60 %: poco fiable</Text>}
                  </View>
                </View>
              )}
            </View>

            {/* Sección 1 */}
            <View style={e.fila}>
              <View style={e.puntoVerde} />
              <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Cómo estuvo el equipo</Text>
              <Text style={[texto.dato, { color: color.textoSuave }]}>promedio de 1 (nada) a 4 (mucho)</Text>
            </View>
            <View style={e.tres}>
              <CeldaDimension dimension="agotamiento" umbral={corteDe('agotamiento')} rotulo="AGOTAMIENTO" valor={agMes} nivel={nivelMes('agotamiento')} previo={agPrev} mesPrevio={nombreMes(mesAnterior(mes), false)} />
              <CeldaDimension dimension="desvinculacion" umbral={corteDe('desvinculacion')} rotulo="DESVINCULACIÓN" valor={dvMes} nivel={nivelMes('desvinculacion')} previo={dvPrev} mesPrevio={nombreMes(mesAnterior(mes), false)} />
              <View style={e.celda}>
                <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 11 }]}>SEMANA A SEMANA</Text>
                <GraficaLinea
                  series={[{ etiqueta: 'Agotamiento', color: '#B0532F', puntos: pulsoMes.map((p) => ({ x: p.semana, y: Number(p.agotamiento_media) })) }]}
                  yMin={1} yMax={4} alto={80} desnuda sinLeyenda todasLasEtiquetasX
                  etiquetaX={(x, i) => `S${i + 1}`}
                />
              </View>
            </View>

            {/* Sección 2 */}
            <View style={e.fila}>
              <View style={e.puntoVerde} />
              <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Qué se salió de lo previsto</Text>
            </View>
            {fuera.length === 0 ? (
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>Nada se salió de lo previsto este mes.</Text>
            ) : (
              <View style={e.tres}>
                {fuera.map((f) => {
                  const v = Number(ultimoFactor![f.clave])
                  const pct = f.clave === 'guardia_pct' ? v : Math.min(100, Math.round((v / (f.ref * 1.6)) * 100))
                  return (
                    <View key={f.clave} style={e.celda}>
                      <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 11 }]}>{f.nombre.toUpperCase()}</Text>
                      <Text style={[texto.seccion, { color: color.texto }]}>
                        {v.toFixed(f.clave === 'guardia_pct' ? 0 : 1)}{f.clave === 'guardia_pct' ? ' %' : ' h'}{' '}
                        <Text style={[texto.apoyo, { color: color.textoMedio }]}>{f.clave === 'guardia_pct' ? 'del equipo' : f.unidad.replace('h / ', '/ ')}</Text>
                      </Text>
                      <Text style={[texto.dato, { color: color.textoMedio }]}>
                        {`Lo previsto: ${f.peorSi === 'mayor' ? 'hasta' : 'al menos'} ${f.ref}${f.clave === 'guardia_pct' ? ' %' : ' h'}`}
                      </Text>
                      <View style={e.barrita}><View style={[e.barritaLlena, { width: `${pct}%` }]} /></View>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Sección 3: apoyo */}
            <View style={e.apoyo}>
              <View style={[e.fila, { alignItems: 'flex-start' }]}>
                <View style={e.iconoApoyo}><IconoApoyo tamano={18} color={color.primarioProfundo} /></View>
                <View style={{ flex: 1, gap: 6, minWidth: 240 }}>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Uso del apoyo psicológico</Text>
                  <Text style={[texto.cuerpo, { color: color.texto }]}>
                    {sesiones != null
                      ? <>Alrededor de <Text style={{ color: color.primarioProfundo }}>{sesiones} sesiones</Text> este mes.</>
                      : 'Hubo menos de cinco sesiones, así que no se da la cifra.'}
                  </Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    La cifra va redondeada y solo aparece a partir de cinco. Nunca sabrás quién fue, ni cuándo, ni de qué área.
                  </Text>
                </View>
              </View>
            </View>

            {/* Sección 4 */}
            {recs.length > 0 && (
              <>
                <View style={e.fila}>
                  <View style={e.puntoVerde} />
                  <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Qué hacer en {mesSiguiente(mes).toLowerCase()}</Text>
                </View>
                <View style={e.tres}>
                  {recs.map((r, i) => (
                    <View key={r.id} style={[e.celda, { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde }]}>
                      <View style={[e.fila, { alignItems: 'flex-start' }]}>
                        <View style={e.numero}><Text style={[texto.datoFuerte, { color: color.texto }]}>{i + 1}</Text></View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{r.titulo}</Text>
                          <Text style={[texto.dato, { color: color.textoMedio }]}>{r.texto}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={e.pieHoja}>
              <IconoEscudo tamano={14} color={color.primarioProfundo} />
              <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 220 }]}>
                Promedios del equipo. Ninguna cifra se calcula con menos de {MINIMO} respuestas.
              </Text>
              <Text style={[texto.datoFuerte, { color: color.textoMedio }]}>INFORME · {empresa.nombre.toUpperCase().slice(0, 18)} · {mes}</Text>
            </View>
          </View>
        )}

        <View nativeID="no-imprimir-pie"><Pie /></View>
      </Pantalla>
    </Panel>
  )
}

function CeldaDimension({ dimension, umbral, rotulo, valor, nivel, previo, mesPrevio }: { dimension: 'agotamiento' | 'desvinculacion'; umbral?: Umbral; rotulo: string; valor: number | null; nivel: Nivel | null; previo: number | null; mesPrevio: string }) {
  const cambio = valor != null && previo != null ? valor - previo : null
  return (
    <View style={e.celda}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}>
        <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 11, flex: 1 }]}>{rotulo}</Text>
        {nivel && <PastillaNivel nivel={nivel} />}
      </View>
      <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
        <Text style={[texto.cifra, { color: nivel ? TONO_NIVEL[nivel].tinta : color.texto }]}>{valor?.toFixed(1) ?? '—'}</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 6 }]}>de 4</Text>
      </View>
      {valor != null && <EscalaNivel dimension={dimension} valor={valor} umbral={umbral} />}
      <View style={[e.fila, { gap: 6 }]}>
        {cambio == null ? (
          <Text style={[texto.dato, { color: color.textoMedio }]}>Primer mes con datos</Text>
        ) : Math.abs(cambio) < 0.05 ? (
          <Text style={[texto.dato, { color: color.primarioProfundo }]}>= Estable (sin variación)</Text>
        ) : (
          <>
            {cambio > 0 ? <IconoTendenciaArriba tamano={13} color="#B0532F" /> : <IconoTendenciaAbajo tamano={13} color={color.primarioProfundo} />}
            <Text style={[texto.dato, { color: cambio > 0 ? '#B0532F' : color.primarioProfundo }]}>{cambio > 0 ? '+' : ''}{cambio.toFixed(1)} frente a {mesPrevio}</Text>
          </>
        )}
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde, borderRadius: radio.md, paddingHorizontal: espacio.md, height: 42 },
  menu: { position: 'absolute', top: 46, left: 0, minWidth: 200, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 30, elevation: 8, shadowColor: '#1C1917', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem: { paddingHorizontal: espacio.md, paddingVertical: 10 },
  botonBorde: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde, borderRadius: radio.md, paddingHorizontal: espacio.md, height: 42 },
  botonPdf: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: 18, height: 42, borderRadius: radio.md, backgroundColor: color.primario },
  hoja: { backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.xl, gap: espacio.base, borderWidth: 1, borderColor: '#EEECE8', maxWidth: 860, width: '100%', alignSelf: 'center' },
  sello: { width: 44, height: 44, borderRadius: radio.md, backgroundColor: '#E8EFEA', alignItems: 'center', justifyContent: 'center' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: '#E8F3EE', borderRadius: radio.md, padding: espacio.base, flexWrap: 'wrap' },
  cajaMuestra: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.md },
  puntoVerde: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.primarioProfundo },
  tres: { flexDirection: 'row', gap: espacio.md, flexWrap: 'wrap' },
  celda: { flex: 1, minWidth: 200, gap: 8, padding: espacio.base, borderRadius: radio.md, backgroundColor: '#F5F4F1' },
  barrita: { height: 4, borderRadius: 2, backgroundColor: '#E4E1DC', overflow: 'hidden', marginTop: 4 },
  barritaLlena: { height: 4, borderRadius: 2, backgroundColor: '#B0532F' },
  apoyo: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.base },
  iconoApoyo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DDF3EA', alignItems: 'center', justifyContent: 'center' },
  cajaGarantia: { backgroundColor: color.superficie, borderRadius: radio.sm, padding: espacio.md },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EDEBE7', alignItems: 'center', justifyContent: 'center' },
  pieHoja: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingTop: espacio.md, borderTopWidth: 1, borderTopColor: color.borde, flexWrap: 'wrap' },
})

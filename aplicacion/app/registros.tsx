/** Mis registros — implementa ESP-002 RF-002-07 (racha) y RF-002-12.
 *
 *  Detalle de lo que «Ritmo semanal» resume: cada semana con sus cuatro
 *  días de check-in (lunes a jueves), si esa semana contestó el
 *  cuestionario, la racha actual y la mejor. Solo hechos y fechas: aquí no
 *  hay puntajes ni interpretación (RN-004-01).
 *
 *  Antes eran cinco días y el viernes esperaba el cuestionario: una semana
 *  sin él salía incompleta, y ahora el cuestionario no es para todos. */

import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { obtenerTrabajador } from '../modules/acceso/datos'
import { enviosDelEstudio, indiceLunes, inicioDeSemana, racha as consultarRacha, type Racha } from '../modules/recoleccion/datos'
import { ahora } from '../modules/nucleo/reloj'
import { Cargando } from '../modules/nucleo/ui'
import { color, espacio, fuente, radio, texto } from '../modules/nucleo/diseno'
import { IconoCheck, IconoLlama, IconoVolver } from '../modules/nucleo/iconos'

const DIAS = ['L', 'M', 'M', 'J']
type Celda = { estado: 'checkin' | 'omitido' | 'hoy' | 'futuro' | 'previo'; hora?: string }
type Semana = { n: number; lunes: Date; celdas: Celda[]; cumplidos: number; esperados: number; olbi: Date | null; actual: boolean }

export default function Registros() {
  const insets = useSafeAreaInsets()
  const [semanas, setSemanas] = useState<Semana[] | null>(null)
  const [racha, setRacha] = useState<Racha | null>(null)
  const [totales, setTotales] = useState({ dias: 0, olbis: 0, semanasCompletas: 0 })

  const cargar = useCallback(async () => {
    const p = await obtenerTrabajador()
    if (!p) return router.replace('/')
    const [envios, r] = await Promise.all([enviosDelEstudio(p.id), consultarRacha(p.id)])
    setRacha(r)

    const hoy = ahora(); hoy.setHours(12, 0, 0, 0)
    const inscripcion = new Date(p.inscrito_en); inscripcion.setHours(12, 0, 0, 0)
    const lunes0 = inicioDeSemana(inscripcion)
    const lunesHoy = inicioDeSemana(hoy)
    const nSemanas = Math.max(1, Math.round((lunesHoy.getTime() - lunes0.getTime()) / (7 * 86_400_000)) + 1)

    const porDia = new Map<string, { diario?: string; olbi?: Date }>()
    for (const en of envios) {
      const d = new Date(en.enviado_en)
      const clave = claveDia(d)
      const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
      const e = porDia.get(clave) ?? {}
      if (en.clave === 'diario' && !e.diario) e.diario = hora
      if (en.clave === 'olbi') e.olbi = d
      porDia.set(clave, e)
    }

    const lista: Semana[] = []
    let dias = 0, olbis = 0, completas = 0
    for (let s = 0; s < nSemanas; s++) {
      const lunes = new Date(lunes0); lunes.setDate(lunes0.getDate() + s * 7)
      const celdas: Celda[] = []
      let cumplidos = 0, esperados = 0
      let olbi: Date | null = null
      for (let d = 0; d < 7; d++) {
        const dia = new Date(lunes); dia.setDate(lunes.getDate() + d)
        const e = porDia.get(claveDia(dia))
        if (e?.olbi) { olbi = e.olbi; olbis++ }
        if (d >= 4) continue
        if (dia < inscripcion) { celdas.push({ estado: 'previo' }); continue }
        if (dia > hoy) { celdas.push({ estado: 'futuro' }); continue }
        esperados++
        const esHoy = claveDia(dia) === claveDia(hoy)
        if (e?.diario) { cumplidos++; dias++; celdas.push({ estado: 'checkin', hora: e.diario }) }
        else celdas.push({ estado: esHoy ? 'hoy' : 'omitido' })
      }
      if (esperados === 4 && cumplidos === 4) completas++
      lista.push({ n: s + 1, lunes, celdas, cumplidos, esperados, olbi, actual: s === nSemanas - 1 })
    }
    setTotales({ dias, olbis, semanasCompletas: completas })
    setSemanas(lista.reverse())
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!semanas) return <Cargando />

  return (
    <View style={[e.pantalla, { paddingTop: insets.top }]}>
      <View style={e.barra}>
        <Text onPress={() => router.back()} style={e.volver} accessibilityRole="button"><IconoVolver tamano={18} color={color.primarioProfundo} /></Text>
        <Text style={[texto.seccion, { color: color.texto }]}>Mis registros</Text>
      </View>
      <ScrollView contentContainerStyle={e.contenido}>
        {/* Racha y totales */}
        <View style={e.tarjetaRacha}>
          <View style={e.llama}><IconoLlama tamano={22} color={color.tierra} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[texto.cifra, { color: color.texto }]}>{racha?.actual ?? 0} <Text style={[texto.apoyo, { color: color.textoMedio }]}>{(racha?.actual ?? 0) === 1 ? 'día seguido' : 'días seguidos'}</Text></Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              {racha?.hoy_cumplido ? 'Hoy ya cuenta.' : indiceLunes(ahora()) <= 3 ? 'Responde hoy para mantenerla.' : 'Sigue el lunes.'} Tu mejor racha: {racha?.mejor ?? 0} {(racha?.mejor ?? 0) === 1 ? 'día' : 'días'}. El viernes y el fin de semana no la rompen.
            </Text>
          </View>
        </View>
        <View style={e.totales}>
          <Total valor={totales.dias} etiqueta="check-ins" />
          <Total valor={totales.olbis} etiqueta={totales.olbis === 1 ? 'cuestionario completo' : 'cuestionarios completos'} />
          <Total valor={totales.semanasCompletas} etiqueta={totales.semanasCompletas === 1 ? 'semana completa' : 'semanas completas'} />
        </View>

        {/* Semanas */}
        <View style={e.leyenda}>
          <Leyenda tinta={color.primario} texto="Check-in" />
          <Leyenda tinta={color.borde} texto="Sin registro" hueco />
        </View>
        {semanas.map((s) => (
          <View key={s.n} style={[e.semana, s.actual && e.semanaActual]}>
            <View style={e.semanaCabecera}>
              <View>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Semana {s.n}{s.actual ? ' · en curso' : ''}</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>{rango(s.lunes)}</Text>
              </View>
              <View style={[e.pastilla, s.esperados > 0 && s.cumplidos === s.esperados && e.pastillaLlena]}>
                <Text style={[texto.datoFuerte, { color: s.esperados > 0 && s.cumplidos === s.esperados ? '#FFFFFF' : color.textoMedio }]}>{s.esperados ? `${s.cumplidos}/${s.esperados}` : '—'}</Text>
              </View>
            </View>
            <View style={e.filaDias}>
              {s.celdas.map((c, i) => (
                <View key={i} style={e.dia}>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>{DIAS[i]}</Text>
                  <View style={[e.circulo, c.estado === 'checkin' && e.circuloCheckin, c.estado === 'omitido' && e.circuloOmitido, c.estado === 'hoy' && e.circuloHoy, (c.estado === 'futuro' || c.estado === 'previo') && e.circuloFuturo]}>
                    {c.estado === 'checkin' && <IconoCheck tamano={9} color="#FFFFFF" />}
                    {c.estado === 'hoy' && <View style={e.puntoHoy} />}
                  </View>
                  <Text style={[e.hora, { color: c.hora ? color.textoMedio : 'transparent' }]}>{c.hora ?? '00:00'}</Text>
                </View>
              ))}
            </View>
            {s.olbi && (
              <Text style={[texto.apoyo, { color: color.primarioProfundo }]}>
                {`Cuestionario completo · ${s.olbi.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '')}`}
              </Text>
            )}
          </View>
        ))}
        <Text style={[texto.apoyo, { color: color.textoSuave, textAlign: 'center', paddingTop: espacio.sm }]}>
          Un día sin registro no tiene consecuencias: cuenta solo para tu racha. La semana 1 empieza el lunes en que te diste de alta.
        </Text>
      </ScrollView>
    </View>
  )
}

function claveDia(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
function rango(lunes: Date) {
  const jueves = new Date(lunes); jueves.setDate(lunes.getDate() + 3)
  const f = (d: Date) => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${f(lunes)} – ${f(jueves)}`
}
function Total({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return <View style={e.total}><Text style={[texto.cifra, { color: color.texto, fontSize: 22 }]}>{valor}</Text><Text style={[texto.apoyo, { color: color.textoMedio, textAlign: 'center' }]}>{etiqueta}</Text></View>
}
function Leyenda({ tinta, texto: t, hueco }: { tinta: string; texto: string; hueco?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={[e.puntoLeyenda, hueco ? { borderWidth: 1.5, borderColor: tinta } : { backgroundColor: tinta }]} /><Text style={[texto.apoyo, { color: color.textoMedio }]}>{t}</Text></View>
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  barra: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: espacio.base, paddingVertical: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde, backgroundColor: color.superficie },
  volver: { padding: 6 },
  contenido: { padding: espacio.base, gap: espacio.md, paddingBottom: espacio.xxl },
  tarjetaRacha: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base, borderWidth: 1, borderColor: color.borde },
  llama: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.tierraSuave, alignItems: 'center', justifyContent: 'center' },
  totales: { flexDirection: 'row', gap: espacio.sm },
  total: { flex: 1, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.sm, alignItems: 'center', borderWidth: 1, borderColor: color.borde },
  leyenda: { flexDirection: 'row', gap: espacio.md, flexWrap: 'wrap', paddingHorizontal: 4 },
  puntoLeyenda: { width: 10, height: 10, borderRadius: 5 },
  semana: { backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base, gap: espacio.sm, borderWidth: 1, borderColor: color.borde },
  semanaActual: { borderColor: color.primario },
  semanaCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pastilla: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color.superficieSuave },
  pastillaLlena: { backgroundColor: color.primario },
  filaDias: { flexDirection: 'row', justifyContent: 'space-between' },
  dia: { alignItems: 'center', gap: 6, width: 52 },
  circulo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficieSuave },
  circuloCheckin: { backgroundColor: color.primario },
  circuloOmitido: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color.borde },
  circuloHoy: { backgroundColor: color.primarioSuave, borderWidth: 1.5, borderColor: color.primario },
  circuloFuturo: { backgroundColor: color.superficieSuave, opacity: 0.6 },
  puntoHoy: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.primario },
  hora: { fontFamily: fuente.regular, fontSize: 10 },
})

/** Inicio del panel del empresario — implementa ESP-008 rev. 2 (RF-008-13,
 *  RF-008-14, RF-008-15, RF-008-18, RF-008-19). Diseño: Figma
 *  3fRKKoY8Urkjlh1KQkPC9x «Inicio · Administrador de Empresa».
 *
 *  Quien abre esta pantalla dirige un equipo: tres preguntas
 *  en orden —cómo está la gente, qué le está pesando y qué puede hacer esta
 *  semana— escritas como se las diría alguien de viva voz. Fuera «monitor
 *  ejecutivo semanal», «ventana de evaluación sincrónica» y «benchmark».
 *
 *  Ni un puntaje, ni una detección, ni una persona (RN-008-10). Bajo el
 *  mínimo de reporte no hay cifras: hay una explicación y cuánta gente
 *  falta (RN-008-11). */

import { useCallback, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, resumenDeEmpresa, type Empresa, type ResumenEmpresa } from '../../modules/panel/datos'
import {
  FACTORES, factoresEmpresa, fueraDeReferencia, participacionSemanal, pulsoEmpresa, pulsoEstudio, rangoSemana, recomendaciones, umbrales,
  type FactoresSemana, type ParticipacionSemana, type PulsoEstudio, type PulsoSemana, type Umbral,
} from '../../modules/panel/empresario'
import {
  Pie, SinReporte, TarjetaDimension, TarjetaPesa, TarjetaRecomendacion, TarjetaRespondieron, TituloSeccion,
} from '../../modules/panel/PiezasEmpresario'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, texto } from '../../modules/nucleo/diseno'

const MINIMO = 10

export default function InicioEmpresario() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [pulso, setPulso] = useState<PulsoSemana[]>([])
  const [estudio, setEstudio] = useState<PulsoEstudio[]>([])
  const [cortes, setCortes] = useState<Umbral[]>([])
  const [factores, setFactores] = useState<FactoresSemana[]>([])
  const [participacion, setParticipacion] = useState<ParticipacionSemana[]>([])
  const [listo, setListo] = useState(false)
  const { width } = useWindowDimensions()
  const ancha = width >= 1000

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [r, p, es, f, pa, u] = await Promise.all([
        resumenDeEmpresa(em.id), pulsoEmpresa(em.id), pulsoEstudio(), factoresEmpresa(em.id), participacionSemanal(em.id),
        umbrales().catch(() => [] as Umbral[]),
      ])
      setResumen(r); setPulso(p); setEstudio(es); setFactores(f); setParticipacion(pa); setCortes(u)
    }
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>
  if (!empresa) {
    return (
      <Panel rol="admin">
        <Pantalla ancho={ancho.panel}>
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa a soporte.</Aviso>
        </Pantalla>
      </Panel>
    )
  }

  const ultima = pulso[pulso.length - 1]
  /** Los factores de LA MISMA semana que el pulso, no los últimos que haya.
   *
   *  `factores_empresa` incluye la semana en curso —hay check-ins de lunes y
   *  martes— mientras que `pulso_empresa` solo llega hasta el último viernes
   *  contestado. Cogiendo el último del array, «lo que más pesa esta semana»
   *  hablaba de una semana distinta a la de las cifras de arriba, y encima de
   *  una incompleta: el sobretiempo, las guardias y el apoyo del jefe salen
   *  del formulario del viernes, así que llegaban en nulo y nunca podían
   *  pesar. En Nexa Software eso escondía dos de los tres factores fuera de
   *  referencia y dejaba «qué hacer esta semana» sin una sola tarjeta. */
  const ultimosFactores = ultima
    ? factores.find((f) => f.semana === ultima.semana)
    : factores[factores.length - 1]
  const estudioUltima = ultima ? estudio.find((s) => s.semana === ultima.semana) : undefined
  const partUltima = ultima ? participacion.find((s) => s.semana === ultima.semana) : participacion[participacion.length - 1]
  const pesan = ultimosFactores
    ? FACTORES.filter((f) => fueraDeReferencia(f.clave, ultimosFactores[f.clave]))
        .sort((a, b) => (a.clave === 'horas_dia_media' ? -1 : b.clave === 'horas_dia_media' ? 1 : 0))
        .slice(0, 3)
    : []
  const recs = recomendaciones(ultimosFactores, pulso, partUltima).slice(0, 2)
  const hoy = new Date()
  const actualizado = `Al día: ${hoy.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}`

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        {/* Encabezado */}
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 260 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>Cómo está tu equipo</Text>
            <Text style={[texto.titulo, { color: color.texto }]}>{empresa.nombre}</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 320 }]}>
              {ultima
                ? `Lo que contestó la gente la semana del ${rangoSemana(ultima.semana)}, la última cerrada.`
                : 'Todavía no hay ninguna semana cerrada que enseñar.'}
            </Text>
          </View>
          {partUltima && (
            <TarjetaRespondieron respondieron={partUltima.respondieron_viernes} de={partUltima.inscritos} pct={partUltima.tasa_respuesta_pct} />
          )}
        </View>

        {!ultima ? (
          <SinReporte inscritos={resumen?.inscritos ?? 0} minimo={MINIMO} />
        ) : (
          <>
            <View style={e.fila}>
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1, minWidth: 240 }]}>
                Promedio de lo que contesta tu equipo en el cuestionario de burnout, de 1 (nada) a 4 (mucho). No es un porcentaje.
              </Text>
              <Text style={[texto.dato, { color: color.textoSuave }]}>{actualizado}</Text>
            </View>
            <View style={[e.grid, ancha && e.gridFila]}>
              <View style={e.col}><TarjetaDimension dimension="agotamiento" pulso={pulso} estudio={estudioUltima?.agotamiento_media} umbral={cortes.find((c) => c.dimension === 'agotamiento')} /></View>
              <View style={e.col}><TarjetaDimension dimension="desvinculacion" pulso={pulso} estudio={estudioUltima?.desvinculacion_media} umbral={cortes.find((c) => c.dimension === 'desvinculacion')} /></View>
            </View>

            {pesan.length > 0 && (
              <>
                <TituloSeccion titulo="Qué le está pesando al equipo"
                  subtitulo="Lo que se salió de lo previsto esa semana." />
                <View style={[e.grid, ancha && e.gridFila]}>
                  {pesan.map((f) => (
                    <View key={f.clave} style={e.col}><TarjetaPesa clave={f.clave} valor={Number(ultimosFactores![f.clave])} /></View>
                  ))}
                </View>
              </>
            )}

            {recs.length > 0 && (
              <>
                <TituloSeccion titulo="Qué puedes hacer esta semana" punto={color.primario}
                  subtitulo="Para lo de arriba, y de dónde sale cada medida." />
                <View style={[e.grid, ancha && e.gridFila]}>
                  {recs.map((r, i) => <View key={r.id} style={e.col}><TarjetaRecomendacion r={r} numero={i + 1} /></View>)}
                </View>
              </>
            )}
          </>
        )}

        <Pie />
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  grid: { gap: espacio.base },
  gridFila: { flexDirection: 'row' },
  col: { flex: 1, minWidth: 240 },
})

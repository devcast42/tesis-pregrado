/** Inicio del panel del empresario — implementa ESP-008 rev. 2 (RF-008-13,
 *  RF-008-14, RF-008-15, RF-008-18, RF-008-19). Diseño: Figma
 *  3fRKKoY8Urkjlh1KQkPC9x «Inicio · Administrador de Empresa».
 *
 *  El lunes en diez minutos: cómo está la empresa, qué pesa esta semana y
 *  qué hacer. Ni un puntaje, ni una detección, ni una persona (RN-008-10).
 *  Bajo el mínimo de reporte no hay cifras: hay una explicación y cuánta
 *  gente falta (RN-008-11). */

import { useCallback, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, resumenDeEmpresa, type Empresa, type ResumenEmpresa } from '../../modules/panel/datos'
import {
  FACTORES, factoresEmpresa, fueraDeReferencia, participacionSemanal, pulsoEmpresa, pulsoEstudio, rangoSemana, recomendaciones,
  type FactoresSemana, type ParticipacionSemana, type PulsoEstudio, type PulsoSemana,
} from '../../modules/panel/empresario'
import {
  NotaAgregacion, Pie, SinReporte, TarjetaDimension, TarjetaPesa, TarjetaRecomendacion, TarjetaRespondieron, TituloSeccion,
} from '../../modules/panel/PiezasEmpresario'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, texto } from '../../modules/nucleo/diseno'

const MINIMO = 10

export default function InicioEmpresario() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [pulso, setPulso] = useState<PulsoSemana[]>([])
  const [estudio, setEstudio] = useState<PulsoEstudio[]>([])
  const [factores, setFactores] = useState<FactoresSemana[]>([])
  const [participacion, setParticipacion] = useState<ParticipacionSemana[]>([])
  const [listo, setListo] = useState(false)
  const { width } = useWindowDimensions()
  const ancha = width >= 1000

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [r, p, es, f, pa] = await Promise.all([
        resumenDeEmpresa(em.id), pulsoEmpresa(em.id), pulsoEstudio(), factoresEmpresa(em.id), participacionSemanal(em.id),
      ])
      setResumen(r); setPulso(p); setEstudio(es); setFactores(f); setParticipacion(pa)
    }
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>
  if (!empresa) {
    return (
      <Panel rol="admin">
        <Pantalla ancho={ancho.panel}>
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa al equipo del estudio.</Aviso>
        </Pantalla>
      </Panel>
    )
  }

  const ultima = pulso[pulso.length - 1]
  const ultimosFactores = factores[factores.length - 1]
  const estudioUltima = ultima ? estudio.find((s) => s.semana === ultima.semana) : undefined
  const partUltima = ultima ? participacion.find((s) => s.semana === ultima.semana) : participacion[participacion.length - 1]
  const pesan = ultimosFactores
    ? FACTORES.filter((f) => fueraDeReferencia(f.clave, ultimosFactores[f.clave]))
        .sort((a, b) => (a.clave === 'horas_dia_media' ? -1 : b.clave === 'horas_dia_media' ? 1 : 0))
        .slice(0, 3)
    : []
  const recs = recomendaciones(ultimosFactores, pulso, partUltima).slice(0, 2)
  const hoy = new Date()
  const actualizado = `Actualizado hoy, ${hoy.toLocaleDateString('es-PE', { weekday: 'long' })} ${hoy.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        {/* Encabezado */}
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 260 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>
              MONITOR EJECUTIVO SEMANAL{ultima && <Text style={{ color: color.primarioProfundo }}> · SEMANA {pulso.length} DEL ESTUDIO</Text>}
            </Text>
            <Text style={[texto.titulo, { color: color.texto }]}>{empresa.nombre}</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 260 }]}>
              {ultima ? `${rangoSemana(ultima.semana)} · Ventana de evaluación sincrónica de 10 minutos` : 'Sin semana reportable todavía'}
            </Text>
          </View>
          {partUltima && (
            <TarjetaRespondieron respondieron={partUltima.respondieron_viernes} de={partUltima.en_seguimiento} pct={partUltima.tasa_respuesta_pct} />
          )}
        </View>

        {!ultima ? (
          <SinReporte inscritos={resumen?.inscritos ?? 0} minimo={MINIMO} />
        ) : (
          <>
            <View style={e.fila}>
              <Text style={[texto.etiqueta, { color: color.textoMedio }]}>MÉTRICA CENTRAL · <Text style={{ color: color.texto }}>Escala OLBI (1 a 4)</Text></Text>
              <View style={{ flex: 1 }} />
              <Text style={[texto.datoFuerte, { color: color.textoMedio }]}>{actualizado}</Text>
            </View>
            <View style={[e.grid, ancha && e.gridFila]}>
              <View style={e.col}><TarjetaDimension dimension="agotamiento" pulso={pulso} estudio={estudioUltima?.agotamiento_media} /></View>
              <View style={e.col}><TarjetaDimension dimension="desvinculacion" pulso={pulso} estudio={estudioUltima?.desvinculacion_media} /></View>
            </View>

            {pesan.length > 0 && (
              <>
                <TituloSeccion titulo="Lo que más pesa esta semana"
                  subtitulo="Factores organizacionales fuera de rango de referencia y con correlación directa a fatiga" />
                <View style={[e.grid, ancha && e.gridFila]}>
                  {pesan.map((f) => (
                    <View key={f.clave} style={e.col}><TarjetaPesa clave={f.clave} valor={Number(ultimosFactores![f.clave])} /></View>
                  ))}
                </View>
              </>
            )}

            {recs.length > 0 && (
              <>
                <TituloSeccion titulo="Qué hacer esta semana" punto={color.primario}
                  subtitulo="Acciones focalizadas de baja fricción respaldadas por investigación ocupacional" />
                <View style={[e.grid, ancha && e.gridFila]}>
                  {recs.map((r, i) => <View key={r.id} style={e.col}><TarjetaRecomendacion r={r} numero={i + 1} /></View>)}
                </View>
              </>
            )}
          </>
        )}

        <NotaAgregacion respondientes={ultima?.respondientes} minimo={MINIMO} />
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

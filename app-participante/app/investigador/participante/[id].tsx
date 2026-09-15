/** Detalle de un participante individual — implementa ESP-006 RF-006-08.
 *
 *  Muestra el arco completo del participante: adherencia, evolución diaria,
 *  trayectoria OLBI y eventos clave. Solo con código anónimo: el investigador
 *  no ve nombres (RN-006-01). Para contactar a la persona debe pasar por el
 *  administrador de su empresa. */

import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { Bloque, Insignia } from '../../../modules/panel/Piezas'
import { GraficaLinea } from '../../../modules/panel/Grafica'
import {
  obtenerPerfil, obtenerHistorialCheckin, obtenerHistorialOlbi, obtenerEventos,
  type PerfilParticipante, type PuntoCheckin, type PuntoOlbi, type EventoParticipante,
} from '../../../modules/investigador/perfil'
import { Apoyo, Cargando, Pantalla, Parrafo, Tarjeta, Titulo } from '../../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

// ---------------------------------------------------------------------------
// Estado de adherencia
// ---------------------------------------------------------------------------

const ADHERENCIA: Record<string, { nombre: string; tono: 'exito' | 'alerta' | 'peligro' | 'neutro' }> = {
  al_dia:       { nombre: 'Al día',       tono: 'exito' },
  en_riesgo:    { nombre: 'En riesgo',    tono: 'alerta' },
  inactivo:     { nombre: 'Inactivo',     tono: 'peligro' },
  nunca_inicio: { nombre: 'Nunca inició', tono: 'peligro' },
}

const ESTADO_PARTICIPANTE: Record<string, { nombre: string; tono: 'exito' | 'alerta' | 'peligro' | 'neutro' | 'primario' }> = {
  activo:     { nombre: 'En seguimiento', tono: 'primario' },
  detectado:  { nombre: 'Detectado',      tono: 'peligro' },
  retirado:   { nombre: 'Retiró consentimiento', tono: 'neutro' },
  finalizado: { nombre: 'Finalizó el estudio',   tono: 'neutro' },
}

// ---------------------------------------------------------------------------
// Iconos de eventos (texto unicode para no depender de librerías)
// ---------------------------------------------------------------------------

const ICONO_EVENTO: Record<string, string> = {
  inicio_seguimiento:   '▶',
  deteccion:            '⚠',
  derivacion_psicologo: '→',
  sesion_realizada:     '✓',
  salida_seguimiento:   '■',
  alerta_adherencia:    '○',
}

const COLOR_EVENTO: Record<string, string> = {
  inicio_seguimiento:   color.primario,
  deteccion:            color.peligro,
  derivacion_psicologo: color.alerta,
  sesion_realizada:     color.exito,
  salida_seguimiento:   color.textoSuave,
  alerta_adherencia:    color.alerta,
}

const NOMBRE_EVENTO: Record<string, string> = {
  inicio_seguimiento:   'Inició el seguimiento',
  deteccion:            'Detectado por umbral OLBI',
  derivacion_psicologo: 'Derivado a psicólogo',
  sesion_realizada:     'Sesión de apoyo realizada',
  salida_seguimiento:   'Salió del seguimiento',
  alerta_adherencia:    'Alerta de adherencia',
}

// ---------------------------------------------------------------------------
// Pantalla principal
// ---------------------------------------------------------------------------

export default function DetalleParticipante() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const [perfil, setPerfil]         = useState<PerfilParticipante | null>(null)
  const [checkins, setCheckins]     = useState<PuntoCheckin[]>([])
  const [olbi, setOlbi]             = useState<PuntoOlbi[]>([])
  const [eventos, setEventos]       = useState<EventoParticipante[]>([])
  const [cargando, setCargando]     = useState(true)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    try {
      const [p, ch, ol, ev] = await Promise.all([
        obtenerPerfil(id),
        obtenerHistorialCheckin(id, 60),
        obtenerHistorialOlbi(id),
        obtenerEventos(id),
      ])
      setPerfil(p)
      setCheckins(ch)
      setOlbi(ol)
      setEventos(ev)
    } finally {
      setCargando(false)
    }
  }, [id])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (cargando) return <Panel rol="investigador"><Cargando /></Panel>
  if (!perfil)  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <Parrafo suave>No se encontró el participante.</Parrafo>
      </Pantalla>
    </Panel>
  )

  const estadoAdh   = ADHERENCIA[perfil.estado_adherencia ?? '']
  const estadoPart  = ESTADO_PARTICIPANTE[perfil.estado] ?? { nombre: perfil.estado, tono: 'neutro' as const }

  // Series para la gráfica de check-in diario
  const seriesCheckin = [
    {
      etiqueta: 'Carga percibida (1–5)',
      color: color.peligro,
      puntos: checkins.map((c) => ({ x: c.dia, y: c.carga_percibida })),
    },
    {
      etiqueta: 'Horas de sueño',
      color: color.primario,
      puntos: checkins.map((c) => ({ x: c.dia, y: c.horas_sueno })),
    },
  ]

  // Series para la gráfica OLBI
  const seriesOlbi = [
    {
      etiqueta: 'Agotamiento',
      color: color.peligro,
      puntos: olbi.map((o) => ({
        x: o.enviado_en.slice(0, 10),
        y: o.agotamiento,
      })),
    },
    {
      etiqueta: 'Desvinculación',
      color: color.alerta,
      puntos: olbi.map((o) => ({
        x: o.enviado_en.slice(0, 10),
        y: o.desvinculacion,
      })),
    },
  ]

  const tasa = perfil.tasa_adherencia != null
    ? `${(perfil.tasa_adherencia * 100).toFixed(1)}%`
    : '—'

  const diasEnEstudio = perfil.inscrito_en
    ? Math.floor((Date.now() - new Date(perfil.inscrito_en).getTime()) / 86_400_000)
    : null

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>

        {/* Cabecera */}
        <View style={e.cabecera}>
          <Pressable onPress={() => router.back()} style={e.volver}>
            <Text style={[texto.apoyo, { color: color.primario }]}>← Participantes</Text>
          </Pressable>
          <View style={e.cabeceraTitulo}>
            <View style={e.cabeceraIzq}>
              <Titulo>{perfil.codigo_anonimo}</Titulo>
              <Parrafo suave>{perfil.organizacion}</Parrafo>
            </View>
            <View style={e.insignias}>
              <Insignia tono={estadoPart.tono}>{estadoPart.nombre}</Insignia>
              {estadoAdh && <Insignia tono={estadoAdh.tono}>{estadoAdh.nombre}</Insignia>}
            </View>
          </View>
        </View>

        {/* Cifras de cabecera */}
        <View style={e.rejillaMetricas}>
          <Metrica rotulo="Tasa de adherencia" valor={tasa} />
          <Metrica rotulo="Días en el estudio"
            valor={diasEnEstudio != null ? `${diasEnEstudio} d` : '—'} />
          <Metrica rotulo="Check-ins esperados"
            valor={perfil.dias_esperados != null ? String(perfil.dias_esperados) : '—'} />
          <Metrica rotulo="Check-ins cumplidos"
            valor={perfil.dias_cumplidos != null ? String(perfil.dias_cumplidos) : '—'} />
          <Metrica rotulo="OLBIs respondidos"
            valor={String(perfil.olbi_respondidos)} />
          <Metrica
            rotulo="Tiempo hasta detección"
            valor={perfil.dias_hasta_deteccion != null
              ? `${Math.round(Number(perfil.dias_hasta_deteccion))} d` : '—'}
            tono={perfil.dias_hasta_deteccion != null ? color.peligro : undefined}
          />
        </View>

        {/* Gráfica: Carga percibida y sueño diarios */}
        <Bloque
          titulo="Carga y sueño — check-in diario (últimos 60 días)"
          descripcion="Carga percibida en escala 1–5 y horas de sueño declaradas cada día. Un patrón sostenido de carga alta con sueño bajo es la señal de demanda del modelo JD-R."
        >
          {checkins.length === 0 ? (
            <Apoyo>Sin check-ins registrados aún.</Apoyo>
          ) : (
            <GraficaLinea
              series={seriesCheckin}
              yMin={0}
              alto={180}
            />
          )}
        </Bloque>

        {/* Gráfica: Trayectoria OLBI */}
        <Bloque
          titulo="Trayectoria OLBI — agotamiento y desvinculación"
          descripcion="Media por dimensión en cada aplicación quincenal. Escala 1–4. Los umbrales están en revisión con el asesor (provisional-v0)."
        >
          {olbi.length === 0 ? (
            <Apoyo>Sin aplicaciones OLBI registradas aún.</Apoyo>
          ) : (
            <GraficaLinea
              series={seriesOlbi}
              yMin={1}
              yMax={4}
              alto={180}
            />
          )}
        </Bloque>

        {/* Línea de tiempo */}
        <Bloque
          titulo="Línea de tiempo"
          descripcion="Hitos del participante en el estudio. Las evaluaciones diarias no se muestran aquí (son demasiadas); se ven en la gráfica de arriba."
        >
          {eventos.length === 0 ? (
            <Apoyo>Sin eventos registrados aún.</Apoyo>
          ) : (
            <View style={e.timeline}>
              {eventos.map((ev, i) => (
                <View key={`${ev.tipo}-${ev.ocurrido_en}`} style={[e.eventoFila, i === eventos.length - 1 && { borderLeftWidth: 0 }]}>
                  <View style={[e.eventoIcono, { borderColor: COLOR_EVENTO[ev.tipo] ?? color.borde }]}>
                    <Text style={{ fontSize: 11, color: COLOR_EVENTO[ev.tipo] ?? color.textoSuave }}>
                      {ICONO_EVENTO[ev.tipo] ?? '·'}
                    </Text>
                  </View>
                  <View style={e.eventoTexto}>
                    <Text style={[texto.apoyoFuerte, { color: COLOR_EVENTO[ev.tipo] ?? color.texto }]}>
                      {NOMBRE_EVENTO[ev.tipo] ?? ev.tipo}
                    </Text>
                    <Text style={[texto.dato, { color: color.textoSuave }]}>
                      {formatFecha(ev.ocurrido_en)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Bloque>

        {/* Nota de privacidad */}
        <Tarjeta tono="suave">
          <Parrafo suave>
            Esta pantalla muestra solo el código anónimo del participante. Para
            contactar a alguien en riesgo de abandono, el investigador debe pasar
            por el administrador de su empresa, que tiene acceso a la identidad
            de sus propios compañeros.
          </Parrafo>
        </Tarjeta>

      </Pantalla>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Componentes locales
// ---------------------------------------------------------------------------

function Metrica({
  rotulo, valor, tono,
}: {
  rotulo: string
  valor: string
  tono?: string
}) {
  return (
    <View style={e.metrica}>
      <Tarjeta>
        <View style={{ gap: espacio.xs }}>
          <Text style={[texto.etiqueta, { color: color.textoSuave }]}>
            {rotulo.toUpperCase()}
          </Text>
          <Text style={[texto.seccion, { color: tono ?? color.texto }]}>{valor}</Text>
        </View>
      </Tarjeta>
    </View>
  )
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const e = StyleSheet.create({
  cabecera: { gap: espacio.xs },
  volver: { paddingVertical: espacio.xs },
  cabeceraTitulo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: espacio.md, flexWrap: 'wrap',
  },
  cabeceraIzq: { gap: 2, flex: 1 },
  insignias: { flexDirection: 'row', gap: espacio.sm, flexWrap: 'wrap', paddingTop: espacio.xs },

  rejillaMetricas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.md },
  metrica: { flexGrow: 1, flexBasis: 140, minWidth: 140 },

  timeline: { gap: 0 },
  eventoFila: {
    flexDirection: 'row', gap: espacio.md,
    paddingBottom: espacio.md,
    paddingLeft: 20,
    marginLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: color.borde,
  },
  eventoIcono: {
    position: 'absolute',
    left: -12,
    top: 0,
    width: 24, height: 24,
    borderRadius: radio.completo,
    borderWidth: 1.5,
    backgroundColor: color.superficie,
    alignItems: 'center', justifyContent: 'center',
  },
  eventoTexto: { flex: 1, gap: 2 },
})

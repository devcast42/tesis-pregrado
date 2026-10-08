/** Hoy, del psicólogo — ESP-006 RF-006-02, RF-006-13.
 *
 *  Una agenda, porque es lo que un profesional abre por la mañana. Arriba
 *  tres cifras que resumen el día; debajo la semana y, al tocar un día, sus
 *  horas con cada cita en su sitio; y al final lo que espera algo del
 *  psicólogo y no tiene hora: a quién nadie ha contactado y qué notas faltan
 *  por aprobar.
 *
 *  Lo que tiene hora va en el calendario y lo que no, en la lista. Antes
 *  todo iba en listas y una cita por confirmar salía dos veces. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { agenda, listarCasos, psicologoActual, type Caso, type CitaAgenda } from '../../../modules/psicologo/datos'
import { FilaCaso, Seccion } from '../../../modules/psicologo/piezas'
import { LineaDelDia, SemanaCalendario, isoDia, lunesDe } from '../../../modules/psicologo/calendario'
import { BarraSuperior } from '../../../modules/nucleo/armazon'
import { Cargando } from '../../../modules/nucleo/ui'
import { IconoCheckCirculo } from '../../../modules/nucleo/iconos'
import { color, espacio, radio, sombra, texto } from '../../../modules/nucleo/diseno'

/** Lo que pide algo del psicólogo y no tiene una hora en el calendario. */
const SIN_HORA = ['sesion_pendiente', 'informe_por_aprobar', 'sala_lista'] as const

function saludoPorHora(h: number): string {
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function HoyPsicologo() {
  const [casos, setCasos] = useState<Caso[] | null>(null)
  const [citas, setCitas] = useState<CitaAgenda[]>([])
  const [nombre, setNombre] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [dia, setDia] = useState(() => isoDia(new Date()))
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    const [lista, cit, yo] = await Promise.all([listarCasos(), agenda(), psicologoActual()])
    setCasos(lista)
    setCitas(cit)
    setNombre(yo?.nombre ?? '')
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  // Cambia desde fuera: una derivación nueva, una hora que pide alguien.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => { if (estado === 'active') cargar().catch(() => {}) })
    const t = setInterval(() => { cargar().catch(() => {}) }, 60_000)
    return () => { sub.remove(); clearInterval(t) }
  }, [cargar])

  async function refrescar() {
    setRefrescando(true)
    await cargar().catch(() => {})
    setRefrescando(false)
  }

  const marcas = useMemo(() => {
    const m: Record<string, 'pendiente' | 'cita'> = {}
    for (const c of citas) {
      if (c.estado === 'solicitada') m[c.dia] = 'pendiente'
      else if (!m[c.dia]) m[c.dia] = 'cita'
    }
    return m
  }, [citas])

  if (!casos) return <Cargando />

  const ahora = new Date()
  const hoy = isoDia(ahora)
  const citasHoy = citas.filter((c) => c.dia === hoy && c.estado !== 'atendida')
  const porConfirmar = citas.filter((c) => c.estado === 'solicitada')
  const sinHora = casos.filter((c) => (SIN_HORA as readonly string[]).includes(c.estado_caso))
  const delDia = citas.filter((c) => c.dia === dia)
  const fechaDia = new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  const abrirCaso = (id: string) => router.push(`/psicologo/caso/${id}`)

  return (
    <View style={e.pantalla}>
      <BarraSuperior titulo="Hoy" onPerfil={() => router.push('/psicologo/perfil')} />

      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <View style={{ gap: 2 }}>
          <Text style={[texto.etiqueta, { color: color.textoSuave }]}>
            {ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </Text>
          <Text style={[texto.titulo, { color: color.texto }]}>
            {saludoPorHora(ahora.getHours())}{nombre ? `, ${nombre.split(' ')[0]}` : ''}.
          </Text>
        </View>

        {/* Tres cifras que resumen el día. Las que piden algo se tocan. */}
        <View style={e.cifras}>
          <Cifra valor={citasHoy.length} etiqueta={citasHoy.length === 1 ? 'cita hoy' : 'citas hoy'}
            onPress={() => { setLunes(lunesDe(new Date())); setDia(hoy) }} />
          <Cifra valor={porConfirmar.length} etiqueta="por confirmar" tono={porConfirmar.length ? 'alerta' : undefined}
            onPress={porConfirmar[0] ? () => abrirCaso(porConfirmar[0].derivacion_id) : undefined} />
          <Cifra valor={sinHora.length} etiqueta={sinHora.length === 1 ? 'te espera' : 'te esperan'} tono={sinHora.length ? 'tierra' : undefined}
            onPress={() => router.push('/psicologo/casos')} />
        </View>

        {/* La agenda */}
        <View style={e.tarjeta}>
          <SemanaCalendario
            lunes={lunes}
            seleccionado={dia}
            marcas={marcas}
            onSeleccionar={setDia}
            onSemana={(delta) => {
              const l = new Date(lunes); l.setDate(l.getDate() + 7 * delta)
              setLunes(l)
              // En la semana actual se vuelve a hoy; en otra, al mismo día de
              // la semana que estaba elegido.
              if (isoDia(l) === isoDia(lunesDe(new Date()))) { setDia(hoy); return }
              const n = new Date(`${dia}T12:00:00`); n.setDate(n.getDate() + 7 * delta)
              setDia(isoDia(n))
            }}
          />
          <View style={e.divisor} />
          <View style={e.diaCabecera}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>
              {dia === hoy ? 'Hoy' : fechaDia.charAt(0).toUpperCase() + fechaDia.slice(1)}
            </Text>
            <Text style={[texto.dato, { color: color.textoSuave }]}>
              {delDia.length === 0 ? 'libre' : delDia.length === 1 ? '1 cita' : `${delDia.length} citas`}
            </Text>
          </View>
          <LineaDelDia dia={dia} citas={delDia} onCita={(c) => abrirCaso(c.derivacion_id)} />
        </View>

        {/* Lo que espera algo y no tiene hora */}
        {sinHora.length > 0 ? (
          <>
            <Seccion titulo="SIN HORA TODAVÍA" cuenta={sinHora.length} />
            {sinHora.map((c) => <FilaCaso key={c.derivacion_id} caso={c} onPress={() => abrirCaso(c.derivacion_id)} />)}
          </>
        ) : (
          <View style={e.alDia}>
            <IconoCheckCirculo tamano={20} color={color.exito} />
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              Estás al día: no hay nadie esperando contacto ni notas por aprobar.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function Cifra({ valor, etiqueta, tono, onPress }: {
  valor: number
  etiqueta: string
  tono?: 'alerta' | 'tierra'
  onPress?: () => void
}) {
  const tinta = tono === 'alerta' ? color.alerta : tono === 'tierra' ? color.tierra : color.texto
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [e.cifra, pressed && { opacity: 0.75 }]}
    >
      <Text style={[texto.cifra, { color: tinta, fontSize: 28, lineHeight: 32 }]}>{valor}</Text>
      <Text style={[texto.dato, { color: color.textoMedio }]} numberOfLines={1}>{etiqueta}</Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: {
    paddingHorizontal: 16, paddingTop: espacio.base, gap: espacio.md,
    width: '100%', maxWidth: 520, alignSelf: 'center',
  },
  cifras: { flexDirection: 'row', gap: espacio.sm },
  cifra: {
    flex: 1, backgroundColor: color.superficie, borderRadius: radio.lg, paddingVertical: 12, paddingHorizontal: 12,
    gap: 2, ...sombra.suave,
  },
  tarjeta: {
    backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.base,
    gap: espacio.md, ...sombra.suave,
  },
  divisor: { height: 1, backgroundColor: color.borde, marginHorizontal: -espacio.base },
  diaCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.sm },
  alDia: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: color.exitoSuave, borderRadius: radio.lg, padding: espacio.base,
  },
})

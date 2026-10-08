/** Hoy, del psicólogo — ESP-006 RF-006-02, RF-006-13.
 *
 *  La pregunta de esta pantalla es «qué me toca», igual que la del
 *  trabajador. Antes no existía: la entrada era la lista de casos, con la
 *  agenda metida dentro como una tarjeta, así que para saber si había algo a
 *  las cuatro había que abrir otra pantalla y volver.
 *
 *  Tres bloques y en este orden: lo de hoy, quién está esperando y lo que
 *  viene. Lo clínico —puntajes, trayectoria, nota— vive en la ficha: aquí
 *  solo se decide a quién abrir. */

import { useCallback, useEffect, useState } from 'react'
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { agenda, listarCasos, psicologoActual, type Caso, type CitaAgenda } from '../../../modules/psicologo/datos'
import { FilaCaso, FilaCita, Seccion } from '../../../modules/psicologo/piezas'
import { BarraSuperior, Saludo } from '../../../modules/nucleo/armazon'
import { Cargando } from '../../../modules/nucleo/ui'
import { IconoHoja } from '../../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

/** Los estados que piden algo del psicólogo hoy mismo. El resto está en
 *  marcha y no necesita que nadie mueva un dedo. */
const ESPERAN = ['sesion_pendiente', 'cita_por_confirmar', 'informe_por_aprobar', 'sala_lista'] as const

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** «Hoy», «Mañana» o «lunes 6 de octubre». La cuenta de qué día es la hace
 *  la pantalla, no quien la lee. */
function tituloDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function saludoPorHora(h: number): string {
  if (h < 12) return 'Buenos días.'
  if (h < 19) return 'Buenas tardes.'
  return 'Buenas noches.'
}

/** Una línea que resuma el día antes de bajar a las listas. */
function resumen(citasHoy: number, esperan: number): string {
  if (citasHoy === 0 && esperan === 0) return 'No tienes nada pendiente. Te avisaremos si deriva alguien.'
  const partes: string[] = []
  if (citasHoy > 0) partes.push(citasHoy === 1 ? 'Una cita hoy' : `${citasHoy} citas hoy`)
  if (esperan > 0) partes.push(esperan === 1 ? 'una persona esperando' : `${esperan} personas esperando`)
  return `${partes.join(' y ')}.`
}

export default function HoyPsicologo() {
  const [casos, setCasos] = useState<Caso[] | null>(null)
  const [citas, setCitas] = useState<CitaAgenda[]>([])
  const [nombre, setNombre] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    const [lista, cit, yo] = await Promise.all([listarCasos(), agenda(), psicologoActual()])
    setCasos(lista)
    setCitas(cit)
    setNombre(yo?.nombre ?? '')
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  // La lista cambia desde fuera: una derivación nueva, una hora que pide un
  // trabajador. Se vuelve a pedir al volver la app al frente y cada minuto.
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

  if (!casos) return <Cargando />

  const ahora = new Date()
  const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
  const deHoy = citas.filter((c) => c.dia === hoyIso)
  const proximas = citas.filter((c) => c.dia > hoyIso)
  const esperan = casos.filter((c) => (ESPERAN as readonly string[]).includes(c.estado_caso))
  const diasProximos = [...new Set(proximas.map((c) => c.dia))]

  const abrirCaso = (id: string) => router.push(`/psicologo/caso/${id}`)
  const fecha = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <View style={e.pantalla}>
      <BarraSuperior titulo="Hoy" onPerfil={() => router.push('/psicologo/perfil')} />

      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <Saludo
          fecha={fecha}
          titulo={saludoPorHora(ahora.getHours())}
          subtitulo={resumen(deHoy.length, esperan.length)}
          derecha={!!nombre && (
            <Text style={[texto.apoyo, { color: color.textoMedio }]} numberOfLines={1}>{nombre}</Text>
          )}
        />

        {deHoy.length > 0 && (
          <>
            <Seccion titulo="TUS CITAS DE HOY" cuenta={deHoy.length} />
            {deHoy.map((c) => (
              <FilaCita
                key={c.cita_id}
                hora={hora(c.propuesta_para)}
                codigo={c.codigo_anonimo}
                detalle={c.sesion_en_curso ? 'Sala abierta · entra ahora'
                  : c.estado === 'solicitada' ? 'La pidió y falta que la confirmes'
                  : 'Confirmada'}
                urgente={c.sesion_en_curso}
                onPress={() => abrirCaso(c.derivacion_id)}
              />
            ))}
          </>
        )}

        {esperan.length > 0 && (
          <>
            <Seccion titulo="TE ESPERAN" cuenta={esperan.length} />
            {esperan.map((c) => (
              <FilaCaso key={c.derivacion_id} caso={c} onPress={() => abrirCaso(c.derivacion_id)} />
            ))}
          </>
        )}

        {diasProximos.map((dia) => (
          <View key={dia} style={e.grupo}>
            <Seccion titulo={tituloDia(dia).toUpperCase()} cuenta={proximas.filter((c) => c.dia === dia).length} />
            {proximas.filter((c) => c.dia === dia).map((c) => (
              <FilaCita
                key={c.cita_id}
                hora={hora(c.propuesta_para)}
                codigo={c.codigo_anonimo}
                detalle={c.estado === 'solicitada' ? 'La pidió y falta que la confirmes' : 'Confirmada'}
                onPress={() => abrirCaso(c.derivacion_id)}
              />
            ))}
          </View>
        ))}

        {deHoy.length === 0 && esperan.length === 0 && proximas.length === 0 && (
          <View style={e.vacio}>
            <View style={e.vacioIcono}><IconoHoja tamano={18} color={color.textoMedio} /></View>
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              Nada por hacer ahora mismo. Cuando el sistema derive a alguien o pidan una hora,
              aparecerá aquí.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: {
    paddingHorizontal: 20, paddingTop: espacio.base, paddingBottom: espacio.xxl, gap: espacio.sm,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  grupo: { gap: espacio.sm },
  vacio: {
    flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start',
    backgroundColor: color.superficieSuave, borderRadius: radio.xl, padding: espacio.md, marginTop: espacio.base,
  },
  vacioIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
})

/** Agenda del psicólogo — producto.
 *
 *  Lo primero que abre un profesional por la mañana, y lo único que no
 *  existía: qué tengo hoy. Antes las citas vivían dentro de cada caso, así
 *  que para saber si tenía algo a las cuatro había que entrar uno por uno.
 *
 *  Agrupada por día y no por caso, porque la pregunta es «qué me toca» y no
 *  «cómo va fulano». Para eso está la ficha del caso. */

import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { agenda, type CitaAgenda } from '../../modules/psicologo/datos'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCalendario, IconoReloj } from '../../modules/nucleo/iconos'

/** «Hoy», «Mañana» o «lunes 6 de octubre». Una fecha suelta obliga a calcular
 *  si es hoy, y esa cuenta la tiene que hacer la pantalla, no la persona. */
function tituloDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias === -1) return 'Ayer'
  const t = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function Agenda() {
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null)
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => { setCitas(await agenda()) }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function refrescar() {
    setRefrescando(true)
    await cargar().catch(() => {})
    setRefrescando(false)
  }

  if (!citas) return <Cargando />

  const dias = [...new Set(citas.map((c) => c.dia))]

  return (
    <ScrollView
      style={{ backgroundColor: color.fondo }}
      contentContainerStyle={[e.contenido, { paddingTop: insets.top + espacio.base }]}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
    >
      <Text style={[texto.titulo, { color: color.texto }]}>Tu agenda</Text>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        Las citas de todos tus casos, por día.
      </Text>

      {dias.length === 0 && (
        <View style={e.vacio}>
          <IconoCalendario tamano={22} color={color.textoSuave} />
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>No tienes nada pendiente</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, textAlign: 'center' }]}>
            Cuando alguien pida una cita, o propongas tú una desde su caso, aparecerá aquí.
          </Text>
        </View>
      )}

      {dias.map((dia) => (
        <View key={dia} style={{ gap: espacio.sm }}>
          <Text style={[texto.etiqueta, { color: color.textoMedio }]}>{tituloDia(dia).toUpperCase()}</Text>
          {citas.filter((c) => c.dia === dia).map((c) => (
            <Pressable
              key={c.cita_id}
              onPress={() => router.push(`/psicologo/caso/${c.derivacion_id}`)}
              style={({ pressed }) => [e.cita, pressed && { opacity: 0.85 }]}
            >
              <View style={e.horaCaja}>
                <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{hora(c.propuesta_para)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]} numberOfLines={1}>
                  {c.nombre ?? c.codigo_anonimo}
                </Text>
                {c.motivo && (
                  <Text style={[texto.dato, { color: color.textoMedio }]} numberOfLines={2}>{c.motivo}</Text>
                )}
                <View style={e.fila}>
                  {/* «Solicitada» es trabajo pendiente para él: hay que
                      confirmarla o cancelarla, y desde aquí se ve de un
                      vistazo cuántas esperan respuesta. */}
                  {c.estado === 'solicitada' && (
                    <View style={[e.pastilla, { backgroundColor: '#FBEFD9' }]}>
                      <Text style={[texto.dato, { color: '#8A5A12' }]}>Falta que la confirmes</Text>
                    </View>
                  )}
                  {c.sesion_en_curso && (
                    <View style={[e.pastilla, { backgroundColor: '#DDF3EA' }]}>
                      <IconoReloj tamano={12} color={color.primarioProfundo} />
                      <Text style={[texto.dato, { color: color.primarioProfundo }]}>Sesión abierta</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.base, paddingBottom: espacio.xl, gap: espacio.base, maxWidth: 680, width: '100%', alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, flexWrap: 'wrap' },
  cita: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base, borderWidth: 1, borderColor: color.borde },
  horaCaja: { backgroundColor: '#E8EFEA', borderRadius: radio.sm, paddingHorizontal: 10, paddingVertical: 6 },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vacio: { alignItems: 'center', gap: espacio.sm, padding: espacio.xl, backgroundColor: color.superficie, borderRadius: radio.lg, borderWidth: 1, borderColor: color.borde },
})

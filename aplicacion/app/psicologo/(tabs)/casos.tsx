/** Casos del psicólogo — ESP-006 RF-006-02.
 *
 *  Toda su gente, agrupada por lo que toca hacer y no por un estado que haya
 *  que interpretar. Antes había dos formas de ver lo mismo —unas pestañas
 *  Activos/Cerrados y, dentro de Activos, un «Historial cerrado» plegable— y
 *  cada caso era una tarjeta con el estado, la fecha, una banda con el OLBI,
 *  otra con la cita y un botón propio. Con cinco casos era un muro y, al
 *  gritar todos igual, no se veía cuál urgía.
 *
 *  Solo las derivaciones de este psicólogo: lo impone RLS, no esta pantalla. */

import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { listarCasos, type Caso } from '../../../modules/psicologo/datos'
import { FilaCaso, Seccion } from '../../../modules/psicologo/piezas'
import { BarraSuperior } from '../../../modules/nucleo/armazon'
import { Cargando } from '../../../modules/nucleo/ui'
import { IconoArchivo, IconoChevronAbajo, IconoHoja } from '../../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

/** Los que piden algo del psicólogo. El resto está en marcha. */
const ESPERAN = ['sesion_pendiente', 'cita_por_confirmar', 'informe_por_aprobar', 'sala_lista'] as const

/** Dentro de «te esperan», primero el que lleva más tiempo sin respuesta:
 *  una sala abierta es de ahora mismo, una derivación sin contactar de hace
 *  doce días es lo que de verdad se está cayendo. */
const ORDEN: Record<string, number> = {
  sala_lista: 0, cita_por_confirmar: 1, informe_por_aprobar: 2, sesion_pendiente: 3,
}

export default function Casos() {
  const [casos, setCasos] = useState<Caso[] | null>(null)
  const [verCerrados, setVerCerrados] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => { setCasos(await listarCasos()) }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function refrescar() {
    setRefrescando(true)
    await cargar().catch(() => {})
    setRefrescando(false)
  }

  if (!casos) return <Cargando />

  const esperan = casos
    .filter((c) => (ESPERAN as readonly string[]).includes(c.estado_caso))
    .sort((a, b) => (ORDEN[a.estado_caso] ?? 9) - (ORDEN[b.estado_caso] ?? 9))
  const enMarcha = casos.filter((c) => c.estado_caso === 'cita_confirmada')
  const cerrados = casos.filter((c) => c.estado_caso === 'cerrado')
  const abrir = (id: string) => router.push(`/psicologo/caso/${id}`)

  return (
    <View style={e.pantalla}>
      <BarraSuperior titulo="Casos" onPerfil={() => router.push('/psicologo/perfil')} />

      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <View style={{ gap: espacio.xs }}>
          <Text style={[texto.titulo, { color: color.texto }]}>Tu gente</Text>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
            {casos.length === 0 ? 'Todavía no te han derivado a nadie.'
              : `${casos.length} ${casos.length === 1 ? 'persona derivada' : 'personas derivadas'}. Abre una para ver su ficha.`}
          </Text>
        </View>

        {esperan.length > 0 && (
          <>
            <Seccion titulo="TE ESPERAN" cuenta={esperan.length} />
            {esperan.map((c) => <FilaCaso key={c.derivacion_id} caso={c} onPress={() => abrir(c.derivacion_id)} />)}
          </>
        )}

        {enMarcha.length > 0 && (
          <>
            <Seccion titulo="EN MARCHA" cuenta={enMarcha.length} />
            {enMarcha.map((c) => <FilaCaso key={c.derivacion_id} caso={c} onPress={() => abrir(c.derivacion_id)} />)}
          </>
        )}

        {cerrados.length > 0 && (
          <>
            <Pressable
              onPress={() => setVerCerrados((v) => !v)}
              accessibilityRole="button"
              style={({ pressed }) => [e.plegable, pressed && { opacity: 0.7 }]}
            >
              <IconoArchivo tamano={16} color={color.textoMedio} />
              <Text style={[texto.cuerpoFuerte, { color: color.textoMedio, flex: 1 }]}>
                Cerrados ({cerrados.length})
              </Text>
              <View style={verCerrados ? e.chevronAbierto : undefined}>
                <IconoChevronAbajo tamano={14} color={color.textoMedio} />
              </View>
            </Pressable>
            {verCerrados && cerrados.map((c) => (
              <FilaCaso key={c.derivacion_id} caso={c} onPress={() => abrir(c.derivacion_id)} />
            ))}
          </>
        )}

        {casos.length === 0 && (
          <View style={e.vacio}>
            <View style={e.vacioIcono}><IconoHoja tamano={18} color={color.textoMedio} /></View>
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              Cuando el sistema derive a un trabajador, aparecerá aquí automáticamente.
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
  plegable: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingVertical: 12, marginTop: espacio.xs,
  },
  chevronAbierto: { transform: [{ rotate: '180deg' }] },
  vacio: {
    flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start',
    backgroundColor: color.superficieSuave, borderRadius: radio.xl, padding: espacio.md, marginTop: espacio.base,
  },
  vacioIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
})

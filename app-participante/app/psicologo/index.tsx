/** Casos derivados — implementa ESP-006 RF-006-02 y RF-006-13.
 *
 *  Diseño: Figma «Casos Derivados · Psicólogo». Solo aparecen las
 *  derivaciones de este psicólogo: lo impone RLS, no esta pantalla. Los
 *  cerrados van aparte, plegados. */

import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cerrarSesion } from '../../modules/acceso/datos'
import { listarCasos, psicologoActual, type Caso } from '../../modules/psicologo/datos'
import { TarjetaCaso } from '../../modules/psicologo/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoArchivo, IconoHoja, IconoPersona } from '../../modules/nucleo/iconos'

export default function Casos() {
  const [casos, setCasos] = useState<Caso[] | null>(null)
  const [nombre, setNombre] = useState<string>('')
  const [pestana, setPestana] = useState<'activos' | 'cerrados'>('activos')
  const [verCerrados, setVerCerrados] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    const [lista, yo] = await Promise.all([listarCasos(), psicologoActual()])
    setCasos(lista)
    setNombre(yo?.nombre ?? '')
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  // La lista cambia desde fuera (una reasignación del investigador, una cita
  // nueva): se vuelve a pedir al volver la app al frente y cada minuto, sin
  // que haga falta salir y entrar.
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

  const activos = casos.filter((c) => c.estado_caso !== 'cerrado')
  const cerrados = casos.filter((c) => c.estado_caso === 'cerrado')
  const visibles = pestana === 'activos' ? activos : cerrados

  return (
    <View style={[e.pantalla, { paddingTop: insets.top }]}>
      <View style={e.barra}>
        <View style={{ flex: 1 }}>
          <Text style={[texto.etiqueta, { color: color.textoMedio }]}>PROTOCOLO DE ASISTENCIA CLÍNICA</Text>
          {!!nombre && <Text style={[texto.apoyo, { color: color.textoSuave }]}>{nombre}</Text>}
        </View>
        <Pressable onPress={() => cerrarSesion().then(() => router.replace('/'))} style={e.avatar} accessibilityRole="button" accessibilityLabel="Cerrar sesión">
          <IconoPersona tamano={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <View style={[e.fila, { alignItems: 'flex-end' }]}>
          <Text style={[texto.titulo, { flex: 1 }]}>Casos derivados</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            {casos.length} {casos.length === 1 ? 'participante' : 'participantes'}
          </Text>
        </View>
        <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
          Participantes del estudio con criterios de derivación confidencial activados.
        </Text>

        <View style={e.pestanas}>
          {(['activos', 'cerrados'] as const).map((p) => (
            <Pressable key={p} onPress={() => setPestana(p)} style={[e.pestana, pestana === p && e.pestanaActiva]} accessibilityRole="tab">
              <Text style={[texto.cuerpoFuerte, { color: pestana === p ? color.texto : color.textoMedio }]}>
                {p === 'activos' ? 'Activos' : 'Cerrados'}
              </Text>
              <View style={[e.conteo, pestana === p && { backgroundColor: color.primarioSuave }]}>
                <Text style={[texto.dato, { color: pestana === p ? color.primarioProfundo : color.textoMedio }]}>
                  {p === 'activos' ? activos.length : cerrados.length}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {visibles.map((c) => (
          <TarjetaCaso key={c.derivacion_id} caso={c} onPress={() => router.push(`/psicologo/caso/${c.derivacion_id}`)} />
        ))}

        {pestana === 'activos' && cerrados.length > 0 && (
          <Pressable onPress={() => setVerCerrados((v) => !v)} style={e.historial} accessibilityRole="button">
            <IconoArchivo tamano={18} color={color.textoMedio} />
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Historial cerrado</Text>
            <View style={e.conteo}><Text style={[texto.dato, { color: color.textoMedio }]}>{cerrados.length}</Text></View>
          </Pressable>
        )}
        {pestana === 'activos' && verCerrados && cerrados.map((c) => (
          <TarjetaCaso key={c.derivacion_id} caso={c} onPress={() => router.push(`/psicologo/caso/${c.derivacion_id}`)} />
        ))}

        <View style={e.vacio}>
          <View style={e.vacioIcono}><IconoHoja tamano={18} color={color.textoMedio} /></View>
          <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
            {visibles.length === 0
              ? 'No tienes casos asignados. Cuando el sistema derive a alguien, aparecerá aquí automáticamente.'
              : 'No tienes más casos asignados. Cuando el sistema derive a un nuevo participante del estudio, aparecerá aquí automáticamente.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  contenido: { paddingHorizontal: 20, paddingBottom: espacio.xxl, gap: espacio.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  pestanas: { flexDirection: 'row', backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: 4, gap: 4 },
  pestana: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: radio.md },
  pestanaActiva: { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde },
  conteo: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: color.borde, alignItems: 'center', justifyContent: 'center' },
  historial: {
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.md, borderWidth: 1, borderColor: color.borde,
  },
  vacio: { flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start', backgroundColor: color.superficieSuave, borderRadius: radio.xl, padding: espacio.md },
  vacioIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
})

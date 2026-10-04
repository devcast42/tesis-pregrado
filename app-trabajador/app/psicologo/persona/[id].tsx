/** Historia clínica de una persona — producto.
 *
 *  Hasta aquí el psicólogo veía casos sueltos: si alguien cruzaba el umbral
 *  dos veces eran dos filas sin relación, y al cerrarse el primero perdía
 *  hasta el nombre. Atender a quien vuelve sin saber qué pasó la vez anterior
 *  no es atender, es empezar de cero.
 *
 *  El alcance sigue siendo suyo: solo las personas que él atendió. Lo impone
 *  `historia_clinica`, no esta pantalla.
 *
 *  Aquí no va el contenido de los informes. Cada uno se abre desde su sesión,
 *  que es donde el psicólogo decide si lo lee. */

import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { historiaClinica, type EpisodioHistoria } from '../../../modules/psicologo/datos'
import { Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoApoyo, IconoNota } from '../../../modules/nucleo/iconos'

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** «3 semanas», «2 meses». Cuánto duró importa más que las fechas exactas. */
function duracion(desde: string, hasta: string | null): string {
  const dias = Math.round((new Date(hasta ?? Date.now()).getTime() - new Date(desde).getTime()) / 86_400_000)
  if (dias < 14) return `${dias} ${dias === 1 ? 'día' : 'días'}`
  if (dias < 60) return `${Math.round(dias / 7)} semanas`
  return `${Math.round(dias / 30)} meses`
}

export default function Persona() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [episodios, setEpisodios] = useState<EpisodioHistoria[] | null>(null)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    if (id) setEpisodios(await historiaClinica(id))
  }, [id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!episodios) return <Cargando />

  const quien = episodios[0]
  const abierto = episodios.find((x) => !x.cerrada_en)
  const sesiones = episodios.reduce((a, x) => a + x.sesiones, 0)

  return (
    <ScrollView
      style={{ backgroundColor: color.fondo }}
      contentContainerStyle={[e.contenido, { paddingTop: insets.top + espacio.base }]}
    >
      <Text style={[texto.titulo, { color: color.texto }]}>{quien?.nombre ?? quien?.codigo_anonimo ?? '—'}</Text>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        {episodios.length === 1
          ? 'Un acompañamiento.'
          : `${episodios.length} acompañamientos, ${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'} en total.`}
        {abierto ? ' Hay uno abierto.' : ''}
      </Text>

      {episodios.map((x, i) => {
        const vigente = !x.cerrada_en
        return (
          <Pressable
            key={x.derivacion_id}
            onPress={() => router.push(`/psicologo/caso/${x.derivacion_id}`)}
            style={({ pressed }) => [e.episodio, vigente && e.episodioAbierto, pressed && { opacity: 0.85 }]}
          >
            <View style={e.fila}>
              <View style={[e.sello, vigente && { backgroundColor: '#DDF3EA' }]}>
                <IconoApoyo tamano={16} color={vigente ? color.primarioProfundo : color.textoMedio} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                  {/* Se numera del más reciente al más antiguo, pero el número
                      va al revés: el primer episodio es el primero que tuvo. */}
                  {vigente ? 'Acompañamiento abierto' : `Acompañamiento ${episodios.length - i}`}
                </Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  Desde el {fecha(x.abierta_en)} · {duracion(x.abierta_en, x.cerrada_en)}
                </Text>
              </View>
            </View>

            <View style={[e.fila, { gap: espacio.base, paddingLeft: 44, flexWrap: 'wrap' }]}>
              <Dato valor={String(x.sesiones)} rotulo={x.sesiones === 1 ? 'sesión' : 'sesiones'} />
              <Dato valor={String(x.informes_aprobados)} rotulo={x.informes_aprobados === 1 ? 'informe' : 'informes'} />
              {x.ultima_sesion && <Dato valor={fecha(x.ultima_sesion)} rotulo="última" />}
            </View>

            {x.sesiones === 0 && (
              <Text style={[texto.dato, { color: color.textoSuave, paddingLeft: 44 }]}>
                No llegó a haber sesión.
              </Text>
            )}
          </Pressable>
        )
      })}

      {episodios.length === 0 && (
        <View style={e.vacio}>
          <IconoNota tamano={22} color={color.textoSuave} />
          <Text style={[texto.apoyo, { color: color.textoMedio, textAlign: 'center' }]}>
            No has atendido a esta persona.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function Dato({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{valor}</Text>
      <Text style={[texto.dato, { color: color.textoSuave }]}>{rotulo}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.base, paddingBottom: espacio.xl, gap: espacio.base, maxWidth: 680, width: '100%', alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  episodio: { gap: espacio.sm, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base, borderWidth: 1, borderColor: color.borde },
  episodioAbierto: { borderColor: color.primario },
  sello: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDEBE7', alignItems: 'center', justifyContent: 'center' },
  vacio: { alignItems: 'center', gap: espacio.sm, padding: espacio.xl, backgroundColor: color.superficie, borderRadius: radio.lg, borderWidth: 1, borderColor: color.borde },
})

/** Detalle del caso — implementa ESP-006 RF-006-03.
 *
 *  La identidad se pide aparte y de forma explícita: no viaja con el resto
 *  del caso. Cada consulta deja registro en `eventos` (RN-006-03). */

import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  cerrarDerivacion,
  crearSesion,
  eventoDeteccion,
  obtenerDerivacion,
  obtenerIdentidad,
  sesionesDe,
  trayectoriaOlbi,
  type Derivacion,
  type PuntajeOlbi,
  type SesionConsulta,
} from '../../../modules/psicologo/datos'
import {
  Apoyo, Boton, Cargando, Pantalla, Parrafo, Seccion, Tarjeta, Titulo, Vacio,
} from '../../../modules/nucleo/ui'
import { color, espacio, texto } from '../../../modules/nucleo/diseno'

const DIMENSION: Record<string, string> = {
  agotamiento: 'Agotamiento',
  desvinculacion: 'Desvinculación',
}

export default function Caso() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [derivacion, setDerivacion] = useState<Derivacion | null>(null)
  const [trayectoria, setTrayectoria] = useState<PuntajeOlbi[]>([])
  const [deteccion, setDeteccion] = useState<{ ocurrido_en: string } | null>(null)
  const [sesiones, setSesiones] = useState<SesionConsulta[]>([])
  const [identidad, setIdentidad] = useState<{ nombre: string; correo_contacto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const d = await obtenerDerivacion(id)
    if (!d) return router.replace('/psicologo')
    setDerivacion(d)
    const [t, e, s] = await Promise.all([
      trayectoriaOlbi(d.participante_id),
      eventoDeteccion(d.participante_id),
      sesionesDe(d.id),
    ])
    setTrayectoria(t)
    setDeteccion(e)
    setSesiones(s)
  }, [id])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function revelarIdentidad() {
    if (!derivacion) return
    try {
      setIdentidad(await obtenerIdentidad(derivacion.participante_id))
    } catch {
      Alert.alert('No disponible', 'No tienes una derivación abierta para este participante.')
    }
  }

  async function iniciarSesion() {
    if (!derivacion) return
    setOcupado(true)
    try {
      const sesion = await crearSesion(derivacion.id)
      router.push(`/psicologo/consulta/${sesion.id}`)
    } catch {
      Alert.alert('No se pudo crear la sesión', 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  async function cerrar() {
    if (!derivacion) return
    await cerrarDerivacion(derivacion.id)
    router.replace('/psicologo')
  }

  if (!derivacion) return <Cargando />

  const porFecha = agruparPorFecha(trayectoria)

  return (
    <Pantalla>
      <Titulo>{derivacion.codigo_anonimo}</Titulo>

      {/* RN-006-02 — el anonimato protege el dataset; la atención clínica
          exige identidad. Revelarla es una acción explícita y registrada. */}
      <Seccion titulo="Identidad">
        <Tarjeta tono={identidad ? undefined : 'suave'}>
          {identidad ? (
            <View style={e.identidad}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{identidad.nombre}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]} selectable>
                {identidad.correo_contacto}
              </Text>
            </View>
          ) : (
            <View style={e.identidad}>
              <Parrafo suave>
                Los datos personales se muestran solo cuando los solicitas, y queda registro
                del acceso.
              </Parrafo>
              <Boton variante="secundario" onPress={revelarIdentidad}>
                Ver datos de contacto
              </Boton>
            </View>
          )}
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Detección">
        <Tarjeta>
          <Text style={[texto.cuerpo, { color: color.texto }]}>
            {deteccion
              ? new Date(deteccion.ocurrido_en).toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })
              : 'Sin evento de detección registrado'}
          </Text>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Trayectoria OLBI">
        {porFecha.length === 0 ? (
          <Vacio>Aún no hay mediciones.</Vacio>
        ) : (
          <Tarjeta>
            {porFecha.map((fila) => (
              <View key={fila.fecha} style={e.filaTrayectoria}>
                <Text style={[texto.apoyo, e.fecha]}>
                  {new Date(fila.fecha).toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short',
                  })}
                </Text>
                {Object.entries(fila.dimensiones).map(([dim, valor]) => (
                  <Text key={dim} style={[texto.apoyo, { color: color.textoMedio }]}>
                    {DIMENSION[dim] ?? dim}{' '}
                    <Text style={[texto.apoyoFuerte, { color: color.texto }]}>
                      {valor.toFixed(2)}
                    </Text>
                  </Text>
                ))}
              </View>
            ))}
          </Tarjeta>
        )}
        <Apoyo>Escala de 1 a 4. Un puntaje más alto indica mayor agotamiento.</Apoyo>
      </Seccion>

      <Seccion titulo="Sesiones">
        {sesiones.length === 0 ? (
          <Vacio>Todavía no hay sesiones.</Vacio>
        ) : (
          <View style={e.sesiones}>
            {sesiones.map((s) => (
              <Tarjeta key={s.id} onPress={() => router.push(`/psicologo/informe/${s.id}`)}>
                <View style={e.sesion}>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                    {new Date(s.iniciada_en).toLocaleDateString('es-PE', {
                      day: 'numeric', month: 'long',
                    })}
                  </Text>
                  <Text style={[texto.apoyo, { color: color.textoSuave }]}>
                    {s.finalizada_en ? 'Finalizada · ver informe' : 'En curso'}
                  </Text>
                </View>
              </Tarjeta>
            ))}
          </View>
        )}
      </Seccion>

      <View style={e.acciones}>
        <Boton onPress={iniciarSesion} cargando={ocupado}>
          Iniciar videoconsulta
        </Boton>
        {/* RF-006-06 — al cerrar, este psicólogo pierde el acceso al caso. */}
        <Boton variante="texto" onPress={cerrar}>
          Cerrar el caso
        </Boton>
      </View>
    </Pantalla>
  )
}

function agruparPorFecha(puntajes: PuntajeOlbi[]) {
  const mapa = new Map<string, Record<string, number>>()
  for (const p of puntajes) {
    const fecha = p.enviado_en.slice(0, 10)
    const actual = mapa.get(fecha) ?? {}
    actual[p.dimension] = Number(p.puntaje)
    mapa.set(fecha, actual)
  }
  return [...mapa.entries()].map(([fecha, dimensiones]) => ({ fecha, dimensiones }))
}

const e = StyleSheet.create({
  identidad: { gap: espacio.md },
  filaTrayectoria: {
    flexDirection: 'row', gap: espacio.base, alignItems: 'center',
    paddingVertical: espacio.xs, flexWrap: 'wrap',
  },
  fecha: { color: color.textoSuave, width: 70 },
  sesiones: { gap: espacio.md },
  sesion: { gap: 2 },
  acciones: { gap: espacio.xs, paddingTop: espacio.sm },
})

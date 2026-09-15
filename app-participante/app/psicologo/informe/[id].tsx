/** Revisión del informe — implementa ESP-004 RF-004-09 … RF-004-12.
 *
 *  El borrador es un apoyo administrativo, no un diagnóstico (RN-004-01).
 *  Nada se da por válido hasta que el psicólogo lo aprueba (RN-004-02), y el
 *  borrador original queda intacto: la base de datos impide modificarlo. */

import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  aprobarInforme,
  obtenerInforme,
  psicologoActual,
  type Informe,
} from '../../../modules/psicologo/datos'
import {
  Apoyo, Aviso, Boton, Cargando, Entrada, Etiqueta, Pantalla, Titulo, Vacio,
} from '../../../modules/nucleo/ui'
import { espacio } from '../../../modules/nucleo/diseno'

const ETIQUETAS: Record<string, string> = {
  temas_tratados: 'Temas tratados',
  situaciones_laborales_mencionadas: 'Situaciones laborales mencionadas',
  recursos_de_apoyo_mencionados: 'Recursos de apoyo mencionados',
  acuerdos_de_la_sesion: 'Acuerdos de la sesión',
  citas_textuales_relevantes: 'Citas textuales',
}

export default function RevisionInforme() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [informe, setInforme] = useState<Informe | null>(null)
  const [secciones, setSecciones] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const i = await obtenerInforme(id)
    setInforme(i)
    if (i) {
      const base = (i.contenido_aprobado ?? i.contenido_borrador) as Record<string, unknown>
      const texto: Record<string, string> = {}
      for (const [clave, valor] of Object.entries(base)) {
        texto[clave] = aTexto(valor)
      }
      setSecciones(texto)
    }
    setCargando(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function aprobar() {
    if (!informe) return
    const yo = await psicologoActual()
    if (!yo) return

    setOcupado(true)
    try {
      const contenido: Record<string, unknown> = {}
      for (const [clave, texto] of Object.entries(secciones)) {
        contenido[clave] = texto.split('\n').map((l) => l.trim()).filter(Boolean)
      }
      await aprobarInforme(informe.id, contenido, yo.id)
      router.back()
    } catch {
      Alert.alert('No se pudo aprobar', 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) return <Cargando />

  if (!informe) {
    return (
      <Pantalla>
        <Vacio>
          Todavía no hay informe para esta sesión. Se genera cuando la transcripción está lista.
        </Vacio>
      </Pantalla>
    )
  }

  const aprobado = informe.estado === 'aprobado'

  return (
    <Pantalla>
      <Titulo>Informe de la sesión</Titulo>

      {/* RN-004-01 — el sistema es apoyo, no diagnóstico. Que el psicólogo lo
          lea en pantalla cada vez es deliberado. */}
      <Aviso tono="alerta">
        Este borrador organiza lo que se dijo en la sesión. No es un diagnóstico ni una
        valoración clínica. Revísalo y corrígelo antes de aprobarlo.
      </Aviso>

      <Apoyo>
        Generado el {new Date(informe.generado_en).toLocaleDateString('es-PE')} · {informe.modelo}
      </Apoyo>

      {Object.entries(secciones).map(([clave, texto]) => (
        <View key={clave} style={e.seccion}>
          <Etiqueta>{ETIQUETAS[clave] ?? clave}</Etiqueta>
          <Entrada
            style={e.entrada}
            value={texto}
            onChangeText={(t) => setSecciones((s) => ({ ...s, [clave]: t }))}
            multiline
            editable={!aprobado}
            placeholder="Una línea por punto"
          />
        </View>
      ))}

      {aprobado ? (
        <Apoyo>Informe aprobado. El borrador original se conserva sin cambios.</Apoyo>
      ) : (
        <Boton onPress={aprobar} cargando={ocupado}>
          Aprobar informe
        </Boton>
      )}
    </Pantalla>
  )
}

function aTexto(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor
      .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)))
      .join('\n')
  }
  return typeof valor === 'string' ? valor : JSON.stringify(valor ?? '')
}

const e = StyleSheet.create({
  seccion: { gap: espacio.xs },
  entrada: { minHeight: 96, paddingTop: espacio.md, textAlignVertical: 'top' },
})

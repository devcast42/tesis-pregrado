/** Derivaciones del estudio — implementa ESP-006 RF-006-09.
 *
 *  El investigador ve que la derivación ocurrió y cuánto tardó en cerrarse.
 *  No ve el motivo, ni el puntaje, ni el informe: eso es de la relación
 *  terapéutica. Lo que se mide aquí es si el circuito funciona. */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Celda, Tabla } from '../../modules/panel/Tabla'
import { listarDerivaciones, type FilaDerivacion } from '../../modules/panel/datos'
import { Apoyo, Cargando, Cifra, Pantalla, Parrafo, Tarjeta, Titulo } from '../../modules/nucleo/ui'
import { ancho, color, espacio } from '../../modules/nucleo/diseno'

const DIA = 1000 * 60 * 60 * 24

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function dias(desde: string, hasta: string | null) {
  return Math.floor((new Date(hasta ?? Date.now()).getTime() - new Date(desde).getTime()) / DIA)
}

export default function Derivaciones() {
  const [filas, setFilas] = useState<FilaDerivacion[] | null>(null)

  const cargar = useCallback(async () => {
    setFilas(await listarDerivaciones())
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const abiertas = filas.filter((f) => !f.cerrada_en)
  const cerradas = filas.filter((f) => f.cerrada_en)
  const promedioCierre = cerradas.length
    ? Math.round(
        cerradas.reduce((s, f) => s + dias(f.abierta_en, f.cerrada_en), 0) / cerradas.length,
      )
    : null

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Derivaciones</Titulo>
          <Parrafo suave>
            Cada detección abre una derivación al psicólogo con menos casos abiertos. Una
            derivación que lleva semanas abierta es una señal de proceso, no de diagnóstico.
          </Parrafo>
        </View>

        <Tarjeta>
          <View style={e.cifras}>
            <Cifra valor={abiertas.length} etiqueta="Abiertas" />
            <Cifra valor={cerradas.length} etiqueta="Cerradas" />
            <Cifra
              valor={promedioCierre != null ? `${promedioCierre} d` : '—'}
              etiqueta="Promedio hasta el cierre"
            />
          </View>
        </Tarjeta>

        <Tabla
          filas={filas}
          clave={(x) => x.id}
          vacio="Todavía no hay derivaciones. Se crean solas al detectarse un caso."
          columnas={[
            { titulo: 'Código', ancho: 90, celda: (x) => <Celda>{x.codigo_anonimo}</Celda> },
            { titulo: 'Psicólogo', flex: 2, celda: (x) => <Celda>{x.psicologo}</Celda> },
            { titulo: 'Abierta', ancho: 130, celda: (x) => <Celda suave>{fecha(x.abierta_en)}</Celda> },
            {
              titulo: 'Estado', ancho: 150,
              celda: (x) =>
                x.cerrada_en ? (
                  <Celda fuerte tono={color.exito}>Cerrada en {dias(x.abierta_en, x.cerrada_en)} d</Celda>
                ) : (
                  <Celda fuerte tono={dias(x.abierta_en, null) > 14 ? color.alerta : color.texto}>
                    Abierta hace {dias(x.abierta_en, null)} d
                  </Celda>
                ),
            },
          ]}
        />

        <Apoyo>
          Solo el psicólogo asignado puede cerrar una derivación, y solo desde su propia
          pantalla de caso.
        </Apoyo>
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
  cifras: { flexDirection: 'row', gap: espacio.xl, flexWrap: 'wrap' },
})

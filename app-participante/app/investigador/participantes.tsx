/** Seguimiento por participante — implementa ESP-006 RF-006-08 y ESP-007.
 *
 *  Anonimizado por construcción: `panel_participantes` no expone ningún campo
 *  identificable. Los datos personales viven en `identidades`, que no tiene
 *  política de lectura para nadie —se accede solo por obtener_identidad(), y
 *  queda registrado.
 *
 *  La tabla se ordena por urgencia de contacto, no alfabéticamente ni por
 *  mejor adherencia: quien está a punto de caerse del estudio va arriba. Si
 *  los que hay que llamar quedan al final, debajo del pliegue, la llamada no
 *  se hace. */

import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Celda, Tabla } from '../../modules/panel/Tabla'
import { listarParticipantes, type FilaParticipante } from '../../modules/investigador/datos'
import { Cargando, Pantalla, Parrafo, Titulo } from '../../modules/nucleo/ui'
import { ancho, color, espacio, texto } from '../../modules/nucleo/diseno'

const ADHERENCIA: Record<string, { nombre: string; tono: string }> = {
  al_dia:       { nombre: 'Al día',        tono: color.exito },
  en_riesgo:    { nombre: 'En riesgo',     tono: color.alerta },
  inactivo:     { nombre: 'Inactivo',      tono: color.peligro },
  nunca_inicio: { nombre: 'Nunca inició',  tono: color.peligro },
}

/** Quien ya no está en seguimiento diario no tiene adherencia que medir: la
 *  vista `adherencia` los excluye a propósito (RN-007-04, salieron por diseño
 *  y no por incumplimiento). En su lugar se dice por qué salió —al
 *  investigador sí le corresponde saberlo— pero en gris, para que no se lea
 *  como un grado de cumplimiento. */
const FUERA_DE_SEGUIMIENTO: Record<string, string> = {
  detectado:  'Detectado',
  retirado:   'Retiró consentimiento',
  finalizado: 'Finalizó el estudio',
}

/** Días con un decimal por debajo de la semana y enteros por encima. Un
 *  "0.46 d" en la memoria de tesis se lee como ruido de máquina; "<1 d" dice
 *  lo mismo y se puede citar. */
function dias(valor: number | null) {
  if (valor == null) return '—'
  const n = Number(valor)
  if (n < 1) return '<1 d'
  return `${Math.round(n)} d`
}

export default function Participantes() {
  const [filas, setFilas] = useState<FilaParticipante[] | null>(null)

  const cargar = useCallback(async () => {
    setFilas(await listarParticipantes())
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Participantes</Titulo>
          <Parrafo suave>
            Ordenados por urgencia de contacto. Conviene llamar a quien lleve varios días sin
            responder: un hueco detectado hoy se recupera con una llamada; detectado al cerrar
            el estudio, ya no.
          </Parrafo>
        </View>

        <Tabla
          enTarjeta
          filas={filas}
          clave={(x) => x.id}
          vacio="Todavía no hay participantes inscritos."
          nota="Ningún dato de esta tabla permite identificar a una persona. Para contactar a quien está en riesgo de abandono hay que pasar por el administrador de su empresa."
          columnas={[
            {
              titulo: 'Código', ancho: 90,
              celda: (x) => (
                <Pressable
                  onPress={() => router.push(`/investigador/participante/${x.id}` as never)}
                  accessibilityRole="link"
                  accessibilityLabel={`Ver detalle de ${x.codigo_anonimo}`}
                >
                  <Celda fuerte tono={color.primario}>{x.codigo_anonimo}</Celda>
                  <Text style={[texto.dato, { color: color.primario, opacity: 0.6 }]}>Ver →</Text>
                </Pressable>
              ),
            },
            {
              titulo: 'Empresa', flex: 1,
              celda: (x) => <Celda tono={color.textoMedio}>{x.organizacion}</Celda>,
            },
            {
              titulo: 'Adherencia', ancho: 130,
              celda: (x) => {
                const estado = ADHERENCIA[x.estado_adherencia ?? '']
                if (estado) return <Celda fuerte tono={estado.tono}>{estado.nombre}</Celda>
                return <Celda suave>{FUERA_DE_SEGUIMIENTO[x.estado] ?? x.estado}</Celda>
              },
            },
            {
              titulo: 'Tasa', ancho: 80,
              celda: (x) => (
                <Celda suave={x.tasa_adherencia == null}>
                  {x.tasa_adherencia != null ? `${(x.tasa_adherencia * 100).toFixed(0)}%` : '—'}
                </Celda>
              ),
            },
            {
              titulo: 'Sin check-in', ancho: 110,
              celda: (x) => (
                <Celda tono={x.dias_sin_checkin == null ? color.textoSuave : color.textoMedio}>
                  {x.dias_sin_checkin != null ? `${x.dias_sin_checkin} d` : '—'}
                </Celda>
              ),
            },
            {
              titulo: 'OLBI', ancho: 70,
              celda: (x) => (
                <Celda suave={x.olbi_respondidos === 0}>{x.olbi_respondidos}</Celda>
              ),
            },
            {
              titulo: 'Detección', ancho: 110,
              celda: (x) => (
                <Celda tono={x.dias_hasta_deteccion == null ? color.textoSuave : color.textoMedio}>
                  {dias(x.dias_hasta_deteccion)}
                </Celda>
              ),
            },
          ]}
        />
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
})

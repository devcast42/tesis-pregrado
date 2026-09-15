/** Panel del administrador de empresa — implementa ESP-008.
 *
 *  ⚠️ Lo que NO está aquí es tan importante como lo que sí: ni un puntaje, ni
 *  una detección, ni una derivación. El admin ve participación —quién tiene
 *  cuenta, quién consintió, quién responde— porque de eso responde ante su
 *  empresa. La salud de su gente no es asunto suyo.
 *
 *  Las cifras agregadas se ocultan bajo el mínimo de reporte: en un grupo de
 *  cuatro, "uno lleva seis días sin responder" nombra a una persona. */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, resumenDeEmpresa, type Empresa, type ResumenEmpresa } from '../../modules/panel/datos'
import {
  Apoyo, Aviso, Cargando, Cifra, Pantalla, Parrafo, Seccion, Tarjeta, Titulo,
} from '../../modules/nucleo/ui'
import { ancho, espacio } from '../../modules/nucleo/diseno'

const MINIMO = 10

export default function PanelAdmin() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [listo, setListo] = useState(false)

  const cargar = useCallback(async () => {
    const e = await miEmpresa()
    setEmpresa(e)
    if (e) setResumen(await resumenDeEmpresa(e.id))
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        {!empresa ? (
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa al equipo del estudio.</Aviso>
        ) : (
          <>
            <View style={e.encabezado}>
              <Titulo>{empresa.nombre}</Titulo>
              <Parrafo suave>
                Estado de la participación de tu equipo en el estudio.
              </Parrafo>
            </View>

            <Tarjeta>
              <View style={e.cifras}>
                <Cifra valor={resumen?.inscritos ?? 0} etiqueta="Inscritos" />
                <Cifra valor={resumen?.consintieron ?? 0} etiqueta="Consintieron" />
                <Cifra valor={resumen?.en_seguimiento ?? 0} etiqueta="En seguimiento" />
              </View>
            </Tarjeta>

            <Seccion titulo="Adherencia">
              {resumen?.reportable ? (
                <Tarjeta>
                  <View style={e.cifras}>
                    <Cifra
                      valor={resumen.respondieron_ayer ?? 0}
                      etiqueta="Respondieron ayer"
                    />
                    <Cifra
                      valor={resumen.sin_responder_4d ?? 0}
                      etiqueta="4+ días sin responder"
                    />
                  </View>
                </Tarjeta>
              ) : (
                <Tarjeta tono="suave">
                  <Parrafo suave>
                    Las cifras de adherencia se muestran a partir de {MINIMO} participantes
                    inscritos. Con menos, un porcentaje señalaría a personas concretas.
                  </Parrafo>
                </Tarjeta>
              )}
            </Seccion>

            <Apoyo>
              Este panel no muestra respuestas, puntajes ni resultados de evaluación de
              ninguna persona. Esa información solo la ven el propio participante y, si
              hay derivación, el psicólogo asignado.
            </Apoyo>
          </>
        )}
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
  cifras: { flexDirection: 'row', gap: espacio.xl, flexWrap: 'wrap' },
})

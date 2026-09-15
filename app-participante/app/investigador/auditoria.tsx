/** Auditoría de accesos a identidad — implementa ESP-006 RN-006-03.
 *
 *  `identidades` es la única tabla con datos personales y no tiene política de
 *  lectura para nadie: se llega a ella solo por obtener_identidad(), que deja
 *  un evento. Esta pantalla es la razón de que ese registro sirva de algo —un
 *  log que nadie mira no disuade a nadie. */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Celda, Tabla } from '../../modules/panel/Tabla'
import { listarAccesosIdentidad, type FilaAuditoria } from '../../modules/panel/datos'
import { Apoyo, Cargando, Pantalla, Parrafo, Titulo } from '../../modules/nucleo/ui'
import { ancho, espacio } from '../../modules/nucleo/diseno'

function momento(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Auditoria() {
  const [filas, setFilas] = useState<FilaAuditoria[] | null>(null)

  const cargar = useCallback(async () => {
    setFilas(await listarAccesosIdentidad())
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Auditoría</Titulo>
          <Parrafo suave>
            Cada vez que un psicólogo revela el nombre y el correo de un participante derivado,
            queda este registro. Es el contrapeso de haber separado identidad y datos de
            investigación: la separación se puede levantar, pero nunca en silencio.
          </Parrafo>
        </View>

        <Tabla
          filas={filas}
          clave={(x) => String(x.id)}
          vacio="Todavía nadie ha accedido a la identidad de un participante."
          columnas={[
            { titulo: 'Momento', ancho: 200, celda: (x) => <Celda>{momento(x.ocurrido_en)}</Celda> },
            { titulo: 'Psicólogo', flex: 2, celda: (x) => <Celda>{x.psicologo}</Celda> },
            { titulo: 'Participante', ancho: 120, celda: (x) => <Celda>{x.codigo_anonimo}</Celda> },
          ]}
        />

        <Apoyo>
          Se muestran los últimos 200 accesos. El registro completo vive en la tabla de
          eventos y no se puede borrar desde la aplicación.
        </Apoyo>
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
})

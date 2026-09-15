/** Maestro de empresas — implementa ESP-008 (RF-008-01).
 *
 *  Cada fila lleva sus conteos porque una lista de nombres y fechas no
 *  responde la única pregunta que se le hace a esta pantalla: ¿esta empresa
 *  está participando de verdad o se quedó vacía después de darla de alta? */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { CeldaEntidad } from '../../modules/panel/Piezas'
import { Celda, Tabla } from '../../modules/panel/Tabla'
import {
  crearEmpresa, listarEmpresasConConteos, type FilaEmpresa,
} from '../../modules/panel/datos'
import {
  Aviso, Boton, Cargando, Entrada, Pantalla, Parrafo, Tarjeta, Titulo,
} from '../../modules/nucleo/ui'
import { ancho, color, espacio } from '../../modules/nucleo/diseno'

/** "42 participantes · 2 administradores", y en singular cuando toca. Una
 *  empresa recién creada dice "Sin participantes todavía", que es información
 *  y no un cero suelto. */
function resumenDe(x: FilaEmpresa) {
  if (x.participantes === 0 && x.administradores === 0) return 'Sin participantes todavía'

  const partes: string[] = []
  if (x.participantes > 0) {
    partes.push(`${x.participantes} ${x.participantes === 1 ? 'participante' : 'participantes'}`)
  }
  if (x.administradores > 0) {
    partes.push(
      `${x.administradores} ${x.administradores === 1 ? 'administrador' : 'administradores'}`,
    )
  }
  return partes.join(' · ')
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<FilaEmpresa[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setEmpresas(await listarEmpresasConConteos())
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function crear() {
    setOcupado(true)
    setError(null)
    try {
      await crearEmpresa(nombre)
      setNombre('')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la empresa.')
    } finally {
      setOcupado(false)
    }
  }

  if (!empresas) return <Panel rol="investigador"><Cargando /></Panel>

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Empresas</Titulo>
          <Parrafo suave>
            Cada empresa agrupa a sus participantes y a sus administradores.
          </Parrafo>
        </View>

        <Tarjeta>
          <View style={e.alta}>
            <View style={e.campo}>
              <Entrada
                value={nombre}
                onChangeText={setNombre}
                placeholder="Nombre de la empresa"
                onSubmitEditing={() => nombre.trim() && crear()}
                returnKeyType="go"
              />
            </View>
            <Boton onPress={crear} inhabilitado={!nombre.trim()} cargando={ocupado}>
              Agregar
            </Boton>
          </View>
          {error && <Aviso>{error}</Aviso>}
        </Tarjeta>

        <Tabla
          enTarjeta
          filas={empresas}
          clave={(x) => x.id}
          vacio="Todavía no hay empresas. Crea la primera arriba."
          nota="Para agregar participantes o administradores, entra a una empresa."
          columnas={[
            {
              titulo: 'Empresa', flex: 2,
              celda: (x) => <CeldaEntidad nombre={x.nombre} detalle={resumenDe(x)} />,
            },
            {
              titulo: 'Creada', ancho: 130,
              celda: (x) => (
                <Celda tono={color.textoMedio}>
                  {new Date(x.creado_en).toLocaleDateString('es-PE')}
                </Celda>
              ),
            },
            {
              titulo: '', ancho: 150, alinear: 'derecha',
              celda: (x) => (
                <Boton
                  variante="secundario"
                  pequeno
                  onPress={() => router.push(`/investigador/empresa/${x.id}`)}
                >
                  Gestionar  →
                </Boton>
              ),
            },
          ]}
        />
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.xs },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'center', flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 220 },
})

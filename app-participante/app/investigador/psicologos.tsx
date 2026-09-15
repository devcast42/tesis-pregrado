/** Maestro de psicólogos — implementa ESP-008.
 *
 *  Los psicólogos pertenecen al estudio, no a una empresa: un mismo
 *  profesional atiende casos de varias. Por eso este maestro vive fuera del
 *  detalle de empresa y solo lo gestiona el investigador. */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Celda, Credenciales, Tabla } from '../../modules/panel/Tabla'
import {
  cargaDePsicologos, crearPsicologo, listarPsicologos, restablecerContrasena,
  type Psicologo,
} from '../../modules/panel/datos'
import {
  Apoyo, Aviso, Boton, Cargando, Entrada, Etiqueta, Pantalla, Parrafo, Tarjeta, Titulo,
} from '../../modules/nucleo/ui'
import { ancho, espacio } from '../../modules/nucleo/diseno'

export default function Psicologos() {
  const [filas, setFilas] = useState<Psicologo[] | null>(null)
  const [carga, setCarga] = useState<Record<string, number>>({})

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [colegiatura, setColegiatura] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)
  const [reseteo, setReseteo] = useState<{ nombre: string; contrasena: string } | null>(null)

  const cargar = useCallback(async () => {
    const [lista, c] = await Promise.all([listarPsicologos(), cargaDePsicologos()])
    setFilas(lista)
    setCarga(c)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function crear() {
    setOcupado(true); setError(null); setReseteo(null)
    try {
      const r = await crearPsicologo({ correo, nombre, colegiatura })
      setNuevo(r)
      setNombre(''); setCorreo(''); setColegiatura('')
      await cargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo crear el psicólogo.')
    } finally { setOcupado(false) }
  }

  async function restablecer(p: Psicologo) {
    setNuevo(null); setError(null)
    try {
      const r = await restablecerContrasena(p.auth_user_id)
      setReseteo({ nombre: p.nombre, contrasena: r.contrasena })
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.')
    }
  }

  return (
    <Panel rol="investigador">
      {!filas ? (
        <Cargando />
      ) : (
        <Pantalla ancho={ancho.panel}>
          <View style={e.encabezado}>
            <Titulo>Psicólogos</Titulo>
            <Parrafo suave>
              Atienden casos de cualquier empresa del estudio. Las derivaciones se asignan
              automáticamente al que tenga menos casos abiertos.
            </Parrafo>
          </View>

          <Tarjeta>
            <View style={e.alta}>
              <View style={e.campo}>
                <Etiqueta>Nombre</Etiqueta>
                <Entrada value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" />
              </View>
              <View style={e.campo}>
                <Etiqueta>Correo</Etiqueta>
                <Entrada
                  value={correo} onChangeText={setCorreo} placeholder="correo@ejemplo.com"
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                />
              </View>
              <View style={e.campoCorto}>
                <Etiqueta>Colegiatura</Etiqueta>
                <Entrada value={colegiatura} onChangeText={setColegiatura} placeholder="CPsP 00000" />
              </View>
              <Boton
                onPress={crear}
                inhabilitado={!nombre.trim() || !correo.includes('@') || !colegiatura.trim()}
                cargando={ocupado}
              >
                Crear
              </Boton>
            </View>
            {error && <Aviso>{error}</Aviso>}
            {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena} />}
            {reseteo && <Credenciales contrasena={reseteo.contrasena}
              nota={`Nueva contraseña de ${reseteo.nombre}. No se vuelve a mostrar.`} />}
          </Tarjeta>

          <Tabla
            filas={filas}
            clave={(x) => x.id}
            vacio="Todavía no hay psicólogos registrados."
            columnas={[
              { titulo: 'Nombre', flex: 2, celda: (x) => <Celda>{x.nombre}</Celda> },
              { titulo: 'Colegiatura', ancho: 140, celda: (x) => <Celda>{x.colegiatura}</Celda> },
              {
                titulo: 'Casos abiertos', ancho: 140,
                celda: (x) => (
                  <Celda suave={!carga[x.id]}>{carga[x.id] ?? 0}</Celda>
                ),
              },
              {
                titulo: 'Estado', ancho: 100,
                celda: (x) => <Celda suave={!x.activo}>{x.activo ? 'Activo' : 'Inactivo'}</Celda>,
              },
              {
                titulo: '', ancho: 170,
                celda: (x) => (
                  <Boton variante="secundario" pequeno onPress={() => restablecer(x)}>
                    Restablecer clave
                  </Boton>
                ),
              },
            ]}
          />

          <Apoyo>
            Dar de baja a un psicólogo con casos abiertos requiere reasignarlos primero;
            por ahora se hace desde la base de datos.
          </Apoyo>
        </Pantalla>
      )}
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 190, gap: espacio.xs },
  campoCorto: { width: 160, gap: espacio.xs },
})

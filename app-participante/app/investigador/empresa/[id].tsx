/** Detalle de empresa — implementa ESP-008.
 *
 *  Aquí viven los maestros que dependen de una empresa: sus administradores y
 *  sus participantes. Los psicólogos NO: pertenecen al estudio, no a la
 *  empresa, y por eso están en su propia sección del panel. */

import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { Celda, Credenciales, Tabla } from '../../../modules/panel/Tabla'
import {
  crearAdmin, inscribirParticipante, listarAdmins, listarEmpresas,
  participacionDeEmpresa, restablecerParticipante, resumenDeEmpresa,
  type Administrador, type FilaParticipacion, type ResumenEmpresa,
} from '../../../modules/panel/datos'
import {
  Apoyo, Aviso, Boton, Cargando, Cifra, Entrada, Pantalla, Parrafo, Tarjeta, Titulo,
} from '../../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../../modules/nucleo/diseno'

type Pestana = 'participantes' | 'admins'

export default function DetalleEmpresa() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [pestana, setPestana] = useState<Pestana>('participantes')
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [participantes, setParticipantes] = useState<FilaParticipacion[] | null>(null)
  const [admins, setAdmins] = useState<Administrador[]>([])

  const cargar = useCallback(async () => {
    const [empresas, r, p, a] = await Promise.all([
      listarEmpresas(),
      resumenDeEmpresa(id),
      participacionDeEmpresa(id),
      listarAdmins(id),
    ])
    setNombreEmpresa(empresas.find((x) => x.id === id)?.nombre ?? '')
    setResumen(r)
    setParticipantes(p)
    setAdmins(a)
  }, [id])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  return (
    <Panel rol="investigador">
      {!participantes ? (
        <Cargando />
      ) : (
        <Pantalla ancho={ancho.panel}>
          <View style={e.encabezado}>
            <Titulo>{nombreEmpresa}</Titulo>
            <View style={e.cifras}>
              <Cifra valor={resumen?.inscritos ?? 0} etiqueta="Inscritos" />
              <Cifra valor={resumen?.en_seguimiento ?? 0} etiqueta="En seguimiento" />
              <Cifra valor={admins.length} etiqueta="Administradores" />
            </View>
          </View>

          <View style={e.pestanas}>
            <Pestaña titulo="Participantes" activa={pestana === 'participantes'}
              onPress={() => setPestana('participantes')} />
            <Pestaña titulo="Administradores" activa={pestana === 'admins'}
              onPress={() => setPestana('admins')} />
          </View>

          {pestana === 'participantes' ? (
            <SeccionParticipantes empresaId={id} filas={participantes} recargar={cargar} />
          ) : (
            <SeccionAdmins empresaId={id} filas={admins} recargar={cargar} />
          )}
        </Pantalla>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------- Participantes

function SeccionParticipantes({
  empresaId, filas, recargar,
}: {
  empresaId: string
  filas: FilaParticipacion[]
  recargar: () => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)
  const [reseteo, setReseteo] = useState<{ codigo: string; contrasena: string } | null>(null)

  async function inscribir() {
    setOcupado(true); setError(null); setReseteo(null)
    try {
      const r = await inscribirParticipante({ organizacion_id: empresaId, correo, nombre })
      setNuevo({ correo, contrasena: r.contrasena })
      setNombre(''); setCorreo('')
      await recargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo inscribir.')
    } finally { setOcupado(false) }
  }

  async function restablecer(fila: FilaParticipacion) {
    setNuevo(null); setError(null)
    try {
      const r = await restablecerParticipante(fila.participante_id)
      setReseteo({ codigo: fila.codigo_anonimo, contrasena: r.contrasena })
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.')
    }
  }

  return (
    <View style={e.seccion}>
      <Tarjeta>
        <View style={e.alta}>
          <View style={e.campo}>
            <Entrada value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" />
          </View>
          <View style={e.campo}>
            <Entrada
              value={correo} onChangeText={setCorreo} placeholder="Correo"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
          </View>
          <Boton
            onPress={inscribir}
            inhabilitado={!nombre.trim() || !correo.includes('@')}
            cargando={ocupado}
          >
            Inscribir
          </Boton>
        </View>
        {error && <Aviso>{error}</Aviso>}
        {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena}
          nota="Entrégasela junto con el consentimiento informado. No se vuelve a mostrar." />}
        {reseteo && <Credenciales contrasena={reseteo.contrasena}
          nota={`Nueva contraseña de ${reseteo.codigo}. No se vuelve a mostrar.`} />}
      </Tarjeta>

      <Tabla
        filas={filas}
        clave={(x) => x.participante_id}
        vacio="Todavía no hay participantes en esta empresa."
        columnas={[
          { titulo: 'Código', ancho: 90, celda: (x) => <Celda>{x.codigo_anonimo}</Celda> },
          {
            titulo: 'Consentimiento', ancho: 140,
            celda: (x) => (
              <Celda suave={x.consentimiento !== true}>
                {x.consentimiento === true ? 'Aceptado'
                  : x.consentimiento === false ? 'Rechazado' : 'Pendiente'}
              </Celda>
            ),
          },
          {
            titulo: 'Participación', ancho: 185,
            celda: (x) =>
              !x.en_seguimiento ? <Celda suave>Fuera de seguimiento</Celda>
              : x.dias_sin_responder == null ? <Celda suave>Sin responder aún</Celda>
              : x.dias_sin_responder <= 1 ? <Celda>Al día</Celda>
              : <Celda suave>{x.dias_sin_responder} días sin responder</Celda>,
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
        Aquí no aparecen nombres: el investigador trabaja con códigos anónimos (RN-006-01).
        Los nombres solo los ve el administrador de la empresa, que es quien gestiona las
        cuentas. Y &quot;fuera de seguimiento&quot; no distingue el motivo —puede haber
        terminado, retirado su consentimiento o pasado a acompañamiento— porque el motivo es
        información clínica.
      </Apoyo>
    </View>
  )
}

// -------------------------------------------------------------------- Admins

function SeccionAdmins({
  empresaId, filas, recargar,
}: {
  empresaId: string
  filas: Administrador[]
  recargar: () => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)

  async function crear() {
    setOcupado(true); setError(null)
    try {
      const r = await crearAdmin({ organizacion_id: empresaId, correo, nombre })
      setNuevo(r)
      setNombre(''); setCorreo('')
      await recargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo crear el administrador.')
    } finally { setOcupado(false) }
  }

  return (
    <View style={e.seccion}>
      <Parrafo suave>
        Un administrador gestiona las cuentas de su empresa. No accede a respuestas,
        puntajes ni derivaciones.
      </Parrafo>

      <Tarjeta>
        <View style={e.alta}>
          <View style={e.campo}>
            <Entrada value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" />
          </View>
          <View style={e.campo}>
            <Entrada
              value={correo} onChangeText={setCorreo} placeholder="Correo"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
          </View>
          <Boton
            onPress={crear}
            inhabilitado={!nombre.trim() || !correo.includes('@')}
            cargando={ocupado}
          >
            Crear
          </Boton>
        </View>
        {error && <Aviso>{error}</Aviso>}
        {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena} />}
      </Tarjeta>

      <Tabla
        filas={filas}
        clave={(x) => x.id}
        vacio="Esta empresa no tiene administradores."
        columnas={[
          { titulo: 'Nombre', flex: 2, celda: (x) => <Celda>{x.nombre}</Celda> },
          {
            titulo: 'Estado', ancho: 120,
            celda: (x) => <Celda suave={!x.activo}>{x.activo ? 'Activo' : 'Inactivo'}</Celda>,
          },
        ]}
      />
    </View>
  )
}

function Pestaña({
  titulo, activa, onPress,
}: { titulo: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[e.pestana, activa && e.pestanaActiva]}>
      <Text style={[
        texto.cuerpoFuerte,
        { color: activa ? color.primario : color.textoMedio },
      ]}>
        {titulo}
      </Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.md },
  cifras: { flexDirection: 'row', gap: espacio.xl, flexWrap: 'wrap' },
  pestanas: {
    flexDirection: 'row', gap: espacio.xs,
    borderBottomWidth: 1, borderBottomColor: color.borde,
  },
  pestana: {
    paddingHorizontal: espacio.base, paddingVertical: espacio.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    borderTopLeftRadius: radio.sm, borderTopRightRadius: radio.sm,
  },
  pestanaActiva: { borderBottomColor: color.primario },
  seccion: { gap: espacio.base },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'center', flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 200 },
})

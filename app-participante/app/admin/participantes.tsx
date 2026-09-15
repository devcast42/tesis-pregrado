/** Participantes de la empresa (admin) — implementa ESP-008.
 *
 *  El único maestro del admin. Inscribe, restablece contraseñas y ve
 *  adherencia; nada más. La empresa se toma del servidor, no de la pantalla:
 *  no hay forma de escribir el id de otra empresa en la petición. */

import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Celda, Credenciales, Tabla } from '../../modules/panel/Tabla'
import {
  inscribirParticipante, miEmpresa, participacionDeEmpresa, restablecerParticipante,
  type Empresa, type FilaParticipacion,
} from '../../modules/panel/datos'
import {
  Apoyo, Aviso, Boton, Cargando, Entrada, Etiqueta, Pantalla, Parrafo, Tarjeta, Titulo,
} from '../../modules/nucleo/ui'
import { ancho, espacio } from '../../modules/nucleo/diseno'

export default function ParticipantesAdmin() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [filas, setFilas] = useState<FilaParticipacion[] | null>(null)

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)
  const [reseteo, setReseteo] = useState<{ codigo: string; contrasena: string } | null>(null)

  const cargar = useCallback(async () => {
    const e = await miEmpresa()
    setEmpresa(e)
    setFilas(e ? await participacionDeEmpresa(e.id) : [])
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function inscribir() {
    if (!empresa) return
    setOcupado(true); setError(null); setReseteo(null)
    try {
      const r = await inscribirParticipante({
        organizacion_id: empresa.id, correo, nombre,
      })
      setNuevo({ correo, contrasena: r.contrasena })
      setNombre(''); setCorreo('')
      await cargar()
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

  if (!filas) return <Panel rol="admin"><Cargando /></Panel>

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <Titulo>Participantes</Titulo>
          <Parrafo suave>
            Al inscribir a alguien se crea su cuenta y se genera una contraseña. Entrégasela
            junto con el consentimiento informado: participar es voluntario, y la decisión la
            toma la persona dentro de la app.
          </Parrafo>
        </View>

        {!empresa ? (
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa al equipo del estudio.</Aviso>
        ) : (
          <>
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
                nota="No se vuelve a mostrar. Si se pierde, restablécela desde la tabla." />}
              {reseteo && <Credenciales contrasena={reseteo.contrasena}
                nota={`Nueva contraseña de ${reseteo.codigo}. No se vuelve a mostrar.`} />}
            </Tarjeta>

            <Tabla
              filas={filas}
              clave={(x) => x.participante_id}
              vacio="Todavía no has inscrito a nadie."
              columnas={[
                { titulo: 'Código', ancho: 90, celda: (x) => <Celda>{x.codigo_anonimo}</Celda> },
                { titulo: 'Nombre', flex: 2, celda: (x) => <Celda>{x.nombre ?? '—'}</Celda> },
                {
                  titulo: 'Consentimiento', ancho: 150,
                  celda: (x) => (
                    <Celda suave={x.consentimiento !== true}>
                      {x.consentimiento === true ? 'Aceptado'
                        : x.consentimiento === false ? 'Rechazado' : 'Pendiente'}
                    </Celda>
                  ),
                },
                {
                  titulo: 'Participación', ancho: 170,
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
              &quot;Fuera de seguimiento&quot; no dice por qué. Puede haber terminado su
              participación, haber retirado el consentimiento o estar en acompañamiento: el
              motivo es información clínica y no se comparte con la empresa.
            </Apoyo>
          </>
        )}
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { gap: espacio.sm },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 190, gap: espacio.xs },
})

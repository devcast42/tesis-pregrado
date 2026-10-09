/** Alta de trabajador y de administrador de empresa — ESP-008.
 *
 *  Los dos piden lo mismo —nombre y correo— y los dos devuelven una
 *  contraseña que se enseña UNA vez. Eso es lo que manda en el diseño: la
 *  credencial aparece dentro del propio diálogo, con su botón de copiar, en
 *  lugar de en un aviso detrás del formulario donde se pierde de vista.
 *
 *  Aquí no se pregunta edad, rol, antigüedad ni modalidad: eso lo responde el
 *  propio trabajador en el formulario `estable` al entrar. Pedirlo también
 *  aquí daría dos versiones del mismo dato, y la buena es la suya. */

import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { crearAdmin, crearPsicologo, inscribirTrabajador } from '../panel/datos'
import { BotonChico, Codigo, Mono, Rotulo } from './piezas'
import { color, espacio, radio, texto, veloModal } from '../nucleo/diseno'
import { IconoCandado, IconoCerrar, IconoCorreo, IconoCredencial, IconoEscudoCheck, IconoPersona } from '../nucleo/iconos'

export type ModoPersona = 'trabajador' | 'admin' | 'psicologo'

type Credencial = { titulo: string; codigo?: string; correo?: string; contrasena: string; nota: string }

const COPIA = {
  trabajador: {
    titulo: 'Inscribir trabajador',
    boton: 'Inscribir',
    nota: 'Entrégala junto con el consentimiento informado. No se vuelve a mostrar.',
  },
  admin: {
    titulo: 'Crear administrador',
    boton: 'Crear acceso',
    nota: 'Contraseña temporal: la cambia al entrar. No se vuelve a mostrar.',
  },
  psicologo: {
    titulo: 'Nuevo psicólogo general',
    boton: 'Crear acceso',
    nota: 'Atiende a todas las empresas. Contraseña temporal: la cambia al entrar. No se vuelve a mostrar.',
  },
} as const

export function DialogoPersona({ modo, organizacionId, empresa, onCerrar, onCreada }: {
  modo: ModoPersona
  /** Solo para trabajador y admin: el psicólogo es del estudio, no de una empresa. */
  organizacionId?: string
  empresa: string
  onCerrar: () => void; onCreada: () => void
}) {
  const t = COPIA[modo]
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [colegiatura, setColegiatura] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<Credencial | null>(null)
  const [copiado, setCopiado] = useState(false)

  const correoRaro = !!correo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())
  const faltaColegiatura = modo === 'psicologo' && !colegiatura.trim()
  const puede = !!nombre.trim() && !!correo.trim() && !correoRaro && !faltaColegiatura && !ocupado

  async function crear() {
    if (!puede) return
    setOcupado(true); setError(null)
    try {
      const datos = { organizacion_id: organizacionId as string, correo: correo.trim().toLowerCase(), nombre: nombre.trim() }
      if (modo === 'psicologo') {
        const r = await crearPsicologo({ correo: datos.correo, nombre: datos.nombre, colegiatura: colegiatura.trim() })
        setCredencial({ titulo: `Acceso creado para ${nombre.trim()}`, correo: r.correo ?? datos.correo, contrasena: r.contrasena, nota: t.nota })
      } else if (modo === 'trabajador') {
        const r = await inscribirTrabajador(datos)
        setCredencial({ titulo: `${nombre.trim()} queda como ${r.codigo_anonimo}`, codigo: r.codigo_anonimo, correo: datos.correo, contrasena: r.contrasena, nota: t.nota })
      } else {
        const r = await crearAdmin(datos)
        setCredencial({ titulo: `Acceso creado para ${nombre.trim()}`, correo: r.correo ?? datos.correo, contrasena: r.contrasena, nota: t.nota })
      }
      // La lista de detrás se refresca ya; el diálogo se queda enseñando la
      // contraseña hasta que la persona la copie y cierre.
      onCreada()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message
        : ex && typeof ex === 'object' && 'message' in ex ? String((ex as { message: unknown }).message ?? '')
        : `No se pudo ${modo === 'trabajador' ? 'inscribir' : 'crear el acceso'}.`)
    } finally { setOcupado(false) }
  }

  async function copiar(v: string) {
    try { await navigator.clipboard.writeText(v); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch {}
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCerrar}>
      <View style={e.velo}>
        <View style={e.caja}>
          <View style={e.cabecera}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Rotulo>{empresa}</Rotulo>
              <Text style={[texto.seccion, { color: color.texto }]}>{credencial ? 'Credencial de acceso' : t.titulo}</Text>
            </View>
            <Pressable onPress={onCerrar} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <IconoCerrar tamano={15} color={color.textoMedio} />
            </Pressable>
          </View>

          {credencial ? (
            <View style={{ padding: espacio.base, gap: espacio.sm }}>
              <View style={[e.filaRotulo, { gap: 8 }]}>
                <View style={e.cuadroIcono}><IconoEscudoCheck tamano={15} color={color.primarioProfundo} /></View>
                <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1, minWidth: 160 }]}>{credencial.titulo}</Text>
              </View>
              {credencial.codigo && (
                <View style={e.dato}><Rotulo>Código en el estudio</Rotulo><Codigo>{credencial.codigo}</Codigo></View>
              )}
              {credencial.correo && (
                <View style={e.dato}><Rotulo>Usuario</Rotulo><Mono tono={color.texto} tamano={13}>{credencial.correo}</Mono></View>
              )}
              <View style={e.dato}>
                <Rotulo>Contraseña</Rotulo>
                <View style={[e.filaRotulo, { justifyContent: 'space-between' }]}>
                  <Mono tono={color.texto} tamano={15}>{credencial.contrasena}</Mono>
                  <BotonChico onPress={() => copiar(credencial.contrasena)} tono="suave">{copiado ? 'Copiada' : 'Copiar'}</BotonChico>
                </View>
              </View>
              <Text style={[texto.dato, { color: '#8C4A2B' }]}>{credencial.nota}</Text>
              <View style={[e.filaRotulo, { justifyContent: 'flex-end' }]}>
                <Pressable onPress={onCerrar} style={e.botonCrear}><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Listo</Text></Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={{ padding: espacio.base, gap: espacio.base }}>
                <Campo icono={<IconoPersona tamano={15} color={color.primarioProfundo} />} rotulo="Nombre y apellido"
                  valor={nombre} onChange={setNombre} placeholder="Nombre Apellido" />
                {modo === 'psicologo' && (
                  <Campo icono={<IconoCredencial tamano={15} color={color.primarioProfundo} />} rotulo="Colegiatura (CPsP)"
                    valor={colegiatura} onChange={setColegiatura} placeholder="28419" />
                )}
                <Campo icono={<IconoCorreo tamano={15} color={color.primarioProfundo} />} rotulo="Correo de acceso"
                  valor={correo} onChange={setCorreo} placeholder={modo === 'psicologo' ? 'nombre@institucion.pe' : 'nombre@empresa.pe'} correo
                  invalido={correoRaro} aviso={correoRaro ? 'Ese correo no parece válido.' : undefined} />
                {/* Lo único que hay que saber antes de pulsar: la contraseña
                    sale una vez y no se puede volver a ver. */}
                <View style={e.aviso}>
                  <View style={e.cuadroIcono}><IconoCandado tamano={15} color={color.primarioProfundo} /></View>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
                    Al crear la cuenta se genera una contraseña. <Text style={texto.datoFuerte}>Se muestra una sola vez</Text>: cópiala antes de cerrar.
                  </Text>
                </View>
              </View>
              {error && <View style={e.error}><Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text></View>}
              <View style={e.pie}>
                <BotonChico onPress={onCerrar} tono="suave">Cancelar</BotonChico>
                <Pressable onPress={crear} disabled={!puede} style={[e.botonCrear, !puede && { opacity: 0.5 }]} accessibilityRole="button">
                  <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Creando…' : t.boton}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

function Campo({ icono, rotulo, valor, onChange, placeholder, correo, invalido, aviso }: {
  icono: React.ReactNode; rotulo: string; valor: string; onChange: (v: string) => void
  placeholder: string; correo?: boolean; invalido?: boolean; aviso?: string
}) {
  return (
    <View style={{ gap: 5 }}>
      <View style={e.filaRotulo}>
        <View style={e.cuadroIcono}>{icono}</View>
        <Rotulo>{rotulo}</Rotulo>
      </View>
      <TextInput value={valor} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.textoSuave}
        autoCapitalize={correo ? 'none' : 'words'} autoCorrect={false} keyboardType={correo ? 'email-address' : 'default'}
        style={[texto.dato, e.entrada, invalido && { borderColor: '#8C4A2B' }, { outlineStyle: 'none' } as any]} />
      {aviso && <Text style={[texto.dato, { color: '#8C4A2B' }]}>{aviso}</Text>}
    </View>
  )
}

const e = StyleSheet.create({
  velo: { ...veloModal, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', justifyContent: 'center', padding: espacio.base },
  caja: { width: 480, maxWidth: '100%', backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm, padding: espacio.base, borderBottomWidth: 1, borderBottomColor: '#EEECE8', flexWrap: 'wrap' },
  cerrar: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
  filaRotulo: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cuadroIcono: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F7F6F3', borderRadius: 8, padding: 10 },
  dato: { backgroundColor: '#F7F6F3', borderRadius: 8, padding: 10, gap: 3 },
  error: { backgroundColor: '#FBEDE6', padding: 10, marginHorizontal: espacio.base, borderRadius: 8 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espacio.sm, padding: espacio.base, borderTopWidth: 1, borderTopColor: '#EEECE8', flexWrap: 'wrap' },
  botonCrear: { backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
})

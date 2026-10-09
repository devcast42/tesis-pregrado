/** Psicólogos de la empresa (admin).
 *
 *  El administrador da de alta a los psicólogos de su empresa. Esos solo
 *  atienden a su gente; los generales, que crea el investigador, atienden a
 *  todas las empresas y cubren a la que no tiene ninguno activo. La empresa
 *  se toma de la cuenta en el servidor (`crear-psicologo`), nunca de aquí.
 *
 *  Aquí se ve quién es y si está activo. Qué casos lleva y de qué habla, no:
 *  la política de `psicologos` solo deja leer la ficha, y las derivaciones
 *  siguen cerradas al admin. */

import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Credenciales } from '../../modules/panel/Tabla'
import { Monograma } from '../../modules/panel/Piezas'
import { crearPsicologo, listarPsicologos, miEmpresa, type Empresa, type Psicologo } from '../../modules/panel/datos'
import { Caja, Pastilla, Pie } from '../../modules/panel/PiezasEmpresario'
import { Aviso, Boton, Cargando, Entrada, Etiqueta, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoAgregar } from '../../modules/nucleo/iconos'

export default function PsicologosAdmin() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [lista, setLista] = useState<Psicologo[] | null>(null)
  const [formulario, setFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [colegiatura, setColegiatura] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    // La política solo le devuelve al admin los de su empresa.
    setLista(em ? await listarPsicologos().catch(() => []) : [])
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function crear() {
    setOcupado(true); setError(null)
    try {
      const r = await crearPsicologo({ correo: correo.trim(), nombre: nombre.trim(), colegiatura: colegiatura.trim() })
      setNuevo({ correo: r.correo, contrasena: r.contrasena })
      setNombre(''); setCorreo(''); setColegiatura(''); setFormulario(false)
      await cargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo crear la cuenta.')
    } finally { setOcupado(false) }
  }

  if (!lista) return <Panel rol="admin"><Cargando /></Panel>

  const activos = lista.filter((p) => p.activo).length

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>Apoyo psicológico</Text>
            <Text style={[texto.titulo, { color: color.texto }]}>Psicólogos de tu empresa</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 560 }]}>
              Los que des de alta aquí atienden solo a tu gente. Si no tienes ninguno activo, los casos los atiende un psicólogo de Bienestar Tech.
            </Text>
          </View>
          {empresa && (
            <Pressable onPress={() => { setFormulario((v) => !v); setError(null) }} style={e.botonVerde} accessibilityRole="button">
              <IconoAgregar tamano={18} color="#FFFFFF" />
              <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>{formulario ? 'Cerrar' : 'Dar de alta un psicólogo'}</Text>
            </Pressable>
          )}
        </View>

        {!empresa ? (
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa a soporte.</Aviso>
        ) : (
          <>
            {(formulario || error || nuevo) && (
              <Caja estilo={{ padding: espacio.base, gap: espacio.md }}>
                {formulario && (
                  <View style={e.alta}>
                    <View style={e.campo}>
                      <Etiqueta>Nombre y apellido</Etiqueta>
                      <Entrada value={nombre} onChangeText={setNombre} placeholder="Como figura en su colegiatura" />
                    </View>
                    <View style={e.campo}>
                      <Etiqueta>Su correo</Etiqueta>
                      <Entrada value={correo} onChangeText={setCorreo} placeholder="correo@dominio.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    </View>
                    <View style={e.campo}>
                      <Etiqueta>N.º de colegiatura</Etiqueta>
                      <Entrada value={colegiatura} onChangeText={setColegiatura} placeholder="CPsP 12345" autoCapitalize="characters" />
                    </View>
                    <Boton onPress={crear} inhabilitado={!nombre.trim() || !correo.includes('@') || !colegiatura.trim()} cargando={ocupado}>
                      Crear su cuenta
                    </Boton>
                  </View>
                )}
                {error && <Aviso>{error}</Aviso>}
                {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena} nota="Entra con estos datos en la app, como psicólogo. No se vuelve a mostrar." />}
              </Caja>
            )}

            <Caja estilo={{ padding: 0, overflow: 'hidden' }}>
              <View style={e.tablaCabecera}>
                <Text style={[texto.etiqueta, { color: color.textoMedio, flex: 3, fontSize: 10.5 }]}>PSICÓLOGO</Text>
                <Text style={[texto.etiqueta, { color: color.textoMedio, flex: 1.4, fontSize: 10.5 }]}>COLEGIATURA</Text>
                <Text style={[texto.etiqueta, { color: color.textoMedio, flex: 1, fontSize: 10.5, textAlign: 'right' }]}>ESTADO</Text>
              </View>
              {lista.length === 0 && (
                <View style={{ padding: espacio.lg }}>
                  <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                    Todavía no has dado de alta a ningún psicólogo. Mientras tanto, los casos de tu empresa los atiende un psicólogo de Bienestar Tech.
                  </Text>
                </View>
              )}
              {lista.map((p) => (
                <View key={p.id} style={e.tablaFila}>
                  <View style={[e.fila, { flex: 3, flexWrap: 'nowrap' }]}>
                    <Monograma nombre={p.nombre} />
                    <Text style={[texto.cuerpoFuerte, { color: color.texto, flexShrink: 1 }]} numberOfLines={1}>{p.nombre}</Text>
                  </View>
                  <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1.4 }]} numberOfLines={1}>{p.colegiatura}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Pastilla fondo={p.activo ? '#E8EFEA' : '#F1EFEB'} tinta={p.activo ? color.primarioProfundo : color.textoMedio}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Pastilla>
                  </View>
                </View>
              ))}
              {lista.length > 0 && (
                <View style={e.pieTabla}>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    {`${activos} ${activos === 1 ? 'activo' : 'activos'} de ${lista.length}`}
                  </Text>
                </View>
              )}
            </Caja>
          </>
        )}

        <Pie />
      </Pantalla>
    </Panel>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  botonVerde: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.primario, borderRadius: radio.md, paddingHorizontal: espacio.base, height: 44 },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-end', flexWrap: 'wrap' },
  campo: { flex: 1, minWidth: 190, gap: espacio.xs },
  tablaCabecera: { flexDirection: 'row', gap: espacio.sm, paddingVertical: espacio.md, paddingHorizontal: espacio.base, backgroundColor: '#F5F4F1' },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 12, paddingHorizontal: espacio.base, borderTopWidth: 1, borderTopColor: color.borde },
  pieTabla: { paddingVertical: 10, paddingHorizontal: espacio.base, borderTopWidth: 1, borderTopColor: color.borde, backgroundColor: '#FAFAF8' },
})

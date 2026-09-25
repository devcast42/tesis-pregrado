/** Ficha de empresa — implementa ESP-008 y ESP-009 RF-009-15.
 *  Mismo lenguaje visual que Figma 2IqfFSK20uCzmuMg6SvaUZ (no tiene marco propio).
 *
 *  Aquí viven los maestros que dependen de una empresa: sus participantes
 *  (por código) y sus administradores. Los psicólogos NO: pertenecen al
 *  estudio. Dar de baja conserva las respuestas y no cierra la derivación
 *  abierta (RN-008-16). */

import { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../../modules/investigador/filtro'
import { cerrarSeguimiento, participantes as cargarParticipantes, pulsoPorEmpresa, umbralesEmpresa, type FilaParticipanteV2 } from '../../../modules/investigador/panel'
import {
  crearAdmin, inscribirParticipante, listarAdmins, listarEmpresas, participacionDeEmpresa, restablecerParticipante,
  type Administrador, type Empresa, type FilaParticipacion,
} from '../../../modules/panel/datos'
import { BarraPct, BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, PastillaEstado, PastillaNivel, Rotulo, TONO } from '../../../modules/investigador/piezas'
import { Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoAgregar, IconoEquipo, IconoEscudoCheck, IconoHistorial, IconoMaletin, IconoPersona, IconoVolver } from '../../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
type Pestana = 'participantes' | 'admins'

export default function DetalleEmpresa() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { filtro } = useFiltro()
  const [pestana, setPestana] = useState<Pestana>('participantes')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [filas, setFilas] = useState<FilaParticipanteV2[] | null>(null)
  const [participacion, setParticipacion] = useState<FilaParticipacion[]>([])
  const [admins, setAdmins] = useState<Administrador[]>([])
  const [nivel, setNivel] = useState<'bajo' | 'a_vigilar' | 'alto' | null>(null)
  const [formulario, setFormulario] = useState<Pestana | null>(null)
  const [nombre, setNombre] = useState(''); const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ titulo: string; correo?: string; contrasena: string; nota: string } | null>(null)

  const cargar = useCallback(async () => {
    const [empresas, p, pa, a, pulso, umbrales] = await Promise.all([
      listarEmpresas(), cargarParticipantes({ organizacion_id: id }), participacionDeEmpresa(id), listarAdmins(id), pulsoPorEmpresa(), umbralesEmpresa(),
    ])
    setEmpresa(empresas.find((x) => x.id === id) ?? null); setFilas(p); setParticipacion(pa); setAdmins(a)
    const pul = pulso.find((x) => x.organizacion_id === id), u = umbrales.find((x) => x.dimension === 'agotamiento')
    setNivel(pul?.agotamiento != null && u ? (pul.agotamiento >= Number(u.alto) ? 'alto' : pul.agotamiento >= Number(u.a_vigilar) ? 'a_vigilar' : 'bajo') : null)
  }, [id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function inscribir() {
    setOcupado(true); setError(null)
    try {
      const r = await inscribirParticipante({ organizacion_id: id, correo, nombre })
      setCredencial({ titulo: `Participante inscrito · ${r.codigo_anonimo}`, correo, contrasena: r.contrasena, nota: 'Entrégala junto con el consentimiento informado. No se vuelve a mostrar.' })
      setNombre(''); setCorreo(''); setFormulario(null); await cargar()
    } catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo inscribir.') } finally { setOcupado(false) }
  }
  async function crearAdministrador() {
    setOcupado(true); setError(null)
    try {
      const r = await crearAdmin({ organizacion_id: id, correo, nombre })
      setCredencial({ titulo: `Administrador creado · ${nombre}`, correo: r.correo, contrasena: r.contrasena, nota: 'Contraseña temporal; la cambia al entrar. No se vuelve a mostrar.' })
      setNombre(''); setCorreo(''); setFormulario(null); await cargar()
    } catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo crear el administrador.') } finally { setOcupado(false) }
  }
  async function restablecer(p: FilaParticipanteV2) {
    setError(null)
    try { const r = await restablecerParticipante(p.id); setCredencial({ titulo: `Nueva contraseña de ${p.codigo_anonimo}`, contrasena: r.contrasena, nota: 'No se vuelve a mostrar.' }) }
    catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.') }
  }
  function darDeBaja(p: FilaParticipanteV2) {
    const texto = `Dar de baja a ${p.codigo_anonimo} por salida de la empresa.\n\nSus respuestas se conservan anonimizadas para el estudio; si tiene una derivación abierta, el psicólogo termina su caso. No se puede deshacer desde aquí.`
    const ok = Platform.OS === 'web' ? window.confirm(texto) : true
    if (!ok) return
    cerrarSeguimiento(p.id, 'salida_empresa').then(cargar).catch((ex) => setError(ex instanceof Error ? ex.message : 'No se pudo dar de baja.'))
  }

  if (!filas || !empresa) return <Panel rol="investigador"><Cargando /></Panel>

  const consent = new Map(participacion.map((x) => [x.participante_id, x.consentimiento]))
  const activos = filas.filter((p) => p.estado === 'activo' || p.estado === 'detectado')
  const adhMedia = activos.length ? activos.reduce((s, p) => s + Number(p.tasa_adherencia ?? 0), 0) / activos.length : null
  const orden = [...filas].sort((a, b) => a.codigo_anonimo.localeCompare(b.codigo_anonimo))

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Pressable onPress={() => router.push(conFiltro('/investigador/empresas', filtro) as never)} style={[e.fila, { gap: 4 }]}><IconoVolver tamano={12} color={color.textoMedio} /><Text style={[texto.dato, { color: color.textoMedio }]}>Empresas participantes</Text></Pressable>
        <Encabezado eyebrow="Maestro de cohortes · ficha de empresa" titulo={empresa.nombre}
          subtitulo={`Convenio activo desde el ${new Date(empresa.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}. Participantes por código anónimo; los nombres solo los ve el administrador de la empresa (RN-006-01).`}
          derecha={(
            <View style={[e.fila, { gap: 8 }]}>
              <Pastilla tono={nivel === 'alto' ? TONO.tierra : nivel === 'a_vigilar' ? TONO.ambar : nivel ? TONO.verde : TONO.gris} punto>{nivel === 'alto' ? 'Pulso: Nivel Alto' : nivel === 'a_vigilar' ? 'Pulso: A vigilar' : nivel ? 'Pulso: Estable' : 'Pulso: sin OLBI aún'}</Pastilla>
              <BotonChico onPress={() => router.push(conFiltro('/investigador/participantes', { ...filtro, organizacion_id: id }) as never)} icono={<IconoEquipo tamano={13} color={color.texto} />}>Ver en Participantes</BotonChico>
            </View>
          )} />

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Tarjeta rotulo="Inscritos" icono={<IconoPersona tamano={16} color={color.primarioProfundo} />}><Cifra v={String(filas.length)} nota={`${filas.filter((p) => consent.get(p.id) === true).length} con consentimiento`} /></Tarjeta>
          <Tarjeta rotulo="En seguimiento" icono={<IconoEquipo tamano={16} color={color.primarioProfundo} />}><Cifra v={String(activos.length)} nota={`${filas.filter((p) => p.estado === 'detectado').length} detectados · ${filas.filter((p) => p.estado === 'finalizado' || p.estado === 'retirado').length} fuera`} /></Tarjeta>
          <Tarjeta rotulo="Adherencia media" icono={<IconoHistorial tamano={16} color={color.primarioProfundo} />}><Cifra v={adhMedia == null ? '—' : `${Math.round(adhMedia * (adhMedia <= 1 ? 100 : 1))}%`} nota="check-ins diarios de los activos" tinta={adhMedia != null && adhMedia * (adhMedia <= 1 ? 100 : 1) < 80 ? '#B45309' : color.texto} /></Tarjeta>
          <Tarjeta rotulo="Administradores" icono={<IconoMaletin tamano={16} color={color.primarioProfundo} />}><Cifra v={String(admins.filter((a) => a.activo).length)} nota="gestionan cuentas; no ven respuestas" /></Tarjeta>
        </View>

        {/* Pestañas */}
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <View style={e.segmentos}>
            {([['participantes', 'Participantes', filas.length], ['admins', 'Administradores', admins.length]] as const).map(([k, t, n]) => (
              <Pressable key={k} onPress={() => { setPestana(k); setFormulario(null) }} style={[e.segmento, pestana === k && e.segmentoOn]}>
                <Text style={[texto.datoFuerte, { color: pestana === k ? color.primarioProfundo : color.textoMedio }]}>{t}</Text><Pastilla tono={pestana === k ? TONO.verde : TONO.gris}>{String(n)}</Pastilla>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => { setFormulario(formulario === pestana ? null : pestana); setError(null) }} style={e.botonLleno}>
            <IconoAgregar tamano={13} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{pestana === 'participantes' ? 'Inscribir participante' : 'Crear administrador'}</Text>
          </Pressable>
        </View>

        {formulario && (
          <Caja estilo={{ gap: espacio.sm }}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{formulario === 'participantes' ? 'Nuevo participante' : 'Nuevo administrador de empresa'}</Text>
            <View style={[e.fila, { gap: espacio.sm }]}>
              <Campo rotulo="Nombre y apellido" valor={nombre} onChange={setNombre} placeholder="Nombre Apellido" />
              <Campo rotulo="Correo" valor={correo} onChange={setCorreo} placeholder="nombre@empresa.pe" />
            </View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              {formulario === 'participantes' ? 'Se genera un código anónimo y una contraseña inicial. El nombre queda en la tabla de identidad, separada de las respuestas; este panel solo verá el código.' : 'Un administrador gestiona las cuentas de su empresa y ve el pulso agregado. No accede a respuestas, puntajes ni derivaciones.'}
            </Text>
            <View style={[e.fila, { gap: 8 }]}>
              <BotonChico onPress={formulario === 'participantes' ? inscribir : crearAdministrador} tono={!nombre.trim() || !correo.includes('@') ? 'suave' : 'verde'}>{ocupado ? 'Creando…' : formulario === 'participantes' ? 'Inscribir' : 'Crear acceso'}</BotonChico>
              <BotonChico onPress={() => setFormulario(null)} tono="suave">Cancelar</BotonChico>
            </View>
          </Caja>
        )}
        {error && <View style={e.error}><Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text></View>}
        {credencial && (
          <View style={e.credencial}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{credencial.titulo}</Text>
              {credencial.correo && <Text style={[texto.dato, { color: color.textoMedio }]}>Usuario: <Mono tono={color.texto}>{credencial.correo}</Mono></Text>}
              <Text style={[texto.dato, { color: color.textoMedio }]}>Contraseña: <Mono tono={color.texto} tamano={13}>{credencial.contrasena}</Mono></Text>
              <Text style={[texto.dato, { color: '#8C4A2B' }]}>{credencial.nota}</Text>
            </View>
            <BotonChico onPress={async () => { try { await navigator.clipboard.writeText(credencial.contrasena) } catch {} }} tono="suave">Copiar</BotonChico>
            <BotonChico onPress={() => setCredencial(null)} tono="suave">Cerrar</BotonChico>
          </View>
        )}

        {pestana === 'participantes' ? (
          <Caja estilo={{ gap: 4 }}>
            <View style={e.tablaCab}>
              {[['Código', 0.9], ['Consent.', 0.9], ['Estado', 0.9], ['Semana', 0.7], ['Adherencia', 1.3], ['Último OLBI', 0.9], ['Derivación', 1], ['', 2]].map(([h, f]) => (
                <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
              ))}
            </View>
            {orden.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 12 }]}>Todavía no hay participantes en esta empresa.</Text>}
            {orden.map((p) => {
              const c = consent.get(p.id)
              const fuera = p.estado === 'finalizado' || p.estado === 'retirado'
              return (
                <View key={p.id} style={[e.tablaFila, fuera && { opacity: 0.6 }]}>
                  <Pressable style={{ flex: 0.9 }} onPress={() => router.push(conFiltro(`/investigador/participante/${p.id}`, filtro) as never)}><Codigo>{p.codigo_anonimo}</Codigo></Pressable>
                  <View style={{ flex: 0.9 }}><Pastilla tono={c === true ? TONO.verdeSuave : c === false ? TONO.tierraSuave : TONO.gris}>{c === true ? 'Aceptado' : c === false ? 'Rechazado' : 'Pendiente'}</Pastilla></View>
                  <View style={{ flex: 0.9 }}><PastillaEstado estado={p.estado} /></View>
                  <Mono tono={color.texto}>S{Math.min(p.semana, 6)}</Mono>
                  <View style={{ flex: 1.3 }}><BarraPct pct={p.tasa_adherencia == null ? null : Number(p.tasa_adherencia) * (Number(p.tasa_adherencia) <= 1 ? 100 : 1)} /></View>
                  <View style={{ flex: 0.9 }}><PastillaNivel nivel={p.olbi_nivel} /></View>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{p.estado_derivacion ? `${p.estado_derivacion === 'cerrada' ? 'Cerrada' : 'Abierta'} · ${p.psicologo ?? 'sin asignar'}` : '—'}</Text>
                  <View style={[e.fila, { flex: 2, gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }]}>
                    <BotonChico onPress={() => router.push(conFiltro(`/investigador/participante/${p.id}`, filtro) as never)} tono="suave">Ficha</BotonChico>
                    {!fuera && <BotonChico onPress={() => restablecer(p)}>Restablecer</BotonChico>}
                    {!fuera && <Pressable onPress={() => darDeBaja(p)} style={e.botonBaja}><Text style={[texto.datoFuerte, { color: '#8C4A2B' }]}>Dar de baja</Text></Pressable>}
                  </View>
                </View>
              )
            })}
            <View style={[e.nota, { marginTop: 8 }]}>
              <IconoEscudoCheck tamano={13} color={color.primarioProfundo} />
              <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Sin nombres: el investigador trabaja con códigos (RN-006-01). «Dar de baja» cierra el seguimiento por salida de la empresa; las respuestas se conservan (RN-001-03) y una derivación abierta sigue su curso (RN-008-16).</Text>
            </View>
          </Caja>
        ) : (
          <Caja estilo={{ gap: 4 }}>
            <View style={e.tablaCab}>
              {[['Administrador', 2], ['Estado', 1], ['Alcance', 2]].map(([h, f]) => <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>)}
            </View>
            {admins.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 12 }]}>Esta empresa no tiene administradores: nadie puede ver su pulso agregado ni gestionar sus cuentas.</Text>}
            {admins.map((a) => (
              <View key={a.id} style={e.tablaFila}>
                <View style={[e.fila, { flex: 2, gap: 10 }]}>
                  <View style={e.avatar}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{a.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</Text></View>
                  <Text style={[texto.datoFuerte, { color: color.texto }]}>{a.nombre}</Text>
                </View>
                <View style={{ flex: 1 }}>{a.activo ? <Pastilla tono={TONO.verde}>Activo</Pastilla> : <Pastilla tono={TONO.gris}>Inactivo</Pastilla>}</View>
                <Text style={[texto.dato, { color: color.textoMedio, flex: 2 }]}>Pulso agregado y cuentas de {empresa.nombre}. Nunca respuestas, puntajes ni derivaciones.</Text>
              </View>
            ))}
          </Caja>
        )}
      </ScrollView>
    </Panel>
  )
}

function Campo({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor: string; onChange: (t: string) => void; placeholder: string }) {
  return (
    <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput value={valor} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.textoSuave} autoCapitalize="none" autoCorrect={false} style={[texto.dato, e.entrada, { outlineStyle: 'none' } as any]} />
    </View>
  )
}
function Tarjeta({ rotulo, icono, children }: { rotulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return <View style={e.tarjeta}><View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><View style={e.cuadroIcono}>{icono}</View></View>{children}</View>
}
function Cifra({ v, nota, tinta = color.texto }: { v: string; nota: string; tinta?: string }) {
  return <View><Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 26 }]}>{v}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{nota}</Text></View>
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  tarjeta: { flex: 1, minWidth: 180, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 6 },
  cuadroIcono: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  segmentos: { flexDirection: 'row', backgroundColor: '#F1EFEB', borderRadius: 8, padding: 3 },
  segmento: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segmentoOn: { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 38 },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  error: { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10 },
  credencial: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: 12, flexWrap: 'wrap' },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8' },
  botonBaja: { height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F3DDD2', backgroundColor: color.superficie, justifyContent: 'center' },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10 },
  avatar: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
})

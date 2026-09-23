/** Maestro de psicólogos — implementa ESP-008 y ESP-009 RF-009-15 (§9.3).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Psicólogos · Investigador Principal».
 *
 *  Los psicólogos pertenecen al estudio, no a una empresa. Lo delicado es la
 *  salida: desactivar a alguien con casos abiertos obliga a decir a quién van
 *  esos casos; no se puede dejar una derivación sin psicólogo. */

import { useCallback, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { circuito as cargarCircuito, citasEstudio, desactivarPsicologo, mediana, reactivarPsicologo, type CircuitoApoyo, type CitaEstudio } from '../../modules/investigador/panel'
import { crearPsicologo, listarEmpresas, listarPsicologos, restablecerContrasena, type Empresa, type Psicologo } from '../../modules/panel/datos'
import { BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoAgregar, IconoCalendario, IconoEquipo, IconoHistorial, IconoPersona, IconoReloj } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

export default function Psicologos() {
  const [filas, setFilas] = useState<Psicologo[] | null>(null)
  const [casos, setCasos] = useState<CircuitoApoyo[]>([])
  const [citas, setCitas] = useState<CitaEstudio[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [formulario, setFormulario] = useState(false)
  const [nombre, setNombre] = useState(''); const [correo, setCorreo] = useState(''); const [colegiatura, setColegiatura] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ titulo: string; correo?: string; contrasena: string } | null>(null)
  const [baja, setBaja] = useState<{ psicologo: Psicologo; destino: string | null; paso: 1 | 2 } | null>(null)

  const cargar = useCallback(async () => {
    const [ps, c, ci, em] = await Promise.all([listarPsicologos(), cargarCircuito(), citasEstudio(), listarEmpresas().catch(() => [] as Empresa[])])
    setFilas(ps); setCasos(c); setCitas(ci); setEmpresas(em)
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function crear() {
    setOcupado(true); setError(null)
    try {
      const r = await crearPsicologo({ correo, nombre, colegiatura })
      setCredencial({ titulo: `Acceso creado para ${nombre}`, correo: r.correo, contrasena: r.contrasena })
      setNombre(''); setCorreo(''); setColegiatura(''); setFormulario(false)
      await cargar()
    } catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo crear el psicólogo.') } finally { setOcupado(false) }
  }
  async function restablecer(p: Psicologo) {
    setError(null)
    try { const r = await restablecerContrasena(p.auth_user_id); setCredencial({ titulo: `Contraseña temporal de ${p.nombre}`, contrasena: r.contrasena }) }
    catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.') }
  }
  async function confirmarBaja() {
    if (!baja) return
    setOcupado(true)
    try { await desactivarPsicologo(baja.psicologo.id, baja.destino); setBaja(null); await cargar() }
    catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo desactivar.'); setBaja(null) } finally { setOcupado(false) }
  }
  async function reactivar(p: Psicologo) { try { await reactivarPsicologo(p.id); await cargar() } catch (ex) { setError(ex instanceof Error ? ex.message : '') } }

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const activos = filas.filter((p) => p.activo)
  const abiertosDe = (id: string) => casos.filter((c) => c.psicologo_id === id && !c.cerrada_en)
  const lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7)); lunes.setHours(0, 0, 0, 0)
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 7)
  const citasSemana = citas.filter((c) => new Date(c.propuesta_para) >= lunes && new Date(c.propuesta_para) < domingo && c.estado !== 'cancelada')
  const totalAbiertos = casos.filter((c) => !c.cerrada_en).length
  const medGlobal = mediana(casos.map((c) => c.dias_a_sesion))
  const masCargado = activos.map((p) => ({ p, n: abiertosDe(p.id).length })).sort((a, b) => b.n - a.n)[0]
  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? '—'

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Equipo clínico y capacidad asistencial   /   Protocolo ético ESP-009 · UNT" titulo="Equipo de Psicólogos y Capacidad de Apoyo"
          subtitulo="Supervisión de carga asistencial, asignación balanceada de derivaciones críticas y gestión de credenciales clínicas bajo trazabilidad estricta."
          derecha={<Pressable onPress={() => setFormulario((v) => !v)} style={e.botonLleno}><IconoAgregar tamano={14} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>+ Registrar nuevo psicólogo</Text></Pressable>} />

        {formulario && (
          <Caja estilo={{ gap: espacio.sm }}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Nuevo psicólogo del estudio</Text>
            <View style={[e.fila, { gap: espacio.sm }]}>
              <Campo rotulo="Nombre profesional" valor={nombre} onChange={setNombre} placeholder="Lic. Nombre Apellido" />
              <Campo rotulo="Colegiatura (CPsP)" valor={colegiatura} onChange={setColegiatura} placeholder="28419" />
              <Campo rotulo="Correo de acceso" valor={correo} onChange={setCorreo} placeholder="nombre@institucion.pe" />
            </View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Se crea la cuenta con una contraseña temporal que verás una sola vez; el psicólogo la cambia al entrar.</Text>
            <View style={[e.fila, { gap: 8 }]}>
              <BotonChico onPress={crear} tono="verde">{ocupado ? 'Creando…' : 'Crear acceso'}</BotonChico>
              <BotonChico onPress={() => setFormulario(false)} tono="suave">Cancelar</BotonChico>
            </View>
          </Caja>
        )}
        {error && <View style={e.error}><Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text></View>}
        {credencial && (
          <View style={e.credencial}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{credencial.titulo}</Text>
              {credencial.correo && <Text style={[texto.dato, { color: color.textoMedio }]}>Usuario: <Mono tono={color.texto}>{credencial.correo}</Mono></Text>}
              <Text style={[texto.dato, { color: color.textoMedio }]}>Contraseña temporal: <Mono tono={color.texto} tamano={13}>{credencial.contrasena}</Mono></Text>
              <Text style={[texto.dato, { color: '#8C4A2B' }]}>Se muestra una sola vez. Cópiala y entrégala por un canal seguro.</Text>
            </View>
            <BotonChico onPress={async () => { try { await navigator.clipboard.writeText(credencial.contrasena) } catch {} }} tono="suave">Copiar</BotonChico>
            <BotonChico onPress={() => setCredencial(null)} tono="suave">Cerrar</BotonChico>
          </View>
        )}

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Tarjeta rotulo="Profesionales activos" icono={<IconoPersona tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{activos.length}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>de {filas.length} registrados</Text></View>
            <View style={[e.fila, { gap: 6 }]}><View style={[e.punto, { backgroundColor: color.primarioProfundo }]} /><Text style={[texto.dato, { color: color.textoMedio }]}>{filas.length ? Math.round((activos.length / filas.length) * 100) : 0}% disponibilidad operativa</Text></View>
            <Barra pct={filas.length ? (activos.length / filas.length) * 100 : 0} />
          </Tarjeta>
          <Tarjeta rotulo="Casos en contención" icono={<IconoEquipo tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{totalAbiertos}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>derivaciones abiertas</Text></View>
            {masCargado && masCargado.n > 0 && totalAbiertos > 0 && <Text style={[texto.dato, { color: masCargado.n / totalAbiertos >= 0.5 ? '#8C4A2B' : color.textoMedio }]}>{masCargado.n / totalAbiertos >= 0.5 ? '⚠ ' : ''}{masCargado.p.nombre.replace(/^(Lic\.|Mg\.|Dr\.|Dra\.)\s*/, '')} concentra el {Math.round((masCargado.n / totalAbiertos) * 100)}%</Text>}
            <Barra pct={totalAbiertos ? (masCargado?.n ?? 0) / totalAbiertos * 100 : 0} tinta="#8C4A2B" fondo={color.primarioProfundo} />
          </Tarjeta>
          <Tarjeta rotulo="Sesiones semanales" icono={<IconoCalendario tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{citasSemana.length}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>citas agendadas</Text></View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Semana del {lunes.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} en curso</Text>
            <Barra pct={citasSemana.length ? Math.min(100, (citasSemana.filter((c) => c.estado === 'realizada').length / citasSemana.length) * 100) : 0} />
          </Tarjeta>
          <Tarjeta rotulo="Mediana a 1ª sesión" icono={<IconoReloj tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{medGlobal == null ? '—' : medGlobal.toFixed(1)}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>días hábiles</Text></View>
            <Text style={[texto.dato, { color: medGlobal != null && medGlobal > 7 ? '#8C4A2B' : color.primarioProfundo }]}>{medGlobal == null ? 'Sin sesiones todavía' : medGlobal <= 7 ? 'Objetivo ético < 7 días cumplido' : 'Objetivo ético < 7 días no cumplido'}</Text>
            <Barra pct={medGlobal == null ? 0 : Math.min(100, (medGlobal / 7) * 100)} tinta={medGlobal != null && medGlobal > 7 ? '#8C4A2B' : color.primarioProfundo} />
          </Tarjeta>
        </View>

        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <View style={[e.fila, { gap: 8 }]}><Text style={[texto.seccion, { color: color.texto }]}>Personal Clínico Acreditado</Text><Pastilla tono={TONO.gris} mono>{`${filas.length} integrantes`}</Pastilla></View>
          <View style={[e.fila, { gap: 12 }]}><Leyenda tinta={color.primarioProfundo} texto="Carga óptima (≤ 4)" /><Leyenda tinta="#8C4A2B" texto="Capacidad elevada (> 4)" /></View>
        </View>

        {filas.map((p) => {
          const abiertos = abiertosDe(p.id)
          const semana = citasSemana.filter((c) => c.psicologo_id === p.id).length
          const med = mediana(casos.filter((c) => c.psicologo_id === p.id).map((c) => c.dias_a_sesion))
          const capacidad = Math.min(100, (abiertos.length / 6) * 100)
          return (
            <View key={p.id} style={[e.tarjetaPs, !p.activo && { backgroundColor: '#F5F4F1', opacity: 0.85 }]}>
              <View style={e.avatar}><Text style={[texto.cuerpoFuerte, { color: p.activo ? color.primarioProfundo : color.textoMedio }]}>{iniciales(p.nombre)}</Text></View>
              <View style={{ flex: 1.4, minWidth: 200, gap: 3 }}>
                <View style={[e.fila, { gap: 8 }]}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{p.nombre}</Text>{p.activo ? <Pastilla tono={TONO.verde}>Activo</Pastilla> : <Pastilla tono={TONO.gris}>Inactivo</Pastilla>}</View>
                {p.activo
                  ? <View style={{ flexDirection: 'row' }}><Pastilla tono={abiertos.length > 4 ? TONO.tierraSuave : abiertos.length >= 3 ? TONO.gris : TONO.verdeSuave} mono>{abiertos.length > 4 ? `Al ${Math.round(capacidad)}% de capacidad` : abiertos.length >= 3 ? `Carga balanceada (${Math.round(capacidad)}%)` : `Capacidad disponible (${Math.round(capacidad)}%)`}</Pastilla></View>
                  : <View style={{ flexDirection: 'row' }}><Pastilla tono={TONO.gris} mono>Inactivo · sin casos asignables</Pastilla></View>}
                <Mono>{/^cpsp/i.test(p.colegiatura) ? p.colegiatura : `CPsP ${p.colegiatura}`}</Mono>
              </View>
              <View style={[e.datos, !p.activo && { backgroundColor: '#EDEBE7' }]}>
                <Dato rotulo="Casos abiertos" valor={String(abiertos.length)} unidad="pacientes" tinta={abiertos.length > 4 ? '#8C4A2B' : color.texto} />
                <Dato rotulo="Esta semana" valor={String(semana)} unidad="citas" />
                <Dato rotulo="Mediana respuesta" valor={med == null ? '—' : med.toFixed(1)} unidad={med == null ? '' : 'días'} tinta={med != null && med <= 7 ? color.primarioProfundo : color.texto} />
              </View>
              <View style={[e.fila, { gap: 6, justifyContent: 'flex-end' }]}>
                {p.activo ? (
                  <>
                    <BotonChico onPress={() => restablecer(p)} icono={<IconoHistorial tamano={13} color={color.texto} />}>Restablecer contraseña</BotonChico>
                    <Pressable onPress={() => setBaja({ psicologo: p, destino: null, paso: 1 })} style={[e.botonBaja, abiertos.length > 0 && { borderColor: '#F3DDD2' }]}><Text style={[texto.datoFuerte, { color: '#8C4A2B' }]}>Desactivar</Text></Pressable>
                  </>
                ) : <BotonChico onPress={() => reactivar(p)} icono={<IconoPersona tamano={13} color={color.texto} />}>Reactivar psicólogo</BotonChico>}
              </View>
            </View>
          )
        })}
        {filas.length === 0 && <Caja><Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay psicólogos. Sin uno activo, las detecciones quedan sin derivar.</Text></Caja>}
      </ScrollView>

      {/* Salida ordenada: dos pasos */}
      <Modal transparent visible={!!baja} animationType="fade" onRequestClose={() => setBaja(null)}>
        {baja && (() => {
          const abiertos = abiertosDe(baja.psicologo.id)
          const candidatos = activos.filter((p) => p.id !== baja.psicologo.id)
          const menorCarga = [...candidatos].sort((a, b) => abiertosDe(a.id).length - abiertosDe(b.id).length)[0]
          return (
            <View style={e.velo}>
              <Caja estilo={{ width: 520, maxWidth: '94%', gap: espacio.sm }}>
                <Rotulo tinta="#8C4A2B">{`Desactivar psicólogo · paso ${baja.paso} de 2`}</Rotulo>
                <Text style={[texto.seccion, { color: color.texto }]}>{baja.psicologo.nombre}</Text>
                {baja.paso === 1 ? (
                  <>
                    {abiertos.length === 0 ? (
                      <Text style={[texto.dato, { color: color.textoMedio }]}>No tiene casos abiertos. Al desactivarlo deja de recibir derivaciones nuevas; su historial se conserva.</Text>
                    ) : (
                      <>
                        <Text style={[texto.dato, { color: color.texto }]}>Tiene <Text style={texto.datoFuerte}>{abiertos.length} casos abiertos</Text>. No se puede desactivar dejando derivaciones sin psicólogo: elige a quién pasan.</Text>
                        <View style={{ gap: 4 }}>
                          {abiertos.map((c) => (
                            <View key={c.derivacion_id} style={[e.fila, { justifyContent: 'space-between', backgroundColor: '#F5F4F1', borderRadius: 6, padding: 8 }]}>
                              <View style={[e.fila, { gap: 8 }]}><Codigo>{c.codigo_anonimo}</Codigo><Text style={[texto.dato, { color: color.textoMedio }]}>{nombreEmpresa(c.organizacion_id)}</Text></View>
                              <Mono>{Math.floor((Date.now() - new Date(c.derivado_en).getTime()) / 86_400_000)} d en curso</Mono>
                            </View>
                          ))}
                        </View>
                        <Rotulo>Reasignar todos a</Rotulo>
                        {candidatos.length === 0 && <Text style={[texto.dato, { color: '#8C4A2B' }]}>No hay otro psicólogo activo. Crea o reactiva uno antes de desactivar a {baja.psicologo.nombre}.</Text>}
                        {candidatos.map((p) => (
                          <Pressable key={p.id} onPress={() => setBaja({ ...baja, destino: p.id })} style={[e.opcion, baja.destino === p.id && { borderColor: color.primarioProfundo, backgroundColor: '#EAF4EF' }]}>
                            <Text style={[texto.datoFuerte, { color: color.texto, flex: 1 }]}>{p.nombre}</Text>
                            <Pastilla tono={abiertosDe(p.id).length > 4 ? TONO.tierraSuave : TONO.verdeSuave}>{`${abiertosDe(p.id).length} abiertos`}</Pastilla>
                            {menorCarga?.id === p.id && <Pastilla tono={TONO.gris}>menor carga</Pastilla>}
                          </Pressable>
                        ))}
                      </>
                    )}
                    <View style={[e.fila, { gap: 8, justifyContent: 'flex-end' }]}>
                      <BotonChico onPress={() => setBaja(null)} tono="suave">Cancelar</BotonChico>
                      <BotonChico onPress={() => setBaja({ ...baja, paso: 2 })} tono={abiertos.length > 0 && !baja.destino ? 'suave' : 'tierra'}>{abiertos.length > 0 && !baja.destino ? 'Elige un destino' : 'Continuar'}</BotonChico>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[texto.dato, { color: color.texto }]}>
                      {abiertos.length > 0 ? `Se reasignarán ${abiertos.length} derivaciones (y sus citas vigentes) a ${candidatos.find((p) => p.id === baja.destino)?.nombre ?? '—'}, cada una con su evento de reasignación. ` : ''}
                      {baja.psicologo.nombre} quedará inactivo: no recibirá derivaciones ni podrá entrar al panel clínico. Puedes reactivarlo después.
                    </Text>
                    <View style={[e.fila, { gap: 8, justifyContent: 'flex-end' }]}>
                      <BotonChico onPress={() => setBaja({ ...baja, paso: 1 })} tono="suave">Volver</BotonChico>
                      <BotonChico onPress={confirmarBaja} tono="tierra">{ocupado ? 'Aplicando…' : 'Confirmar desactivación'}</BotonChico>
                    </View>
                  </>
                )}
              </Caja>
            </View>
          )
        })()}
      </Modal>
    </Panel>
  )
}

function iniciales(n: string) { return n.replace(/^(Lic\.|Mg\.|Dr\.|Dra\.|Ps\.)\s*/i, '').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') }

function Campo({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor: string; onChange: (t: string) => void; placeholder: string }) {
  return (
    <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput value={valor} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.textoSuave} autoCapitalize="none" style={[texto.dato, e.entrada, { outlineStyle: 'none' } as any]} />
    </View>
  )
}
function Tarjeta({ rotulo, icono, children }: { rotulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return <View style={e.tarjeta}><View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><View style={e.cuadroIcono}>{icono}</View></View>{children}</View>
}
function Barra({ pct, tinta = color.primarioProfundo, fondo = '#EDEBE7' }: { pct: number; tinta?: string; fondo?: string }) {
  return <View style={[e.pista, { backgroundColor: fondo }]}><View style={[e.lleno, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: tinta }]} /></View>
}
function Dato({ rotulo, valor, unidad, tinta = color.texto }: { rotulo: string; valor: string; unidad: string; tinta?: string }) {
  return <View style={{ minWidth: 90 }}><Rotulo>{rotulo}</Rotulo><View style={[e.fila, { alignItems: 'baseline', gap: 4 }]}><Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 18 }]}>{valor}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{unidad}</Text></View></View>
}
function Leyenda({ tinta, texto: t }: { tinta: string; texto: string }) {
  return <View style={[e.fila, { gap: 5 }]}><View style={[e.punto, { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio }]}>{t}</Text></View>
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 40 },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  error: { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10 },
  credencial: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: 12, flexWrap: 'wrap' },
  tarjeta: { flex: 1, minWidth: 190, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 6 },
  cuadroIcono: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  cifra: { ...texto.cifra, color: color.texto, fontFamily: MONO, fontSize: 28 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  pista: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  lleno: { height: 5, borderRadius: 3 },
  tarjetaPs: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, flexWrap: 'wrap' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
  datos: { flexDirection: 'row', gap: espacio.md, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, flexWrap: 'wrap' },
  botonBaja: { height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie, justifyContent: 'center' },
  velo: { flex: 1, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', justifyContent: 'center' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: color.borde },
})

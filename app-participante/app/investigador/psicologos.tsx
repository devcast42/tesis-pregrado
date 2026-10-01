/** Maestro de psicólogos — implementa ESP-008 y ESP-009 RF-009-15 (§9.3).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Psicólogos · Investigador Principal».
 *
 *  Los psicólogos pertenecen al estudio, no a una empresa. Lo delicado es la
 *  salida: desactivar a alguien con casos abiertos obliga a decir a quién van
 *  esos casos; no se puede dejar una derivación sin psicólogo. */

import { useCallback, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { circuito as cargarCircuito, citasEstudio, desactivarPsicologo, mediana, reactivarPsicologo, type CircuitoApoyo, type CitaEstudio } from '../../modules/investigador/panel'
import { listarEmpresas, listarPsicologos, restablecerContrasena, type Empresa, type Psicologo } from '../../modules/panel/datos'
import { DialogoPersona } from '../../modules/investigador/DialogoPersona'
import { BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto, veloModal } from '../../modules/nucleo/diseno'
import { IconoAgregar, IconoCalendario, IconoEquipo, IconoHistorial, IconoPersona, IconoReloj } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const TIERRA = '#8C4A2B'
/** Protocolo: de la detección a la primera sesión, menos de una semana. */
const LIMITE_DIAS = 7
/** Más de esto en casos abiertos a la vez y conviene repartir. */
const CARGA_ALTA = 4

export default function Psicologos() {
  const [filas, setFilas] = useState<Psicologo[] | null>(null)
  const [casos, setCasos] = useState<CircuitoApoyo[]>([])
  const [citas, setCitas] = useState<CitaEstudio[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [formulario, setFormulario] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ titulo: string; correo?: string; contrasena: string } | null>(null)
  const [baja, setBaja] = useState<{ psicologo: Psicologo; destino: string | null; paso: 1 | 2 } | null>(null)

  const cargar = useCallback(async () => {
    const [ps, c, ci, em] = await Promise.all([listarPsicologos(), cargarCircuito(), citasEstudio(), listarEmpresas().catch(() => [] as Empresa[])])
    setFilas(ps); setCasos(c); setCitas(ci); setEmpresas(em)
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

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
  // Se avisa cuando uno solo lleva la mitad o más de los casos abiertos: es lo
  // que hay que mirar para repartir, y lo único de esta pantalla que pide una
  // decisión.
  const concentra = !!masCargado && totalAbiertos > 1 && masCargado.n / totalAbiertos >= 0.5
  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? '—'

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Equipo clínico · ESP-009" titulo="Psicólogos"
          subtitulo={`${filas.length} ${filas.length === 1 ? 'psicólogo' : 'psicólogos'}${filas.length !== activos.length ? `, ${activos.length} ${activos.length === 1 ? 'activo' : 'activos'}` : ''}. Atienden a todo el estudio, no a una empresa.`}
          derecha={<Pressable onPress={() => setFormulario((v) => !v)} style={e.botonLleno}><IconoAgregar tamano={14} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Nuevo psicólogo</Text></Pressable>} />

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
          <Tarjeta rotulo="Casos abiertos" icono={<IconoEquipo tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{totalAbiertos}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{totalAbiertos === 1 ? 'derivación' : 'derivaciones'}</Text></View>
            <Text style={[texto.dato, { color: concentra ? '#8C4A2B' : color.textoMedio }]}>
              {!masCargado || masCargado.n === 0 ? 'Nadie tiene casos asignados.'
                : concentra ? `${sinTrato(masCargado.p.nombre)} lleva ${masCargado.n} de ${totalAbiertos}`
                : `Repartidos entre ${activos.filter((x) => abiertosDe(x.id).length > 0).length} psicólogos`}
            </Text>
          </Tarjeta>
          <Tarjeta rotulo="Citas esta semana" icono={<IconoCalendario tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{citasSemana.length}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{citasSemana.length === 1 ? 'agendada' : 'agendadas'}</Text></View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>{`Desde el lunes ${lunes.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`}</Text>
          </Tarjeta>
          <Tarjeta rotulo="De detección a primera sesión" icono={<IconoReloj tamano={16} color={color.primarioProfundo} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={[e.cifra, medGlobal != null && medGlobal > LIMITE_DIAS && { color: '#8C4A2B' }]}>{medGlobal == null ? '—' : medGlobal.toFixed(1)}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>días de mediana</Text></View>
            <Text style={[texto.dato, { color: medGlobal != null && medGlobal > LIMITE_DIAS ? '#8C4A2B' : color.primarioProfundo }]}>
              {medGlobal == null ? 'Todavía sin sesiones' : medGlobal <= LIMITE_DIAS ? `Dentro del protocolo (< ${LIMITE_DIAS} días)` : `Fuera del protocolo (< ${LIMITE_DIAS} días)`}
            </Text>
          </Tarjeta>
        </View>

        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>El equipo</Text>
          <Text style={[texto.dato, { color: color.textoMedio }]}>{`Más de ${CARGA_ALTA} casos abiertos a la vez se marca en naranja.`}</Text>
        </View>

        {filas.map((p) => {
          const abiertos = abiertosDe(p.id)
          const semana = citasSemana.filter((c) => c.psicologo_id === p.id).length
          const med = mediana(casos.filter((c) => c.psicologo_id === p.id).map((c) => c.dias_a_sesion))
          return (
            <View key={p.id} style={[e.tarjetaPs, !p.activo && { backgroundColor: '#F5F4F1', opacity: 0.85 }]}>
              <View style={e.avatar}><Text style={[texto.cuerpoFuerte, { color: p.activo ? color.primarioProfundo : color.textoMedio }]}>{iniciales(p.nombre)}</Text></View>
              <View style={{ flex: 1, minWidth: 170, gap: 3 }}>
                {/* «Activo» en los tres no dice nada y, con un nombre largo, la
                    pastilla se partía y dejaba esa fila más alta. Solo se
                    señala la excepción. */}
                <View style={[e.fila, { gap: 8 }]}>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{p.nombre}</Text>
                  {!p.activo && <Pastilla tono={TONO.gris}>Inactivo</Pastilla>}
                </View>
                {/* La pastilla de «capacidad» decía «Capacidad disponible (0%)» a
                    quien no tenía ni un caso, que se lee como que está lleno; y
                    calculaba el porcentaje sobre 6 mientras la leyenda hablaba de
                    4. La cifra de casos abiertos, coloreada, lo dice sin ambigüedad. */}
                <Mono>{/^cpsp/i.test(p.colegiatura) ? p.colegiatura : `CPsP ${p.colegiatura}`}</Mono>
                {!p.activo && <Text style={[texto.dato, { color: color.textoMedio }]}>No recibe derivaciones nuevas.</Text>}
              </View>
              {/* Sin caja gris: tres columnas sueltas, igual que en la lista de
                  Empresas. Un recuadro dentro de la tarjeta compite con la
                  tarjeta y amontona las cifras contra los botones. */}
              <Dato rotulo="Casos abiertos" valor={String(abiertos.length)}
                apoyo={abiertos.length === 0 ? 'ninguno' : abiertos.length > CARGA_ALTA ? 'repartir' : 'en curso'}
                tinta={abiertos.length > CARGA_ALTA ? TIERRA : color.texto} />
              <Dato rotulo="Citas" valor={String(semana)} apoyo="esta semana" />
              <Dato rotulo="1ª sesión" valor={med == null ? '—' : `${med.toFixed(1)} d`}
                apoyo={med == null ? 'sin sesiones' : med <= LIMITE_DIAS ? 'en plazo' : 'fuera de plazo'}
                tinta={med == null ? color.textoMedio : med <= LIMITE_DIAS ? color.primarioProfundo : TIERRA} />
              <View style={[e.fila, { gap: 6, justifyContent: 'flex-end', minWidth: 172, flexWrap: 'nowrap' }]}>
                {p.activo ? (
                  <>
                    <BotonChico onPress={() => restablecer(p)} icono={<IconoHistorial tamano={13} color={color.texto} />}>Restablecer</BotonChico>
                    <Pressable onPress={() => setBaja({ psicologo: p, destino: null, paso: 1 })} style={[e.botonBaja, abiertos.length > 0 && { borderColor: '#F3DDD2' }]}><Text style={[texto.datoFuerte, { color: '#8C4A2B' }]}>Desactivar</Text></Pressable>
                  </>
                ) : <BotonChico onPress={() => reactivar(p)} icono={<IconoPersona tamano={13} color={color.texto} />}>Reactivar</BotonChico>}
              </View>
            </View>
          )
        })}
        {filas.length === 0 && <Caja><Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay psicólogos. Sin uno activo, las detecciones quedan sin derivar.</Text></Caja>}
      </ScrollView>

      {formulario && (
        <DialogoPersona modo="psicologo" empresa="Equipo clínico del estudio"
          onCerrar={() => setFormulario(false)} onCreada={cargar} />
      )}

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

/** «Lic. Ana Pérez» -> «Ana Pérez», para las frases. */
function sinTrato(n: string) { return n.replace(/^(Lic\.|Mg\.|Dr\.|Dra\.|Ps\.)\s*/i, '') }

function iniciales(n: string) { return n.replace(/^(Lic\.|Mg\.|Dr\.|Dra\.|Ps\.)\s*/i, '').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') }

function Tarjeta({ rotulo, icono, children }: { rotulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return <View style={e.tarjeta}><View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><View style={e.cuadroIcono}>{icono}</View></View>{children}</View>
}
function Dato({ rotulo, valor, apoyo, tinta = color.texto }: { rotulo: string; valor: string; apoyo: string; tinta?: string }) {
  return (
    <View style={{ flex: 0.7, minWidth: 78, gap: 1 }}>
      <Rotulo>{rotulo}</Rotulo>
      <Text style={[texto.cuerpoFuerte, { color: tinta }]}>{valor}</Text>
      <Text style={[texto.dato, { color: color.textoMedio, fontSize: 12 }]}>{apoyo}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 40 },
  error: { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10 },
  credencial: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: 12, flexWrap: 'wrap' },
  tarjeta: { flex: 1, minWidth: 190, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 6 },
  cuadroIcono: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  cifra: { ...texto.cifra, color: color.texto, fontFamily: MONO, fontSize: 28 },
  tarjetaPs: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, flexWrap: 'wrap' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
  botonBaja: { height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie, justifyContent: 'center' },
  velo: { ...veloModal, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', justifyContent: 'center' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: color.borde },
})

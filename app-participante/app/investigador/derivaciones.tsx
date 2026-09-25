/** Derivaciones — implementa ESP-009 RF-009-10.
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Derivaciones · Investigador Principal».
 *
 *  Tablero de tiempos del circuito: detección → derivación → cita confirmada
 *  → primera sesión → informe aprobado. Mide si el sistema responde a tiempo
 *  a lo que detecta; nunca muestra contenido clínico (RN-009-03). */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import {
  circuito as cargarCircuito, citasEstudio, mediana, type CircuitoApoyo, type CitaEstudio,
} from '../../modules/investigador/panel'
import { listarEmpresas, listarPsicologos, type Empresa, type Psicologo } from '../../modules/panel/datos'
import { DialogoReasignar, type PedidoReasignacion } from '../../modules/investigador/DialogoReasignar'
import { BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoEquipo, IconoEscudoCheck, IconoLupa, IconoPersona } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

/** Límites del protocolo por tramo, en días (ESP-009 §9.1: pendientes del asesor). */
const TRAMOS = [
  { clave: 'dias_a_derivacion', titulo: 'Detección → Derivación', limite: 1 },
  { clave: 'dias_a_cita', titulo: 'Derivación → Cita Confirmada', limite: 2 },
  { clave: 'dias_cita_a_sesion', titulo: 'Cita → Primera Sesión', limite: 7 },
  { clave: 'dias_a_informe', titulo: 'Sesión → Informe Aprobado', limite: 5 },
] as const
type ClaveTramo = (typeof TRAMOS)[number]['clave']

const POR_PAGINA = 8

export default function Derivaciones() {
  const { filtro } = useFiltro()
  const [casos, setCasos] = useState<CircuitoApoyo[] | null>(null)
  const [citas, setCitas] = useState<CitaEstudio[]>([])
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [vista, setVista] = useState<'caso' | 'psicologo'>('caso')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [menu, setMenu] = useState<PedidoReasignacion | null>(null)

  const cargar = useDatosDelFiltro(() => setCasos(null), async (vigente) => {
    const [c, ci, ps, em] = await Promise.all([cargarCircuito(filtro), citasEstudio(filtro), listarPsicologos().catch(() => [] as Psicologo[]), listarEmpresas().catch(() => [] as Empresa[])])
    if (!vigente()) return
    setCasos(c); setCitas(ci); setPsicologos(ps); setEmpresas(em)
  }, [filtro.organizacion_id])


  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nombre ?? '—'
  const sinPsicologo = useMemo(() => (casos ?? []).filter((c) => !c.psicologo_id && !c.cerrada_en), [casos])
  const filtrados = useMemo(() => (casos ?? []).filter((c) => !busqueda || c.codigo_anonimo.toLowerCase().includes(busqueda.toLowerCase())), [casos, busqueda])
  const paginados = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  if (!casos) return <Panel rol="investigador"><Cargando /></Panel>

  const abiertas = casos.filter((c) => !c.cerrada_en)
  const conInforme = casos.filter((c) => c.informe_aprobado_en).length
  const estadisticas = TRAMOS.map((t) => {
    const valores = casos.map((c) => c[t.clave]).filter((v): v is number => v != null).map(Number)
    return { ...t, mediana: mediana(valores), n: valores.length, fuera: valores.filter((v) => v > t.limite).length }
  })
  const citasPorEstado = { realizada: 0, confirmada: 0, cancelada: 0, solicitada: 0 } as Record<CitaEstudio['estado'], number>
  for (const c of citas) citasPorEstado[c.estado] = (citasPorEstado[c.estado] ?? 0) + 1
  const canceladas = citasPorEstado.cancelada, totalCitas = citas.length
  const porEmpresa = Object.entries(casos.reduce<Record<string, number>>((m, c) => ({ ...m, [c.organizacion_id]: (m[c.organizacion_id] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        {sinPsicologo.length > 0 && (
          <View style={e.alerta}>
            <View style={e.alertaIcono}><IconoLupa tamano={16} color="#8C4A2B" /></View>
            <View style={{ flex: 1, gap: 2, minWidth: 240 }}>
              <View style={[e.fila, { gap: 8 }]}><Text style={[texto.datoFuerte, { color: '#8C4A2B', letterSpacing: 0.6 }]}>CUELLO DE BOTELLA OPERATIVO DETECTADO</Text><View style={e.pastillaOscura}><Text style={[texto.datoFuerte, { color: '#FFFFFF', fontSize: 10 }]}>{sinPsicologo.length} {sinPsicologo.length === 1 ? 'caso' : 'casos'} en cola activa</Text></View></View>
              <Text style={[texto.dato, { color: color.texto }]}>
                {sinPsicologo.length === 1 ? 'Derivación' : 'Derivaciones'} <Mono tono="#8C4A2B">{sinPsicologo.map((c) => c.codigo_anonimo).join(', ')}</Mono> sin psicólogo asignado: no había ningún profesional activo al detectar. Requiere asignación manual.
              </Text>
            </View>
            <Pressable onPress={() => setMenu({ derivaciones: sinPsicologo.map((c) => c.derivacion_id), titulo: sinPsicologo.map((c) => c.codigo_anonimo).join(', ') })} style={e.botonTierra}>
              <IconoPersona tamano={13} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Asignar profesional ahora</Text>
            </Pressable>
          </View>
        )}

        <Encabezado eyebrow="Circuito de salvaguarda ética · SLA y monitoreo temporal   /   Protocolo ESP-009" titulo="Gestión de Derivaciones y Tiempos del Circuito"
          subtitulo="Auditoría de latencias operativas desde la detección de alerta hasta el cierre del informe clínico. Se resguarda anonimato institucional sin exponer contenido psicoterapéutico."
          derecha={(
            <View style={[e.fila, { gap: 8 }]}>
              <Cuadro rotulo="Casos totales" valor={casos.length} />
              <Cuadro rotulo="En circuito" valor={abiertas.length} />
              <Cuadro rotulo="Informes OK" valor={conInforme} />
            </View>
          )} />

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          {estadisticas.map((t, i) => (
            <View key={t.clave} style={[e.tramo, { borderTopColor: t.fuera ? '#8C4A2B' : color.primarioProfundo }]}>
              <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{`Tramo ${i + 1}`}</Rotulo><Mono>Límite SLA: {t.limite.toFixed(1)} d</Mono></View>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>{t.titulo}</Text>
              <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}>
                <Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 24 }]}>{t.mediana == null ? '—' : t.mediana.toFixed(1)}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>días{t.mediana != null ? ` (${(t.mediana * 24).toFixed(1)} hrs)` : ''}</Text>
              </View>
              <View style={[e.fila, { gap: 6 }]}>
                <Pastilla tono={TONO.gris} mono>{`n = ${t.n}`}</Pastilla>
                <Pastilla tono={t.fuera ? TONO.tierraSuave : TONO.verdeSuave}>{t.fuera ? `⚠ ${t.fuera} fuera de rango` : '✓ 0 fuera de rango'}</Pastilla>
              </View>
            </View>
          ))}
        </View>

        <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
          <View style={{ flex: 2, minWidth: 420, gap: espacio.base }}>
            <Caja estilo={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap', padding: 10 }}>
              <View style={e.segmentos}>
                <Pressable onPress={() => setVista('caso')} style={[e.segmento, vista === 'caso' && e.segmentoOn]}><IconoLupa tamano={13} color={vista === 'caso' ? color.primarioProfundo : color.textoMedio} /><Text style={[texto.datoFuerte, { color: vista === 'caso' ? color.primarioProfundo : color.textoMedio }]}>Vista por Caso</Text><Pastilla tono={vista === 'caso' ? TONO.verde : TONO.gris}>{String(casos.length)}</Pastilla></Pressable>
                <Pressable onPress={() => setVista('psicologo')} style={[e.segmento, vista === 'psicologo' && e.segmentoOn]}><IconoEquipo tamano={13} color={vista === 'psicologo' ? color.primarioProfundo : color.textoMedio} /><Text style={[texto.datoFuerte, { color: vista === 'psicologo' ? color.primarioProfundo : color.textoMedio }]}>Vista por Psicólogo</Text><Pastilla tono={vista === 'psicologo' ? TONO.verde : TONO.gris}>{String(psicologos.filter((p) => p.activo).length)}</Pastilla></Pressable>
              </View>
              <View style={[e.buscador, { flex: 1, minWidth: 160 }]}>
                <IconoLupa tamano={13} color={color.textoSuave} />
                <TextInput value={busqueda} onChangeText={(t) => { setBusqueda(t); setPagina(0) }} placeholder="Filtrar código P-XXX…" placeholderTextColor={color.textoSuave} style={[texto.dato, { flex: 1, color: color.texto, fontFamily: MONO, outlineStyle: 'none' } as any]} />
              </View>
            </Caja>

            {vista === 'caso' ? (
              <Caja estilo={{ gap: 4 }}>
                <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[texto.seccion, { color: color.texto }]}>Derivaciones Activas y Latencias por Tramo</Text>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>SLA de contención clínica inmediata. Tiempos señalizados en tierra indican demoras operativas.</Text>
                  </View>
                  <Pastilla tono={TONO.gris} mono>{`${paginados.length} de ${filtrados.length} registros`}</Pastilla>
                </View>
                <View style={e.tablaCab}>
                  {[['Código', 1], ['Empresa', 1.2], ['Psicólogo asignado', 1.4], ['Origen', 1], ['Det. → Der.', 0.8], ['Der. → Cita', 0.8], ['Cita → Ses.', 0.8], ['Ses. → Inf.', 0.8], ['Estado', 1]].map(([h, f]) => (
                    <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
                  ))}
                </View>
                {paginados.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 12 }]}>{busqueda ? 'Ningún caso coincide con la búsqueda.' : 'Sin derivaciones en este corte.'}</Text>}
                {paginados.map((c) => (
                  <Pressable key={c.derivacion_id} onPress={() => router.push(conFiltro(`/investigador/participante/${c.participante_id}`, filtro) as never)} style={e.tablaFila}>
                    <View style={{ flex: 1 }}><Codigo>{c.codigo_anonimo}</Codigo></View>
                    <Text style={[texto.dato, { color: color.texto, flex: 1.2 }]}>{nombreEmpresa(c.organizacion_id)}</Text>
                    <View style={{ flex: 1.4 }}>
                      {c.psicologo ? <Text style={[texto.dato, { color: color.texto }]}>{c.psicologo}</Text>
                        : <Pressable onPress={() => setMenu({ derivaciones: [c.derivacion_id], titulo: c.codigo_anonimo })}><Text style={[texto.datoFuerte, { color: '#8C4A2B' }]}>Sin asignar · Asignar</Text></Pressable>}
                    </View>
                    <View style={{ flex: 1 }}><Pastilla tono={c.origen === 'solicitud' ? TONO.verdeSuave : TONO.gris}>{c.origen === 'solicitud' ? 'VOLUNTARIA' : 'ALGORITMO'}</Pastilla></View>
                    <Chip dias={c.dias_a_derivacion} limite={1} pendienteDesde={c.origen === 'solicitud' ? undefined : c.detectado_en} hito={c.derivado_en} cerrada={!!c.cerrada_en} />
                    <Chip dias={c.dias_a_cita} limite={2} pendienteDesde={c.derivado_en} hito={c.cita_confirmada_en} cerrada={!!c.cerrada_en} />
                    <Chip dias={c.dias_cita_a_sesion} limite={7} pendienteDesde={c.cita_confirmada_en} hito={c.primera_sesion_en} cerrada={!!c.cerrada_en} />
                    <Chip dias={c.dias_a_informe} limite={5} pendienteDesde={c.primera_sesion_en} hito={c.informe_aprobado_en} cerrada={!!c.cerrada_en} />
                    <View style={[e.fila, { flex: 1, gap: 5 }]}><View style={[e.punto, { backgroundColor: c.cerrada_en ? '#BDB8B1' : color.primarioProfundo }]} /><Text style={[texto.dato, { color: color.texto }]}>{c.cerrada_en ? 'Cerrada' : 'Abierta'}</Text></View>
                  </Pressable>
                ))}
                <View style={[e.fila, { justifyContent: 'space-between', paddingTop: 8 }]}>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>Mostrando {filtrados.length ? pagina * POR_PAGINA + 1 : 0} a {Math.min(filtrados.length, (pagina + 1) * POR_PAGINA)} de {filtrados.length} casos</Text>
                  <View style={[e.fila, { gap: 4 }]}>
                    <BotonChico onPress={() => setPagina((p) => Math.max(0, p - 1))} tono="suave">Anterior</BotonChico>
                    {Array.from({ length: Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)) }).slice(0, 5).map((_, i) => (
                      <Pressable key={i} onPress={() => setPagina(i)} style={[e.pagina, pagina === i && { backgroundColor: color.primarioProfundo }]}><Text style={[texto.datoFuerte, { color: pagina === i ? '#FFFFFF' : color.texto }]}>{i + 1}</Text></Pressable>
                    ))}
                    <BotonChico onPress={() => setPagina((p) => Math.min(Math.ceil(filtrados.length / POR_PAGINA) - 1, p + 1))} tono="suave">Siguiente</BotonChico>
                  </View>
                </View>
              </Caja>
            ) : (
              <View style={{ gap: espacio.base }}>
                {psicologos.filter((p) => p.activo).map((p) => {
                  const suyos = casos.filter((c) => c.psicologo_id === p.id)
                  const abiertos = suyos.filter((c) => !c.cerrada_en).sort((a, b) => (a.derivado_en < b.derivado_en ? -1 : 1))
                  const sus = citas.filter((c) => c.psicologo_id === p.id)
                  const cuenta = (est: CitaEstudio['estado']) => sus.filter((c) => c.estado === est).length
                  const med = mediana(suyos.map((c) => c.dias_a_sesion))
                  return (
                    <Caja key={p.id} estilo={{ gap: espacio.sm }}>
                      <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                        <View style={[e.fila, { gap: 10 }]}>
                          <View style={e.avatar}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{iniciales(p.nombre)}</Text></View>
                          <View><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{p.nombre}</Text><Mono>{/^cpsp/i.test(p.colegiatura) ? p.colegiatura : `CPsP ${p.colegiatura}`}</Mono></View>
                        </View>
                        {abiertos.length > 0 && <BotonChico onPress={() => setMenu({ derivaciones: abiertos.map((c) => c.derivacion_id), titulo: `${abiertos.length} casos`, actualId: p.id, actualNombre: p.nombre })} icono={<IconoEquipo tamano={13} color={color.texto} />}>Reasignar todos sus casos</BotonChico>}
                      </View>
                      <View style={[e.fila, { gap: espacio.base }]}>
                        <Dato rotulo="Casos abiertos" valor={String(abiertos.length)} nota={abiertos.length > 4 ? 'capacidad elevada (> 4)' : 'carga óptima (≤ 4)'} tinta={abiertos.length > 4 ? '#8C4A2B' : color.primarioProfundo} />
                        <Dato rotulo="Mediana a 1ª sesión" valor={med == null ? '—' : `${med.toFixed(1)} d`} nota={`n = ${suyos.filter((c) => c.dias_a_sesion != null).length}`} tinta={med != null && med > 7 ? '#8C4A2B' : color.texto} />
                        <Dato rotulo="Citas en el corte" valor={String(sus.length)} nota={`${cuenta('realizada')} realizadas · ${cuenta('cancelada')} canceladas`} />
                      </View>
                      {sus.length > 0 && (
                        <View style={e.barraSeg}>
                          {([['realizada', color.primarioProfundo], ['confirmada', '#A8DFCF'], ['solicitada', '#E4E1DC'], ['cancelada', '#8C4A2B']] as const).map(([k, c]) => cuenta(k) > 0 && <View key={k} style={{ flex: cuenta(k), backgroundColor: c }} />)}
                        </View>
                      )}
                      {abiertos.length > 0 && (
                        <View style={{ gap: 4 }}>
                          <Rotulo>Casos abiertos más antiguos</Rotulo>
                          {abiertos.slice(0, 4).map((c) => (
                            <Pressable key={c.derivacion_id} onPress={() => router.push(conFiltro(`/investigador/participante/${c.participante_id}`, filtro) as never)} style={[e.fila, { justifyContent: 'space-between', paddingVertical: 4 }]}>
                              <View style={[e.fila, { gap: 8 }]}><Codigo>{c.codigo_anonimo}</Codigo><Text style={[texto.dato, { color: color.textoMedio }]}>{nombreEmpresa(c.organizacion_id)}</Text></View>
                              <Mono tono={diasDesde(c.derivado_en) > 7 ? '#8C4A2B' : color.textoMedio}>{diasDesde(c.derivado_en)} d en curso · {ESTADO[c.estado] ?? c.estado}</Mono>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </Caja>
                  )
                })}
                {psicologos.filter((p) => p.activo).length === 0 && <Caja><Text style={[texto.apoyo, { color: '#8C4A2B' }]}>No hay psicólogos activos: las detecciones nuevas quedarán sin asignar.</Text></Caja>}
              </View>
            )}
          </View>

          {/* Panel derecho: citas y por empresa */}
          <View style={{ flex: 1, minWidth: 260, gap: espacio.base }}>
            <Caja estilo={{ gap: espacio.sm }}>
              <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Control de Citas Agendadas</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Tasa de ausentismo y efectividad en cohortes</Text></View>
                <Pastilla tono={TONO.gris} mono>Todo el seguimiento</Pastilla>
              </View>
              <View style={[e.panelGris, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <View>
                  <Rotulo>Tasa de cancelación total</Rotulo>
                  <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 26 }]}>{totalCitas ? `${((canceladas / totalCitas) * 100).toFixed(1)}%` : '—'}</Text><Mono>({canceladas} / {totalCitas} citas)</Mono></View>
                </View>
                <View style={e.anillo}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{totalCitas}</Text></View>
              </View>
              <Rotulo>Desglose operativo de citas</Rotulo>
              {([['realizada', 'Sesiones Realizadas', color.primarioProfundo], ['confirmada', 'Confirmadas / En Agenda', '#A8DFCF'], ['solicitada', 'Solicitadas sin confirmar', '#E4E1DC'], ['cancelada', 'Canceladas', '#8C4A2B']] as const).map(([k, t, c]) => (
                <View key={k} style={[e.filaCita]}>
                  <View style={[e.punto, { backgroundColor: c }]} />
                  <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>{t}</Text>
                  <Mono>{totalCitas ? `${((citasPorEstado[k] / totalCitas) * 100).toFixed(1)}%` : '—'}</Mono>
                  <View style={e.cuadroChico}><Text style={[texto.datoFuerte, { color: color.texto }]}>{citasPorEstado[k]}</Text></View>
                </View>
              ))}
              <View style={e.panelGris}>
                <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={13} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Regla de Resguardo por Inasistencia</Text></View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Tras una cancelación, el participante puede pedir otra cita cuando quiera desde la app; el sistema no insiste ni avisa al empleador.</Text>
              </View>
            </Caja>
            <Caja estilo={{ gap: 8 }}>
              <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>Derivaciones por empresa</Rotulo><Mono>{porEmpresa.length} {porEmpresa.length === 1 ? 'centro' : 'centros'}</Mono></View>
              {porEmpresa.map(([id, n]) => (
                <View key={id} style={{ gap: 3 }}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}><Text style={[texto.dato, { color: color.texto }]}>{nombreEmpresa(id)}</Text><Mono>{n} casos ({casos.length ? Math.round((n / casos.length) * 100) : 0}%)</Mono></View>
                  <View style={e.pista}><View style={[e.lleno, { width: `${casos.length ? (n / casos.length) * 100 : 0}%` }]} /></View>
                </View>
              ))}
              {porEmpresa.length === 0 && <Text style={[texto.dato, { color: color.textoMedio }]}>Sin derivaciones.</Text>}
            </Caja>
          </View>
        </View>

      </ScrollView>
      <DialogoReasignar pedido={menu} onCerrar={() => setMenu(null)} onHecho={(nuevo) => { const n = menu?.derivaciones.length ?? 0; setMenu(null); cargar(); const m = `${n === 1 ? 'El caso pasó' : `${n} casos pasaron`} a ${nuevo.nombre}.`; Platform.OS === 'web' ? window.alert(m) : Alert.alert('Reasignación hecha', m) }} />
    </Panel>
  )
}

const ESTADO: Record<string, string> = { sin_sesion: 'sin sesión', sala_abierta: 'sala abierta', sesion_realizada: 'sesión realizada', informe_pendiente: 'informe pendiente', cerrada: 'cerrada' }

function diasDesde(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) }
function iniciales(n: string) { return n.replace(/^(Lic\.|Mg\.|Dr\.|Dra\.|Ps\.)\s*/i, '').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') }

/** Chip de un tramo: días transcurridos; en tierra si supera el límite; «Pend.» si el hito no llegó. */
function Chip({ dias, limite, pendienteDesde, hito, cerrada }: { dias: number | null; limite: number; pendienteDesde?: string | null; hito: string | null; cerrada: boolean }) {
  if (dias != null) {
    const fuera = Number(dias) > limite
    return <View style={{ flex: 0.8 }}><View style={[e.chip, fuera && e.chipFuera]}><Text style={[texto.datoFuerte, { color: fuera ? '#FFFFFF' : color.texto, fontFamily: MONO, fontSize: 11 }]}>{Number(dias).toFixed(1)} d</Text></View></View>
  }
  if (!hito && pendienteDesde && !cerrada) {
    const d = diasDesde(pendienteDesde)
    return <View style={{ flex: 0.8 }}><View style={[e.chip, e.chipPend]}><Text style={[texto.datoFuerte, { color: '#8C4A2B', fontFamily: MONO, fontSize: 11 }]}>Pend. {d} d</Text></View></View>
  }
  return <View style={{ flex: 0.8 }}><View style={[e.chip, { backgroundColor: 'transparent' }]}><Text style={[texto.dato, { color: color.textoSuave }]}>–</Text></View></View>
}

function Cuadro({ rotulo, valor }: { rotulo: string; valor: number }) {
  return <View style={e.cuadro}><Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9, textAlign: 'center' }]}>{rotulo.toUpperCase()}</Text><Text style={[texto.cifra, { color: color.texto, fontFamily: MONO, fontSize: 18, textAlign: 'center' }]}>{valor}</Text></View>
}
function Dato({ rotulo, valor, nota, tinta = color.texto }: { rotulo: string; valor: string; nota?: string; tinta?: string }) {
  return <View style={{ minWidth: 120 }}><Rotulo>{rotulo}</Rotulo><Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 20 }]}>{valor}</Text>{nota && <Text style={[texto.dato, { color: color.textoMedio }]}>{nota}</Text>}</View>
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: '#FBEDE6', borderRadius: radio.md, padding: espacio.md, flexWrap: 'wrap', borderWidth: 1, borderColor: '#F3DDD2' },
  alertaIcono: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3DDD2', alignItems: 'center', justifyContent: 'center' },
  pastillaOscura: { backgroundColor: '#8C4A2B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  botonTierra: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8C4A2B', borderRadius: 8, paddingHorizontal: 14, height: 38 },
  cuadro: { backgroundColor: '#F1EFEB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 74, gap: 2 },
  tramo: { flex: 1, minWidth: 200, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', borderTopWidth: 3, padding: espacio.md, gap: 6 },
  segmentos: { flexDirection: 'row', backgroundColor: '#F1EFEB', borderRadius: 8, padding: 3 },
  segmento: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  segmentoOn: { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F5F4F1' },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8' },
  chip: { alignSelf: 'flex-start', backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, minWidth: 44, alignItems: 'center' },
  chipFuera: { backgroundColor: '#8C4A2B' },
  chipPend: { backgroundColor: '#FBEDE6' },
  punto: { width: 7, height: 7, borderRadius: 4 },
  pagina: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFEB' },
  avatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  barraSeg: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#EDEBE7' },
  panelGris: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12, gap: 6 },
  anillo: { width: 44, height: 44, borderRadius: 22, borderWidth: 5, borderColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  filaCita: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 8 },
  cuadroChico: { minWidth: 28, height: 24, borderRadius: 6, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pista: { height: 6, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden' },
  lleno: { height: 6, borderRadius: 3, backgroundColor: color.primarioProfundo },
})

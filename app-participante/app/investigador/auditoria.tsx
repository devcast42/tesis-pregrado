/** Auditoría — implementa ESP-009 RF-009-14 (RN-006-03).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Auditoría · Investigador Principal».
 *
 *  La pantalla responde una sola pregunta: ¿alguien abrió la identidad de un
 *  participante sin tener una derivación abierta que lo justifique? Por eso
 *  arriba va el veredicto —verde o ámbar, con el número y el botón para ver
 *  justo esos casos— y debajo el registro completo.
 *
 *  Ojo con el estado vacío: aquí lo deseable es que no haya nada. El estudio
 *  funciona con códigos anónimos, así que cero accesos es un buen resultado y
 *  se dice así, no como una tabla en blanco.
 *
 *  Las otras dos bitácoras del estudio —exportaciones y versiones del modelo—
 *  van plegadas al final: se consultan, no se vigilan. */

import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useDatosDelFiltro, useFiltro } from '../../modules/investigador/filtro'
import { circuito as cargarCircuito, exportaciones as cargarExportaciones, fechaHoraPET, versiones as cargarVersiones, type CircuitoApoyo, type ExportacionRegistrada, type VersionModelo } from '../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../modules/investigador/exportar'
import { listarPsicologos, type Psicologo } from '../../modules/panel/datos'
import { supabase } from '../../modules/nucleo/supabase'
import { BotonChico, Caja, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoArchivo, IconoEscudoCheck, IconoLupa, IconoNota } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const TIERRA = '#8C4A2B'

type Acceso = {
  id: number; ocurrido_en: string; participante_id: string; codigo_anonimo: string; organizacion_id: string
  por: 'psicologo' | 'investigador'; psicologo_id: string | null; operador: string; motivo: string | null
  con_derivacion: boolean; derivacion_codigo: string | null
}

async function cargarAccesos(psicologos: Psicologo[], circuito: CircuitoApoyo[]): Promise<Acceso[]> {
  const { data } = await supabase.from('eventos').select('id, ocurrido_en, participante_id, metadata, participantes(codigo_anonimo, organizacion_id)')
    .eq('tipo', 'acceso_identidad').order('ocurrido_en', { ascending: false }).limit(500)
  const nombres = new Map(psicologos.map((p) => [p.id, p.nombre]))
  return ((data ?? []) as any[]).map((ev) => {
    const m = ev.metadata ?? {}
    const por: Acceso['por'] = m.por === 'investigador' ? 'investigador' : 'psicologo'
    // Había derivación abierta en ese momento si alguna del participante la cubre en el tiempo.
    const deriv = circuito.find((c) => c.participante_id === ev.participante_id && c.derivado_en <= ev.ocurrido_en && (!c.cerrada_en || c.cerrada_en >= ev.ocurrido_en))
    return {
      id: ev.id, ocurrido_en: ev.ocurrido_en, participante_id: ev.participante_id,
      codigo_anonimo: ev.participantes?.codigo_anonimo ?? '—', organizacion_id: ev.participantes?.organizacion_id ?? '',
      por, psicologo_id: m.psicologo_id ?? null,
      operador: por === 'investigador' ? 'Investigador principal' : nombres.get(m.psicologo_id) ?? 'Psicólogo',
      motivo: m.motivo ?? null,
      con_derivacion: por === 'investigador' ? true : !!deriv,
      derivacion_codigo: deriv ? `Deriv-${deriv.derivacion_id.slice(0, 4)}` : null,
    }
  })
}

export default function Auditoria() {
  const { filtro } = useFiltro()
  const [accesos, setAccesos] = useState<Acceso[] | null>(null)
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [exportacionesReg, setExportaciones] = useState<ExportacionRegistrada[]>([])
  const [versiones, setVersiones] = useState<VersionModelo[]>([])
  const [operador, setOperador] = useState<string>('todos')
  const [codigo, setCodigo] = useState('')
  const [soloRevision, setSoloRevision] = useState(false)
  const [abierta, setAbierta] = useState<'exportaciones' | 'versiones' | null>(null)

  useDatosDelFiltro(() => setAccesos(null), async (vigente) => {
    const [ps, circ, ex, vs] = await Promise.all([listarPsicologos().catch(() => [] as Psicologo[]), cargarCircuito(), cargarExportaciones(), cargarVersiones()])
    if (!vigente()) return
    setPsicologos(ps); setExportaciones(ex); setVersiones(vs)
    const acc = await cargarAccesos(ps, circ)
    if (vigente()) setAccesos(acc)
  }, [filtro.organizacion_id])

  // Del alcance del filtro, sin los filtros de esta pantalla: es sobre esto
  // que se pronuncia el veredicto de arriba.
  const delAlcance = useMemo(() => (accesos ?? []).filter((a) =>
    !filtro.organizacion_id || a.organizacion_id === filtro.organizacion_id), [accesos, filtro.organizacion_id])

  const filtrados = useMemo(() => delAlcance.filter((a) =>
    (operador === 'todos' || (operador === 'investigador' ? a.por === 'investigador' : a.psicologo_id === operador))
    && (!codigo || a.codigo_anonimo.toLowerCase().includes(codigo.toLowerCase()))
    && (!soloRevision || !a.con_derivacion)), [delAlcance, operador, codigo, soloRevision])

  if (!accesos) return <Panel rol="investigador"><Cargando /></Panel>

  const porRevisar = delAlcance.filter((a) => !a.con_derivacion).length
  const personas = new Set(filtrados.map((a) => a.participante_id)).size
  const acotado = operador !== 'todos' || !!codigo || soloRevision
  const exportarCsv = () => descargarTexto(`auditoria-accesos-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(filtrados.map((a) => ({ id: a.id, fecha_hora: a.ocurrido_en, operador: a.operador, rol: a.por, participante: a.codigo_anonimo, motivo: a.motivo ?? '', derivacion_abierta: a.con_derivacion ? 'si' : 'no' }))), 'text/csv')

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        {/* Encabezado propio: el título corto y la acción real al lado. */}
        <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View style={{ gap: 4, flex: 1, minWidth: 280 }}>
            <Rotulo>Comité de ética · ESP-009</Rotulo>
            <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>Auditoría de accesos</Text>
          </View>
          {delAlcance.length > 0 && (
            <Pressable onPress={exportarCsv} style={e.botonLleno}>
              <IconoArchivo tamano={14} color="#FFFFFF" />
              <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Exportar CSV</Text>
            </Pressable>
          )}
        </View>

        {/* El veredicto. Es la pantalla entera resumida en una línea. */}
        {porRevisar > 0 ? (
          <View style={[e.veredicto, { backgroundColor: '#FBEDE6', borderColor: '#EBC9B6' }]}>
            <Text style={[e.cifraGrande, { color: TIERRA }]}>{porRevisar}</Text>
            <View style={{ flex: 1, gap: 2, minWidth: 220 }}>
              <Text style={[texto.cuerpoFuerte, { color: TIERRA }]}>
                {porRevisar === 1 ? 'Una apertura necesita revisión' : 'Aperturas que necesitan revisión'}
              </Text>
              <Text style={[texto.dato, { color: TIERRA }]}>
                Un psicólogo abrió la identidad sin tener una derivación abierta en ese momento.
              </Text>
            </View>
            <Pressable onPress={() => setSoloRevision((v) => !v)} style={[e.botonTierra, soloRevision && { backgroundColor: TIERRA }]}>
              <Text style={[texto.datoFuerte, { color: soloRevision ? '#FFFFFF' : TIERRA }]}>
                {soloRevision ? 'Ver todas' : 'Ver solo esas'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[e.veredicto, { backgroundColor: '#EAF4EF', borderColor: '#CFE6DA' }]}>
            <View style={e.escudo}><IconoEscudoCheck tamano={20} color={color.primarioProfundo} /></View>
            <View style={{ flex: 1, gap: 2, minWidth: 220 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                {delAlcance.length === 0 ? 'Nadie ha abierto una identidad' : 'Ninguna apertura necesita revisión'}
              </Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>
                {delAlcance.length === 0
                  ? 'Es el estado deseable: el estudio opera solo con códigos anónimos.'
                  : `Las ${delAlcance.length} aperturas ocurrieron con una derivación abierta.`}
              </Text>
            </View>
          </View>
        )}

        {/* El registro, con sus filtros dentro. */}
        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, minWidth: 260 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Registro de aperturas</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>
                Cada apertura de nombre y correo queda escrita por <Mono tono={color.textoMedio} tamano={12}>obtener_identidad</Mono>. No se puede editar ni borrar desde la aplicación.
              </Text>
            </View>
            {delAlcance.length > 0 && (
              <Mono>{`${filtrados.length} ${filtrados.length === 1 ? 'apertura' : 'aperturas'} · ${personas} ${personas === 1 ? 'persona' : 'personas'}`}</Mono>
            )}
          </View>

          {delAlcance.length > 0 && (
            <View style={[e.fila, { gap: espacio.sm, alignItems: 'center' }]}>
              <View style={[e.fila, { gap: 4, flex: 1, minWidth: 200 }]}>
                {[['todos', 'Todos'], ['investigador', 'Investigador'], ...psicologos.map((p) => [p.id, p.nombre])].map(([k, t]) => (
                  <Pressable key={k} onPress={() => setOperador(k)} style={[e.chip, operador === k && e.chipOn]}>
                    <Text style={[texto.dato, { color: operador === k ? '#FFFFFF' : color.texto }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={e.buscador}>
                <IconoLupa tamano={13} color={color.textoSuave} />
                <TextInput value={codigo} onChangeText={setCodigo} placeholder="Buscar código…" placeholderTextColor={color.textoSuave}
                  style={[texto.dato, { flex: 1, color: color.texto, fontFamily: MONO, outlineStyle: 'none' } as any]} />
              </View>
            </View>
          )}

          {filtrados.length > 0 && (
            <View>
              <View style={e.tablaCab}>
                {[['Cuándo', 1], ['Quién', 1.2], ['A quién', 0.7], ['Por qué', 2.2]].map(([h, f]) => (
                  <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
                ))}
              </View>
              {filtrados.map((a) => (
                <View key={a.id} style={[e.tablaFila, !a.con_derivacion && { backgroundColor: '#FBEDE6' }]}>
                  <Mono tono={color.texto} tamano={11.5}>{fechaHoraPET(a.ocurrido_en).replace(' PET', '')}</Mono>
                  <View style={{ flex: 1.2 }}>
                    <Text style={[texto.datoFuerte, { color: color.texto }]}>{a.operador}</Text>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>{a.por === 'investigador' ? 'Investigador' : 'Psicólogo'}</Text>
                  </View>
                  <Pressable style={{ flex: 0.7 }} onPress={() => router.push(conFiltro(`/investigador/participante/${a.participante_id}`, filtro) as never)}>
                    <Pastilla tono={a.con_derivacion ? TONO.grisOscuro : TONO.tierra} mono>{a.codigo_anonimo}</Pastilla>
                  </Pressable>
                  <View style={{ flex: 2.2, gap: 3 }}>
                    <Text style={[texto.dato, { color: color.texto }]}>
                      {a.motivo ?? (a.por === 'investigador' ? 'Consulta desde la ficha del participante.' : 'Coordinación clínica del caso derivado.')}
                    </Text>
                    {a.por === 'investigador'
                      ? <Mono>Rol con acceso propio · no requiere derivación</Mono>
                      : a.con_derivacion
                        ? <Mono tono={color.primarioProfundo}>{`Derivación abierta · ${a.derivacion_codigo}`}</Mono>
                        : <Text style={[texto.datoFuerte, { color: TIERRA }]}>Sin derivación abierta</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {filtrados.length === 0 && delAlcance.length > 0 && (
            <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 8 }]}>
              {acotado ? 'Ninguna apertura coincide con estos filtros.' : 'Sin aperturas en este alcance.'}
            </Text>
          )}
        </Caja>

        {/* Bitácoras de consulta, plegadas. */}
        <Bitacora
          icono={<IconoArchivo tamano={16} color={color.textoMedio} />}
          titulo="Exportaciones del dataset"
          apoyo="Qué corte se descargó, cuándo y con qué hash."
          insignia={`${exportacionesReg.length}`}
          abierta={abierta === 'exportaciones'}
          onPress={() => setAbierta(abierta === 'exportaciones' ? null : 'exportaciones')} />
        {abierta === 'exportaciones' && (
          <Caja estilo={{ gap: 4, marginTop: -8 }}>
            {exportacionesReg.length === 0 && <Text style={[texto.dato, { color: color.textoMedio }]}>Todavía no se ha exportado ningún paquete.</Text>}
            {exportacionesReg.map((x) => (
              <View key={x.id} style={e.tablaFila}>
                <Mono tono={color.primarioProfundo} tamano={12}>{`Exp-${String(x.id).padStart(3, '0')}`}</Mono>
                <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>{fechaHoraPET(x.ocurrido_en)}</Text>
                <Mono>{Object.values(x.conteos ?? {}).reduce((s: number, v) => s + Number(v), 0).toLocaleString('es-PE')} filas · {(x.formato ?? 'csv').toUpperCase()}</Mono>
                <Mono tono={color.textoMedio}>{x.hash.slice(0, 10)}…</Mono>
              </View>
            ))}
            <BotonChico onPress={() => router.push(conFiltro('/investigador/exportacion', filtro) as never)} tono="suave">Ver en Exportación</BotonChico>
          </Caja>
        )}

        <Bitacora
          icono={<IconoNota tamano={16} color={color.textoMedio} />}
          titulo="Versiones del modelo"
          apoyo="Qué versión estaba activa cuando se registró cada predicción."
          insignia={versiones.filter((v) => v.activa).length ? `${versiones.filter((v) => v.activa).length} activas` : 'ninguna activa'}
          abierta={abierta === 'versiones'}
          onPress={() => setAbierta(abierta === 'versiones' ? null : 'versiones')} />
        {abierta === 'versiones' && (
          <Caja estilo={{ gap: 4, marginTop: -8 }}>
            {versiones.map((v) => (
              <View key={v.version} style={e.tablaFila}>
                <Mono tono={color.texto} tamano={12}>{v.version}</Mono>
                <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>{v.tarea} · {v.origen}</Text>
                <Mono>τ {Number(v.umbral_decision).toFixed(2)}</Mono>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{v.entrenada_en ? new Date(v.entrenada_en).toLocaleDateString('es-PE') : '—'}</Text>
                {v.activa ? <Pastilla tono={TONO.verde}>Activa</Pastilla> : <Pastilla tono={TONO.gris}>Registrada</Pastilla>}
              </View>
            ))}
            <BotonChico onPress={() => router.push(conFiltro('/investigador/versiones', filtro) as never)} tono="suave">Ver en Versiones</BotonChico>
          </Caja>
        )}
      </ScrollView>
    </Panel>
  )
}

function Bitacora({ icono, titulo, apoyo, insignia, abierta, onPress }: {
  icono: React.ReactNode; titulo: string; apoyo: string; insignia: string; abierta: boolean; onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={e.bitacora}>
      <View style={e.bitacoraIcono}>{icono}</View>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
        <Text style={[texto.dato, { color: color.textoMedio }]}>{apoyo}</Text>
      </View>
      <Pastilla tono={TONO.gris} mono>{insignia}</Pastilla>
      <Text style={{ color: color.textoMedio }}>{abierta ? '⌃' : '⌄'}</Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 38 },

  veredicto: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, flexWrap: 'wrap', borderWidth: 1, borderRadius: radio.md, padding: espacio.base },
  cifraGrande: { ...texto.cifra, fontFamily: MONO, fontSize: 40, lineHeight: 44 },
  escudo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DDF3EA', alignItems: 'center', justifyContent: 'center' },
  botonTierra: { borderRadius: 8, paddingHorizontal: 14, height: 38, justifyContent: 'center', borderWidth: 1, borderColor: TIERRA },

  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F1EFEB' },
  chipOn: { backgroundColor: color.primarioProfundo },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, width: 190, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F5F4F1' },

  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E6E3DE' },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1EFEB', borderRadius: 6 },

  bitacora: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: 14 },
  bitacoraIcono: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
})

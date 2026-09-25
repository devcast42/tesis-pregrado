/** Auditoría — implementa ESP-009 RF-009-14 (RN-006-03).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Auditoría · Investigador Principal».
 *
 *  Cada acceso a la identidad de un participante deja rastro; aquí se mira.
 *  Fila en ámbar cuando el acceso ocurrió sin derivación abierta: eso es lo
 *  que el investigador tiene que revisar. Debajo, las otras dos bitácoras del
 *  estudio: exportaciones del dataset y cambios de versión del modelo. */

import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import { circuito as cargarCircuito, exportaciones as cargarExportaciones, fechaHoraPET, versiones as cargarVersiones, type CircuitoApoyo, type ExportacionRegistrada, type VersionModelo } from '../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../modules/investigador/exportar'
import { listarPsicologos, type Psicologo } from '../../modules/panel/datos'
import { supabase } from '../../modules/nucleo/supabase'
import { BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoArchivo, IconoCandado, IconoEquipo, IconoEscudoCheck, IconoLupa, IconoNota } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

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

  const cargar = useCallback(async () => {
    const [ps, circ, ex, vs] = await Promise.all([listarPsicologos().catch(() => [] as Psicologo[]), cargarCircuito(), cargarExportaciones(), cargarVersiones()])
    setPsicologos(ps); setExportaciones(ex); setVersiones(vs)
    setAccesos(await cargarAccesos(ps, circ))
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const filtrados = useMemo(() => (accesos ?? []).filter((a) =>
    (!filtro.organizacion_id || a.organizacion_id === filtro.organizacion_id)
    && (operador === 'todos' || (operador === 'investigador' ? a.por === 'investigador' : a.psicologo_id === operador))
    && (!codigo || a.codigo_anonimo.toLowerCase().includes(codigo.toLowerCase()))
    && (!soloRevision || !a.con_derivacion)), [accesos, filtro.organizacion_id, operador, codigo, soloRevision])

  if (!accesos) return <Panel rol="investigador"><Cargando /></Panel>

  const sinDerivacion = filtrados.filter((a) => !a.con_derivacion)
  const unicos = new Set(filtrados.map((a) => a.participante_id)).size
  const porOperador = Object.entries(filtrados.reduce<Record<string, number>>((m, a) => ({ ...m, [a.operador]: (m[a.operador] ?? 0) + 1 }), {})).sort((x, y) => y[1] - x[1])[0]
  const exportarCsv = () => descargarTexto(`auditoria-accesos-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(filtrados.map((a) => ({ id: a.id, fecha_hora: a.ocurrido_en, operador: a.operador, rol: a.por, participante: a.codigo_anonimo, motivo: a.motivo ?? '', derivacion_abierta: a.con_derivacion ? 'si' : 'no' }))), 'text/csv')

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Trazabilidad forense y gobernanza   ·   Comité de ética   ·   ESP-009 / Anexo tesis" titulo="Auditoría de Accesos a Identidad y Cambios de Protocolo"
          subtitulo="Registro inmutable de cada apertura de datos personales (identidad del participante) bajo el esquema de códigos anónimos, y control de versiones del estudio longitudinal."
          derecha={(
            <View style={[e.fila, { gap: 8 }]}>
              <Pastilla tono={TONO.verdeSuave} punto>Registro de eventos activo</Pastilla>
              <Pressable onPress={exportarCsv} style={e.botonLleno}><IconoArchivo tamano={14} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Exportar Log Auditoría (CSV)</Text></Pressable>
            </View>
          )} />

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Tarjeta rotulo="Eventos en el periodo" icono={<IconoCandado tamano={14} color={color.textoMedio} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{filtrados.length}</Text><Mono>eventos (n={filtrados.length})</Mono></View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Aperturas de identidad registradas con fecha, operador y motivo.</Text>
          </Tarjeta>
          <Tarjeta rotulo="Revisión obligatoria" icono={<Text style={{ color: '#8C4A2B' }}>⚠</Text>} tierra={sinDerivacion.length > 0}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={[e.cifra, sinDerivacion.length > 0 && { color: '#8C4A2B' }]}>{sinDerivacion.length}</Text><Mono tono={sinDerivacion.length ? '#8C4A2B' : color.textoMedio}>{sinDerivacion.length === 1 ? 'evento sin derivación' : 'eventos sin derivación'}</Mono></View>
            {sinDerivacion.length > 0 ? <Pastilla tono={TONO.tierra} mono>{`${sinDerivacion[0].codigo_anonimo} · Alerta ética activa`}</Pastilla> : <Text style={[texto.dato, { color: color.textoMedio }]}>Todos los accesos ocurrieron con una derivación abierta.</Text>}
          </Tarjeta>
          <Tarjeta rotulo="Muestra consultada" icono={<IconoEquipo tamano={14} color={color.textoMedio} />}>
            <View style={[e.fila, { alignItems: 'baseline', gap: 6 }]}><Text style={e.cifra}>{unicos}</Text><Mono>participantes únicos</Mono></View>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Personas distintas cuya identidad fue abierta en el periodo.</Text>
          </Tarjeta>
          <Tarjeta rotulo="Operador con mayor acceso" icono={<IconoNota tamano={14} color={color.textoMedio} />}>
            <Text style={[texto.seccion, { color: color.texto }]}>{porOperador?.[0] ?? '—'}</Text>
            <View style={[e.fila, { gap: 6 }]}><Text style={[texto.dato, { color: color.textoMedio }]}>{porOperador ? `${porOperador[1]} accesos justificados` : 'Sin accesos'}</Text>{porOperador && <Pastilla tono={TONO.gris} mono>Cita clínica</Pastilla>}</View>
          </Tarjeta>
        </View>

        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { gap: espacio.sm, alignItems: 'flex-end' }]}>
            <View style={{ gap: 4, flex: 1, minWidth: 180 }}>
              <Rotulo>Operador registrado</Rotulo>
              <View style={[e.fila, { gap: 4 }]}>
                {[['todos', 'Todos'], ['investigador', 'Investigador'], ...psicologos.map((p) => [p.id, p.nombre])].map(([k, t]) => (
                  <Pressable key={k} onPress={() => setOperador(k)} style={[e.chip, operador === k && e.chipOn]}><Text style={[texto.dato, { color: operador === k ? '#FFFFFF' : color.texto }]}>{t}</Text></Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 4, minWidth: 200 }}>
              <Rotulo>Código participante</Rotulo>
              <View style={e.buscador}><IconoLupa tamano={13} color={color.textoSuave} /><TextInput value={codigo} onChangeText={setCodigo} placeholder="Ej. P-042, P-019…" placeholderTextColor={color.textoSuave} style={[texto.dato, { flex: 1, color: color.texto, fontFamily: MONO, outlineStyle: 'none' } as any]} /></View>
            </View>
          </View>
          <View style={[e.fila, { gap: 6 }]}>
            <Rotulo>Vistas rápidas:</Rotulo>
            <Pressable onPress={() => setSoloRevision(false)} style={[e.chip, !soloRevision && e.chipSuave]}><Text style={[texto.dato, { color: color.texto }]}>Todos ({filtrados.length + (soloRevision ? (accesos.length - filtrados.length) : 0)})</Text></Pressable>
            <Pressable onPress={() => setSoloRevision(true)} style={[e.chip, soloRevision && e.chipTierra]}><Text style={[texto.dato, { color: '#8C4A2B' }]}>⚑ Requieren revisión ({accesos.filter((a) => !a.con_derivacion).length})</Text></Pressable>
            <View style={{ flex: 1 }} />
            <Mono>Registro sincronizado · {accesos.length} eventos en total</Mono>
          </View>
        </Caja>

        <Caja estilo={{ gap: 4 }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <View style={[e.fila, { gap: 8 }]}><Text style={[texto.seccion, { color: color.texto }]}>Registro Inmutable de Accesos a Identidad</Text><Pastilla tono={TONO.gris} mono>eventos.acceso_identidad</Pastilla></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Cada fila es una apertura de nombre y correo registrada por `obtener_identidad`; no se puede editar ni borrar desde la aplicación.</Text>
            </View>
            <Mono>Mostrando {filtrados.length} registros</Mono>
          </View>
          <View style={e.tablaCab}>
            {[['Fecha y hora (PET)', 1.1], ['Operador y rol', 1.2], ['Cód. anónimo', 0.8], ['Motivo declarado', 2], ['Derivación asociada', 1.2], ['Evento', 0.8]].map(([h, f]) => (
              <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
            ))}
          </View>
          {filtrados.map((a) => (
            <View key={a.id} style={[e.tablaFila, !a.con_derivacion && { backgroundColor: '#FBEDE6' }]}>
              <View style={{ flex: 1.1 }}><Mono tono={color.texto} tamano={11.5}>{fechaHoraPET(a.ocurrido_en).replace(' PET', '')}</Mono><Mono tono={color.textoSuave} tamano={10}>{new Date(a.ocurrido_en).getFullYear()} · PET</Mono></View>
              <View style={{ flex: 1.2 }}><Text style={[texto.datoFuerte, { color: color.texto }]}>{a.operador}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{a.por === 'investigador' ? 'Investigador principal' : 'Psicólogo del estudio'}</Text></View>
              <Pressable style={{ flex: 0.8 }} onPress={() => router.push(conFiltro(`/investigador/participante/${a.participante_id}`, filtro) as never)}><Pastilla tono={!a.con_derivacion ? TONO.tierra : TONO.grisOscuro} mono>{a.codigo_anonimo}</Pastilla></Pressable>
              <View style={{ flex: 2, gap: 2 }}>
                <Text style={[texto.dato, { color: color.texto }]}>{a.motivo ?? (a.por === 'investigador' ? 'Consulta desde la ficha del participante (acción explícita).' : 'Coordinación clínica del caso derivado.')}</Text>
                {!a.con_derivacion && <Text style={[texto.dato, { color: '#8C4A2B' }]}>⚠ Acceso sin derivación abierta en ese momento</Text>}
              </View>
              <View style={{ flex: 1.2 }}>
                {a.por === 'investigador' ? <Pastilla tono={TONO.gris} mono>No requerida (auditoría)</Pastilla>
                  : a.con_derivacion ? <Pastilla tono={TONO.verdeSuave} punto mono>{`Sí (${a.derivacion_codigo})`}</Pastilla>
                  : <Pastilla tono={TONO.tierra} punto mono>NO (sin derivación activa)</Pastilla>}
              </View>
              <View style={{ flex: 0.8 }}><Mono tono={color.textoSuave}>#{a.id}</Mono><View style={[e.fila, { gap: 3 }]}><IconoCandado tamano={9} color={color.textoSuave} /><Mono tono={color.textoSuave} tamano={9.5}>Inmutable</Mono></View></View>
            </View>
          ))}
          {filtrados.length === 0 && (
            <View style={e.vacio}>
              <IconoEscudoCheck tamano={20} color={color.primarioProfundo} />
              <View style={{ flex: 1 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{accesos.length === 0 ? 'Cero accesos registrados' : 'Ningún acceso coincide con los filtros'}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{accesos.length === 0 ? 'Nadie ha consultado una identidad. Es el estado deseable: el estudio opera solo con códigos.' : 'Prueba con otro operador o código.'}</Text>
              </View>
            </View>
          )}
        </Caja>

        {/* Otras bitácoras */}
        <Pressable onPress={() => setAbierta(abierta === 'exportaciones' ? null : 'exportaciones')} style={e.bitacora}>
          <View style={e.bitacoraIcono}><IconoArchivo tamano={16} color={color.textoMedio} /></View>
          <View style={{ flex: 1 }}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Registro Inmutable de Exportaciones del Dataset</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Trazabilidad de descargas para análisis estadístico (R / Python) con seudonimización.</Text></View>
          <Pastilla tono={TONO.gris} mono>{`${exportacionesReg.length} exportaciones`}</Pastilla>
          <Text style={{ color: color.textoMedio }}>{abierta === 'exportaciones' ? '⌃' : '⌄'}</Text>
        </Pressable>
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
        <Pressable onPress={() => setAbierta(abierta === 'versiones' ? null : 'versiones')} style={e.bitacora}>
          <View style={e.bitacoraIcono}><IconoNota tamano={16} color={color.textoMedio} /></View>
          <View style={{ flex: 1 }}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Registro de Cambios de Versión del Modelo de Inferencia</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Control de versiones del clasificador de riesgo psicosocial y ponderaciones psicométricas.</Text></View>
          <Pastilla tono={TONO.gris} mono>{versiones.filter((v) => v.activa).map((v) => v.version).join(' · ') || 'sin versión activa'}</Pastilla>
          <Text style={{ color: color.textoMedio }}>{abierta === 'versiones' ? '⌃' : '⌄'}</Text>
        </Pressable>
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

function Tarjeta({ rotulo, icono, children, tierra }: { rotulo: string; icono: React.ReactNode; children: React.ReactNode; tierra?: boolean }) {
  return (
    <View style={[e.tarjeta, tierra && { borderLeftWidth: 3, borderLeftColor: '#8C4A2B' }]}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo tinta={tierra ? '#8C4A2B' : color.textoMedio}>{rotulo}</Rotulo>{icono}</View>
      {children}
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 40 },
  tarjeta: { flex: 1, minWidth: 200, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 6 },
  cifra: { ...texto.cifra, color: color.texto, fontFamily: MONO, fontSize: 28 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F1EFEB' },
  chipOn: { backgroundColor: color.primarioProfundo },
  chipSuave: { backgroundColor: '#E4E1DC' },
  chipTierra: { backgroundColor: '#F3DDD2' },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F5F4F1' },
  selector: { height: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F5F4F1', justifyContent: 'center' },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: 6 },
  vacio: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EAF4EF', borderRadius: 8, padding: 14, marginTop: 6 },
  bitacora: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: 14 },
  bitacoraIcono: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
})

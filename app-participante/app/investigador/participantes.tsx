/** Registro de participantes — implementa ESP-009 RF-009-07.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Participantes · Investigador Principal».
 *
 *  Tabla densa con filtros combinables por chips, búsqueda por código,
 *  selección múltiple, orden por urgencia y un panel lateral con la vista
 *  previa del participante seleccionado. Solo códigos (RN-009-02). */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import {
  ETIQUETA_ESTADO, calendario, fechaCorta, participantes as listar, type Envio, type FilaParticipanteV2,
} from '../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../modules/investigador/exportar'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { BarraPct, BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, PastillaEstado, PastillaNivel, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoAbrir, IconoArchivo, IconoCerrar, IconoCheck, IconoCredencial, IconoEscudoCheck, IconoLupa, IconoNota, IconoReloj,
} from '../../modules/nucleo/iconos'

type Estado = 'todos' | FilaParticipanteV2['estado']
type Nivel = 'todos' | 'bajo' | 'a_vigilar' | 'alto'
const POR_PAGINA = 10

export default function Participantes() {
  const { filtro, fijar } = useFiltro()
  const { width } = useWindowDimensions()
  const conPanel = width >= 1200
  const [filas, setFilas] = useState<FilaParticipanteV2[] | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [estado, setEstado] = useState<Estado>('todos')
  const [nivel, setNivel] = useState<Nivel>('todos')
  const [nowcast50, setNowcast50] = useState(false)
  const [inactivos4, setInactivos4] = useState(false)
  const [conDerivacion, setConDerivacion] = useState(false)
  const [conCita, setConCita] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [pagina, setPagina] = useState(0)
  const [abierto, setAbierto] = useState<FilaParticipanteV2 | null>(null)

  const cargar = useCallback(async () => {
    const [f, em] = await Promise.all([listar(filtro), listarEmpresas().catch(() => [])])
    setFilas(f); setEmpresas(em)
    setAbierto((a) => a ?? f[0] ?? null)
  }, [filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))
  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => (filas ?? []).filter((x) => {
    if (estado !== 'todos' && x.estado !== estado) return false
    if (nivel !== 'todos' && x.olbi_nivel !== nivel) return false
    if (nowcast50 && !(x.nowcast != null && x.nowcast >= 0.5)) return false
    if (inactivos4 && !(x.dias_sin_checkin != null && x.dias_sin_checkin >= 4)) return false
    if (conDerivacion && !x.derivacion_id) return false
    if (conCita && !x.estado_cita) return false
    const q = busqueda.trim().toLowerCase()
    return !q || x.codigo_anonimo.toLowerCase().includes(q)
  }), [filas, estado, nivel, nowcast50, inactivos4, conDerivacion, conCita, busqueda])
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas - 1)
  const enPagina = visibles.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const cuenta = (pred: (x: FilaParticipanteV2) => boolean) => filas.filter(pred).length
  const activos = cuenta((x) => x.estado === 'activo')
  const detectados = cuenta((x) => x.estado === 'detectado')
  const derivaciones = cuenta((x) => !!x.derivacion_id)
  const todasSel = enPagina.length > 0 && enPagina.every((x) => seleccion.has(x.id))

  function exportarSeleccion() {
    const sel = filas!.filter((x) => seleccion.has(x.id))
    descargarTexto(`participantes-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(sel as any), 'text/csv')
  }

  return (
    <Panel rol="investigador">
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <Pantalla ancho={ancho.panel}>
          <Encabezado
            eyebrow="Microdatos longitudinales"
            titulo="Registro de Participantes de la Cohorte"
            subtitulo={`N = ${activos} participantes activos en ${empresas.length} empresas tecnológicas. Nivel de microdatos sin revelar identidad.`}
            derecha={(
              <View style={e.fila}>
                <Caja estilo={{ paddingVertical: 10 }}><View style={[e.fila, { gap: 8 }]}><IconoReloj tamano={16} color="#8C4A2B" /><Text style={[texto.datoFuerte, { color: color.texto }]}>{detectados} detectados{'\n'}OLBI</Text></View></Caja>
                <Caja estilo={{ paddingVertical: 10 }}><View style={[e.fila, { gap: 8 }]}><IconoNota tamano={16} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.texto }]}>{derivaciones} derivaciones{'\n'}activas</Text></View></Caja>
              </View>
            )}
          />

          {/* Filtros */}
          <Caja estilo={{ gap: 10 }}>
            <FilaChips rotulo="Empresa:">
              <Chip activo={!filtro.organizacion_id} onPress={() => fijar({ organizacion_id: null })}>{`Todas (${filas.length})`}</Chip>
              {empresas.map((em) => (
                <Chip key={em.id} activo={filtro.organizacion_id === em.id} onPress={() => fijar({ organizacion_id: em.id })}>
                  {`${em.nombre} (${cuenta((x) => x.organizacion_id === em.id)})`}
                </Chip>
              ))}
            </FilaChips>
            <FilaChips rotulo="Estado:">
              <Chip activo={estado === 'todos'} onPress={() => setEstado('todos')}>Todos</Chip>
              {(['activo', 'detectado', 'retirado', 'finalizado'] as const).map((s) => (
                <Chip key={s} activo={estado === s} tono={s === 'detectado' ? TONO.tierraSuave : undefined} onPress={() => setEstado(s)}>{`${ETIQUETA_ESTADO[s]} (${cuenta((x) => x.estado === s)})`}</Chip>
              ))}
              <View style={e.separadorV} /><Rotulo>OLBI:</Rotulo>
              <Chip activo={nivel === 'todos'} onPress={() => setNivel('todos')}>Todos</Chip>
              <Chip activo={nivel === 'bajo'} onPress={() => setNivel('bajo')}>{`Bajo (${cuenta((x) => x.olbi_nivel === 'bajo')})`}</Chip>
              <Chip activo={nivel === 'a_vigilar'} onPress={() => setNivel('a_vigilar')}>{`A vigilar (${cuenta((x) => x.olbi_nivel === 'a_vigilar')})`}</Chip>
              <Chip activo={nivel === 'alto'} tono={TONO.tierraSuave} onPress={() => setNivel('alto')}>{`Alto (${cuenta((x) => x.olbi_nivel === 'alto')})`}</Chip>
            </FilaChips>
            <FilaChips rotulo="Filtros:">
              <Chip activo={nowcast50} onPress={() => setNowcast50((v) => !v)} icono="⚡">{`Nowcast ≥ 50 % (${cuenta((x) => (x.nowcast ?? 0) >= 0.5)})`}</Chip>
              <Chip activo={inactivos4} onPress={() => setInactivos4((v) => !v)} icono="⌛">{`Sin responder ≥ 4 d (${cuenta((x) => (x.dias_sin_checkin ?? 0) >= 4)})`}</Chip>
              <Chip activo={conDerivacion} tono={TONO.verde} onPress={() => setConDerivacion((v) => !v)} icono="⇄">{`Con derivación activa (${derivaciones})`}</Chip>
              <Chip activo={conCita} tono={TONO.verde} onPress={() => setConCita((v) => !v)} icono="▤">{`Cita agendada (${cuenta((x) => !!x.estado_cita)})`}</Chip>
            </FilaChips>
          </Caja>

          {/* Herramientas */}
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={e.fila}>
              <View style={e.buscador}>
                <IconoLupa tamano={14} color={color.textoSuave} />
                <TextInput value={busqueda} onChangeText={(t) => { setBusqueda(t); setPagina(0) }} placeholder="⌘K Buscar por código (ej. P-042)"
                  placeholderTextColor={color.textoSuave} style={[texto.apoyo, { flex: 1, color: color.texto, paddingVertical: 6 }]} autoCapitalize="characters" autoCorrect={false} />
                <View style={e.kbd}><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>⌘K</Text></View>
              </View>
              <BotonChico onPress={exportarSeleccion} icono={<IconoArchivo tamano={13} color={color.texto} />}>{`Exportar seleccionados (N=${seleccion.size})`}</BotonChico>
            </View>
            <View style={e.fila}><IconoNota tamano={13} color={color.textoMedio} /><Text style={[texto.dato, { color: color.textoMedio }]}>Orden: Urgencia / Riesgo relativo</Text></View>
          </View>

          {/* Tabla */}
          <Caja estilo={{ padding: 0, overflow: 'hidden' }}>
            <View style={e.cabecera}>
              <Pressable onPress={() => setSeleccion((s) => { const n = new Set(s); enPagina.forEach((x) => todasSel ? n.delete(x.id) : n.add(x.id)); return n })} style={[e.check, todasSel && e.checkOn]}>
                {todasSel && <IconoCheck tamano={10} color="#FFFFFF" />}
              </Pressable>
              {[['CÓDIGO', 1], ['EMPRESA', 1.5], ['SEM.', 0.6], ['ESTADO', 1], ['ADHERENCIA', 1.4], ['INACT.', 0.6], ['ÚLTIMO OLBI', 1.3], ['NOWCAST', 1], ['DERIV.', 0.8], ['CITA', 0.9]].map(([h, f]) => (
                <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, flex: Number(f), fontSize: 10 }]}>{h}</Text>
              ))}
            </View>
            {enPagina.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, padding: espacio.lg }]}>Nadie coincide con los filtros. Quita alguno o busca por otro código.</Text>}
            {enPagina.map((x) => {
              const sel = seleccion.has(x.id)
              const act = abierto?.id === x.id
              return (
                <Pressable key={x.id} onPress={() => setAbierto(x)} style={[e.filaTabla, act && e.filaActiva]}>
                  <Pressable onPress={() => setSeleccion((s) => { const n = new Set(s); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n })} style={[e.check, sel && e.checkOn]} hitSlop={6}>
                    {sel && <IconoCheck tamano={10} color="#FFFFFF" />}
                  </Pressable>
                  <View style={{ flex: 1 }}><Codigo>{x.codigo_anonimo}</Codigo></View>
                  <Text style={[texto.apoyo, { color: color.texto, flex: 1.5 }]} numberOfLines={1}>{x.organizacion}</Text>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 0.6 }]}>S{Math.min(x.semana, 6)} / 6</Text>
                  <View style={{ flex: 1, flexDirection: 'row' }}><PastillaEstado estado={x.estado} /></View>
                  <View style={{ flex: 1.4 }}><BarraPct pct={x.tasa_adherencia} /></View>
                  <View style={{ flex: 0.6 }}>{x.dias_sin_checkin != null && x.dias_sin_checkin >= 4
                    ? <View style={[e.inact]}><Text style={[texto.datoFuerte, { color: '#8C4A2B', fontSize: 11 }]}>{x.dias_sin_checkin}</Text></View>
                    : <Mono>{x.dias_sin_checkin ?? '—'}</Mono>}</View>
                  <View style={[e.fila, { flex: 1.3, gap: 4 }]}>
                    {x.olbi_agotamiento != null ? <><Mono tono={color.texto}>{Number(x.olbi_agotamiento).toFixed(1)}·{Number(x.olbi_desvinculacion).toFixed(1)}</Mono><PastillaNivel nivel={x.olbi_nivel} /></> : <Mono>—</Mono>}
                  </View>
                  <View style={{ flex: 1 }}>{x.nowcast != null
                    ? <Text style={[texto.datoFuerte, { color: x.nowcast >= 0.5 ? '#8C4A2B' : color.texto }]}>{Math.round(x.nowcast * 100)}% <Text style={[texto.dato, { color: color.textoSuave }]}>S{x.nowcast_dias ?? ''}</Text></Text>
                    : <Mono>—</Mono>}</View>
                  <View style={{ flex: 0.8 }}>{x.derivacion_id ? <IconoCheck tamano={12} color={color.primarioProfundo} /> : <Mono>—</Mono>}</View>
                  <View style={{ flex: 0.9 }}>{x.estado_cita ? <Pastilla tono={x.estado_cita === 'confirmada' ? TONO.verde : TONO.ambar}>{x.estado_cita === 'confirmada' ? 'Confirmada' : 'Pedida'}</Pastilla> : <Mono>—</Mono>}</View>
                </Pressable>
              )
            })}
            <View style={e.pieTabla}>
              <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Mostrando {pag * POR_PAGINA + 1}–{pag * POR_PAGINA + enPagina.length} de {visibles.length} participantes</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Página {pag + 1} de {paginas}</Text>
              <Pressable disabled={pag === 0} onPress={() => setPagina(pag - 1)} style={e.pagBtn}><Text style={[texto.dato, { color: pag === 0 ? color.textoSuave : color.texto }]}>‹</Text></Pressable>
              {Array.from({ length: Math.min(paginas, 5) }, (_, i) => i).map((i) => (
                <Pressable key={i} onPress={() => setPagina(i)} style={[e.pagBtn, pag === i && e.pagActiva]}><Text style={[texto.dato, { color: pag === i ? '#FFFFFF' : color.texto }]}>{i + 1}</Text></Pressable>
              ))}
              {paginas > 5 && <Text style={[texto.dato, { color: color.textoMedio }]}>… {paginas}</Text>}
              <Pressable disabled={pag >= paginas - 1} onPress={() => setPagina(pag + 1)} style={e.pagBtn}><Text style={[texto.dato, { color: pag >= paginas - 1 ? color.textoSuave : color.texto }]}>›</Text></Pressable>
            </View>
          </Caja>
        </Pantalla>

        {conPanel && abierto && <PanelLateral p={abierto} onCerrar={() => setAbierto(null)} />}
      </View>
    </Panel>
  )
}

function FilaChips({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <View style={[e.fila, { gap: 6 }]}>
      <View style={{ width: 64 }}><Rotulo>{rotulo}</Rotulo></View>
      {children}
    </View>
  )
}

function Chip({ children, activo, onPress, tono, icono }: { children: string; activo: boolean; onPress: () => void; tono?: { fondo: string; tinta: string }; icono?: string }) {
  const fondo = activo ? (tono?.fondo ?? color.primarioProfundo) : '#F1EFEB'
  const tinta = activo ? (tono?.tinta ?? '#FFFFFF') : color.texto
  return (
    <Pressable onPress={onPress} style={[e.chip, { backgroundColor: fondo }]} accessibilityRole="button" accessibilityState={{ selected: activo }}>
      {icono && <Text style={[texto.dato, { color: tinta }]}>{icono}</Text>}
      <Text style={[texto.datoFuerte, { color: tinta, fontSize: 12 }]}>{children}</Text>
    </Pressable>
  )
}

/** Vista previa del participante sin salir de la tabla. */
function PanelLateral({ p, onCerrar }: { p: FilaParticipanteV2; onCerrar: () => void }) {
  const { filtro } = useFiltro()
  const [envios, setEnvios] = useState<Envio[]>([])
  useEffect(() => { calendario(p.id).then(setEnvios).catch(() => setEnvios([])) }, [p.id])
  const semanas = calendarioSemanal(p.inscrito_en, envios)
  const completados = semanas.flat().filter((c) => c === 'ok').length
  const esperados = semanas.flat().filter((c) => c !== 'futuro').length

  return (
    <View style={e.lateral}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}>
        <View style={[e.fila, { gap: 6 }]}><Codigo grande>{p.codigo_anonimo}</Codigo><Text style={[texto.apoyo, { color: color.textoMedio }]}>· {p.organizacion}</Text></View>
        <Pressable onPress={onCerrar} hitSlop={8}><IconoCerrar tamano={16} color={color.textoMedio} /></Pressable>
      </View>
      {p.detectado_en && <View style={{ flexDirection: 'row' }}><Pastilla tono={TONO.tierraSuave} punto>{`Detectado S${p.olbi_semana ? semanaDe(p.inscrito_en, p.detectado_en) : '—'}`}</Pastilla></View>}
      <Pressable onPress={() => router.push(conFiltro(`/investigador/participante/${p.id}`, filtro) as never)} style={e.botonFicha}>
        <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Abrir ficha completa</Text>
        <IconoAbrir tamano={13} color="#FFFFFF" />
      </Pressable>

      <Rotulo>Métricas clave OLBI</Rotulo>
      <View style={[e.fila, { gap: 8 }]}>
        <View style={e.metrica}><Text style={[texto.dato, { color: color.textoMedio }]}>Agotamiento actual</Text>
          <Text style={[texto.seccion, { color: color.texto }]}>{p.olbi_agotamiento != null ? Number(p.olbi_agotamiento).toFixed(1) : '—'} <Text style={[texto.dato, { color: color.textoSuave }]}>/ 4.0</Text></Text>
        </View>
        <View style={e.metrica}><Text style={[texto.dato, { color: color.textoMedio }]}>Desvinculación</Text>
          <Text style={[texto.seccion, { color: color.texto }]}>{p.olbi_desvinculacion != null ? Number(p.olbi_desvinculacion).toFixed(1) : '—'} <Text style={[texto.dato, { color: color.textoSuave }]}>/ 4.0</Text></Text>
        </View>
      </View>
      <View style={[e.metrica, e.fila, { justifyContent: 'space-between' }]}>
        <View><Text style={[texto.dato, { color: color.textoMedio }]}>Probabilidad Nowcast S{Math.min(p.semana, 6)}</Text>
          <Text style={[texto.seccion, { color: p.nowcast != null && p.nowcast >= 0.5 ? '#8C4A2B' : color.texto }]}>{p.nowcast != null ? `${Math.round(p.nowcast * 100)}%` : '—'} <Text style={[texto.dato, { color: color.textoSuave }]}>{p.nowcast != null ? `(${p.nowcast_dias ?? 0} días)` : 'sin registro'}</Text></Text>
        </View>
        <View style={[e.sello, { backgroundColor: p.nowcast != null && p.nowcast >= 0.5 ? '#F3DDD2' : '#EDEBE7' }]}><Text style={[texto.datoFuerte, { color: p.nowcast != null && p.nowcast >= 0.5 ? '#8C4A2B' : color.textoMedio }]}>S{Math.min(p.semana, 6)}</Text></View>
      </View>
      {(p.estado_cita || p.derivacion_id) && (
        <View style={e.apoyo}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <Rotulo tinta={color.primarioProfundo}>Sesión de apoyo</Rotulo>
            <Pastilla tono={TONO.verde}>{p.estado_cita === 'confirmada' ? 'Agendada' : p.estado_cita === 'solicitada' ? 'Pedida' : p.estado_derivacion ?? 'Derivado'}</Pastilla>
          </View>
          <Text style={[texto.dato, { color: color.texto }]}>
            {p.psicologo ? <>Con <Text style={{ color: color.primarioProfundo }}>{p.psicologo}</Text></> : 'Sin psicólogo asignado'}
            {p.cita_para ? ` para el ${new Date(p.cita_para).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${new Date(p.cita_para).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })} PET.` : '.'}
          </Text>
        </View>
      )}

      <View style={[e.fila, { justifyContent: 'space-between' }]}>
        <Rotulo>Histórico semanal (5×5)</Rotulo>
        <Mono>{completados}/{esperados} completados</Mono>
      </View>
      <View style={e.matriz}>
        <View style={e.matrizFila}>{['L', 'M', 'M', 'J', 'V'].map((d, i) => <Text key={i} style={[texto.dato, { color: color.textoMedio, width: 22, textAlign: 'center' }]}>{d}</Text>)}</View>
        {semanas.map((sem, i) => (
          <View key={i} style={e.matrizFila}>{sem.map((c, j) => <View key={j} style={[e.celda, c === 'ok' ? e.celdaOk : c === 'alerta' ? e.celdaAlerta : c === 'futuro' ? e.celdaFuturo : e.celdaOmitido]} />)}</View>
        ))}
        <View style={[e.fila, { justifyContent: 'space-between', paddingTop: 4 }]}>
          <View style={[e.fila, { gap: 4 }]}><View style={[e.puntoLeyenda, { backgroundColor: color.primarioProfundo }]} /><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>Ok</Text></View>
          <View style={[e.fila, { gap: 4 }]}><View style={[e.puntoLeyenda, { backgroundColor: '#F3DDD2' }]} /><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>Alerta</Text></View>
          <View style={[e.fila, { gap: 4 }]}><View style={[e.puntoLeyenda, { backgroundColor: '#D9D5CF' }]} /><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>Omisión / Pend.</Text></View>
        </View>
      </View>

      <View style={e.identidad}>
        <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={14} color={color.texto} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Identidad Encriptada</Text></View>
        <Text style={[texto.dato, { color: color.textoMedio }]}>Para desencriptar con fines de salvaguarda clínica abra la ficha completa sujeta a registro ético.</Text>
      </View>
    </View>
  )
}

/** 5 semanas × L–V: ok / omitido / futuro (alerta: viernes sin OLBI). */
function calendarioSemanal(inscritoEn: string, envios: Envio[]): ('ok' | 'omitido' | 'alerta' | 'futuro')[][] {
  const lunes = new Date(`${inscritoEn.slice(0, 10)}T12:00:00`); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const dias = new Map<string, Set<string>>()
  for (const en of envios) (dias.get(en.dia) ?? dias.set(en.dia, new Set()).get(en.dia)!).add(en.formulario_clave)
  const out: ('ok' | 'omitido' | 'alerta' | 'futuro')[][] = []
  for (let s = 0; s < 5; s++) {
    const fila: ('ok' | 'omitido' | 'alerta' | 'futuro')[] = []
    for (let d = 0; d < 5; d++) {
      const f = new Date(lunes); f.setDate(lunes.getDate() + s * 7 + d)
      const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
      if (f > hoy) { fila.push('futuro'); continue }
      const set = dias.get(iso)
      if (d === 4) fila.push(set?.has('olbi') ? 'ok' : 'alerta')
      else fila.push(set?.has('diario') ? 'ok' : 'omitido')
    }
    out.push(fila)
  }
  return out
}

function semanaDe(inscrito: string, fecha: string) {
  return Math.max(1, Math.floor((new Date(fecha).getTime() - new Date(inscrito).getTime()) / (7 * 86_400_000)) + 1)
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  separadorV: { width: 1, height: 16, backgroundColor: color.borde, marginHorizontal: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: color.borde, borderRadius: 8, paddingHorizontal: 10, height: 36, minWidth: 260, backgroundColor: color.superficie },
  kbd: { borderWidth: 1, borderColor: color.borde, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F5F4F1' },
  filaTabla: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color.borde },
  filaActiva: { backgroundColor: '#EAF4EF' },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#BDB8B1', alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficie },
  checkOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  inact: { backgroundColor: '#FBEDE6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  pieTabla: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color.borde },
  pagBtn: { minWidth: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pagActiva: { backgroundColor: color.primarioProfundo },
  lateral: { width: 300, borderLeftWidth: 1, borderLeftColor: color.borde, backgroundColor: color.superficie, padding: espacio.base, gap: espacio.md, overflow: 'hidden' },
  botonFicha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, backgroundColor: color.primarioProfundo },
  metrica: { flex: 1, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 2 },
  sello: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  apoyo: { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10, gap: 4 },
  matriz: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 6 },
  matrizFila: { flexDirection: 'row', justifyContent: 'space-between' },
  celda: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 4 },
  celdaOk: { backgroundColor: color.primarioProfundo },
  celdaAlerta: { backgroundColor: '#F3DDD2' },
  celdaOmitido: { backgroundColor: '#D9D5CF' },
  celdaFuturo: { backgroundColor: '#EDEBE7' },
  puntoLeyenda: { width: 6, height: 6, borderRadius: 3 },
  identidad: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 4, marginTop: 'auto' },
})

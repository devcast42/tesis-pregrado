/** Registro de trabajadores — implementa ESP-009 RF-009-07.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Trabajadores · Investigador Principal».
 *
 *  La pantalla responde a una pregunta: ¿a quién hay que mirar hoy? Por eso
 *  arriba no hay catorce chips sueltos sino cuatro VISTAS —todos, necesitan
 *  atención, no responden, en apoyo— que son la lectura en castellano de los
 *  filtros que pide el requisito. Los filtros finos (estado, nivel del OLBI,
 *  semana, cortes de riesgo e inactividad) siguen ahí, combinables, pero
 *  plegados en «Afinar»: se usan para una consulta concreta, no para entrar.
 *
 *  La tabla pasó de diez columnas con abreviaturas —SEM., INACT., DERIV.—
 *  a seis con nombre completo: la empresa y la semana viven bajo el código,
 *  los días sin responder bajo la barra de adherencia, y derivación y cita
 *  se juntan en «Apoyo», que es lo que ambas significan. Se ordena por
 *  cualquiera de ellas; por defecto, por urgencia.
 *
 *  Solo códigos, nunca nombres (RN-009-02). */

import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import { ETIQUETA_ESTADO, calendario, trabajadores as listar, type Envio, type FilaTrabajadorV2 } from '../../modules/investigador/panel'
import { aCsv, descargarTexto } from '../../modules/investigador/exportar'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { BarraPct, BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, PastillaEstado, PastillaNivel, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoAbrir, IconoAjustes, IconoApoyo, IconoArchivo, IconoCerrar, IconoCheck, IconoChevronAbajo,
  IconoEscudoCheck, IconoLupa, IconoReloj,
} from '../../modules/nucleo/iconos'

const SEMANAS_ESTUDIO = 6
const POR_PAGINA = 12
/** Cortes del protocolo: cuatro días sin responder es lo que ESP-007 llama
 *  inactivo, y 50 % es el umbral de decisión del nowcast. */
const DIAS_CALLADO = 4
const RIESGO_ALTO = 0.5
const TIERRA = '#8C4A2B'

type Estado = 'todos' | FilaTrabajadorV2['estado']
type Nivel = 'todos' | 'bajo' | 'a_vigilar' | 'alto'
type Vista = 'todos' | 'atencion' | 'callados' | 'apoyo'
type Orden = 'urgencia' | 'codigo' | 'adherencia' | 'olbi' | 'riesgo'

/** Las cuatro vistas de entrada. Son uniones (basta una condición), que es lo
 *  que un chip de filtro no sabe expresar: «necesita atención» es estar
 *  detectado O tener el OLBI alto O que el modelo lo señale hoy. */
const VISTAS: { clave: Vista; titulo: string; apoyo: string; prueba: (x: FilaTrabajadorV2) => boolean }[] = [
  { clave: 'todos', titulo: 'Todos', apoyo: 'toda la cohorte, por urgencia', prueba: () => true },
  {
    clave: 'atencion', titulo: 'Necesitan atención', apoyo: 'detectados, OLBI alto o señalados hoy por el modelo',
    // Quien ya salió del estudio no entra: su OLBI alto sigue ahí, pero no
    // hay nada que hacer con él y ensuciaba la lista de pendientes.
    prueba: (x) => (x.estado === 'activo' || x.estado === 'detectado')
      && (x.estado === 'detectado' || x.olbi_nivel === 'alto' || (x.nowcast != null && x.nowcast >= RIESGO_ALTO)),
  },
  {
    clave: 'callados', titulo: 'No responden', apoyo: `${DIAS_CALLADO} días o más sin ningún check-in`,
    prueba: (x) => x.dias_sin_checkin != null && x.dias_sin_checkin >= DIAS_CALLADO,
  },
  {
    clave: 'apoyo', titulo: 'En apoyo', apoyo: 'con derivación abierta o cita con psicólogo',
    prueba: (x) => !!x.derivacion_id || !!x.estado_cita,
  },
]

const COLUMNAS: { clave: Orden | null; titulo: string; ancho: number }[] = [
  { clave: 'codigo', titulo: 'Trabajador', ancho: 2.4 },
  { clave: null, titulo: 'Situación', ancho: 1 },
  { clave: 'adherencia', titulo: 'Adherencia', ancho: 1.6 },
  // Los dos números del OLBI en el título, para no repetir «agot.» y «desv.»
  // en cincuenta filas: ahí solo caben partidos en dos líneas.
  { clave: 'olbi', titulo: 'OLBI · agot. y desv.', ancho: 1.4 },
  { clave: 'riesgo', titulo: 'Riesgo hoy', ancho: 1 },
  { clave: null, titulo: 'Apoyo', ancho: 1.2 },
]

export default function Trabajadores() {
  const { filtro, fijar } = useFiltro()
  const { width } = useWindowDimensions()
  const conPanel = width >= 1200
  const [filas, setFilas] = useState<FilaTrabajadorV2[] | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [vista, setVista] = useState<Vista>('todos')
  const [afinar, setAfinar] = useState(false)
  const [estado, setEstado] = useState<Estado>('todos')
  const [nivel, setNivel] = useState<Nivel>('todos')
  const [semana, setSemana] = useState<number | null>(null)
  const [riesgo50, setRiesgo50] = useState(false)
  const [callados, setCallados] = useState(false)
  const [conDerivacion, setConDerivacion] = useState(false)
  const [conCita, setConCita] = useState(false)
  const [orden, setOrden] = useState<Orden>('urgencia')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [pagina, setPagina] = useState(0)
  const [abierto, setAbierto] = useState<FilaTrabajadorV2 | null>(null)

  // Al cambiar de empresa se cierra la ficha abierta y se vacía la selección:
  // ambas son de la empresa anterior, y una selección que sobrevive al cambio
  // deja el botón de descarga prometiendo un CSV de nadie.
  useDatosDelFiltro(() => { setFilas(null); setAbierto(null); setSeleccion(new Set()) }, async (vigente) => {
    const [f, em] = await Promise.all([listar(filtro), listarEmpresas().catch(() => [])])
    if (!vigente()) return
    setFilas(f); setEmpresas(em)
    setAbierto((a) => a ?? f[0] ?? null)
  }, [filtro.organizacion_id])

  const pruebaVista = VISTAS.find((v) => v.clave === vista)!.prueba
  const hayAfinado = estado !== 'todos' || nivel !== 'todos' || semana != null || riesgo50 || callados || conDerivacion || conCita
  const cuantosAfinados = [estado !== 'todos', nivel !== 'todos', semana != null, riesgo50, callados, conDerivacion, conCita].filter(Boolean).length

  const visibles = useMemo(() => (filas ?? []).filter((x) => {
    if (!pruebaVista(x)) return false
    if (estado !== 'todos' && x.estado !== estado) return false
    if (nivel !== 'todos' && x.olbi_nivel !== nivel) return false
    if (semana != null && Math.min(x.semana, SEMANAS_ESTUDIO) !== semana) return false
    if (riesgo50 && !(x.nowcast != null && x.nowcast >= RIESGO_ALTO)) return false
    if (callados && !(x.dias_sin_checkin != null && x.dias_sin_checkin >= DIAS_CALLADO)) return false
    if (conDerivacion && !x.derivacion_id) return false
    if (conCita && !x.estado_cita) return false
    const q = busqueda.trim().toLowerCase()
    return !q || x.codigo_anonimo.toLowerCase().includes(q) || (x.organizacion ?? '').toLowerCase().includes(q)
  }), [filas, vista, estado, nivel, semana, riesgo50, callados, conDerivacion, conCita, busqueda])

  /** `filas` llega ya ordenada por urgencia, así que esa no reordena nada. */
  const ordenados = useMemo(() => {
    if (orden === 'urgencia') return visibles
    const n = (v: number | null) => (v == null ? -1 : Number(v))
    return [...visibles].sort((a, b) => {
      if (orden === 'codigo') return a.codigo_anonimo.localeCompare(b.codigo_anonimo)
      if (orden === 'adherencia') return n(a.tasa_adherencia) - n(b.tasa_adherencia)
      if (orden === 'olbi') return n(b.olbi_agotamiento) - n(a.olbi_agotamiento)
      return n(b.nowcast) - n(a.nowcast)
    })
  }, [visibles, orden])

  const paginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas - 1)
  const enPagina = ordenados.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const cuenta = (pred: (x: FilaTrabajadorV2) => boolean) => filas.filter(pred).length
  const enSeguimiento = cuenta((x) => x.estado === 'activo')
  const detectados = cuenta((x) => x.estado === 'detectado')
  const enApoyo = cuenta((x) => !!x.derivacion_id || !!x.estado_cita)
  const todasSel = enPagina.length > 0 && enPagina.every((x) => seleccion.has(x.id))
  const empresa = empresas.find((em) => em.id === filtro.organizacion_id)

  function limpiarAfinado() {
    setEstado('todos'); setNivel('todos'); setSemana(null)
    setRiesgo50(false); setCallados(false); setConDerivacion(false); setConCita(false)
    setPagina(0)
  }
  function exportarSeleccion() {
    const sel = filas!.filter((x) => seleccion.has(x.id))
    descargarTexto(`trabajadores-${new Date().toISOString().slice(0, 10)}.csv`, aCsv(sel as any), 'text/csv')
  }

  return (
    <Panel rol="investigador">
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <Pantalla ancho={ancho.panel}>
          <Encabezado
            eyebrow="Registro de la cohorte · ESP-009"
            titulo="Trabajadores"
            subtitulo={`${filas.length} ${filas.length === 1 ? 'persona inscrita' : 'personas inscritas'} en ${empresa ? empresa.nombre : `${empresas.length} empresas`} · ${enSeguimiento} en seguimiento. Cada quien aparece por su código; los nombres no salen de aquí.`}
            derecha={(
              <View style={[e.fila, { gap: espacio.sm }]}>
                <Sello valor={detectados} rotulo={detectados === 1 ? 'detectado' : 'detectados'} icono={<IconoReloj tamano={15} color={TIERRA} />} fondo="#FBEDE6" tinta={TIERRA} />
                <Sello valor={enApoyo} rotulo="en apoyo" icono={<IconoApoyo tamano={15} color={color.primarioProfundo} />} fondo="#EAF4EF" tinta={color.primarioProfundo} />
              </View>
            )}
          />

          {/* Empresa: el filtro global del panel vive en la URL y se elige aquí. */}
          <View style={[e.fila, { gap: 6 }]}>
            <Rotulo>Empresa</Rotulo>
            <Chip activo={!filtro.organizacion_id} onPress={() => { fijar({ organizacion_id: null }); setPagina(0) }}>Todas</Chip>
            {empresas.map((em) => (
              <Chip key={em.id} activo={filtro.organizacion_id === em.id} onPress={() => { fijar({ organizacion_id: em.id }); setPagina(0) }}>{em.nombre}</Chip>
            ))}
          </View>

          {/* Las cuatro vistas: la pregunta antes que los campos. */}
          <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
            {VISTAS.map((v) => {
              const n = filas.filter(v.prueba).length
              const on = vista === v.clave
              return (
                <Pressable key={v.clave} onPress={() => { setVista(v.clave); setPagina(0) }} style={[e.vista, on && e.vistaOn]}
                  accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <View style={[e.fila, { justifyContent: 'space-between', gap: 6 }]}>
                    <Text style={[texto.datoFuerte, { color: on ? color.primarioProfundo : color.texto }]} numberOfLines={1}>{v.titulo}</Text>
                    <Text style={[texto.cuerpoFuerte, { color: on ? color.primarioProfundo : color.textoMedio }]}>{n}</Text>
                  </View>
                  <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11.5 }]}>{v.apoyo}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* Buscar y afinar */}
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={e.buscador}>
              <IconoLupa tamano={14} color={color.textoSuave} />
              <TextInput value={busqueda} onChangeText={(t) => { setBusqueda(t); setPagina(0) }}
                placeholder="Buscar por código o empresa" placeholderTextColor={color.textoSuave}
                style={[texto.apoyo, { flex: 1, color: color.texto, paddingVertical: 6 }]} autoCorrect={false} />
              {busqueda !== '' && <Pressable onPress={() => setBusqueda('')} hitSlop={8}><IconoCerrar tamano={13} color={color.textoMedio} /></Pressable>}
            </View>
            <View style={[e.fila, { gap: 6 }]}>
              {hayAfinado && <Pressable onPress={limpiarAfinado} hitSlop={6}><Text style={[texto.dato, { color: color.primarioProfundo }]}>Quitar filtros</Text></Pressable>}
              <Pressable onPress={() => setAfinar((v) => !v)} style={[e.botonAfinar, (afinar || hayAfinado) && e.botonAfinarOn]} accessibilityRole="button">
                <IconoAjustes tamano={12} color={afinar || hayAfinado ? color.primarioProfundo : color.texto} />
                <Text style={[texto.datoFuerte, { color: afinar || hayAfinado ? color.primarioProfundo : color.texto }]}>Afinar</Text>
                {cuantosAfinados > 0 && <View style={e.contador}><Text style={[texto.datoFuerte, { color: '#FFFFFF', fontSize: 10 }]}>{cuantosAfinados}</Text></View>}
                <View style={afinar ? undefined : e.chevronCerrado}><IconoChevronAbajo tamano={13} color={afinar || hayAfinado ? color.primarioProfundo : color.textoMedio} /></View>
              </Pressable>
            </View>
          </View>

          {afinar && (
            <Caja estilo={{ gap: espacio.md }}>
              <Grupo rotulo="Estado del seguimiento">
                <Chip activo={estado === 'todos'} onPress={() => { setEstado('todos'); setPagina(0) }}>Cualquiera</Chip>
                {(['activo', 'detectado', 'retirado', 'finalizado'] as const).map((s) => {
                  const n = cuenta((x) => x.estado === s)
                  return <Chip key={s} activo={estado === s} vacio={n === 0} tono={s === 'detectado' ? TONO.tierra : undefined}
                    onPress={() => { setEstado(s); setPagina(0) }}>{`${ETIQUETA_ESTADO[s]} · ${n}`}</Chip>
                })}
              </Grupo>
              <Grupo rotulo="Nivel del último OLBI">
                <Chip activo={nivel === 'todos'} onPress={() => { setNivel('todos'); setPagina(0) }}>Cualquiera</Chip>
                {([['bajo', 'Bajo'], ['a_vigilar', 'A vigilar'], ['alto', 'Alto']] as const).map(([k, t]) => {
                  const n = cuenta((x) => x.olbi_nivel === k)
                  return <Chip key={k} activo={nivel === k} vacio={n === 0} tono={k === 'alto' ? TONO.tierra : k === 'a_vigilar' ? TONO.ambar : undefined}
                    onPress={() => { setNivel(k); setPagina(0) }}>{`${t} · ${n}`}</Chip>
                })}
              </Grupo>
              <Grupo rotulo={`Semana del estudio (de 1 a ${SEMANAS_ESTUDIO})`}>
                <Chip activo={semana == null} onPress={() => { setSemana(null); setPagina(0) }}>Cualquiera</Chip>
                {Array.from({ length: SEMANAS_ESTUDIO }, (_, i) => i + 1).map((s) => {
                  const n = cuenta((x) => Math.min(x.semana, SEMANAS_ESTUDIO) === s)
                  return <Chip key={s} activo={semana === s} vacio={n === 0} onPress={() => { setSemana(s); setPagina(0) }}>{`${s} · ${n}`}</Chip>
                })}
              </Grupo>
              <Grupo rotulo="Además">
                <Chip activo={riesgo50} onPress={() => { setRiesgo50((v) => !v); setPagina(0) }}>{`El modelo lo señala hoy · ${cuenta((x) => x.nowcast != null && x.nowcast >= RIESGO_ALTO)}`}</Chip>
                <Chip activo={callados} onPress={() => { setCallados((v) => !v); setPagina(0) }}>{`Sin responder ${DIAS_CALLADO} días o más · ${cuenta((x) => x.dias_sin_checkin != null && x.dias_sin_checkin >= DIAS_CALLADO)}`}</Chip>
                <Chip activo={conDerivacion} tono={TONO.verde} onPress={() => { setConDerivacion((v) => !v); setPagina(0) }}>{`Con derivación abierta · ${cuenta((x) => !!x.derivacion_id)}`}</Chip>
                <Chip activo={conCita} tono={TONO.verde} onPress={() => { setConCita((v) => !v); setPagina(0) }}>{`Con cita · ${cuenta((x) => !!x.estado_cita)}`}</Chip>
              </Grupo>
            </Caja>
          )}

          {/* Barra de selección: solo aparece cuando hay algo seleccionado, en
              vez de un botón «(N=0)» que no hace nada el 99 % del tiempo. */}
          {seleccion.size > 0 && (
            <View style={e.barraSel}>
              <Text style={[texto.datoFuerte, { color: color.primarioProfundo, flex: 1 }]}>
                {`${seleccion.size} ${seleccion.size === 1 ? 'trabajador seleccionado' : 'trabajadores seleccionados'}`}
              </Text>
              <Pressable onPress={() => setSeleccion(new Set())} hitSlop={6}><Text style={[texto.dato, { color: color.textoMedio }]}>Quitar selección</Text></Pressable>
              <BotonChico onPress={exportarSeleccion} icono={<IconoArchivo tamano={13} color={color.texto} />}>Descargar CSV</BotonChico>
            </View>
          )}

          {/* La tabla */}
          <Caja estilo={{ padding: 0, overflow: 'hidden' }}>
            <View style={e.cabecera}>
              <Pressable onPress={() => setSeleccion((s) => { const n = new Set(s); enPagina.forEach((x) => todasSel ? n.delete(x.id) : n.add(x.id)); return n })}
                style={[e.check, todasSel && e.checkOn]} hitSlop={6}
                accessibilityRole="checkbox" accessibilityState={{ checked: todasSel }} accessibilityLabel="Seleccionar la página">
                {todasSel && <IconoCheck tamano={10} color="#FFFFFF" />}
              </Pressable>
              {COLUMNAS.map((c) => {
                const activa = c.clave != null && orden === c.clave
                if (!c.clave) return <Text key={c.titulo} style={[texto.etiqueta, e.th, { flex: c.ancho }]}>{c.titulo.toUpperCase()}</Text>
                return (
                  <Pressable key={c.titulo} onPress={() => { setOrden(activa ? 'urgencia' : c.clave!); setPagina(0) }} style={{ flex: c.ancho, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={[texto.etiqueta, e.th, activa && { color: color.primarioProfundo }]}>{c.titulo.toUpperCase()}</Text>
                    {activa && <IconoChevronAbajo tamano={12} color={color.primarioProfundo} />}
                  </Pressable>
                )
              })}
            </View>

            {enPagina.length === 0 && (
              <View style={{ padding: espacio.lg, gap: espacio.sm, alignItems: 'flex-start' }}>
                <Text style={[texto.apoyo, { color: color.texto }]}>Nadie encaja con lo que estás pidiendo.</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  {busqueda ? `Ningún código ni empresa contiene «${busqueda.trim()}».` : 'La vista y los filtros activos no dejan a nadie.'}
                </Text>
                <View style={[e.fila, { gap: 6 }]}>
                  {busqueda !== '' && <BotonChico onPress={() => setBusqueda('')}>Borrar la búsqueda</BotonChico>}
                  {hayAfinado && <BotonChico onPress={limpiarAfinado}>Quitar los filtros</BotonChico>}
                  {vista !== 'todos' && <BotonChico onPress={() => setVista('todos')}>Ver a todos</BotonChico>}
                </View>
              </View>
            )}

            {enPagina.map((x) => {
              const sel = seleccion.has(x.id)
              const act = abierto?.id === x.id
              const callado = x.dias_sin_checkin != null && x.dias_sin_checkin >= DIAS_CALLADO
              const riesgo = x.nowcast != null && x.nowcast >= RIESGO_ALTO
              return (
                <Pressable key={x.id} onPress={() => setAbierto(x)} style={[e.filaTabla, act && e.filaActiva]}
                  accessibilityRole="button" accessibilityLabel={`Ver ${x.codigo_anonimo}`}>
                  <Pressable onPress={() => setSeleccion((s) => { const n = new Set(s); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n })}
                    style={[e.check, sel && e.checkOn]} hitSlop={8}
                    accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={`Seleccionar ${x.codigo_anonimo}`}>
                    {sel && <IconoCheck tamano={10} color="#FFFFFF" />}
                  </Pressable>

                  {/* Código arriba; empresa y semana debajo, que antes eran dos
                      columnas con «SEM.» por título. */}
                  <View style={{ flex: 2.4, gap: 1 }}>
                    <Codigo>{x.codigo_anonimo}</Codigo>
                    <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11.5 }]} numberOfLines={1}>
                      {`${x.organizacion} · semana ${Math.min(x.semana, SEMANAS_ESTUDIO)} de ${SEMANAS_ESTUDIO}`}
                    </Text>
                  </View>

                  <View style={{ flex: 1, flexDirection: 'row' }}><PastillaEstado estado={x.estado} /></View>

                  {/* Los días sin responder ya no son una columna aparte: son
                      la explicación de la barra que tienen al lado. */}
                  <View style={{ flex: 1.6, gap: 2 }}>
                    <BarraPct tasa={x.tasa_adherencia} />
                    <Text style={[texto.dato, { color: callado ? TIERRA : color.textoMedio, fontSize: 11 }]} numberOfLines={1}>
                      {x.tasa_adherencia == null ? (x.estado === 'activo' ? 'sin check-ins todavía' : 'solo se mide en activos')
                        : callado ? `${x.dias_sin_checkin} días sin responder`
                        : x.dias_sin_checkin == null ? 'al día' : x.dias_sin_checkin === 0 ? 'respondió hoy' : `hace ${x.dias_sin_checkin} ${x.dias_sin_checkin === 1 ? 'día' : 'días'}`}
                    </Text>
                  </View>

                  <View style={{ flex: 1.4, gap: 2 }}>
                    {x.olbi_agotamiento != null ? (
                      <>
                        <View style={{ flexDirection: 'row' }}><PastillaNivel nivel={x.olbi_nivel} /></View>
                        <Mono tamano={11}>{`${Number(x.olbi_agotamiento).toFixed(1)} · ${Number(x.olbi_desvinculacion).toFixed(1)}`}</Mono>
                      </>
                    ) : <Text numberOfLines={1} style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>sin OLBI aún</Text>}
                  </View>

                  <View style={{ flex: 1, gap: 1 }}>
                    {x.nowcast != null ? (
                      <>
                        <Text style={[texto.cuerpoFuerte, { color: riesgo ? TIERRA : color.texto, fontSize: 15 }]}>{`${Math.round(x.nowcast * 100)}%`}</Text>
                        <Text style={[texto.dato, { color: color.textoSuave, fontSize: 10.5 }]}>{`${x.nowcast_dias ?? 0} d de datos`}</Text>
                      </>
                    ) : <Text numberOfLines={1} style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>sin dato</Text>}
                  </View>

                  {/* Derivación y cita eran dos columnas con un ✓ y un guion.
                      Juntas dicen una sola cosa: si esta persona ya tiene a
                      alguien y en qué punto va. */}
                  <View style={{ flex: 1.3 }}>
                    {x.estado_cita === 'confirmada' ? <Pastilla tono={TONO.verde} punto>Cita confirmada</Pastilla>
                      : x.estado_cita === 'solicitada' ? <Pastilla tono={TONO.ambar} punto>Cita pedida</Pastilla>
                      : x.derivacion_id ? <Pastilla tono={TONO.verdeSuave}>Derivado</Pastilla>
                      : <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>—</Text>}
                  </View>
                </Pressable>
              )
            })}

            {ordenados.length > 0 && (
              <View style={e.pieTabla}>
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
                  {ordenados.length <= POR_PAGINA
                    ? `${ordenados.length} de ${filas.length}`
                    : `${pag * POR_PAGINA + 1}–${pag * POR_PAGINA + enPagina.length} de ${ordenados.length}`}
                  {orden === 'urgencia' ? ' · por urgencia' : ' · ordenado por ' + (COLUMNAS.find((c) => c.clave === orden)?.titulo.toLowerCase() ?? '')}
                </Text>
                {paginas > 1 && <Paginador pag={pag} paginas={paginas} ir={setPagina} />}
              </View>
            )}
          </Caja>
        </Pantalla>

        {conPanel && abierto && <PanelLateral p={abierto} onCerrar={() => setAbierto(null)} />}
      </View>
    </Panel>
  )
}

function Sello({ valor, rotulo, icono, fondo, tinta }: { valor: number; rotulo: string; icono: React.ReactNode; fondo: string; tinta: string }) {
  return (
    <View style={e.sello}>
      <View style={[e.selloIcono, { backgroundColor: fondo }]}>{icono}</View>
      <View>
        <Text style={[texto.cuerpoFuerte, { color: valor > 0 ? tinta : color.textoMedio, fontSize: 18, lineHeight: 22 }]}>{valor}</Text>
        <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11 }]}>{rotulo}</Text>
      </View>
    </View>
  )
}

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.fila, { gap: 6 }]}>{children}</View>
    </View>
  )
}

function Chip({ children, activo, onPress, tono, vacio }: {
  children: string; activo: boolean; onPress: () => void; tono?: { fondo: string; tinta: string }; vacio?: boolean
}) {
  const fondo = activo ? (tono?.tinta ?? color.primarioProfundo) : '#F1EFEB'
  const tinta = activo ? '#FFFFFF' : vacio ? color.textoSuave : color.texto
  return (
    <Pressable onPress={onPress} style={[e.chip, { backgroundColor: fondo }]} accessibilityRole="button" accessibilityState={{ selected: activo }}>
      <Text style={[texto.datoFuerte, { color: tinta, fontSize: 12 }]}>{children}</Text>
    </Pressable>
  )
}

/** Ventana de páginas alrededor de la actual. La versión anterior pintaba
 *  siempre 1–5 y un «… 6»: con 58 trabajadores la última página solo se
 *  alcanzaba pulsando la flecha. */
function Paginador({ pag, paginas, ir }: { pag: number; paginas: number; ir: (n: number) => void }) {
  const desde = Math.max(0, Math.min(pag - 2, paginas - 5))
  const ventana = Array.from({ length: Math.min(5, paginas) }, (_, i) => desde + i)
  return (
    <View style={[e.fila, { gap: 4 }]}>
      <Pressable disabled={pag === 0} onPress={() => ir(pag - 1)} style={e.pagBtn} accessibilityRole="button" accessibilityLabel="Página anterior">
        <Text style={[texto.dato, { color: pag === 0 ? color.textoSuave : color.texto }]}>‹</Text>
      </Pressable>
      {desde > 0 && <Text style={[texto.dato, { color: color.textoSuave }]}>…</Text>}
      {ventana.map((i) => (
        <Pressable key={i} onPress={() => ir(i)} style={[e.pagBtn, pag === i && e.pagActiva]} accessibilityRole="button">
          <Text style={[texto.dato, { color: pag === i ? '#FFFFFF' : color.texto }]}>{i + 1}</Text>
        </Pressable>
      ))}
      {desde + ventana.length < paginas && <Text style={[texto.dato, { color: color.textoSuave }]}>…</Text>}
      <Pressable disabled={pag >= paginas - 1} onPress={() => ir(pag + 1)} style={e.pagBtn} accessibilityRole="button" accessibilityLabel="Página siguiente">
        <Text style={[texto.dato, { color: pag >= paginas - 1 ? color.textoSuave : color.texto }]}>›</Text>
      </Pressable>
    </View>
  )
}

/** Vista previa del trabajador sin salir de la tabla. */
function PanelLateral({ p, onCerrar }: { p: FilaTrabajadorV2; onCerrar: () => void }) {
  const { filtro } = useFiltro()
  const [envios, setEnvios] = useState<Envio[]>([])
  useEffect(() => { calendario(p.id).then(setEnvios).catch(() => setEnvios([])) }, [p.id])
  const semanas = calendarioSemanal(p.inscrito_en, envios)
  const celdas = semanas.flat()
  const respondidos = celdas.filter((c) => c === 'ok').length
  const esperados = celdas.filter((c) => c !== 'futuro').length
  const riesgo = p.nowcast != null && p.nowcast >= RIESGO_ALTO

  return (
    <View style={e.lateral}>
      <View style={[e.fila, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Codigo grande>{p.codigo_anonimo}</Codigo>
          <Text style={[texto.dato, { color: color.textoMedio }]}>{`${p.organizacion} · semana ${Math.min(p.semana, SEMANAS_ESTUDIO)} de ${SEMANAS_ESTUDIO}`}</Text>
        </View>
        <Pressable onPress={onCerrar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar la vista previa"><IconoCerrar tamano={16} color={color.textoMedio} /></Pressable>
      </View>

      {p.detectado_en && (
        <View style={{ flexDirection: 'row' }}>
          <Pastilla tono={TONO.tierraSuave} punto>{`Detectado en la semana ${semanaDe(p.inscrito_en, p.detectado_en)}`}</Pastilla>
        </View>
      )}

      <Pressable onPress={() => router.push(conFiltro(`/investigador/trabajador/${p.id}`, filtro) as never)} style={e.botonFicha} accessibilityRole="button">
        <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Abrir la ficha completa</Text>
        <IconoAbrir tamano={13} color="#FFFFFF" />
      </Pressable>

      <Rotulo>Último OLBI</Rotulo>
      <View style={[e.fila, { gap: 8 }]}>
        <View style={e.metrica}>
          <Text style={[texto.dato, { color: color.textoMedio }]}>Agotamiento</Text>
          <Text style={[texto.seccion, { color: color.texto }]}>{p.olbi_agotamiento != null ? Number(p.olbi_agotamiento).toFixed(1) : '—'} <Text style={[texto.dato, { color: color.textoSuave }]}>de 4.0</Text></Text>
        </View>
        <View style={e.metrica}>
          <Text style={[texto.dato, { color: color.textoMedio }]}>Desvinculación</Text>
          <Text style={[texto.seccion, { color: color.texto }]}>{p.olbi_desvinculacion != null ? Number(p.olbi_desvinculacion).toFixed(1) : '—'} <Text style={[texto.dato, { color: color.textoSuave }]}>de 4.0</Text></Text>
        </View>
      </View>

      <View style={[e.metrica, e.fila, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[texto.dato, { color: color.textoMedio }]}>Riesgo de hoy según el modelo</Text>
          {p.nowcast != null
            ? <Text style={[texto.seccion, { color: riesgo ? TIERRA : color.texto }]}>{`${Math.round(p.nowcast * 100)}%`} <Text style={[texto.dato, { color: color.textoSuave }]}>{`con ${p.nowcast_dias ?? 0} días de datos`}</Text></Text>
            : <Text style={[texto.apoyo, { color: color.textoSuave }]}>Sin predicción para hoy</Text>}
        </View>
        <View style={[e.aguja, { backgroundColor: riesgo ? '#F3DDD2' : '#EDEBE7' }]}>
          <Text style={[texto.datoFuerte, { color: riesgo ? TIERRA : color.textoMedio, fontSize: 11 }]}>{riesgo ? 'Señalado' : 'Sin señal'}</Text>
        </View>
      </View>

      {(p.estado_cita || p.derivacion_id) && (
        <View style={e.apoyo}>
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <Rotulo tinta={color.primarioProfundo}>Apoyo en marcha</Rotulo>
            <Pastilla tono={TONO.verde}>{p.estado_cita === 'confirmada' ? 'Cita confirmada' : p.estado_cita === 'solicitada' ? 'Cita pedida' : 'Derivado'}</Pastilla>
          </View>
          <Text style={[texto.dato, { color: color.texto }]}>
            {p.psicologo ? <>Con <Text style={{ color: color.primarioProfundo }}>{p.psicologo}</Text></> : 'Todavía sin psicólogo asignado'}
            {p.cita_para ? ` el ${new Date(p.cita_para).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${new Date(p.cita_para).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}.` : '.'}
          </Text>
        </View>
      )}

      <View style={[e.fila, { justifyContent: 'space-between' }]}>
        <Rotulo>Las 5 últimas semanas</Rotulo>
        <Text style={[texto.dato, { color: color.textoMedio }]}>{`respondió ${respondidos} de ${esperados}`}</Text>
      </View>
      <View style={e.matriz}>
        <View style={e.matrizFila}>{['L', 'M', 'M', 'J', 'V'].map((d, i) => <Text key={i} style={[texto.dato, { color: color.textoMedio, width: 22, textAlign: 'center' }]}>{d}</Text>)}</View>
        {semanas.map((sem, i) => (
          <View key={i} style={e.matrizFila}>
            {sem.map((c, j) => <View key={j} style={[e.celda, c === 'ok' ? e.celdaOk : c === 'alerta' ? e.celdaAlerta : c === 'futuro' ? e.celdaFuturo : e.celdaOmitido]} />)}
          </View>
        ))}
        <View style={e.leyenda}>
          <Leyenda tinta={color.primarioProfundo}>Respondió</Leyenda>
          <Leyenda tinta="#D9D5CF">No respondió</Leyenda>
          <Leyenda tinta="#F3DDD2">Faltó el OLBI del viernes</Leyenda>
          <Leyenda tinta="#EDEBE7">Aún no toca</Leyenda>
        </View>
      </View>

      <View style={e.identidad}>
        <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={14} color={color.texto} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Aquí no hay nombres</Text></View>
        <Text style={[texto.dato, { color: color.textoMedio }]}>Saber quién es exige pedirlo en la ficha completa, y ese acceso queda anotado en Auditoría con la hora y el motivo.</Text>
      </View>
    </View>
  )
}

function Leyenda({ children, tinta }: { children: string; tinta: string }) {
  return (
    <View style={[e.fila, { gap: 4, width: 130 }]}>
      <View style={[e.puntoLeyenda, { backgroundColor: tinta }]} />
      <Text style={[texto.dato, { color: color.textoMedio, fontSize: 10.5 }]} numberOfLines={1}>{children}</Text>
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
  sello: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficie, borderWidth: 1, borderColor: '#EEECE8', borderRadius: radio.md, paddingHorizontal: 12, paddingVertical: 10 },
  selloIcono: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vista: { flex: 1, minWidth: 150, gap: 3, padding: 10, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', backgroundColor: color.superficie },
  vistaOn: { borderColor: color.primarioProfundo, backgroundColor: '#EAF4EF' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: color.borde, borderRadius: 8, paddingHorizontal: 10, height: 36, minWidth: 280, backgroundColor: color.superficie },
  botonAfinar: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  botonAfinarOn: { borderColor: color.primarioProfundo, backgroundColor: '#EAF4EF' },
  contador: { minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primarioProfundo },
  chevronCerrado: { transform: [{ rotate: '-90deg' }] },
  barraSel: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, flexWrap: 'wrap', backgroundColor: '#EAF4EF', borderRadius: radio.md, paddingHorizontal: espacio.base, paddingVertical: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F5F4F1' },
  th: { color: color.textoMedio, fontSize: 10, letterSpacing: 0.8 },
  filaTabla: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color.borde },
  filaActiva: { backgroundColor: '#EAF4EF' },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#BDB8B1', alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficie },
  checkOn: { backgroundColor: color.primarioProfundo, borderColor: color.primarioProfundo },
  pieTabla: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color.borde, flexWrap: 'wrap' },
  pagBtn: { minWidth: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pagActiva: { backgroundColor: color.primarioProfundo },
  lateral: { width: 300, borderLeftWidth: 1, borderLeftColor: color.borde, backgroundColor: color.superficie, padding: espacio.base, gap: espacio.md, overflow: 'hidden' },
  botonFicha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 8, backgroundColor: color.primarioProfundo },
  metrica: { flex: 1, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 2 },
  aguja: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  apoyo: { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10, gap: 4 },
  matriz: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 6 },
  matrizFila: { flexDirection: 'row', justifyContent: 'space-between' },
  celda: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 4 },
  celdaOk: { backgroundColor: color.primarioProfundo },
  celdaAlerta: { backgroundColor: '#F3DDD2' },
  celdaOmitido: { backgroundColor: '#D9D5CF' },
  celdaFuturo: { backgroundColor: '#EDEBE7' },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, paddingTop: 4 },
  puntoLeyenda: { width: 6, height: 6, borderRadius: 3 },
  identidad: { backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10, gap: 4, marginTop: 'auto' },
})

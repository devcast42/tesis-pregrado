/** Armazón del panel del investigador — implementa ESP-009 RF-009-03, RF-009-06.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA (barra lateral y superior comunes a
 *  las cinco pantallas).
 *
 *  Barra lateral con grupos (ESTUDIO / PERSONAS / MODELO / DATOS / MAESTROS),
 *  el filtro global (empresa + semanas + buscar código ⌘K) y el badge de
 *  pendientes en «Hoy». Barra superior con el estado de sincronización, la
 *  muestra activa y las acciones globales. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { router, usePathname } from 'expo-router'
import { supabase } from '../nucleo/supabase'
import { color, espacio, fuente, radio, texto } from '../nucleo/diseno'
import {
  IconoAjustes, IconoArchivo, IconoBarras, IconoCalendario, IconoChevronAbajo, IconoCredencial, IconoEquipo, IconoEscudoCheck,
  IconoGrafica, IconoHoja, IconoLupa, IconoMaletin, IconoNota, IconoPersona, IconoReloj, IconoSalir, IconoEnviar, IconoActualizar,
} from '../nucleo/iconos'
import { ProveedorFiltro, conFiltro, useFiltro } from '../investigador/filtro'
import { bandeja, participantes as listarParticipantes } from '../investigador/panel'
import { listarEmpresas, type Empresa } from './datos'

type Seccion = { ruta: string; titulo: string; grupo: string; icono: (c: string) => ReactNode; badge?: boolean }

const SECCIONES: Seccion[] = [
  { ruta: '/investigador/hoy', titulo: 'Hoy', grupo: 'ESTUDIO', icono: (c) => <IconoReloj tamano={16} color={c} />, badge: true },
  { ruta: '/investigador', titulo: 'Resumen', grupo: 'ESTUDIO', icono: (c) => <IconoBarras tamano={16} color={c} /> },
  { ruta: '/investigador/cohorte', titulo: 'Cohorte', grupo: 'ESTUDIO', icono: (c) => <IconoEquipo tamano={16} color={c} /> },
  { ruta: '/investigador/participantes', titulo: 'Participantes', grupo: 'PERSONAS', icono: (c) => <IconoCredencial tamano={16} color={c} /> },
  { ruta: '/investigador/derivaciones', titulo: 'Derivaciones', grupo: 'PERSONAS', icono: (c) => <IconoNota tamano={16} color={c} /> },
  { ruta: '/investigador/versiones', titulo: 'Versiones', grupo: 'MODELO', icono: (c) => <IconoAjustes tamano={15} color={c} /> },
  { ruta: '/investigador/desempeno', titulo: 'Desempeño', grupo: 'MODELO', icono: (c) => <IconoGrafica tamano={16} color={c} /> },
  { ruta: '/investigador/exportacion', titulo: 'Exportación', grupo: 'DATOS', icono: (c) => <IconoArchivo tamano={16} color={c} /> },
  { ruta: '/investigador/auditoria', titulo: 'Auditoría', grupo: 'DATOS', icono: (c) => <IconoEscudoCheck tamano={16} color={c} /> },
  { ruta: '/investigador/empresas', titulo: 'Empresas', grupo: 'MAESTROS', icono: (c) => <IconoMaletin tamano={16} color={c} /> },
  { ruta: '/investigador/psicologos', titulo: 'Psicólogos', grupo: 'MAESTROS', icono: (c) => <IconoPersona tamano={16} color={c} /> },
]
const GRUPOS = ['ESTUDIO', 'PERSONAS', 'MODELO', 'DATOS', 'MAESTROS']

async function salir() {
  await supabase.auth.signOut()
  router.replace('/acceso')
}

/** Cada pantalla monta su propio Panel: el desplazamiento de la navegación
 *  se guarda fuera del componente para que al cambiar de sección no vuelva arriba. */
let desplazamientoNav = 0

export function PanelInvestigador({ children, sinBarraSuperior = false }: { children: ReactNode; sinBarraSuperior?: boolean }) {
  return (
    <ProveedorFiltro>
      <Armazon sinBarraSuperior={sinBarraSuperior}>{children}</Armazon>
    </ProveedorFiltro>
  )
}

function Armazon({ children, sinBarraSuperior }: { children: ReactNode; sinBarraSuperior: boolean }) {
  const { width } = useWindowDimensions()
  const angosto = width < 1024
  const ruta = usePathname()
  const { filtro, fijar } = useFiltro()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [pendientes, setPendientes] = useState(0)
  const [correo, setCorreo] = useState('')
  const nav = useRef<ScrollView>(null)
  const [menuEmpresa, setMenuEmpresa] = useState(false)
  const [menuSemanas, setMenuSemanas] = useState(false)
  const [buscador, setBuscador] = useState(false)

  useEffect(() => {
    listarEmpresas().then(setEmpresas).catch(() => {})
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user.email ?? ''))
  }, [])
  useEffect(() => {
    bandeja(filtro).then((b) => setPendientes(b.length)).catch(() => {})
  }, [filtro.organizacion_id, ruta])

  // ⌘K / Ctrl+K abre la búsqueda por código desde cualquier pantalla.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const h = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); setBuscador(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const ir = (r: string) => router.push(conFiltro(r, filtro) as never)
  const empresaActual = empresas.find((e) => e.id === filtro.organizacion_id)?.nombre ?? 'Todas las empresas'
  const activa = (s: Seccion) => s.ruta === '/investigador' ? ruta === '/investigador' : ruta.startsWith(s.ruta)

  const enlaces = (compacto: boolean) => SECCIONES.map((s) => {
    const on = activa(s)
    const tinta = on ? '#FFFFFF' : color.texto
    return (
      <Pressable key={s.ruta} onPress={() => ir(s.ruta)} accessibilityRole="link" accessibilityState={{ selected: on }}
        style={[e.enlace, compacto && e.enlaceCompacto, on && e.enlaceActivo]}>
        {s.icono(tinta)}
        <Text style={[texto.apoyo, { color: tinta, flex: compacto ? undefined : 1 }, on && { fontFamily: fuente.media }]}>{s.titulo}</Text>
        {s.badge && pendientes > 0 && (
          <View style={[e.badge, on && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[texto.insignia, { color: on ? '#FFFFFF' : '#FFFFFF' }]}>{pendientes}</Text>
          </View>
        )}
      </Pressable>
    )
  })

  const filtros = (
    <View style={e.filtros}>
      {/* Cada selector lleva su zIndex: en web el menú desplegado debe quedar sobre lo que sigue. */}
      <View style={{ zIndex: menuEmpresa ? 30 : 1 }}>
        <Pressable onPress={() => { setMenuEmpresa((v) => !v); setMenuSemanas(false) }} style={e.selector} accessibilityRole="button">
          <Text style={[texto.apoyo, { color: color.texto, flex: 1 }]} numberOfLines={1}>{empresaActual}</Text>
          <IconoChevronAbajo tamano={16} color={color.textoMedio} />
        </Pressable>
        {menuEmpresa && (
          <View style={e.menu}>
            <Pressable onPress={() => { fijar({ organizacion_id: null }); setMenuEmpresa(false) }} style={e.menuItem}>
              <Text style={[texto.apoyo, { color: filtro.organizacion_id ? color.texto : color.primarioProfundo }]}>Todas las empresas</Text>
            </Pressable>
            {empresas.map((em) => (
              <Pressable key={em.id} onPress={() => { fijar({ organizacion_id: em.id }); setMenuEmpresa(false) }} style={e.menuItem}>
                <Text style={[texto.apoyo, { color: filtro.organizacion_id === em.id ? color.primarioProfundo : color.texto }]}>{em.nombre}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View style={{ zIndex: menuSemanas ? 30 : 1 }}>
        <Pressable onPress={() => { setMenuSemanas((v) => !v); setMenuEmpresa(false) }} style={e.selector} accessibilityRole="button">
          <Text style={[texto.apoyo, { color: color.texto, flex: 1 }]}>Semanas {filtro.semanaDesde} → {filtro.semanaHasta}</Text>
          <IconoCalendario tamano={14} color={color.textoMedio} />
        </Pressable>
        {menuSemanas && (
          <View style={e.menu}>
            {[[1, 6], [1, 3], [4, 6], [5, 6], [6, 6]].map(([a, b]) => (
              <Pressable key={`${a}-${b}`} onPress={() => { fijar({ semanaDesde: a, semanaHasta: b }); setMenuSemanas(false) }} style={e.menuItem}>
                <Text style={[texto.apoyo, { color: filtro.semanaDesde === a && filtro.semanaHasta === b ? color.primarioProfundo : color.texto }]}>
                  {a === b ? `Semana ${a}` : `Semanas ${a} → ${b}`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Pressable onPress={() => setBuscador(true)} style={[e.selector, { backgroundColor: '#F5F4F1' }]} accessibilityRole="button">
        <IconoLupa tamano={14} color={color.textoSuave} />
        <Text style={[texto.apoyo, { color: color.textoSuave, flex: 1 }]}>Buscar código…</Text>
        <View style={e.kbd}><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>⌘K</Text></View>
      </Pressable>
    </View>
  )

  const marca = (
    <View style={e.marcaBloque}>
      <IconoHoja tamano={22} color={color.primario} />
      <View>
        <Text style={[texto.seccion, { color: color.primarioProfundo, fontSize: 17, lineHeight: 21 }]}>Bienestar{'\n'}Tech</Text>
        <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10 }]}>UNT · LAB SALUD</Text>
      </View>
    </View>
  )

  if (angosto) {
    return (
      <View style={e.contenedorVertical}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.barraTop}>
          <View style={e.filaEnlaces}>{enlaces(true)}<Pressable onPress={salir} style={e.enlaceCompacto}><Text style={texto.apoyo}>Cerrar sesión</Text></Pressable></View>
        </ScrollView>
        <View style={e.contenido}>{children}</View>
        <Buscador visible={buscador} onCerrar={() => setBuscador(false)} />
      </View>
    )
  }

  return (
    <View style={e.contenedor}>
      <View style={e.barra} nativeID="panel-nav">
        {marca}
        <View style={e.pastillaPortal}><Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10 }]}>PORTAL INVESTIGADOR PRINCIPAL</Text></View>
        {filtros}
        <ScrollView
          ref={nav} style={{ flex: 1 }} contentContainerStyle={{ gap: espacio.md }} scrollEventThrottle={100}
          onScroll={(ev) => { desplazamientoNav = ev.nativeEvent.contentOffset.y }}
          onLayout={() => { if (desplazamientoNav > 0) nav.current?.scrollTo({ y: desplazamientoNav, animated: false }) }}>
          {GRUPOS.map((g) => (
            <View key={g} style={e.grupo}>
              <Text style={[texto.etiqueta, e.encabezadoGrupo]}>{g}</Text>
              {SECCIONES.filter((s) => s.grupo === g).map((s) => {
                const on = activa(s)
                const tinta = on ? '#FFFFFF' : color.texto
                return (
                  <Pressable key={s.ruta} onPress={() => ir(s.ruta)} accessibilityRole="link" accessibilityState={{ selected: on }}
                    style={[e.enlace, on && e.enlaceActivo]}>
                    {s.icono(tinta)}
                    <Text style={[texto.apoyo, { color: tinta, flex: 1 }, on && { fontFamily: fuente.media }]}>{s.titulo}</Text>
                    {s.badge && pendientes > 0 && (
                      <View style={e.badge}><Text style={[texto.insignia, { color: '#FFFFFF' }]}>{pendientes}</Text></View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          ))}
        </ScrollView>
        <View style={e.pie}>
          <View style={e.identidadPie}>
            <View style={e.avatarChico}><IconoPersona tamano={14} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[texto.datoFuerte, { color: color.texto }]} numberOfLines={1}>Investigador principal</Text>
              <Text style={[texto.dato, { color: color.textoSuave }]} numberOfLines={1}>{correo || '—'}</Text>
            </View>
            <Pressable onPress={salir} accessibilityRole="button" accessibilityLabel="Cerrar sesión" hitSlop={8}>
              <IconoSalir tamano={18} color={color.textoMedio} />
            </Pressable>
          </View>
          <View style={[e.fila, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
            <Text style={[texto.dato, { color: color.textoSuave, fontSize: 10, letterSpacing: 1 }]}>PROTOCOLO ÉTICO</Text>
            <Text style={[e.mono, { color: color.textoMedio }]}>ESP-009</Text>
          </View>
        </View>
      </View>

      <View style={e.contenido}>
        {!sinBarraSuperior && <View nativeID="panel-top"><BarraSuperiorInvestigador /></View>}
        {children}
      </View>
      <Buscador visible={buscador} onCerrar={() => setBuscador(false)} />
    </View>
  )
}

/** Barra superior: sincronización, muestra activa y acciones globales. */
export function BarraSuperiorInvestigador() {
  const { filtro } = useFiltro()
  const ruta = usePathname()
  const [activos, setActivos] = useState<number | null>(null)
  const [hora, setHora] = useState(new Date())
  useEffect(() => {
    listarParticipantes(filtro).then((p) => setActivos(p.filter((x) => x.estado === 'activo').length)).catch(() => {})
    setHora(new Date())
  }, [filtro.organizacion_id])
  return (
    <View style={e.barraSuperior}>
      <View style={[e.fila, { gap: 8 }]}>
        <View style={e.puntoVerde} />
        <Text style={[e.mono, { color: color.textoMedio }]}>Base de datos sincronizada: Hoy {hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })} PET</Text>
      </View>
      <View style={e.separador} />
      <Text style={[texto.dato, { color: color.textoMedio }]}>Muestra activa: <Text style={texto.datoFuerte}>{activos ?? '—'} profesionales</Text></Text>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => router.replace(conFiltro(ruta, filtro) as never)} style={e.botonBorde} accessibilityRole="button">
        <IconoActualizar tamano={14} color={color.texto} />
        <Text style={[texto.datoFuerte, { color: color.texto }]}>Actualizar</Text>
      </Pressable>
      <Pressable onPress={() => router.push(conFiltro('/investigador/exportacion', filtro) as never)} style={e.botonLleno} accessibilityRole="button">
        <IconoEnviar tamano={13} color="#FFFFFF" />
        <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>Exportar Corte</Text>
      </Pressable>
      <View style={e.avatar}><IconoPersona tamano={14} color="#FFFFFF" /></View>
    </View>
  )
}

/** Búsqueda global por código (⌘K). */
function Buscador({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  const { filtro } = useFiltro()
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<{ id: string; codigo_anonimo: string; organizacion: string; estado: string }[]>([])
  const buscar = useCallback(async (t: string) => {
    setQ(t)
    if (t.trim().length < 2) return setResultados([])
    const { data } = await supabase.from('panel_participantes_v2').select('id, codigo_anonimo, organizacion, estado').ilike('codigo_anonimo', `%${t.trim()}%`).limit(8)
    setResultados((data ?? []) as any)
  }, [])
  if (!visible) return null
  return (
    <Modal transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={e.velo} onPress={onCerrar}>
        <Pressable style={e.buscador} onPress={() => {}}>
          <View style={[e.fila, { gap: 10 }]}>
            <IconoLupa tamano={18} color={color.textoMedio} />
            <TextInput autoFocus value={q} onChangeText={buscar} placeholder="Buscar por código (ej. P-042)" placeholderTextColor={color.textoSuave}
              style={[texto.cuerpo, { flex: 1, color: color.texto, paddingVertical: 8 }]} autoCapitalize="characters" autoCorrect={false}
              onSubmitEditing={() => { if (resultados[0]) { onCerrar(); router.push(conFiltro(`/investigador/participante/${resultados[0].id}`, filtro) as never) } }} />
            <View style={e.kbd}><Text style={[texto.dato, { color: color.textoMedio, fontSize: 10 }]}>ESC</Text></View>
          </View>
          {resultados.map((r) => (
            <Pressable key={r.id} onPress={() => { onCerrar(); router.push(conFiltro(`/investigador/participante/${r.id}`, filtro) as never) }} style={e.resultado}>
              <Text style={[e.mono, { color: color.primarioProfundo, fontWeight: '600' }]}>{r.codigo_anonimo}</Text>
              <Text style={[texto.apoyo, { color: color.texto, flex: 1 }]}>{r.organizacion}</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>{r.estado}</Text>
            </Pressable>
          ))}
          {q.length >= 2 && resultados.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingTop: espacio.sm }]}>Sin coincidencias.</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const e = StyleSheet.create({
  contenedor: { flex: 1, flexDirection: 'row', backgroundColor: color.fondo, minHeight: 0 },
  contenedorVertical: { flex: 1, backgroundColor: color.fondo, minHeight: 0 },
  barra: { width: 260, paddingVertical: espacio.lg, paddingHorizontal: espacio.base, gap: espacio.md, borderRightWidth: 1, borderRightColor: color.borde, backgroundColor: color.superficie },
  barraTop: { borderBottomWidth: 1, borderBottomColor: color.borde, backgroundColor: color.superficie, flexGrow: 0 },
  filaEnlaces: { flexDirection: 'row', padding: espacio.sm, gap: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  marcaBloque: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: 4 },
  pastillaPortal: { alignSelf: 'flex-start', backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  filtros: { gap: 8, paddingBottom: espacio.sm, borderBottomWidth: 1, borderBottomColor: color.borde, zIndex: 10 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: color.borde, borderRadius: radio.sm, paddingHorizontal: 10, height: 36, backgroundColor: color.superficie },
  menu: { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: color.superficie, borderRadius: radio.sm, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 20, elevation: 6 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  kbd: { borderWidth: 1, borderColor: color.borde, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: color.superficie },
  grupo: { gap: 2 },
  encabezadoGrupo: { color: color.textoSuave, fontSize: 10, paddingHorizontal: 8, paddingBottom: 4 },
  enlace: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: radio.sm },
  enlaceCompacto: { minHeight: 36, paddingHorizontal: espacio.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  enlaceActivo: { backgroundColor: color.primario },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#B0532F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pie: { borderTopWidth: 1, borderTopColor: color.borde, paddingTop: espacio.md, gap: espacio.sm },
  identidadPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: 4 },
  avatarChico: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined, fontSize: 11 },
  contenido: { flex: 1, minHeight: 0, overflow: 'hidden' },
  barraSuperior: { height: 56, paddingHorizontal: espacio.lg, flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderBottomWidth: 1, borderBottomColor: color.borde },
  puntoVerde: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.primario },
  separador: { width: 1, height: 18, backgroundColor: color.borde },
  botonBorde: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: color.borde, borderRadius: radio.sm, paddingHorizontal: 12, height: 32, backgroundColor: color.superficie },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radio.sm, paddingHorizontal: 12, height: 32, backgroundColor: color.primarioProfundo },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  velo: { flex: 1, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', paddingTop: 120 },
  buscador: { width: 560, maxWidth: '92%', backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base, gap: 4, borderWidth: 1, borderColor: color.borde },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radio.sm },
})

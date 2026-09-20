/** Navegación lateral del panel web — implementa ESP-008.
 *
 *  Investigador y admin comparten el mismo armazón; solo cambia qué secciones
 *  aparecen. En pantallas angostas la barra pasa a ser una fila superior
 *  desplazable: el panel es de escritorio, pero no debe romperse en una
 *  tablet.
 *
 *  Las secciones no se ocultan por adorno — un admin no tiene ruta hacia
 *  Derivaciones ni Auditoría, y RLS lo respaldaría igual si la forzara. */

import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { usePathname, router } from 'expo-router'
import { supabase } from '../nucleo/supabase'
import { color, espacio, fuente, radio, texto } from '../nucleo/diseno'
import { Logo } from '../nucleo/Logo'
import {
  IconoAjustes, IconoArchivo, IconoCuadricula, IconoEquipo, IconoEscudoCheck, IconoGrafica, IconoHoja, IconoPersona, IconoSalir,
} from '../nucleo/iconos'
import type { Rol } from '../nucleo/rol'

async function salir() {
  await supabase.auth.signOut()
  router.replace('/acceso')
}

const TITULO_ROL: Record<'investigador' | 'admin', string> = {
  investigador: 'Investigador principal',
  admin: 'Administrador de empresa',
}

/** Quién está mirando. Importa más de lo que parece: este panel se demuestra
 *  en defensa de tesis con varias cuentas abiertas, y confundir la sesión del
 *  investigador con la de un admin da una impresión equivocada de lo que cada
 *  rol alcanza a ver. */
function BarraSuperior({ rol }: { rol: 'investigador' | 'admin' }) {
  const [correo, setCorreo] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCorreo(data.session?.user.email ?? '')
    })
  }, [])

  const inicial = correo.trim().charAt(0).toUpperCase() || '·'

  if (rol === 'admin') {
    return (
      <View style={e.barraSuperior}>
        <View style={e.identidad}>
          <View style={{ alignItems: 'flex-start', maxWidth: 210 }}>
            <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11, lineHeight: 13 }]}>Estudio</Text>
            <Text style={[texto.dato, { color: color.textoMedio, lineHeight: 16 }]} numberOfLines={2}>Académico Multicéntrico · Bienestar Laboral Tech</Text>
          </View>
          <View style={e.cohorte}>
            <View style={e.puntoVerde} />
            <Text style={[texto.datoFuerte, { color: color.texto }]}>Cohorte{'\n'}Activa</Text>
          </View>
          <View style={e.avatar}><IconoPersona tamano={14} color="#FFFFFF" /></View>
        </View>
      </View>
    )
  }

  return (
    <View style={e.barraSuperior}>
      <View style={e.identidad}>
        <View style={e.identidadTexto}>
          <Text style={[texto.apoyoFuerte, { color: color.texto }]} numberOfLines={1}>
            {correo || '—'}
          </Text>
          <Text style={[texto.dato, { color: color.textoSuave }]}>{TITULO_ROL[rol]}</Text>
        </View>
        <View style={e.avatar}>
          <Text style={[texto.apoyoFuerte, { color: '#FFFFFF' }]}>{inicial}</Text>
        </View>
      </View>
    </View>
  )
}

type Seccion = { ruta: string; titulo: string; grupo?: string; icono?: (c: string) => ReactNode }

const SECCIONES: Record<'investigador' | 'admin', Seccion[]> = {
  investigador: [
    { ruta: '/investigador', titulo: 'Resumen' },
    { ruta: '/investigador/participantes', titulo: 'Participantes' },
    { ruta: '/investigador/derivaciones', titulo: 'Derivaciones' },
    { ruta: '/investigador/empresas', titulo: 'Empresas', grupo: 'Maestros' },
    { ruta: '/investigador/psicologos', titulo: 'Psicólogos', grupo: 'Maestros' },
    { ruta: '/investigador/auditoria', titulo: 'Auditoría', grupo: 'Maestros' },
  ],
  admin: [
    { ruta: '/admin', titulo: 'Inicio', icono: (c) => <IconoCuadricula tamano={18} color={c} /> },
    { ruta: '/admin/pulso', titulo: 'Pulso', icono: (c) => <IconoGrafica tamano={18} color={c} /> },
    { ruta: '/admin/factores', titulo: 'Factores de trabajo', icono: (c) => <IconoAjustes tamano={16} color={c} /> },
    { ruta: '/admin/participantes', titulo: 'Personas y participación', icono: (c) => <IconoEquipo tamano={18} color={c} /> },
    { ruta: '/admin/informe', titulo: 'Informe mensual', icono: (c) => <IconoArchivo tamano={18} color={c} /> },
  ],
}

const ANCHO_ESCRITORIO = 1024

export function Panel({
  rol,
  children,
}: {
  rol: Extract<Rol, 'investigador' | 'admin'>
  children: ReactNode
}) {
  const { width } = useWindowDimensions()
  const horizontal = width < ANCHO_ESCRITORIO
  const secciones = SECCIONES[rol]
  const ruta = usePathname()

  const enlaces = secciones.map((s) => (
    <Enlace
      key={s.ruta}
      titulo={s.titulo}
      activo={ruta === s.ruta}
      compacto={horizontal}
      onPress={() => router.push(s.ruta as never)}
    />
  ))

  if (horizontal) {
    return (
      <View style={e.contenedorVertical}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.barraTop}>
          <View style={e.filaEnlaces}>
            {enlaces}
            <Enlace titulo="Cerrar sesión" activo={false} compacto onPress={salir} />
          </View>
        </ScrollView>
        <View style={e.contenido}>{children}</View>
      </View>
    )
  }

  // Agrupar en escritorio: los maestros van bajo su encabezado
  const sueltas = secciones.filter((s) => !s.grupo)
  const grupos = [...new Set(secciones.filter((s) => s.grupo).map((s) => s.grupo!))]

  return (
    <View style={e.contenedor}>
      <View style={e.barra} nativeID="panel-nav">
        <View style={e.marcaBloque}>
          {rol === 'admin' ? <IconoHoja tamano={24} color={color.primario} /> : <View style={e.marcaLogo}><Logo tamano={24} /></View>}
          <View>
            <Text style={[texto.seccion, { color: color.primarioProfundo, fontSize: 18, lineHeight: 22 }]}>Bienestar{'\n'}Tech</Text>
            <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10 }]}>{rol === 'admin' ? 'EMPRESA' : 'INVESTIGACIÓN'}</Text>
          </View>
        </View>
        <View style={e.pastillaPortal}>
          <Text style={[texto.datoFuerte, { color: color.textoMedio }]}>
            {rol === 'admin' ? 'Portal de Gestión Organizacional' : 'Panel del estudio'}
          </Text>
        </View>

        <View style={e.grupo}>
          {sueltas.map((s) => (
            <Enlace
              key={s.ruta}
              titulo={s.titulo}
              icono={s.icono}
              activo={ruta === s.ruta}
              onPress={() => router.push(s.ruta as never)}
            />
          ))}
        </View>

        {grupos.map((g) => (
          <View key={g} style={e.grupo}>
            <Text style={[texto.etiqueta, e.encabezadoGrupo]}>{g}</Text>
            {secciones
              .filter((s) => s.grupo === g)
              .map((s) => (
                <Enlace
                  key={s.ruta}
                  titulo={s.titulo}
                  activo={ruta === s.ruta}
                  onPress={() => router.push(s.ruta as never)}
                />
              ))}
          </View>
        ))}

        <View style={e.pie}>
          {rol === 'admin' && (
            <View style={e.garantia}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[texto.etiqueta, { color: color.primarioProfundo, flex: 1 }]}>GARANTÍA ÉTICA</Text>
                <IconoEscudoCheck tamano={13} color={color.primarioProfundo} />
              </View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>
                Datos agregados (k ≥ 10). Resguardo irrestricto de confidencialidad e identidad participante.
              </Text>
            </View>
          )}
          <Identidad rol={rol} />
        </View>
      </View>

      <View style={e.contenido}>
        <View nativeID="panel-top"><BarraSuperior rol={rol} /></View>
        {children}
      </View>
    </View>
  )
}

/** Correo, rol y salida, al pie de la barra (diseño Figma 3fRKKoY8Urkjlh1KQkPC9x). */
function Identidad({ rol }: { rol: 'investigador' | 'admin' }) {
  const [correo, setCorreo] = useState('')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user.email ?? ''))
  }, [])
  return (
    <View style={e.identidadPie}>
      <View style={e.avatarChico}><IconoPersona tamano={14} color="#FFFFFF" /></View>
      <View style={{ flex: 1 }}>
        <Text style={[texto.datoFuerte, { color: color.texto }]} numberOfLines={1}>{rol === 'admin' ? 'Admin Institucional' : 'Investigador'}</Text>
        <Text style={[texto.dato, { color: color.textoSuave }]} numberOfLines={1}>{rol === 'admin' ? 'Tech Lead / RR.HH.' : (correo || '—')}</Text>
      </View>
      <Pressable onPress={salir} accessibilityRole="button" accessibilityLabel="Cerrar sesión" hitSlop={8}>
        <IconoSalir tamano={18} color={color.textoMedio} />
      </Pressable>
    </View>
  )
}

function Enlace({
  titulo,
  activo,
  onPress,
  compacto,
  icono,
}: {
  titulo: string
  activo: boolean
  onPress: () => void
  compacto?: boolean
  icono?: (c: string) => ReactNode
}) {
  const tinta = activo ? '#FFFFFF' : color.textoMedio
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        e.enlace,
        compacto && e.enlaceCompacto,
        activo && e.enlaceActivo,
        pressed && !activo && e.enlacePresionado,
      ]}
    >
      {icono && !compacto && icono(tinta)}
      <Text
        style={[
          texto.apoyo,
          { color: tinta },
          activo && { fontFamily: fuente.media },
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  )
}

const e = StyleSheet.create({
  contenedor: { flex: 1, flexDirection: 'row', backgroundColor: color.fondo, minHeight: 0 },
  contenedorVertical: { flex: 1, backgroundColor: color.fondo, minHeight: 0 },
  barra: {
    width: 232,
    paddingVertical: espacio.lg,
    paddingHorizontal: espacio.md,
    gap: espacio.lg,
    borderRightWidth: 1,
    borderRightColor: color.borde,
    backgroundColor: color.superficie,
  },
  barraTop: {
    borderBottomWidth: 1,
    borderBottomColor: color.borde,
    backgroundColor: color.superficie,
    flexGrow: 0,
  },
  filaEnlaces: { flexDirection: 'row', padding: espacio.sm, gap: espacio.xs },
  marca: { color: color.primario, paddingHorizontal: espacio.md },
  marcaBloque: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: espacio.xs },
  marcaLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  pastillaPortal: { alignSelf: 'flex-start', backgroundColor: color.superficieSuave, borderRadius: radio.sm, paddingHorizontal: 10, paddingVertical: 5, marginTop: -espacio.sm },
  garantia: { backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.md, gap: 4, marginBottom: espacio.md },
  identidadPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingHorizontal: espacio.xs },
  avatarChico: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.primarioProfundo, alignItems: 'center', justifyContent: 'center' },
  grupo: { gap: 2 },
  encabezadoGrupo: {
    color: color.textoSuave,
    paddingHorizontal: espacio.md,
    paddingBottom: espacio.xs,
  },
  enlace: {
    minHeight: 42,
    flexDirection: 'row', alignItems: 'center', gap: espacio.sm,
    paddingHorizontal: espacio.md,
    borderRadius: radio.sm,
  },
  enlaceCompacto: { minHeight: 40, paddingHorizontal: espacio.base },
  enlaceActivo: { backgroundColor: color.primario },
  enlacePresionado: { backgroundColor: color.superficieSuave },
  pie: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: color.borde, paddingTop: espacio.md, gap: 0 },
  // minHeight: 0 no es un adorno. En web, un hijo flex arranca con
  // min-height:auto y se niega a encogerse por debajo de su contenido: el
  // ScrollView de dentro crecía hasta el alto del panel entero y nada
  // desplazaba, ni él ni la página. Con esto vuelve a tener un alto acotado
  // contra el que desplazar.
  contenido: { flex: 1, minHeight: 0, overflow: 'hidden' },
  barraSuperior: {
    height: 64,
    paddingHorizontal: espacio.lg,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: color.fondo,
  },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  cohorte: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.superficieSuave, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  puntoVerde: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.primario },
  identidadTexto: { alignItems: 'flex-end', gap: 1 },
  avatar: {
    width: 32, height: 32, borderRadius: radio.completo,
    backgroundColor: color.primario,
    alignItems: 'center', justifyContent: 'center',
  },
})

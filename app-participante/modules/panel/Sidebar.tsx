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

type Seccion = { ruta: string; titulo: string; grupo?: string }

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
    { ruta: '/admin', titulo: 'Mi empresa' },
    { ruta: '/admin/participantes', titulo: 'Participantes' },
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
      <View style={e.barra}>
        <Text style={[texto.etiqueta, e.marca]}>ESTUDIO BURNOUT</Text>

        <View style={e.grupo}>
          {sueltas.map((s) => (
            <Enlace
              key={s.ruta}
              titulo={s.titulo}
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
          <Enlace titulo="Cerrar sesión" activo={false} onPress={salir} />
        </View>
      </View>

      <View style={e.contenido}>
        <BarraSuperior rol={rol} />
        {children}
      </View>
    </View>
  )
}

function Enlace({
  titulo,
  activo,
  onPress,
  compacto,
}: {
  titulo: string
  activo: boolean
  onPress: () => void
  compacto?: boolean
}) {
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
      <Text
        style={[
          texto.cuerpo,
          { color: activo ? color.primario : color.textoMedio },
          activo && { fontFamily: fuente.fuerte },
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
  grupo: { gap: 2 },
  encabezadoGrupo: {
    color: color.textoSuave,
    paddingHorizontal: espacio.md,
    paddingBottom: espacio.xs,
  },
  enlace: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: espacio.md,
    borderRadius: radio.sm,
  },
  enlaceCompacto: { minHeight: 40, paddingHorizontal: espacio.base },
  enlaceActivo: { backgroundColor: color.primarioSuave },
  enlacePresionado: { backgroundColor: color.superficieSuave },
  pie: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: color.borde, paddingTop: espacio.md },
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
  identidadTexto: { alignItems: 'flex-end', gap: 1 },
  avatar: {
    width: 32, height: 32, borderRadius: radio.completo,
    backgroundColor: color.primario,
    alignItems: 'center', justifyContent: 'center',
  },
})

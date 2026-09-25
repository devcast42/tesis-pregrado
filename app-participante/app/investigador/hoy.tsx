/** Bandeja de operación diaria — implementa ESP-009 RF-009-01 … RF-009-03.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Hoy · Investigador Principal».
 *
 *  Una fila por pendiente, agrupadas por tipo con su regla metodológica.
 *  Cada fila tiene una acción y desaparece al resolverse. Las urgencias van
 *  en ámbar/tierra, nunca en rojo (RN-009-08). */

import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import { bandeja, fechaCorta, reasignarDerivacion, type Pendiente, type TipoPendiente } from '../../modules/investigador/panel'
import { listarPsicologos, type Psicologo } from '../../modules/panel/datos'
import { BotonChico, Caja, Cifra, Codigo, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoArchivo, IconoCampana, IconoCheckCirculo, IconoChevronAbajo, IconoCredencial, IconoEnviar, IconoEquipo, IconoEscudoCheck,
  IconoNota, IconoOjo, IconoReloj,
} from '../../modules/nucleo/iconos'

const GRUPOS: { tipo: TipoPendiente; titulo: string; etiqueta: string; tono: { fondo: string; tinta: string }; regla: string }[] = [
  { tipo: 'inactivo', titulo: 'Inactivos (4 días hábiles o más sin registro)', etiqueta: 'ATENCIÓN PRIORITARIA', tono: TONO.tierraSuave,
    regla: 'Regla metodológica: Riesgo de abandono del protocolo. Tras 4 días hábiles se solicita contacto discreto a RR.HH. sin revelar motivos de salud.' },
  { tipo: 'sin_viernes', titulo: 'Semanas sin viernes (OLBI incompleto)', etiqueta: 'BRECHA LONGITUDINAL', tono: TONO.gris,
    regla: 'Regla metodológica: Completaron check-ins de lun-jue pero omitieron el cuestionario multidimensional del viernes. Genera una ventana no censada en el modelo.' },
  { tipo: 'deteccion_sin_derivacion', titulo: 'Detecciones sin derivación (sin psicólogo disponible)', etiqueta: 'CAPACIDAD CLÍNICA', tono: TONO.tierraSuave,
    regla: 'Regla metodológica: Participante superó umbral de alerta el viernes pero la cohorte excedió cupos de psicólogos asignados.' },
  { tipo: 'derivacion_sin_sesion', titulo: 'Derivaciones sin sesión ≥ 7 días', etiqueta: 'ACOMPAÑAMIENTO', tono: TONO.gris,
    regla: 'Regla metodológica: Derivación emitida hace más de 7 días sin que se concrete la sesión de apoyo.' },
  { tipo: 'cita_sin_confirmar', titulo: 'Citas sin confirmar por el psicólogo ≥ 2 días', etiqueta: 'FLUJO CLÍNICO', tono: TONO.gris,
    regla: 'Regla metodológica: El participante solicitó franja horaria y espera confirmación.' },
  { tipo: 'informe_pendiente', titulo: 'Informes sin aprobar ≥ 7 días', etiqueta: 'CIERRE DOCUMENTAL', tono: TONO.gris,
    regla: 'Regla metodológica: Sesión realizada pero el borrador clínico aún no fue validado por el profesional.' },
  { tipo: 'consentimiento_pendiente', titulo: 'Consentimientos pendientes ≥ 7 días', etiqueta: 'PROTOCOLO ÉTICO', tono: TONO.gris,
    regla: 'Regla metodológica: Cuenta creada por la empresa pero el participante aún no firma el consentimiento informado.' },
]

type Orden = 'criticidad' | 'espera' | 'empresa'

export default function Hoy() {
  const { filtro } = useFiltro()
  const [items, setItems] = useState<Pendiente[] | null>(null)
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [plegados, setPlegados] = useState<Set<TipoPendiente>>(new Set())
  const [orden, setOrden] = useState<Orden>('criticidad')
  const [eleccion, setEleccion] = useState<Record<string, string>>({})
  const [menuPsi, setMenuPsi] = useState<string | null>(null)

  const cargar = useDatosDelFiltro(() => setItems(null), async (vigente) => {
    const [b, p] = await Promise.all([bandeja(filtro), listarPsicologos().catch(() => [])])
    if (!vigente()) return
    setItems(b); setPsicologos(p.filter((x) => x.activo))
  }, [filtro.organizacion_id])

  if (!items) return <Panel rol="investigador"><Cargando /></Panel>

  const porTipo = (t: TipoPendiente) => items.filter((i) => i.tipo === t)
  const criticas = porTipo('inactivo').length
  const porAsignar = porTipo('deteccion_sin_derivacion').length
  const citas = porTipo('cita_sin_confirmar').length
  const categorias = GRUPOS.filter((g) => porTipo(g.tipo).length > 0).length
  const gruposOrdenados = [...GRUPOS]
  if (orden === 'espera') gruposOrdenados.sort((a, b) => Math.max(0, ...porTipo(b.tipo).map((x) => x.dias)) - Math.max(0, ...porTipo(a.tipo).map((x) => x.dias)))
  const ahora = new Date()

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <Encabezado
          eyebrow={`${ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })} PET · RUTINA DIARIA  • Corte matutino · Muestra cohorte`}
          titulo="Bandeja de Operación Diaria · Hoy"
          subtitulo="Acciones inmediatas sobre el protocolo de campo para mantener la adherencia y vigilar las derivaciones sin sesgo diagnóstico."
          derecha={(
            <View style={e.fila}>
              <BotonChico onPress={() => setPlegados(new Set(items.length ? [] : GRUPOS.map((g) => g.tipo)))} icono={<IconoOjo tamano={14} color={color.texto} />}>
                {items.length === 0 ? 'Todo al día' : 'Ver estado "Todo al día"'}
              </BotonChico>
              <BotonChico onPress={() => router.push(conFiltro('/investigador/participantes', filtro) as never)} tono="verde" icono={<IconoEnviar tamano={13} color="#FFFFFF" />}>
                Despachar visibles
              </BotonChico>
            </View>
          )}
        />

        <View style={e.cifras}>
          <Cifra rotulo="Pendientes totales" valor={String(items.length)} nota={`en ${categorias} categorías`} icono={<IconoArchivo tamano={18} color={color.primarioProfundo} />} />
          <Cifra rotulo="Críticas de seguimiento" valor={String(criticas)} nota="inactivos > 4d" tinta="#8C4A2B" icono={<IconoReloj tamano={18} color="#8C4A2B" />} fondoIcono="#FBEDE6" />
          <Cifra rotulo="Derivaciones por asignar" valor={String(porAsignar)} nota="requiere cupo" tinta="#8C4A2B" icono={<IconoCredencial tamano={18} color="#8C4A2B" />} fondoIcono="#FBEDE6" />
          <Cifra rotulo="Citas del día" valor={citas === 0 ? '100%' : `${citas}`} nota={citas === 0 ? 'confirmadas' : 'sin confirmar'} tinta={color.primarioProfundo} icono={<IconoCheckCirculo tamano={18} color={color.primarioProfundo} />} />
        </View>

        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <View style={e.fila}>
            <Rotulo>Ordenar:</Rotulo>
            {([['criticidad', '! Mayor criticidad metodológica'], ['espera', 'Tiempo en espera'], ['empresa', 'Por organización']] as [Orden, string][]).map(([k, t]) => (
              <Pressable key={k} onPress={() => setOrden(k)} style={[e.chip, orden === k && e.chipActivo]}>
                <Text style={[texto.dato, { color: orden === k ? color.texto : color.textoMedio }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={e.fila}>
            <Pressable onPress={() => setPlegados(new Set())}><Text style={[texto.dato, { color: color.textoMedio }]}>⌃ Desplegar todos</Text></Pressable>
            <Pressable onPress={() => setPlegados(new Set(GRUPOS.map((g) => g.tipo)))}><Text style={[texto.dato, { color: color.textoMedio }]}>⌄ Plegar</Text></Pressable>
          </View>
        </View>

        {items.length === 0 && (
          <Caja suave>
            <View style={[e.fila, { alignItems: 'flex-start' }]}>
              <IconoCheckCirculo tamano={20} color={color.primarioProfundo} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Todo al día</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>No hay pendientes de operación con el filtro actual. Los umbrales de la bandeja están en ESP-009 §9.1.</Text>
              </View>
            </View>
          </Caja>
        )}

        {gruposOrdenados.map((g) => {
          const filas = porTipo(g.tipo)
          if (filas.length === 0) return null
          const plegado = plegados.has(g.tipo)
          const ordenadas = orden === 'empresa' ? [...filas].sort((a, b) => (a.empresa ?? '').localeCompare(b.empresa ?? '')) : filas
          return (
            <View key={g.tipo} style={e.grupo}>
              <Pressable onPress={() => setPlegados((s) => { const n = new Set(s); n.has(g.tipo) ? n.delete(g.tipo) : n.add(g.tipo); return n })} style={e.grupoCabecera}>
                <View style={[e.numero, { backgroundColor: g.tono.fondo }]}><Text style={[texto.datoFuerte, { color: g.tono.tinta }]}>{filas.length}</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={e.fila}>
                    <Text style={[texto.seccion, { color: color.texto, fontSize: 18 }]}>{g.titulo}</Text>
                    <Pastilla tono={g.tono}>{g.etiqueta}</Pastilla>
                  </View>
                  <Text style={[texto.apoyo, { color: color.textoMedio }]}>{g.regla}</Text>
                </View>
                <View style={{ transform: [{ rotate: plegado ? '-90deg' : '0deg' }] }}><IconoChevronAbajo tamano={20} color={color.textoMedio} /></View>
              </Pressable>
              {!plegado && ordenadas.map((p) => (
                <Fila key={`${p.tipo}-${p.referencia_id}`} p={p} psicologos={psicologos}
                  eleccion={eleccion[p.referencia_id]} onElegir={(id) => setEleccion((s) => ({ ...s, [p.referencia_id]: id }))}
                  menuAbierto={menuPsi === p.referencia_id} onMenu={() => setMenuPsi((m) => m === p.referencia_id ? null : p.referencia_id)}
                  onRecargar={cargar} filtroEmpresa={filtro.organizacion_id} />
              ))}
            </View>
          )
        })}

        <View style={e.resguardo}>
          <View style={[e.fila, { gap: 6 }]}>
            <IconoEscudoCheck tamano={16} color={color.primarioProfundo} />
            <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>Resguardo Metodológico y Privacidad Absoluta</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Cada acción de contacto hacia administradores de RR.HH. preserva el anonimato clínico: las alertas automáticas solo informan «incidencias técnicas en el registro» para salvaguardar la tranquilidad y confidencialidad del profesional conforme al protocolo ético del estudio.
          </Text>
        </View>
      </Pantalla>
    </Panel>
  )
}

function Fila({ p, psicologos, eleccion, onElegir, menuAbierto, onMenu, onRecargar, filtroEmpresa }: {
  p: Pendiente; psicologos: Psicologo[]; eleccion?: string; onElegir: (id: string) => void
  menuAbierto: boolean; onMenu: () => void; onRecargar: () => Promise<void>; filtroEmpresa: string | null
}) {
  const { filtro } = useFiltro()
  const ficha = () => router.push(conFiltro(`/investigador/participante/${p.participante_id}`, filtro) as never)
  const empresa = () => router.push(`/investigador/empresa/${p.organizacion_id}` as never)
  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  const dias = `${p.dias} ${p.dias === 1 ? 'día' : 'días'}`

  const detalle: Record<TipoPendiente, { pastilla: string; linea: string; tono?: { fondo: string; tinta: string } }> = {
    inactivo: { pastilla: `${dias} sin responder`, linea: `Último registro: ${p.desde ? fechaCorta(p.desde) : '—'} (check-in)`, tono: TONO.tierraSuave },
    sin_viernes: { pastilla: `Viernes ${fechaCorta(p.desde)}`, linea: 'Check-in L-J registrados  •  Viernes OLBI 0% (Faltante)' },
    deteccion_sin_derivacion: { pastilla: `Detección: ${fechaCorta(p.desde)}`, linea: 'Superó el umbral del viernes sin psicólogo con cupo.', tono: TONO.tierraSuave },
    derivacion_sin_sesion: { pastilla: `Derivado hace ${dias}`, linea: 'Estado: Participante no ha elegido horario en el calendario', tono: TONO.tierraSuave },
    cita_sin_confirmar: { pastilla: `Solicitada hace ${dias}`, linea: 'Franja elegida por el participante; espera confirmación del psicólogo', tono: TONO.tierraSuave },
    informe_pendiente: { pastilla: `Borrador pendiente hace ${dias}`, linea: 'Faltan notas estructuradas de intervención', tono: TONO.tierraSuave },
    consentimiento_pendiente: { pastilla: `Inscrito hace ${dias}`, linea: 'Enlace al protocolo sin abrir  •  Consentimiento informado pendiente' },
  }
  const d = detalle[p.tipo]

  const accion = (() => {
    switch (p.tipo) {
      case 'inactivo': return (
        <>
          <BotonChico onPress={ficha}>Ver ficha</BotonChico>
          <BotonChico tono="tierra" onPress={empresa} icono={<IconoEnviar tamano={12} color="#FFFFFF" />}>Pedir contacto al admin</BotonChico>
        </>
      )
      case 'sin_viernes': return <BotonChico tono="suave" onPress={() => aviso('Ventana de gracia', 'El viernes admite 2 días de gracia (sábado y domingo). Pasado ese plazo la semana queda sin OLBI; el participante puede seguir con la siguiente.')} icono={<IconoReloj tamano={13} color={color.texto} />}>Habilitar ventana de gracia (24h)</BotonChico>
      case 'deteccion_sin_derivacion': return (
        <View style={{ gap: 6, minWidth: 220 }}>
          <View>
            <Pressable onPress={onMenu} style={e.selector}><Text style={[texto.apoyo, { color: eleccion ? color.texto : color.textoSuave, flex: 1 }]}>{psicologos.find((x) => x.id === eleccion)?.nombre ?? 'Seleccionar profesional…'}</Text><IconoChevronAbajo tamano={16} color={color.textoMedio} /></Pressable>
            {menuAbierto && (
              <View style={e.menu}>
                {psicologos.map((ps) => <Pressable key={ps.id} onPress={() => { onElegir(ps.id); onMenu() }} style={e.menuItem}><Text style={texto.apoyo}>{ps.nombre}</Text></Pressable>)}
                {psicologos.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, padding: 10 }]}>No hay psicólogos activos.</Text>}
              </View>
            )}
          </View>
          <BotonChico tono="verde" onPress={() => aviso('Asignar psicólogo', 'La derivación se crea automáticamente al detectar cuando hay psicólogos activos. Da de alta o reactiva un psicólogo en Maestros → Psicólogos y la próxima evaluación derivará.')} icono={<IconoEquipo tamano={13} color="#FFFFFF" />}>Asignar psicólogo ahora</BotonChico>
        </View>
      )
      case 'derivacion_sin_sesion': return <BotonChico tono="suave" onPress={() => aviso('Recordatorio', 'El participante recibirá su recordatorio en la app en el próximo ciclo. Para contactarlo por otra vía, pide el contacto al admin de su empresa desde la ficha.')} icono={<IconoCampana tamano={13} color={color.texto} />}>Enviar recordatorio push discreto</BotonChico>
      case 'cita_sin_confirmar': return <BotonChico tono="suave" onPress={() => aviso('Reiterar al psicólogo', 'El psicólogo ve la cita en su lista de casos como «Cita por confirmar». Puedes reasignarla desde la ficha si no responde.')} icono={<IconoEnviar tamano={13} color={color.texto} />}>Reiterar al psicólogo</BotonChico>
      case 'informe_pendiente': return <BotonChico tono="suave" onPress={() => aviso('Aviso de cierre', 'El psicólogo tiene el borrador en su app como «Informe por aprobar». Este panel nunca muestra su contenido (RN-009-03).')} icono={<IconoNota tamano={13} color={color.texto} />}>Aviso de cierre de semana</BotonChico>
      case 'consentimiento_pendiente': return <BotonChico tono="suave" onPress={empresa} icono={<IconoEnviar tamano={13} color={color.texto} />}>Reenviar invitación institucional</BotonChico>
    }
  })()

  return (
    <View style={e.filaPendiente}>
      <View style={e.codigoCaja}><Codigo>{p.codigo_anonimo}</Codigo></View>
      <View style={{ flex: 1, gap: 4, minWidth: 260 }}>
        <View style={e.fila}>
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{p.empresa ?? '—'}</Text>
          <Pastilla tono={d.tono ?? TONO.gris}>{d.pastilla}</Pastilla>
        </View>
        {p.tipo === 'deteccion_sin_derivacion' ? (
          <View style={[e.fila, { gap: 6 }]}>
            <Text style={[texto.dato, { color: color.textoMedio }]}>Puntajes de corte:</Text>
            <Mono tono="#8C4A2B">ver ficha ›</Mono>
          </View>
        ) : (
          <Text style={[texto.apoyo, { color: p.tipo === 'inactivo' || p.tipo === 'derivacion_sin_sesion' ? color.textoMedio : color.textoMedio }]}>
            {p.tipo === 'sin_viernes' ? <><Text style={{ color: color.primarioProfundo }}>Check-in L-J registrados</Text>  •  <Text style={{ color: '#8C4A2B' }}>Viernes OLBI 0% (Faltante)</Text></> : d.linea}
          </Text>
        )}
      </View>
      <View style={[e.fila, { justifyContent: 'flex-end' }]}>{accion}</View>
    </View>
  )
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cifras: { flexDirection: 'row', gap: espacio.md, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  chipActivo: { backgroundColor: '#EDEBE7' },
  grupo: { gap: espacio.sm },
  grupoCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.base },
  numero: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  filaPendiente: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base, borderWidth: 1, borderColor: '#EEECE8', flexWrap: 'wrap' },
  codigoCaja: { backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, minWidth: 54, alignItems: 'center' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: color.borde, borderRadius: 8, paddingHorizontal: 10, height: 36, backgroundColor: color.superficie },
  menu: { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: color.superficie, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 20, elevation: 6 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  resguardo: { backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: espacio.base, gap: 6 },
})

/** Bandeja de operación diaria — implementa ESP-009 RF-009-01 … RF-009-03.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Hoy · Investigador Principal».
 *
 *  Un grupo por tipo de pendiente, y dentro una fila por caso. Cada grupo
 *  dice tres cosas: qué es, por qué está aquí y qué puede hacer quien lo
 *  lee. Antes decía «Regla metodológica: Riesgo de abandono del protocolo.
 *  Tras 4 días hábiles se solicita contacto discreto a RR.HH.», que es la
 *  misma idea escrita para un comité.
 *
 *  Los botones son enlaces —a la ficha, a la empresa, a Psicólogos—, que es
 *  lo que pide RF-009-02. Antes prometían «Enviar recordatorio push
 *  discreto», «Reiterar al psicólogo», «Habilitar ventana de gracia» o
 *  «Asignar psicólogo ahora», y ninguno de los cuatro hacía nada: abrían un
 *  aviso explicando por qué no se podía. En una demostración, el primer
 *  clic del jurado lo descubre.
 *
 *  Las urgencias van en ámbar/tierra, nunca en rojo (RN-009-08). */

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import { bandeja, fechaCorta, type Pendiente, type TipoPendiente } from '../../modules/investigador/panel'
import { BotonChico, Caja, Cifra, Codigo, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoArchivo, IconoCheckCirculo, IconoChevronAbajo, IconoEquipo, IconoEscudoCheck, IconoPersona, IconoReloj,
} from '../../modules/nucleo/iconos'

const TIERRA = '#8C4A2B'

type Grupo = {
  tipo: TipoPendiente
  titulo: string
  /** Por qué este caso está en la bandeja. */
  porque: string
  /** Qué puede hacer de verdad quien lo lee. */
  puedes: string
  urgente?: boolean
}

const GRUPOS: Grupo[] = [
  {
    tipo: 'inactivo', urgente: true,
    titulo: 'Llevan cuatro días o más sin responder',
    porque: 'Siguen activas pero no han hecho ningún check-in en cuatro días seguidos de check-in (de lunes a jueves). Si sigue así, se pierden del estudio.',
    puedes: 'Abre su ficha para ver desde cuándo, o su empresa, que es donde está el administrador al que pedirle que la contacte. Él nunca sabe por qué.',
  },
  {
    tipo: 'deteccion_sin_derivacion', urgente: true,
    titulo: 'Cruzaron el umbral y se quedaron sin psicólogo',
    porque: 'El sistema las detectó, pero en ese momento no había ningún psicólogo activo a quien asignarlas.',
    puedes: 'Da de alta o reactiva a alguien en Psicólogos: a partir de ahí las detecciones vuelven a derivar solas. Las que ya están detectadas hay que asignarlas a mano desde Derivaciones.',
  },
  {
    tipo: 'derivacion_sin_sesion', urgente: true,
    titulo: 'Tienen psicólogo hace más de una semana y aún no se han visto',
    porque: 'La derivación se abrió hace siete días o más y la sesión no llega.',
    puedes: 'Abre su ficha para ver si falta que la persona elija horario o que el psicólogo confirme. Desde ahí también puedes pasarla a otro profesional.',
  },
  {
    tipo: 'cita_sin_confirmar', urgente: true,
    titulo: 'Pidieron cita y el psicólogo no la ha confirmado',
    porque: 'Propusieron una hora hace más de dos días y siguen esperando respuesta.',
    puedes: 'El psicólogo la tiene en su app como «cita por confirmar». Si no responde, cámbiale el profesional desde la ficha.',
  },
  {
    tipo: 'olbi_sin_contestar',
    titulo: 'Se les pidió el OLBI y no lo contestaron',
    porque: 'La app les ofreció el cuestionario —porque el modelo avisó, por sorteo, por llevar un mes sin medirse o tras un alta— y la semana se cerró sin respuesta. Si fue el modelo, esa alerta se queda sin comprobar.',
    puedes: 'No hay nada que reabrir: si vuelve a tocar, la app se lo ofrece otra vez. La alerta desaparece en cuanto contesta un OLBI.',
  },
  {
    tipo: 'informe_pendiente',
    titulo: 'Ya tuvieron su sesión y el informe sigue abierto',
    porque: 'El psicólogo no ha dado por bueno el borrador, y han pasado más de siete días desde la sesión.',
    puedes: 'Aquí no se ve lo que dice el informe, solo si está cerrado o no (RN-009-03). Lo cierra el psicólogo desde su app.',
  },
  {
    tipo: 'consentimiento_pendiente',
    titulo: 'Cuentas creadas que nadie ha aceptado',
    porque: 'La empresa dio de alta a la persona hace más de una semana y todavía no ha firmado el consentimiento, así que no ha empezado a responder.',
    puedes: 'Abre la empresa: su administrador puede volver a enviarle la invitación.',
  },
]

type Orden = 'urgencia' | 'empresa'

export default function Hoy() {
  const { filtro } = useFiltro()
  const [items, setItems] = useState<Pendiente[] | null>(null)
  const [plegados, setPlegados] = useState<Set<TipoPendiente>>(new Set())
  const [orden, setOrden] = useState<Orden>('urgencia')

  useDatosDelFiltro(() => setItems(null), async (vigente) => {
    const b = await bandeja(filtro)
    if (!vigente()) return
    setItems(b)
  }, [filtro.organizacion_id])

  if (!items) return <Panel rol="investigador"><Cargando /></Panel>

  const porTipo = (t: TipoPendiente) => items.filter((i) => i.tipo === t)
  const sinResponder = porTipo('inactivo').length
  const sinPsicologo = porTipo('deteccion_sin_derivacion').length
  const citasEsperando = porTipo('cita_sin_confirmar').length
  const conCasos = GRUPOS.filter((g) => porTipo(g.tipo).length > 0)
  const masViejo = (t: TipoPendiente) => Math.max(0, ...porTipo(t).map((x) => x.dias))
  // Primero lo que lleva más tiempo esperando; con «por empresa» el orden lo
  // marcan las filas, así que los grupos se dejan como están.
  const gruposOrdenados = orden === 'urgencia'
    ? [...conCasos].sort((a, b) => masViejo(b.tipo) - masViejo(a.tipo))
    : conCasos

  return (
    <Panel rol="investigador">
      <Pantalla ancho={ancho.panel}>
        <View style={{ gap: 6 }}>
          <Rotulo>Bandeja de hoy · ESP-009</Rotulo>
          <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>Lo que hay que mirar hoy</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 660 }]}>
            {items.length === 0
              ? 'Nada pendiente con el filtro puesto. Esta pantalla se llena sola cuando algo se sale de los plazos del protocolo.'
              : `${items.length} ${items.length === 1 ? 'cosa pendiente' : 'cosas pendientes'} en ${conCasos.length} ${conCasos.length === 1 ? 'categoría' : 'categorías'}. Cada una dice por qué está aquí y qué puedes hacer; ninguna se resuelve sola.`}
          </Text>
        </View>

        <View style={e.cifras}>
          <Cifra rotulo="Pendientes en total" valor={String(items.length)} nota={`en ${conCasos.length} ${conCasos.length === 1 ? 'categoría' : 'categorías'}`}
            icono={<IconoArchivo tamano={18} color={color.primarioProfundo} />} />
          <Cifra rotulo="Sin responder" valor={String(sinResponder)} nota="cuatro días o más"
            tinta={sinResponder ? TIERRA : color.texto} icono={<IconoReloj tamano={18} color={sinResponder ? TIERRA : color.primarioProfundo} />}
            fondoIcono={sinResponder ? '#FBEDE6' : '#EAF4EF'} />
          <Cifra rotulo="Esperando psicólogo" valor={String(sinPsicologo)} nota="detectadas, sin asignar"
            tinta={sinPsicologo ? TIERRA : color.texto} icono={<IconoEquipo tamano={18} color={sinPsicologo ? TIERRA : color.primarioProfundo} />}
            fondoIcono={sinPsicologo ? '#FBEDE6' : '#EAF4EF'} />
          <Cifra rotulo="Citas sin confirmar" valor={String(citasEsperando)} nota="dos días o más"
            tinta={citasEsperando ? TIERRA : color.texto} icono={<IconoPersona tamano={18} color={citasEsperando ? TIERRA : color.primarioProfundo} />}
            fondoIcono={citasEsperando ? '#FBEDE6' : '#EAF4EF'} />
        </View>

        {items.length > 0 && (
          <View style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={[e.fila, { gap: 6 }]}>
              <Rotulo>Ordenar</Rotulo>
              {([['urgencia', 'Lo que lleva más esperando'], ['empresa', 'Agrupado por empresa']] as [Orden, string][]).map(([k, t]) => (
                <Pressable key={k} onPress={() => setOrden(k)} style={[e.chip, orden === k && e.chipActivo]} accessibilityRole="button" accessibilityState={{ selected: orden === k }}>
                  <Text style={[texto.datoFuerte, { color: orden === k ? '#FFFFFF' : color.texto, fontSize: 12 }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setPlegados((s) => s.size ? new Set() : new Set(GRUPOS.map((g) => g.tipo)))} hitSlop={6} accessibilityRole="button">
              <Text style={[texto.dato, { color: color.primarioProfundo }]}>{plegados.size ? 'Abrir todos' : 'Cerrar todos'}</Text>
            </Pressable>
          </View>
        )}

        {items.length === 0 && (
          <Caja suave>
            <View style={[e.fila, { alignItems: 'flex-start' }]}>
              <IconoCheckCirculo tamano={20} color={color.primarioProfundo} />
              <View style={{ flex: 1, gap: 4, minWidth: 240 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Todo al día</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                  Nadie lleva cuatro días sin responder, no hay detecciones sin psicólogo y ninguna cita ni informe se ha quedado atrás. Los plazos que vigila esta bandeja están en ESP-009 §9.1.
                </Text>
              </View>
            </View>
          </Caja>
        )}

        {gruposOrdenados.map((g) => {
          const filas = porTipo(g.tipo)
          const plegado = plegados.has(g.tipo)
          const ordenadas = orden === 'empresa'
            ? [...filas].sort((a, b) => (a.empresa ?? '').localeCompare(b.empresa ?? '') || b.dias - a.dias)
            : [...filas].sort((a, b) => b.dias - a.dias)
          return (
            <View key={g.tipo} style={e.grupo}>
              <Pressable onPress={() => setPlegados((s) => { const n = new Set(s); n.has(g.tipo) ? n.delete(g.tipo) : n.add(g.tipo); return n })}
                style={e.grupoCabecera} accessibilityRole="button" accessibilityState={{ expanded: !plegado }}>
                <View style={[e.numero, { backgroundColor: g.urgente ? '#F3DDD2' : '#E4E1DC' }]}>
                  <Text style={[texto.datoFuerte, { color: g.urgente ? TIERRA : color.texto }]}>{filas.length}</Text>
                </View>
                <View style={{ flex: 1, gap: 3, minWidth: 240 }}>
                  <Text style={[texto.seccion, { color: color.texto, fontSize: 18 }]}>{g.titulo}</Text>
                  <Text style={[texto.apoyo, { color: color.textoMedio }]}>{g.porque}</Text>
                </View>
                <View style={plegado ? { transform: [{ rotate: '-90deg' }] } : undefined}><IconoChevronAbajo tamano={20} color={color.textoMedio} /></View>
              </Pressable>

              {!plegado && (
                <>
                  <View style={e.puedes}>
                    <Rotulo tinta={color.primarioProfundo}>Qué puedes hacer</Rotulo>
                    <Text style={[texto.dato, { color: color.texto }]}>{g.puedes}</Text>
                  </View>
                  {ordenadas.map((p) => <Fila key={`${p.tipo}-${p.referencia_id}`} p={p} />)}
                </>
              )}
            </View>
          )
        })}

        <View style={e.resguardo}>
          <View style={[e.fila, { gap: 6 }]}>
            <IconoEscudoCheck tamano={16} color={color.primarioProfundo} />
            <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>Lo que sabe la empresa</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Cuando hay que pedirle a un administrador que contacte a alguien, lo que recibe es un aviso de que esa persona lleva días sin registrar datos. Nunca sabe si fue detectada, ni qué contestó, ni si habló con un psicólogo.
          </Text>
        </View>
      </Pantalla>
    </Panel>
  )
}

/** Una fila = un caso. El botón dice a dónde lleva, no lo que ojalá hiciera. */
function Fila({ p }: { p: Pendiente }) {
  const { filtro } = useFiltro()
  const ficha = () => router.push(conFiltro(`/investigador/trabajador/${p.trabajador_id}`, filtro) as never)
  const empresa = () => router.push(`/investigador/empresa/${p.organizacion_id}` as never)
  const dias = `${p.dias} ${p.dias === 1 ? 'día' : 'días'}`

  const DETALLE: Record<TipoPendiente, { pastilla: string; linea: string; tierra?: boolean }> = {
    inactivo: { pastilla: `${dias} sin responder`, linea: `Su último check-in fue el ${p.desde ? fechaCorta(p.desde) : '—'}.`, tierra: true },
    olbi_sin_contestar: { pastilla: `Pedido el ${fechaCorta(p.desde)}`, linea: 'Se le ofreció el OLBI esa semana y no lo contestó.' },
    deteccion_sin_derivacion: { pastilla: `Detectada el ${fechaCorta(p.desde)}`, linea: 'Cruzó el umbral y no había ningún psicólogo activo a quien asignarla.', tierra: true },
    derivacion_sin_sesion: { pastilla: `Derivada hace ${dias}`, linea: 'Puede que falte elegir horario, que el psicólogo no lo haya confirmado o que la cita esté puesta más adelante; se ve en su ficha.', tierra: true },
    cita_sin_confirmar: { pastilla: `Pedida hace ${dias}`, linea: 'Eligió una hora y espera que el psicólogo la confirme.', tierra: true },
    informe_pendiente: { pastilla: `Abierto hace ${dias}`, linea: 'La sesión ya se hizo; falta que el psicólogo cierre el informe.', tierra: true },
    consentimiento_pendiente: { pastilla: `Creada hace ${dias}`, linea: 'No ha abierto el enlace del consentimiento, así que aún no participa.' },
  }
  const d = DETALLE[p.tipo]

  return (
    <View style={e.filaPendiente}>
      <View style={e.codigoCaja}><Codigo>{p.codigo_anonimo}</Codigo></View>
      <View style={{ flex: 1, gap: 4, minWidth: 240 }}>
        <View style={[e.fila, { gap: 6 }]}>
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{p.empresa ?? '—'}</Text>
          <Pastilla tono={d.tierra ? TONO.tierraSuave : TONO.gris}>{d.pastilla}</Pastilla>
        </View>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>{d.linea}</Text>
      </View>
      <View style={[e.fila, { justifyContent: 'flex-end', gap: 6 }]}>
        {p.tipo === 'consentimiento_pendiente'
          ? <BotonChico onPress={empresa}>Ver la empresa</BotonChico>
          : (
            <>
              <BotonChico onPress={ficha}>Ver su ficha</BotonChico>
              {p.tipo === 'inactivo' && <BotonChico onPress={empresa} tono="suave">Ver la empresa</BotonChico>}
              {p.tipo === 'deteccion_sin_derivacion' && <BotonChico onPress={() => router.push('/investigador/psicologos' as never)} tono="suave" icono={<IconoEquipo tamano={13} color={color.texto} />}>Ir a Psicólogos</BotonChico>}
            </>
          )}
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cifras: { flexDirection: 'row', gap: espacio.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1EFEB' },
  chipActivo: { backgroundColor: color.primarioProfundo },
  grupo: { gap: espacio.sm },
  grupoCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.base, flexWrap: 'wrap' },
  numero: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  puedes: { backgroundColor: '#EAF4EF', borderRadius: radio.sm, padding: 10, gap: 3 },
  filaPendiente: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.base, borderWidth: 1, borderColor: '#EEECE8', flexWrap: 'wrap' },
  codigoCaja: { backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, minWidth: 54, alignItems: 'center' },
  resguardo: { backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: espacio.base, gap: 6 },
})

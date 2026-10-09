/** Diálogo «Reasignar psicólogo» — ESP-009 RF-009-09 / RF-009-10.
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ, nodo 13:2.
 *
 *  Radio de psicólogos activos con su carga, motivo obligatorio y nota de
 *  privacidad. Sirve para una derivación (ficha) o varias (Derivaciones,
 *  salida de un psicólogo). */

import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { reasignarDerivacion } from './panel'
import { cargaDePsicologos, listarPsicologos, type Psicologo } from '../panel/datos'
import { Mono, Pastilla, TONO } from './piezas'
import { color, espacio, radio, texto, veloModal } from '../nucleo/diseno'
import { IconoCandado, IconoCheck, IconoCerrar, IconoChevronAbajo } from '../nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const CAPACIDAD = 4

export const MOTIVOS = [
  ['carga', 'Balance de carga asistencial'],
  ['disponibilidad', 'Psicólogo sin disponibilidad / licencia'],
  ['salida', 'Salida del psicólogo del estudio'],
  ['trabajador', 'Solicitud del trabajador'],
  ['idioma_afinidad', 'Afinidad o idioma con el trabajador'],
  ['otro', 'Otro (queda registrado como «otro»)'],
] as const

export type PedidoReasignacion = {
  /** Derivaciones a mover; una o varias. */
  derivaciones: string[]
  /** Código(s) para el título: «P-003» o «3 casos de Lic. X». */
  titulo: string
  /** Psicólogo actual (se excluye de la lista y se nombra en el texto). */
  actualId?: string | null
  actualNombre?: string | null
  /** Empresas de los casos a mover. Un psicólogo de empresa solo puede
   *  recibir casos de la suya; los generales, de cualquiera. */
  organizaciones?: string[]
}

/** ¿Puede este psicólogo recibir casos de todas estas empresas? */
export function puedeAtender(p: Psicologo, organizaciones: string[] = []): boolean {
  return !p.organizacion_id || organizaciones.every((o) => o === p.organizacion_id)
}

export function DialogoReasignar({ pedido, onCerrar, onHecho }: { pedido: PedidoReasignacion | null; onCerrar: () => void; onHecho: (nuevo: Psicologo) => void }) {
  const [psicologos, setPsicologos] = useState<Psicologo[]>([])
  const [carga, setCarga] = useState<Record<string, number>>({})
  const [elegido, setElegido] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [menuMotivo, setMenuMotivo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pedido) return
    setElegido(null); setMotivo(null); setError(null); setMenuMotivo(false)
    Promise.all([listarPsicologos().catch(() => [] as Psicologo[]), cargaDePsicologos().catch(() => ({}))]).then(([ps, c]) => { setPsicologos(ps.filter((p) => p.activo)); setCarga(c) })
  }, [pedido])

  if (!pedido) return null
  const candidatos = psicologos.filter((p) => p.id !== pedido.actualId && puedeAtender(p, pedido.organizaciones))
  const listo = !!elegido && !!motivo && !ocupado

  async function confirmar() {
    if (!listo || !elegido || !motivo) return
    setOcupado(true); setError(null)
    try {
      const texto = MOTIVOS.find((m) => m[0] === motivo)?.[1] ?? motivo
      for (const id of pedido!.derivaciones) await reasignarDerivacion(id, elegido, texto)
      onHecho(psicologos.find((p) => p.id === elegido)!)
    } catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo reasignar.') } finally { setOcupado(false) }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCerrar}>
      <View style={e.velo}>
        <View style={e.dialogo}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <Text style={[texto.seccion, { color: color.texto }]}>Reasignar psicólogo · <Text style={{ color: color.primarioProfundo, fontFamily: MONO }}>{pedido.titulo}</Text></Text>
            <Pressable onPress={onCerrar} hitSlop={8}><IconoCerrar tamano={14} color={color.textoMedio} /></Pressable>
          </View>
          <Text style={[texto.dato, { color: color.textoMedio }]}>
            Actualmente asignado a: <Text style={{ color: color.texto }}>{pedido.actualNombre ?? 'sin asignar'}</Text>. Las citas vigentes pasan automáticamente con la derivación y la acción queda asentada con motivo en el registro de auditoría.
          </Text>

          <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 10.5, letterSpacing: 1 }]}>SELECCIONE EL NUEVO PSICÓLOGO TRATANTE</Text>
          {candidatos.map((p) => {
            const n = carga[p.id] ?? 0, pct = Math.round((n / (CAPACIDAD + 2)) * 100)
            const on = elegido === p.id
            const estado = n === 0 ? `Capacidad disponible (100%)` : n <= 2 ? `Capacidad disponible (${100 - pct}%)` : n <= CAPACIDAD ? `Carga balanceada (${100 - pct}%)` : `Capacidad elevada (${100 - pct}%)`
            const tinta = n > CAPACIDAD ? '#8C4A2B' : n >= 3 ? '#B45309' : color.primarioProfundo
            return (
              <Pressable key={p.id} onPress={() => setElegido(p.id)} style={[e.opcion, on && e.opcionOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <View style={[e.radio, on && e.radioOn]}>{on && <View style={e.radioPunto} />}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[e.fila, { gap: 8 }]}><Text style={[texto.datoFuerte, { color: color.texto, fontSize: 13 }]}>{p.nombre}</Text><Mono tono={color.textoMedio}>{/^cpsp/i.test(p.colegiatura) ? p.colegiatura : `CPsP ${p.colegiatura}`}</Mono></View>
                  <View style={[e.fila, { gap: 5 }]}><View style={[e.punto, { backgroundColor: tinta }]} /><Text style={[texto.dato, { color: color.textoMedio }]}>{estado}</Text></View>
                </View>
                <Pastilla tono={n > CAPACIDAD ? TONO.tierraSuave : n >= 3 ? TONO.ambar : TONO.verde}>{`${n} ${n === 1 ? 'abierto' : 'abiertos'}`}</Pastilla>
              </Pressable>
            )
          })}
          {candidatos.length === 0 && <Text style={[texto.dato, { color: '#8C4A2B' }]}>No hay otro psicólogo activo. Crea o reactiva uno en Maestros → Psicólogos.</Text>}

          <View style={{ gap: 4, zIndex: 10 }}>
            <Text style={[texto.datoFuerte, { color: color.texto }]}>Motivo de reasignación <Text style={{ color: '#8C4A2B' }}>*</Text></Text>
            <Pressable onPress={() => setMenuMotivo((v) => !v)} style={e.selector}>
              <Text style={[texto.dato, { color: motivo ? color.texto : color.textoSuave, flex: 1 }]}>{motivo ? MOTIVOS.find((m) => m[0] === motivo)?.[1] : 'Seleccione el motivo de la derivación…'}</Text>
              <IconoChevronAbajo tamano={14} color={color.textoMedio} />
            </Pressable>
            {menuMotivo && (
              <View style={e.menu}>
                {MOTIVOS.map(([k, t]) => <Pressable key={k} onPress={() => { setMotivo(k); setMenuMotivo(false) }} style={e.menuItem}><Text style={[texto.dato, { color: motivo === k ? color.primarioProfundo : color.texto }]}>{t}</Text></Pressable>)}
              </View>
            )}
          </View>

          <View style={e.nota}>
            <IconoCandado tamano={13} color={color.primarioProfundo} />
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}><Text style={{ color: color.texto }}>Garantía de privacidad:</Text> esta acción transfiere la derivación seudonimizada y sus citas al nuevo profesional. No se exponen notas clínicas previas.</Text>
          </View>
          {error && <Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text>}

          <View style={[e.fila, { justifyContent: 'flex-end', gap: 8 }]}>
            <Pressable onPress={onCerrar} style={e.botonSuave}><Text style={[texto.datoFuerte, { color: color.texto }]}>Cancelar</Text></Pressable>
            <Pressable onPress={confirmar} disabled={!listo} style={[e.botonVerde, !listo && { opacity: 0.45 }]}>
              <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Reasignando…' : 'Confirmar reasignación'}</Text><IconoCheck tamano={10} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const e = StyleSheet.create({
  velo: { ...veloModal, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', justifyContent: 'center', padding: espacio.base },
  dialogo: { width: 440, maxWidth: '100%', backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.lg, gap: espacio.sm },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  opcionOn: { borderColor: color.primarioProfundo, borderWidth: 1.5, backgroundColor: '#F7FBF9' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#BDB8B1', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.primarioProfundo, backgroundColor: color.primarioProfundo },
  radioPunto: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  punto: { width: 6, height: 6, borderRadius: 3 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  menu: { position: 'absolute', top: 66, left: 0, right: 0, backgroundColor: color.superficie, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 20, elevation: 6 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 9 },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 12 },
  botonSuave: { height: 38, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F1EFEB', justifyContent: 'center' },
  botonVerde: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 16, borderRadius: 8, backgroundColor: color.primarioProfundo },
})

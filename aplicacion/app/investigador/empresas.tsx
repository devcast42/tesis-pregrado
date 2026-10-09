/** Maestro de empresas y umbrales organizacionales — ESP-008, ESP-009 RF-009-15 (RN-008-13).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Empresas · Investigador Principal».
 *
 *  Primero la lista, que es a lo que se entra; los cortes van plegados al
 *  final, porque se tocan dos veces al año y ocupaban media pantalla.
 *
 *  Los cortes del pulso por empresa son distintos de los individuales de
 *  ESP-003 y los fija el investigador; el admin de empresa no puede tocarlos.
 *  Al editarlos se ve cuántas empresas cambiarían de nivel antes de guardar. */

import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import { actualizarUmbral, pulsoPorEmpresa, umbralesEmpresa, type PulsoEmpresa, type UmbralEmpresa, adherenciaPorEmpresa, type AdherenciaEmpresa
} from '../../modules/investigador/panel'
import { listarEmpresasConConteos, type FilaEmpresa } from '../../modules/panel/datos'
import { DialogoEmpresa } from '../../modules/investigador/DialogoEmpresa'
import { BotonChico, Caja, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoAgregar, IconoAjustes, IconoEscudoCheck } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
const TIERRA = '#8C4A2B'
const AMBAR = '#B45309'
const MINIMO_REPORTE = 10

type Borrador = { a_vigilar: string; alto: string; fuente: string }

export default function Empresas() {
  const { filtro } = useFiltro()
  const [filas, setFilas] = useState<FilaEmpresa[] | null>(null)
  const [adherencia, setAdherencia] = useState<AdherenciaEmpresa[]>([])
  const [umbrales, setUmbrales] = useState<UmbralEmpresa[]>([])
  const [pulso, setPulso] = useState<PulsoEmpresa[]>([])
  const [borrador, setBorrador] = useState<Record<string, Borrador>>({})
  const [formulario, setFormulario] = useState(false)
  const [cortes, setCortes] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const [f, a, u, p] = await Promise.all([listarEmpresasConConteos(), adherenciaPorEmpresa().catch(() => [] as AdherenciaEmpresa[]), umbralesEmpresa(), pulsoPorEmpresa()])
    setFilas(f); setAdherencia(a); setUmbrales(u); setPulso(p)
    setBorrador(Object.fromEntries(u.map((x) => [x.dimension, { a_vigilar: Number(x.a_vigilar).toFixed(2), alto: Number(x.alto).toFixed(2), fuente: x.fuente }])))
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))
  useEffect(() => { if (mensaje?.tono === 'ok') { const t = setTimeout(() => setMensaje(null), 4000); return () => clearTimeout(t) } }, [mensaje])

  async function guardarUmbrales() {
    setOcupado(true); setMensaje(null)
    try {
      for (const u of umbrales) {
        const b = borrador[u.dimension]; if (!b) continue
        const av = Number(b.a_vigilar), al = Number(b.alto)
        if (Number.isNaN(av) || Number.isNaN(al)) throw new Error(`${nombreDim(u.dimension)}: los cortes deben ser números.`)
        if (!(al > av)) throw new Error(`${nombreDim(u.dimension)}: el corte «alto» debe ser mayor que «a vigilar».`)
        if (av < 1 || al > 4) throw new Error(`${nombreDim(u.dimension)}: los cortes van de 1.00 a 4.00.`)
        if (av !== Number(u.a_vigilar) || al !== Number(u.alto) || b.fuente !== u.fuente) await actualizarUmbral({ dimension: u.dimension, a_vigilar: av, alto: al, fuente: b.fuente })
      }
      await cargar(); setMensaje({ tono: 'ok', texto: 'Cortes guardados. El pulso de cada empresa se recalcula con ellos.' })
    } catch (ex) { setMensaje({ tono: 'error', texto: ex instanceof Error ? ex.message : 'No se pudieron guardar los cortes.' }) } finally { setOcupado(false) }
  }

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const totalActivos = filas.reduce((s, f) => s + f.en_seguimiento, 0)
  const nivelCon = (media: number | null, b: Borrador | undefined) => {
    if (media == null || !b) return null
    const av = Number(b.a_vigilar), al = Number(b.alto)
    return media >= al ? 'alto' : media >= av ? 'a_vigilar' : 'bajo'
  }
  const previa = (dim: 'agotamiento' | 'desvinculacion') => {
    const cuenta = { bajo: 0, a_vigilar: 0, alto: 0 }
    for (const p of pulso) { const n = nivelCon(dim === 'agotamiento' ? p.agotamiento : p.desvinculacion, borrador[dim]); if (n) cuenta[n]++ }
    return cuenta
  }
  const coherente = umbrales.every((u) => { const b = borrador[u.dimension]; return b && Number(b.alto) > Number(b.a_vigilar) && Number(b.a_vigilar) >= 1 && Number(b.alto) <= 4 })
  const hayCambios = umbrales.some((u) => { const b = borrador[u.dimension]; return b && (Number(b.a_vigilar) !== Number(u.a_vigilar) || Number(b.alto) !== Number(u.alto) || b.fuente !== u.fuente) })
  const previaAg = previa('agotamiento')
  // El nivel de la lista sale de los cortes GUARDADOS, no del borrador: si no,
  // la lista cambiaría de color mientras se teclea sin haber guardado nada.
  const nivelEmpresa = (id: string) => { const p = pulso.find((x) => x.organizacion_id === id); const b = umbrales.find((u) => u.dimension === 'agotamiento'); return p && b ? nivelCon(p.agotamiento, { a_vigilar: String(b.a_vigilar), alto: String(b.alto), fuente: '' }) : null }

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <View style={{ gap: 4, flex: 1, minWidth: 260 }}>
            <Rotulo>Maestro de empresas · ESP-008</Rotulo>
            <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>Empresas</Text>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              {`${filas.length} ${filas.length === 1 ? 'empresa' : 'empresas'} · ${totalActivos} personas en seguimiento`}
            </Text>
          </View>
          <BotonChico onPress={() => setFormulario((v) => !v)} icono={<IconoAgregar tamano={13} color={color.texto} />}>Nueva empresa</BotonChico>
        </View>


        {/* Vale para el alta de una empresa y para el guardado de los cortes,
            que está plegado: si viviera dentro, no se vería al guardar. */}
        {mensaje && <View style={[e.mensaje, mensaje.tono === 'error' && { backgroundColor: '#FBEDE6' }]}><Text style={[texto.dato, { color: mensaje.tono === 'error' ? TIERRA : color.primarioProfundo }]}>{mensaje.texto}</Text></View>}

        {/* La lista: es a lo que se entra a esta pantalla. */}
        {[...filas].sort((a, b) => (a.creado_en < b.creado_en ? -1 : 1)).map((f) => {
          const adh = adherencia.find((a) => a.organizacion_id === f.id)
          const nivel = nivelEmpresa(f.id)
          const tintaNivel = nivel === 'alto' ? TIERRA : nivel === 'a_vigilar' ? AMBAR : nivel ? color.primarioProfundo : color.textoSuave
          const baja = adh?.tasa_promedio != null && adh.tasa_promedio < 0.8
          return (
            <View key={f.id} style={e.empresa}>
              <View style={e.avatar}><Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>{f.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</Text></View>

              <View style={{ flex: 1.4, minWidth: 200, gap: 2 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{f.nombre}</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  {`${f.administradores} ${f.administradores === 1 ? 'administrador' : 'administradores'} · desde ${new Date(f.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </Text>
                {f.en_seguimiento < MINIMO_REPORTE && (
                  <Mono tono={AMBAR}>{`Bajo el mínimo de ${MINIMO_REPORTE}: no ve agregados`}</Mono>
                )}
              </View>

              <Dato rotulo="Personas" valor={String(f.en_seguimiento)}
                apoyo={f.trabajadores !== f.en_seguimiento ? `de ${f.trabajadores} inscritas` : 'inscritas'} />
              {/* Sin dato no se dice «cumple la meta»: una empresa recién dada
                  de alta no cumple nada todavía. */}
              <Dato rotulo="Adherencia" valor={adh?.tasa_promedio != null ? `${Math.round(adh.tasa_promedio * 100)}%` : '—'}
                apoyo={adh?.tasa_promedio == null ? 'sin check-ins aún' : baja ? 'bajo la meta' : 'cumple la meta'}
                tinta={baja ? TIERRA : color.texto} />
              <Dato rotulo="Pulso" valor={nivel === 'alto' ? 'Alto' : nivel === 'a_vigilar' ? 'A vigilar' : nivel ? 'Bajo' : '—'}
                apoyo={nivel ? 'agotamiento' : 'sin OLBI aún'} tinta={tintaNivel} punto={!!nivel} />

              <BotonChico onPress={() => router.push(conFiltro(`/investigador/empresa/${f.id}`, filtro) as never)} icono={<IconoAjustes tamano={13} color={color.texto} />}>Gestionar</BotonChico>
            </View>
          )
        })}
        {filas.length === 0 && <Caja><Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay empresas. Registra la primera para poder inscribir trabajadores.</Text></Caja>}

        {/* Los cortes: se tocan dos veces al año, van plegados. */}
        <Pressable onPress={() => setCortes((v) => !v)} style={e.plegable}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Cortes del pulso</Text>
            <Text style={[texto.dato, { color: color.textoMedio }]}>A partir de qué puntaje una empresa pasa a «a vigilar» o a «alto». Solo los cambia el investigador.</Text>
          </View>
          {umbrales.map((u) => (
            <Pastilla key={u.dimension} tono={TONO.gris} mono>{`${nombreCorto(u.dimension)} ${Number(u.a_vigilar).toFixed(2)} / ${Number(u.alto).toFixed(2)}`}</Pastilla>
          ))}
          <Text style={{ color: color.textoMedio }}>{cortes ? '⌃' : '⌄'}</Text>
        </Pressable>

        {cortes && (
          <Caja estilo={{ gap: espacio.md, marginTop: -8 }}>
            <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
              {umbrales.map((u) => {
                const b = borrador[u.dimension] ?? { a_vigilar: '', alto: '', fuente: '' }
                const invalido = !(Number(b.alto) > Number(b.a_vigilar))
                const set = (k: keyof Borrador, v: string) => setBorrador((s) => ({ ...s, [u.dimension]: { ...b, [k]: v } }))
                return (
                  <View key={u.dimension} style={e.dimension}>
                    <View style={[e.fila, { gap: 8 }]}>
                      <View style={[e.punto, { backgroundColor: u.dimension === 'agotamiento' ? color.primarioProfundo : TIERRA }]} />
                      <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{nombreDim(u.dimension)}</Text>
                    </View>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>
                      {u.dimension === 'agotamiento' ? 'Cansancio que no se va con el descanso normal.' : 'Distancia con el trabajo: deja de importar.'}
                    </Text>
                    <View style={[e.fila, { gap: espacio.sm }]}>
                      <Corte rotulo="A vigilar desde" valor={b.a_vigilar} onChange={(v) => set('a_vigilar', v)} invalido={invalido} />
                      <Corte rotulo="Alto desde" valor={b.alto} onChange={(v) => set('alto', v)} invalido={invalido} />
                    </View>
                    {invalido && <Text style={[texto.dato, { color: TIERRA }]}>«Alto» tiene que ser mayor que «a vigilar».</Text>}
                    <Rotulo>De dónde sale</Rotulo>
                    <TextInput value={b.fuente} onChangeText={(v) => set('fuente', v)} style={[texto.dato, e.entrada, { outlineStyle: 'none' } as any]} placeholder="Peterson et al. (2008), propuesta…" placeholderTextColor={color.textoSuave} />
                    <Mono tono={color.textoSuave}>{`Último cambio: ${new Date(u.actualizado_en).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`}</Mono>
                  </View>
                )
              })}
            </View>

            <View style={e.pie}>
              <View style={{ flex: 1, minWidth: 240, gap: 2 }}>
                <Rotulo>Si guardas, las empresas quedarían así</Rotulo>
                {pulso.length === 0 ? (
                  <Text style={[texto.dato, { color: color.textoMedio }]}>Todavía ninguna empresa tiene pulso: hacen falta 10 personas con un cuestionario del último mes.</Text>
                ) : (
                  <View style={[e.fila, { gap: 6 }]}>
                    <Pastilla tono={TONO.verde}>{`${previaAg.bajo} en bajo`}</Pastilla>
                    <Pastilla tono={TONO.ambar}>{`${previaAg.a_vigilar} a vigilar`}</Pastilla>
                    <Pastilla tono={TONO.tierra}>{`${previaAg.alto} en alto`}</Pastilla>
                    <Mono>por agotamiento</Mono>
                  </View>
                )}
              </View>
              <Pressable onPress={guardarUmbrales} disabled={!coherente || !hayCambios || ocupado} style={[e.botonGuardar, (!coherente || !hayCambios) && { opacity: 0.5 }]}>
                <IconoEscudoCheck tamano={14} color="#FFFFFF" />
                <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Guardando…' : 'Guardar cortes'}</Text>
              </Pressable>
            </View>

            <Text style={[texto.dato, { color: color.textoMedio }]}>
              Cambiarlos reetiqueta lo que ve cada empresa en su panel, hacia atrás también. No toca ninguna respuesta ni ningún informe ya escrito.
            </Text>
          </Caja>
        )}
      </ScrollView>

      {formulario && (
        <DialogoEmpresa
          onCerrar={() => setFormulario(false)}
          onCreada={(nueva) => { setFormulario(false); setMensaje({ tono: 'ok', texto: `${nueva.nombre} registrada. Ya se le pueden crear administradores e inscribir trabajadores.` }); cargar() }} />
      )}
    </Panel>
  )
}

function nombreDim(d: string) { return d === 'agotamiento' ? 'Agotamiento' : 'Desvinculación' }
function nombreCorto(d: string) { return d === 'agotamiento' ? 'Agot.' : 'Desv.' }

/** Una cifra de la fila, con su rótulo y una línea de contexto. */
function Dato({ rotulo, valor, apoyo, tinta = color.texto, punto }: {
  rotulo: string; valor: string; apoyo: string; tinta?: string; punto?: boolean
}) {
  return (
    <View style={{ flex: 0.8, minWidth: 96, gap: 1 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.fila, { gap: 5 }]}>
        {punto && <View style={[e.punto, { backgroundColor: tinta }]} />}
        <Text style={[texto.cuerpoFuerte, { color: tinta }]}>{valor}</Text>
      </View>
      <Text style={[texto.dato, { color: color.textoMedio, fontSize: 12 }]}>{apoyo}</Text>
    </View>
  )
}

function Corte({ rotulo, valor, onChange, invalido }: { rotulo: string; valor: string; onChange: (v: string) => void; invalido: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 92, gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.entradaCorte, invalido && { borderColor: TIERRA }]}>
        {/* `minWidth: 0` o en web el campo no encoge y el «pts» se sale de la tarjeta. */}
        <TextInput value={valor} onChangeText={onChange} keyboardType="decimal-pad" style={[texto.datoFuerte, { flex: 1, minWidth: 0, color: color.texto, fontFamily: MONO, fontSize: 15, outlineStyle: 'none' } as any]} />
        <Mono tono={color.textoSuave}>pts</Mono>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.sm, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  punto: { width: 8, height: 8, borderRadius: 4 },

  empresa: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, flexWrap: 'wrap' },
  avatar: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },

  plegable: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: 14, marginTop: espacio.sm, flexWrap: 'wrap' },
  dimension: { flex: 1, minWidth: 280, backgroundColor: '#F7F6F3', borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 8 },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  entradaCorte: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 12, backgroundColor: color.superficie },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.sm, flexWrap: 'wrap' },
  botonGuardar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 16, height: 42 },
  mensaje: { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10 },
})

/** Maestro de empresas y umbrales organizacionales — ESP-008, ESP-009 RF-009-15 (RN-008-13).
 *  Diseño: Figma 2IqfFSK20uCzmuMg6SvaUZ «Empresas · Investigador Principal».
 *
 *  Los umbrales del pulso organizacional son distintos de los individuales
 *  de ESP-003 y los fija el investigador; el admin de empresa no puede
 *  tocarlos. Al editarlos se ve cuántas empresas cambiarían de nivel. */

import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../modules/investigador/filtro'
import { actualizarUmbral, pulsoPorEmpresa, umbralesEmpresa, type PulsoEmpresa, type UmbralEmpresa } from '../../modules/investigador/panel'
import { adherenciaPorEmpresa, type AdherenciaEmpresa } from '../../modules/investigador/datos'
import { crearEmpresa, listarEmpresasConConteos, type FilaEmpresa } from '../../modules/panel/datos'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoAgregar, IconoAjustes, IconoBalanza, IconoCandado, IconoEscudoCheck, IconoInfo, IconoOjo } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

type Borrador = { a_vigilar: string; alto: string; fuente: string }

export default function Empresas() {
  const { filtro } = useFiltro()
  const [filas, setFilas] = useState<FilaEmpresa[] | null>(null)
  const [adherencia, setAdherencia] = useState<AdherenciaEmpresa[]>([])
  const [umbrales, setUmbrales] = useState<UmbralEmpresa[]>([])
  const [pulso, setPulso] = useState<PulsoEmpresa[]>([])
  const [borrador, setBorrador] = useState<Record<string, Borrador>>({})
  const [nombre, setNombre] = useState('')
  const [formulario, setFormulario] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const [f, a, u, p] = await Promise.all([listarEmpresasConConteos(), adherenciaPorEmpresa().catch(() => [] as AdherenciaEmpresa[]), umbralesEmpresa(), pulsoPorEmpresa()])
    setFilas(f); setAdherencia(a); setUmbrales(u); setPulso(p)
    setBorrador(Object.fromEntries(u.map((x) => [x.dimension, { a_vigilar: Number(x.a_vigilar).toFixed(2), alto: Number(x.alto).toFixed(2), fuente: x.fuente }])))
  }, [])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))
  useEffect(() => { if (mensaje?.tono === 'ok') { const t = setTimeout(() => setMensaje(null), 4000); return () => clearTimeout(t) } }, [mensaje])

  async function crear() {
    if (!nombre.trim()) return
    setOcupado(true)
    try { await crearEmpresa(nombre.trim()); setNombre(''); setFormulario(false); await cargar() } catch (ex) { setMensaje({ tono: 'error', texto: ex instanceof Error ? ex.message : 'No se pudo crear la empresa.' }) } finally { setOcupado(false) }
  }
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
      await cargar(); setMensaje({ tono: 'ok', texto: 'Umbrales guardados. El pulso de las empresas se recalcula con los nuevos cortes.' })
    } catch (ex) { setMensaje({ tono: 'error', texto: ex instanceof Error ? ex.message : 'No se pudieron guardar los umbrales.' }) } finally { setOcupado(false) }
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
  const nivelEmpresa = (id: string) => { const p = pulso.find((x) => x.organizacion_id === id); const b = umbrales.find((u) => u.dimension === 'agotamiento'); return p && b ? nivelCon(p.agotamiento, { a_vigilar: String(b.a_vigilar), alto: String(b.alto), fuente: '' }) : null }

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Maestro de cohortes y parámetros normativos" titulo="Empresas Participantes y Umbrales Organizacionales"
          subtitulo="Gestión institucional de convenios de investigación y calibración de puntos de corte del pulso corporativo."
          derecha={<Pastilla tono={TONO.gris} punto>Protocolo ético ESP-009 vigente</Pastilla>} />

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Caja estilo={{ flex: 2, minWidth: 320, flexDirection: 'row', alignItems: 'center', gap: espacio.md }}>
            <View style={e.cuadroIcono}><IconoBalanza tamano={20} color={color.primarioProfundo} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Marco Metodológico de Cohorte Activa</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>{filas.length} {filas.length === 1 ? 'organización tecnológica' : 'organizaciones tecnológicas'} en seguimiento longitudinal seudonimizado. {totalActivos} profesionales monitorizados bajo consentimiento informado.</Text>
            </View>
          </Caja>
          <View style={[e.notaGris, { flex: 1, minWidth: 220 }]}>
            <IconoEscudoCheck tamano={16} color={color.textoMedio} />
            <Text style={[texto.dato, { color: color.texto, flex: 1 }]}>Custodia de microdatos: cifrado en reposo (Supabase · AES-256), identidad separada de las respuestas.</Text>
          </View>
        </View>

        {/* Umbrales */}
        <Caja estilo={{ gap: espacio.md }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, minWidth: 280 }}>
              <View style={[e.fila, { gap: 8 }]}><Text style={[texto.seccion, { color: color.texto }]}>Umbrales del Pulso Organizacional (Escala OLBI 1.0 – 4.0)</Text><Pastilla tono={TONO.gris}>NORMATIVO</Pastilla></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Ajuste de parámetros psicométricos del Oldenburg Burnout Inventory para la agregación corporativa del panel ejecutivo.</Text>
            </View>
            <View style={e.notaGris}><IconoCandado tamano={13} color={color.textoMedio} /><Text style={[texto.dato, { color: color.texto }]}>Exclusivo Investigador Principal</Text></View>
          </View>
          <View style={e.politica}>
            <IconoInfo tamano={15} color={color.primarioProfundo} />
            <View style={{ flex: 1 }}>
              <Text style={[texto.datoFuerte, { color: color.texto }]}>Política de Recálculo Restringido</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Solo el Investigador Principal puede modificar los puntos de corte normativos. Toda edición recalcula retroactivamente las etiquetas en el panel corporativo pero preserva los microdatos brutos intactos. Los reportes de diagnóstico y derivaciones clínicas previas no sufren alteración de registro.</Text>
            </View>
          </View>
          <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
            {umbrales.map((u) => {
              const b = borrador[u.dimension] ?? { a_vigilar: '', alto: '', fuente: '' }
              const invalido = !(Number(b.alto) > Number(b.a_vigilar))
              const set = (k: keyof Borrador, v: string) => setBorrador((s) => ({ ...s, [u.dimension]: { ...b, [k]: v } }))
              return (
                <View key={u.dimension} style={e.dimension}>
                  <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                    <View style={[e.fila, { gap: 8 }]}><View style={[e.punto, { backgroundColor: u.dimension === 'agotamiento' ? color.primarioProfundo : '#8C4A2B' }]} /><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{nombreDim(u.dimension)}</Text></View>
                    <Mono>Índice OLBI-{u.dimension === 'agotamiento' ? 'EX' : 'DIS'}</Mono>
                  </View>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>{u.dimension === 'agotamiento' ? 'Mide la fatiga crónica y la sobreexigencia física/cognitiva vinculada al trabajo diario en ingeniería.' : 'Evalúa la distancia cínica, desidentificación y pérdida de sentido respecto a la labor tecnológica.'}</Text>
                  <View style={[e.fila, { gap: espacio.sm }]}>
                    <Corte rotulo="Corte 'a vigilar'" valor={b.a_vigilar} onChange={(v) => set('a_vigilar', v)} invalido={invalido} />
                    <Corte rotulo="Corte 'alto'" valor={b.alto} onChange={(v) => set('alto', v)} invalido={invalido} />
                  </View>
                  {invalido && <Text style={[texto.dato, { color: '#8C4A2B' }]}>El corte «alto» debe ser mayor que «a vigilar».</Text>}
                  <Rotulo>Fuente metodológica de calibración</Rotulo>
                  <TextInput value={b.fuente} onChangeText={(v) => set('fuente', v)} style={[texto.dato, e.entrada, { outlineStyle: 'none' } as any]} placeholder="Peterson et al. (2008), propuesta…" placeholderTextColor={color.textoSuave} />
                  <Mono tono={color.textoSuave}>Último cambio: {new Date(u.actualizado_en).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</Mono>
                </View>
              )
            })}
          </View>
          <View style={e.pie}>
            <View style={[e.fila, { gap: 6 }]}><IconoAjustes tamano={13} color={color.textoMedio} /><Text style={[texto.dato, { color: color.textoMedio }]}>Regla de coherencia:</Text><Text style={[texto.datoFuerte, { color: coherente ? color.texto : '#8C4A2B' }]}>Nivel Alto &gt; Nivel A vigilar</Text></View>
            <View style={[e.fila, { gap: 6 }]}>
              <IconoOjo tamano={13} color={color.textoMedio} /><Text style={[texto.dato, { color: color.textoMedio }]}>Vista previa con estos umbrales:</Text>
              <Pastilla tono={TONO.verde}>{`${previaAg.bajo} en Bajo`}</Pastilla><Pastilla tono={TONO.ambar}>{`${previaAg.a_vigilar} en A vigilar`}</Pastilla><Pastilla tono={TONO.tierra}>{`${previaAg.alto} en Alto`}</Pastilla>
              {pulso.length === 0 && <Mono>(sin OLBI semanal por empresa todavía)</Mono>}
            </View>
            <Pressable onPress={guardarUmbrales} disabled={!coherente || !hayCambios || ocupado} style={[e.botonGuardar, (!coherente || !hayCambios) && { opacity: 0.5 }]}>
              <IconoEscudoCheck tamano={14} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Guardando…' : 'Guardar umbrales normativos'}</Text>
            </Pressable>
          </View>
          {mensaje && <View style={[e.mensaje, mensaje.tono === 'error' && { backgroundColor: '#FBEDE6' }]}><Text style={[texto.dato, { color: mensaje.tono === 'error' ? '#8C4A2B' : color.primarioProfundo }]}>{mensaje.texto}</Text></View>}
        </Caja>

        {/* Lista de empresas */}
        <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
          <View><Text style={[texto.seccion, { color: color.texto }]}>Empresas Participantes</Text><Text style={[texto.dato, { color: color.textoMedio }]}>Convenios de investigación activos bajo supervisión del comité de ética.</Text></View>
          <BotonChico onPress={() => setFormulario((v) => !v)} icono={<IconoAgregar tamano={13} color={color.texto} />}>+ Registrar nueva empresa conveniada</BotonChico>
        </View>
        {formulario && (
          <Caja estilo={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' }}>
            <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre de la empresa" placeholderTextColor={color.textoSuave} onSubmitEditing={crear} style={[texto.dato, e.entrada, { flex: 1, minWidth: 220, outlineStyle: 'none' } as any]} />
            <BotonChico onPress={crear} tono="verde">{ocupado ? 'Creando…' : 'Agregar'}</BotonChico>
            <BotonChico onPress={() => setFormulario(false)} tono="suave">Cancelar</BotonChico>
          </Caja>
        )}
        {[...filas].sort((a, b) => (a.creado_en < b.creado_en ? -1 : 1)).map((f, i) => {
          const adh = adherencia.find((a) => a.organizacion_id === f.id)
          const nivel = nivelEmpresa(f.id)
          return (
            <View key={f.id} style={e.empresa}>
              <View style={e.avatar}><Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>{f.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</Text></View>
              <View style={{ flex: 1, minWidth: 240, gap: 3 }}>
                <View style={[e.fila, { gap: 8 }]}><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{f.nombre}</Text><Pastilla tono={TONO.gris} mono>{`Cohorte ${i + 1}`}</Pastilla></View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{f.administradores} {f.administradores === 1 ? 'administrador' : 'administradores'} · alta el {new Date(f.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                <View style={[e.fila, { gap: 6 }]}>
                  <Text style={[texto.datoFuerte, { color: color.texto }]}>{f.participantes} inscritos ({f.en_seguimiento} activos{f.participantes ? `, ${Math.round((f.en_seguimiento / f.participantes) * 100)}%` : ''})</Text>
                  <Text style={{ color: color.textoSuave }}>·</Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>Adherencia: <Text style={{ color: adh?.tasa_promedio != null && adh.tasa_promedio < 0.8 ? '#8C4A2B' : color.primarioProfundo }}>{adh?.tasa_promedio != null ? `${Math.round(adh.tasa_promedio * 100)}%` : '—'}</Text></Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Rotulo>Estado pulso</Rotulo>
                <View style={[e.fila, { gap: 5 }]}><View style={[e.punto, { backgroundColor: nivel === 'alto' ? '#8C4A2B' : nivel === 'a_vigilar' ? '#B45309' : nivel ? color.primarioProfundo : '#BDB8B1' }]} /><Text style={[texto.datoFuerte, { color: nivel === 'alto' ? '#8C4A2B' : nivel === 'a_vigilar' ? '#B45309' : color.texto }]}>{nivel === 'alto' ? 'Nivel Alto' : nivel === 'a_vigilar' ? 'A vigilar' : nivel ? 'Estable (Bajo)' : 'Sin OLBI aún'}</Text></View>
              </View>
              <BotonChico onPress={() => router.push(conFiltro(`/investigador/empresa/${f.id}`, filtro) as never)} icono={<IconoAjustes tamano={13} color={color.texto} />}>Gestionar empresa</BotonChico>
            </View>
          )
        })}
        {filas.length === 0 && <Caja><Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no hay empresas. Registra la primera para poder inscribir participantes.</Text></Caja>}
      </ScrollView>
    </Panel>
  )
}

function nombreDim(d: string) { return d === 'agotamiento' ? 'Agotamiento Organizacional (Exhaustion)' : 'Desvinculación Organizacional (Disengagement)' }

function Corte({ rotulo, valor, onChange, invalido }: { rotulo: string; valor: string; onChange: (v: string) => void; invalido: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.entradaCorte, invalido && { borderColor: '#8C4A2B' }]}>
        <TextInput value={valor} onChangeText={onChange} keyboardType="decimal-pad" style={[texto.datoFuerte, { flex: 1, color: color.texto, fontFamily: MONO, fontSize: 15, outlineStyle: 'none' } as any]} />
        <Mono tono={color.textoSuave}>pts</Mono>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  cuadroIcono: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  notaGris: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12 },
  politica: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12 },
  dimension: { flex: 1, minWidth: 300, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  entradaCorte: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 12, backgroundColor: color.superficie },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.sm, flexWrap: 'wrap', backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12 },
  botonGuardar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 16, height: 42 },
  mensaje: { backgroundColor: '#EAF4EF', borderRadius: 8, padding: 10 },
  empresa: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, flexWrap: 'wrap' },
  avatar: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
})

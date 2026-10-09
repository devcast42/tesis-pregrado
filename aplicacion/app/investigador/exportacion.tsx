/** Exportación del dataset — implementa ESP-009 RF-009-13, RN-009-06.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Exportación y Auditoría · Investigador Principal».
 *
 *  La pantalla tiene un solo trabajo: armar un paquete y descargarlo. Por eso
 *  es una tarjeta de trabajo (qué tablas · resumen y botón) y dos secciones de
 *  consulta plegadas debajo: el historial y el diccionario.
 *  La exportación se registra ANTES de entregar el archivo. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro } from '../../modules/investigador/filtro'
import { exportaciones as cargarExportaciones, fechaHoraPET, type ExportacionRegistrada } from '../../modules/investigador/panel'
import { DICCIONARIO, TABLAS, conteos as cargarConteos, exportarZip, descargarTexto, type ClaveTabla, type Formato } from '../../modules/investigador/exportar'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, texto } from '../../modules/nucleo/diseno'
import { IconoArchivo, IconoCandado, IconoCheckCirculo, IconoEscudoCheck } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

export default function Exportacion() {
  const { filtro } = useFiltro()
  const [conteos, setConteos] = useState<Record<ClaveTabla, number | null> | null>(null)
  const [listo, setListo] = useState(false)
  const [registro, setRegistro] = useState<ExportacionRegistrada[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [elegidas, setElegidas] = useState<Set<ClaveTabla>>(new Set(TABLAS.map((t) => t.clave)))
  const [formato, setFormato] = useState<Formato>('csv')
  const [ocupado, setOcupado] = useState(false)
  const [ultimo, setUltimo] = useState<{ nombre: string; hash: string; bytes: number } | null>(null)
  const [codebook, setCodebook] = useState(false)
  const [historial, setHistorial] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Un contador por carga. Al cambiar de empresa los conteos vuelven a
  // «contando…» en vez de quedarse con los de la empresa anterior, y una
  // respuesta lenta de la empresa que ya se dejó atrás se descarta: tardan
  // medio minuto, así que dos cambios seguidos llegan desordenados.
  const vigente = useRef(0)
  const cargar = useCallback(async () => {
    const turno = ++vigente.current
    setConteos(null)
    // Los conteos tardan (un count exacto por tabla): la página no los espera.
    cargarConteos(filtro)
      .then((c) => { if (vigente.current === turno) setConteos(c) })
      .catch(() => { if (vigente.current === turno) setConteos({} as Record<ClaveTabla, number | null>) })
    const [r, e] = await Promise.all([cargarExportaciones(), listarEmpresas().catch(() => [] as Empresa[])])
    if (vigente.current !== turno) return
    setRegistro(r); setEmpresas(e); setListo(true)
  }, [filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))
  useEffect(() => { setUltimo(null) }, [filtro.organizacion_id, formato, elegidas])

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  const empresa = empresas.find((e) => e.id === filtro.organizacion_id)
  const escogidas = TABLAS.filter((t) => elegidas.has(t.clave))
  const total = conteos ? escogidas.reduce((s, t) => s + (conteos[t.clave] ?? 0), 0) : 0
  // Si algún conteo falló, el total es un mínimo, no una cifra: se dice así.
  const totalParcial = !!conteos && escogidas.some((t) => conteos[t.clave] === null)
  const alternar = (k: ClaveTabla) => setElegidas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const todas = elegidas.size === TABLAS.length

  async function descargar() {
    if (elegidas.size === 0) return aviso('Nada que exportar', 'Elige al menos una tabla.')
    setOcupado(true)
    try {
      const r = await exportarZip(filtro, [...elegidas], formato)
      setUltimo(r); cargar()
    } catch (e) { aviso('No se pudo exportar', e instanceof Error ? e.message : '') } finally { setOcupado(false) }
  }
  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { aviso('Hash', t) }
  }
  function comprobante(x: ExportacionRegistrada) {
    const c = { comprobante: `Exp-${String(x.id).padStart(3, '0')}`, ocurrido_en: x.ocurrido_en, filtros: x.filtros, conteos: x.conteos, formato: x.formato, sha256: x.hash, operador: x.por, esquema: 'ESP-009 v1' }
    descargarTexto(`comprobante-exp-${String(x.id).padStart(3, '0')}.json`, JSON.stringify(c, null, 2))
  }

  if (!listo) return <Panel rol="investigador"><Cargando /></Panel>

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Encabezado eyebrow="Gobernanza de datos · Protocolo ESP-009" titulo="Exportación de microdatos" />

        {/* ---- La tarea: elegir tablas y descargar ---- */}
        <Caja estilo={{ gap: 0, padding: 0, overflow: 'hidden' }}>
          <View style={e.dos}>
            {/* Izquierda: qué va en el paquete */}
            <View style={e.izq}>
              <View style={[e.fila, { justifyContent: 'space-between' }]}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Qué incluir</Text>
                <Pressable onPress={() => setElegidas(todas ? new Set() : new Set(TABLAS.map((t) => t.clave)))} hitSlop={8}>
                  <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{todas ? 'Ninguna' : 'Todas'}</Text>
                </Pressable>
              </View>

              {TABLAS.map((t) => {
                const on = elegidas.has(t.clave)
                return (
                  <Pressable key={t.clave} onPress={() => alternar(t.clave)} style={[e.tabla, on && e.tablaOn]}
                    accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={[e.casilla, on && e.casillaOn]}>{on && <Text style={e.tick}>✓</Text>}</View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={[e.fila, { justifyContent: 'space-between', gap: 8 }]}>
                        <Mono tono={on ? color.texto : color.textoMedio} tamano={12}>{t.titulo}</Mono>
                        <Mono>{!conteos ? '·' : conteos[t.clave] === null ? '?' : (conteos[t.clave] as number).toLocaleString('es-PE')}</Mono>
                      </View>
                      <Text style={[texto.dato, { color: color.textoMedio }]} numberOfLines={2}>{t.descripcion}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            {/* Derecha: el resumen y la acción */}
            <View style={e.der}>
              <View style={{ gap: 3 }}>
                <Rotulo>Alcance del corte</Rotulo>
                <Text style={[texto.datoFuerte, { color: color.texto }]}>{empresa ? empresa.nombre : 'Todas las empresas'}</Text>
                {/* El rango de semanas de la barra lateral no filtra la exportación
                    (ver el manifiesto en exportar.ts): no se anuncia aquí. */}
                <Text style={[texto.dato, { color: color.textoMedio }]}>Todo el seguimiento</Text>
              </View>

              <View style={e.raya} />

              <View>
                <Text style={[texto.cifra, { color: conteos ? color.texto : color.textoSuave, fontSize: 30, lineHeight: 36 }]}>
                  {conteos ? `${totalParcial ? '≥ ' : ''}${total.toLocaleString('es-PE')}` : 'contando…'}
                </Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>{`filas · ${elegidas.size} de ${TABLAS.length} tablas`}</Text>
                {totalParcial && <Text style={[texto.dato, { color: color.textoMedio }]}>No se pudo contar alguna tabla (marcada «?»); el paquete sí las lleva completas.</Text>}
              </View>

              <View style={e.segmento}>
                {(['csv', 'json'] as const).map((k) => (
                  <Pressable key={k} onPress={() => setFormato(k)} style={[e.opcion, formato === k && e.opcionOn]}>
                    <Text style={[texto.datoFuerte, { color: formato === k ? color.texto : color.textoMedio }]}>{k.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={descargar} disabled={ocupado || !conteos} style={[e.botonZip, (ocupado || !conteos) && { opacity: 0.5 }]} accessibilityRole="button">
                <IconoArchivo tamano={16} color="#FFFFFF" />
                <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Generando…' : !conteos ? 'Calculando el corte…' : 'Descargar ZIP'}</Text>
              </Pressable>

              {ultimo ? (
                <View style={{ gap: 6 }}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <Rotulo>SHA-256 del paquete</Rotulo>
                    <Pressable onPress={() => copiar(ultimo.hash)} hitSlop={8}>
                      <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{copiado ? 'Copiado' : 'Copiar'}</Text>
                    </Pressable>
                  </View>
                  <View style={e.hash}><Text style={e.hashTexto} selectable>{ultimo.hash}</Text></View>
                  <Mono>{`${ultimo.nombre} · ${(ultimo.bytes / 1024).toFixed(0)} KB`}</Mono>
                </View>
              ) : (
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  Incluye <Mono tono={color.texto} tamano={12}>manifest.json</Mono> con el filtro, los conteos y el hash, más <Mono tono={color.texto} tamano={12}>diccionario.md</Mono>.
                </Text>
              )}

              <View style={[e.fila, { gap: 6, alignItems: 'flex-start', flexWrap: 'nowrap' }]}>
                <IconoEscudoCheck tamano={14} color={color.primarioProfundo} />
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
                  Datos seudonimizados: cada persona va con un identificador interno. Ni nombre, ni correo, ni código.
                </Text>
              </View>
            </View>
          </View>
        </Caja>

        {/* ---- Consulta: historial ---- */}
        <Caja estilo={{ gap: espacio.sm }}>
          <Pressable onPress={() => setHistorial((v) => !v)} style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={[e.fila, { gap: 8 }]}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Historial de exportaciones</Text>
              <Pastilla tono={TONO.gris} mono>{String(registro.length)}</Pastilla>
            </View>
            <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{historial ? 'Ocultar ⌃' : 'Ver ⌄'}</Text>
          </Pressable>

          {historial && (registro.length === 0 ? (
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>Todavía no se ha exportado ningún paquete.</Text>
          ) : (
            <View>
              <View style={e.tablaCab}>
                {[['Exportación', 1.6], ['Alcance', 1.5], ['Filas', 0.7], ['Hash', 0.9], ['', 1]].map(([h, f], i) => (
                  <Text key={i} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
                ))}
              </View>
              {registro.map((x) => {
                const f = x.filtros ?? {}
                const emp = f.organizacion_id ? empresas.find((y) => y.id === f.organizacion_id)?.nombre ?? 'Una empresa' : 'Todas las empresas'
                // Los manifiestos anteriores guardaban `semanas`, que nunca se
                // llegó a aplicar; los nuevos guardan `periodo`.
                const sem = typeof f.periodo === 'string' ? f.periodo : Array.isArray(f.semanas) ? 'todo el seguimiento' : ''
                const n = Object.values(x.conteos ?? {}).reduce((s: number, v) => s + Number(v), 0)
                return (
                  <View key={x.id} style={e.tablaFila}>
                    <View style={{ flex: 1.6 }}>
                      <Mono tono={color.primarioProfundo} tamano={12}>{`Exp-${String(x.id).padStart(3, '0')} · ${(x.formato ?? 'csv').toUpperCase()}`}</Mono>
                      <Text style={[texto.dato, { color: color.textoMedio }]}>{fechaHoraPET(x.ocurrido_en)}</Text>
                    </View>
                    <Text style={[texto.dato, { color: color.texto, flex: 1.5 }]}>{emp}{sem ? `\n${sem}` : ''}</Text>
                    <Text style={[texto.datoFuerte, { color: color.texto, flex: 0.7, fontFamily: MONO }]}>{n.toLocaleString('es-PE')}</Text>
                    <View style={[e.fila, { flex: 0.9, gap: 4 }]}><IconoCandado tamano={11} color={color.textoMedio} /><Mono>{`${x.hash.slice(0, 5)}…${x.hash.slice(-3)}`}</Mono></View>
                    <View style={{ flex: 1 }}><BotonChico onPress={() => comprobante(x)} tono="suave" icono={<IconoCheckCirculo tamano={12} color={color.primarioProfundo} />}>Comprobante</BotonChico></View>
                  </View>
                )
              })}
            </View>
          ))}
        </Caja>

        {/* ---- Consulta: diccionario ---- */}
        <Caja estilo={{ gap: espacio.sm }}>
          <Pressable onPress={() => setCodebook((v) => !v)} style={[e.fila, { justifyContent: 'space-between' }]}>
            <View style={[e.fila, { gap: 8 }]}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Diccionario de variables</Text>
              <Pastilla tono={TONO.gris} mono>{String(DICCIONARIO.length)}</Pastilla>
            </View>
            <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{codebook ? 'Ocultar ⌃' : 'Ver ⌄'}</Text>
          </Pressable>
          {codebook && (
            <View style={[e.fila, { alignItems: 'stretch', gap: espacio.sm }]}>
              {DICCIONARIO.map((d) => (
                <View key={d.variable} style={e.variable}>
                  <View style={[e.fila, { justifyContent: 'space-between' }]}>
                    <Mono tono={color.primarioProfundo} tamano={12}>{d.variable}</Mono>
                    <Pastilla tono={TONO.gris} mono>{d.tipo}</Pastilla>
                  </View>
                  <Text style={[texto.dato, { color: color.texto }]}>{d.texto}</Text>
                  <Mono>{d.rango}</Mono>
                </View>
              ))}
            </View>
          )}
        </Caja>
      </ScrollView>
    </Panel>
  )
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },

  dos: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'wrap' },
  izq: { flex: 1.5, minWidth: 340, padding: espacio.base, gap: 8 },
  der: { flex: 1, minWidth: 260, padding: espacio.base, gap: espacio.sm, backgroundColor: '#F7F6F3', borderLeftWidth: 1, borderLeftColor: '#EEECE8' },
  raya: { height: 1, backgroundColor: '#E6E3DE' },

  tabla: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  tablaOn: { backgroundColor: '#F5F4F1', borderColor: '#E6E3DE' },
  casilla: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#BDB8B1', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  casillaOn: { backgroundColor: color.primarioProfundo, borderColor: color.primarioProfundo },
  tick: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  segmento: { flexDirection: 'row', backgroundColor: '#E9E7E2', borderRadius: 8, padding: 3, gap: 3 },
  opcion: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 6 },
  opcionOn: { backgroundColor: '#FFFFFF' },

  botonZip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingVertical: 13 },
  hash: { backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#E6E3DE', padding: 9 },
  hashTexto: { fontFamily: MONO, fontSize: 10.5, lineHeight: 15, color: color.texto },

  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E6E3DE' },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1EFEB' },
  variable: { flexBasis: '48%', flexGrow: 1, minWidth: 260, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 12, gap: 6 },
})

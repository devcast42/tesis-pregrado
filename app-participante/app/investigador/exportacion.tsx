/** Exportación del dataset — implementa ESP-009 RF-009-13, RN-009-06.
 *  Diseño: Figma NsWTiSKab9HJt9b2EBz7XA «Exportación y Auditoría · Investigador Principal».
 *
 *  Cuatro bloques: qué tablas, en qué formato (con manifiesto y hash),
 *  el registro inmutable de cada extracción y el diccionario de variables.
 *  La exportación se registra ANTES de entregar el archivo. */

import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro } from '../../modules/investigador/filtro'
import { exportaciones as cargarExportaciones, fechaHoraPET, type ExportacionRegistrada } from '../../modules/investigador/panel'
import { DICCIONARIO, TABLAS, conteos as cargarConteos, exportarZip, descargarTexto, type ClaveTabla, type Formato } from '../../modules/investigador/exportar'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { BotonChico, Caja, Encabezado, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoArchivo, IconoCandado, IconoCheckCirculo, IconoEscudoCheck, IconoHistorial, IconoNota, IconoReloj } from '../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined

export default function Exportacion() {
  const { filtro } = useFiltro()
  const [conteos, setConteos] = useState<Record<ClaveTabla, number> | null>(null)
  const [listo, setListo] = useState(false)
  const [registro, setRegistro] = useState<ExportacionRegistrada[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [elegidas, setElegidas] = useState<Set<ClaveTabla>>(new Set(TABLAS.map((t) => t.clave)))
  const [formato, setFormato] = useState<Formato>('csv')
  const [ocupado, setOcupado] = useState(false)
  const [ultimo, setUltimo] = useState<{ nombre: string; hash: string; bytes: number } | null>(null)
  const [codebook, setCodebook] = useState(true)
  const [copiado, setCopiado] = useState(false)

  const cargar = useCallback(async () => {
    // Los conteos tardan (count exacto por tabla): la página no los espera.
    cargarConteos(filtro).then(setConteos).catch(() => setConteos({} as Record<ClaveTabla, number>))
    const [r, e] = await Promise.all([cargarExportaciones(), listarEmpresas().catch(() => [] as Empresa[])])
    setRegistro(r); setEmpresas(e); setListo(true)
  }, [filtro.organizacion_id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))
  useEffect(() => { setUltimo(null) }, [filtro.organizacion_id, formato, elegidas])

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  const empresa = empresas.find((e) => e.id === filtro.organizacion_id)
  const total = conteos ? TABLAS.filter((t) => elegidas.has(t.clave)).reduce((s, t) => s + (conteos[t.clave] ?? 0), 0) : 0
  const alternar = (k: ClaveTabla) => setElegidas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

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
        <Encabezado eyebrow="Gobernanza de datos · Protocolo ESP-009   ·   UNT-SALUD-EXT" titulo="Exportación de Microdatos y Manifiesto de Reproducibilidad"
          subtitulo="Generación de paquetes de datos seudonimizados con hash criptográfico y registro inmutable en log de auditoría para entornos R, Python o SPSS."
          derecha={(
            <View style={e.integridad}>
              <View style={[e.fila, { gap: 6 }]}><View style={e.puntoVerde} /><Rotulo>Integridad criptográfica</Rotulo></View>
              <Mono tono={color.texto}>SHA-256 · Web Crypto{'\n'}ZIP almacenado sin compresión</Mono>
            </View>
          )} />

        {/* Alcance del corte activo */}
        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { gap: 6 }]}><IconoHistorial tamano={14} color={color.primarioProfundo} /><Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Alcance del Corte Activo:</Text></View>
          <View style={[e.fila, { gap: 8 }]}>
            <Pastilla tono={TONO.grisOscuro}>{empresa ? `Empresa: ${empresa.nombre}` : `Empresas: ${empresas.map((x) => x.nombre).join(', ') || 'todas'}`}</Pastilla>
            <Pastilla tono={TONO.grisOscuro}>{`Periodo longitudinal: Semanas ${filtro.semanaDesde} a ${filtro.semanaHasta}`}</Pastilla>
          </View>
          <Mono>PostgreSQL (Supabase) · Sync {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })} PET · El filtro se toma de la barra lateral y queda escrito en el manifiesto.</Mono>
        </Caja>

        <View style={[e.fila, { alignItems: 'flex-start', gap: espacio.base }]}>
          {/* 1. Microdatos */}
          <Caja estilo={{ flex: 1.2, minWidth: 320, gap: espacio.sm }}>
            <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[texto.seccion, { color: color.texto }]}>1. Microdatos Disponibles en el Paquete</Text>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Seleccione las dimensiones de investigación que serán incluidas en el archivo estructurado.</Text>
              </View>
              <Pressable onPress={() => setElegidas(elegidas.size === TABLAS.length ? new Set() : new Set(TABLAS.map((t) => t.clave)))}>
                <Text style={[texto.datoFuerte, { color: color.primarioProfundo, textAlign: 'right' }]}>{elegidas.size === TABLAS.length ? 'Desmarcar\ntodas' : 'Marcar\ntodas'}</Text>
              </Pressable>
            </View>
            {TABLAS.map((t) => {
              const on = elegidas.has(t.clave)
              return (
                <Pressable key={t.clave} onPress={() => alternar(t.clave)} style={[e.tabla, on && e.tablaOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <View style={[e.casilla, on && e.casillaOn]}>{on && <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>✓</Text>}</View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={[e.fila, { justifyContent: 'space-between' }]}>
                      <Mono tono={color.texto} tamano={12}>{t.titulo}</Mono>
                      <Pastilla tono={TONO.gris} mono>{conteos ? `${(conteos[t.clave] ?? 0).toLocaleString('es-PE')} filas` : 'contando…'}</Pastilla>
                    </View>
                    <Text style={[texto.dato, { color: color.textoMedio }]}>{t.descripcion}</Text>
                  </View>
                </Pressable>
              )
            })}
          </Caja>

          {/* 2. Formato + manifiesto */}
          <View style={{ flex: 1, minWidth: 300, gap: espacio.base }}>
            <Caja estilo={{ gap: espacio.sm }}>
              <Text style={[texto.seccion, { color: color.texto }]}>2. Formato Técnico del Paquete</Text>
              <Rotulo>Entorno de destino · serialización</Rotulo>
              <View style={[e.fila, { gap: 8 }]}>
                {([['csv', 'CSV', 'UTF-8 / RFC 4180'], ['json', 'JSON', 'una lista por tabla'], ['parquet', 'Parquet', 'no disponible en navegador']] as const).map(([k, t, s]) => {
                  const on = formato === k, off = k === 'parquet'
                  return (
                    <Pressable key={k} disabled={off} onPress={() => setFormato(k as Formato)} style={[e.formato, on && e.formatoOn, off && { opacity: 0.45 }]}>
                      <Text style={[texto.datoFuerte, { color: on ? '#FFFFFF' : color.texto }]}>{t}</Text>
                      <Text style={[texto.dato, { color: on ? '#DDF3EA' : color.textoMedio, fontSize: 10, textAlign: 'center' }]}>{s}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <View style={e.panelGris}>
                <View style={[e.fila, { gap: 6 }]}><IconoEscudoCheck tamano={14} color={color.primarioProfundo} /><Text style={[texto.datoFuerte, { color: color.texto }]}>Seudonimización de origen</Text></View>
                <Text style={[texto.dato, { color: color.textoMedio }]}>Las tablas solo llevan el identificador interno del participante y su código; nombres y correos viven en otra tabla que no se exporta. La re-identificación requiere el acceso auditado a identidad.</Text>
                <Mono>Esquema: ESP-009 v1 · diccionario.md incluido</Mono>
              </View>
            </Caja>
            <Caja estilo={{ gap: espacio.sm }}>
              <View style={[e.fila, { justifyContent: 'space-between' }]}><Text style={[texto.seccion, { color: color.texto }]}>Manifiesto de Reproducibilidad</Text><IconoCheckCirculo tamano={16} color={color.primarioProfundo} /></View>
              <FilaDato k="Fecha y hora oficial:" v={ultimo ? fechaHoraPET(new Date().toISOString()) : 'al generar el paquete'} />
              <FilaDato k="Versión del esquema:" v="ESP-009 v1" tinta={color.primarioProfundo} />
              <FilaDato k="Registros seleccionados:" v={`${total.toLocaleString('es-PE')} filas`} />
              <FilaDato k="Tablas en lote:" v={`${elegidas.size} de ${TABLAS.length}`} />
              <Rotulo>{`Checksum SHA-256 ${ultimo ? 'del paquete' : '(se calcula al generar)'}`}</Rotulo>
              <View style={[e.hash, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: color.texto, flex: 1 }} selectable>{ultimo ? ultimo.hash : '—'.repeat(32)}</Text>
                {ultimo && <Pressable onPress={() => copiar(ultimo.hash)}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{copiado ? 'Copiado' : 'Copiar'}</Text></Pressable>}
              </View>
              <Pressable onPress={descargar} disabled={ocupado} style={[e.botonZip, ocupado && { opacity: 0.6 }]} accessibilityRole="button">
                <IconoArchivo tamano={16} color="#FFFFFF" />
                <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Generando paquete…' : 'Descargar Paquete ZIP'}</Text>
                <Text style={[texto.dato, { color: '#DDF3EA' }]}>(Manifiesto + Datos + Codebook)</Text>
              </Pressable>
              <Text style={[texto.dato, { color: color.textoMedio, textAlign: 'center' }]}>El archivo contendrá <Mono>manifest.json</Mono>, los ficheros tabulares y <Mono>diccionario.md</Mono>. {ultimo ? `Último: ${ultimo.nombre} (${(ultimo.bytes / 1024).toFixed(0)} KB).` : ''}</Text>
            </Caja>
          </View>
        </View>

        {/* 3. Registro de auditoría */}
        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <View style={[e.fila, { gap: 6 }]}><IconoReloj tamano={15} color={color.primarioProfundo} /><Text style={[texto.seccion, { color: color.texto }]}>3. Registro Inmutable de Auditoría de Exportaciones</Text></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Historial de cada extracción con su hash: el capítulo de resultados puede citar exactamente qué corte usó.</Text>
            </View>
            <Pastilla tono={TONO.gris} mono>{`Total eventos registrados: ${registro.length}`}</Pastilla>
          </View>
          <View style={e.tablaCab}>
            {[['ID evento', 0.8], ['Fecha · hora', 1.1], ['Alcance cohorte', 1.6], ['Registros', 0.8], ['Formato', 0.7], ['Hash SHA-256 verificado', 1.3], ['Operador', 0.9], ['Comprobante', 1]].map(([h, f]) => (
              <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
            ))}
          </View>
          {registro.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 10 }]}>Todavía no se ha exportado ningún paquete.</Text>}
          {registro.map((x) => {
            const f = x.filtros ?? {}
            const emp = f.organizacion_id ? empresas.find((y) => y.id === f.organizacion_id)?.nombre ?? 'Una empresa' : 'Todas las empresas'
            const sem = Array.isArray(f.semanas) ? `Semanas ${f.semanas[0]} → ${f.semanas[1]}` : ''
            const n = Object.values(x.conteos ?? {}).reduce((s: number, v) => s + Number(v), 0)
            return (
              <View key={x.id} style={e.tablaFila}>
                <Mono tono={color.primarioProfundo} tamano={12}>{`Exp-${String(x.id).padStart(3, '0')}`}</Mono>
                <Text style={[texto.dato, { color: color.texto, flex: 1.1 }]}>{fechaHoraPET(x.ocurrido_en)}</Text>
                <Text style={[texto.dato, { color: color.texto, flex: 1.6 }]}>{sem} · {emp}</Text>
                <Text style={[texto.datoFuerte, { color: color.texto, flex: 0.8, fontFamily: MONO }]}>{n.toLocaleString('es-PE')}</Text>
                <View style={{ flex: 0.7 }}><Pastilla tono={TONO.gris} mono>{(x.formato ?? 'csv').toUpperCase()}</Pastilla></View>
                <View style={[e.fila, { flex: 1.3, gap: 4 }]}><IconoCandado tamano={11} color={color.textoMedio} /><Mono tono={color.textoMedio}>{`${x.hash.slice(0, 5)}…${x.hash.slice(-3)}`}</Mono></View>
                <Text style={[texto.dato, { color: color.texto, flex: 0.9 }]}>{x.por ? 'Investigador' : '—'}</Text>
                <View style={{ flex: 1 }}><BotonChico onPress={() => comprobante(x)} tono="suave" icono={<IconoCheckCirculo tamano={12} color={color.primarioProfundo} />}>Comprobante</BotonChico></View>
              </View>
            )
          })}
        </Caja>

        {/* 4. Diccionario */}
        <Caja estilo={{ gap: espacio.sm }}>
          <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <View style={[e.fila, { gap: 6 }]}><IconoNota tamano={15} color={color.primarioProfundo} /><Text style={[texto.seccion, { color: color.texto }]}>4. Diccionario de Variables Esenciales (Codebook)</Text></View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Definición metodológica, rangos de escala psicométrica y constructos matemáticos del modelo.</Text>
            </View>
            <Pressable onPress={() => setCodebook((v) => !v)}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{codebook ? 'Ocultar variables ⌃' : 'Mostrar variables ⌄'}</Text></Pressable>
          </View>
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

function FilaDato({ k, v, tinta = color.texto }: { k: string; v: string; tinta?: string }) {
  return <View style={[e.fila, { justifyContent: 'space-between' }]}><Text style={[texto.dato, { color: color.textoMedio }]}>{k}</Text><Mono tono={tinta} tamano={12}>{v}</Mono></View>
}

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.lg, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  integridad: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12, gap: 4, maxWidth: 260 },
  puntoVerde: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.primarioProfundo },
  tabla: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 8, backgroundColor: '#F5F4F1' },
  tablaOn: { backgroundColor: '#F5F4F1' },
  casilla: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#BDB8B1', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  casillaOn: { backgroundColor: color.primarioProfundo, borderColor: color.primarioProfundo },
  formato: { flex: 1, minWidth: 80, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1EFEB', gap: 2 },
  formatoOn: { backgroundColor: color.primarioProfundo },
  panelGris: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: 12, gap: 6 },
  hash: { backgroundColor: '#F1EFEB', borderRadius: 6, padding: 10 },
  botonZip: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.primarioProfundo, borderRadius: 8, paddingVertical: 12, gap: 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8' },
  variable: { flexBasis: '48%', flexGrow: 1, minWidth: 260, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 12, gap: 6 },
})

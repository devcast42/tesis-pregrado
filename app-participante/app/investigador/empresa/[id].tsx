/** Ficha de empresa — implementa ESP-008 y ESP-009 RF-009-15.
 *  Mismo lenguaje visual que Figma 2IqfFSK20uCzmuMg6SvaUZ (no tiene marco propio).
 *
 *  Aquí viven los maestros que dependen de una empresa: sus participantes
 *  (por código) y sus administradores. Los psicólogos NO: pertenecen al
 *  estudio. Dar de baja conserva las respuestas y no cierra la derivación
 *  abierta (RN-008-16). */

import { useCallback, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Panel } from '../../../modules/panel/Sidebar'
import { conFiltro, useFiltro } from '../../../modules/investigador/filtro'
import { cerrarSeguimiento, participantes as cargarParticipantes, pulsoPorEmpresa, umbralesEmpresa, type FilaParticipanteV2 } from '../../../modules/investigador/panel'
import {
  listarAdmins, listarEmpresas, participacionDeEmpresa, restablecerParticipante,
  type Administrador, type Empresa, type FilaParticipacion,
} from '../../../modules/panel/datos'
import { DialogoPersona } from '../../../modules/investigador/DialogoPersona'
import { BarraPct, BotonChico, Caja, Codigo, Encabezado, Mono, Pastilla, PastillaEstado, PastillaNivel, Rotulo, TONO } from '../../../modules/investigador/piezas'
import { Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoAgregar, IconoEquipo, IconoEscudoCheck, IconoHistorial, IconoPersona, IconoVolver } from '../../../modules/nucleo/iconos'

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined
type Pestana = 'participantes' | 'admins'

export default function DetalleEmpresa() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { filtro } = useFiltro()
  const [pestana, setPestana] = useState<Pestana>('participantes')
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [filas, setFilas] = useState<FilaParticipanteV2[] | null>(null)
  const [participacion, setParticipacion] = useState<FilaParticipacion[]>([])
  const [admins, setAdmins] = useState<Administrador[]>([])
  const [nivel, setNivel] = useState<'bajo' | 'a_vigilar' | 'alto' | null>(null)
  const [formulario, setFormulario] = useState<Pestana | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credencial, setCredencial] = useState<{ titulo: string; correo?: string; contrasena: string; nota: string } | null>(null)
  const [falloCarga, setFalloCarga] = useState<string | null>(null)

  // Si una consulta falla hay que decirlo. Sin este `catch`, la promesa se
  // rechazaba sin que nadie la escuchara, los estados se quedaban en null y la
  // pantalla giraba para siempre sin un solo mensaje.
  const cargar = useCallback(async () => {
    setFalloCarga(null)
    try {
      const [empresas, p, pa, a, pulso, umbrales] = await Promise.all([
        listarEmpresas(), cargarParticipantes({ organizacion_id: id }), participacionDeEmpresa(id), listarAdmins(id), pulsoPorEmpresa(), umbralesEmpresa(),
      ])
      // Una empresa que no está no es un error de red: hay que decirlo, o la
      // pantalla se queda girando para siempre con un enlace viejo.
      const laEmpresa = empresas.find((x) => x.id === id) ?? null
      if (!laEmpresa) { setFalloCarga('Esta empresa ya no existe. Puede que la hayan retirado del estudio.'); return }
      setEmpresa(laEmpresa); setFilas(p); setParticipacion(pa); setAdmins(a)
      const pul = pulso.find((x) => x.organizacion_id === id), u = umbrales.find((x) => x.dimension === 'agotamiento')
      setNivel(pul?.agotamiento != null && u ? (pul.agotamiento >= Number(u.alto) ? 'alto' : pul.agotamiento >= Number(u.a_vigilar) ? 'a_vigilar' : 'bajo') : null)
    } catch (ex) {
      // Los errores de Supabase son objetos planos, no instancias de Error.
      const msg = ex instanceof Error ? ex.message
        : ex && typeof ex === 'object' && 'message' in ex ? String((ex as { message: unknown }).message ?? '') : ''
      setFalloCarga(msg || 'No se pudieron cargar los datos de la empresa.')
    }
  }, [id])
  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const aviso = (t: string, m: string) => Platform.OS === 'web' ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m)
  async function restablecer(p: FilaParticipanteV2) {
    setError(null)
    try { const r = await restablecerParticipante(p.id); setCredencial({ titulo: `Nueva contraseña de ${p.codigo_anonimo}`, contrasena: r.contrasena, nota: 'No se vuelve a mostrar.' }) }
    catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.') }
  }
  function darDeBaja(p: FilaParticipanteV2) {
    const texto = `Dar de baja a ${p.codigo_anonimo} por salida de la empresa.\n\nSus respuestas se conservan anonimizadas para el estudio; si tiene una derivación abierta, el psicólogo termina su caso. No se puede deshacer desde aquí.`
    const ok = Platform.OS === 'web' ? window.confirm(texto) : true
    if (!ok) return
    cerrarSeguimiento(p.id, 'salida_empresa').then(cargar).catch((ex) => setError(ex instanceof Error ? ex.message : 'No se pudo dar de baja.'))
  }

  if (falloCarga) return (
    <Panel rol="investigador">
      <View style={e.fallo}>
        <Text style={[texto.seccion, { color: color.texto }]}>No se pudo abrir la empresa</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio, textAlign: 'center' }]}>{falloCarga}</Text>
        <View style={[e.fila, { gap: espacio.sm }]}>
          <BotonChico onPress={() => { cargar() }} tono="verde">Reintentar</BotonChico>
          <BotonChico onPress={() => router.push(conFiltro('/investigador/empresas', filtro) as never)} tono="suave">Volver a Empresas</BotonChico>
        </View>
      </View>
    </Panel>
  )
  if (!filas || !empresa) return <Panel rol="investigador"><Cargando /></Panel>

  const consent = new Map(participacion.map((x) => [x.participante_id, x.consentimiento]))
  // «En seguimiento» es `estado = 'activo'`, y nada más: RF-007-06 deja fuera
  // del monitoreo a todo estado distinto, y RN-007-04 explica por qué al
  // detectado —su seguimiento diario terminó por diseño, no por incumplir—.
  // Esta pantalla contaba también a los detectados y decía 15 donde la lista
  // de Empresas, la vista `adherencia` y la barra superior decían 13.
  const activos = filas.filter((p) => p.estado === 'activo')
  // Y solo promedia a quien tiene dato, por si alguna fila llegara sin él:
  // con `?? 0` un hueco entraba como cero y hundía la media.
  const conAdh = activos.filter((p) => p.tasa_adherencia != null)
  const adhMedia = conAdh.length ? conAdh.reduce((s, p) => s + Number(p.tasa_adherencia), 0) / conAdh.length : null
  const pct = (x: number) => Math.round(x * 100)
  const detectados = filas.filter((p) => p.estado === 'detectado').length
  const fueraCount = filas.filter((p) => p.estado === 'finalizado' || p.estado === 'retirado').length
  const sinConsent = filas.filter((p) => consent.get(p.id) !== true).length
  const orden = [...filas].sort((a, b) => a.codigo_anonimo.localeCompare(b.codigo_anonimo))

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <Pressable onPress={() => router.push(conFiltro('/investigador/empresas', filtro) as never)} style={[e.fila, { gap: 4 }]}><IconoVolver tamano={12} color={color.textoMedio} /><Text style={[texto.dato, { color: color.textoMedio }]}>Empresas participantes</Text></Pressable>
        <Encabezado eyebrow="Ficha de empresa" titulo={empresa.nombre}
          subtitulo={`En el estudio desde el ${new Date(empresa.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}.`}
          derecha={(
            <View style={[e.fila, { gap: 8 }]}>
              <Pastilla tono={nivel === 'alto' ? TONO.tierra : nivel === 'a_vigilar' ? TONO.ambar : nivel ? TONO.verde : TONO.gris} punto>{nivel === 'alto' ? 'Pulso: Nivel Alto' : nivel === 'a_vigilar' ? 'Pulso: A vigilar' : nivel ? 'Pulso: Estable' : 'Pulso: sin OLBI aún'}</Pastilla>
              <BotonChico onPress={() => router.push(conFiltro('/investigador/participantes', { ...filtro, organizacion_id: id }) as never)} icono={<IconoEquipo tamano={13} color={color.texto} />}>Ver en Participantes</BotonChico>
            </View>
          )} />

        <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
          <Tarjeta rotulo="Inscritos" icono={<IconoPersona tamano={16} color={color.primarioProfundo} />}>
            <Cifra v={String(filas.length)} nota={sinConsent ? `${sinConsent} sin consentimiento` : 'todos consintieron'} />
          </Tarjeta>
          <Tarjeta rotulo="En seguimiento" icono={<IconoEquipo tamano={16} color={color.primarioProfundo} />}>
            <Cifra v={String(activos.length)} nota={detectados || fueraCount ? `${detectados} ${detectados === 1 ? 'detectado' : 'detectados'} · ${fueraCount} fuera` : 'todos los inscritos'} />
          </Tarjeta>
          <Tarjeta rotulo="Adherencia media" icono={<IconoHistorial tamano={16} color={color.primarioProfundo} />}>
            <Cifra v={adhMedia == null ? '—' : `${pct(adhMedia)}%`}
              nota={adhMedia == null ? 'sin check-ins todavía'
                : conAdh.length < activos.length ? `sobre ${conAdh.length} de ${activos.length} con dato`
                : 'días cumplidos de los esperados'}
              tinta={adhMedia != null && pct(adhMedia) < 80 ? '#B45309' : color.texto} />
          </Tarjeta>
        </View>

        {/* Pestañas */}
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <View style={e.segmentos}>
            {([['participantes', 'Participantes', filas.length], ['admins', 'Administradores', admins.length]] as const).map(([k, t, n]) => (
              <Pressable key={k} onPress={() => { setPestana(k); setFormulario(null) }} style={[e.segmento, pestana === k && e.segmentoOn]}>
                <Text style={[texto.datoFuerte, { color: pestana === k ? color.primarioProfundo : color.textoMedio }]}>{t}</Text><Pastilla tono={pestana === k ? TONO.verde : TONO.gris}>{String(n)}</Pastilla>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => { setFormulario(pestana); setError(null) }} style={e.botonLleno}>
            <IconoAgregar tamano={13} color="#FFFFFF" /><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{pestana === 'participantes' ? 'Inscribir participante' : 'Crear administrador'}</Text>
          </Pressable>
        </View>

        {error && <View style={e.error}><Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text></View>}
        {/* El alta enseña su credencial dentro del diálogo; esto es para
            «Restablecer», que no pasa por él y también la muestra una vez. */}
        {credencial && (
          <View style={e.credencial}>
            <View style={{ flex: 1, gap: 2, minWidth: 220 }}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{credencial.titulo}</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Contraseña: <Mono tono={color.texto} tamano={14}>{credencial.contrasena}</Mono></Text>
              <Text style={[texto.dato, { color: '#8C4A2B' }]}>{credencial.nota}</Text>
            </View>
            <BotonChico onPress={async () => { try { await navigator.clipboard.writeText(credencial.contrasena) } catch {} }} tono="suave">Copiar</BotonChico>
            <BotonChico onPress={() => setCredencial(null)} tono="suave">Cerrar</BotonChico>
          </View>
        )}

        {pestana === 'participantes' ? (
          <Caja estilo={{ gap: 4 }}>
            <View style={e.tablaCab}>
              {[['Participante', 1], ['Estado', 0.9], ['Adherencia', 1.3], ['Último OLBI', 0.9], ['Derivación', 1.6], ['', 1.5]].map(([h, f]) => (
                <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>
              ))}
            </View>
            {orden.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 12 }]}>Todavía no hay participantes en esta empresa.</Text>}
            {orden.map((p) => {
              const c = consent.get(p.id)
              const fuera = p.estado === 'finalizado' || p.estado === 'retirado'
              return (
                <View key={p.id} style={[e.tablaFila, fuera && { opacity: 0.6 }]}>
                  {/* El código es el enlace a la ficha: sobraba un botón «Ficha» que hacía lo mismo. */}
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(conFiltro(`/investigador/participante/${p.id}`, filtro) as never)}>
                    <Codigo>{p.codigo_anonimo}</Codigo>
                    <Mono>{`Semana ${Math.min(p.semana, 6)}`}</Mono>
                  </Pressable>

                  {/* El consentimiento solo se enseña cuando falta: una columna
                      entera de «Aceptado» no dice nada, y lo que hay que ver es
                      la excepción. */}
                  <View style={{ flex: 0.9, gap: 3 }}>
                    <PastillaEstado estado={p.estado} />
                    {c !== true && <Text style={[texto.dato, { color: '#8C4A2B' }]}>{c === false ? 'Rechazó el consentimiento' : 'Consentimiento pendiente'}</Text>}
                  </View>

                  <View style={{ flex: 1.3 }}>
                    {p.tasa_adherencia == null
                      ? <Text style={[texto.dato, { color: color.textoSuave }]}>sin dato</Text>
                      : <BarraPct tasa={Number(p.tasa_adherencia)} />}
                  </View>
                  <View style={{ flex: 0.9 }}><PastillaNivel nivel={p.olbi_nivel} /></View>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1.6 }]}>{p.estado_derivacion ? `${p.estado_derivacion === 'cerrada' ? 'Cerrada' : 'Abierta'} · ${p.psicologo ?? 'sin asignar'}` : '—'}</Text>

                  <View style={[e.fila, { flex: 1.5, gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }]}>
                    {!fuera && <BotonChico onPress={() => restablecer(p)} tono="suave">Restablecer</BotonChico>}
                    {!fuera && <Pressable onPress={() => darDeBaja(p)} style={e.botonBaja}><Text style={[texto.datoFuerte, { color: '#8C4A2B' }]}>Dar de baja</Text></Pressable>}
                  </View>
                </View>
              )
            })}
            <View style={[e.nota, { marginTop: 8 }]}>
              <IconoEscudoCheck tamano={13} color={color.primarioProfundo} />
              <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>«Dar de baja» cierra el seguimiento por salida de la empresa. Las respuestas se conservan y una derivación abierta sigue su curso.</Text>
            </View>
          </Caja>
        ) : (
          <Caja estilo={{ gap: 4 }}>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              {`Gestionan las cuentas de ${empresa.nombre} y ven su pulso agregado. Nunca respuestas, puntajes ni derivaciones.`}
            </Text>
            <View style={e.tablaCab}>
              {[['Administrador', 2], ['Estado', 1]].map(([h, f]) => <Text key={String(h)} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: Number(f) }]}>{String(h).toUpperCase()}</Text>)}
            </View>
            {admins.length === 0 && <Text style={[texto.apoyo, { color: color.textoMedio, paddingVertical: 12 }]}>Esta empresa no tiene administradores: nadie puede ver su pulso agregado ni gestionar sus cuentas.</Text>}
            {admins.map((a) => (
              <View key={a.id} style={e.tablaFila}>
                <View style={[e.fila, { flex: 2, gap: 10 }]}>
                  <View style={e.avatar}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{a.nombre.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</Text></View>
                  <Text style={[texto.datoFuerte, { color: color.texto }]}>{a.nombre}</Text>
                </View>
                <View style={{ flex: 1 }}>{a.activo ? <Pastilla tono={TONO.verde}>Activo</Pastilla> : <Pastilla tono={TONO.gris}>Inactivo</Pastilla>}</View>
              </View>
            ))}
          </Caja>
        )}
      </ScrollView>

      {formulario && (
        <DialogoPersona
          modo={formulario === 'participantes' ? 'participante' : 'admin'}
          organizacionId={id}
          empresa={empresa.nombre}
          onCerrar={() => setFormulario(null)}
          onCreada={cargar} />
      )}
    </Panel>
  )
}

function Campo({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor: string; onChange: (t: string) => void; placeholder: string }) {
  return (
    <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput value={valor} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.textoSuave} autoCapitalize="none" autoCorrect={false} style={[texto.dato, e.entrada, { outlineStyle: 'none' } as any]} />
    </View>
  )
}
function Tarjeta({ rotulo, icono, children }: { rotulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return <View style={e.tarjeta}><View style={[e.fila, { justifyContent: 'space-between' }]}><Rotulo>{rotulo}</Rotulo><View style={e.cuadroIcono}>{icono}</View></View>{children}</View>
}
function Cifra({ v, nota, tinta = color.texto }: { v: string; nota: string; tinta?: string }) {
  return <View><Text style={[texto.cifra, { color: tinta, fontFamily: MONO, fontSize: 26 }]}>{v}</Text><Text style={[texto.dato, { color: color.textoMedio }]}>{nota}</Text></View>
}

const e = StyleSheet.create({
  fallo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.sm, padding: espacio.lg },
  contenido: { padding: espacio.lg, gap: espacio.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  tarjeta: { flex: 1, minWidth: 180, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md, gap: 6 },
  cuadroIcono: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  segmentos: { flexDirection: 'row', backgroundColor: '#F1EFEB', borderRadius: 8, padding: 3 },
  segmento: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segmentoOn: { backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde },
  botonLleno: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 14, height: 38 },
  entrada: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  error: { backgroundColor: '#FBEDE6', borderRadius: 8, padding: 10 },
  credencial: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: 12, flexWrap: 'wrap' },
  tablaCab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8' },
  botonBaja: { height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F3DDD2', backgroundColor: color.superficie, justifyContent: 'center' },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F4F1', borderRadius: 8, padding: 10 },
  avatar: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
})

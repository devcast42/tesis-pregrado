/** Personas y participación (admin) — implementa ESP-008 RF-008-05, RF-008-06,
 *  RF-008-09 y rev. 2 RF-008-19, RF-008-20. Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x
 *  «Personas y Participación».
 *
 *  El único lugar del panel con nombres, porque el admin fue quien inscribió
 *  a esa gente; nunca al lado de un dato de salud. Inscribe, restablece
 *  contraseñas, da de baja al que deja la empresa. La empresa se toma del
 *  servidor, no de la pantalla. */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Credenciales } from '../../modules/panel/Tabla'
import { Monograma } from '../../modules/panel/Piezas'
import {
  inscribirParticipante, miEmpresa, participacionDeEmpresa, restablecerParticipante, resumenDeEmpresa,
  type Empresa, type FilaParticipacion, type ResumenEmpresa,
} from '../../modules/panel/datos'
import { darDeBaja, participacionSemanal, type ParticipacionSemana } from '../../modules/panel/empresario'
import { Caja, NotaAgregacion, Pastilla, Pie } from '../../modules/panel/PiezasEmpresario'
import { Aviso, Boton, Cargando, Entrada, Etiqueta, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import {
  IconoAgregar, IconoBarras, IconoCandado, IconoCheckCirculo, IconoChevronAbajo, IconoCredencial, IconoEquipo, IconoEscudo,
  IconoEscudoCheck, IconoLupa, IconoNota, IconoReloj,
} from '../../modules/nucleo/iconos'

const MINIMO = 10
type Filtro = 'todos' | 'seguimiento' | 'fuera' | 'pendiente'

export default function PersonasAdmin() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [filas, setFilas] = useState<FilaParticipacion[] | null>(null)
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null)
  const [semanal, setSemanal] = useState<ParticipacionSemana[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [filtroAbierto, setFiltroAbierto] = useState(false)
  const [formulario, setFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ correo: string; contrasena: string } | null>(null)
  const [reseteo, setReseteo] = useState<{ codigo: string; contrasena: string } | null>(null)
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 8

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [f, r, s] = await Promise.all([participacionDeEmpresa(em.id), resumenDeEmpresa(em.id), participacionSemanal(em.id)])
      setFilas(f); setResumen(r); setSemanal(s)
    } else setFilas([])
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function inscribir() {
    if (!empresa) return
    setOcupado(true); setError(null); setReseteo(null)
    try {
      const r = await inscribirParticipante({ organizacion_id: empresa.id, correo, nombre })
      setNuevo({ correo, contrasena: r.contrasena })
      setNombre(''); setCorreo('')
      await cargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo inscribir.')
    } finally { setOcupado(false) }
  }

  async function restablecer(fila: FilaParticipacion) {
    setNuevo(null); setError(null)
    try {
      const r = await restablecerParticipante(fila.participante_id)
      setReseteo({ codigo: fila.codigo_anonimo, contrasena: r.contrasena })
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.')
    }
  }

  function confirmarBaja(fila: FilaParticipacion) {
    const ejecutar = async () => {
      setNuevo(null); setReseteo(null); setError(null)
      try { await darDeBaja(fila.participante_id); await cargar() } catch (ex) {
        setError(ex instanceof Error ? ex.message : 'No se pudo dar de baja.')
      }
    }
    const mensaje = `${fila.nombre ?? fila.codigo_anonimo} dejará de recibir cuestionarios. Sus respuestas se conservan anonimizadas bajo su código y, si tenía una sesión de apoyo en curso, esta continúa. No se puede deshacer desde aquí.`
    if (Platform.OS === 'web') {
      if (window.confirm(`Dar de baja por salida de la empresa\n\n${mensaje}`)) ejecutar()
      return
    }
    Alert.alert('Dar de baja por salida de la empresa', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Dar de baja', style: 'destructive', onPress: ejecutar },
    ])
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (filas ?? []).filter((x) => {
      if (filtro === 'seguimiento' && !x.en_seguimiento) return false
      if (filtro === 'fuera' && x.en_seguimiento) return false
      if (filtro === 'pendiente' && x.consentimiento === true) return false
      if (!q) return true
      return [x.nombre, x.correo_contacto, x.codigo_anonimo].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [filas, busqueda, filtro])
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas - 1)
  const enPagina = visibles.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)

  if (!filas) return <Panel rol="admin"><Cargando /></Panel>

  const ult = semanal[semanal.length - 1]
  const tasa = ult?.tasa_respuesta_pct ?? null
  const inscritos = resumen?.inscritos ?? filas.length
  const pctAdopcion = inscritos ? Math.round(100 * (resumen?.consintieron ?? 0) / inscritos) : 0
  const pctSeguimiento = inscritos ? Math.round(100 * (resumen?.en_seguimiento ?? 0) / inscritos) : 0
  const ETIQUETA_FILTRO: Record<Filtro, string> = { todos: 'Todos los estados', seguimiento: 'En seguimiento', fuera: 'Fuera de seguimiento', pendiente: 'Consentimiento pendiente' }

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <View style={e.fila}>
              <Pastilla fondo="#EDEBE7" tinta={color.textoMedio} icono={<IconoCandado tamano={11} color={color.textoMedio} />}>GESTIÓN DE ACCESO • COHORTE ACTIVA</Pastilla>
            </View>
            <Text style={[texto.titulo, { color: color.texto }]}>Personas y Participación</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 560 }]}>
              Gestión de credenciales corporativas y monitor de representatividad del estudio.
            </Text>
          </View>
          <View style={e.aislamiento}>
            <IconoEscudo tamano={20} color={color.primarioProfundo} />
            <View style={{ flex: 1 }}>
              <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 11 }]}>AISLAMIENTO EPISTÉMICO</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Sin acceso a datos de salud ni métricas individuales</Text>
            </View>
          </View>
        </View>

        {!empresa ? (
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa al equipo del estudio.</Aviso>
        ) : (
          <>
            {/* Indicadores (RF-008-19) */}
            <View style={e.indicadores}>
              <Indicador rotulo="Total inscritos" icono={<IconoCredencial tamano={18} color={color.primarioProfundo} />}
                cifra={String(inscritos)} unidad="personas" nota="Censo completo de la cohorte tech" />
              <Indicador rotulo="Consintieron formalmente" icono={<IconoNota tamano={18} color={color.primarioProfundo} />}
                cifra={String(resumen?.consintieron ?? 0)} unidad={`${pctAdopcion}% de adopción`} nota="Consentimiento ético validado" notaIcono="check" />
              <Indicador rotulo="En seguimiento activo" icono={<IconoEscudoCheck tamano={18} color={color.primarioProfundo} />}
                cifra={String(resumen?.en_seguimiento ?? 0)} unidad={`${pctSeguimiento}% del total`} nota="Interacción regular confirmada" />
              <Indicador rotulo="Tasa de respuesta semanal" icono={<IconoBarras tamano={18} color={color.primarioProfundo} />}
                cifra={tasa != null ? `${tasa}%` : '—'} unidad={tasa != null && tasa >= 60 ? 'estabilizada' : 'del viernes'}
                nota={tasa != null && tasa >= 60 ? '> 60% umbral mínimo superado' : 'Se mide con el cuestionario del viernes'} notaIcono="tendencia"
                tono={tasa != null && tasa < 60 ? color.alerta : undefined} />
            </View>

            {/* Muestra */}
            <View style={e.muestra}>
              <View style={e.muestraIcono}><IconoCheckCirculo tamano={22} color={color.primarioProfundo} /></View>
              <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
                <View style={e.fila}>
                  <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                    {resumen?.reportable ? `Muestra robusta${tasa != null ? ` (${tasa}%)` : ''}` : 'Muestra en formación'}
                  </Text>
                  <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 10 }]}>{resumen?.reportable ? `VÁLIDO PARA K ≥ ${MINIMO}` : `REQUIERE K ≥ ${MINIMO}`}</Text>
                </View>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                  {resumen?.reportable
                    ? tasa != null && tasa >= 60
                      ? 'El umbral de reporte semanal está garantizado y los resultados son estadísticamente sólidos. No hay riesgo de sesgo de no-respuesta.'
                      : 'El umbral de reporte está garantizado, pero con menos del 60 % de respuesta la lectura semanal es poco fiable. Recuerda en la reunión de equipo que las respuestas son anónimas.'
                    : `Con menos de ${MINIMO} personas inscritas no se publican cifras semanales: un porcentaje señalaría a personas concretas.`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[texto.dato, { color: color.textoSuave }]}>Próximo cierre de ciclo</Text>
                <Text style={[texto.apoyoFuerte, { color: color.texto }]}>Viernes, 18:00 PET</Text>
              </View>
            </View>

            {/* Herramientas */}
            <Caja estilo={{ padding: espacio.base }}>
              <View style={[e.fila, { justifyContent: 'space-between', gap: espacio.md }]}>
                <View style={[e.fila, { flex: 1, minWidth: 300 }]}>
                  <View style={e.buscador}>
                    <IconoLupa tamano={16} color={color.textoSuave} />
                    <TextInput
                      value={busqueda} onChangeText={(t) => { setBusqueda(t); setPagina(0) }}
                      placeholder="Buscar por nombre, correo o código" placeholderTextColor={color.textoSuave}
                      style={e.buscadorEntrada} autoCapitalize="none" autoCorrect={false}
                    />
                  </View>
                  <View>
                    <Pressable onPress={() => setFiltroAbierto((v) => !v)} style={e.selector} accessibilityRole="button">
                      <Text style={[texto.apoyo, { color: color.texto }]}>{ETIQUETA_FILTRO[filtro]}</Text>
                      <IconoChevronAbajo tamano={18} color={color.textoMedio} />
                    </Pressable>
                    {filtroAbierto && (
                      <View style={e.menu}>
                        {(Object.keys(ETIQUETA_FILTRO) as Filtro[]).map((k) => (
                          <Pressable key={k} onPress={() => { setFiltro(k); setFiltroAbierto(false); setPagina(0) }} style={e.menuItem}>
                            <Text style={[texto.apoyo, { color: k === filtro ? color.primarioProfundo : color.texto }]}>{ETIQUETA_FILTRO[k]}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => setFormulario((v) => !v)} style={e.botonVerde} accessibilityRole="button">
                  <IconoAgregar tamano={18} color="#FFFFFF" />
                  <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>{formulario ? 'Cerrar' : '+ Inscribir persona'}</Text>
                </Pressable>
              </View>

              {formulario && (
                <View style={e.alta}>
                  <View style={e.campo}>
                    <Etiqueta>Nombre</Etiqueta>
                    <Entrada value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" />
                  </View>
                  <View style={e.campo}>
                    <Etiqueta>Correo corporativo</Etiqueta>
                    <Entrada value={correo} onChangeText={setCorreo} placeholder="correo@empresa.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  </View>
                  <Boton onPress={inscribir} inhabilitado={!nombre.trim() || !correo.includes('@')} cargando={ocupado}>Inscribir</Boton>
                </View>
              )}
              {error && <View style={{ marginTop: espacio.md }}><Aviso>{error}</Aviso></View>}
              {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena} nota="No se vuelve a mostrar. Si se pierde, restablécela desde la tabla." />}
              {reseteo && <Credenciales contrasena={reseteo.contrasena} nota={`Nueva contraseña de ${reseteo.codigo}. No se vuelve a mostrar.`} />}
            </Caja>

            {/* Tabla */}
            <Caja estilo={{ padding: 0, overflow: 'hidden' }}>
              <View style={e.tablaCabecera}>
                {[['NOMBRE', 2], ['CORREO CORPORATIVO', 2.2], ['CÓDIGO ANÓNIMO', 1.1], ['INSCRIPCIÓN', 1], ['CONSENTIMIENTO', 1.2], ['ESTADO', 1.3], ['', 1.6]].map(([h, f]) => (
                  <Text key={String(h) || 'acciones'} style={[texto.etiqueta, { color: color.textoMedio, flex: Number(f), fontSize: 11 }]}>{h}</Text>
                ))}
              </View>
              {enPagina.length === 0 && (
                <Text style={[texto.apoyo, { color: color.textoMedio, padding: espacio.lg }]}>
                  {filas.length === 0 ? 'Todavía no has inscrito a nadie.' : 'Nadie coincide con la búsqueda.'}
                </Text>
              )}
              {enPagina.map((x) => (
                <View key={x.participante_id} style={e.tablaFila}>
                  <View style={[e.fila, { flex: 2 }]}>
                    <Monograma nombre={x.nombre ?? x.codigo_anonimo} />
                    <Text style={[texto.cuerpoFuerte, { color: color.texto }]} numberOfLines={1}>{x.nombre ?? '—'}</Text>
                  </View>
                  <Text style={[e.mono, { flex: 2.2 }]} numberOfLines={1}>{x.correo_contacto ?? '—'}</Text>
                  <View style={{ flex: 1.1, flexDirection: 'row' }}>
                    <View style={e.chipCodigo}><Text style={[e.mono, { color: color.texto }]}>{x.codigo_anonimo}</Text></View>
                  </View>
                  <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
                    {new Date(x.inscrito_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')}
                  </Text>
                  <View style={[e.fila, { flex: 1.2, gap: 4 }]}>
                    {x.consentimiento === true
                      ? <><IconoCheckCirculo tamano={14} color={color.primarioProfundo} /><Text style={[texto.apoyo, { color: color.primarioProfundo }]}>Sí (Firmado)</Text></>
                      : x.consentimiento === false
                        ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>Rechazado</Text>
                        : <><IconoReloj tamano={14} color={color.textoMedio} /><Text style={[texto.apoyo, { color: color.textoMedio }]}>Pendiente</Text></>}
                  </View>
                  <View style={{ flex: 1.3, flexDirection: 'row' }}>
                    {x.en_seguimiento
                      ? <Pastilla fondo="#DDF3EA" tinta={color.primarioProfundo} punto={color.primario}>En seguimiento</Pastilla>
                      : <Pastilla fondo="#EDEBE7" tinta={color.textoMedio}>Fuera de seguimiento</Pastilla>}
                  </View>
                  <View style={{ flex: 1.6, alignItems: 'flex-end', gap: 4 }}>
                    <Pressable onPress={() => restablecer(x)} style={e.accion} accessibilityRole="button"><Text style={[texto.dato, { color: color.texto }]}>Restablecer clave</Text></Pressable>
                    {x.en_seguimiento && (
                      <Pressable onPress={() => confirmarBaja(x)} style={e.accion} accessibilityRole="button"><Text style={[texto.dato, { color: color.textoMedio }]}>Dar de baja</Text></Pressable>
                    )}
                  </View>
                </View>
              ))}
              <View style={e.tablaPie}>
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>Mostrando {enPagina.length} de {visibles.length} integrantes registrados</Text>
                <Pressable disabled={pag === 0} onPress={() => setPagina(pag - 1)}><Text style={[texto.dato, { color: pag === 0 ? color.textoSuave : color.texto }]}>Anterior</Text></Pressable>
                <View style={e.numeroPagina}><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{pag + 1}</Text></View>
                <Pressable disabled={pag >= paginas - 1} onPress={() => setPagina(pag + 1)}><Text style={[texto.dato, { color: pag >= paginas - 1 ? color.textoSuave : color.texto }]}>Siguiente</Text></Pressable>
              </View>
            </Caja>

            {/* Garantía */}
            <View style={e.garantia}>
              <View style={e.muestraIcono}><IconoEscudoCheck tamano={20} color={color.primarioProfundo} /></View>
              <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Garantía ética de desconexión de datos</Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                  El administrador gestiona la nómina de participantes pero jamás tiene acceso a respuestas individuales, puntajes OLBI o uso del servicio de apoyo. Mínimo de reporte por grupo: {MINIMO} personas. «Fuera de seguimiento» no dice por qué: puede ser fin de participación, retiro del consentimiento o acompañamiento.
                </Text>
              </View>
              <View style={e.chipMono}><Text style={[e.mono, { color: color.primarioProfundo }]}>k-anonymity ≥ {MINIMO} • Agregación activa</Text></View>
            </View>

            <NotaAgregacion minimo={MINIMO} />
            <Pie />
          </>
        )}
      </Pantalla>
    </Panel>
  )
}

function Indicador({ rotulo, icono, cifra, unidad, nota, notaIcono, tono }: {
  rotulo: string; icono: React.ReactNode; cifra: string; unidad: string; nota: string; notaIcono?: 'check' | 'tendencia'; tono?: string
}) {
  return (
    <View style={{ flex: 1, minWidth: 190 }}>
      <Caja estilo={{ padding: espacio.base, gap: 6 }}>
        <View style={[e.fila, { justifyContent: 'space-between' }]}>
          <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 11, flex: 1 }]}>{rotulo.toUpperCase()}</Text>
          {icono}
        </View>
        <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
          <Text style={[texto.cifra, { color: tono ?? color.texto, fontSize: 30, lineHeight: 34 }]}>{cifra}</Text>
          <Text style={[texto.apoyoFuerte, { color: tono ?? color.primarioProfundo, paddingBottom: 4 }]}>{unidad}</Text>
        </View>
        <View style={[e.fila, { gap: 6 }]}>
          {notaIcono === 'check' ? <IconoCheckCirculo tamano={12} color={color.primarioProfundo} />
            : notaIcono === 'tendencia' ? <IconoBarras tamano={12} color={color.primarioProfundo} />
            : <View style={e.puntoNota} />}
          <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{nota}</Text>
        </View>
      </Caja>
    </View>
  )
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  aislamiento: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F1EFEB', borderRadius: radio.md, padding: espacio.md, maxWidth: 300 },
  indicadores: { flexDirection: 'row', gap: espacio.base, flexWrap: 'wrap' },
  puntoNota: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.primario },
  muestra: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: '#F1EFEB', borderRadius: radio.lg, padding: espacio.lg, flexWrap: 'wrap' },
  muestraIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDF3EA', alignItems: 'center', justifyContent: 'center' },
  buscador: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, paddingHorizontal: espacio.md, height: 44 },
  buscadorEntrada: { flex: 1, ...texto.apoyo, color: color.texto, paddingVertical: 8 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, paddingHorizontal: espacio.md, height: 44, minWidth: 190, justifyContent: 'space-between' },
  menu: { position: 'absolute', top: 48, left: 0, right: 0, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 10, elevation: 4 },
  menuItem: { paddingHorizontal: espacio.md, paddingVertical: 10 },
  botonVerde: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.primario, borderRadius: radio.md, paddingHorizontal: espacio.base, height: 44 },
  alta: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: espacio.base, paddingTop: espacio.base, borderTopWidth: 1, borderTopColor: color.borde },
  campo: { flex: 1, minWidth: 190, gap: espacio.xs },
  tablaCabecera: { flexDirection: 'row', gap: espacio.sm, paddingVertical: espacio.md, paddingHorizontal: espacio.base, backgroundColor: '#F5F4F1' },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 12, paddingHorizontal: espacio.base, borderTopWidth: 1, borderTopColor: color.borde, flexWrap: 'nowrap' },
  tablaPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, paddingVertical: espacio.md, paddingHorizontal: espacio.base, borderTopWidth: 1, borderTopColor: color.borde },
  numeroPagina: { width: 26, height: 26, borderRadius: 6, backgroundColor: color.primario, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined, fontSize: 12, color: color.textoMedio },
  chipCodigo: { backgroundColor: '#F1EFEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipMono: { borderWidth: 1, borderColor: color.borde, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: color.superficie },
  accion: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F5F4F1' },
  garantia: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: '#E8F3EE', borderRadius: radio.lg, padding: espacio.lg, flexWrap: 'wrap' },
})

/** Personas y participación (admin) — implementa ESP-008 RF-008-05, RF-008-06,
 *  RF-008-09 y rev. 2 RF-008-19, RF-008-20. Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x
 *  «Personas y Participación».
 *
 *  El único lugar del panel con nombres, porque el admin fue quien inscribió
 *  a esa gente; nunca al lado de un dato de salud. Inscribe, restablece
 *  contraseñas, da de baja al que deja la empresa. La empresa se toma del
 *  servidor, no de la pantalla.
 *
 *  Escrita para quien lleva RR.HH.: antes la pastilla del encabezado decía
 *  «AISLAMIENTO EPISTÉMICO» y la tabla tenía siete columnas en seiscientos
 *  píxeles, con «Restablecer clave» partido en dos líneas y el estado
 *  cortado a media palabra. */

import { useCallback, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { Credenciales } from '../../modules/panel/Tabla'
import { Monograma } from '../../modules/panel/Piezas'
import {
  inscribirTrabajador, miEmpresa, participacionDeEmpresa, restablecerTrabajador, resumenDeEmpresa,
  type Empresa, type FilaParticipacion, type ResumenEmpresa,
} from '../../modules/panel/datos'
import { darDeBaja, participacionSemanal, type ParticipacionSemana } from '../../modules/panel/empresario'
import { Caja, NotaAgregacion, Pastilla, PastillaNivel, Pie } from '../../modules/panel/PiezasEmpresario'
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
      const r = await inscribirTrabajador({ organizacion_id: empresa.id, correo, nombre })
      setNuevo({ correo, contrasena: r.contrasena })
      setNombre(''); setCorreo('')
      await cargar()
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo crear la cuenta.')
    } finally { setOcupado(false) }
  }

  async function restablecer(fila: FilaParticipacion) {
    setNuevo(null); setError(null)
    try {
      const r = await restablecerTrabajador(fila.trabajador_id)
      setReseteo({ codigo: fila.codigo_anonimo, contrasena: r.contrasena })
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'No se pudo restablecer.')
    }
  }

  function confirmarBaja(fila: FilaParticipacion) {
    const ejecutar = async () => {
      setNuevo(null); setReseteo(null); setError(null)
      try { await darDeBaja(fila.trabajador_id); await cargar() } catch (ex) {
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
  const ETIQUETA_FILTRO: Record<Filtro, string> = {
    todos: 'Todas', seguimiento: 'Las que responden', fuera: 'Las que ya no participan', pendiente: 'Las que no han aceptado',
  }

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>Tu equipo</Text>
            <Text style={[texto.titulo, { color: color.texto }]}>Las personas de tu empresa</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 520 }]}>
              Quién está, cómo va y en qué nivel. Altas, bajas y contraseñas.
            </Text>
          </View>
          <View style={e.aislamiento}>
            <IconoEscudo tamano={20} color={color.primarioProfundo} />
            <View style={{ flex: 1 }}>
              <Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>Ves el nivel, no el detalle</Text>
              <Text style={[texto.dato, { color: color.textoMedio }]}>Cómo está, sí. Qué respondió, no.</Text>
            </View>
          </View>
        </View>

        {!empresa ? (
          <Aviso>Tu cuenta no está asociada a ninguna empresa. Avisa a soporte.</Aviso>
        ) : (
          <>
            {/* Indicadores (RF-008-19) */}
            <View style={e.indicadores}>
              <Indicador rotulo="Dadas de alta" icono={<IconoCredencial tamano={18} color={color.primarioProfundo} />}
                cifra={String(inscritos)} unidad="personas" />
              <Indicador rotulo="Han aceptado las condiciones" icono={<IconoNota tamano={18} color={color.primarioProfundo} />}
                cifra={String(resumen?.consintieron ?? 0)} unidad={`de ${inscritos}`}
                nota={pctAdopcion === 100 ? undefined : `faltan ${inscritos - (resumen?.consintieron ?? 0)}`} notaIcono="check" />
              <Indicador rotulo="Siguen respondiendo" icono={<IconoEscudoCheck tamano={18} color={color.primarioProfundo} />}
                cifra={String(resumen?.en_seguimiento ?? 0)} unidad={`de ${inscritos}`}
                nota={pctSeguimiento === 100 ? undefined : `${inscritos - (resumen?.en_seguimiento ?? 0)} ya no responden`} />
              <Indicador rotulo="Contestaron el último viernes" icono={<IconoBarras tamano={18} color={color.primarioProfundo} />}
                cifra={tasa != null ? `${tasa}%` : '—'} unidad={tasa != null ? 'de las dadas de alta' : 'sin datos aún'}
                nota={tasa != null && tasa < 60 ? 'bajo el 60 %: poco fiable' : undefined} notaIcono="tendencia"
                tono={tasa != null && tasa < 60 ? color.alerta : undefined} />
            </View>

            {/* Si hay suficiente gente, y quién lleva días sin contestar */}
            <View style={e.muestra}>
              <View style={e.muestraIcono}><IconoCheckCirculo tamano={22} color={color.primarioProfundo} /></View>
              <View style={{ flex: 1, minWidth: 260, gap: 4 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                  {resumen?.reportable ? 'Hay suficiente gente para enseñar promedios' : 'Todavía no hay suficiente gente'}
                </Text>
                <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                  {resumen?.reportable
                    ? tasa != null && tasa >= 60
                      ? 'Las cifras de las otras pantallas se pueden leer sin reservas.'
                      : `Esta semana contestó el ${tasa ?? 0} %. Bajo el 60 %, la lectura semanal es poco fiable.`
                    : `Hacen falta ${MINIMO} respuestas en la misma semana; con menos, una cifra señalaría a alguien.`}
                </Text>
              </View>
              <Text style={[texto.dato, { color: color.textoSuave }]}>El cuestionario largo es los viernes</Text>
            </View>

            {/* Lo único accionable de esta pantalla, y estaba en los datos
                sin enseñarse: cuánta gente lleva días sin responder. */}
            {(resumen?.sin_responder_4d ?? 0) > 0 && (
              <View style={e.recordatorio}>
                <IconoReloj tamano={16} color="#8A5A12" />
                <Text style={[texto.apoyo, { color: color.texto, flex: 1, minWidth: 260 }]}>
                  {`${resumen!.sin_responder_4d} ${resumen!.sin_responder_4d === 1 ? 'persona lleva' : 'personas llevan'} cuatro días o más sin contestar. Van marcadas en la lista.`}
                </Text>
              </View>
            )}

            {/* Herramientas */}
            {/* `zIndex` en la tarjeta entera, no solo en el menú: la tabla
                viene después en el documento y, con react-native-web, eso
                bastaba para taparlo. Del desplegable solo se veía la primera
                opción, así que el filtro no se podía usar. */}
            <Caja estilo={{ padding: espacio.base, zIndex: filtroAbierto ? 30 : 1 }}>
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
                  <View style={{ zIndex: filtroAbierto ? 30 : 1 }}>
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
                  <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>{formulario ? 'Cerrar' : 'Dar de alta a alguien'}</Text>
                </Pressable>
              </View>

              {formulario && (
                <View style={e.alta}>
                  <View style={e.campo}>
                    <Etiqueta>Nombre y apellido</Etiqueta>
                    <Entrada value={nombre} onChangeText={setNombre} placeholder="Como aparece en la nómina" />
                  </View>
                  <View style={e.campo}>
                    <Etiqueta>Su correo de trabajo</Etiqueta>
                    <Entrada value={correo} onChangeText={setCorreo} placeholder="correo@empresa.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  </View>
                  <Boton onPress={inscribir} inhabilitado={!nombre.trim() || !correo.includes('@')} cargando={ocupado}>Crear su cuenta</Boton>
                </View>
              )}
              {error && <View style={{ marginTop: espacio.md }}><Aviso>{error}</Aviso></View>}
              {nuevo && <Credenciales correo={nuevo.correo} contrasena={nuevo.contrasena} nota="No se vuelve a mostrar. Si se pierde, restablécela desde la tabla." />}
              {reseteo && <Credenciales contrasena={reseteo.contrasena} nota={`Nueva contraseña de ${reseteo.codigo}. No se vuelve a mostrar.`} />}
            </Caja>

            {/* La lista. Antes eran siete columnas en seiscientos píxeles:
                el correo truncado, «En seguimiento» cortado a media palabra
                y «Restablecer clave» partido en dos líneas. Ahora el correo
                va bajo el nombre y el consentimiento y el seguimiento se
                juntan en una sola columna, que es como se leen. */}
            <Caja estilo={{ padding: 0, overflow: 'hidden' }}>
              <View style={e.tablaCabecera}>
                {[['PERSONA', 2.6], ['CÓDIGO', 1], ['NIVEL', 1.6], ['CÓMO VA', 1.8], ['', 1.5]].map(([h, f]) => (
                  <Text key={String(h) || 'acciones'} style={[texto.etiqueta, { color: color.textoMedio, flex: Number(f), fontSize: 10.5 }]}>{h}</Text>
                ))}
              </View>
              {enPagina.length === 0 && (
                <View style={{ padding: espacio.lg, gap: 6 }}>
                  <Text style={[texto.apoyo, { color: color.texto }]}>
                    {filas.length === 0 ? 'Todavía no has dado de alta a nadie.' : 'Nadie coincide con lo que buscas.'}
                  </Text>
                  <Text style={[texto.dato, { color: color.textoMedio }]}>
                    {filas.length === 0
                      ? 'Usa «Dar de alta a alguien»: se le crea la cuenta y te damos su contraseña para entregársela.'
                      : 'Prueba con otro nombre, o quita el filtro de estado.'}
                  </Text>
                </View>
              )}
              {enPagina.map((x) => {
                const callada = x.en_seguimiento && x.dias_sin_responder != null && x.dias_sin_responder >= 4
                return (
                  <View key={x.trabajador_id} style={e.tablaFila}>
                    <View style={[e.fila, { flex: 2.6, flexWrap: 'nowrap' }]}>
                      <Monograma nombre={x.nombre ?? x.codigo_anonimo} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[texto.cuerpoFuerte, { color: color.texto }]} numberOfLines={1}>{x.nombre ?? '—'}</Text>
                        <Text style={[e.mono, { fontSize: 11 }]} numberOfLines={1}>{x.correo_contacto ?? 'sin correo'}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                      <View style={e.chipCodigo}><Text style={[e.mono, { color: color.texto }]}>{x.codigo_anonimo}</Text></View>
                    </View>
                    {/* El nivel, nunca el puntaje (consentimiento v3). El
                        número invitaría a comparar personas, que es justo lo
                        que no se vende. Y «en acompañamiento» va sin fecha ni
                        motivo: eso queda entre la persona y su psicólogo. */}
                    <View style={{ flex: 1.6, gap: 3, alignItems: 'flex-start' }}>
                      {x.nivel_agotamiento ? (
                        <PastillaNivel nivel={x.nivel_agotamiento} />
                      ) : (
                        <Text style={[texto.dato, { color: color.textoSuave }]}>sin medir aún</Text>
                      )}
                      {x.en_acompanamiento && (
                        <Pastilla fondo="#E8EFEA" tinta={color.primarioProfundo} punto={color.primario}>
                          En acompañamiento
                        </Pastilla>
                      )}
                    </View>
                    {/* Consentimiento y seguimiento son una sola idea para
                        quien lee: en qué punto está esta persona. */}
                    <View style={{ flex: 1.8, gap: 2 }}>
                      {x.consentimiento !== true ? (
                        <>
                          <View style={{ flexDirection: 'row' }}>
                            <Pastilla fondo="#EDEBE7" tinta={color.textoMedio}>{x.consentimiento === false ? 'No aceptó' : 'Falta que acepte'}</Pastilla>
                          </View>
                          <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>
                            {x.consentimiento === false ? 'Rechazó el consentimiento' : 'No ha abierto el enlace'}
                          </Text>
                        </>
                      ) : x.en_seguimiento ? (
                        <>
                          <View style={{ flexDirection: 'row' }}>
                            <Pastilla fondo={callada ? '#FBEFD9' : '#DDF3EA'} tinta={callada ? '#8A5A12' : color.primarioProfundo} punto={callada ? '#8A5A12' : color.primario}>
                              {callada ? 'Lleva días sin contestar' : 'Respondiendo'}
                            </Pastilla>
                          </View>
                          <Text style={[texto.dato, { color: callada ? '#8A5A12' : color.textoSuave, fontSize: 11 }]}>
                            {x.dias_sin_responder == null ? 'sin check-ins todavía'
                              : x.dias_sin_responder === 0 ? 'contestó hoy'
                              : `hace ${x.dias_sin_responder} ${x.dias_sin_responder === 1 ? 'día' : 'días'}`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <View style={{ flexDirection: 'row' }}>
                            <Pastilla fondo="#EDEBE7" tinta={color.textoMedio}>Ya no está activa</Pastilla>
                          </View>
                          <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>se dio de baja</Text>
                        </>
                      )}
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'flex-end', gap: 4 }}>
                      <Pressable onPress={() => restablecer(x)} style={e.accion} accessibilityRole="button">
                        <Text style={[texto.dato, { color: color.texto }]} numberOfLines={1}>Nueva contraseña</Text>
                      </Pressable>
                      {x.en_seguimiento && (
                        <Pressable onPress={() => confirmarBaja(x)} style={e.accion} accessibilityRole="button">
                          <Text style={[texto.dato, { color: color.textoMedio }]} numberOfLines={1}>Dar de baja</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )
              })}
              {visibles.length > 0 && (
                <View style={e.tablaPie}>
                  <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
                    {visibles.length <= POR_PAGINA
                      ? `${visibles.length} ${visibles.length === 1 ? 'persona' : 'personas'}`
                      : `${pag * POR_PAGINA + 1}–${pag * POR_PAGINA + enPagina.length} de ${visibles.length}`}
                    {visibles.length !== filas.length ? ` (de ${filas.length} en total)` : ''}
                  </Text>
                  {paginas > 1 && (
                    <>
                      <Pressable disabled={pag === 0} onPress={() => setPagina(pag - 1)}><Text style={[texto.dato, { color: pag === 0 ? color.textoSuave : color.texto }]}>Anterior</Text></Pressable>
                      <View style={e.numeroPagina}><Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{pag + 1}</Text></View>
                      <Pressable disabled={pag >= paginas - 1} onPress={() => setPagina(pag + 1)}><Text style={[texto.dato, { color: pag >= paginas - 1 ? color.textoSuave : color.texto }]}>Siguiente</Text></Pressable>
                    </>
                  )}
                </View>
              )}
            </Caja>

            {/* Un solo recordatorio de privacidad: antes había cuatro
                diciendo lo mismo —esta caja, `NotaAgregacion`, `Pie` y la del
                encabezado—, uno detrás de otro. */}
            <View style={e.garantia}>
              <View style={e.muestraIcono}><IconoEscudoCheck tamano={20} color={color.primarioProfundo} /></View>
              <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1, minWidth: 240 }]}>
                Ves el nivel de cada persona, no sus respuestas ni sus puntajes. De quien está en acompañamiento no verás el motivo ni lo que habla con su psicólogo.
              </Text>
            </View>
          </>
        )}
      </Pantalla>
    </Panel>
  )
}

/** Cifra del encabezado. La línea de apoyo es opcional: cuando no añade
 *  nada al rótulo, se omite en vez de rellenar con una frase. */
function Indicador({ rotulo, icono, cifra, unidad, nota, notaIcono, tono }: {
  rotulo: string; icono: React.ReactNode; cifra: string; unidad: string; nota?: string; notaIcono?: 'check' | 'tendencia'; tono?: string
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
        {nota != null && (
          <View style={[e.fila, { gap: 6 }]}>
            {notaIcono === 'check' ? <IconoCheckCirculo tamano={12} color={color.primarioProfundo} />
              : notaIcono === 'tendencia' ? <IconoBarras tamano={12} color={color.primarioProfundo} />
              : <View style={e.puntoNota} />}
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{nota}</Text>
          </View>
        )}
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
  recordatorio: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm, backgroundColor: '#FBEFD9', borderRadius: radio.md, padding: espacio.base, flexWrap: 'wrap' },
  buscador: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, paddingHorizontal: espacio.md, height: 44 },
  buscadorEntrada: { flex: 1, ...texto.apoyo, color: color.texto, paddingVertical: 8 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, paddingHorizontal: espacio.md, height: 44, minWidth: 190, justifyContent: 'space-between' },
  menu: { position: 'absolute', top: 48, left: 0, right: 0, minWidth: 210, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde, paddingVertical: 4, zIndex: 30, elevation: 8, shadowColor: '#1C1917', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
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

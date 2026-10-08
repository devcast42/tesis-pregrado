/** Ficha del caso — ESP-006 RF-006-03 … RF-006-06, RF-006-12, RF-006-14.
 *
 *  La pregunta que abre esta pantalla es «¿qué hago ahora con esta persona?».
 *  La anterior la contestaba al fondo, después de seis tarjetas: quién es,
 *  la identidad, la cita, los umbrales, la evolución, una proyección con su
 *  ROC-AUC y las sesiones. Para encontrar el botón había que bajar hasta el
 *  final, y el botón era casi siempre «Abrir sala», aunque no hubiera nadie
 *  con quien hablar.
 *
 *  Ahora va en este orden:
 *    1. quién es, en dos líneas;
 *    2. el siguiente paso, con su acción, calculado del estado del caso;
 *    3. su contacto, a un toque y registrado;
 *    4. por qué llegó, para quien quiera leerlo antes de la sesión;
 *    5. sus sesiones y su historia.
 *
 *  La identidad se pide aparte (RN-006-02) y cada consulta queda registrada
 *  (RN-006-03). El contexto de horas y sueño no se muestra (RN-006-07). */

import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  agenda, cancelarCitaComoPsicologo, cerrarDerivacion, confirmarCita, crearSesion, DESENLACES, obtenerCaso,
  obtenerIdentidad, perfilCaso, pronosticoCaso, proponerCita, trayectoriaOlbi,
  type Caso, type CitaAgenda, type Desenlace, type PerfilCaso, type PuntajeOlbi,
} from '../../../modules/psicologo/datos'
import { Avatar, SemanaCalendario, isoDia, lunesDe } from '../../../modules/psicologo/calendario'
import { BarraUmbral, ESTADO_CASO, Evolucion, Pastilla, fechaHoraCorta, haceCuanto } from '../../../modules/psicologo/piezas'
import { HORAS_OFRECIDAS } from '../../../modules/consulta/citas'
import { Boton, Cargando, Hoja, OpcionHoja, confirmar } from '../../../modules/nucleo/ui'
import { color, espacio, fuente, radio, sombra, texto } from '../../../modules/nucleo/diseno'
import { IconoCalendario, IconoCandado, IconoFlecha, IconoHistorial, IconoNota, IconoOjo, IconoVideo } from '../../../modules/nucleo/iconos'
import type { Prediccion } from '../../../modules/trabajador/resultado'

const ROL: Record<string, string> = {
  desarrollo: 'Desarrollo', qa: 'QA', datos: 'Datos', infraestructura: 'Infraestructura',
  soporte: 'Soporte técnico', diseno: 'Diseño o UX', gestion: 'Gestión de proyectos', otro: 'Otro rol',
}
const MODALIDAD: Record<string, string> = { remoto: 'remoto', hibrido: 'híbrido', presencial: 'presencial' }

/** Los cuatro desenlaces que se pueden elegir al cerrar. `otro` existe en la
 *  base pero sin nota no dice nada; la nota va aparte y sirve para todos. */
const DESENLACES_CIERRE: Desenlace[] = ['mejora', 'derivado_externo', 'abandono', 'sin_contacto']

export default function FichaCaso() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [caso, setCaso] = useState<Caso | null>(null)
  const [perfil, setPerfil] = useState<PerfilCaso | null>(null)
  const [trayectoria, setTrayectoria] = useState<PuntajeOlbi[]>([])
  const [pronostico, setPronostico] = useState<Prediccion | null>(null)
  const [identidad, setIdentidad] = useState<{ nombre: string; correo_contacto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [hoja, setHoja] = useState<null | 'cerrar' | 'proponer'>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const c = await obtenerCaso(id)
    if (!c) return router.back()
    setCaso(c)
    const [p, t, pr] = await Promise.all([
      perfilCaso(c.trabajador_id).catch(() => null),
      trayectoriaOlbi(c.trabajador_id).catch(() => []),
      pronosticoCaso(c.trabajador_id).catch(() => null),
    ])
    setPerfil(p); setTrayectoria(t); setPronostico(pr)
  }, [id])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  /** Toda acción pasa por aquí: ocupa la pantalla, recarga al terminar y, si
   *  falla, lo dice en la propia ficha en vez de en un diálogo que en web no
   *  aparece. */
  async function hacer(accion: () => Promise<unknown>, siFalla: string) {
    setOcupado(true); setError(null)
    try {
      await accion()
      await cargar()
    } catch {
      setError(siFalla)
    } finally {
      setOcupado(false)
    }
  }

  async function verIdentidad() {
    if (!caso) return
    try { setIdentidad(await obtenerIdentidad(caso.trabajador_id)) }
    catch { setError('El contacto solo se puede ver con el caso abierto.') }
  }

  async function entrarSala() {
    if (!caso) return
    setOcupado(true); setError(null)
    try {
      const sesionId = caso.sesion_id && !caso.sesion_finalizada_en ? caso.sesion_id : (await crearSesion(caso.derivacion_id)).id
      router.push(`/psicologo/consulta/${sesionId}`)
    } catch {
      setError('No se pudo abrir la sala. Inténtalo de nuevo en un momento.')
    } finally {
      setOcupado(false)
    }
  }

  async function noPuedo() {
    if (!caso?.cita_id) return
    const ok = await confirmar({
      titulo: 'Cancelar la cita',
      mensaje: 'La persona recibirá el aviso y podrá pedir otra hora. También puedes proponerle tú una.',
      aceptar: 'Cancelar la cita',
      destructivo: true,
    })
    if (ok) await hacer(() => cancelarCitaComoPsicologo(caso.cita_id!), 'No se pudo cancelar la cita.')
  }

  if (!caso) return <Cargando />

  const abierto = caso.estado_caso !== 'cerrado'
  const estado = ESTADO_CASO[caso.estado_caso]
  const agot = caso.puntajes?.agotamiento
  const desv = caso.puntajes?.desvinculacion
  const contexto = [
    caso.empresa,
    perfil?.rol ? ROL[perfil.rol] ?? perfil.rol : null,
    perfil?.modalidad ? MODALIDAD[perfil.modalidad] ?? perfil.modalidad : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Stack.Screen options={{ title: caso.codigo_anonimo }} />
      <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio.xxl + insets.bottom }]}>

        {/* 1 · Quién */}
        <View style={e.cabecera}>
          <Avatar empresa={caso.empresa} codigo={caso.codigo_anonimo} tamano={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[texto.seccion, { color: color.texto }]}>{caso.codigo_anonimo}</Text>
            {!!contexto && <Text style={[texto.apoyo, { color: color.textoMedio }]} numberOfLines={2}>{contexto}</Text>}
          </View>
        </View>
        <View style={[e.fila, { marginTop: -4 }]}>
          <Pastilla texto={estado.etiqueta} fondo={estado.fondo} tinta={estado.tinta} />
          <Text style={[texto.apoyo, { color: color.textoSuave, flex: 1 }]} numberOfLines={1}>
            {caso.origen === 'solicitud' ? 'Pidió la sesión por su cuenta' : 'Derivado por el sistema'} {haceCuanto(caso.abierta_en)}
          </Text>
        </View>

        {/* 2 · Siguiente paso */}
        <SiguientePaso
          caso={caso}
          ocupado={ocupado}
          onConfirmar={() => hacer(() => confirmarCita(caso.cita_id!), 'No se pudo confirmar la cita.')}
          onNoPuedo={noPuedo}
          onProponer={() => setHoja('proponer')}
          onSala={entrarSala}
          onNota={() => router.push(`/psicologo/informe/${caso.sesion_id}`)}
        />

        {!!error && (
          <View style={e.error}>
            <Text style={[texto.apoyo, { color: color.tierra }]}>{error}</Text>
          </View>
        )}

        {/* 3 · Contacto */}
        {abierto && (
          <View style={e.bloque}>
            {identidad ? (
              <View style={{ gap: 2 }}>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{identidad.nombre}</Text>
                <Text style={[texto.cuerpo, { color: color.textoMedio }]} selectable>{identidad.correo_contacto}</Text>
              </View>
            ) : (
              <Pressable onPress={verIdentidad} style={({ pressed }) => [e.filaAccion, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <IconoOjo tamano={18} color={color.primarioProfundo} />
                <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo, flex: 1 }]}>Ver nombre y correo</Text>
              </Pressable>
            )}
            <View style={[e.fila, { gap: 6 }]}>
              <IconoCandado tamano={12} color={color.textoSuave} />
              <Text style={[texto.apoyo, { color: color.textoSuave, flex: 1 }]}>Cada vez que lo abres queda registrado.</Text>
            </View>
          </View>
        )}

        {/* 4 · Por qué llegó */}
        <Text style={[texto.etiqueta, e.rotulo]}>POR QUÉ LLEGÓ</Text>
        <View style={e.bloque}>
          {typeof agot === 'number' || typeof desv === 'number' ? (
            <>
              {typeof agot === 'number' && <BarraUmbral dimension="agotamiento" puntaje={agot} umbral={caso.umbrales?.agotamiento} />}
              {typeof desv === 'number' && <BarraUmbral dimension="desvinculacion" puntaje={desv} umbral={caso.umbrales?.desvinculacion} />}
              {caso.detectado_en && (
                <Text style={[texto.apoyo, { color: color.textoSuave }]}>
                  Cuestionario OLBI del {new Date(caso.detectado_en).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}.
                </Text>
              )}
            </>
          ) : (
            <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
              {caso.origen === 'solicitud'
                ? 'Pidió la sesión por su cuenta, sin que el sistema detectara nada.'
                : 'Sin puntajes registrados en la detección.'}
            </Text>
          )}
        </View>

        {trayectoria.length > 1 && (
          <View style={e.bloque}>
            <Evolucion puntajes={trayectoria} umbrales={caso.umbrales} />
          </View>
        )}

        {pronostico?.probabilidad != null && (
          <View style={[e.bloque, e.fila, { alignItems: 'flex-start' }]}>
            <Text style={[texto.seccion, { color: color.texto, fontFamily: fuente.fuerte }]}>
              {Math.round(pronostico.probabilidad * 100)}%
            </Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              es lo que estima el modelo de que siga en nivel alto la semana que viene. Es un apoyo a tu
              criterio, no lo sustituye.
            </Text>
          </View>
        )}

        {/* 5 · Sesiones e historia */}
        <Text style={[texto.etiqueta, e.rotulo]}>SESIONES</Text>
        <View style={[e.bloque, { paddingVertical: 4 }]}>
          {caso.sesion_id && caso.sesion_finalizada_en ? (
            <FilaEnlace
              icono={<IconoNota tamano={16} color={color.textoMedio} />}
              texto={`Sesión ${haceCuanto(caso.sesion_finalizada_en)}`}
              detalle={caso.informe_estado === 'aprobado' ? 'Nota aprobada' : caso.informe_estado ? 'Nota por revisar' : 'Sin nota todavía'}
              onPress={() => router.push(`/psicologo/informe/${caso.sesion_id}`)}
            />
          ) : (
            <View style={[e.filaAccion, { paddingVertical: 12 }]}>
              <IconoNota tamano={16} color={color.textoSuave} />
              <Text style={[texto.cuerpo, { color: color.textoMedio, flex: 1 }]}>Todavía no ha tenido ninguna sesión.</Text>
            </View>
          )}
          <View style={e.divisor} />
          <FilaEnlace
            icono={<IconoHistorial tamano={16} color={color.textoMedio} />}
            texto="Historia completa"
            detalle="Todas sus derivaciones y notas"
            onPress={() => router.push(`/psicologo/persona/${caso.trabajador_id}`)}
          />
        </View>

        {abierto && (
          <Pressable onPress={() => setHoja('cerrar')} style={({ pressed }) => [e.cerrar, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={[texto.cuerpoFuerte, { color: color.textoMedio }]}>Cerrar caso</Text>
          </Pressable>
        )}

        <View style={[e.fila, { justifyContent: 'center', gap: 6 }]}>
          <IconoVideo tamano={12} color={color.textoSuave} />
          <Text style={[texto.apoyo, { color: color.textoSuave }]}>Las sesiones se graban solo en audio y solo si ambos aceptan.</Text>
        </View>
      </ScrollView>

      <HojaCerrar
        visible={hoja === 'cerrar'}
        onCerrar={() => setHoja(null)}
        onConfirmar={async (desenlace, nota) => {
          setHoja(null)
          setOcupado(true); setError(null)
          try {
            await cerrarDerivacion(caso.derivacion_id, desenlace, nota || undefined)
            router.back()
          } catch {
            setError('No se pudo cerrar el caso.')
          } finally {
            setOcupado(false)
          }
        }}
      />
      <HojaProponer
        visible={hoja === 'proponer'}
        onCerrar={() => setHoja(null)}
        onConfirmar={async (para) => {
          setHoja(null)
          await hacer(() => proponerCita(caso.derivacion_id, para), 'No se pudo proponer la hora.')
        }}
      />
    </>
  )
}

// ---------------------------------------------------------- Siguiente paso

/** Una sola tarjeta con lo que toca, sacado del estado del caso. Es la parte
 *  de la pantalla que más importa, así que es la única con color. */
function SiguientePaso({ caso, ocupado, onConfirmar, onNoPuedo, onProponer, onSala, onNota }: {
  caso: Caso
  ocupado: boolean
  onConfirmar: () => void
  onNoPuedo: () => void
  onProponer: () => void
  onSala: () => void
  onNota: () => void
}) {
  let titulo = ''
  let cuerpo: string | null = null
  let acciones: React.ReactNode = null

  switch (caso.estado_caso) {
    case 'sesion_pendiente':
      titulo = 'Propón una hora'
      cuerpo = `Nadie ha contactado todavía a esta persona. Derivada ${haceCuanto(caso.abierta_en)}.`
      acciones = (
        <>
          <Boton onPress={onProponer} cargando={ocupado}>Proponer día y hora</Boton>
          <Boton variante="texto" onPress={onSala}>O abre la sala ahora</Boton>
        </>
      )
      break
    case 'cita_por_confirmar':
      titulo = 'Confirma la cita'
      cuerpo = null
      acciones = (
        <View style={e.fila}>
          <View style={{ flex: 1 }}><Boton onPress={onConfirmar} cargando={ocupado}>Confirmar</Boton></View>
          <View style={{ flex: 1 }}><Boton variante="secundario" onPress={onNoPuedo}>No puedo</Boton></View>
        </View>
      )
      break
    case 'cita_confirmada':
      titulo = 'Cita confirmada'
      cuerpo = 'A la hora, abre la sala desde aquí; la persona entra desde su app.'
      acciones = <Boton onPress={onSala} cargando={ocupado}>Abrir la sala</Boton>
      break
    case 'sala_lista':
      titulo = 'La sala está abierta'
      cuerpo = caso.consentimiento_trabajador
        ? 'Ya aceptó la grabación de audio.'
        : 'Todavía no ha aceptado la grabación de audio.'
      acciones = <Boton onPress={onSala} cargando={ocupado}>Entrar a la videollamada</Boton>
      break
    case 'informe_por_aprobar':
      titulo = 'Revisa la nota de la sesión'
      cuerpo = 'El borrador está listo. Corrígelo, valóralo y apruébalo.'
      acciones = <Boton onPress={onNota}>Revisar la nota</Boton>
      break
    default:
      titulo = 'Caso cerrado'
      cuerpo = caso.cerrada_en ? `Se cerró ${haceCuanto(caso.cerrada_en)}.` : null
  }

  const conCita = (caso.estado_caso === 'cita_por_confirmar' || caso.estado_caso === 'cita_confirmada') && caso.cita_para

  return (
    <View style={[e.paso, caso.estado_caso === 'cerrado' && e.pasoApagado]}>
      <Text style={[texto.etiqueta, { color: caso.estado_caso === 'cerrado' ? color.textoSuave : color.primarioProfundo }]}>SIGUIENTE PASO</Text>
      <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
      {conCita && (
        <View style={[e.fila, { gap: 8 }]}>
          <IconoCalendario tamano={16} color={color.texto} />
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{fechaHoraCorta(caso.cita_para!)}</Text>
        </View>
      )}
      {conCita && !!caso.cita_motivo && (
        <Text style={[texto.cuerpo, { color: color.textoMedio, fontStyle: 'italic' }]}>«{caso.cita_motivo}»</Text>
      )}
      {!!cuerpo && <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{cuerpo}</Text>}
      {acciones && <View style={{ gap: espacio.xs, marginTop: 4 }}>{acciones}</View>}
    </View>
  )
}

// ------------------------------------------------------------------ Hojas

function HojaCerrar({ visible, onCerrar, onConfirmar }: {
  visible: boolean
  onCerrar: () => void
  onConfirmar: (desenlace: Desenlace, nota: string) => void
}) {
  const [desenlace, setDesenlace] = useState<Desenlace | null>(null)
  const [nota, setNota] = useState('')
  return (
    <Hoja visible={visible} titulo="¿Cómo termina el caso?" onCerrar={onCerrar}>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        Al cerrarlo dejas de tener acceso a esta persona. El desenlace sirve para saber si el acompañamiento funcionó.
      </Text>
      <View style={{ gap: espacio.xs }}>
        {DESENLACES_CIERRE.map((d) => (
          <OpcionHoja key={d} texto={DESENLACES[d]} activa={desenlace === d} onPress={() => setDesenlace(d)} />
        ))}
      </View>
      <TextInput
        value={nota}
        onChangeText={setNota}
        placeholder="Una nota, si quieres (opcional)"
        placeholderTextColor={color.textoSuave}
        style={e.entrada}
        multiline
      />
      <Boton inhabilitado={!desenlace} onPress={() => desenlace && onConfirmar(desenlace, nota.trim())}>Cerrar caso</Boton>
    </Hoja>
  )
}

/** Proponer una hora con el mismo calendario de la agenda: así se ve qué
 *  días ya tienen algo. Las horas en las que ya hay una cita salen tachadas:
 *  proponer encima de otra era posible y nadie se habría enterado hasta la
 *  hora de entrar. */
function HojaProponer({ visible, onCerrar, onConfirmar }: {
  visible: boolean
  onCerrar: () => void
  onConfirmar: (paraIso: string) => void
}) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [dia, setDia] = useState<string | null>(null)
  const [hora, setHora] = useState<number | null>(null)
  const [ocupadas, setOcupadas] = useState<CitaAgenda[]>([])

  // Las citas se piden cada vez que se abre: entre una apertura y otra
  // pueden haber cambiado.
  useEffect(() => { if (visible) agenda().then(setOcupadas).catch(() => {}) }, [visible])

  const ahora = new Date()
  const noDisponible = (d: Date) => {
    const dow = d.getDay()
    if (dow === 0 || dow === 6) return true
    const fin = new Date(d); fin.setHours(HORAS_OFRECIDAS[HORAS_OFRECIDAS.length - 1], 0, 0, 0)
    return fin.getTime() - ahora.getTime() < 60 * 60 * 1000
  }
  const marcas: Record<string, 'pendiente' | 'cita'> = {}
  for (const c of ocupadas) if (c.estado !== 'atendida') marcas[c.dia] = c.estado === 'solicitada' ? 'pendiente' : 'cita'

  const horaOcupada = (h: number) => !!dia && ocupadas.some((c) =>
    c.dia === dia && c.estado !== 'atendida' && new Date(c.propuesta_para).getHours() === h)
  const horaPasada = (h: number) => {
    if (!dia) return true
    const t = new Date(`${dia}T00:00:00`); t.setHours(h, 0, 0, 0)
    return t.getTime() - ahora.getTime() < 60 * 60 * 1000
  }

  return (
    <Hoja visible={visible} titulo="Propón día y hora" onCerrar={onCerrar}>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        Le llega ya confirmada: la propones tú, que eres quien tendría que confirmarla.
      </Text>
      <SemanaCalendario
        lunes={lunes}
        seleccionado={dia ?? ''}
        marcas={marcas}
        deshabilitar={noDisponible}
        onSeleccionar={(iso) => { setDia(iso); setHora(null) }}
        onSemana={(delta) => { const l = new Date(lunes); l.setDate(l.getDate() + 7 * delta); setLunes(l); setDia(null); setHora(null) }}
      />
      {dia ? (
        <View style={e.horas}>
          {HORAS_OFRECIDAS.map((h) => {
            const ocupada = horaOcupada(h)
            const pasada = horaPasada(h)
            const activa = hora === h
            return (
              <Pressable key={h} disabled={ocupada || pasada} onPress={() => setHora(h)}
                style={[e.hora, activa && e.horaActiva, (ocupada || pasada) && e.horaApagada]}
                accessibilityRole="radio" accessibilityState={{ selected: activa, disabled: ocupada || pasada }}>
                <Text style={[texto.cuerpoFuerte, {
                  color: activa ? '#FFFFFF' : ocupada || pasada ? color.textoSuave : color.texto,
                  textDecorationLine: ocupada ? 'line-through' : 'none',
                }]}>{`${String(h).padStart(2, '0')}:00`}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Text style={[texto.apoyo, { color: color.textoSuave, textAlign: 'center' }]}>Elige un día de la semana.</Text>
      )}
      <Boton
        inhabilitado={!dia || hora == null}
        onPress={() => {
          if (!dia || hora == null) return
          const t = new Date(`${dia}T00:00:00`); t.setHours(hora, 0, 0, 0)
          onConfirmar(t.toISOString())
        }}
      >
        {dia && hora != null
          ? `Proponer ${new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' })} · ${String(hora).padStart(2, '0')}:00`
          : 'Proponer esta hora'}
      </Boton>
    </Hoja>
  )
}

function FilaEnlace({ icono, texto: t, detalle, onPress }: {
  icono: React.ReactNode
  texto: string
  detalle: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [e.filaAccion, { paddingVertical: 12 }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      {icono}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{t}</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>{detalle}</Text>
      </View>
      <IconoFlecha tamano={13} color={color.textoSuave} />
    </Pressable>
  )
}

const e = StyleSheet.create({
  contenido: {
    paddingHorizontal: 20, paddingTop: espacio.sm, gap: espacio.md,
    width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.fondo, flexGrow: 1,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  rotulo: { color: color.textoSuave, marginTop: espacio.sm, marginBottom: -4 },
  bloque: {
    backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.base,
    gap: espacio.sm, ...sombra.suave,
  },
  paso: {
    backgroundColor: color.primarioSuave, borderRadius: radio.xl, padding: espacio.base,
    gap: espacio.xs, borderWidth: 1, borderColor: color.primarioClaro,
  },
  pasoApagado: { backgroundColor: color.superficieSuave, borderColor: color.borde },
  error: { backgroundColor: color.tierraSuave, borderRadius: radio.md, padding: 12 },
  divisor: { height: 1, backgroundColor: color.borde },
  cerrar: { alignItems: 'center', paddingVertical: 14, marginTop: espacio.sm },
  entrada: {
    minHeight: 64, padding: 12, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde,
    backgroundColor: color.superficie, fontFamily: fuente.regular, fontSize: 15, color: color.texto, textAlignVertical: 'top',
  },
  horas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hora: {
    width: '23%', alignItems: 'center', paddingVertical: 12, borderRadius: radio.md,
    backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde,
  },
  horaActiva: { backgroundColor: color.primarioProfundo, borderColor: color.primarioProfundo },
  horaApagada: { backgroundColor: color.superficieSuave, borderColor: 'transparent' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
})

/** Perfil, ajustes y derechos éticos — implementa ESP-001 (RF-001-07 retiro,
 *  RF-001-08 huella), ESP-002 (RF-002-16 datos iniciales, hora del
 *  recordatorio). Diseño: Figma IcncrzVKVbewGGc6RkImCM, frame «Perfil ·
 *  Participante».
 *
 *  Es la única pantalla desde la que el participante ejerce sus derechos
 *  sobre el estudio. Por eso el retiro pide confirmación pero no pone
 *  obstáculos: retirarse tiene que ser tan fácil como haber aceptado. */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cerrarSesion, obtenerParticipante } from '../../modules/acceso/datos'
import { registrarDecision } from '../../modules/consentimiento/datos'
import { activo as huellaActiva, disponible as huellaDisponible, fijarActivo as fijarHuella } from '../../modules/acceso/bloqueo'
import { datosIniciales, obtenerFormulario } from '../../modules/recoleccion/datos'
import {
  cancelarTodos, guardarHoraRecordatorio, horaRecordatorio, probarRecordatorio, recordatoriosDisponibles,
  type HoraRecordatorio,
} from '../../modules/recoleccion/recordatorios'
import { BarraSuperior } from '../../modules/participante/piezas'
import { Cargando } from '../../modules/nucleo/ui'
import {
  IconoAuto, IconoBalanza, IconoCheck, IconoCodigo, IconoEditar, IconoEquipo, IconoEscudo, IconoGrafica,
  IconoHuella, IconoMaletin, IconoPersona, IconoSalir, IconoCasa,
} from '../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import type { ItemDef, Participante, Valores } from '../../modules/nucleo/tipos'
import { ahora, cargarDesfase, fijarDesfase } from '../../modules/nucleo/reloj'
import { fechaLarga, semanaDelEstudio } from '../../modules/participante/textos'

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** Cómo se muestra cada dato del formulario `estable` en el mosaico: rótulo
 *  corto (la pregunta completa no cabe), ícono y unidad. */
const MOSAICO: Record<string, { rotulo: string; icono: (c: string) => ReactNode; unidad?: (v: number) => string }> = {
  edad: { rotulo: 'Edad', icono: (c) => <IconoPersona tamano={16} color={c} />, unidad: (v) => `${v} años` },
  rol: { rotulo: 'Rol', icono: (c) => <IconoCodigo tamano={16} color={c} /> },
  antiguedad_empresa: { rotulo: 'En empresa', icono: (c) => <IconoMaletin tamano={16} color={c} />, unidad: (v) => v === 1 ? '1 año' : `${v} años` },
  antiguedad_sector: { rotulo: 'En tecnología', icono: (c) => <IconoGrafica tamano={16} color={c} />, unidad: (v) => v === 1 ? '1 año' : `${v} años` },
  modalidad: { rotulo: 'Modalidad', icono: (c) => <IconoCasa tamano={16} color={c} /> },
  tamano_equipo: { rotulo: 'Equipo directo', icono: (c) => <IconoEquipo tamano={16} color={c} />, unidad: (v) => v === 1 ? '1 persona' : `${v} personas` },
  personas_a_cargo: { rotulo: 'A cargo', icono: (c) => <IconoCheck tamano={14} color={c} /> },
  minutos_traslado: { rotulo: 'Traslado', icono: (c) => <IconoAuto tamano={16} color={c} />, unidad: (v) => `${v} min` },
}

export default function Perfil() {
  const [participante, setParticipante] = useState<Participante | null>(null)
  const [hora, setHora] = useState<HoraRecordatorio | null>(null)
  const [horaTexto, setHoraTexto] = useState('')
  const [minutoTexto, setMinutoTexto] = useState('')
  const [guardandoHora, setGuardandoHora] = useState(false)
  const [desfase, setDesfase] = useState(0)
  const [huella, setHuella] = useState<{ disponible: boolean; activa: boolean } | null>(null)
  const [datos, setDatos] = useState<{ items: ItemDef[]; valores: Valores; enviado_en: string } | null | undefined>(undefined)
  const [ocupado, setOcupado] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    await cargarDesfase().then(setDesfase)
    const p = await obtenerParticipante()
    if (!p) return router.replace('/')
    setParticipante(p)
    const [disponible, activa] = await Promise.all([huellaDisponible(), huellaActiva()])
    setHuella({ disponible, activa })
    const [respuesta, def] = await Promise.all([datosIniciales(p.id), obtenerFormulario('estable')])
    setDatos(respuesta ? { items: def.definicion.items, ...respuesta } : null)
  }, [])

  useFocusEffect(useCallback(() => { cargar().catch(() => setDatos(null)) }, [cargar]))

  useEffect(() => {
    horaRecordatorio().then((h) => {
      setHora(h)
      setHoraTexto(dosDigitos(h.hora))
      setMinutoTexto(dosDigitos(h.minuto))
    })
  }, [])

  async function refrescar() {
    setRefrescando(true)
    await cargar().catch(() => {})
    setRefrescando(false)
  }

  const horaValida = /^\d{1,2}$/.test(horaTexto) && Number(horaTexto) <= 23
    && /^\d{1,2}$/.test(minutoTexto) && Number(minutoTexto) <= 59
  const horaCambiada = hora !== null && horaValida
    && (Number(horaTexto) !== hora.hora || Number(minutoTexto) !== hora.minuto)

  async function guardarHora() {
    if (!horaValida) return
    const h = Number(horaTexto), m = Number(minutoTexto)
    setGuardandoHora(true)
    const ok = await guardarHoraRecordatorio(h, m)
    setGuardandoHora(false)
    setHora({ hora: h, minuto: m })
    setHoraTexto(dosDigitos(h)); setMinutoTexto(dosDigitos(m))
    if (!ok) {
      Alert.alert('Sin permiso para avisarte', 'La hora quedó guardada, pero el teléfono no permite notificaciones a esta app. Actívalas en Ajustes del sistema → Aplicaciones → Estudio Burnout → Notificaciones.')
    }
  }

  async function probar() {
    const ok = await probarRecordatorio(10)
    Alert.alert(
      ok ? 'Prueba enviada' : 'No se pudo enviar',
      ok
        ? 'En unos 10 segundos te llegará una notificación. Si no aparece, revisa que la app tenga permiso de notificaciones y no esté en «ahorro de batería».'
        : 'El teléfono no permite notificaciones a esta app. Actívalas en Ajustes del sistema.',
    )
  }

  function confirmarRetiro() {
    if (!participante) return
    Alert.alert(
      'Retirar mi participación',
      'Dejaremos de pedirte respuestas. Lo que ya respondiste se conserva bajo tu código anónimo, como acordamos en el consentimiento. Puedes volver a aceptar cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirarme', style: 'destructive',
          onPress: async () => {
            setOcupado(true)
            try {
              // RN-001-03 — el retiro se registra, no se borra nada.
              await registrarDecision(participante.id, false)
              await cancelarTodos()
              router.replace('/')
            } finally { setOcupado(false) }
          },
        },
      ],
    )
  }

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', 'Para volver a entrar necesitarás tu correo y contraseña.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => { await cerrarSesion(); router.replace('/acceso') } },
    ])
  }

  if (!participante || datos === undefined) return <Cargando />

  const inscrito = new Date(participante.inscrito_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })

  return (
    <View style={[e.pantalla, { paddingTop: insets.top }]}>
      <BarraSuperior titulo="Perfil" />
      <ScrollView
        contentContainerStyle={e.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <Text style={[texto.titulo, { color: color.texto }]}>Tu perfil</Text>

        {/* Identidad en el estudio */}
        <View style={e.tarjeta}>
          <View style={e.fila}>
            <View style={e.cuadroIcono}><IconoHuella tamano={26} color={color.primarioProfundo} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[texto.seccion, { color: color.texto }]}>Participante {participante.codigo_anonimo}</Text>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                Semana {semanaDelEstudio(participante.inscrito_en, ahora())} del estudio · desde el {inscrito}
              </Text>
            </View>
          </View>
          <View style={e.notaSuave}>
            <IconoEscudo tamano={16} color={color.primarioProfundo} />
            <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
              Tu nombre y tu correo no están en ninguna tabla de investigación; solo los ve el
              profesional de psicología si hay una sesión de apoyo, y ese acceso queda registrado.
            </Text>
          </View>
        </View>

        {/* Datos iniciales (RF-002-16) */}
        <View style={e.tarjeta}>
          <View style={{ gap: 2 }}>
            <Text style={[texto.seccion, { color: color.texto }]}>Datos iniciales</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>Respuestas del formulario de inscripción</Text>
          </View>
          {datos ? (
            <>
              <View style={e.mosaico}>
                {datos.items.filter((i) => MOSAICO[i.clave]).map((item) => {
                  const m = MOSAICO[item.clave]
                  return (
                    <View key={item.clave} style={e.celda}>
                      <View style={e.celdaIcono}>{m.icono(color.primarioProfundo)}</View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11, lineHeight: 14 }]} numberOfLines={1}>{m.rotulo}</Text>
                        <Text style={[texto.apoyoFuerte, { color: color.texto }]} numberOfLines={2}>
                          {mostrar(item, datos.valores[item.clave], m.unidad)}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
              <Text style={[texto.dato, { color: color.textoMedio }]}>
                Respondidos el {fechaLarga(new Date(datos.enviado_en))}. Si algo cambió (rol, modalidad,
                equipo), actualízalos.
              </Text>
              <Pressable onPress={() => router.push('/formulario/estable')} style={e.botonSuave} accessibilityRole="button">
                <IconoEditar tamano={18} color={color.primarioProfundo} />
                <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>Actualizar mis datos</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                Todavía no respondes los datos iniciales. Toman dos minutos.
              </Text>
              <Pressable onPress={() => router.push('/formulario/estable')} style={e.botonLleno} accessibilityRole="button">
                <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>Responder ahora · 2 minutos</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Recordatorio (RF-002-06) */}
        <View style={e.tarjeta}>
          <View style={{ gap: 2 }}>
            <Text style={[texto.seccion, { color: color.texto }]}>Recordatorio diario</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              {recordatoriosDisponibles()
                ? 'De lunes a viernes, a la hora que elijas. Sábado y domingo no hay nada que responder.'
                : 'Este dispositivo no permite programar recordatorios. Abre la app cada día al terminar tu jornada.'}
            </Text>
          </View>
          {recordatoriosDisponibles() && hora && (
            <>
              <View style={e.horaFila}>
                <TextInput
                  style={e.horaEntrada}
                  value={horaTexto}
                  onChangeText={(t) => setHoraTexto(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel="Hora"
                />
                <Text style={[texto.titulo, { color: color.textoMedio }]}>:</Text>
                <TextInput
                  style={e.horaEntrada}
                  value={minutoTexto}
                  onChangeText={(t) => setMinutoTexto(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel="Minuto"
                />
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={guardarHora}
                  disabled={!horaCambiada || guardandoHora}
                  style={[e.botonChico, horaCambiada ? e.botonChicoActivo : e.botonChicoInactivo]}
                  accessibilityRole="button"
                >
                  <Text style={[texto.cuerpoFuerte, { color: horaCambiada ? '#FFFFFF' : color.textoSuave }]}>
                    {guardandoHora ? 'Guardando…' : 'Guardar'}
                  </Text>
                </Pressable>
              </View>
              {!horaValida && (
                <Text style={[texto.dato, { color: color.peligro }]}>Escribe una hora entre 00:00 y 23:59.</Text>
              )}
              <View style={[e.fila, { justifyContent: 'space-between' }]}>
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>
                  Programado a las {dosDigitos(hora.hora)}:{dosDigitos(hora.minuto)}, formato 24 h.
                </Text>
                <Pressable onPress={probar} accessibilityRole="button" hitSlop={8}>
                  <Text style={[texto.apoyoFuerte, { color: color.primarioProfundo }]}>Probar ahora</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Huella (no existe en web) */}
        {Platform.OS !== 'web' && (
          <View style={e.tarjeta}>
            <View style={e.fila}>
              <View style={e.cuadroIconoChico}><IconoHuella tamano={18} color={color.primarioProfundo} /></View>
              <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Pedir huella al abrir</Text>
              <Switch
                value={Boolean(huella?.disponible && huella?.activa)}
                disabled={!huella?.disponible}
                onValueChange={async (v) => { await fijarHuella(v); setHuella((h) => h && { ...h, activa: v }) }}
                trackColor={{ true: color.primarioProfundo, false: color.bordeFuerte }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Pedir huella al abrir"
              />
            </View>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              {huella?.disponible
                ? 'Al abrir la app y al volver tras cinco minutos. Tu huella nunca sale del teléfono.'
                : 'Tu teléfono no tiene huella ni bloqueo configurados; actívalos en sus ajustes.'}
            </Text>
          </View>
        )}

        {/* Derechos */}
        <View style={e.tarjeta}>
          <View style={e.fila}>
            <View style={e.cuadroIconoChico}><IconoBalanza tamano={18} color={color.primarioProfundo} /></View>
            <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Tus derechos como participante</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Puedes retirar tu consentimiento en cualquier momento, sin dar explicaciones y sin
            consecuencia alguna. Tu empresa no será informada.
          </Text>
          <Pressable onPress={confirmarRetiro} disabled={ocupado} style={e.botonBorde} accessibilityRole="button">
            <IconoSalir tamano={18} color={color.texto} />
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Retirar mi participación</Text>
          </Pressable>
          <Text style={[texto.dato, { color: color.textoSuave, textAlign: 'center' }]}>
            Este sistema es una herramienta de apoyo y no constituye un diagnóstico clínico.
          </Text>
        </View>

        <Pressable onPress={confirmarSalida} accessibilityRole="button" style={e.enlace}>
          <Text style={[texto.apoyoFuerte, e.enlaceTexto]}>Cerrar sesión</Text>
        </Pressable>

        {__DEV__ && (
          <View style={e.tarjeta}>
            <Text style={[texto.etiqueta, { color: color.textoSuave }]}>SOLO DESARROLLO · FECHA SIMULADA</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              Mueve el día de la app (no el de la base de datos) para probar el calendario:
              lunes a jueves el check-in, viernes el cuestionario.
            </Text>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
              {fechaLarga(ahora())}{desfase !== 0 ? ` (${desfase > 0 ? '+' : ''}${desfase} d)` : ''}
            </Text>
            <View style={e.horas}>
              {[-1, +1, 0].map((paso) => (
                <Pressable key={paso} onPress={async () => { const n = paso === 0 ? 0 : desfase + paso; await fijarDesfase(n); setDesfase(n) }}
                  style={[e.hora, paso === 0 && desfase === 0 && e.horaActiva]}>
                  <Text style={[texto.cuerpoFuerte, { color: paso === 0 && desfase === 0 ? '#FFFFFF' : color.textoMedio }]}>
                    {paso === -1 ? '− 1 día' : paso === 1 ? '+ 1 día' : 'Hoy real'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[texto.dato, { color: color.textoSuave }]}>
              La predicción y la adherencia usan la fecha real del servidor; para mover los datos está supabase/avanzar_dia.sql.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

/** El valor guardado, en palabras: la etiqueta de la opción, «Sí/No» para
 *  booleanos, el número con su unidad. */
function mostrar(item: ItemDef, valor: Valores[string] | undefined, unidad?: (v: number) => string): string {
  if (valor === undefined) return '—'
  if (item.tipo === 'opcion') return item.opciones?.find((o) => o.valor === valor)?.etiqueta ?? String(valor)
  if (item.tipo === 'booleano') return Number(valor) === 1 || valor === true ? 'Sí' : 'No'
  return unidad ? unidad(Number(valor)) : String(valor)
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: { padding: 20, paddingBottom: espacio.xxl, gap: espacio.base, width: '100%', maxWidth: 480, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
  tarjeta: { backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.base, gap: espacio.md, borderWidth: 1, borderColor: color.borde },
  cuadroIcono: { width: 52, height: 52, borderRadius: radio.md, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  cuadroIconoChico: { width: 36, height: 36, borderRadius: radio.sm, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  notaSuave: { flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start', backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.md },
  mosaico: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  celda: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.sm, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radio.md, borderWidth: 1, borderColor: color.borde, backgroundColor: color.superficie },
  celdaIcono: { width: 28, height: 28, borderRadius: radio.sm, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  botonSuave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm, minHeight: 48, borderRadius: radio.md, backgroundColor: color.superficieSuave },
  botonBorde: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm, minHeight: 48, borderRadius: radio.md, borderWidth: 1, borderColor: color.bordeFuerte, backgroundColor: color.superficie },
  botonLleno: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm, minHeight: 52, borderRadius: radio.md, backgroundColor: color.primarioProfundo },
  horas: { flexDirection: 'row', gap: espacio.sm },
  horaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  horaEntrada: { ...texto.titulo, color: color.texto, width: 64, textAlign: 'center', paddingVertical: 8, borderRadius: radio.md, backgroundColor: color.superficieSuave },
  botonChico: { paddingHorizontal: 16, minHeight: 44, borderRadius: radio.md, alignItems: 'center', justifyContent: 'center' },
  botonChicoActivo: { backgroundColor: color.primarioProfundo },
  botonChicoInactivo: { backgroundColor: color.superficieSuave },
  hora: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficieSuave },
  horaActiva: { backgroundColor: color.primarioProfundo },
  enlace: { alignItems: 'center', paddingVertical: espacio.sm },
  enlaceTexto: { color: color.textoMedio, textDecorationLine: 'underline' },
})

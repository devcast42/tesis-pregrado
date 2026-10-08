/** Apoyo — implementa ESP-004 RF-004-13 … RF-004-16.
 *  Diseño: Figma IcncrzVKVbewGGc6RkImCM, frame «Apoyo · Trabajador».
 *
 *  Una sola pestaña para todo lo que tiene que ver con el psicólogo: entrar
 *  a la sesión si hay una sala abierta, ver la cita pedida, o pedir una.
 *  Está disponible siempre, no solo tras una detección (RN-004-11).
 *
 *  Lo que NO hay aquí: ningún puntaje, ningún «te recomendamos pedir cita».
 *  La decisión es de la persona. */

import { useCallback, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { obtenerTrabajador } from '../../modules/acceso/datos'
import { sesionDisponible, type SesionDisponible } from '../../modules/consulta/datos'
import { abrirPdf, misResumenes, type Resumen } from '../../modules/consulta/resumen'
import {
  cancelarCita, citaVigente, diasOfrecidos, fechaHora, horasDisponibles, misCitas, solicitarCita, type Cita,
} from '../../modules/consulta/citas'
import { BarraSuperior } from '../../modules/nucleo/armazon'
import { Boton, Cargando } from '../../modules/nucleo/ui'
import {
  IconoApoyo, IconoArchivo, IconoCalendario, IconoCandado, IconoCheck, IconoChevronAbajo, IconoEntrar, IconoHistorial,
  IconoReloj, IconoVideo,
} from '../../modules/nucleo/iconos'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'

const ESTADO: Record<Cita['estado'], { texto: string; tono: string; fondo: string }> = {
  solicitada: { texto: 'Pendiente de confirmar', tono: color.alerta, fondo: color.alertaSuave },
  confirmada: { texto: 'Confirmada', tono: color.primarioProfundo, fondo: color.primarioSuave },
  cancelada: { texto: 'Cancelada', tono: color.textoMedio, fondo: color.superficieSuave },
  atendida: { texto: 'Realizada', tono: color.textoMedio, fondo: color.superficieSuave },
}

export default function Apoyo() {
  const [citas, setCitas] = useState<Cita[] | null>(null)
  const [sesion, setSesion] = useState<SesionDisponible | null>(null)
  const [resumenes, setResumenes] = useState<Resumen[]>([])
  const [refrescando, setRefrescando] = useState(false)
  const insets = useSafeAreaInsets()

  const cargar = useCallback(async () => {
    const p = await obtenerTrabajador()
    if (!p) return router.replace('/')
    const [c, s, r] = await Promise.all([misCitas(), sesionDisponible(), misResumenes().catch(() => [])])
    setCitas(c)
    setSesion(s)
    setResumenes(r)
  }, [])

  useFocusEffect(useCallback(() => { cargar().catch(() => setCitas([])) }, [cargar]))

  async function refrescar() {
    setRefrescando(true)
    await cargar().catch(() => {})
    setRefrescando(false)
  }

  if (!citas) return <Cargando />

  const vigente = citaVigente(citas)
  const anteriores = citas.filter((c) => c !== vigente)
  const psicologo = vigente?.psicologo ?? anteriores[0]?.psicologo

  function confirmarCancelacion() {
    if (!vigente) return
    Alert.alert('Cancelar la cita', '¿Seguro? Podrás pedir otra cuando quieras.', [
      { text: 'Mantener', style: 'cancel' },
      {
        text: 'Cancelar cita', style: 'destructive',
        onPress: async () => {
          try { await cancelarCita(vigente.id); await cargar() } catch (err) {
            Alert.alert('No se pudo cancelar', err instanceof Error ? err.message : 'Inténtalo de nuevo.')
          }
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView style={[e.pantalla, { paddingTop: insets.top }]} behavior="padding">
      <BarraSuperior titulo="Apoyo" onPerfil={() => router.push('/perfil')} />
      <ScrollView
        contentContainerStyle={e.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        <View style={{ gap: espacio.xs }}>
          <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>APOYO PROFESIONAL</Text>
          <Text style={[texto.titulo, { color: color.texto }]}>Habla con un psicólogo</Text>
          <Text style={[texto.cuerpo, { color: color.textoMedio }]}>
            Confidencial e independiente de tu empresa. Pídelo cuando quieras.
          </Text>
        </View>

        {sesion && (
          <View style={e.tarjetaSesion}>
            <View style={e.fila}>
              <View style={e.cuadroIcono}><IconoVideo tamano={20} color={color.primarioProfundo} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[texto.etiqueta, { color: color.primarioProfundo }]}>SESIÓN DISPONIBLE</Text>
                <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
                  {psicologo ? `Con ${psicologo} · En curso` : 'Sala abierta'}
                </Text>
              </View>
            </View>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              La sala virtual se encuentra abierta. Tu especialista está esperando tu ingreso para
              comenzar la conversación.
            </Text>
            <Pressable onPress={() => router.push(`/consulta/${sesion.id}`)} style={e.botonLleno} accessibilityRole="button">
              <IconoEntrar tamano={18} color="#FFFFFF" />
              <Text style={[texto.cuerpoFuerte, { color: '#FFFFFF' }]}>Entrar a la sala</Text>
            </Pressable>
          </View>
        )}

        {vigente ? (
          <TarjetaCita cita={vigente} onCancelar={confirmarCancelacion} />
        ) : (
          <FormularioCita onSolicitada={cargar} />
        )}

        {resumenes.length > 0 && <MisResumenes resumenes={resumenes} />}

        {anteriores.length > 0 && <SesionesAnteriores citas={anteriores} />}

        <View style={e.privacidad}>
          <View style={e.candado}><IconoCandado tamano={13} color={color.textoMedio} /></View>
          <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1 }]}>
            El psicólogo verá tu nombre y correo para coordinar, y ese acceso queda registrado.
            Tu empresa, no.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Pastilla({ estado }: { estado: Cita['estado'] }) {
  const s = ESTADO[estado]
  return (
    <View style={[e.pastilla, { backgroundColor: s.fondo }]}>
      <View style={[e.puntoPastilla, { backgroundColor: s.tono }]} />
      <Text style={[texto.datoFuerte, { color: s.tono, fontSize: 12 }]}>{s.texto}</Text>
    </View>
  )
}

function TarjetaCita({ cita, onCancelar }: { cita: Cita; onCancelar: () => void }) {
  return (
    <View style={e.tarjeta}>
      <View style={e.fila}>
        <View style={e.iconoRedondo}><IconoApoyo tamano={18} color={color.primarioProfundo} /></View>
        <Text style={[texto.etiqueta, { color: color.textoMedio, flex: 1 }]} numberOfLines={1}>TU PRÓXIMA CITA</Text>
      </View>
      <View style={{ alignSelf: 'flex-start' }}><Pastilla estado={cita.estado} /></View>
      <View style={{ gap: 4 }}>
        <View style={[e.fila, { alignItems: 'flex-start' }]}>
          <View style={{ paddingTop: 5 }}><IconoCalendario tamano={16} color={color.primarioProfundo} /></View>
          <Text style={[texto.seccion, { color: color.texto, flex: 1 }]}>{fechaHora(cita.propuesta_para)}</Text>
        </View>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>Con {cita.psicologo} · Psicólogo del programa</Text>
      </View>
      {cita.motivo && (
        <View style={e.motivo}>
          <Text style={[texto.etiqueta, { color: color.textoMedio, fontSize: 11 }]}>MOTIVO REGISTRADO</Text>
          <Text style={[texto.apoyo, { color: color.texto, fontStyle: 'italic' }]}>«{cita.motivo}»</Text>
        </View>
      )}
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        {cita.estado === 'solicitada'
          ? 'Te avisaremos al confirmarla. La videollamada aparecerá aquí a su hora.'
          : 'A su hora, aquí aparecerá el botón para entrar a la videollamada.'}
      </Text>
      <Pressable onPress={onCancelar} accessibilityRole="button" style={e.enlace}>
        <Text style={[texto.apoyoFuerte, e.enlaceTexto]}>Cancelar la cita</Text>
      </Pressable>
    </View>
  )
}

function FormularioCita({ onSolicitada }: { onSolicitada: () => Promise<void> }) {
  const dias = diasOfrecidos()
  const [dia, setDia] = useState<Date>(dias[0])
  const [hora, setHora] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const horas = horasDisponibles(dia)

  async function pedir() {
    if (hora === null) return
    const para = new Date(dia); para.setHours(hora, 0, 0, 0)
    setOcupado(true)
    try {
      await solicitarCita(para, motivo)
      await onSolicitada()
    } catch (err) {
      Alert.alert('No se pudo pedir la cita', err instanceof Error ? err.message : 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <View style={e.tarjeta}>
      <View style={{ gap: 2 }}>
        <Text style={[texto.seccion, { color: color.texto }]}>Elegir horario</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>Selecciona el momento que mejor se adapte a tu jornada.</Text>
      </View>

      <View style={e.fila}>
        <IconoCalendario tamano={15} color={color.primarioProfundo} />
        <Text style={[texto.etiqueta, { color: color.textoMedio }]}>FECHA</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.sm }}>
        {dias.map((d) => {
          const activo = d.getTime() === dia.getTime()
          return (
            <Pressable key={d.toISOString()} onPress={() => { setDia(d); setHora(null) }}
              style={[e.chipDia, activo && e.chipActivo]} accessibilityRole="radio" accessibilityState={{ selected: activo }}>
              <Text style={[texto.insignia, { color: activo ? 'rgba(255,255,255,0.85)' : color.textoMedio }]}>
                {d.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '').toUpperCase()}
              </Text>
              <Text style={[texto.seccion, { color: activo ? '#FFFFFF' : color.texto }]}>{d.getDate()}</Text>
              <Text style={[texto.insignia, { color: activo ? 'rgba(255,255,255,0.85)' : color.textoMedio }]}>
                {d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '').toUpperCase()}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={e.fila}>
        <IconoReloj tamano={15} color={color.primarioProfundo} />
        <Text style={[texto.etiqueta, { color: color.textoMedio }]}>HORA DE INICIO</Text>
      </View>
      {horas.length === 0 ? (
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>Ya no quedan horas para este día.</Text>
      ) : (
        <View style={e.horas}>
          {horas.map((h) => {
            const activo = h === hora
            return (
              <Pressable key={h} onPress={() => setHora(h)} style={[e.chipHora, activo && e.chipActivo]}
                accessibilityRole="radio" accessibilityState={{ selected: activo }}>
                <Text style={[texto.cuerpoFuerte, { color: activo ? '#FFFFFF' : color.texto }]}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <View style={[e.fila, { alignItems: 'flex-start' }]}>
        <Text style={[texto.etiqueta, { color: color.textoMedio, flex: 1 }]}>¿DE QUÉ TE GUSTARÍA HABLAR? (OPCIONAL)</Text>
        {motivo.length > 0 && (
          <Text style={[texto.dato, { color: color.textoSuave }]}>{motivo.length} / 240</Text>
        )}
      </View>
      <TextInput
        style={e.entrada}
        value={motivo}
        onChangeText={(t) => setMotivo(t.slice(0, 240))}
        placeholder="Solo lo leerá el profesional que te atienda."
        placeholderTextColor={color.textoSuave}
        multiline
        maxLength={240}
      />

      <Boton onPress={pedir} inhabilitado={hora === null} cargando={ocupado}>Pedir la cita</Boton>
      <View style={[e.fila, { justifyContent: 'center' }]}>
        <IconoCheck tamano={12} color={color.textoSuave} />
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>Sin costo · Puedes cancelarla cuando quieras</Text>
      </View>
    </View>
  )
}

/** RF-004-17 — los resúmenes personales de cada sesión: descargar el PDF o,
 *  si aún se está preparando, volver a la pantalla de progreso. */
function MisResumenes({ resumenes }: { resumenes: Resumen[] }) {
  const [abriendo, setAbriendo] = useState<string | null>(null)
  async function descargar(r: Resumen) {
    if (!r.pdf_ruta) return
    setAbriendo(r.id)
    try { await abrirPdf(r.pdf_ruta) } catch (err) {
      Alert.alert('No se pudo abrir', err instanceof Error ? err.message : 'Inténtalo de nuevo.')
    } finally { setAbriendo(null) }
  }
  return (
    <View style={e.tarjeta}>
      <View style={e.fila}>
        <View style={e.cuadroIconoChico}><IconoArchivo tamano={16} color={color.textoMedio} /></View>
        <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Tus resúmenes de sesión</Text>
      </View>
      <Text style={[texto.apoyo, { color: color.textoMedio }]}>
        Un documento solo para ti con lo que acordaste y recomendaciones para los días siguientes. No es el informe del psicólogo.
      </Text>
      {resumenes.slice(0, 5).map((r) => (
        <View key={r.id} style={e.filaAnterior}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
              {new Date(r.creado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              {r.etapa === 'listo' ? (r.origen === 'general' ? 'Recomendaciones generales' : 'Resumen de la sesión')
                : r.etapa === 'fallido' ? 'No se pudo generar' : 'Preparándose…'}
            </Text>
          </View>
          {r.etapa === 'listo' ? (
            <Pressable onPress={() => descargar(r)} disabled={abriendo === r.id} style={e.botonChico} accessibilityRole="button">
              <Text style={[texto.apoyoFuerte, { color: color.primarioProfundo }]}>{abriendo === r.id ? 'Abriendo…' : 'Descargar PDF'}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push(`/consulta/resumen/${r.sesion_id}`)} style={e.botonChico} accessibilityRole="button">
              <Text style={[texto.apoyoFuerte, { color: color.primarioProfundo }]}>{r.etapa === 'fallido' ? 'Reintentar' : 'Ver progreso'}</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}

function SesionesAnteriores({ citas }: { citas: Cita[] }) {
  const [abierto, setAbierto] = useState(true)
  return (
    <View style={e.tarjeta}>
      <Pressable onPress={() => setAbierto((v) => !v)} style={e.fila} accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}>
        <View style={e.cuadroIconoChico}><IconoHistorial tamano={16} color={color.textoMedio} /></View>
        <Text style={[texto.cuerpoFuerte, { color: color.texto, flex: 1 }]}>Sesiones anteriores</Text>
        <View style={{ transform: [{ rotate: abierto ? '0deg' : '-90deg' }] }}>
          <IconoChevronAbajo tamano={20} color={color.textoMedio} />
        </View>
      </Pressable>
      {abierto && citas.slice(0, 5).map((c) => (
        <View key={c.id} style={e.filaAnterior}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>
              {new Date(c.propuesta_para).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>Con {c.psicologo}</Text>
          </View>
          <View style={[e.pastilla, { backgroundColor: ESTADO[c.estado].fondo }]}>
            <Text style={[texto.datoFuerte, { color: ESTADO[c.estado].tono }]}>{ESTADO[c.estado].texto}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: { padding: 20, paddingBottom: espacio.xxl, gap: espacio.base, width: '100%', maxWidth: 480, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  tarjeta: { backgroundColor: color.superficie, borderRadius: radio.xl, padding: espacio.base, gap: espacio.md, borderWidth: 1, borderColor: color.borde },
  tarjetaSesion: { backgroundColor: color.superficieSuave, borderRadius: radio.xl, padding: espacio.base, gap: espacio.md, borderWidth: 1, borderColor: color.borde },
  iconoRedondo: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  cuadroIcono: { width: 40, height: 40, borderRadius: radio.md, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.borde },
  cuadroIconoChico: { width: 32, height: 32, borderRadius: radio.sm, backgroundColor: color.superficieSuave, alignItems: 'center', justifyContent: 'center' },
  botonLleno: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm, minHeight: 52, borderRadius: radio.md, backgroundColor: color.primarioProfundo },
  motivo: { backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.md, gap: 4 },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  puntoPastilla: { width: 6, height: 6, borderRadius: 3 },
  botonChico: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: color.primarioSuave, flexShrink: 0 },
  enlace: { alignItems: 'center', paddingVertical: espacio.xs },
  enlaceTexto: { color: color.textoMedio, textDecorationLine: 'underline' },
  chipDia: { width: 60, paddingVertical: 10, borderRadius: radio.md, backgroundColor: color.superficieSuave, alignItems: 'center', gap: 1 },
  chipHora: { width: '23%', flexGrow: 1, paddingVertical: 12, borderRadius: radio.md, backgroundColor: color.superficieSuave, alignItems: 'center' },
  chipActivo: { backgroundColor: color.primarioProfundo },
  horas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  entrada: { ...texto.apoyo, color: color.texto, minHeight: 84, textAlignVertical: 'top', padding: espacio.md, borderRadius: radio.md, backgroundColor: color.superficieSuave },
  privacidad: { flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start', backgroundColor: color.superficieSuave, borderRadius: radio.xl, padding: espacio.base },
  candado: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  filaAnterior: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: espacio.md },
})

/** Detalle del caso — implementa ESP-006 RF-006-03 … RF-006-06, RF-006-12, RF-006-14 y ESP-005 (pronóstico).
 *
 *  Diseño: Figma «Detalle del Caso». La ficha que un clínico mira antes de
 *  abrir la puerta, en este orden: quién → qué disparó la derivación →
 *  evolución → lo que dice el modelo → sesiones → acciones.
 *
 *  La identidad se pide aparte y de forma explícita (RN-006-02): no viaja
 *  con el resto de los datos, y cada consulta queda registrada (RN-006-03).
 *  El contexto de horas y sueño NO se muestra: RN-006-07. */

import { useCallback, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  cancelarCitaComoPsicologo, cerrarDerivacion, confirmarCita, crearSesion, DESENLACES, obtenerCaso, obtenerIdentidad, perfilCaso, pronosticoCaso, trayectoriaOlbi,
  type Desenlace,
  type Caso, type PerfilCaso, type PuntajeOlbi,
} from '../../../modules/psicologo/datos'
import { BarraUmbral, Evolucion, Pastilla, Rotulo, Tarjeta, fechaHoraCorta, haceCuanto } from '../../../modules/psicologo/piezas'
import { Boton, Cargando } from '../../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../../modules/nucleo/diseno'
import { IconoCandado, IconoCheck, IconoNota, IconoOjo, IconoVideo } from '../../../modules/nucleo/iconos'
import { ETIQUETA_CONFIANZA, confianzaDe, metricasAplicables, type Prediccion } from '../../../modules/trabajador/resultado'

const ROL: Record<string, string> = {
  desarrollo: 'Desarrollo de software', qa: 'QA o testing', datos: 'Datos o analítica',
  infraestructura: 'Infraestructura o DevOps', soporte: 'Soporte técnico', diseno: 'Diseño o UX',
  gestion: 'Gestión de proyectos', otro: 'Otro',
}
const MODALIDAD: Record<string, string> = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' }

export default function DetalleCaso() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [caso, setCaso] = useState<Caso | null>(null)
  const [perfil, setPerfil] = useState<PerfilCaso | null>(null)
  const [trayectoria, setTrayectoria] = useState<PuntajeOlbi[]>([])
  const [pronostico, setPronostico] = useState<Prediccion | null>(null)
  const [identidad, setIdentidad] = useState<{ nombre: string; correo_contacto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [explicar, setExplicar] = useState(false)

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

  async function verIdentidad() {
    if (!caso) return
    try {
      setIdentidad(await obtenerIdentidad(caso.trabajador_id))
    } catch {
      Alert.alert('No disponible', 'La identidad solo se puede consultar con una derivación abierta.')
    }
  }

  async function entrar() {
    if (!caso) return
    setOcupado(true)
    try {
      const sesionId = caso.sesion_id && !caso.sesion_finalizada_en ? caso.sesion_id : (await crearSesion(caso.derivacion_id)).id
      router.push(`/psicologo/consulta/${sesionId}`)
    } catch {
      Alert.alert('No se pudo abrir la sala', 'Inténtalo de nuevo en un momento.')
    } finally {
      setOcupado(false)
    }
  }

  async function resolverCita(accion: 'confirmar' | 'cancelar') {
    if (!caso?.cita_id) return
    setOcupado(true)
    try {
      if (accion === 'confirmar') await confirmarCita(caso.cita_id)
      else await cancelarCitaComoPsicologo(caso.cita_id)
      await cargar()
    } catch {
      Alert.alert('No se pudo actualizar la cita', 'Inténtalo de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  function cerrar() {
    if (!caso) return
    Alert.alert(
      'Cerrar caso',
      'Perderás el acceso a este trabajador. ¿Por qué se cierra?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: DESENLACES.mejora, onPress: () => cerrarConDesenlace('mejora') },
        { text: DESENLACES.derivado_externo, onPress: () => cerrarConDesenlace('derivado_externo') },
        { text: DESENLACES.abandono, onPress: () => cerrarConDesenlace('abandono') },
        { text: DESENLACES.sin_contacto, onPress: () => cerrarConDesenlace('sin_contacto') },
      ],
    )
  }

  /** El desenlace se guarda. Antes se preguntaba y se tiraba: la función
   *  recibía el motivo en `_motivo` y cerraba sin él, así que nadie podía
   *  saber si el acompañamiento sirvió. */
  async function cerrarConDesenlace(desenlace: Desenlace) {
    if (!caso) return
    try {
      await cerrarDerivacion(caso.derivacion_id, desenlace)
      router.back()
    } catch {
      Alert.alert('No se pudo cerrar', 'Inténtalo de nuevo.')
    }
  }

  if (!caso) return <Cargando />

  const abierto = caso.estado_caso !== 'cerrado'
  const agot = caso.puntajes?.agotamiento
  const desv = caso.puntajes?.desvinculacion
  const antiguedad = perfil?.antiguedad_empresa != null ? formatoAnios(perfil.antiguedad_empresa) : null
  const m = pronostico ? metricasAplicables(pronostico) : null

  return (
    <ScrollView contentContainerStyle={e.contenido}>
      {/* Quién */}
      <Tarjeta>
        <View style={e.fila}>
          <Pastilla texto={abierto ? 'CASO ACTIVO' : 'CASO CERRADO'} fondo={color.superficieSuave} tinta={color.textoMedio} />
          <Text style={[texto.titulo, { fontSize: 22, lineHeight: 28 }]}>{caso.codigo_anonimo}</Text>
          <View style={{ flex: 1 }} />
          {caso.empresa && <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{caso.empresa}</Text>}
        </View>
        {/* Si esta persona ya pasó por aquí, atenderla sin saber qué pasó la
            vez anterior es empezar de cero. */}
        <Pressable
          onPress={() => router.push(`/psicologo/persona/${caso.trabajador_id}`)}
          style={({ pressed }) => [{ alignSelf: 'flex-start' }, pressed && { opacity: 0.7 }]}
          accessibilityRole="link"
        >
          <Text style={[texto.apoyo, { color: color.primarioProfundo }]}>Ver su historia completa →</Text>
        </Pressable>
        <View style={e.fila}>
          <View style={{ flex: 1 }}>
            <Text style={[texto.etiqueta, { color: color.textoSuave }]}>ROL TÉCNICO</Text>
            <Text style={[texto.cuerpo, { color: color.texto }]}>{perfil?.rol ? ROL[perfil.rol] ?? perfil.rol : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[texto.etiqueta, { color: color.textoSuave }]}>MODALIDAD</Text>
            <Text style={[texto.cuerpo, { color: color.texto }]}>
              {perfil?.modalidad ? MODALIDAD[perfil.modalidad] ?? perfil.modalidad : '—'}{antiguedad ? ` · ${antiguedad}` : ''}
            </Text>
          </View>
        </View>
        <View style={e.identidad}>
          <View style={[e.fila, { gap: 6 }]}>
            <IconoCandado tamano={13} color={color.textoMedio} />
            <Text style={[texto.etiqueta, { color: color.textoMedio }]}>ACCESO ÉTICO PROTOCOLADO</Text>
          </View>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>Solo tú puedes verla, con fines de contacto clínico.</Text>
          {identidad ? (
            <View style={e.identidadDatos}>
              <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{identidad.nombre}</Text>
              <Text style={[texto.cuerpo, { color: color.textoMedio }]}>{identidad.correo_contacto}</Text>
            </View>
          ) : (
            <Pressable onPress={verIdentidad} style={e.botonIdentidad} accessibilityRole="button" disabled={!abierto}>
              <IconoOjo tamano={18} color={color.primarioProfundo} />
              <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>Ver identidad · acceso auditado</Text>
            </Pressable>
          )}
        </View>
      </Tarjeta>

      {/* Cita pedida por el trabajador (RF-004-13 … RF-004-15) */}
      {caso.cita_id && caso.cita_para && (
        <Tarjeta borde={caso.cita_estado === 'solicitada' ? color.alerta : undefined}>
          <Rotulo derecha={<Pastilla texto={caso.cita_estado === 'confirmada' ? 'CONFIRMADA' : 'POR CONFIRMAR'}
            fondo={caso.cita_estado === 'confirmada' ? color.exitoSuave : color.alertaSuave}
            tinta={caso.cita_estado === 'confirmada' ? color.exito : color.alerta} />}>
            CITA PEDIDA POR EL TRABAJADOR
          </Rotulo>
          <Text style={[texto.seccion, { color: color.texto }]}>{fechaHoraCorta(caso.cita_para)}</Text>
          {caso.cita_motivo && (
            <View style={e.motivo}>
              <Text style={[texto.etiqueta, { color: color.textoSuave }]}>DE QUÉ QUIERE HABLAR</Text>
              <Text style={[texto.cuerpo, { color: color.texto }]}>{caso.cita_motivo}</Text>
            </View>
          )}
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            {caso.cita_estado === 'solicitada'
              ? 'Al confirmar, el trabajador recibe la hora. Si no puedes, cancélala: podrá pedir otra.'
              : 'A esa hora, abre la sala desde aquí; el trabajador entra desde su app.'}
          </Text>
          {abierto && caso.cita_estado === 'solicitada' && (
            <View style={e.fila}>
              <View style={{ flex: 1 }}>
                <Boton onPress={() => resolverCita('confirmar')} cargando={ocupado}>Confirmar</Boton>
              </View>
              <View style={{ flex: 1 }}>
                <Boton variante="secundario" onPress={() => resolverCita('cancelar')} cargando={ocupado}>No puedo</Boton>
              </View>
            </View>
          )}
        </Tarjeta>
      )}

      {/* Qué disparó la derivación */}
      <Tarjeta>
        <Rotulo derecha={caso.detectado_en ? <Text style={[texto.apoyo, { color: color.textoMedio }]}>{fechaCorta(caso.detectado_en)}</Text> : undefined}>
          {caso.origen === 'solicitud' ? 'ORIGEN DEL CASO' : 'MOTIVO DE ALERTA'}
        </Rotulo>
        <Text style={[texto.seccion, { color: color.texto }]}>Umbrales OLBI</Text>
        {typeof agot === 'number' && <BarraUmbral dimension="agotamiento" puntaje={agot} umbral={caso.umbrales?.agotamiento} />}
        {typeof desv === 'number' && <BarraUmbral dimension="desvinculacion" puntaje={desv} umbral={caso.umbrales?.desvinculacion} />}
        {typeof agot !== 'number' && typeof desv !== 'number' && (
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            {caso.origen === 'solicitud'
              ? 'El trabajador pidió la cita por su cuenta; no hubo detección del sistema.'
              : 'Sin puntajes registrados en la detección.'}
          </Text>
        )}
      </Tarjeta>

      {/* Evolución */}
      <Tarjeta>
        <Evolucion puntajes={trayectoria} umbrales={caso.umbrales} />
      </Tarjeta>

      {/* Lo que dice el modelo */}
      {pronostico && pronostico.probabilidad != null && (
        <Tarjeta>
          <View style={[e.fila, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[texto.etiqueta, { color: color.textoSuave }]}>PROYECCIÓN ESTADÍSTICA</Text>
              <Text style={[texto.seccion, { color: color.texto }]}>Riesgo para la próxima semana</Text>
            </View>
            <Pastilla texto={ETIQUETA_CONFIANZA[confianzaDe(pronostico)]} fondo={color.arena} tinta={color.textoArena} />
          </View>
          <View style={[e.fila, { alignItems: 'baseline' }]}>
            <Text style={[texto.titulo, { fontSize: 34, lineHeight: 40, color: color.texto }]}>{Math.round(pronostico.probabilidad * 100)}%</Text>
            <Text style={[texto.cuerpo, { color: color.textoMedio, flex: 1 }]}>de probabilidad de permanecer en nivel alto</Text>
          </View>
          <Pressable onPress={() => setExplicar((v) => !v)} style={e.explicar} accessibilityRole="button">
            <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo, flex: 1 }]}>Explicación metodológica del modelo</Text>
            <Text style={[texto.cuerpo, { color: color.primarioProfundo }]}>{explicar ? '⌃' : '⌄'}</Text>
          </Pressable>
          {explicar && (
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              Regresión logística sobre los cuatro ítems diarios del OLBI de la semana (media, último valor, máximo,
              pendiente) — versión {pronostico.version}
              {pronostico.origen === 'preentrenamiento' ? ', preentrenada con el diario OLBI de Gruszczynska et al. (2021) y aún sin recalibrar con datos propios' : ''}.
              {m ? ` Validación por persona: ROC-AUC ${m.roc_auc.toFixed(2)}, precisión ${m.precision.toFixed(2)}, recall ${m.recall.toFixed(2)}.` : ''}
              {' '}Es un apoyo a tu criterio, no lo sustituye.
            </Text>
          )}
        </Tarjeta>
      )}

      {/* Sesiones */}
      <Tarjeta suave>
        <View style={[e.fila, { alignItems: 'flex-start' }]}>
          <View style={e.iconoSuave}><IconoNota tamano={16} color={color.textoMedio} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[texto.etiqueta, { color: color.textoSuave }]}>SESIONES</Text>
            {caso.sesion_id ? (
              <>
                <Text style={[texto.cuerpo, { color: color.texto }]}>
                  {caso.sesion_finalizada_en
                    ? `Sesión realizada ${haceCuanto(caso.sesion_finalizada_en)}.`
                    : `Sala abierta ${haceCuanto(caso.sesion_iniciada_en ?? caso.abierta_en)} · ${caso.consentimiento_trabajador ? 'consentimiento de grabación dado' : 'sin consentimiento de grabación aún'}.`}
                </Text>
                {caso.informe_estado && (
                  <Pressable onPress={() => router.push(`/psicologo/informe/${caso.sesion_id}`)} accessibilityRole="button">
                    <Text style={[texto.cuerpoFuerte, { color: color.primarioProfundo }]}>
                      {caso.informe_estado === 'aprobado' ? 'Ver informe aprobado →' : 'Revisar informe →'}
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Text style={[texto.cuerpo, { color: color.texto }]}>Primera derivación para este trabajador. Sin sesiones previas registradas.</Text>
            )}
          </View>
        </View>
      </Tarjeta>

      {/* Acciones */}
      {abierto && (
        <>
          <Boton onPress={entrar} cargando={ocupado}>
            {caso.sesion_id && !caso.sesion_finalizada_en ? 'Entrar a la videollamada' : 'Abrir sala de videollamada'}
          </Boton>
          {caso.sesion_id && caso.sesion_finalizada_en && !caso.informe_estado && (
            <Boton variante="secundario" onPress={() => router.push(`/psicologo/informe/${caso.sesion_id}`)}>
              Escribir informe de la sesión
            </Boton>
          )}
          <Pressable onPress={cerrar} style={e.cerrar} accessibilityRole="button">
            <IconoCheck tamano={12} color={color.texto} />
            <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Cerrar caso</Text>
          </Pressable>
        </>
      )}
      <View style={{ height: 8 }}>{null}</View>
      <View style={[e.fila, { justifyContent: 'center' }]}>
        <IconoVideo tamano={12} color={color.textoSuave} />
        <Text style={[texto.apoyo, { color: color.textoSuave }]}>La videollamada se graba solo en audio y solo con doble autorización.</Text>
      </View>
    </ScrollView>
  )
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatoAnios(anios: number): string {
  const a = Math.floor(anios)
  const meses = Math.round((anios - a) * 12)
  if (a === 0) return `${meses} m`
  return meses > 0 ? `${a}a ${meses}m` : `${a} a`
}

const e = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: espacio.xxl, gap: espacio.md, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: color.fondo, flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  identidad: { backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.sm, gap: 6 },
  motivo: { backgroundColor: color.superficieSuave, borderRadius: radio.lg, padding: espacio.md, gap: 4 },
  identidadDatos: { backgroundColor: color.superficie, borderRadius: radio.md, padding: espacio.sm, gap: 2 },
  botonIdentidad: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficie, borderRadius: radio.md, padding: 12, borderWidth: 1, borderColor: color.borde },
  explicar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.superficieSuave, borderRadius: radio.md, padding: 12 },
  iconoSuave: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.borde },
  cerrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color.superficieSuave, borderRadius: radio.lg, paddingVertical: 16 },
})

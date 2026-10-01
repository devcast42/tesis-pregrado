/** Alta de empresa — ESP-008.
 *
 *  Un diálogo en vez del campo suelto que había: dar de alta una empresa no
 *  es escribir un nombre, es abrir su ficha. Todo lo que no sea el nombre es
 *  opcional, porque una empresa se registra el día que firma el convenio y no
 *  el día que se reúnen todos sus datos.
 *
 *  Nada de lo que se pide aquí entra al modelo (ESP-005 §4 no lo contempla):
 *  describe la muestra en la tesis y dice a quién llamar. */

import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { crearEmpresa, type DatosEmpresa, type Empresa, type ModalidadEmpresa, type TamanoEmpresa } from '../panel/datos'
import { BotonChico, Rotulo } from './piezas'
import { color, espacio, radio, texto, veloModal } from '../nucleo/diseno'
import { IconoCasa, IconoCerrar, IconoCodigo, IconoCorreo, IconoEquipo, IconoMaletin, IconoNota, IconoPersona, IconoWifi } from '../nucleo/iconos'

const TAMANOS: { valor: TamanoEmpresa; etiqueta: string }[] = [
  { valor: '1-50', etiqueta: '1 – 50' },
  { valor: '51-200', etiqueta: '51 – 200' },
  { valor: '201-1000', etiqueta: '201 – 1 000' },
  { valor: '1000+', etiqueta: 'Más de 1 000' },
]
const MODALIDADES: { valor: ModalidadEmpresa; etiqueta: string }[] = [
  { valor: 'remoto', etiqueta: 'Remoto' },
  { valor: 'hibrido', etiqueta: 'Híbrido' },
  { valor: 'presencial', etiqueta: 'Presencial' },
]

/** Las mismas tres letras que calcula `prefijo_sugerido` en la base: si aquí
 *  se enseñara otra cosa, el investigador vería una sigla y le quedaría otra.
 *  Se toman letras de la primera palabra y, si no dan para tres, se sigue por
 *  la siguiente: «BI Partners» -> BIP. */
function siglaDe(nombre: string): string {
  const limpio = nombre.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
  const enlaces = ['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'E', 'SAC', 'SA', 'SRL', 'EIRL']
  const palabras = limpio.split(/\s+/).filter((p) => p && !enlaces.includes(p))
  let sigla = ''
  for (const p of palabras) {
    sigla += p.slice(0, 3 - sigla.length)
    if (sigla.length >= 3) break
  }
  return sigla ? sigla.padEnd(3, 'X') : ''
}

export function DialogoEmpresa({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (e: Empresa) => void }) {
  const [d, setD] = useState<DatosEmpresa>({ nombre: '' })
  // Mientras no se toque a mano, el prefijo sigue al nombre.
  const [prefijoAMano, setPrefijoAMano] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof DatosEmpresa>(k: K, v: DatosEmpresa[K]) => setD((s) => ({ ...s, [k]: v }))
  const prefijo = prefijoAMano ? (d.prefijo ?? '') : siglaDe(d.nombre)
  const prefijoRaro = !!prefijo && !/^[A-Z][A-Z0-9]{2}$/.test(prefijo)
  const correoRaro = !!d.contacto_correo?.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contacto_correo.trim())
  const puede = !!d.nombre.trim() && !correoRaro && !prefijoRaro && !ocupado

  async function guardar() {
    if (!puede) return
    setOcupado(true); setError(null)
    try { onCreada(await crearEmpresa({ ...d, prefijo })) }
    catch (ex) { setError(ex instanceof Error ? ex.message : 'No se pudo crear la empresa.') }
    finally { setOcupado(false) }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCerrar}>
      <View style={e.velo}>
        <View style={e.caja}>
          <View style={e.cabecera}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Rotulo>Maestro de empresas · ESP-008</Rotulo>
              <Text style={[texto.seccion, { color: color.texto }]}>Nueva empresa</Text>
            </View>
            <Pressable onPress={onCerrar} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <IconoCerrar tamano={15} color={color.textoMedio} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: espacio.base, padding: espacio.base }}>
            <Campo icono={<IconoMaletin tamano={15} color={color.primarioProfundo} />} rotulo="Nombre" obligatorio
              valor={d.nombre} onChange={(v) => set('nombre', v)} placeholder="Nexa Software" />

            <View style={{ gap: 5 }}>
              <View style={e.filaRotulo}>
                <View style={e.cuadroIcono}><IconoCodigo tamano={15} color={color.primarioProfundo} /></View>
                <Rotulo>Letras de sus códigos</Rotulo>
              </View>
              <View style={[e.filaRotulo, { gap: 10 }]}>
                <TextInput value={prefijo} onChangeText={(v) => { setPrefijoAMano(true); set('prefijo', v.toUpperCase().slice(0, 3)) }}
                  placeholder="NEX" maxLength={3} placeholderTextColor={color.textoSuave} autoCapitalize="characters" autoCorrect={false}
                  style={[texto.datoFuerte, e.entrada, e.entradaPrefijo, prefijoRaro && { borderColor: '#8C4A2B' }, { outlineStyle: 'none' } as any]} />
                <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 140 }]}>
                  {prefijo ? `Su gente será ${prefijo}-001, ${prefijo}-002…` : 'Se sacan del nombre; se pueden cambiar.'}
                </Text>
              </View>
              {prefijoRaro && <Text style={[texto.dato, { color: '#8C4A2B' }]}>Tres caracteres, empezando por letra.</Text>}
            </View>

            <Campo icono={<IconoCodigo tamano={15} color={color.primarioProfundo} />} rotulo="A qué se dedica"
              valor={d.sector ?? ''} onChange={(v) => set('sector', v)} placeholder="Desarrollo de software a medida"
              apoyo="Va en la descripción de la muestra, no en el modelo." />

            <Opciones icono={<IconoEquipo tamano={15} color={color.primarioProfundo} />} rotulo="Cuánta gente trabaja ahí"
              apoyo="La empresa entera, no solo quienes participen."
              opciones={TAMANOS} elegido={d.tamano ?? null} onElegir={(v) => set('tamano', v)} />

            <Campo icono={<IconoCasa tamano={15} color={color.primarioProfundo} />} rotulo="Ciudad"
              valor={d.ciudad ?? ''} onChange={(v) => set('ciudad', v)} placeholder="Trujillo" />

            <Opciones icono={<IconoWifi tamano={15} color={color.primarioProfundo} />} rotulo="Cómo trabajan"
              apoyo="Lo que predomina; ya se pregunta persona a persona al inscribirse."
              opciones={MODALIDADES} elegido={d.modalidad ?? null} onElegir={(v) => set('modalidad', v)} />

            <View style={e.separador} />

            <Campo icono={<IconoPersona tamano={15} color={color.primarioProfundo} />} rotulo="Quién firma el convenio"
              valor={d.contacto_nombre ?? ''} onChange={(v) => set('contacto_nombre', v)} placeholder="Nombre y apellido" />

            <Campo icono={<IconoCorreo tamano={15} color={color.primarioProfundo} />} rotulo="Su correo"
              valor={d.contacto_correo ?? ''} onChange={(v) => set('contacto_correo', v)} placeholder="nombre@empresa.pe"
              invalido={correoRaro} aviso={correoRaro ? 'Ese correo no parece válido.' : undefined}
              apoyo="Contacto de la empresa, no de un participante. También lo ve el psicólogo de un caso abierto." />

            <Campo icono={<IconoNota tamano={15} color={color.primarioProfundo} />} rotulo="Notas"
              valor={d.notas ?? ''} onChange={(v) => set('notas', v)} placeholder="Lo que convenga recordar del convenio" multilinea />
          </ScrollView>

          {error && <View style={e.error}><Text style={[texto.dato, { color: '#8C4A2B' }]}>{error}</Text></View>}

          <View style={e.pie}>
            <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 180 }]}>Solo el nombre es obligatorio; lo demás se puede completar después.</Text>
            <BotonChico onPress={onCerrar} tono="suave">Cancelar</BotonChico>
            <Pressable onPress={guardar} disabled={!puede} style={[e.botonCrear, !puede && { opacity: 0.5 }]} accessibilityRole="button">
              <Text style={[texto.datoFuerte, { color: '#FFFFFF' }]}>{ocupado ? 'Creando…' : 'Crear empresa'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Campo({ icono, rotulo, valor, onChange, placeholder, obligatorio, apoyo, multilinea, invalido, aviso }: {
  icono: React.ReactNode; rotulo: string; valor: string; onChange: (v: string) => void; placeholder: string
  obligatorio?: boolean; apoyo?: string; multilinea?: boolean; invalido?: boolean; aviso?: string
}) {
  return (
    <View style={{ gap: 5 }}>
      <View style={e.filaRotulo}>
        <View style={e.cuadroIcono}>{icono}</View>
        <Rotulo>{obligatorio ? `${rotulo} *` : rotulo}</Rotulo>
      </View>
      <TextInput value={valor} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.textoSuave}
        autoCapitalize={rotulo === 'Su correo' ? 'none' : 'sentences'} autoCorrect={false}
        multiline={multilinea} numberOfLines={multilinea ? 3 : 1}
        style={[texto.dato, e.entrada, multilinea && { height: 68, paddingTop: 9 }, invalido && { borderColor: '#8C4A2B' }, { outlineStyle: 'none' } as any]} />
      {aviso ? <Text style={[texto.dato, { color: '#8C4A2B' }]}>{aviso}</Text>
        : apoyo ? <Text style={[texto.dato, { color: color.textoMedio }]}>{apoyo}</Text> : null}
    </View>
  )
}

function Opciones<T extends string>({ icono, rotulo, apoyo, opciones, elegido, onElegir }: {
  icono: React.ReactNode; rotulo: string; apoyo?: string
  opciones: { valor: T; etiqueta: string }[]; elegido: T | null; onElegir: (v: T | null) => void
}) {
  return (
    <View style={{ gap: 5 }}>
      <View style={e.filaRotulo}>
        <View style={e.cuadroIcono}>{icono}</View>
        <Rotulo>{rotulo}</Rotulo>
      </View>
      <View style={e.opciones}>
        {opciones.map((o) => {
          const on = elegido === o.valor
          return (
            // Volver a pulsar la opción elegida la quita: sin esto no habría
            // forma de dejar el campo en blanco después de tocarlo.
            <Pressable key={o.valor} onPress={() => onElegir(on ? null : o.valor)} style={[e.opcion, on && e.opcionOn]}>
              <Text style={[texto.dato, { color: on ? '#FFFFFF' : color.texto }]}>{o.etiqueta}</Text>
            </Pressable>
          )
        })}
      </View>
      {apoyo && <Text style={[texto.dato, { color: color.textoMedio }]}>{apoyo}</Text>}
    </View>
  )
}

const e = StyleSheet.create({
  velo: { ...veloModal, backgroundColor: 'rgba(28,25,23,0.35)', alignItems: 'center', justifyContent: 'center', padding: espacio.base },
  caja: { width: 560, maxWidth: '100%', backgroundColor: color.superficie, borderRadius: radio.lg ?? 14, borderWidth: 1, borderColor: '#EEECE8', overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm, padding: espacio.base, borderBottomWidth: 1, borderBottomColor: '#EEECE8', flexWrap: 'wrap' },
  cerrar: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F1EFEB', alignItems: 'center', justifyContent: 'center' },
  filaRotulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cuadroIcono: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#EAF4EF', alignItems: 'center', justifyContent: 'center' },
  entradaPrefijo: { width: 92, textAlign: 'center', letterSpacing: 2 },
  entrada: { minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: color.borde, paddingHorizontal: 10, color: color.texto, backgroundColor: color.superficie },
  opciones: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  opcion: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F1EFEB' },
  opcionOn: { backgroundColor: color.primarioProfundo },
  separador: { height: 1, backgroundColor: '#EEECE8' },
  error: { backgroundColor: '#FBEDE6', padding: 10, marginHorizontal: espacio.base, borderRadius: 8 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, padding: espacio.base, borderTopWidth: 1, borderTopColor: '#EEECE8', flexWrap: 'wrap' },
  botonCrear: { backgroundColor: color.primarioProfundo, borderRadius: 8, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
})

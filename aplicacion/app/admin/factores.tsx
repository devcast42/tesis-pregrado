/** Factores de trabajo — implementa ESP-008 rev. 2 (RF-008-15, RF-008-16).
 *  Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x «Factores de Trabajo».
 *
 *  Jornada y sueño con su referencia y, con seis semanas de datos, si se
 *  mueven junto con el agotamiento en esta empresa. Las correlaciones se
 *  calculan sobre medias semanales ya agregadas: nunca sobre personas.
 *
 *  Eran seis factores. Los otros cuatro —fin de semana, sobretiempo,
 *  guardias, apoyo del líder— no los contesta todo el equipo: uno ya no se
 *  pregunta y tres van detrás del cuestionario largo, que solo hace parte
 *  de la gente cada semana. Ver `FACTORES_DEL_EQUIPO`. */

import { useCallback, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Panel } from '../../modules/panel/Sidebar'
import { miEmpresa, type Empresa } from '../../modules/panel/datos'
import {
  FACTORES, FACTORES_DEL_EQUIPO, enSentidoEsperado, factoresEmpresa, fraseRelacion, pulsoEmpresa, relaciones,
  type FactoresSemana, type PulsoSemana, type Relacion,
} from '../../modules/panel/empresario'
import { Caja, Pastilla, Pie, SinReporte, TarjetaFactor } from '../../modules/panel/PiezasEmpresario'
import { Aviso, Cargando, Pantalla } from '../../modules/nucleo/ui'
import { ancho, color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCalendario, IconoEquipo, IconoEscudoCheck, IconoInfo, IconoReloj } from '../../modules/nucleo/iconos'

const MINIMO = 10

export default function FactoresEmpresario() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [factores, setFactores] = useState<FactoresSemana[]>([])
  const [pulso, setPulso] = useState<PulsoSemana[]>([])
  const [listo, setListo] = useState(false)
  const { width } = useWindowDimensions()
  const columnas = width >= 1180 ? 3 : width >= 800 ? 2 : 1

  const cargar = useCallback(async () => {
    const em = await miEmpresa()
    setEmpresa(em)
    if (em) {
      const [f, p] = await Promise.all([factoresEmpresa(em.id), pulsoEmpresa(em.id)])
      setFactores(f); setPulso(p)
    }
    setListo(true)
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (!listo) return <Panel rol="admin"><Cargando /></Panel>
  if (!empresa) return <Panel rol="admin"><Pantalla ancho={ancho.panel}><Aviso>Tu cuenta no está asociada a ninguna empresa.</Aviso></Pantalla></Panel>

  const ultima = factores[factores.length - 1]
  const { listas: todas, semanas } = relaciones(pulso, factores)
  const listas = todas.filter((r) => FACTORES_DEL_EQUIPO.includes(r.clave))
  // El hallazgo es la relación más fuerte EN EL SENTIDO ESPERADO. Antes era
  // «la más fuerte que no sea protectora», y eso colaba relaciones al revés:
  // titulaba «Jornadas que no cierran» sobre «las jornadas largas muestran
  // menos agotamiento» y recomendaba revisar la carga.
  const principal = listas.find(enSentidoEsperado)
  const delEquipo = FACTORES.filter((f) => FACTORES_DEL_EQUIPO.includes(f.clave))

  return (
    <Panel rol="admin">
      <Pantalla ancho={ancho.panel}>
        <View style={e.encabezado}>
          <View style={{ flex: 1, gap: 4, minWidth: 280 }}>
            <View style={e.fila}>
              <Pastilla fondo="#E8EFEA" tinta={color.primarioProfundo}>ANÁLISIS DE FACTORES</Pastilla>
              <Text style={[texto.dato, { color: color.textoMedio }]}>• {empresa.nombre}</Text>
            </View>
            <Text style={[texto.titulo, { color: color.texto }]}>Factores de Trabajo</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 560 }]}>
              Cuánto trabaja y cuánto duerme tu equipo cada semana, según su check-in diario, y si eso se mueve junto con el agotamiento.
            </Text>
          </View>
          {ultima && (
            <Caja estilo={{ paddingVertical: 12, paddingHorizontal: espacio.base }}>
              <View style={[e.fila, { gap: espacio.base }]}>
                <View style={e.fila}>
                  <IconoCalendario tamano={16} color={color.primarioProfundo} />
                  <Text style={[texto.apoyoFuerte, { color: color.texto }]}>Semana {factores.length}</Text>
                </View>
                <View style={e.fila}>
                  <IconoEquipo tamano={16} color={color.primarioProfundo} />
                  <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{ultima.respondientes} trabajadores activos</Text>
                </View>
              </View>
            </Caja>
          )}
        </View>

        {!ultima ? (
          <SinReporte inscritos={0} minimo={MINIMO} />
        ) : (
          <>
            <View style={e.grid}>
              {delEquipo.map((f) => (
                <View key={f.clave} style={{ width: columnas === 1 ? '100%' : '48.5%', flexGrow: 1 }}>
                  <TarjetaFactor clave={f.clave} historial={factores} />
                </View>
              ))}
            </View>

            {/* Qué se mueve con qué (RF-008-16) */}
            <Caja>
              <View style={{ gap: espacio.md }}>
                <View style={[e.fila, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 2, minWidth: 260 }}>
                    <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 11 }]}>◇ MATRIZ CAUSAL Y DINÁMICA</Text>
                    <Text style={[texto.seccion, { color: color.texto }]}>Qué se mueve con qué</Text>
                    <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                      Qué prácticas de trabajo se mueven junto con el agotamiento de tu equipo.
                    </Text>
                  </View>
                  <View style={e.rigor}>
                    <IconoEscudoCheck tamano={16} color={color.primarioProfundo} />
                    <View>
                      <Text style={[texto.datoFuerte, { color: color.texto }]}>Rigor Metodológico</Text>
                      <Text style={[texto.dato, { color: color.textoSuave }]}>Pearson ρ sobre medias semanales · |ρ| ≥ 0.4</Text>
                    </View>
                  </View>
                </View>

                {semanas < 6 ? (
                  <View style={e.espera}>
                    <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Con seis semanas de datos podremos decirte qué factores pesan más en tu empresa.</Text>
                    <Text style={[texto.apoyo, { color: color.textoMedio }]}>Van {semanas} de 6 semanas reportables.</Text>
                    <View style={e.progreso}><View style={[e.progresoLleno, { width: `${Math.round((semanas / 6) * 100)}%` }]} /></View>
                  </View>
                ) : listas.length === 0 ? (
                  <Text style={[texto.apoyo, { color: color.textoMedio }]}>
                    Con {semanas} semanas, ningún factor muestra todavía una relación clara con el agotamiento (|ρ| ≥ 0.4). Se seguirá evaluando cada semana.
                  </Text>
                ) : (
                  listas.slice(0, 4).map((rel) => <FilaRelacion key={rel.clave} rel={rel} />)
                )}
                <View style={[e.fila, { gap: 6 }]}>
                  <IconoInfo tamano={13} color={color.textoSuave} />
                  <Text style={[texto.dato, { color: color.textoSuave, flex: 1 }]}>
                    Calculado con {semanas} semanas seguidas de {empresa.nombre} ({ultima.respondientes} personas). Hacen falta al menos 6 semanas para que la lectura sea fiable.
                  </Text>
                </View>
              </View>
            </Caja>

            {/* Tres lecturas */}
            <View style={e.tres}>
              <Lectura
                rotulo="HALLAZGO CLAVE"
                titulo={principal ? tituloHallazgo(principal.clave) : 'Sin hallazgo dominante'}
                texto={principal
                  ? `${fraseRelacion(principal)} (ρ = ${principal.r.toFixed(2)}). Es el factor con mayor peso en el agotamiento de tu equipo.`
                  : semanas >= 6
                    ? 'Ni la jornada ni el sueño se mueven todavía junto con el agotamiento como cabría esperar. Se seguirá evaluando cada semana.'
                    : 'Cuando haya seis semanas reportables, aquí aparecerá el factor que más se mueve junto con el agotamiento.'}
                pie={principal ? accionHallazgo(principal.clave) : undefined}
                tonoPie={color.primarioProfundo}
              />
              <Lectura
                rotulo="PRIVACIDAD"
                titulo="De dónde salen las cifras"
                texto="Las cifras salen del check-in diario, que es voluntario y anónimo: una respuesta nunca se puede atribuir a una persona."
                pie="Cómo se protege el anonimato"
                tonoPie={color.textoSuave}
              />
            </View>
          </>
        )}

        <Pie />
      </Pantalla>
    </Panel>
  )
}

function FilaRelacion({ rel }: { rel: Relacion }) {
  const pct = Math.round(Math.abs(rel.r) * 100)
  const tinta = rel.protector ? color.primarioProfundo : '#B0532F'
  return (
    <View style={[e.relacion, rel.protector && { backgroundColor: '#E8F3EE' }]}>
      <View style={[e.iconoRelacion, rel.protector && { backgroundColor: '#D3EBE1' }]}>
        {rel.protector ? <IconoEscudoCheck tamano={18} color={color.primarioProfundo} /> : <IconoReloj tamano={18} color="#B0532F" />}
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 220 }}>
        <Text style={[texto.cuerpo, { color: color.texto }]}>{fraseRelacion(rel)}.</Text>
        <Text style={[texto.dato, { color: tinta }]}>
          <Text style={texto.datoFuerte}>{rel.protector ? 'Factor protector significativo' : `Relación ${rel.fuerza}`} (ρ = {rel.r.toFixed(2)})</Text>
          {' '}• {rel.protector ? 'Amortiguador psicosocial crítico' : rel.fuerza === 'fuerte' ? 'Impacto de latencia inmediata' : 'Deterioro de la ventana circadiana'}
        </Text>
      </View>
      <View style={{ width: 150, gap: 4 }}>
        <View style={e.fila}>
          <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{rel.protector ? 'Capacidad protectora' : 'Fuerza de relación'}</Text>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>{pct} %</Text>
        </View>
        <View style={e.progreso}><View style={[e.progresoLleno, { width: `${pct}%`, backgroundColor: tinta }]} /></View>
      </View>
    </View>
  )
}

function Lectura({ rotulo, titulo, texto: t, pie, tonoPie }: { rotulo: string; titulo: string; texto: string; pie?: string; tonoPie: string }) {
  return (
    <View style={{ flex: 1, minWidth: 220 }}>
      <Caja>
        <View style={{ gap: espacio.sm }}>
          <Text style={[texto.etiqueta, { color: color.primarioProfundo, fontSize: 11 }]}>{rotulo}</Text>
          <Text style={[texto.seccion, { color: color.texto, fontSize: 18, lineHeight: 24 }]}>{titulo}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>{t}</Text>
          {pie && <Text style={[texto.datoFuerte, { color: tonoPie, marginTop: 4 }]}>{pie}</Text>}
        </View>
      </Caja>
    </View>
  )
}

function tituloHallazgo(clave: Relacion['clave']): string {
  return {
    horas_dia_media: 'Jornadas que no cierran',
    sueno_media: 'Noches cortas',
    fin_de_semana_media: 'Fines de semana ocupados',
    sobretiempo_media: 'Sobretiempo acumulado',
    guardia_pct: 'Guardias sin descompresión',
    apoyo_lider_media: 'Liderazgo bajo presión',
  }[clave]
}

function accionHallazgo(clave: Relacion['clave']): string {
  return {
    horas_dia_media: 'Revisión de carga recomendada',
    sueno_media: 'Revisión de horarios recomendada',
    fin_de_semana_media: 'Política de desconexión recomendada',
    sobretiempo_media: 'Límite de sobretiempo recomendado',
    guardia_pct: 'Revisión de turnos recomendada',
    apoyo_lider_media: 'Acompañamiento a líderes recomendado',
  }[clave]
}

const e = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.base, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.base },
  rigor: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.sm, paddingHorizontal: espacio.md },
  espera: { gap: espacio.sm, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.base },
  progreso: { height: 6, borderRadius: 3, backgroundColor: '#E4E1DC', overflow: 'hidden' },
  progresoLleno: { height: 6, borderRadius: 3, backgroundColor: color.primario },
  relacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.base, backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, flexWrap: 'wrap' },
  iconoRelacion: { width: 40, height: 40, borderRadius: radio.sm, backgroundColor: '#EDE3DC', alignItems: 'center', justifyContent: 'center' },
  tres: { flexDirection: 'row', gap: espacio.base, flexWrap: 'wrap' },
})

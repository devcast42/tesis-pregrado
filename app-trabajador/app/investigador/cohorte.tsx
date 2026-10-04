/** Cohorte semanal — implementa ESP-009 RF-009-05.
 *
 *  Es la vista agregada: una fila por semana de calendario, para todas las
 *  empresas o para la filtrada. Contesta «¿cómo va el grupo?», no «¿cómo va
 *  esta persona?», que es lo de Trabajadores.
 *
 *  Antes lo contaba todo en una sola tabla de quince columnas abreviadas
 *  —DETECT., RETIR., AGOT., DESV., FIN DE SEM.— que mezclaba tres preguntas
 *  distintas: quiénes había, cómo salió su OLBI y qué declararon. Ahora son
 *  tres tablas cortas detrás de un selector, con los nombres completos.
 *
 *  Sin mínimo de reporte: el investigador ve los agregados aunque el grupo
 *  sea pequeño (RN-009-04); el administrador de empresa, no. */

import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Panel } from '../../modules/panel/Sidebar'
import { useFiltro, useDatosDelFiltro } from '../../modules/investigador/filtro'
import { cohorte as cargarCohorte, type CohorteSemana } from '../../modules/investigador/panel'
import { listarEmpresas, type Empresa } from '../../modules/panel/datos'
import { Caja, Mono, Pastilla, Rotulo, TONO } from '../../modules/investigador/piezas'
import { GraficaLinea } from '../../modules/panel/Grafica'
import { Cargando } from '../../modules/nucleo/ui'
import { color, espacio, radio, texto } from '../../modules/nucleo/diseno'
import { IconoCalendario, IconoEquipo, IconoGrafica, IconoPersona } from '../../modules/nucleo/iconos'

/** Los cortes del OLBI del estudio (ESP-003). Se pasa el umbral por
 *  agotamiento O por desvinculación, no solo por el primero. */
const UMBRAL_AGOTAMIENTO = 2.875
const UMBRAL_DESVINCULACION = 2.75
const TIERRA = '#8C4A2B'

type Vista = 'quienes' | 'olbi' | 'declarado'
const VISTAS: { clave: Vista; titulo: string; apoyo: string }[] = [
  { clave: 'quienes', titulo: 'Quiénes había', apoyo: 'cuántas personas seguía el estudio cada semana' },
  { clave: 'olbi', titulo: 'Cómo salió el OLBI', apoyo: 'quiénes respondieron el viernes y con qué notas' },
  { clave: 'declarado', titulo: 'Lo que declararon', apoyo: 'horas, sueño, sobretiempo, guardias y apoyo del jefe' },
]

export default function Cohorte() {
  const { filtro } = useFiltro()
  const [filas, setFilas] = useState<CohorteSemana[] | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [vista, setVista] = useState<Vista>('quienes')

  useDatosDelFiltro(() => setFilas(null), async (vigente) => {
    const [c, e] = await Promise.all([cargarCohorte(filtro), listarEmpresas().catch(() => [] as Empresa[])])
    if (!vigente()) return
    setFilas(c); setEmpresas(e)
  }, [filtro.organizacion_id])

  if (!filas) return <Panel rol="investigador"><Cargando /></Panel>

  const empresa = empresas.find((e) => e.id === filtro.organizacion_id)
  /** Igual que en el Resumen: la semana en curso ya tiene fila, pero su
   *  viernes no ha llegado y `respondieron_viernes` es 0. La «última con
   *  datos» es la última que ya tuvo su OLBI. */
  const ultima = [...filas].reverse().find((f) => f.respondieron_viernes > 0) ?? filas[filas.length - 1]
  const enCurso = filas[filas.length - 1]
  const hayEnCurso = !!enCurso && enCurso !== ultima
  /** Las gráficas solo pintan semanas que ya tuvieron su viernes: con la
   *  semana en curso dentro, la línea de participación se desplomaba a 0 como
   *  si la gente hubiera dejado de responder. */
  const conOlbi = filas.filter((f) => f.respondieron_viernes > 0)
  const n = (x: number | null | undefined) => (x == null ? null : Number(x))
  const f1 = (x: number | null | undefined) => (x == null ? '—' : Number(x).toFixed(1))
  const f2 = (x: number | null | undefined) => (x == null ? '—' : Number(x).toFixed(2))
  // pct_alto y guardia_pct ya vienen en 0–100.
  const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(Number(x))}%`)
  const etiquetaSemana = (iso: string) => `S${filas.findIndex((f) => f.semana === iso) + 1}`
  /** Quien responde el viernes puede estar detectado o haber terminado, así
   *  que el denominador honesto es la gente inscrita, no la que sigue activa:
   *  dividiendo entre `activos` salían semanas con «106 % de activos». */
  const respuesta = (f: CohorteSemana) => (f.inscritos ? Math.round((f.respondieron_viernes / f.inscritos) * 100) : null)
  const altoUltima = n(ultima?.olbi_agotamiento_media) != null && n(ultima?.olbi_agotamiento_media)! >= UMBRAL_AGOTAMIENTO

  return (
    <Panel rol="investigador">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.contenido}>
        <View style={{ gap: 6 }}>
          <Rotulo>{`Cohorte · ${empresa ? empresa.nombre : 'todas las empresas'}`}</Rotulo>
          <Text style={[texto.titulo, { color: color.texto, fontSize: 26, lineHeight: 32 }]}>Cómo va el grupo, semana a semana</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, maxWidth: 680 }]}>
            {filas.length === 0
              ? 'Todavía no hay ninguna semana con respuestas del viernes en este corte.'
              : `${filas.length} ${filas.length === 1 ? 'semana' : 'semanas'} con datos, ${rango(filas[0].semana, enCurso.semana)}. Aquí no se oculta nada por tamaño de grupo: eso solo se aplica al administrador de empresa.`}
          </Text>
        </View>

        {/* La trampa de esta pantalla, dicha antes de que muerda. */}
        <View style={e.aviso}>
          <IconoCalendario tamano={15} color={color.primarioProfundo} />
          <Text style={[texto.dato, { color: color.texto, flex: 1, minWidth: 260 }]}>
            «Semana» es la del calendario, no la semana N de cada persona. Como no todas empezaron el mismo lunes, en una misma fila puede haber quien va por su tercera semana y quien va por la quinta.
          </Text>
        </View>

        {filas.length > 0 && (
          <>
            <View style={[e.fila, { justifyContent: 'space-between' }]}>
              <Rotulo>La última semana con datos</Rotulo>
              <View style={[e.fila, { gap: 6 }]}>
                {hayEnCurso && <Text style={[texto.dato, { color: color.textoSuave }]}>{`la de ahora (${rangoSemana(enCurso.semana)}) aún no tiene viernes`}</Text>}
                <Pastilla tono={TONO.verdeSuave}>{rangoSemana(ultima.semana)}</Pastilla>
              </View>
            </View>

            <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
              <Tarjeta rotulo="Estaban inscritas" icono={<IconoEquipo tamano={16} color={color.primarioProfundo} />}
                valor={String(ultima.inscritos)} unidad="personas" apoyo={`${ultima.activos} siguen en seguimiento activo`} />
              <Tarjeta rotulo="Respondieron el viernes" icono={<IconoPersona tamano={16} color={color.primarioProfundo} />}
                valor={String(ultima.respondieron_viernes)} unidad={`de ${ultima.inscritos}`}
                apoyo={respuesta(ultima) == null ? 'sin inscritas esa semana' : `${respuesta(ultima)}% contestó el OLBI`}
                tinta={respuesta(ultima) != null && respuesta(ultima)! < 80 ? TIERRA : color.texto} />
              <Tarjeta rotulo="Agotamiento medio" icono={<IconoGrafica tamano={16} color={TIERRA} />} fondoIcono="#FBEDE6"
                valor={f2(ultima.olbi_agotamiento_media)} unidad="de 4.0"
                apoyo={altoUltima ? `por encima del umbral (${UMBRAL_AGOTAMIENTO})` : `por debajo del umbral (${UMBRAL_AGOTAMIENTO})`}
                tinta={altoUltima ? TIERRA : color.texto} />
              <Tarjeta rotulo="Pasaron el umbral esa semana" icono={<IconoGrafica tamano={16} color={TIERRA} />} fondoIcono="#FBEDE6"
                valor={pct(ultima.pct_alto)} unidad={`de las ${ultima.respondieron_viernes} que contestaron`}
                apoyo={n(ultima.pct_alto) ? 'ese viernes' : 'ninguna, ese viernes'}
                tinta={n(ultima.pct_alto) ? TIERRA : color.texto} />
            </View>

            {/* Dos cifras que parecen la misma y no lo son. */}
            {ultima.detectados > 0 && (
              <Text style={[texto.dato, { color: color.textoMedio }]}>
                Ojo con no sumar esto a las <Text style={{ color: TIERRA }}>{ultima.detectados} personas detectadas</Text> del estudio: esa cuenta es acumulada —cruzaron el umbral en alguna semana y siguen marcadas—, mientras que la cifra de arriba es solo de ese viernes.
              </Text>
            )}

            <View style={[e.fila, { gap: espacio.base, alignItems: 'stretch' }]}>
              <Caja estilo={{ flex: 1.2, minWidth: 320, gap: espacio.sm }}>
                <Rotulo>Cómo se sienten, en promedio</Rotulo>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  {`Media de las dos notas del OLBI entre quienes contestaron. Línea marrón: el umbral de agotamiento (${UMBRAL_AGOTAMIENTO}). Línea gris: el de desvinculación (${UMBRAL_DESVINCULACION}).`}
                </Text>
                <GraficaLinea
                  series={[
                    { etiqueta: 'Agotamiento', color: TIERRA, puntos: conOlbi.map((f) => ({ x: f.semana, y: n(f.olbi_agotamiento_media) })) },
                    { etiqueta: 'Desvinculación', color: color.primarioProfundo, puntos: conOlbi.map((f) => ({ x: f.semana, y: n(f.olbi_desvinculacion_media) })) },
                  ]}
                  yMin={1} yMax={4} alto={220} umbral={UMBRAL_AGOTAMIENTO} umbralEtiqueta="Umbral de agotamiento"
                  referencia={UMBRAL_DESVINCULACION} todasLasEtiquetasX etiquetaX={etiquetaSemana}
                />
              </Caja>
              <Caja estilo={{ flex: 1, minWidth: 300, gap: espacio.sm }}>
                <Rotulo>Cuántas responden y cuántas pasan el umbral</Rotulo>
                <Text style={[texto.dato, { color: color.textoMedio }]}>
                  En porcentaje. La verde debería mantenerse alta; la marrón es la que importa que no suba.
                </Text>
                <GraficaLinea
                  series={[
                    { etiqueta: 'Pasaron el umbral', color: TIERRA, puntos: conOlbi.map((f) => ({ x: f.semana, y: n(f.pct_alto) })) },
                    { etiqueta: 'Respondieron', color: color.primarioProfundo, puntos: conOlbi.map((f) => ({ x: f.semana, y: respuesta(f) })) },
                  ]}
                  yMin={0} yMax={100} alto={220} todasLasEtiquetasX etiquetaX={etiquetaSemana}
                />
              </Caja>
            </View>

            {/* Tres preguntas, tres tablas cortas, una cada vez. */}
            <View style={[e.fila, { gap: espacio.sm, alignItems: 'stretch' }]}>
              {VISTAS.map((v) => {
                const on = vista === v.clave
                return (
                  <Pressable key={v.clave} onPress={() => setVista(v.clave)} style={[e.vista, on && e.vistaOn]}
                    accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Text style={[texto.datoFuerte, { color: on ? color.primarioProfundo : color.texto }]}>{v.titulo}</Text>
                    <Text style={[texto.dato, { color: color.textoMedio, fontSize: 11.5 }]}>{v.apoyo}</Text>
                  </Pressable>
                )
              })}
            </View>

            <Caja estilo={{ gap: 4 }}>
              {vista === 'quienes' && (
                <Tabla
                  cabecera={['Semana', 'Inscritas', 'En seguimiento', 'Detectadas', 'Retiradas', 'Terminadas']}
                  filas={filas.map((f, i) => ({
                    clave: f.semana, titulo: `Semana ${i + 1}`, apoyo: f === enCurso && hayEnCurso ? `${rangoSemana(f.semana)} · en curso` : rangoSemana(f.semana),
                    celdas: [
                      { v: String(f.inscritos) }, { v: String(f.activos) },
                      { v: String(f.detectados), tinta: f.detectados ? TIERRA : undefined, fuerte: !!f.detectados },
                      { v: String(f.retirados) }, { v: String(f.finalizados) },
                    ],
                  }))}
                  nota="«Inscritas» es cuánta gente llevaba el estudio hasta esa semana. Las tres últimas columnas dicen en qué estado están HOY esas mismas personas, no en qué estado estaban entonces: la base no guarda el histórico de estados."
                />
              )}
              {vista === 'olbi' && (
                <Tabla
                  cabecera={['Semana', 'Respondieron', '% que respondió', 'Agotamiento', 'Desvinculación', 'Pasaron el umbral']}
                  filas={filas.map((f, i) => {
                    const alto = n(f.olbi_agotamiento_media) != null && n(f.olbi_agotamiento_media)! >= UMBRAL_AGOTAMIENTO
                    const baja = respuesta(f) != null && respuesta(f)! < 80
                    return {
                      clave: f.semana, titulo: `Semana ${i + 1}`, apoyo: f === enCurso && hayEnCurso ? `${rangoSemana(f.semana)} · en curso` : rangoSemana(f.semana), resaltar: alto,
                      celdas: [
                        { v: `${f.respondieron_viernes} de ${f.inscritos}` },
                        { v: respuesta(f) == null ? '—' : `${respuesta(f)}%`, tinta: baja ? TIERRA : undefined },
                        { v: f2(f.olbi_agotamiento_media), tinta: alto ? TIERRA : undefined, fuerte: alto },
                        { v: f2(f.olbi_desvinculacion_media), tinta: n(f.olbi_desvinculacion_media) != null && n(f.olbi_desvinculacion_media)! >= UMBRAL_DESVINCULACION ? TIERRA : undefined },
                        { v: pct(f.pct_alto), tinta: n(f.pct_alto) ? TIERRA : undefined },
                      ],
                    }
                  })}
                  nota={`Las medias son de quienes contestaron esa semana, no de toda la cohorte. «Pasaron el umbral» es el porcentaje de esas respuestas con agotamiento ≥ ${UMBRAL_AGOTAMIENTO} o desvinculación ≥ ${UMBRAL_DESVINCULACION}. Una fila en tierra tiene el agotamiento medio sobre el umbral.`}
                />
              )}
              {vista === 'declarado' && (
                <Tabla
                  cabecera={['Semana', 'Horas al día', 'Horas de sueño', 'Trabajó el finde', 'Sobretiempo', 'De guardia', 'Apoyo del jefe']}
                  filas={filas.map((f, i) => ({
                    clave: f.semana, titulo: `Semana ${i + 1}`, apoyo: f === enCurso && hayEnCurso ? `${rangoSemana(f.semana)} · en curso` : rangoSemana(f.semana),
                    celdas: [
                      { v: `${f1(f.horas_dia_media)} h` }, { v: `${f1(f.sueno_media)} h` }, { v: `${f1(f.fin_de_semana_media)} h` },
                      { v: `${f1(f.sobretiempo_media)} h` }, { v: pct(f.guardia_pct) },
                      { v: `${f1(f.apoyo_lider_media)} de 5` },
                    ],
                  }))}
                  nota="Horas al día, de sueño y del fin de semana salen del check-in diario; el sobretiempo, la guardia y el apoyo del jefe, del formulario del viernes. «Apoyo del jefe» va de 1 («nunca conté con él») a 5 («siempre»)."
                />
              )}
              <View style={[e.fila, { justifyContent: 'flex-end', paddingTop: 4 }]}><Mono tono={color.textoSuave}>cohorte_semanal</Mono></View>
            </Caja>
          </>
        )}

        {filas.length === 0 && (
          <Caja>
            <Text style={[texto.apoyo, { color: color.textoMedio }]}>
              Una semana aparece aquí en cuanto alguien contesta el OLBI de ese viernes. Si acabas de dar de alta la empresa, la primera fila saldrá el viernes que viene.
            </Text>
          </Caja>
        )}
      </ScrollView>
    </Panel>
  )
}

function Tarjeta({ rotulo, valor, unidad, apoyo, icono, tinta = color.texto, fondoIcono = '#EAF4EF' }: {
  rotulo: string; valor: string; unidad?: string; apoyo: string; icono: React.ReactNode; tinta?: string; fondoIcono?: string
}) {
  return (
    <View style={e.tarjeta}>
      <View style={[e.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, minWidth: 90 }}><Rotulo>{rotulo}</Rotulo></View>
        <View style={[e.cuadroIcono, { backgroundColor: fondoIcono }]}>{icono}</View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        <Text style={[texto.cifra, { color: tinta, fontSize: 26, lineHeight: 30 }]}>{valor}</Text>
        {unidad && <Text style={[texto.dato, { color: color.textoMedio }]}>{unidad}</Text>}
      </View>
      <Text style={[texto.dato, { color: tinta === color.texto ? color.textoMedio : tinta, fontSize: 11.5 }]}>{apoyo}</Text>
    </View>
  )
}

type Celda = { v: string; tinta?: string; fuerte?: boolean }
type FilaTabla = { clave: string; titulo: string; apoyo: string; resaltar?: boolean; celdas: Celda[] }

/** Tabla de la cohorte: la primera columna es la semana con su rango de
 *  fechas debajo; las demás, cifras alineadas a la derecha. */
function Tabla({ cabecera, filas, nota }: { cabecera: string[]; filas: FilaTabla[]; nota: string }) {
  return (
    <>
      <View style={e.tablaCab}>
        {cabecera.map((h, i) => (
          <Text key={h} style={[texto.etiqueta, { color: color.textoMedio, fontSize: 9.5, flex: i === 0 ? 1.6 : 1, textAlign: i === 0 ? 'left' : 'right' }]} numberOfLines={2}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>
      {filas.map((f) => (
        <View key={f.clave} style={[e.tablaFila, f.resaltar && { backgroundColor: '#FBEDE6' }]}>
          <View style={{ flex: 1.6 }}>
            <Text style={[texto.datoFuerte, { color: color.texto }]}>{f.titulo}</Text>
            <Text style={[texto.dato, { color: color.textoSuave, fontSize: 11 }]}>{f.apoyo}</Text>
          </View>
          {f.celdas.map((c, i) => (
            <Text key={i} style={[c.fuerte ? texto.datoFuerte : texto.dato, { color: c.tinta ?? color.texto, flex: 1, textAlign: 'right', fontFamily: MONO }]}>{c.v}</Text>
          ))}
        </View>
      ))}
      <Text style={[texto.dato, { color: color.textoSuave, paddingTop: 8 }]}>{nota}</Text>
    </>
  )
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

/** El lunes de la semana viene como fecha suelta («2026-09-21»). Hay que
 *  leerla a mediodía: `new Date('2026-09-21')` es medianoche UTC, que en Perú
 *  cae el día 20 y desplazaba todas las fechas un día hacia atrás. */
function dia(iso: string, mas = 0): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + mas)
  return d
}
/** «del 17 de agosto al 25 de setiembre», o «del 14 al 25 de setiembre»
 *  cuando el mes es el mismo. */
function rango(desde: string, hasta: string): string {
  const a = dia(desde), b = dia(hasta, 4)
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`
}
/** «21 – 25 de setiembre», o con los dos meses si la semana los cruza. */
function rangoSemana(iso: string): string {
  const l = dia(iso), v = dia(iso, 4)
  return l.getMonth() === v.getMonth()
    ? `${l.getDate()} – ${v.getDate()} de ${MESES[l.getMonth()]}`
    : `${l.getDate()} de ${MESES[l.getMonth()]} – ${v.getDate()} de ${MESES[v.getMonth()]}`
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const e = StyleSheet.create({
  contenido: { padding: espacio.lg, gap: espacio.base, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, flexWrap: 'wrap' },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.sm, backgroundColor: '#EAF4EF', borderRadius: radio.md, padding: espacio.md, flexWrap: 'wrap' },
  tarjeta: { flex: 1, minWidth: 190, gap: 4, backgroundColor: color.superficie, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', padding: espacio.md },
  cuadroIcono: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vista: { flex: 1, minWidth: 180, gap: 2, padding: 10, borderRadius: radio.md, borderWidth: 1, borderColor: '#EEECE8', backgroundColor: color.superficie },
  vistaOn: { borderColor: color.primarioProfundo, backgroundColor: '#EAF4EF' },
  tablaCab: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#F5F4F1', borderRadius: 6 },
  tablaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEECE8', borderRadius: radio.sm },
})

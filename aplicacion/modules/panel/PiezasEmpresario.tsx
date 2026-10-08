/** Piezas del panel del empresario — ESP-008 rev. 2.
 *  Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x (Inicio, Pulso, Factores, Personas,
 *  Informe mensual), reproducido pieza por pieza.
 *
 *  Todo lo que se pinta aquí es agregado. Las piezas no reciben nunca un
 *  trabajador: reciben medias, niveles y semanas. */

import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { color, espacio, radio, texto } from '../nucleo/diseno'
import {
  IconoActualizar, IconoBarras, IconoCampana, IconoCandado, IconoEscudo, IconoReloj, IconoTendenciaAbajo, IconoTendenciaArriba,
} from '../nucleo/iconos'
import {
  ETIQUETA_NIVEL, FACTORES, fueraDeReferencia,
  type ClaveFactor, type FactoresSemana, type Nivel, type PulsoSemana, type Recomendacion,
} from './empresario'
import { GraficaLinea } from './Grafica'

/** Tonos del diseño: «a vigilar» y «alto» en salmón/tierra suave, «bajo» gris. */
export const TONO_NIVEL: Record<Nivel, { fondo: string; tinta: string }> = {
  bajo: { fondo: '#EDEBE7', tinta: '#3F3A36' },
  a_vigilar: { fondo: '#FBE4DC', tinta: '#C4664A' },
  alto: { fondo: '#F6D6CB', tinta: '#A8663D' },
}

export const SALMON = { fondo: '#FBE4DC', tinta: '#C4664A' }

// -------------------------------------------------------------- Básicos

export function Pastilla({ children, fondo = color.superficieSuave, tinta = color.textoMedio, icono, punto }: {
  children: string; fondo?: string; tinta?: string; icono?: ReactNode; punto?: string
}) {
  return (
    <View style={[e.pastilla, { backgroundColor: fondo }]}>
      {punto && <View style={[e.punto, { backgroundColor: punto }]} />}
      {icono}
      <Text style={[texto.datoFuerte, { color: tinta, fontSize: 12 }]}>{children}</Text>
    </View>
  )
}

export function PastillaNivel({ nivel }: { nivel: Nivel }) {
  const t = TONO_NIVEL[nivel]
  return <Pastilla fondo={t.fondo} tinta={t.tinta}>{ETIQUETA_NIVEL[nivel]}</Pastilla>
}

export function Rotulo({ children, derecha, tinta = color.textoSuave }: { children: string; derecha?: ReactNode; tinta?: string }) {
  return (
    <View style={e.rotulo}>
      <Text style={[texto.etiqueta, { color: tinta, flex: 1 }]}>{children.toUpperCase()}</Text>
      {derecha}
    </View>
  )
}

/** Tarjeta blanca del panel (borde muy suave, radio 16). */
export function Caja({ children, suave = false, estilo }: { children: ReactNode; suave?: boolean; estilo?: object }) {
  return <View style={[e.caja, suave && e.cajaSuave, estilo]}>{children}</View>
}

/** Título de sección con punto de color a la izquierda, como «● Lo que más pesa esta semana». */
export function TituloSeccion({ titulo, subtitulo, punto = color.tierra }: { titulo: string; subtitulo: string; punto?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={e.fila}>
        <View style={[e.puntoGrande, { backgroundColor: punto }]} />
        <Text style={[texto.seccion, { color: color.texto }]}>{titulo}</Text>
      </View>
      <Text style={[texto.apoyo, { color: color.textoMedio, paddingLeft: 18 }]}>{subtitulo}</Text>
    </View>
  )
}

// ---------------------------------------------------------- Participación

/** «20 de 22 contestaron (90 %)», con barra y si eso basta para leer la cifra. */
export function TarjetaRespondieron({ respondieron, de, pct }: { respondieron: number; de: number; pct: number | null }) {
  const ok = pct != null && pct >= 60
  return (
    <Caja estilo={{ paddingVertical: 14 }}>
      <View style={[e.fila, { gap: espacio.base }]}>
        <View style={e.cuadroVerde}><IconoBarras tamano={20} color={color.primarioProfundo} /></View>
        <View style={{ gap: 6, minWidth: 160 }}>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            <Text style={[texto.seccion, { color: color.texto }]}>{respondieron}</Text> de {de} contestaron{pct != null ? ` (${pct}%)` : ''}
          </Text>
          <View style={e.barraPista}><View style={[e.barraLlena, { width: `${Math.min(100, pct ?? 0)}%` }]} /></View>
        </View>
        <Pastilla fondo={ok ? '#E8EFEA' : color.alertaSuave} tinta={ok ? color.primarioProfundo : color.alerta} punto={ok ? color.primario : color.alerta}>
          {ok ? 'Contestó bastante gente' : 'Contestó poca gente'}
        </Pastilla>
      </View>
    </Caja>
  )
}

// ---------------------------------------------------------------- Escala

/** Cortes de respaldo por si `umbrales_empresa` no llegó. Son los mismos que
 *  hay en la base (Peterson et al., 2008); el panel usa siempre los de la base
 *  cuando los tiene. */
const CORTES_RESPALDO = {
  agotamiento: { a_vigilar: 2.25, alto: 2.85 },
  desvinculacion: { a_vigilar: 2.1, alto: 2.6 },
} as const

/** Las tres zonas de la escala, de bueno a malo. Las pastillas usan gris para
 *  «bajo» porque ahí no hay nada que avisar; aquí la barra tiene que leerse
 *  de un vistazo como un semáforo, así que «bajo» va en verde. */
const ZONA = {
  bajo: { fondo: '#DCEFE6', tinta: '#2F6B52' },
  a_vigilar: { fondo: '#FBE4DC', tinta: '#C4664A' },
  alto: { fondo: '#F2C7B4', tinta: '#8C4A2B' },
} as const

/** La puntuación del equipo dibujada sobre su escala.
 *
 *  «2.0 / 4.0» no le dice nada a quien lo lee: parece una nota o un
 *  porcentaje, y no se sabe si es mucho o poco. Es el promedio de lo que
 *  contestó el equipo, de 1 (nada) a 4 (mucho), y lo que importa es en qué
 *  zona cae y cuánto le falta para la siguiente. Eso es lo que se pinta. */
export function EscalaNivel({ dimension, valor, umbral, compacta = false }: {
  dimension: 'agotamiento' | 'desvinculacion'
  valor: number
  umbral?: { a_vigilar: number; alto: number } | null
  compacta?: boolean
}) {
  // Supabase devuelve `numeric` como texto: «2.25» - «2.85» funcionaría por
  // coerción, pero una suma lo concatenaría.
  const base = umbral ?? CORTES_RESPALDO[dimension]
  const u = { a_vigilar: Number(base.a_vigilar), alto: Number(base.alto) }
  const pos = (x: number) => `${((Math.min(4, Math.max(1, x)) - 1) / 3) * 100}%` as const
  const zona: Nivel = valor >= u.alto ? 'alto' : valor >= u.a_vigilar ? 'a_vigilar' : 'bajo'
  const falta = (x: number) => (x - valor).toFixed(2).replace(/0$/, '')
  const frase = zona === 'bajo'
    ? `Zona baja. Le faltan ${falta(u.a_vigilar)} para entrar en «a vigilar».`
    : zona === 'a_vigilar'
      ? `Zona «a vigilar». Le faltan ${falta(u.alto)} para llegar a «alto».`
      : 'Zona alta: el equipo, en promedio, está en riesgo de burnout.'

  return (
    <View style={{ gap: 6 }}>
      <View style={e.escala}>
        <View style={e.pista}>
          <View style={[e.zona, { left: 0, width: pos(u.a_vigilar), backgroundColor: ZONA.bajo.fondo }]} />
          <View style={[e.zona, { left: pos(u.a_vigilar), width: `${((u.alto - u.a_vigilar) / 3) * 100}%`, backgroundColor: ZONA.a_vigilar.fondo }]} />
          <View style={[e.zona, { left: pos(u.alto), right: 0, backgroundColor: ZONA.alto.fondo }]} />
        </View>
        <View style={[e.marcador, { left: pos(valor) }]}>
          <View style={[e.marcadorPunto, { backgroundColor: ZONA[zona].tinta }]} />
        </View>
      </View>
      {/* Solo 1 y 4 en los extremos: «nada» y «mucho» los dice la cabecera,
          y en las tarjetas estrechas del informe pisaban el corte alto. */}
      <View style={e.escalaEtiquetas}>
        <Text style={[texto.dato, e.extremo]}>1</Text>
        <Text style={[texto.dato, e.corte, { left: pos(u.a_vigilar), color: ZONA.a_vigilar.tinta }]}>{u.a_vigilar}</Text>
        <Text style={[texto.dato, e.corte, { left: pos(u.alto), color: ZONA.alto.tinta }]}>{u.alto}</Text>
        <Text style={[texto.dato, e.extremo, { marginLeft: 'auto' }]}>4</Text>
      </View>
      {!compacta && <Text style={[texto.apoyo, { color: ZONA[zona].tinta }]}>{frase}</Text>}
    </View>
  )
}

// ------------------------------------------------------------- Dimensión

export function TarjetaDimension({ dimension, pulso, estudio, umbral }: {
  dimension: 'agotamiento' | 'desvinculacion'
  pulso: PulsoSemana[]
  estudio?: number | null
  umbral?: { a_vigilar: number; alto: number } | null
}) {
  const clave = `${dimension}_media` as const
  const nivelClave = `nivel_${dimension}` as const
  const ultima = pulso[pulso.length - 1]
  const previa = pulso[pulso.length - 2]
  const cambio = ultima && previa ? Number(ultima[clave]) - Number(previa[clave]) : null
  const serie = pulso.slice(-6)
  const valores = serie.map((p) => Number(p[clave]))
  const tinta = dimension === 'agotamiento' ? '#8C4A2B' : color.primarioProfundo
  const desde = pulso.length - serie.length + 1

  return (
    <Caja>
      <View style={{ gap: espacio.md }}>
        {/* Título y texto a todo lo ancho; las pastillas, en su propia fila.
            En la misma línea, el nombre se partía en dos («Agotamie / nto»)
            y la descripción quedaba en una columna de cuatro palabras. */}
        <View style={{ gap: 6 }}>
          <Text style={[texto.seccion, { color: color.texto, fontSize: 19 }]}>{dimension === 'agotamiento' ? 'Agotamiento' : 'Desvinculación'}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            {dimension === 'agotamiento'
              ? 'Cuánto cansancio acumulado declara el equipo. Cuanto más bajo, mejor.'
              : 'Cuánto se ha desenganchado la gente de su trabajo. Cuanto más bajo, mejor.'}
          </Text>
          <View style={[e.fila, { gap: 6, flexWrap: 'wrap' }]}>
            {ultima && <PastillaNivel nivel={ultima[nivelClave]} />}
            {cambio !== null && (
              <Pastilla fondo="#EDEBE7" tinta={color.texto}
                icono={cambio > 0 ? <IconoTendenciaArriba tamano={13} color={color.tierra} /> : <IconoTendenciaAbajo tamano={13} color={color.primario} />}>
                {cambio === 0 ? 'igual que la semana pasada' : `${cambio > 0 ? '+' : ''}${cambio.toFixed(1)} que la semana pasada`}
              </Pastilla>
            )}
          </View>
        </View>

        <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
          <Text style={[texto.cifra, { color: color.texto, fontSize: 30, lineHeight: 34 }]}>{ultima ? Number(ultima[clave]).toFixed(1) : '—'}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 4 }]}>de 4</Text>
          {estudio != null && (
            <>
              <View style={e.separadorV} />
              <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 4 }]}>
                Las otras empresas, en <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{Number(estudio).toFixed(1)}</Text>
              </Text>
            </>
          )}
        </View>

        {ultima && <EscalaNivel dimension={dimension} valor={Number(ultima[clave])} umbral={umbral} />}

        {serie.length >= 2 && (
          <View style={e.mini}>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              {`Semanas ${desde} a ${pulso.length}: entre ${Math.min(...valores).toFixed(1)} y ${Math.max(...valores).toFixed(1)}.`}
              {estudio != null ? ' Puntos: las otras empresas.' : ''}
            </Text>
            <GraficaLinea
              series={[{ etiqueta: dimension, color: tinta, puntos: serie.map((p) => ({ x: p.semana, y: Number(p[clave]) })) }]}
              yMin={Math.max(1, Math.min(...valores) - 0.4)}
              yMax={Math.min(4, Math.max(...valores) + 0.4)}
              referencia={estudio ?? undefined}
              alto={96} desnuda area sinLeyenda todasLasEtiquetasX
              etiquetaX={(_x, i) => `S${desde + i} (${valores[i].toFixed(1)})`}
            />
          </View>
        )}
      </View>
    </Caja>
  )
}

// ------------------------------------------------------------ Lo que pesa

/** Qué significa cada factor cuando se sale de la referencia, dicho para
 *  quien dirige un equipo. Las frases de antes —«Impacto
 *  crítico detectado en el indicador de agotamiento del viernes», «señales
 *  de desacople entre compromisos de entrega y renegociación de alcance en
 *  incidentes de mitad de sprint»— sonaban a consultora y no decían qué
 *  pasaba. */
const PESA: Record<ClaveFactor, { icono: (c: string) => ReactNode; frase: (v: number) => string; ref: string }> = {
  horas_dia_media: {
    icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: (v) => `Se trabajó ${(v - 8.5).toFixed(1)} h al día más de la referencia de 8.5 h. Sostenido varias semanas, es lo que primero se nota en el cansancio del viernes.`,
    ref: 'hasta 8.5 h al día',
  },
  guardia_pct: {
    icono: (c) => <IconoCampana tamano={16} color={c} />,
    frase: (v) => `Uno de cada ${Math.max(2, Math.round(100 / Math.max(1, v)))} estuvo disponible fuera de horario. Estar pendiente, aunque no llamen, no deja descansar del todo.`,
    ref: 'hasta el 20 % del equipo',
  },
  apoyo_lider_media: {
    icono: (c) => <IconoActualizar tamano={16} color={c} />,
    frase: () => 'La gente siente menos respaldo de su jefe directo del que sería esperable. Es el factor que más protege del agotamiento, así que mueve la aguja más que ningún otro.',
    ref: 'al menos 3.5 de 5',
  },
  sueno_media: {
    icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: (v) => `Se durmió ${(7 - v).toFixed(1)} h menos de lo recomendable. El sueño que falta no se recupera el fin de semana: se acumula.`,
    ref: 'al menos 7 h por noche',
  },
  fin_de_semana_media: {
    icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: () => 'Se trabajó el fin de semana más de lo previsto. Cuando no hay un corte limpio, el lunes se empieza ya cansado.',
    ref: 'hasta 2 h por fin de semana',
  },
  sobretiempo_media: {
    icono: (c) => <IconoCampana tamano={16} color={c} />,
    frase: () => 'El sobretiempo pasó de lo previsto. Suele aparecer antes de que caigan el sueño y el ánimo del viernes, así que es una buena señal temprana.',
    ref: 'hasta 4 h a la semana',
  },
}

export function TarjetaPesa({ clave, valor }: { clave: ClaveFactor; valor: number }) {
  const f = FACTORES.find((x) => x.clave === clave)!
  const p = PESA[clave]
  const fuera = fueraDeReferencia(clave, valor)
  const t = fuera ? SALMON : { fondo: '#EDEBE7', tinta: color.texto }
  const etiqueta = !fuera ? 'Dentro de lo previsto' : f.peorSi === 'mayor' ? 'Por encima de lo previsto' : 'Por debajo de lo previsto'
  const titulo = clave === 'guardia_pct' ? `${valor.toFixed(0)} % del equipo estuvo de guardia`
    : clave === 'apoyo_lider_media' ? `El apoyo del jefe quedó en ${valor.toFixed(1)} de 5`
    : `${f.nombre}: ${valor.toFixed(1)} ${f.unidad.replace(' / ', '/')}`
  return (
    <Caja>
      <View style={{ gap: espacio.sm }}>
        <View style={e.fila}>
          <View style={{ flex: 1, flexDirection: 'row' }}><Pastilla fondo={t.fondo} tinta={t.tinta}>{etiqueta}</Pastilla></View>
          {p.icono(fuera ? SALMON.tinta : color.textoMedio)}
        </View>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>{p.frase(valor)}</Text>
        <View style={e.separadorH} />
        <View style={e.fila}>
          <Text style={[texto.datoFuerte, { color: color.textoMedio, flex: 1 }]}>Lo esperable sería</Text>
          <Text style={[texto.datoFuerte, { color: color.texto }]}>{p.ref}</Text>
        </View>
      </View>
    </Caja>
  )
}

// -------------------------------------------------------- Recomendación

export function TarjetaRecomendacion({ r, numero }: { r: Recomendacion; numero: number }) {
  return (
    <Caja>
      <View style={{ gap: espacio.sm }}>
        <View style={[e.fila, { alignItems: 'flex-start' }]}>
          <View style={e.numero}><Text style={[texto.datoFuerte, { color: color.primarioProfundo }]}>{String(numero).padStart(2, '0')}</Text></View>
          <Text style={[texto.seccion, { color: color.texto, flex: 1, fontSize: 18, lineHeight: 24 }]}>{r.titulo}</Text>
        </View>
        <Text style={[texto.cuerpo, { color: color.textoMedio, fontSize: 15 }]}>{r.texto}</Text>
        <View style={e.separadorH} />
        <Text style={[texto.dato, { color: color.textoMedio }]}>
          <Text style={texto.datoFuerte}>Evidencia:</Text> {r.referencia}
        </Text>
      </View>
    </Caja>
  )
}

// ---------------------------------------------------------- Nota y pie

export function NotaAgregacion({ respondientes, minimo }: { respondientes?: number; minimo: number }) {
  return (
    <View style={e.nota}>
      <IconoCandado tamano={14} color={color.textoMedio} />
      <Text style={[texto.apoyo, { color: color.textoMedio, flex: 1, minWidth: 240 }]}>
        {respondientes
          ? `Promedio de ${respondientes} respuestas. Nadie de la empresa ve lo que contestó una persona.`
          : 'Son promedios. Nadie de la empresa ve lo que contestó una persona.'}
      </Text>
      <View style={[e.fila, { gap: 6 }]}>
        <View style={[e.punto, { backgroundColor: color.primario }]} />
        <Text style={[texto.datoFuerte, { color: color.texto }]}>Mínimo {minimo} respuestas</Text>
      </View>
    </View>
  )
}

export function SinReporte({ inscritos, minimo }: { inscritos: number; minimo: number }) {
  const faltan = Math.max(0, minimo - inscritos)
  return (
    <Caja suave>
      <View style={[e.fila, { alignItems: 'flex-start' }]}>
        <IconoEscudo tamano={20} color={color.primarioProfundo} />
        <View style={{ flex: 1, gap: espacio.xs }}>
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Todavía no hay cifras que enseñar</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            El promedio de tu empresa aparece cuando al menos {minimo} personas contestan la misma semana.
            Con menos, una cifra podría señalar a alguien concreto, y eso es justo lo que se evita.
            {faltan > 0 ? ` Con ${faltan} ${faltan === 1 ? 'persona más' : 'personas más'} dadas de alta y respondiendo habrá reporte.` : ' Con la participación de esta semana, la próxima ya podría haber reporte.'}
          </Text>
        </View>
      </View>
    </Caja>
  )
}

export function Pie() {
  return (
    <View style={e.pie}>
      <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 260 }]}>Bienestar Tech · detección temprana de agotamiento laboral.</Text>
      <Text style={[texto.dato, { color: color.textoMedio }]}>Las respuestas no se pueden rastrear hasta quien las escribió.</Text>
    </View>
  )
}

const e = StyleSheet.create({
  escala: { height: 14, position: 'relative' },
  pista: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 7, overflow: 'hidden' },
  zona: { position: 'absolute', top: 0, bottom: 0 },
  marcador: { position: 'absolute', top: -5, bottom: -5, width: 0, alignItems: 'center', justifyContent: 'center' },
  marcadorPunto: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF', marginLeft: -9, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  escalaEtiquetas: { flexDirection: 'row', position: 'relative', height: 18 },
  extremo: { color: color.textoSuave },
  corte: { position: 'absolute', transform: [{ translateX: -12 }], fontFamily: 'Inter_600SemiBold' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  caja: { backgroundColor: color.superficie, borderRadius: radio.lg, padding: espacio.lg, borderWidth: 1, borderColor: '#EEECE8' },
  cajaSuave: { backgroundColor: color.superficieSuave, borderColor: 'transparent' },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  puntoGrande: { width: 8, height: 8, borderRadius: 4 },
  cuadroVerde: { width: 44, height: 44, borderRadius: radio.md, backgroundColor: '#E8EFEA', alignItems: 'center', justifyContent: 'center' },
  barraPista: { height: 6, borderRadius: 3, backgroundColor: '#EDEBE7', overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3, backgroundColor: color.primarioProfundo },
  separadorV: { width: 1, height: 20, backgroundColor: color.borde, marginHorizontal: 10, marginBottom: 6 },
  separadorH: { height: 1, backgroundColor: color.borde, marginVertical: 4 },
  mini: { backgroundColor: '#F5F4F1', borderRadius: radio.md, padding: espacio.md, gap: 6 },
  numero: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E8EFEA', alignItems: 'center', justifyContent: 'center' },
  nota: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, backgroundColor: '#F1EFEB', borderRadius: radio.md, padding: espacio.base, flexWrap: 'wrap' },
  pie: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.md, paddingTop: espacio.lg, paddingBottom: espacio.sm, borderTopWidth: 1, borderTopColor: color.borde, flexWrap: 'wrap' },
})

// ---------------------------------------------------------------- Factor

/** Tarjeta de Factores de Trabajo: grupo, pastilla, nombre, cifra, umbral y
 *  una fila de tendencia con texto («Alza en últimas 3 sem.») y rango. */
export function TarjetaFactor({ clave, historial }: { clave: ClaveFactor; historial: FactoresSemana[] }) {
  const f = FACTORES.find((x) => x.clave === clave)!
  const ultima = historial[historial.length - 1]
  const valor = ultima ? ultima[clave] : null
  const fuera = fueraDeReferencia(clave, valor)
  const serie = historial.slice(-6).filter((s) => s[clave] !== null)
  const vals = serie.map((s) => Number(s[clave]))
  const tinta = fuera ? '#8C4A2B' : color.primarioProfundo
  const pct = clave === 'guardia_pct'

  // Frase de tendencia sobre las últimas tres semanas.
  let frase = 'Tendencia estable'
  let sube = false
  if (vals.length >= 3) {
    const d = vals[vals.length - 1] - vals[vals.length - 3]
    const umbralCambio = pct ? 5 : 0.3
    if (d > umbralCambio) { frase = 'Alza en últimas 3 sem.'; sube = true }
    else if (d < -umbralCambio) { frase = 'Caída en últimas 3 sem.' }
    else frase = fuera ? 'Sostenido fuera de ref.' : 'Tendencia estable y favorable'
  }
  const desde = historial.length - serie.length + 1

  return (
    <Caja>
      <View style={{ gap: espacio.sm }}>
        <Rotulo tinta={color.textoMedio} derecha={valor !== null ? (
          <Pastilla fondo={fuera ? SALMON.fondo : '#E8EFEA'} tinta={fuera ? SALMON.tinta : color.primarioProfundo} punto={fuera ? SALMON.tinta : color.primario}>
            {fuera ? 'Fuera de ref.' : 'Dentro de ref.'}
          </Pastilla>
        ) : undefined}>{f.grupo}</Rotulo>
        <Text style={[texto.cuerpoFuerte, { color: color.texto, fontSize: 17 }]}>{f.nombre}</Text>
        <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
          <Text style={[texto.cifra, { color: color.texto }]}>{valor === null ? '—' : Number(valor).toFixed(pct ? 0 : 1)}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 6 }]}>{f.unidad}</Text>
        </View>
        <Text style={[texto.dato, { color: color.textoMedio }]}>
          Umbral ref. institucional: <Text style={[texto.datoFuerte, { color: color.texto }]}>{f.peorSi === 'mayor' ? '≤' : '≥'} {pct ? `${f.ref} %` : `${f.ref.toFixed(1)} ${clave === 'apoyo_lider_media' ? 'pts' : 'h'}`}</Text>
        </Text>
        <View style={e.separadorH} />
        <View style={e.fila}>
          {sube ? <IconoTendenciaArriba tamano={14} color={tinta} /> : <IconoTendenciaAbajo tamano={14} color={tinta} />}
          <Text style={[texto.dato, { color: color.textoMedio, flex: 1 }]}>{frase}</Text>
          <Text style={[texto.dato, { color: color.textoSuave }]}>S{desde} → S{historial.length}</Text>
        </View>
        {serie.length >= 2 && (
          <GraficaLinea
            series={[{ etiqueta: f.nombre, color: tinta, puntos: serie.map((s) => ({ x: s.semana, y: Number(s[clave]) })) }]}
            yMin={Math.min(...vals) - (pct ? 10 : 0.6)} yMax={Math.max(...vals) + (pct ? 10 : 0.6)}
            alto={54} desnuda area sinLeyenda mostrarEjeX={false}
          />
        )}
      </View>
    </Caja>
  )
}

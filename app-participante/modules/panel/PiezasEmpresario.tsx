/** Piezas del panel del empresario — ESP-008 rev. 2.
 *  Diseño: Figma 3fRKKoY8Urkjlh1KQkPC9x (Inicio, Pulso, Factores, Personas,
 *  Informe mensual), reproducido pieza por pieza.
 *
 *  Todo lo que se pinta aquí es agregado. Las piezas no reciben nunca un
 *  participante: reciben medias, niveles y semanas. */

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

/** «34 de 41 respondieron (83 %)» con barra y pastilla de muestra. */
export function TarjetaRespondieron({ respondieron, de, pct }: { respondieron: number; de: number; pct: number | null }) {
  const ok = pct != null && pct >= 60
  return (
    <Caja estilo={{ paddingVertical: 14 }}>
      <View style={[e.fila, { gap: espacio.base }]}>
        <View style={e.cuadroVerde}><IconoBarras tamano={20} color={color.primarioProfundo} /></View>
        <View style={{ gap: 6, minWidth: 150 }}>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            <Text style={[texto.seccion, { color: color.texto }]}>{respondieron}</Text> de {de} respondieron{pct != null ? ` (${pct}%)` : ''}
          </Text>
          <View style={e.barraPista}><View style={[e.barraLlena, { width: `${Math.min(100, pct ?? 0)}%` }]} /></View>
        </View>
        <Pastilla fondo={ok ? '#E8EFEA' : color.alertaSuave} tinta={ok ? color.primarioProfundo : color.alerta} punto={ok ? color.primario : color.alerta}>
          {ok ? 'Muestra representativa' : 'Muestra insuficiente'}
        </Pastilla>
      </View>
    </Caja>
  )
}

// ------------------------------------------------------------- Dimensión

export function TarjetaDimension({ dimension, pulso, estudio }: {
  dimension: 'agotamiento' | 'desvinculacion'
  pulso: PulsoSemana[]
  estudio?: number | null
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
        <View style={[e.fila, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[texto.seccion, { color: color.texto, fontSize: 19 }]}>Dimensión{'\n'}{dimension === 'agotamiento' ? 'Agotamiento' : 'Desvinculación'}</Text>
            <Text style={[texto.apoyo, { color: color.textoMedio, marginTop: 4 }]}>
              {dimension === 'agotamiento'
                ? 'Fatiga física, cognitiva y demanda emocional sostenida'
                : 'Conexión con el propósito, cinismo y sentido del rol'}
            </Text>
          </View>
          <View style={[e.fila, { gap: 6 }]}>
            {ultima && <PastillaNivel nivel={ultima[nivelClave]} />}
            {cambio !== null && (
              <Pastilla fondo="#EDEBE7" tinta={color.texto}
                icono={cambio > 0 ? <IconoTendenciaArriba tamano={13} color={color.tierra} /> : <IconoTendenciaAbajo tamano={13} color={color.primario} />}>
                {`${cambio > 0 ? '+' : ''}${cambio.toFixed(1)} vs S${pulso.length - 1}`}
              </Pastilla>
            )}
          </View>
        </View>

        <View style={[e.fila, { alignItems: 'flex-end', gap: 6 }]}>
          <Text style={[texto.cifra, { color: color.texto, fontSize: 30, lineHeight: 34 }]}>{ultima ? Number(ultima[clave]).toFixed(1) : '—'}</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 4 }]}>/ 4.0</Text>
          {estudio != null && (
            <>
              <View style={e.separadorV} />
              <Text style={[texto.apoyo, { color: color.textoMedio, paddingBottom: 4 }]}>
                Benchmark estudio: <Text style={[texto.apoyoFuerte, { color: color.texto }]}>{Number(estudio).toFixed(1)}</Text>
              </Text>
            </>
          )}
        </View>

        {serie.length >= 2 && (
          <View style={e.mini}>
            <Text style={[texto.dato, { color: color.textoMedio }]}>
              Tendencia acumulada (Semanas {desde} a {pulso.length}) <Text style={[texto.datoFuerte, { color: color.texto }]}>
                Min {Math.min(...valores).toFixed(1)} · Max {Math.max(...valores).toFixed(1)}
              </Text>
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

const PESA: Record<ClaveFactor, { etiqueta: string; icono: (c: string) => ReactNode; frase: (v: number) => string; ref: string }> = {
  horas_dia_media: {
    etiqueta: 'Fuera de referencia', icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: (v) => `Exceso continuo de ${(v - 8.5).toFixed(1)} h sobre el umbral saludable. Impacto crítico detectado en el indicador de agotamiento del viernes.`,
    ref: '≤ 8.5 h / día',
  },
  guardia_pct: {
    etiqueta: 'Sobrecarga reactiva', icono: (c) => <IconoCampana tamano={16} color={c} />,
    frase: () => 'Guardias no programadas y atención de tickets críticos fuera del horario estándar han fragmentado el descanso semanal.',
    ref: '≤ 20 % del equipo',
  },
  apoyo_lider_media: {
    etiqueta: 'Oportunidad de ajuste', icono: (c) => <IconoActualizar tamano={16} color={c} />,
    frase: () => 'Señales de desacople entre compromisos de entrega y renegociación de alcance en incidentes de mitad de sprint.',
    ref: '≥ 3.5 / 5.0',
  },
  sueno_media: {
    etiqueta: 'Fuera de referencia', icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: (v) => `El descanso promedio quedó ${(7 - v).toFixed(1)} h por debajo de la referencia. La recuperación nocturna insuficiente amplifica la fatiga acumulada.`,
    ref: '≥ 7.0 h / noche',
  },
  fin_de_semana_media: {
    etiqueta: 'Fuera de referencia', icono: (c) => <IconoReloj tamano={16} color={c} />,
    frase: () => 'El trabajo en fin de semana recorta la ventana de desconexión. Es el factor con mayor relación con el agotamiento en el modelo JD-R.',
    ref: '≤ 2.0 h / sem',
  },
  sobretiempo_media: {
    etiqueta: 'Sobrecarga reactiva', icono: (c) => <IconoCampana tamano={16} color={c} />,
    frase: () => 'Sobretiempo no planificado sostenido varias semanas. Suele preceder a caídas en el sueño y en el ánimo del viernes.',
    ref: '≤ 4.0 h / sem',
  },
}

export function TarjetaPesa({ clave, valor }: { clave: ClaveFactor; valor: number }) {
  const f = FACTORES.find((x) => x.clave === clave)!
  const p = PESA[clave]
  const fuera = fueraDeReferencia(clave, valor)
  const t = fuera ? SALMON : { fondo: '#EDEBE7', tinta: color.texto }
  const titulo = clave === 'guardia_pct' ? `${valor.toFixed(0)} % del equipo en guardia`
    : clave === 'apoyo_lider_media' ? `Apoyo del líder ${valor.toFixed(1)} / 5`
    : `${f.nombre} ${valor.toFixed(1)} ${f.unidad.replace(' / ', '/')}`
  return (
    <Caja>
      <View style={{ gap: espacio.sm }}>
        <View style={e.fila}>
          <View style={{ flex: 1, flexDirection: 'row' }}><Pastilla fondo={t.fondo} tinta={t.tinta}>{p.etiqueta}</Pastilla></View>
          {p.icono(fuera ? SALMON.tinta : color.textoMedio)}
        </View>
        <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>{titulo}</Text>
        <Text style={[texto.apoyo, { color: color.textoMedio }]}>{p.frase(valor)}</Text>
        <View style={e.separadorH} />
        <View style={e.fila}>
          <Text style={[texto.datoFuerte, { color: color.textoMedio, flex: 1 }]}>Referencia estudio:</Text>
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
          ? `Cifras agregadas de ${respondientes} respondientes. Ningún dato individual es visible para la empresa ni RR.HH.`
          : 'Cifras agregadas. Ningún dato individual es visible para la empresa ni RR.HH.'}
      </Text>
      <View style={[e.fila, { gap: 6 }]}>
        <View style={[e.punto, { backgroundColor: color.primario }]} />
        <Text style={[texto.datoFuerte, { color: color.texto }]}>Mínimo ético de reporte: {minimo} personas</Text>
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
          <Text style={[texto.cuerpoFuerte, { color: color.texto }]}>Todavía no hay cifras semanales</Text>
          <Text style={[texto.apoyo, { color: color.textoMedio }]}>
            Los promedios de la empresa se muestran cuando al menos {minimo} personas responden en la misma semana.
            Es la garantía de que ninguna cifra señala a alguien concreto.
            {faltan > 0 ? ` Con ${faltan} ${faltan === 1 ? 'persona más' : 'personas más'} inscritas y respondiendo habrá reporte.` : ' Con la participación de esta semana, la próxima ya podría haber reporte.'}
          </Text>
        </View>
      </View>
    </Caja>
  )
}

export function Pie() {
  return (
    <View style={e.pie}>
      <Text style={[texto.dato, { color: color.textoMedio, flex: 1, minWidth: 260 }]}>Firma ética de agregación estadística y anonimato · Investigación Universitaria en Salud Ocupacional</Text>
      <Text style={[texto.dato, { color: color.textoMedio }]}>Protocolo de Privacidad k-Anonymity · Perú</Text>
    </View>
  )
}

const e = StyleSheet.create({
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

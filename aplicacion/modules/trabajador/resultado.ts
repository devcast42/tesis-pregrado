/** Retroalimentación al trabajador — implementa ESP-002 (RF-002-12, RN-002-08).
 *
 *  Lo primero es que le sirva a quien responde: al cerrar la
 *  semana la persona ve en qué nivel quedó y qué puede hacer. Se muestra un
 *  NIVEL con recomendaciones, nunca un diagnóstico, y el caso alto termina
 *  siempre en la misma frase: la sesión con el psicólogo.
 *
 *  El puntaje viene del servidor (ESP-003): esta capa solo lo traduce a
 *  palabras. Lógica pura, sin dependencias, para poder probarla sola. */

import AsyncStorage from '@react-native-async-storage/async-storage'

export type Dimension = 'agotamiento' | 'desvinculacion'
export type Nivel = 'bajo' | 'moderado' | 'alto'

/** Lo que devuelve `evaluar-olbi`. */
export type Evaluacion = {
  detectado: boolean
  puntajes: Partial<Record<Dimension, number>>
  umbrales: Partial<Record<Dimension, number | null>>
}

export type ResultadoSemana = {
  fecha: string // ISO del envío del OLBI
  detectado: boolean
  /** Lo que el modelo dijo el último día antes del viernes (RF-002-14). */
  retrospectiva?: { probabilidad: number; dia: string; n_dias: number } | null
  /** Pronóstico para la próxima semana, con la semana ya cerrada (RF-002-14). */
  pronostico?: Prediccion | null
  dimensiones: {
    clave: Dimension
    puntaje: number // media 1–4
    indice: number // 0–100 sobre la escala
    nivel: Nivel
  }[]
}

const ESCALA = { min: 1, max: 4 }
/** Cuánto por debajo del umbral empieza «moderado». Medio punto de la escala. */
const MARGEN_MODERADO = 0.5

export function indiceDe(puntaje: number): number {
  const p = Math.min(ESCALA.max, Math.max(ESCALA.min, puntaje))
  return Math.round(((p - ESCALA.min) / (ESCALA.max - ESCALA.min)) * 100)
}

export function nivelDe(puntaje: number, umbral: number | null | undefined): Nivel {
  if (umbral == null) return 'bajo'
  if (puntaje >= umbral) return 'alto'
  if (puntaje >= umbral - MARGEN_MODERADO) return 'moderado'
  return 'bajo'
}

export function resultadoDesde(evaluacion: Evaluacion, fecha = new Date()): ResultadoSemana {
  const claves: Dimension[] = ['agotamiento', 'desvinculacion']
  return {
    fecha: fecha.toISOString(),
    detectado: evaluacion.detectado,
    dimensiones: claves
      .filter((d) => typeof evaluacion.puntajes[d] === 'number')
      .map((clave) => {
        const puntaje = evaluacion.puntajes[clave] as number
        return { clave, puntaje, indice: indiceDe(puntaje), nivel: nivelDe(puntaje, evaluacion.umbrales[clave]) }
      }),
  }
}

/** El nivel general es el más alto de las dos dimensiones. */
export function nivelGeneral(r: ResultadoSemana): Nivel {
  const orden: Nivel[] = ['bajo', 'moderado', 'alto']
  return r.dimensiones.reduce<Nivel>(
    (acc, d) => (orden.indexOf(d.nivel) > orden.indexOf(acc) ? d.nivel : acc),
    'bajo',
  )
}

export const NOMBRE_DIMENSION: Record<Dimension, string> = {
  agotamiento: 'Agotamiento',
  desvinculacion: 'Desvinculación',
}

export const EXPLICACION_DIMENSION: Record<Dimension, string> = {
  agotamiento: 'Cuánta energía te está costando el trabajo y cuánto te cuesta recuperarla.',
  desvinculacion: 'Qué tan lejos te sientes de lo que haces: interés, sentido, ganas.',
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  bajo: 'Bajo',
  moderado: 'A vigilar',
  alto: 'Alto',
}

/** Mensaje de cabecera según el nivel general. Sin la palabra «burnout» en
 *  el nivel bajo y moderado: no hay nada que diagnosticar. */
export const MENSAJE_GENERAL: Record<Nivel, { titulo: string; cuerpo: string }> = {
  bajo: {
    titulo: 'Tu semana cerró en verde',
    cuerpo: 'Tus respuestas muestran una relación con el trabajo que se sostiene bien. Lo que haces para descansar y desconectar está funcionando; conviene mantenerlo.',
  },
  moderado: {
    titulo: 'Una semana para mirar con atención',
    cuerpo: 'Tus respuestas están en una zona intermedia: no es un problema, pero es una señal temprana. Es el mejor momento para ajustar algo pequeño antes de que se acumule.',
  },
  alto: {
    titulo: 'Esta semana pesó más de la cuenta',
    cuerpo: 'Tus respuestas muestran un nivel de desgaste alto. No estás solo con esto: te ofreceremos una sesión confidencial con un psicólogo, independiente de tu empresa, para conversarlo con calma.',
  },
}

/** Recomendaciones por dimensión y nivel. Concretas, pequeñas, de una
 *  semana. Nada de «gestiona tu estrés». */
export const RECOMENDACIONES: Record<Dimension, Record<Nivel, string[]>> = {
  agotamiento: {
    bajo: [
      'Protege lo que ya te funciona: la hora en que cortas el día, el sueño, el ejercicio que haces.',
    ],
    moderado: [
      'Elige una hora fija para cerrar el trabajo esta semana y cúmplela al menos tres días.',
      'Antes de dormir, treinta minutos sin pantalla de trabajo. La recuperación empieza ahí.',
      'Si estás durmiendo menos de siete horas, ese es el primer cambio, antes que cualquier otro.',
    ],
    alto: [
      'Acepta la sesión con el psicólogo. Es confidencial y no llega a tu empresa.',
      'Esta semana, quita una cosa de la agenda en vez de agregar una. Descansar no es una tarea más.',
      'Habla con alguien de confianza fuera del trabajo sobre cómo te sientes. Decirlo en voz alta ayuda.',
    ],
  },
  desvinculacion: {
    bajo: [
      'Nota qué parte de tu trabajo te sigue interesando; es el ancla para las semanas difíciles.',
    ],
    moderado: [
      'Identifica una tarea de la semana que sí te importe y empieza el día por ella.',
      'Pide claridad sobre algo que no entiendes de tu rol. La desconexión suele empezar en la confusión.',
      'Un almuerzo con alguien del equipo, sin hablar del proyecto.',
    ],
    alto: [
      'Acepta la sesión con el psicólogo. Sirve justamente para esto.',
      'No tomes decisiones grandes sobre tu trabajo esta semana; primero recupera distancia.',
      'Recuerda qué te trajo a este trabajo. No para obligarte a sentirlo, sino para saber si sigue ahí.',
    ],
  },
}

/** Máximo dos por dimensión: una carta breve, no una lista de tareas. */
const MAX_POR_DIMENSION = 2

export function recomendacionesDe(r: ResultadoSemana): { dimension: Dimension; nivel: Nivel; textos: string[] }[] {
  return r.dimensiones.map((d) => ({
    dimension: d.clave,
    nivel: d.nivel,
    textos: RECOMENDACIONES[d.clave][d.nivel].slice(0, MAX_POR_DIMENSION),
  }))
}

// ------------------------------------------------------ Consejo del check-in

/** Un consejo para el cierre del check-in diario, a partir del contexto del
 *  día. Los ítems OLBI-diario no se puntúan (RN-002-04); el consejo sale de
 *  las horas, no de cómo se sintió. */
export function consejoDelDia(valores: Record<string, unknown>): string | null {
  const horas = Number(valores.horas_trabajadas)
  const sueno = Number(valores.horas_sueno)
  const finde = Number(valores.horas_fin_de_semana)

  if (!Number.isNaN(sueno) && sueno > 0 && sueno < 6)
    return 'Dormiste menos de seis horas. Si puedes, hoy acuéstate media hora antes: es el cambio con más efecto sobre cómo te sentirás mañana.'
  if (!Number.isNaN(horas) && horas >= 10)
    return 'Diez horas o más de trabajo. Un día así pasa; una semana así se paga. Mañana, elige una hora de cierre y respétala.'
  if (!Number.isNaN(finde) && finde >= 4)
    return 'Trabajaste varias horas el fin de semana. Esta semana intenta recuperar ese tiempo, aunque sea en dos tardes libres.'
  if (!Number.isNaN(sueno) && sueno >= 7 && !Number.isNaN(horas) && horas <= 8)
    return 'Un día equilibrado: buenas horas de sueño y una jornada razonable. Así se sostiene el resto.'
  return null
}

// ---------------------------------------------------------------- Persistencia

const CLAVE = 'resultado.ultimo'

export async function guardarResultado(r: ResultadoSemana): Promise<void> {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(r)).catch(() => {})
}

export async function ultimoResultado(): Promise<ResultadoSemana | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE)
    return crudo ? (JSON.parse(crudo) as ResultadoSemana) : null
  } catch {
    return null
  }
}

/** Solo en memoria: el consejo del check-in vive lo que dura la pantalla de cierre. */
let consejoPendiente: string | null = null
export function dejarConsejo(c: string | null) { consejoPendiente = c }
export function tomarConsejo(): string | null { const c = consejoPendiente; consejoPendiente = null; return c }

// ------------------------------------------------- Probabilidad del modelo

/** Lo que devuelve `registrar_prediccion` (ESP-005 §8). */
export type Prediccion = {
  version: string
  tarea?: 'nowcast' | 'pronostico'
  origen: 'preentrenamiento' | 'propio'
  n_dias: number
  probabilidad: number | null
  umbral_decision: number
  metricas: {
    global?: { precision: number; recall: number; roc_auc: number }
    por_dias_respondidos?: Record<string, { precision: number; recall: number; roc_auc: number }>
  }
}

export type Confianza = 'baja' | 'media' | 'alta'

/** Métricas que aplican a esta predicción: las del número de días
 *  respondidos si existen, si no las globales. */
export function metricasAplicables(p: Prediccion): { precision: number; recall: number; roc_auc: number } | null {
  return p.metricas.por_dias_respondidos?.[String(p.n_dias)] ?? p.metricas.global ?? null
}

/** La confianza sale de la capacidad discriminativa validada (ROC-AUC) para
 *  ese número de días. Es la misma regla para cualquier versión: un modelo
 *  propio bien validado sube solo. */
export function confianzaDe(p: Prediccion): Confianza {
  const m = metricasAplicables(p)
  if (!m || m.roc_auc < 0.7) return 'baja'
  if (m.roc_auc < 0.8) return 'media'
  // Un modelo preentrenado con datos de otro dominio nunca dice «alta»,
  // por buena que sea su discriminación allá: no está validado aquí.
  return p.origen === 'preentrenamiento' ? 'media' : 'alta'
}

export const ETIQUETA_CONFIANZA: Record<Confianza, string> = {
  baja: 'Confianza baja',
  media: 'Confianza media',
  alta: 'Confianza alta',
}

/** Precisión y recall en palabras que una persona entiende. Se redondea a
 *  «de cada 10» porque dos decimales aparentarían una exactitud que no hay. */
export function explicacionConfianza(p: Prediccion): string {
  const m = metricasAplicables(p)
  const partes: string[] = []
  if (p.origen === 'preentrenamiento') {
    partes.push('Estimación preliminar: el modelo todavía no se ha entrenado con datos de tu empresa. Irá mejorando con las semanas.')
  }
  if (m) {
    const aciertos = Math.round(m.precision * 10)
    const detecta = Math.round(m.recall * 10)
    partes.push(
      p.tarea === 'pronostico'
        ? `De cada 10 avisos que da se confirman unos ${aciertos} la semana siguiente, y detecta unos ${detecta} de cada 10 casos altos.`
        : `Con ${p.n_dias} ${p.n_dias === 1 ? 'día respondido' : 'días respondidos'}, de cada 10 avisos que da se confirman unos ${aciertos} el viernes, y detecta unos ${detecta} de cada 10 casos altos.`,
    )
  }
  return partes.join(' ')
}

/** RF-002-14 — la retrospectiva en una frase: qué dijo el modelo y qué salió. */
export function fraseRetrospectiva(r: ResultadoSemana): string | null {
  const retro = r.retrospectiva
  if (!retro) return null
  const pct = Math.round(retro.probabilidad * 100)
  const dia = new Date(retro.dia + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long' })
  const salio = nivelGeneral(r) === 'alto' ? 'alto' : 'no alto'
  const acerto = (retro.probabilidad >= 0.5) === (salio === 'alto')
  // Dos frases. Lo que el modelo dijo y si acertó; nada más.
  return `El ${dia} el modelo estimó ${pct} % de que hoy saliera alto. Salió ${salio}: ${acerto ? 'acertó' : 'esta vez se equivocó'}.`
}

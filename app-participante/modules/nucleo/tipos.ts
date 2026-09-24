/** Tipos compartidos entre módulos. Contratos de ESP-001 §6 y ESP-002 §6. */

export type ClaveFormulario = 'estable' | 'diario' | 'semanal' | 'olbi'

export type EstadoParticipante = 'activo' | 'detectado' | 'retirado' | 'finalizado'

export type Participante = {
  id: string
  organizacion_id: string
  codigo_anonimo: string
  estado: EstadoParticipante
  inscrito_en: string
}

/** Un ítem de formulario. La definición vive en base de datos, no en el código
 *  (RF-002-02): en un estudio longitudinal no todos los participantes
 *  actualizan la app al mismo tiempo, y el instrumento debe ser idéntico
 *  para todos en un momento dado. */
export type ItemDef = {
  clave: string
  texto: string
  tipo: 'escala' | 'numero' | 'booleano' | 'opcion'
  escala?: { min: number; max: number; etiquetaMin?: string; etiquetaMax?: string }
  opciones?: { valor: string; etiqueta: string }[]
  /** Solo instrumentos psicométricos. El puntaje se calcula en el servidor (RN-002-05). */
  dimension?: string
  invertido?: boolean
  /** Días ISO (1 = lunes … 7 = domingo) en que se muestra. Sin él, siempre. */
  dias?: number[]
}

/** Calendario de un formulario (ESP-002 rev. 2, RF-002-09). Vive en la
 *  definición, no en la app: cambiar el calendario del estudio no debe
 *  requerir que cien personas actualicen la app. */
export type CalendarioFormulario = {
  /** Días ISO en que corresponde. Sin él, cadencia fija (ver `agenda.ts`). */
  dias?: number[]
  /** Días después del que corresponde en que aún se acepta. */
  gracia_dias?: number
  /** Se presenta a continuación de ese formulario, como una sola sesión. */
  despues_de?: ClaveFormulario
}

export type DefinicionFormulario = CalendarioFormulario & {
  titulo: string
  descripcion?: string
  /** Lo que se le anuncia a la persona («35 segundos»), no un cálculo. */
  duracion?: string
  items: ItemDef[]
  /** Orden aleatorio en cada apertura: todos los ítems, o solo esas claves. */
  barajar?: true | string[]
}

export type Formulario = {
  clave: ClaveFormulario
  version: number
  definicion: DefinicionFormulario
}

export type ValorItem = number | string | boolean
export type Valores = Record<string, ValorItem>

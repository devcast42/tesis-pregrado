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
}

export type DefinicionFormulario = {
  titulo: string
  descripcion?: string
  items: ItemDef[]
}

export type Formulario = {
  clave: ClaveFormulario
  version: number
  definicion: DefinicionFormulario
}

export type ValorItem = number | string | boolean
export type Valores = Record<string, ValorItem>

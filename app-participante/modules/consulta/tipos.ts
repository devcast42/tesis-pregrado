/** Contrato compartido entre las dos implementaciones de la videollamada.
 *
 *  `Llamada.tsx` (nativo, @livekit/react-native) y `Llamada.web.tsx`
 *  (navegador, livekit-client) implementan esta misma interfaz. Metro elige
 *  la variante según la plataforma; el resto de la app no se entera. */

export type PropsLlamada = {
  url: string
  token: string
  /** Se invoca cuando la llamada termina, por colgado o por desconexión. */
  onSalir: () => void
  /** Se invoca si no se pudo conectar. Si falta, se usa `onSalir`. */
  onFallo?: () => void
  /** Código anónimo y empresa de la persona al otro lado (solo el psicólogo lo pasa). */
  etiqueta?: string
  /** Si la sesión se está grabando en audio (doble consentimiento). */
  grabando?: boolean
}

export type Credenciales = {
  url: string
  token: string
  sala: string
}

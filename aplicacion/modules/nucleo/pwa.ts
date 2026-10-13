/** PWA del trabajador — solo web.
 *
 *  La misma aplicación corre en navegador (react-native-web). Este módulo
 *  reúne lo que es propio de esa forma de uso: saber si se publicó como
 *  «solo trabajador», si ya está instalada en la pantalla de inicio, y
 *  registrar el service worker. En nativo todo es un no-op. */

import { Platform } from 'react-native'

/** Build publicado para trabajadores (`EXPO_PUBLIC_SOLO_TRABAJADOR=1`).
 *  Los otros roles siguen entrando por la aplicación móvil y el panel web:
 *  aquí se les cierra la sesión con un aviso. El acceso real a los datos lo
 *  impone RLS; esto solo evita mostrar una pantalla que no les corresponde. */
export const SOLO_TRABAJADOR = process.env.EXPO_PUBLIC_SOLO_TRABAJADOR === '1'

const esWeb = Platform.OS === 'web' && typeof window !== 'undefined'

/** El apoyo psicológico (citas, videollamada, informe) solo se ofrece en la
 *  app de Android e iOS. En navegador el trabajador responde y ve su
 *  resultado; si sale alto se le dice que necesita atención y dónde
 *  encontrarla, pero no se abre un caso que nadie va a atender. */
export const APOYO_DISPONIBLE = Platform.OS !== 'web'

/** Abierta desde el ícono de la pantalla de inicio, no desde una pestaña. */
export function estaInstalada(): boolean {
  if (!esWeb) return false
  const ios = (navigator as unknown as { standalone?: boolean }).standalone === true
  return ios || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function esIPhone(): boolean {
  if (!esWeb) return false
  const ua = navigator.userAgent
  // iPadOS se presenta como Mac con pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Registra el service worker. Solo en el build de trabajadores y en
 *  producción: en desarrollo Metro sirve los archivos y una caché intermedia
 *  confunde más de lo que ayuda, y el panel web de los otros roles no es una
 *  PWA. */
export function registrarServiceWorker() {
  if (!esWeb || !SOLO_TRABAJADOR || process.env.NODE_ENV !== 'production') return
  if (!('serviceWorker' in navigator)) return
  const registrar = () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // La primera carga ocurrió antes de que el worker controlara la
        // página: se le pasan los archivos ya descargados para que la
        // siguiente apertura (aun sin red) tenga el armazón completo.
        const propios = performance.getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(window.location.origin))
        reg.active?.postMessage({ tipo: 'guardar', urls: propios })
      })
      .catch(() => {})
  }
  // El componente raíz se monta después de `load` casi siempre: sin esta
  // comprobación el evento ya pasó y el worker no se registraba nunca.
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar, { once: true })
}

/** En un navegador de escritorio la pantalla del trabajador se centra con el
 *  ancho de un teléfono, en lugar de estirarse. No toca el panel web de los
 *  demás roles. */
export function ajustarPantalla() {
  if (!esWeb || !SOLO_TRABAJADOR) return
  const raiz = document.getElementById('root')
  if (!raiz) return
  Object.assign(raiz.style, { maxWidth: '520px', margin: '0 auto', width: '100%', boxShadow: '0 0 0 1px #E8E5E0' })
}

type EventoInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let pendiente: EventoInstalacion | null = null
const oyentes = new Set<() => void>()

if (esWeb) {
  // Chrome y Edge avisan cuándo se puede instalar; Safari en iPhone no tiene
  // este evento (ahí se instala desde Compartir).
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pendiente = e as EventoInstalacion
    oyentes.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    pendiente = null
    oyentes.forEach((f) => f())
  })
}

export function puedeInstalarDirecto(): boolean {
  return pendiente !== null
}

export async function instalar(): Promise<void> {
  const p = pendiente
  if (!p) return
  await p.prompt()
  await p.userChoice.catch(() => {})
  pendiente = null
  oyentes.forEach((f) => f())
}

export function alCambiarInstalacion(f: () => void): () => void {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

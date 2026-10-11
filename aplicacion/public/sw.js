/* Service worker de la PWA del trabajador.
 *
 * Hace dos cosas y nada más:
 *   1. Guarda el armazón de la aplicación (HTML, JS, CSS, fuentes e íconos)
 *      para que abra al instante y muestre algo aunque no haya red.
 *   2. Nunca toca las llamadas a Supabase, a LiveKit ni a ningún otro
 *      origen: los datos de salud no se guardan en caché.
 *
 * Para publicar una versión nueva basta con desplegar: los archivos de
 * `/_expo/static/` llevan hash en el nombre, y la navegación va primero a la
 * red, así que quien tenga conexión siempre recibe el HTML más reciente.
 * Cambiar VERSION solo hace falta si se quiere invalidar todo a la fuerza. */

const VERSION = 'bienestar-v1'
const ESTATICO = `${VERSION}-estatico`
const ARMAZON = `${VERSION}-armazon`

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(ARMAZON).then((c) => c.addAll(['/', '/manifest.webmanifest', '/iconos/icon-192.png'])).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// La página le pasa los archivos que ya descargó (el JS con hash, las
// fuentes): sin esto, la primera visita no los tendría en caché.
self.addEventListener('message', (evento) => {
  const d = evento.data
  if (!d || d.tipo !== 'guardar' || !Array.isArray(d.urls)) return
  const utiles = d.urls.filter((u) => {
    try { const p = new URL(u).pathname; return p.startsWith('/_expo/static/') || p.startsWith('/assets/') } catch { return false }
  })
  evento.waitUntil(caches.open(ESTATICO).then((c) => Promise.all(utiles.map((u) => c.add(u).catch(() => {})))))
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin) return // Supabase, LiveKit, etc.: directo a la red

  // Archivos con hash: no cambian nunca, se sirven de caché.
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.open(ESTATICO).then(async (c) => {
        const guardado = await c.match(pedido)
        if (guardado) return guardado
        const respuesta = await fetch(pedido)
        if (respuesta.ok) c.put(pedido, respuesta.clone())
        return respuesta
      }),
    )
    return
  }

  // Navegación: primero la red; sin red, el armazón guardado.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((respuesta) => {
          const copia = respuesta.clone()
          caches.open(ARMAZON).then((c) => c.put('/', copia)).catch(() => {})
          return respuesta
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
  }
})

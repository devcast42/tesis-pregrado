# PWA del trabajador

La misma aplicación (`aplicacion/`) se publica como **PWA** para que el
trabajador la use desde el iPhone sin pasar por la App Store. Es el mismo
código que la app móvil: Expo compila a navegador con react-native-web.
Lo que cambia es el *build* y un par de ajustes que solo existen en web.

## Qué incluye

| | |
|---|---|
| Instalable | Manifiesto + íconos + service worker. En iPhone se añade desde Safari (Compartir → Añadir a pantalla de inicio); en Android, desde Chrome (aparece un botón Instalar). |
| Solo trabajador | Con `EXPO_PUBLIC_SOLO_TRABAJADOR=1`, psicólogos, investigadores y administradores que entren reciben un aviso y se les cierra la sesión; sus rutas no se abren ni escribiendo la dirección. El acceso real a los datos lo sigue imponiendo RLS. |
| Videollamada | Usa `livekit-client` directamente en el navegador (`modules/consulta/Llamada.web.tsx`). Incluye el botón «Toca para activar el audio», que Safari exige. |
| Sin caché de datos | El service worker solo guarda el armazón (HTML, JS, fuentes). Nunca toca Supabase ni LiveKit. |

## Construir y probar

```bash
cd aplicacion
npm run pwa:export      # genera dist-pwa/
npm run pwa:servir      # sirve dist-pwa/ en http://localhost:8090
```

`pwa:export` toma `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`
de `.env`, que en desarrollo apuntan a la base local. Para publicar contra el
proyecto real, pásalas al exportar; las variables del entorno tienen prioridad
sobre `.env` y la clave de la nube no queda en ningún archivo. El script usa
`--clear` a propósito: sin él Metro reutiliza su caché y puede dejar incrustada
la dirección de la base local aunque cambies las variables.

```bash
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
npm run pwa:export
```

## Publicar

Hace falta **HTTPS**: sin él el navegador no registra el service worker, no deja
instalar y no da acceso a cámara ni micrófono. Sirve cualquier hosting estático.
`dist-pwa/` ya trae la configuración de reescritura a `index.html` y de
cabeceras para Vercel (`vercel.json`) y Netlify o Cloudflare Pages
(`_redirects`, `_headers`):

```bash
npx vercel deploy dist-pwa --prod
```

Cada despliegue nuevo se recoge solo: la navegación va primero a la red y los
archivos con hash cambian de nombre.

## Diferencias con la app móvil

- **Apoyo psicológico.** Solo en la app de Android e iOS (`APOYO_DISPONIBLE`
  en `modules/nucleo/pwa.ts`). En navegador la pestaña Apoyo lo dice y no deja
  pedir cita. Si el OLBI sale alto, el resultado muestra el nivel y que le
  conviene hablar con un psicólogo, sin ofrecer sesión. `evaluar-olbi` recibe
  `derivar: false`: registra la detección (con `sin_derivar` en el evento),
  pero no abre derivación ni cambia el estado, así que al día siguiente la
  persona sigue con su check-in. La bandeja del investigador no la marca como
  «detección sin derivación».

- **Recordatorios.** `expo-notifications` no programa avisos locales en web, y
  un iPhone no los admite en una PWA. La pantalla Perfil ya lo avisa («este
  dispositivo no permite programar recordatorios») y Hoy deja de prometer un
  aviso. Para tenerlos hace falta Web Push (iOS 16.4 o superior, con la PWA
  instalada): una tabla de suscripciones, una función de servidor con claves
  VAPID y una tarea programada. No está hecho.
- **Huella o Face ID.** `expo-local-authentication` no existe en web; el bloqueo
  biométrico se omite (`disponible()` devuelve falso).
- **Videollamada en iPhone.** Requiere iOS 16.4 o superior para usar cámara y
  micrófono dentro de una PWA instalada. Con la sesión de LiveKit en la nube
  debe probarse en un iPhone real antes de dar el servicio por bueno.

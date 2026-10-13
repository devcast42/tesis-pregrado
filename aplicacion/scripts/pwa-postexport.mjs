// Vercel no sube ninguna carpeta llamada `node_modules`, ni siquiera dentro
// del build: las fuentes Inter y los íconos de expo-router quedaban en 404.
// Se mueven a `assets/vendor/` y se corrigen las rutas en el JS. El JS
// cambia de contenido, así que cambia también de nombre: se sirve como
// inmutable y un navegador que ya tuviera el anterior no lo volvería a pedir.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist-pwa'
const origen = join(dist, 'assets', 'node_modules')
if (existsSync(origen)) renameSync(origen, join(dist, 'assets', 'vendor'))

const js = join(dist, '_expo', 'static', 'js', 'web')
for (const f of readdirSync(js).filter((n) => n.endsWith('.js'))) {
  const ruta = join(js, f)
  const antes = readFileSync(ruta, 'utf8')
  const despues = antes.replaceAll('/assets/node_modules/', '/assets/vendor/')
  if (despues === antes) continue
  const hash = createHash('md5').update(despues).digest('hex')
  const nuevo = f.replace(/-[0-9a-f]{32}\.js$/, `-${hash}.js`)
  writeFileSync(ruta, despues)
  if (nuevo !== f) {
    renameSync(ruta, join(js, nuevo))
    const indice = join(dist, 'index.html')
    writeFileSync(indice, readFileSync(indice, 'utf8').replaceAll(f, nuevo))
  }
}

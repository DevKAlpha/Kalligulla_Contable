// Copies the Next.js standalone build (server + static assets) into web-dist/ for electron-builder.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const requireCjs = createRequire(import.meta.url)
const { HIDDEN, renameAll } = requireCjs('./node-modules-rename.cjs')

const here = path.dirname(fileURLToPath(import.meta.url))
const web = path.resolve(here, '../../web')
const standalone = path.join(web, '.next', 'standalone')
const target = path.resolve(here, '../web-dist')

if (!existsSync(path.join(standalone, 'apps', 'web', 'server.js'))) {
  console.error('No se encontró el build standalone. Ejecuta primero: npm run build')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(standalone, target, { recursive: true })
cpSync(path.join(web, '.next', 'static'), path.join(target, 'apps', 'web', '.next', 'static'), { recursive: true })
cpSync(path.join(web, 'public'), path.join(target, 'apps', 'web', 'public'), { recursive: true })
const hidden = renameAll(target, 'node_modules', HIDDEN)
console.log(`Build web preparado en ${path.relative(process.cwd(), target)} (${hidden} carpetas node_modules ocultas para el empaquetado)`)

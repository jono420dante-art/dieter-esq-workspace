/**
 * Build Vite (dist/) and optionally copy into a Dieter FastAPI static folder.
 * Works when this folder is the **root** of its own Git repo (no parent monorepo).
 *
 * - Always runs `vite build`.
 * - Copies `dist/` → `dieter-backend/static` only if that path exists, or if
 *   `DIETER_BACKEND_PATH` is set (absolute, or relative to this package root).
 *
 * Examples:
 *   npm run build:backend
 *   DIETER_BACKEND_PATH=../dieter-backend npm run build:backend
 *   DIETER_BACKEND_PATH=C:/code/dieter-backend npm run build:backend
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const murekaRoot = path.resolve(__dirname, '..')

function copyDistToStatic(targetStatic) {
  const dist = path.join(murekaRoot, 'dist')
  if (!fs.existsSync(dist)) {
    console.error('Missing dist/ after build.')
    process.exit(1)
  }
  fs.mkdirSync(targetStatic, { recursive: true })
  for (const name of fs.readdirSync(targetStatic)) {
    fs.rmSync(path.join(targetStatic, name), { recursive: true, force: true })
  }
  for (const name of fs.readdirSync(dist)) {
    fs.cpSync(path.join(dist, name), path.join(targetStatic, name), { recursive: true })
  }
  console.log(`Copied dist/ → ${targetStatic}`)
}

const viteCli = path.join(murekaRoot, 'node_modules', 'vite', 'bin', 'vite.js')
if (!fs.existsSync(viteCli)) {
  console.error('Vite not installed. Run: npm ci')
  process.exit(1)
}

try {
  execFileSync(process.execPath, [viteCli, 'build'], {
    cwd: murekaRoot,
    stdio: 'inherit',
    env: process.env,
  })
} catch (e) {
  const err = /** @type {NodeJS.ErrnoException & { status?: number }} */ (e)
  if (typeof err.status === 'number') process.exit(err.status)
  throw e
}

const raw = (process.env.DIETER_BACKEND_PATH || '').trim()
let targetStatic
if (raw) {
  const p = path.isAbsolute(raw) ? raw : path.resolve(murekaRoot, raw)
  targetStatic = path.basename(p) === 'static' ? p : path.join(p, 'static')
} else {
  targetStatic = path.join(murekaRoot, '..', 'dieter-backend', 'static')
}

const backendParent = path.dirname(targetStatic)
if (!fs.existsSync(backendParent)) {
  console.log(
    'Note: no Dieter backend folder next to this repo — dist/ is ready to deploy (e.g. Vercel). To copy into a local API checkout, clone dieter-backend beside this repo or set DIETER_BACKEND_PATH.',
  )
  process.exit(0)
}

copyDistToStatic(targetStatic)
console.log('build:backend — OK (Vite + static sync).')

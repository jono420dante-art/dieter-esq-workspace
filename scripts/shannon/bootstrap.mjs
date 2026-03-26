/**
 * Clone KeygraphHQ/shannon and link this monorepo as repos/dieter-app for white-box runs.
 * https://github.com/KeygraphHQ/shannon — AGPL-3.0; only use on systems you authorize.
 *
 * Usage (repo root): npm run shannon:bootstrap
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
const thirdParty = path.join(root, 'third_party')
const shannonDir = path.join(thirdParty, 'shannon')
const reposDir = path.join(shannonDir, 'repos')
const linkPath = path.join(reposDir, 'dieter-app')
const cloneUrl = 'https://github.com/KeygraphHQ/shannon.git'

fs.mkdirSync(thirdParty, { recursive: true })

if (!fs.existsSync(shannonDir)) {
  console.log('Cloning Shannon into third_party/shannon …')
  execSync(`git clone --depth 1 ${cloneUrl} shannon`, {
    cwd: thirdParty,
    stdio: 'inherit',
  })
} else {
  console.log('third_party/shannon already exists — skip clone.')
}

fs.mkdirSync(reposDir, { recursive: true })

if (fs.existsSync(linkPath)) {
  console.log('repos/dieter-app already exists — skip link.')
} else {
  const target = root
  if (process.platform === 'win32') {
    fs.symlinkSync(target, linkPath, 'junction')
  } else {
    fs.symlinkSync(target, linkPath, 'dir')
  }
  console.log(`Linked ${linkPath} -> ${target}`)
}

console.log(`
Next:
  1) docker compose up   (Dieter on http://localhost:8080)
  2) In Git Bash / WSL:
       cd third_party/shannon
       cp .env.example .env
       # set ANTHROPIC_API_KEY (see Shannon README)
       ./shannon start URL=http://host.docker.internal:8080 REPO=dieter-app WORKSPACE=dieter-audit-1
  Reports: third_party/shannon/audit-logs/
`)

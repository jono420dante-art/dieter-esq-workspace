/**
 * Option A · step 2: load .env.deploy then build + wrangler pages deploy.
 * Copy .env.deploy.example → .env.deploy (gitignored) and fill values.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.deploy')

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (k) process.env[k] = v
  }
}

if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
  console.error(
    '\nMissing CLOUDFLARE_API_TOKEN.\n' +
      '  1. Copy .env.deploy.example → .env.deploy\n' +
      '  2. Create a token: Account → Cloudflare Pages → Edit\n' +
      '     https://developers.cloudflare.com/fundamentals/api/get-started/create-token/\n' +
      '  3. Paste CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN into .env.deploy\n' +
      '  4. Run: npm run deploy\n',
  )
  process.exit(1)
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
  console.warn(
    'Warning: CLOUDFLARE_ACCOUNT_ID not set. Wrangler may still work if the token is scoped to one account.\n',
  )
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npm', ['run', 'build'])
run('npx', ['wrangler', 'pages', 'deploy', 'dist', '--project-name=ed-geerdes'])

console.log('\nDeploy finished. Check Cloudflare Pages for the project URL.\n')

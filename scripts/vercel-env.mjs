// Sets Hapax's secrets as encrypted Vercel environment variables, reading
// each from where it lives locally and piping it straight to the Vercel CLI.
// Nothing is printed except variable names.
// Usage (from hapax/web, after `vercel link`): node ../scripts/vercel-env.mjs [publicUrl]
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
  if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}
const stellar = process.env.STELLAR_CLI ?? 'stellar'
const key = (alias) => execFileSync(stellar, ['keys', 'show', alias], { encoding: 'utf8' }).trim()
const state = JSON.parse(readFileSync('server/data/state.json', 'utf8'))

const vars = {
  HAPAX_AGENCY_A_SECRET: key('hapax-agency-a'),
  HAPAX_AGENCY_B_SECRET: key('hapax-agency-b'),
  HAPAX_RELAYER_SECRET: key('hapax-dev'),
  HAPAX_PEPPER: state.pepper,
  BREVO_API_KEY: env.BREVO_API_KEY,
  BREVO_SENDER: env.BREVO_SENDER,
  UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
}
if (process.argv[2]) vars.HAPAX_PUBLIC_URL = process.argv[2]

const vercel = process.platform === 'win32' ? 'npx.cmd' : 'npx'
for (const [name, value] of Object.entries(vars)) {
  if (!value) throw new Error(`no value for ${name}`)
  spawnSync(vercel, ['--yes', 'vercel@latest', 'env', 'rm', name, 'production', '--yes'], { stdio: 'ignore', shell: process.platform === 'win32' })
  const r = spawnSync(vercel, ['--yes', 'vercel@latest', 'env', 'add', name, 'production'], {
    input: value,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  console.log(`${r.status === 0 ? 'set ' : 'FAIL'}  ${name}`)
  if (r.status !== 0) console.log(r.stderr.split('\n').filter((l) => !l.includes(value)).slice(-3).join('\n'))
}

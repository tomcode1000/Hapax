// One-off: copies web/server/data/state.json into Upstash Redis under this
// registry's namespace, so a deployment starts with the same list as the
// local server. Prints counts only, never values.
// Usage: node server/migrate-to-redis.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Redis } from '@upstash/redis'

for (const line of readFileSync(join(import.meta.dirname, '../.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}

const state = JSON.parse(readFileSync(join(import.meta.dirname, 'data/state.json'), 'utf8'))
const r = Redis.fromEnv()
const k = (name) => `hapax:${state.registry}:${name}`

const commitments = Object.fromEntries(state.commitments.map((c, i) => [i, c]).filter(([, c]) => c))
if (Object.keys(commitments).length) await r.hset(k('commitments'), commitments)

const records = Object.fromEntries(Object.entries(state.records ?? {}).map(([c, rec]) => [c, JSON.stringify(rec)]))
if (Object.keys(records).length) await r.hset(k('records'), records)

await r.hset(k('counters'), {
  'byAgency.a': state.byAgency?.a ?? 0,
  'byAgency.b': state.byAgency?.b ?? 0,
  paid: state.paid ?? 0,
  'blocked.enrol': state.blocked?.enrol ?? 0,
  'blocked.claim': state.blocked?.claim ?? 0,
})

await r.del(k('feed'))
const feed = [...(state.feed ?? [])].reverse()
for (const entry of feed) await r.lpush(k('feed'), JSON.stringify(entry))

console.log(`migrated: ${Object.keys(commitments).length} commitments, ${Object.keys(records).length} records, ${feed.length} feed entries`)
console.log('pepper present in state.json:', Boolean(state.pepper))

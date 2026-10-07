import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Redis } from '@upstash/redis'

/**
 * Where Hapax keeps its off-chain state.
 *
 * Two implementations behind one interface:
 *   - FileStore, for running locally (web/server/data/state.json);
 *   - RedisStore, for Vercel, where there is no disk that survives a request.
 *
 * Every write is a single atomic operation (a hash field, a counter, a list
 * push), never read-modify-write of one big document. That matters: the
 * commitments list mirrors the on-chain Merkle tree, and two enrolments
 * landing at once must not overwrite each other, or every proof made from
 * the mirror would fail.
 *
 * Stored: commitments (public on-chain anyway), per-person records keyed by
 * commitment (salted hashes of DOB, PIN and activation code, never the ID
 * number), counters, the activity feed, and rate-limit hits. Never stored:
 * ID numbers, PINs, codes in the clear, or email addresses.
 */

const FEED_MAX = 60

class FileStore {
  constructor(dir, registry) {
    this.path = join(dir, 'state.json')
    this.dir = dir
    this.registry = registry
    this.hits = new Map()
  }

  async load() {
    await mkdir(this.dir, { recursive: true })
    this.s = await readFile(this.path, 'utf8')
      .then((t) => JSON.parse(t))
      .catch(() => null)
    if (!this.s) {
      this.s = { registry: this.registry, commitments: [], byAgency: { a: 0, b: 0 }, paid: 0, blocked: { enrol: 0, claim: 0 }, feed: [], records: {} }
    }
    if (this.s.registry !== this.registry) throw new Error('state.json belongs to another registry; move it aside')
    this.s.records ??= {}
    return this
  }

  save() {
    return writeFile(this.path, JSON.stringify(this.s, null, 2))
  }

  /** The pepper lives in state.json locally; HAPAX_PEPPER overrides it. */
  async pepper() {
    return process.env.HAPAX_PEPPER ?? this.s.pepper
  }

  async setCommitment(index, commitment) {
    this.s.commitments[index] = commitment
    await this.save()
  }

  async commitments() {
    return this.s.commitments
  }

  async record(commitment) {
    return this.s.records[commitment] ?? null
  }

  async putRecord(commitment, rec) {
    this.s.records[commitment] = rec
    await this.save()
  }

  async incr(name) {
    const [a, b] = name.split('.')
    if (b) this.s[a][b] = (this.s[a][b] ?? 0) + 1
    else this.s[a] = (this.s[a] ?? 0) + 1
    await this.save()
  }

  async counters() {
    return { byAgency: this.s.byAgency, paid: this.s.paid, blocked: this.s.blocked }
  }

  async log(entry) {
    this.s.feed.unshift(entry)
    this.s.feed.length = Math.min(this.s.feed.length, FEED_MAX)
    await this.save()
  }

  async feed() {
    return this.s.feed
  }

  async hit(key, windowMs) {
    const now = Date.now()
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs)
    recent.push(now)
    this.hits.set(key, recent)
    return recent.length
  }
}

class RedisStore {
  constructor(registry) {
    this.r = Redis.fromEnv()
    // Namespaced by registry, so a redeployed contract starts clean.
    this.k = (name) => `hapax:${registry}:${name}`
  }

  async load() {
    return this
  }

  async pepper() {
    const p = process.env.HAPAX_PEPPER
    if (!p) throw new Error('HAPAX_PEPPER is not set')
    return p
  }

  async setCommitment(index, commitment) {
    await this.r.hset(this.k('commitments'), { [index]: commitment })
  }

  async commitments() {
    const all = (await this.r.hgetall(this.k('commitments'))) ?? {}
    const out = []
    for (const [i, c] of Object.entries(all)) out[Number(i)] = String(c)
    return out
  }

  async record(commitment) {
    const v = await this.r.hget(this.k('records'), commitment)
    return v ? (typeof v === 'string' ? JSON.parse(v) : v) : null
  }

  async putRecord(commitment, rec) {
    await this.r.hset(this.k('records'), { [commitment]: JSON.stringify(rec) })
  }

  async incr(name) {
    await this.r.hincrby(this.k('counters'), name, 1)
  }

  async counters() {
    const c = (await this.r.hgetall(this.k('counters'))) ?? {}
    const n = (key) => Number(c[key] ?? 0)
    return { byAgency: { a: n('byAgency.a'), b: n('byAgency.b') }, paid: n('paid'), blocked: { enrol: n('blocked.enrol'), claim: n('blocked.claim') } }
  }

  async log(entry) {
    await this.r.lpush(this.k('feed'), JSON.stringify(entry))
    await this.r.ltrim(this.k('feed'), 0, FEED_MAX - 1)
  }

  async feed() {
    const items = (await this.r.lrange(this.k('feed'), 0, FEED_MAX - 1)) ?? []
    return items.map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
  }

  async hit(key, windowMs) {
    const k = this.k(`hits:${key}`)
    const n = await this.r.incr(k)
    if (n === 1) await this.r.pexpire(k, windowMs)
    return n
  }
}

export async function openStore({ registry, dir }) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.HAPAX_STORE !== 'file') {
    return new RedisStore(registry).load()
  }
  return new FileStore(dir, registry).load()
}

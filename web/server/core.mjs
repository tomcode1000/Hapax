import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { Keypair } from '@stellar/stellar-sdk'
import { chain, secretOf, ContractError } from './chain.mjs'
import { tree, secretFor, commitmentOf } from './tree.mjs'
import { inviteEmail } from './invite-email.mjs'
import { openStore } from './store.mjs'
import config from './config.json' with { type: 'json' }

/**
 * The Hapax service logic, shared by the local server (server/index.mjs)
 * and the Vercel functions (api/*.mjs).
 *
 * Plays three parts that would be separate in a real deployment, and the
 * README says so:
 *   - the enrolment service, which holds the pepper and turns an ID number
 *     into a person's secret;
 *   - the two agencies' signers, which enrol and relay claims (testnet keys);
 *   - a tree mirror, which hands a phone the Merkle path for its own leaf.
 *
 * What it never stores or shows is an ID number. The feed carries leaf
 * indexes and shortened nullifiers, which is all any agency would see.
 */

/* ---------------------------------------------------------------- secrets -- */

/*
  Locally, secrets come from web/.env and the stellar-cli identities. On
  Vercel they are encrypted environment variables. Nothing secret is in the
  repository.
*/
try {
  for (const line of readFileSync(join(import.meta.dirname, '../.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    // Values may be quoted, as many .env files write them.
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {}

const keyFor = (envName, cliAlias) => Keypair.fromSecret(process.env[envName] || secretOf(cliAlias))

const TEST_DOMAIN = process.env.HAPAX_ALLOW_TEST_EMAIL === '1' ? '@example.test' : null
const PUBLIC_URL = (process.env.HAPAX_PUBLIC_URL ?? 'http://localhost:8790').replace(/\/$/, '')
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000

/** Brevo's transactional API, as in Quorum's notifier. Without a key it logs and sends nothing. */
const sendMail = async ({ to, subject, text, html }) => {
  const key = process.env.BREVO_API_KEY
  const from = process.env.BREVO_SENDER ?? ''
  if (!key || !from) {
    console.log(`[hapax] email not sent (no BREVO_API_KEY/BREVO_SENDER): "${subject}"`)
    return false
  }
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  const sender = m ? { name: m[1] || 'Hapax', email: m[2] } : { name: 'Hapax', email: from.trim() }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  })
  if (!res.ok) throw new Error(`Brevo refused the email: ${res.status}`)
  return true
}

const hashOf = (value, salt) => scryptSync(String(value), salt, 32).toString('hex')
const sameHash = (a, b) => a && b && a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
const validId = (v) => /^\d{6,16}$/.test(String(v ?? ''))
const validDob = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(v))
const validPin = (v) => /^\d{4,6}$/.test(String(v ?? ''))
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '')) && String(v).length <= 254
const maskEmail = (e) => e.replace(/^(.)[^@]*(@.).*(\.[^.]+)$/, '$1•••$2•••$3')
const short = (s) => {
  const t = String(s)
  return `${t.slice(0, 6)}…${t.slice(-4)}`
}

/*
  A per-address ceiling on the endpoints that check secrets or send email, on
  top of the per-person lockout. Without it one machine could try PINs across
  many ID numbers, or use the invite to send mail in bulk.
*/
const LIMITS = { '/api/verify': 30, '/api/resend': 10, '/api/enrol': 40 }
const WINDOW_MS = 10 * 60 * 1000

export async function createApp() {
  const relayer = keyFor('HAPAX_RELAYER_SECRET', config.relayer)
  const cfg = { ...config, readSource: relayer.publicKey() }
  const signers = {
    a: keyFor('HAPAX_AGENCY_A_SECRET', config.agencies.a.key),
    b: keyFor('HAPAX_AGENCY_B_SECRET', config.agencies.b.key),
  }
  const stellar = chain(cfg)
  const store = await openStore({ registry: config.registry, dir: join(import.meta.dirname, 'data') })
  const pepper = await store.pepper()
  if (!pepper) throw new Error('No pepper: set HAPAX_PEPPER')

  const log = (entry) => store.log({ at: new Date().toISOString(), ...entry })

  /*
    The round's balance comes from the chain and takes a few seconds to read.
    Every console polls every three seconds, so it is cached briefly, and a
    claim drops the cache so the paid amount shows at once.
  */
  let roundCache = { at: 0, value: null }
  const roundInfo = async () => {
    if (Date.now() - roundCache.at < 10_000 && roundCache.value) return roundCache.value
    const value = await stellar.round(config.round).catch(() => roundCache.value)
    roundCache = { at: Date.now(), value }
    return value
  }
  const dropRoundCache = () => {
    roundCache = { at: 0, value: roundCache.value }
  }
  const recordFor = (idNumber) => {
    const secret = secretFor(idNumber, pepper)
    const commitment = commitmentOf(secret).toString()
    return { secret, commitment }
  }

  /** Issues a fresh activation code and emails it. Only its hash is kept; the address is dropped. */
  async function sendInvite(agency, email, rec) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const expiresAt = Date.now() + CODE_TTL_MS
    rec.code = hashOf(code, rec.salt)
    rec.codeExpires = expiresAt
    const testOnly = TEST_DOMAIN !== null && String(email).toLowerCase().endsWith(TEST_DOMAIN)
    let emailed = false
    if (!testOnly) {
      const round = await roundInfo()
      const amount = round ? `${Number(round.amount) / 1e7} ${config.asset.code}` : config.asset.code
      const message = inviteEmail({ agencyName: config.agencies[agency].name, code, expiresAt, amount, claimUrl: `${PUBLIC_URL}/claim` })
      emailed = await sendMail({ to: email, ...message }).catch((e) => {
        console.error(`[hapax] ${e.message}`)
        return false
      })
    }
    return { emailed, sentTo: maskEmail(String(email)), ...(testOnly ? { testCode: code } : {}) }
  }

  async function enrol({ agency, idNumber, dob, email }) {
    const signer = signers[agency]
    if (!signer) return [400, { error: 'Unknown agency' }]
    if (!validId(idNumber)) return [400, { error: 'Enter an ID number of 6 to 16 digits.' }]
    if (!validDob(dob)) return [400, { error: 'Enter the date of birth.' }]
    if (!validEmail(email)) return [400, { error: 'Enter an email address for the invite.' }]
    const { commitment } = recordFor(idNumber)
    try {
      const { hash, value: index } = await stellar.enrol(signer, commitment)
      await store.setCommitment(index, commitment)
      await store.incr(`byAgency.${agency}`)
      const salt = randomBytes(16).toString('hex')
      const rec = { index, salt, dob: hashOf(dob, salt), code: null, codeExpires: 0, pin: null, fails: 0, lockedUntil: 0 }
      const invite = await sendInvite(agency, email, rec)
      await store.putRecord(commitment, rec)
      await log({ kind: 'enrolled', agency, detail: `Person #${index + 1} added to the shared list`, hash })
      return [200, { status: 'enrolled', index, hash, ...invite }]
    } catch (e) {
      if (e instanceof ContractError && e.name === 'AlreadyEnrolled') {
        await store.incr('blocked.enrol')
        await log({ kind: 'duplicate-enrol', agency, detail: 'Already enrolled by an agency. No details shared.' })
        return [200, { status: 'already' }]
      }
      throw e
    }
  }

  /**
   * Resends the invite when the first one never arrived or the code expired.
   * Only before a PIN is set, and only with the same ID number and date of
   * birth: an agency can already learn "enrolled" by trying to enrol.
   */
  async function resend({ agency, idNumber, dob, email }) {
    if (!signers[agency]) return [400, { error: 'Unknown agency' }]
    if (!validId(idNumber) || !validDob(dob)) return [400, { error: 'Enter the ID number and date of birth.' }]
    if (!validEmail(email)) return [400, { error: 'Enter an email address for the invite.' }]
    const { commitment } = recordFor(idNumber)
    const rec = await store.record(commitment)
    if (!rec || !sameHash(hashOf(dob, rec.salt), rec.dob)) return [200, { status: 'no-match' }]
    if (rec.pin) return [200, { status: 'already-active' }]
    const invite = await sendInvite(agency, email, rec)
    rec.fails = 0
    rec.lockedUntil = 0
    await store.putRecord(commitment, rec)
    await log({ kind: 'resent', agency, detail: `Invite resent to person #${rec.index + 1}` })
    return [200, { status: 'sent', ...invite }]
  }

  /**
   * Verifies a person and hands their phone what it needs to prove: the
   * secret and the Merkle path. Activation is ID + date of birth + emailed
   * code + new PIN; sign-in is ID + PIN. Every failure looks the same, so
   * the endpoint cannot be used to learn whether an ID number is enrolled.
   */
  async function verify({ idNumber, dob, pin, newPin, code }) {
    const NOPE = [200, { status: 'no-match' }]
    if (!validId(idNumber)) return [400, { error: 'Enter your ID number.' }]
    const { secret, commitment } = recordFor(idNumber)
    const rec = await store.record(commitment)
    if (!rec) return NOPE
    if (rec.lockedUntil > Date.now()) {
      return [200, { status: 'locked', minutes: Math.ceil((rec.lockedUntil - Date.now()) / 60000) }]
    }
    const fail = async () => {
      rec.fails += 1
      if (rec.fails >= MAX_FAILS) {
        rec.fails = 0
        rec.lockedUntil = Date.now() + LOCK_MS
      }
      await store.putRecord(commitment, rec)
      return NOPE
    }

    if (newPin !== undefined) {
      if (!validPin(newPin)) return [400, { error: 'Choose a PIN of 4 to 6 digits.' }]
      if (!validDob(dob) || !sameHash(hashOf(dob, rec.salt), rec.dob)) return fail()
      // The emailed code: what ID number + date of birth alone cannot give a relative.
      const codeOk = rec.codeExpires > Date.now() && /^\d{6}$/.test(String(code ?? '')) && sameHash(hashOf(code, rec.salt), rec.code)
      if (rec.code && !codeOk) return fail()
      // Only after the date of birth is proven: otherwise this would tell a
      // stranger that the ID number is enrolled.
      if (rec.pin) return [200, { status: 'already-active' }]
      rec.pin = hashOf(newPin, rec.salt)
      rec.code = null // used once
    } else {
      if (!rec.pin) return NOPE // not activated yet; indistinguishable from a wrong PIN
      if (!validPin(pin) || !sameHash(hashOf(pin, rec.salt), rec.pin)) return fail()
    }
    rec.fails = 0
    await store.putRecord(commitment, rec)
    const path = tree(await store.commitments()).path(rec.index)
    return [200, { status: 'ok', secret: String(secret), ...path, roundId: String(config.round) }]
  }

  const g1 = (p) => BigInt(p[0]).toString(16).padStart(64, '0') + BigInt(p[1]).toString(16).padStart(64, '0')
  const g2 = (p) => [p[0][1], p[0][0], p[1][1], p[1][0]].map((v) => BigInt(v).toString(16).padStart(64, '0')).join('')

  async function claim({ via, proof, publicSignals, recipient }) {
    const signer = signers[via]
    if (!signer) return [400, { error: 'Unknown agency' }]
    if (!proof?.pi_a || !Array.isArray(publicSignals) || publicSignals.length !== 4) return [400, { error: 'Malformed claim' }]
    const [root, nullifier, roundId] = publicSignals
    try {
      const { hash } = await stellar.claim(signer, {
        roundId,
        root,
        nullifier,
        recipient,
        proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
      })
      dropRoundCache()
      await store.incr('paid')
      await log({ kind: 'paid', agency: via, detail: `Code ${short(nullifier)} paid`, hash })
      return [200, { status: 'paid', hash }]
    } catch (e) {
      if (e instanceof ContractError && e.name === 'AlreadyClaimed') {
        await store.incr('blocked.claim')
        await log({ kind: 'duplicate-claim', agency: via, detail: `Code ${short(nullifier)} already claimed this round` })
        return [200, { status: 'already' }]
      }
      if (e instanceof ContractError) {
        await log({ kind: 'rejected', agency: via, detail: `Claim rejected: ${e.name}` })
        return [200, { status: 'rejected', reason: e.name }]
      }
      throw e
    }
  }

  async function snapshot() {
    const [round, commitments, counters, feed] = await Promise.all([
      roundInfo(),
      store.commitments(),
      store.counters(),
      store.feed(),
    ])
    return [
      200,
      {
        registry: config.registry,
        token: config.token,
        asset: config.asset,
        round: config.round,
        agencies: Object.fromEntries(Object.entries(config.agencies).map(([k, a]) => [k, { name: a.name, address: a.address }])),
        enrolled: commitments.filter(Boolean).length,
        ...counters,
        roundAmount: round ? String(round.amount) : null,
        roundBalance: round ? String(round.balance) : null,
        feed,
      },
    ]
  }

  const API = {
    'POST /api/enrol': enrol,
    'POST /api/claim': claim,
    'POST /api/verify': verify,
    'POST /api/resend': resend,
    'GET /api/state': snapshot,
  }

  /** One entry point for both hosts. Returns [status, body]. */
  async function handle(method, path, body, ip) {
    const fn = API[`${method} ${path}`]
    if (!fn) return [404, { error: 'Not found' }]
    const max = LIMITS[path]
    if (max && (await store.hit(`${ip} ${path}`, WINDOW_MS)) > max) {
      return [429, { error: 'Too many attempts from this device. Try again in a few minutes.' }]
    }
    try {
      return await fn(body ?? {})
    } catch (e) {
      console.error(e)
      return [500, { error: 'Something went wrong on our side. Please try again.' }]
    }
  }

  return { handle, store, stellar }
}

/** One app per process: a Vercel instance reuses it across requests. */
let app
export const getApp = () => (app ??= createApp())

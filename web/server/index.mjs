import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { extname, join, normalize } from 'node:path'
import { Keypair } from '@stellar/stellar-sdk'
import { chain, secretOf, ContractError } from './chain.mjs'
import { tree, secretFor, commitmentOf } from './tree.mjs'
import { inviteEmail } from './invite-email.mjs'

/*
  Secrets come from web/.env (never committed) or the real environment.
  Parsed here rather than with a dependency: it is a handful of keys.
*/
try {
  for (const line of (await readFile(join(import.meta.dirname, '../.env'), 'utf8')).split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
} catch {}

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

/* Addresses on this reserved domain are never mailed; the code comes back in
   the response instead. Used only by server/smoke.mjs, and only when
   HAPAX_ALLOW_TEST_EMAIL=1: otherwise an agency could enrol someone with a
   test address and activate the account itself, defeating the code. */
const TEST_DOMAIN = process.env.HAPAX_ALLOW_TEST_EMAIL === '1' ? '@example.test' : null
const PUBLIC_URL = (process.env.HAPAX_PUBLIC_URL ?? 'http://localhost:8790').replace(/\/$/, '')
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The Hapax demo service.
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

const root = join(import.meta.dirname, '..')
const DIST = join(root, 'dist')
const DATA = join(import.meta.dirname, 'data')
const STATE = join(DATA, 'state.json')
const PORT = Number(process.env.PORT ?? 8790)

const config = JSON.parse(await readFile(join(import.meta.dirname, 'config.json'), 'utf8'))
const relayer = Keypair.fromSecret(secretOf(config.relayer))
config.readSource = relayer.publicKey()
const signers = Object.fromEntries(
  Object.entries(config.agencies).map(([k, a]) => [k, Keypair.fromSecret(secretOf(a.key))]),
)
const stellar = chain(config)

/* ------------------------------------------------------------------ state -- */

await mkdir(DATA, { recursive: true })
const state = await readFile(STATE, 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => ({
    registry: config.registry,
    pepper: BigInt(`0x${randomBytes(30).toString('hex')}`).toString(),
    commitments: [],
    byAgency: { a: 0, b: 0 },
    paid: 0,
    blocked: { enrol: 0, claim: 0 },
    feed: [],
  }))
if (state.registry !== config.registry) throw new Error('state.json belongs to another registry; move it aside')
const save = () => writeFile(STATE, JSON.stringify(state, null, 2))

const short = (s) => {
  const t = String(s)
  return `${t.slice(0, 6)}…${t.slice(-4)}`
}

const log = (entry) => {
  state.feed.unshift({ at: new Date().toISOString(), ...entry })
  state.feed.length = Math.min(state.feed.length, 60)
}

/* -------------------------------------------------------------------- api -- */

/* ------------------------------------------------------------ credentials -- */

/*
  How a person proves it is them, following the Stellar Disbursement
  Platform's own model: the agency registers what it already holds on record
  (an ID number and a date of birth), and on first visit the person proves
  both and sets a PIN of their own. Every later claim is ID number + PIN.

  Nothing here is stored in the clear. Records are keyed by the on-chain
  commitment, the date of birth and PIN are scrypt hashes with a per-record
  salt, and five wrong attempts lock the record for fifteen minutes. The ID
  number itself is never stored at all.
*/
const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000
state.records ??= {}

const hashOf = (value, salt) => scryptSync(String(value), salt, 32).toString('hex')
const sameHash = (a, b) => a && b && a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
const validId = (v) => /^\d{6,16}$/.test(String(v ?? ''))
const validDob = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(v))
const validPin = (v) => /^\d{4,6}$/.test(String(v ?? ''))
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '')) && String(v).length <= 254
const maskEmail = (e) => e.replace(/^(.)[^@]*(@.).*(\.[^.]+)$/, '$1•••$2•••$3')

async function enrol({ agency, idNumber, dob, email }) {
  const signer = signers[agency]
  if (!signer) return [400, { error: 'Unknown agency' }]
  if (!validId(idNumber)) return [400, { error: 'Enter an ID number of 6 to 16 digits.' }]
  if (!validDob(dob)) return [400, { error: 'Enter the date of birth.' }]
  if (!validEmail(email)) return [400, { error: 'Enter an email address for the invite.' }]
  const secret = secretFor(idNumber, state.pepper)
  const commitment = commitmentOf(secret).toString()
  try {
    const { hash, value: index } = await stellar.enrol(signer, commitment)
    state.commitments[index] = commitment
    state.byAgency[agency] += 1
    const salt = randomBytes(16).toString('hex')
    /*
      The invite: a six-digit activation code, sent once. Only its hash is
      kept, with an expiry. The email address is used to send and then
      dropped; it is never stored.
    */
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const expiresAt = Date.now() + CODE_TTL_MS
    state.records[commitment] = { index, salt, dob: hashOf(dob, salt), code: hashOf(code, salt), codeExpires: expiresAt, pin: null, fails: 0, lockedUntil: 0 }
    const testOnly = TEST_DOMAIN !== null && String(email).toLowerCase().endsWith(TEST_DOMAIN)
    let emailed = false
    if (!testOnly) {
      const round = await stellar.round(config.round).catch(() => null)
      const amount = round ? `${Number(round.amount) / 1e7} ${config.asset.code}` : config.asset.code
      const message = inviteEmail({ agencyName: config.agencies[agency].name, code, expiresAt, amount, claimUrl: `${PUBLIC_URL}/claim` })
      emailed = await sendMail({ to: email, ...message }).catch((e) => {
        console.error(`[hapax] ${e.message}`)
        return false
      })
    }
    // Drift check off the critical path: logged, never blocks the response.
    stellar
      .root()
      .then((onChain) => {
        const mirrored = String(tree(state.commitments).root)
        if (String(onChain) !== mirrored) console.error(`ROOT DRIFT after enrol ${index}: chain ${onChain} mirror ${mirrored}`)
      })
      .catch(() => {})
    log({ kind: 'enrolled', agency, detail: `Person #${index + 1} added to the shared list`, hash })
    await save()
    return [200, { status: 'enrolled', index, hash, emailed, sentTo: maskEmail(String(email)), ...(testOnly ? { testCode: code } : {}) }]
  } catch (e) {
    if (e instanceof ContractError && e.name === 'AlreadyEnrolled') {
      state.blocked.enrol += 1
      log({ kind: 'duplicate-enrol', agency, detail: 'Already enrolled by an agency. No details shared.' })
      await save()
      return [200, { status: 'already' }]
    }
    throw e
  }
}

/**
 * Verifies a person and hands their phone what it needs to prove: the secret
 * and the Merkle path. Two modes:
 *   - activate: ID number + date of birth + a new PIN (first visit only)
 *   - sign in:  ID number + PIN
 * Every failure looks the same from outside ("those details don't match"),
 * so the endpoint cannot be used to learn whether an ID number is enrolled.
 */
async function verify({ idNumber, dob, pin, newPin, code }) {
  const NOPE = [200, { status: 'no-match' }]
  if (!validId(idNumber)) return [400, { error: 'Enter your ID number.' }]
  const secret = secretFor(idNumber, state.pepper)
  const commitment = commitmentOf(secret).toString()
  const rec = state.records[commitment]
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
    await save()
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
  await save()
  return [200, { status: 'ok', secret: String(secret), ...tree(state.commitments).path(rec.index), roundId: String(config.round) }]
}

const g1 = (p) => BigInt(p[0]).toString(16).padStart(64, '0') + BigInt(p[1]).toString(16).padStart(64, '0')
const g2 = (p) =>
  [p[0][1], p[0][0], p[1][1], p[1][0]].map((v) => BigInt(v).toString(16).padStart(64, '0')).join('')

async function claim({ via, proof, publicSignals, recipient }) {
  const signer = signers[via]
  if (!signer) return [400, { error: 'Unknown agency' }]
  const [root, nullifier, roundId] = publicSignals
  try {
    const { hash } = await stellar.claim(signer, {
      roundId,
      root,
      nullifier,
      recipient,
      proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
    })
    state.paid += 1
    log({ kind: 'paid', agency: via, detail: `Code ${short(nullifier)} paid`, hash })
    await save()
    return [200, { status: 'paid', hash }]
  } catch (e) {
    if (e instanceof ContractError && e.name === 'AlreadyClaimed') {
      state.blocked.claim += 1
      log({ kind: 'duplicate-claim', agency: via, detail: `Code ${short(nullifier)} already claimed this round` })
      await save()
      return [200, { status: 'already' }]
    }
    if (e instanceof ContractError) {
      log({ kind: 'rejected', agency: via, detail: `Claim rejected: ${e.name}` })
      await save()
      return [200, { status: 'rejected', reason: e.name }]
    }
    throw e
  }
}

async function snapshot() {
  const round = await stellar.round(config.round).catch(() => null)
  return {
    registry: config.registry,
    token: config.token,
    asset: config.asset,
    round: config.round,
    agencies: Object.fromEntries(Object.entries(config.agencies).map(([k, a]) => [k, { name: a.name, address: a.address }])),
    enrolled: state.commitments.length,
    byAgency: state.byAgency,
    paid: state.paid,
    blocked: state.blocked,
    roundAmount: round ? String(round.amount) : null,
    roundBalance: round ? String(round.balance) : null,
    feed: state.feed,
  }
}

const API = {
  'POST /api/enrol': enrol,
  'POST /api/claim': claim,
  'POST /api/verify': verify,
  'GET /api/state': async () => [200, await snapshot()],
}

/* ----------------------------------------------------------------- server -- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.zkey': 'application/octet-stream',
  '.json': 'application/json',
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const handler = API[`${req.method} ${url.pathname}`]
  try {
    if (handler) {
      let body = {}
      if (req.method === 'POST') {
        let raw = ''
        for await (const c of req) raw += c
        body = raw ? JSON.parse(raw) : {}
      }
      const [code, out] = await handler(body, url.searchParams)
      return send(res, code, out)
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    if (p === '' ) p = 'index.html'
    if (!extname(p)) p += '.html'
    const file = join(DIST, p)
    if (!file.startsWith(DIST)) return send(res, 403, 'no', 'text/plain')
    await stat(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain')
    console.error(e)
    send(res, 500, { error: e.message })
  }
}).listen(PORT, () => console.log(`hapax on http://localhost:${PORT}  registry ${config.registry}`))

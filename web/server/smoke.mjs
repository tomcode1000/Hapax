// End-to-end check of the running service, doing what the phone does:
// enrol (ID + date of birth) at A -> duplicate at B -> wrong DOB refused ->
// activate with a PIN -> wrong PIN refused -> sign in -> own wallet ->
// prove -> claim via B -> claim again via A (blocked).
// Usage: node server/smoke.mjs [baseUrl]
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { poseidon2 } from 'poseidon-lite'
import * as snarkjs from 'snarkjs'
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'

const BASE = process.argv[2] ?? 'http://localhost:8790'
const dist = join(import.meta.dirname, '../dist/zk')
const api = async (path, body) => {
  const r = await fetch(BASE + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${j.error}`)
  return j
}
const field = (s) => {
  const h = createHash('sha256').update(s, 'ascii').digest()
  h[0] = 0
  return BigInt(`0x${h.toString('hex')}`).toString()
}
const check = (label, got, want) => {
  const ok = got === want
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${got}`)
  if (!ok) process.exitCode = 1
}

// The recipient's own wallet, made here the way the browser makes it.
async function ownWallet(asset) {
  const kp = Keypair.random()
  await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`)
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
  const acct = await horizon.loadAccount(kp.publicKey())
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }))
    .setTimeout(120)
    .build()
  tx.sign(kp)
  await horizon.submitTransaction(tx)
  return kp.publicKey()
}

const id = String(10000000 + Math.floor(Math.random() * 89999999))
const dob = '1994-03-17'
const pin = '482913'
const email = 'smoke@example.test' // reserved domain: never mailed, code returned

const enrolled = await api('/api/enrol', { agency: 'a', idNumber: id, dob, email })
check('enrol at A', enrolled.status, 'enrolled')
const firstCode = enrolled.testCode
check('same person at B', (await api('/api/enrol', { agency: 'b', idNumber: id, dob, email })).status, 'already')
check('resend with wrong DOB', (await api('/api/resend', { agency: 'b', idNumber: id, dob: '1990-01-01', email })).status, 'no-match')
const resent = await api('/api/resend', { agency: 'b', idNumber: id, dob, email })
check('resend the invite', resent.status, 'sent')
const code = resent.testCode
if (firstCode !== code) check('old code stops working', (await api('/api/verify', { idNumber: id, dob, code: firstCode, newPin: pin })).status, 'no-match')
check('sign in before PIN is set', (await api('/api/verify', { idNumber: id, pin })).status, 'no-match')
check('activate with wrong DOB', (await api('/api/verify', { idNumber: id, dob: '1990-01-01', code, newPin: pin })).status, 'no-match')
check('activate without the emailed code', (await api('/api/verify', { idNumber: id, dob, newPin: pin })).status, 'no-match')
check('activate with a wrong code', (await api('/api/verify', { idNumber: id, dob, code: code === '000000' ? '111111' : '000000', newPin: pin })).status, 'no-match')
check('activate with DOB + code', (await api('/api/verify', { idNumber: id, dob, code, newPin: pin })).status, 'ok')
check('activate again after PIN is set', (await api('/api/verify', { idNumber: id, dob, code, newPin: '111111' })).status, 'already-active')
check('wrong PIN', (await api('/api/verify', { idNumber: id, pin: '000000' })).status, 'no-match')
check('unknown ID', (await api('/api/verify', { idNumber: '99999999', pin })).status, 'no-match')
const v = await api('/api/verify', { idNumber: id, pin })
check('right PIN', v.status, 'ok')

check('resend after activation', (await api('/api/resend', { agency: 'a', idNumber: id, dob, email })).status, 'already-active')

const { asset } = await api('/api/state')
const proveFor = (address) =>
  snarkjs.groth16.fullProve(
    {
      root: v.root,
      nullifier: poseidon2([BigInt(v.secret), BigInt(v.roundId)]).toString(),
      roundId: v.roundId,
      recipient: field(address),
      secret: v.secret,
      pathElements: v.pathElements,
      pathIndices: v.pathIndices,
    },
    join(dist, 'hapax_claim.wasm'),
    join(dist, 'hapax_claim.zkey'),
  )

// A funded wallet with no AID trustline: refused cleanly, nothing consumed.
const bare = Keypair.random().publicKey()
await fetch(`https://friendbot.stellar.org/?addr=${bare}`)
const bareProof = await proveFor(bare)
const bareClaim = await api('/api/claim', { via: 'a', recipient: bare, ...bareProof })
check('claim to a wallet with no AID trustline', `${bareClaim.status}:${bareClaim.reason}`, 'rejected:NoTrustline')

const recipient = await ownWallet(asset)
console.log('      own wallet', recipient)
console.time('      prove')
const { proof, publicSignals } = await proveFor(recipient)
console.timeEnd('      prove')
check('claim via B', (await api('/api/claim', { via: 'b', recipient, proof, publicSignals })).status, 'paid')
check('claim again via A', (await api('/api/claim', { via: 'a', recipient, proof, publicSignals })).status, 'already')

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const bal = (await horizon.loadAccount(recipient)).balances.find((b) => b.asset_code === asset.code)
check('AID in the recipient’s own wallet', bal?.balance, '50.0000000')
process.exit()

import { execFileSync } from 'node:child_process'
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'

/**
 * Everything that talks to Stellar.
 *
 * Testnet only. The agency and relayer keys are the stellar-cli identities
 * created by scripts/testnet_demo.sh, read from the CLI at start-up, so no
 * secret is ever written into this repository. In a real deployment each
 * agency signs from its own wallet and this file would hold no keys at all.
 */

const STELLAR = process.env.STELLAR_CLI ?? 'stellar'

export const secretOf = (alias) =>
  execFileSync(STELLAR, ['keys', 'show', alias], { encoding: 'utf8' }).trim()

/** The contract's error enum, in the words a dashboard shows. */
export const CONTRACT_ERRORS = {
  1: 'AlreadyInitialized',
  2: 'NotAgency',
  3: 'AlreadyEnrolled',
  4: 'TreeFull',
  5: 'RoundExists',
  6: 'NoSuchRound',
  7: 'UnknownRoot',
  8: 'AlreadyClaimed',
  9: 'InvalidProof',
  10: 'RoundUnderfunded',
  /* Raised by the token contract, not the registry: the payout address has
     no trustline for the aid token, so it cannot receive it yet. */
  13: 'NoTrustline',
}

export class ContractError extends Error {
  constructor(code) {
    super(CONTRACT_ERRORS[code] ?? `Contract error #${code}`)
    this.code = code
    this.name = CONTRACT_ERRORS[code] ?? 'ContractError'
  }
}

const contractErrorIn = (text) => {
  const m = /Error\(Contract, #(\d+)\)/.exec(String(text))
  return m ? new ContractError(Number(m[1])) : null
}

export function chain(config) {
  const server = new rpc.Server(config.rpc)
  const passphrase = config.network
  const registry = new Contract(config.registry)

  /*
    One queue per signing key. Two transactions from the same account built at
    the same time share a sequence number and the second is rejected, which in
    a live demo looks exactly like the product failing.
  */
  const queues = new Map()
  const serial = (key, job) => {
    const prev = queues.get(key) ?? Promise.resolve()
    const next = prev.catch(() => {}).then(job)
    queues.set(key, next)
    return next
  }

  async function submit(kp, op) {
    const account = await server.getAccount(kp.publicKey())
    let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(op)
      .setTimeout(60)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) throw contractErrorIn(sim.error) ?? new Error(sim.error)
    tx = rpc.assembleTransaction(tx, sim).build()
    tx.sign(kp)
    const sent = await server.sendTransaction(tx)
    if (sent.status === 'ERROR') throw new Error(`send failed: ${sent.errorResult?.result().switch().name ?? 'unknown'}`)
    for (let i = 0; i < 30; i++) {
      const got = await server.getTransaction(sent.hash)
      if (got.status === 'SUCCESS') {
        return { hash: sent.hash, value: got.returnValue ? scValToNative(got.returnValue) : null }
      }
      if (got.status === 'FAILED') throw new Error(`transaction failed: ${sent.hash}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error(`timed out waiting for ${sent.hash}`)
  }

  const call = (kp, method, ...args) => serial(kp.publicKey(), () => submit(kp, registry.call(method, ...args)))

  async function read(method, ...args) {
    const source = config.readSource
    const account = await server.getAccount(source)
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(registry.call(method, ...args))
      .setTimeout(60)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) throw contractErrorIn(sim.error) ?? new Error(sim.error)
    return scValToNative(sim.result.retval)
  }

  const u256 = (v) => nativeToScVal(BigInt(v), { type: 'u256' })
  const u64 = (v) => nativeToScVal(BigInt(v), { type: 'u64' })
  const addr = (s) => new Address(s).toScVal()
  const bytes = (hex) => xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'))
  const proofVal = (p) =>
    xdr.ScVal.scvMap(
      ['a', 'b', 'c'].map((k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: bytes(p[k]) })),
    )

  return {
    enrol: (agencyKp, commitment) => call(agencyKp, 'enrol', addr(agencyKp.publicKey()), u256(commitment)),
    claim: (relayerKp, { roundId, root, nullifier, recipient, proof }) =>
      call(relayerKp, 'claim', u64(roundId), u256(root), u256(nullifier), addr(recipient), proofVal(proof)),
    root: () => read('root'),
    size: () => read('size'),
    round: (id) => read('round', u64(id)),
    isClaimed: (id, nullifier) => read('is_claimed', u64(id), u256(nullifier)),

  }
}

/*
  The recipient's own wallet. Bundled to assets/wallet.js as HapaxWallet and
  loaded only on the claim page.

  Hapax never holds a recipient's keys. A person either connects the wallet
  they already have (Freighter), pastes an address, or makes a test wallet
  whose key is generated in their own browser and shown only to them. In
  every case the one thing the aid token needs, a trustline, is added by the
  wallet's owner, signing for themselves.
*/
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk'
import * as freighter from '@stellar/freighter-api'

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org')
const PASSPHRASE = Networks.TESTNET

/** true / false for a funded account; null when the account does not exist. */
export async function hasTrustline(address, asset) {
  try {
    const acct = await horizon.loadAccount(address)
    return acct.balances.some((b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer)
  } catch (e) {
    if (e?.response?.status === 404) return null
    throw e
  }
}

async function addTrustline(address, asset, sign) {
  const acct = await horizon.loadAccount(address)
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }))
    .setTimeout(180)
    .build()
  const signed = await sign(tx.toXDR())
  await horizon.submitTransaction(TransactionBuilder.fromXDR(signed, PASSPHRASE))
}

export async function createTestWallet(asset) {
  const kp = Keypair.random()
  const res = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`)
  if (!res.ok) throw new Error('Testnet funding (Friendbot) failed. Try again in a moment.')
  await addTrustline(kp.publicKey(), asset, async (xdr) => {
    const tx = TransactionBuilder.fromXDR(xdr, PASSPHRASE)
    tx.sign(kp)
    return tx.toXDR()
  })
  return { address: kp.publicKey(), secret: kp.secret() }
}

const fail = (r) => {
  if (r && r.error) throw new Error(r.error.message || String(r.error))
  return r
}

export async function connectFreighter(asset) {
  const connected = await freighter.isConnected()
  if (!connected?.isConnected) throw new Error('Freighter is not installed in this browser. Install it, or use a test wallet.')
  const { address } = fail(await freighter.requestAccess())
  const net = fail(await freighter.getNetwork())
  if (net.network !== 'TESTNET') throw new Error('Switch Freighter to Testnet, then try again.')
  const has = await hasTrustline(address, asset)
  if (has === null) throw new Error('This Freighter account is not funded on testnet yet. Fund it with Friendbot first.')
  if (!has) {
    await addTrustline(address, asset, async (xdr) => {
      const r = fail(await freighter.signTransaction(xdr, { networkPassphrase: PASSPHRASE, address }))
      return r.signedTxXdr
    })
  }
  return { address }
}

/** Checks a pasted address can receive the token; never signs anything. */
export async function checkAddress(address, asset) {
  if (!StrKey.isValidEd25519PublicKey(address)) throw new Error('That is not a Stellar address. It starts with G and is 56 characters.')
  const has = await hasTrustline(address, asset)
  if (has === null) throw new Error('That account does not exist on testnet yet.')
  if (!has) throw new Error(`That wallet cannot hold ${asset.code} yet. Add a trustline for ${asset.code} in the wallet first, or connect Freighter and Hapax will ask it to.`)
  return { address }
}

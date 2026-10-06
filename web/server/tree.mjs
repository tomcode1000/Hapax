import { createHash } from 'node:crypto'
import { poseidon1, poseidon2 } from 'poseidon-lite'

/**
 * The enrolment tree, mirrored off-chain.
 *
 * Must hash exactly as circuits/merkle_tree.circom and the registry contract
 * do: leaf = Poseidon(1, commitment), node = Poseidon(left, right), empty
 * slots from the zero ladder. The contract's root after every enrolment is
 * compared with this one, so a drift shows up immediately rather than as a
 * mysterious InvalidProof on stage.
 */

export const LEVELS = 18
const LEAF_DOMAIN = 1n

const ZEROS = (() => {
  const z = [poseidon2([LEAF_DOMAIN, 0n])]
  for (let i = 0; i < LEVELS; i++) z.push(poseidon2([z[i], z[i]]))
  return z
})()

export const secretFor = (idNumber, pepper) => poseidon2([BigInt(idNumber), BigInt(pepper)])
export const commitmentOf = (secret) => poseidon1([BigInt(secret)])

/** sha256(strkey) with the first byte zeroed; matches the contract. */
export const recipientField = (strkey) => {
  const h = createHash('sha256').update(strkey, 'ascii').digest()
  h[0] = 0
  return BigInt(`0x${h.toString('hex')}`)
}

export function tree(commitments) {
  const layers = [commitments.map((c) => poseidon2([LEAF_DOMAIN, BigInt(c)]))]
  for (let i = 0; i < LEVELS; i++) {
    const below = layers[i]
    const above = []
    for (let j = 0; j < Math.max(1, Math.ceil(below.length / 2)); j++) {
      above.push(poseidon2([below[2 * j] ?? ZEROS[i], below[2 * j + 1] ?? ZEROS[i]]))
    }
    layers.push(above)
  }
  const root = commitments.length ? layers[LEVELS][0] : ZEROS[LEVELS]
  const path = (index) => {
    const pathElements = []
    const pathIndices = []
    let idx = index
    for (let i = 0; i < LEVELS; i++) {
      pathElements.push(String(layers[i][idx ^ 1] ?? ZEROS[i]))
      pathIndices.push(String(idx & 1))
      idx >>= 1
    }
    return { root: String(root), pathElements, pathIndices }
  }
  return { root, path }
}

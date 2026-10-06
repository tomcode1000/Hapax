// Shared Hapax field helpers. The contract must reproduce recipientField and
// the tree hashing exactly; keep the two in lockstep.
const crypto = require('crypto');
const circomlibjs = require('circomlibjs');

const LEVELS = 18;
const LEAF_DOMAIN = 1n;

// sha256(strkey ASCII) with the first byte zeroed -> 248-bit value, always
// below the BN254 scalar field modulus.
function recipientField(strkey) {
  const h = crypto.createHash('sha256').update(strkey, 'ascii').digest();
  h[0] = 0;
  return BigInt('0x' + h.toString('hex'));
}

async function hasher() {
  const poseidon = await circomlibjs.buildPoseidon();
  return (xs) => poseidon.F.toObject(poseidon(xs));
}

// Incremental tree matching ZK-VOTE's membership-tree: leaves are
// Poseidon(LEAF_DOMAIN, commitment), empty slots use the zero ladder.
function buildTree(H, commitments) {
  const zeros = [H([LEAF_DOMAIN, 0n])];
  for (let i = 0; i < LEVELS; i++) zeros.push(H([zeros[i], zeros[i]]));
  let level = commitments.map((c) => H([LEAF_DOMAIN, c]));
  const layers = [level];
  for (let i = 0; i < LEVELS; i++) {
    const next = [];
    for (let j = 0; j < Math.max(1, Math.ceil(level.length / 2)); j++) {
      next.push(H([level[2 * j] ?? zeros[i], level[2 * j + 1] ?? zeros[i]]));
    }
    layers.push(next);
    level = next;
  }
  const root = layers[LEVELS][0];
  const pathFor = (index) => {
    const pathElements = [], pathIndices = [];
    let idx = index;
    for (let i = 0; i < LEVELS; i++) {
      const sib = idx ^ 1;
      pathElements.push((layers[i][sib] ?? zeros[i]).toString());
      pathIndices.push(String(idx & 1));
      idx >>= 1;
    }
    return { pathElements, pathIndices };
  };
  return { root, pathFor };
}

module.exports = { LEVELS, LEAF_DOMAIN, recipientField, hasher, buildTree };

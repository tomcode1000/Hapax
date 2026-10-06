pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "merkle_tree.circom";

// Hapax claim: one claim per person per aid round, across every agency.
// Adapted from ZK-VOTE's claim.circom (MIT).
//
// Proves, without revealing who the claimant is:
//   1. commitment = Poseidon(secret) is a leaf of the shared enrolment tree
//      (the tree domain-tags leaves, see merkle_tree.circom)
//   2. nullifier = Poseidon(secret, roundId), so the same person always
//      produces the same nullifier in a round, whichever agency they claim at
//   3. the proof is bound to `recipient`, so a copied proof cannot redirect
//      the payment to another address
//
// secret = Poseidon(id_number, pepper) is computed at enrolment, outside the
// circuit (see BRIEF.txt 3.1).
//
// Public signals, in order: [root, nullifier, roundId, recipient]
template HapaxClaim(levels) {
    signal input root;
    signal input nullifier;
    signal input roundId;
    signal input recipient;     // field-encoded Stellar address (sha256, top 248 bits)

    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component commitmentHasher = Poseidon(1);
    commitmentHasher.inputs[0] <== secret;

    component merkleProof = MerkleTreeInclusionProof(levels);
    merkleProof.leaf <== commitmentHasher.out;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }
    root === merkleProof.root;

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== roundId;
    nullifier === nullifierHasher.out;

    // Groth16 already binds every public input; this quadratic constraint
    // keeps `recipient` from being optimised away by the compiler.
    signal recipientSquared;
    recipientSquared <== recipient * recipient;
}

component main {public [root, nullifier, roundId, recipient]} = HapaxClaim(18);

#!/usr/bin/env bash
# End-to-end Hapax run on Stellar testnet:
#   demo token -> accounts -> deploy -> init -> agencies -> enrol x3 ->
#   duplicate enrol (must fail) -> round + fund -> proof -> claim ->
#   double claim (must fail).
# Writes deployed IDs to scripts/testnet.env.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$HOME/bin:/c/Program Files (x86)/Stellar CLI:$PATH"
NET="--network testnet"
key() { stellar keys address "$1" 2>/dev/null || { stellar keys generate "$1" $NET --fund >/dev/null 2>&1; stellar keys address "$1"; }; }

ADMIN=$(key hapax-dev)          # admin + token issuer
AGENCY_A=$(key hapax-agency-a)
AGENCY_B=$(key hapax-agency-b)
RECIPIENT=$(key hapax-recipient)
echo "admin $ADMIN | recipient $RECIPIENT"

ASSET="AID:$ADMIN"
TOKEN=$(stellar contract asset deploy --asset "$ASSET" --source hapax-dev $NET 2>/dev/null || stellar contract id asset --asset "$ASSET" $NET)
echo "token $TOKEN"
stellar tx new change-trust --source hapax-recipient --line "$ASSET" $NET >/dev/null 2>&1 || true

WASM=contracts/target/wasm32v1-none/release/hapax_registry.wasm
REG=$(stellar contract deploy --wasm "$WASM" --source hapax-dev $NET 2>/dev/null | tail -1)
echo "registry $REG"
inv() { for t in 1 2 3; do stellar contract invoke --id "$REG" $NET --send=yes "$@" && return 0; echo "retry $t" >&2; sleep 3; done; return 1; }

# Proof bound to the real recipient G-address.
( cd circuits && node make_input.js "$RECIPIENT" >/dev/null \
  && node build/hapax_claim_js/generate_witness.js build/hapax_claim_js/hapax_claim.wasm build/input.json build/witness.wtns \
  && snarkjs groth16 prove build/hapax_claim.zkey build/witness.wtns build/proof.json build/public.json \
  && node cli_args.js >/dev/null )
C=circuits/build/cli

inv --source hapax-dev -- init --admin "$ADMIN" --vk-file-path $C/vk.json >/dev/null
inv --source hapax-dev -- add_agency --agency "$AGENCY_A" >/dev/null
inv --source hapax-dev -- add_agency --agency "$AGENCY_B" >/dev/null
echo "enrol: $(inv --source hapax-agency-a -- enrol --agency "$AGENCY_A" --commitment "$(cat $C/commitment0.txt)" 2>/dev/null | tail -1)"
echo "enrol: $(inv --source hapax-agency-b -- enrol --agency "$AGENCY_B" --commitment "$(cat $C/commitment1.txt)" 2>/dev/null | tail -1)"
echo "enrol: $(inv --source hapax-agency-a -- enrol --agency "$AGENCY_A" --commitment "$(cat $C/commitment2.txt)" 2>/dev/null | tail -1)"
echo "duplicate enrol by agency B (expect AlreadyEnrolled #3):"
stellar contract invoke --id "$REG" $NET --source hapax-agency-b -- enrol --agency "$AGENCY_B" --commitment "$(cat $C/commitment1.txt)" 2>&1 | grep -oE "Error\(Contract, #[0-9]+\)" | head -1 || true
echo "root on-chain $(stellar contract invoke --id "$REG" $NET --source hapax-dev -- root 2>/dev/null | tail -1)"
echo "root in proof $(cat $C/root.txt)"

inv --source hapax-dev -- create_round --round_id 1 --token "$TOKEN" --amount 500000000 >/dev/null
inv --source hapax-dev -- fund --from "$ADMIN" --round_id 1 --amount 5000000000 >/dev/null

echo "CLAIM:"
inv --source hapax-agency-b -- claim --round_id 1 --root "$(cat $C/root.txt)" --nullifier "$(cat $C/nullifier.txt)" \
  --recipient "$RECIPIENT" --proof-file-path $C/proof.json 2>&1 | grep -E "stellar.expert|Error" | head -2
echo "recipient balance: $(stellar contract invoke --id "$TOKEN" $NET --source hapax-dev -- balance --id "$RECIPIENT" 2>/dev/null | tail -1)"
echo "DOUBLE CLAIM via agency A (expect AlreadyClaimed #8):"
stellar contract invoke --id "$REG" $NET --source hapax-agency-a -- claim --round_id 1 --root "$(cat $C/root.txt)" \
  --nullifier "$(cat $C/nullifier.txt)" --recipient "$RECIPIENT" --proof-file-path $C/proof.json 2>&1 | grep -oE "Error\(Contract, #[0-9]+\)" | head -1 || true

printf "REGISTRY=%s\nTOKEN=%s\nASSET=%s\nRECIPIENT=%s\nAGENCY_A=%s\nAGENCY_B=%s\n" "$REG" "$TOKEN" "$ASSET" "$RECIPIENT" "$AGENCY_A" "$AGENCY_B" > scripts/testnet.env
echo "saved scripts/testnet.env"

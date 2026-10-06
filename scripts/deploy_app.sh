#!/usr/bin/env bash
# Deploys a fresh registry for the web app: empty tree, two agencies, round 1
# (50 AID per claim) funded with 5,000 AID. Writes web/server/config.json.
# Reuses the AID token and keys created by testnet_demo.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$HOME/bin:/c/Program Files (x86)/Stellar CLI:$PATH"
NET="--network testnet"
ADMIN=$(stellar keys address hapax-dev)
AGENCY_A=$(stellar keys address hapax-agency-a)
AGENCY_B=$(stellar keys address hapax-agency-b)
ASSET="AID:$ADMIN"
TOKEN=$(stellar contract id asset --asset "$ASSET" $NET)

inv() { for t in 1 2 3; do stellar contract invoke --id "$REG" $NET --send=yes "$@" >/dev/null 2>&1 && return 0; echo "retry $t" >&2; sleep 3; done; return 1; }

REG=$(stellar contract deploy --wasm contracts/target/wasm32v1-none/release/hapax_registry.wasm --source hapax-dev $NET 2>/dev/null | tail -1)
echo "registry $REG"
( cd circuits && node cli_args.js >/dev/null )
inv --source hapax-dev -- init --admin "$ADMIN" --vk-file-path circuits/build/cli/vk.json
inv --source hapax-dev -- add_agency --agency "$AGENCY_A"
inv --source hapax-dev -- add_agency --agency "$AGENCY_B"
inv --source hapax-dev -- create_round --round_id 1 --token "$TOKEN" --amount 500000000
inv --source hapax-dev -- fund --from "$ADMIN" --round_id 1 --amount 50000000000

cat > web/server/config.json <<EOF
{
  "rpc": "https://soroban-testnet.stellar.org",
  "network": "Test SDF Network ; September 2015",
  "registry": "$REG",
  "token": "$TOKEN",
  "asset": { "code": "AID", "issuer": "$ADMIN" },
  "round": 1,
  "agencies": {
    "a": { "name": "Agency A", "key": "hapax-agency-a", "address": "$AGENCY_A" },
    "b": { "name": "Agency B", "key": "hapax-agency-b", "address": "$AGENCY_B" }
  },
  "relayer": "hapax-dev"
}
EOF
echo "wrote web/server/config.json"

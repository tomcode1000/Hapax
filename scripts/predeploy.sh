#!/usr/bin/env bash
# Copies the circuit files into web/zk-build so a Vercel CLI deploy (which
# uploads only web/) can build. web/zk-build is git-ignored.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p web/zk-build/hapax_claim_js
cp circuits/build/hapax_claim.zkey web/zk-build/
cp circuits/build/hapax_claim_js/hapax_claim.wasm web/zk-build/hapax_claim_js/
echo "zk files staged in web/zk-build"

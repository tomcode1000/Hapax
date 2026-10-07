# Hapax

**Pay people once. Never learn who.**

Aid agencies pay the same people from separate lists they cannot safely share, so one person can be paid twice while someone else gets nothing. Hapax gives agencies one shared registry on Stellar that answers a single question, *"already claimed this round?"*, using zero-knowledge proofs. No agency learns a name, an ID number, or who was paid.

Built for **Find Your Way** (Stellar). Running on **Stellar testnet**.

**Live:** https://hapax-ebon.vercel.app · [Agency console](https://hapax-ebon.vercel.app/agency?a=a) · [Claim page](https://hapax-ebon.vercel.app/claim)

---

## How it works

1. **Enrol.** An agency enters the ID number and date of birth it already holds, plus an email for the invite. Only a Poseidon commitment joins the shared on-chain list. If any agency has already enrolled that person, the registry answers "already enrolled" and nothing else.
2. **Activate.** The person gets an email with a one-time code. On first visit they prove ID + date of birth + code, then choose their own PIN. Every later claim is ID + PIN. (The same verification pattern the Stellar Disbursement Platform uses.)
3. **Prove.** On their own phone, the browser makes a Groth16 proof: *"I am on the list, and this is my one-time code (nullifier) for this round."* About 1.5–2 s.
4. **Pay once.** A Soroban contract verifies the proof on-chain, pays the round amount to the person's **own wallet**, and rejects the same nullifier at every other agency.

```
 Agency A ─┐                         ┌─ Soroban registry ──────────────┐
           ├── commitment ──────────▶│ Poseidon Merkle tree (depth 18) │
 Agency B ─┘                         │ Groth16 verify (BN254)          │
                                     │ nullifier set per round         │
 Phone: ID + PIN ─▶ proof ──────────▶│ pay round amount, once          │──▶ recipient's own wallet
                                     └─────────────────────────────────┘
```

## What each party can see

| | Agency | Public ledger | Hapax enrolment service |
|---|---|---|---|
| Whether a person is already enrolled | yes / no only | – | yes |
| Whether a nullifier has claimed this round | yes | yes | yes |
| Name, ID number | never | never | ID is never stored |
| Which person a payment went to | never | never | – |

## Tech

| Layer | What |
|---|---|
| Payment rail | Stellar testnet, a Stellar Asset Contract token (`AID`) |
| Registry | Soroban contract in Rust ([`contracts/registry`](contracts/registry/src/lib.rs)) |
| Proof verification | Groth16 over BN254 with Protocol 25 host functions ([`contracts/groth16`](contracts/groth16)) |
| Hashing | Poseidon, via Stellar's [`rs-soroban-poseidon`](https://github.com/stellar/rs-soroban-poseidon) on-chain and `poseidon-lite` in the browser |
| Circuit | Circom ([`circuits/hapax_claim.circom`](circuits/hapax_claim.circom)), 10,832 wires |
| Proving | snarkjs in a Web Worker, on the recipient's device |
| App | Static pages + a small Node service ([`web/`](web)) |
| Email | Brevo transactional API |

Measured on this build: `enrol` uses about 28M and `claim` about 34M CPU instructions of Soroban's 100M per-transaction limit.

## Deployed (testnet)

| | Address |
|---|---|
| Registry | `CBTXHQLCYAXU5KBZ7R77UJMRJDOO6RXARDYCORRFWAD5WOFHEGSALHGQ` |
| AID token (SAC) | `CCCPKMHU657KNGMBJGMRZA2XGS5X6TBPVT6JEVROXYTVHGISMPLDC7DI` |

## Run it locally

Prerequisites: Node 22, Rust 1.91+ with `wasm32v1-none`, the Stellar CLI, circom 2 and snarkjs (only to rebuild the circuit).

```bash
# 1. Contract tests (real Groth16 verification inside the tests)
cd contracts && cargo test -p hapax-registry

# 2. The app
cd ../web
npm install
cp .env.example .env          # add your Brevo key and sender
npm run dev                   # http://localhost:8790
```

Deploying to Vercel: from `web/`, run `bash ../scripts/predeploy.sh`, `vercel link`, `node ../scripts/vercel-env.mjs https://your-app.vercel.app` (sets the secrets as encrypted environment variables, printing none of them), then `vercel deploy --prod`. State lives in Upstash Redis on Vercel and in `web/server/data` locally.

`web/server/config.json` points at the deployed testnet registry. To deploy your own: `bash scripts/testnet_demo.sh` (creates the testnet identities, token and a full demo run), then `bash scripts/deploy_app.sh`.

Building the registry wasm (MinGW hosts cannot link a host `cdylib`, so the crate type is set on the command line):

```bash
cargo rustc -p hapax-registry --target wasm32v1-none --release --crate-type cdylib
```

End-to-end check against a running service (needs `HAPAX_ALLOW_TEST_EMAIL=1` in `web/.env`):

```bash
cd web && node server/smoke.mjs
```

## Trust assumptions and limits (stated plainly)

- **Testnet only.** `AID` is a demo token. A real programme would use USDC; the contract takes any token per round.
- **The enrolment service is trusted.** It holds the *pepper* that turns an ID number into a person's secret, and it checks PINs. Agencies and the public cannot link anyone; the service could. Deriving the secret from a passport chip (zkPassport-style) would remove this.
- **Activation strength.** ID + date of birth + an emailed code (one use, 7-day expiry; agencies can resend it). A production deployment would add an SMS one-time code, as the Stellar Disbursement Platform does.
- **Guessing limits.** Five wrong attempts lock a person for 15 minutes, and each device is rate-limited on the endpoints that check secrets or send email. Failures never reveal whether an ID number is enrolled.
- **The demo service signs for both agencies** with testnet keys, and its API has no agency login. In a real deployment each agency signs from its own wallet.
- **Trusted setup.** Proving keys come from a setup run once with fresh cryptographic randomness that was never written to disk, not from a public multi-party ceremony. Fine for a demo; production needs a ceremony.
- **Exact identifiers.** Deduplication relies on a stable ID number. Two different IDs for one person are not caught; fuzzy or biometric matching (see xDup below) is out of scope.

## Related work and credits

- **ZK-VOTE** (MIT): the Groth16 verifier and Merkle circuit this project adapts. Its licence is kept in [`contracts/groth16/LICENSE-ZKVOTE`](contracts/groth16/LICENSE-ZKVOTE).
- **Semaphore**: the nullifier pattern.
- **Stellar Disbursement Platform / Stellar Aid Assist**: the aid rail Hapax is designed to plug into, and the source of the recipient-verification pattern.
- **xDup** (IEEE S&P 2026): privacy-preserving deduplication for humanitarian organisations, off-chain; it shows the need this addresses.
- Photographs from Unsplash. Icons from Lucide (ISC).

## License

MIT. See [LICENSE](LICENSE).

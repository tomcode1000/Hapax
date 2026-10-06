#![cfg(test)]
extern crate std;

#[path = "fixture.rs"]
mod fixture;

use super::*;
use fixture::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, BytesN, Env, String, U256};

fn u(env: &Env, s: &str) -> U256 {
    let n = num_from_dec(s);
    U256::from_be_bytes(env, &Bytes::from_array(env, &n))
}

// Decimal string -> 32-byte big-endian.
fn num_from_dec(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for ch in s.bytes() {
        let mut carry = (ch - b'0') as u32;
        for b in out.iter_mut().rev() {
            let v = (*b as u32) * 10 + carry;
            *b = (v & 0xff) as u8;
            carry = v >> 8;
        }
    }
    out
}

fn hexn<const N: usize>(env: &Env, h: &str) -> BytesN<N> {
    let mut a = [0u8; N];
    for i in 0..N {
        a[i] = u8::from_str_radix(&h[2 * i..2 * i + 2], 16).unwrap();
    }
    BytesN::from_array(env, &a)
}

fn vk(env: &Env) -> VerificationKey {
    let mut ic = Vec::new(env);
    for x in VK_IC {
        ic.push_back(hexn::<64>(env, x));
    }
    VerificationKey {
        alpha: hexn(env, VK_ALPHA),
        beta: hexn(env, VK_BETA),
        gamma: hexn(env, VK_GAMMA),
        delta: hexn(env, VK_DELTA),
        ic,
    }
}

fn proof(env: &Env) -> Proof {
    Proof { a: hexn(env, PROOF_A), b: hexn(env, PROOF_B), c: hexn(env, PROOF_C) }
}

struct Setup {
    env: Env,
    client: RegistryClient<'static>,
    token: Address,
    admin: Address,
    agency_a: Address,
    agency_b: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let id = env.register(Registry, ());
    let client = RegistryClient::new(&env, &id);
    client.init(&admin, &vk(&env));
    let agency_a = Address::generate(&env);
    let agency_b = Address::generate(&env);
    client.add_agency(&agency_a);
    client.add_agency(&agency_b);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    StellarAssetClient::new(&env, &token).mint(&admin, &1_000_0000000);
    Setup { env, client, token, admin, agency_a, agency_b }
}

fn enrol_three(s: &Setup) {
    s.client.enrol(&s.agency_a, &u(&s.env, COMMITMENTS[0]));
    s.client.enrol(&s.agency_b, &u(&s.env, COMMITMENTS[1]));
    s.client.enrol(&s.agency_a, &u(&s.env, COMMITMENTS[2]));
}

#[test]
fn root_matches_js_tree() {
    let s = setup();
    enrol_three(&s);
    assert_eq!(s.client.root(), u(&s.env, ROOT));
    assert_eq!(s.client.size(), 3);
}

#[test]
fn recipient_field_matches_js() {
    let env = Env::default();
    let r = Address::from_str(&env, RECIPIENT);
    assert_eq!(recipient_field(&env, &r), u(&env, RECIPIENT_FIELD));
}

#[test]
fn second_agency_cannot_enrol_same_person() {
    let s = setup();
    s.client.enrol(&s.agency_a, &u(&s.env, COMMITMENTS[0]));
    let r = s.client.try_enrol(&s.agency_b, &u(&s.env, COMMITMENTS[0]));
    assert_eq!(r, Err(Ok(Error::AlreadyEnrolled)));
}

#[test]
fn non_agency_cannot_enrol() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    let r = s.client.try_enrol(&stranger, &u(&s.env, COMMITMENTS[0]));
    assert_eq!(r, Err(Ok(Error::NotAgency)));
}

#[test]
fn real_proof_claims_once_then_rejected() {
    let s = setup();
    enrol_three(&s);
    s.client.create_round(&1, &s.token, &50_0000000);
    s.client.fund(&s.admin, &1, &500_0000000);
    let recipient = Address::from_str(&s.env, RECIPIENT);
    let root = u(&s.env, ROOT);
    let nul = u(&s.env, NULLIFIER);

    s.client.claim(&1, &root, &nul, &recipient, &proof(&s.env));
    let bal = soroban_sdk::token::Client::new(&s.env, &s.token).balance(&recipient);
    assert_eq!(bal, 50_0000000);
    assert!(s.client.is_claimed(&1, &nul));

    let again = s.client.try_claim(&1, &root, &nul, &recipient, &proof(&s.env));
    assert_eq!(again, Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn proof_cannot_be_redirected() {
    let s = setup();
    enrol_three(&s);
    s.client.create_round(&1, &s.token, &50_0000000);
    s.client.fund(&s.admin, &1, &500_0000000);
    let thief = Address::generate(&s.env);
    let r = s.client.try_claim(&1, &u(&s.env, ROOT), &u(&s.env, NULLIFIER), &thief, &proof(&s.env));
    assert_eq!(r, Err(Ok(Error::InvalidProof)));
}

#[test]
fn proof_bound_to_round() {
    let s = setup();
    enrol_three(&s);
    s.client.create_round(&2, &s.token, &50_0000000);
    s.client.fund(&s.admin, &2, &500_0000000);
    let recipient = Address::from_str(&s.env, RECIPIENT);
    let r = s.client.try_claim(&2, &u(&s.env, ROOT), &u(&s.env, NULLIFIER), &recipient, &proof(&s.env));
    assert_eq!(r, Err(Ok(Error::InvalidProof)));
}

#[test]
fn unknown_root_rejected() {
    let s = setup();
    enrol_three(&s);
    s.client.create_round(&1, &s.token, &50_0000000);
    s.client.fund(&s.admin, &1, &500_0000000);
    let recipient = Address::from_str(&s.env, RECIPIENT);
    let bogus = U256::from_u32(&s.env, 12345);
    let r = s.client.try_claim(&1, &bogus, &u(&s.env, NULLIFIER), &recipient, &proof(&s.env));
    assert_eq!(r, Err(Ok(Error::UnknownRoot)));
    let _ = String::from_str(&s.env, "");
}

// Soroban's per-transaction CPU limit is 100M instructions; print what the
// two expensive calls use so we know they fit with headroom.
#[test]
fn cost_of_enrol_and_claim() {
    let s = setup();
    s.client.enrol(&s.agency_a, &u(&s.env, COMMITMENTS[0]));
    s.client.enrol(&s.agency_b, &u(&s.env, COMMITMENTS[1]));
    s.env.cost_estimate().budget().reset_default();
    s.client.enrol(&s.agency_a, &u(&s.env, COMMITMENTS[2]));
    let enrol_cpu = s.env.cost_estimate().budget().cpu_instruction_cost();
    s.env.cost_estimate().budget().reset_unlimited();
    s.client.create_round(&1, &s.token, &50_0000000);
    s.client.fund(&s.admin, &1, &500_0000000);
    let recipient = Address::from_str(&s.env, RECIPIENT);
    s.env.cost_estimate().budget().reset_default();
    s.client.claim(&1, &u(&s.env, ROOT), &u(&s.env, NULLIFIER), &recipient, &proof(&s.env));
    let claim_cpu = s.env.cost_estimate().budget().cpu_instruction_cost();
    std::println!("COST enrol_cpu={} claim_cpu={}", enrol_cpu, claim_cpu);
    assert!(enrol_cpu < 100_000_000 && claim_cpu < 100_000_000);
}

//! Hapax registry: one shared enrolment tree for every agency, aid rounds
//! funded in a Stellar token, and claims gated by a Groth16 proof whose
//! nullifier can be used once per round, whichever agency it is claimed at.
//!
//! Tree hashing must match circuits/lib.js and circuits/merkle_tree.circom:
//!   leaf  = Poseidon(LEAF_DOMAIN, commitment)
//!   node  = Poseidon(left, right)
//!   empty = Poseidon(LEAF_DOMAIN, 0), then the zero ladder upwards
//! Public signals, in order: [root, nullifier, round_id, recipient_field]
#![no_std]

use hapax_groth16::{verify_groth16, Proof, VerificationKey};
use soroban_poseidon::poseidon_hash;
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    crypto::BnScalar, token, vec, Address, Bytes, Env, Vec, U256,
};

pub const LEVELS: u32 = 18;
const LEAF_DOMAIN: u32 = 1;
const ROOT_HISTORY: u32 = 30;
const STRKEY_LEN: usize = 56;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAgency = 2,
    AlreadyEnrolled = 3,
    TreeFull = 4,
    RoundExists = 5,
    NoSuchRound = 6,
    UnknownRoot = 7,
    AlreadyClaimed = 8,
    InvalidProof = 9,
    RoundUnderfunded = 10,
}

#[contracttype]
#[derive(Clone)]
pub struct Round {
    pub token: Address,
    pub amount: i128,
    pub balance: i128,
}

#[contracttype]
enum Key {
    Admin,
    Vk,
    Zeros,
    Filled,
    NextIndex,
    Roots,
    Agency(Address),
    Enrolled(U256),
    Round(u64),
    Nullifier(u64, U256),
}

#[contractevent]
pub struct Enrolled {
    #[topic]
    pub agency: Address,
    pub index: u32,
    pub commitment: U256,
    pub root: U256,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub round_id: u64,
    pub nullifier: U256,
    pub recipient: Address,
    pub amount: i128,
}

#[contract]
pub struct Registry;

fn h2(env: &Env, a: &U256, b: &U256) -> U256 {
    poseidon_hash::<3, BnScalar>(env, &vec![env, a.clone(), b.clone()])
}

fn leaf_hash(env: &Env, commitment: &U256) -> U256 {
    h2(env, &U256::from_u32(env, LEAF_DOMAIN), commitment)
}

/// sha256(strkey ASCII) with the first byte zeroed; matches lib.js.
pub fn recipient_field(env: &Env, recipient: &Address) -> U256 {
    let s = recipient.to_string();
    let mut buf = [0u8; STRKEY_LEN];
    s.copy_into_slice(&mut buf);
    let mut digest: [u8; 32] = env.crypto().sha256(&Bytes::from_array(env, &buf)).to_array();
    digest[0] = 0;
    U256::from_be_bytes(env, &Bytes::from_array(env, &digest))
}

fn storage_get<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, k: &Key) -> V {
    env.storage().instance().get(k).unwrap()
}

#[contractimpl]
impl Registry {
    pub fn init(env: Env, admin: Address, vk: VerificationKey) -> Result<(), Error> {
        if env.storage().instance().has(&Key::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        let mut zeros: Vec<U256> = Vec::new(&env);
        let mut z = leaf_hash(&env, &U256::from_u32(&env, 0));
        for _ in 0..LEVELS {
            zeros.push_back(z.clone());
            z = h2(&env, &z, &z);
        }
        let empty_root = z;
        let s = env.storage().instance();
        s.set(&Key::Admin, &admin);
        s.set(&Key::Vk, &vk);
        s.set(&Key::Zeros, &zeros);
        s.set(&Key::Filled, &zeros);
        s.set(&Key::NextIndex, &0u32);
        s.set(&Key::Roots, &vec![&env, empty_root]);
        Ok(())
    }

    pub fn add_agency(env: Env, agency: Address) {
        let admin: Address = storage_get(&env, &Key::Admin);
        admin.require_auth();
        env.storage().persistent().set(&Key::Agency(agency), &true);
    }

    pub fn is_agency(env: Env, agency: Address) -> bool {
        env.storage().persistent().has(&Key::Agency(agency))
    }

    /// Adds a person's commitment to the shared tree. Rejects a commitment
    /// any agency has already enrolled; that rejection is all a second agency
    /// learns.
    pub fn enrol(env: Env, agency: Address, commitment: U256) -> Result<u32, Error> {
        agency.require_auth();
        if !env.storage().persistent().has(&Key::Agency(agency.clone())) {
            return Err(Error::NotAgency);
        }
        let ek = Key::Enrolled(commitment.clone());
        if env.storage().persistent().has(&ek) {
            return Err(Error::AlreadyEnrolled);
        }
        let index: u32 = storage_get(&env, &Key::NextIndex);
        if index >= (1u32 << LEVELS) {
            return Err(Error::TreeFull);
        }
        let zeros: Vec<U256> = storage_get(&env, &Key::Zeros);
        let mut filled: Vec<U256> = storage_get(&env, &Key::Filled);
        let mut node = leaf_hash(&env, &commitment);
        let mut idx = index;
        for i in 0..LEVELS {
            if idx % 2 == 0 {
                filled.set(i, node.clone());
                node = h2(&env, &node, &zeros.get(i).unwrap());
            } else {
                node = h2(&env, &filled.get(i).unwrap(), &node);
            }
            idx /= 2;
        }
        let mut roots: Vec<U256> = storage_get(&env, &Key::Roots);
        roots.push_back(node.clone());
        if roots.len() > ROOT_HISTORY {
            roots.remove(0);
        }
        let s = env.storage().instance();
        s.set(&Key::Filled, &filled);
        s.set(&Key::NextIndex, &(index + 1));
        s.set(&Key::Roots, &roots);
        env.storage().persistent().set(&ek, &index);
        Enrolled { agency, index, commitment, root: node.clone() }.publish(&env);
        Ok(index)
    }

    pub fn root(env: Env) -> U256 {
        let roots: Vec<U256> = storage_get(&env, &Key::Roots);
        roots.last().unwrap()
    }

    pub fn size(env: Env) -> u32 {
        storage_get(&env, &Key::NextIndex)
    }

    pub fn create_round(env: Env, round_id: u64, token: Address, amount: i128) -> Result<(), Error> {
        let admin: Address = storage_get(&env, &Key::Admin);
        admin.require_auth();
        let k = Key::Round(round_id);
        if env.storage().persistent().has(&k) {
            return Err(Error::RoundExists);
        }
        env.storage().persistent().set(&k, &Round { token, amount, balance: 0 });
        Ok(())
    }

    pub fn fund(env: Env, from: Address, round_id: u64, amount: i128) -> Result<(), Error> {
        from.require_auth();
        let k = Key::Round(round_id);
        let mut round: Round = env.storage().persistent().get(&k).ok_or(Error::NoSuchRound)?;
        token::Client::new(&env, &round.token).transfer(&from, &env.current_contract_address(), &amount);
        round.balance += amount;
        env.storage().persistent().set(&k, &round);
        Ok(())
    }

    pub fn round(env: Env, round_id: u64) -> Option<Round> {
        env.storage().persistent().get(&Key::Round(round_id))
    }

    pub fn is_claimed(env: Env, round_id: u64, nullifier: U256) -> bool {
        env.storage().persistent().has(&Key::Nullifier(round_id, nullifier))
    }

    /// Anyone may submit (e.g. an agency relaying for a recipient with no
    /// XLM); the proof is bound to `recipient`, so the payout cannot be
    /// redirected.
    pub fn claim(
        env: Env,
        round_id: u64,
        root: U256,
        nullifier: U256,
        recipient: Address,
        proof: Proof,
    ) -> Result<(), Error> {
        let rk = Key::Round(round_id);
        let mut round: Round = env.storage().persistent().get(&rk).ok_or(Error::NoSuchRound)?;
        let nk = Key::Nullifier(round_id, nullifier.clone());
        if env.storage().persistent().has(&nk) {
            return Err(Error::AlreadyClaimed);
        }
        let roots: Vec<U256> = storage_get(&env, &Key::Roots);
        if !roots.contains(&root) {
            return Err(Error::UnknownRoot);
        }
        if round.balance < round.amount {
            return Err(Error::RoundUnderfunded);
        }
        let vk: VerificationKey = storage_get(&env, &Key::Vk);
        let signals = vec![
            &env,
            root,
            nullifier.clone(),
            U256::from_u128(&env, round_id as u128),
            recipient_field(&env, &recipient),
        ];
        if !verify_groth16(&env, &vk, &proof, &signals) {
            return Err(Error::InvalidProof);
        }
        env.storage().persistent().set(&nk, &true);
        round.balance -= round.amount;
        env.storage().persistent().set(&rk, &round);
        token::Client::new(&env, &round.token).transfer(&env.current_contract_address(), &recipient, &round.amount);
        Claimed { round_id, nullifier, recipient, amount: round.amount }.publish(&env);
        Ok(())
    }
}

#[cfg(test)]
mod test;

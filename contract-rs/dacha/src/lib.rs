use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, BorshStorageKey, Duration, PanicOnDefault, Promise,
    PromiseOrValue,
};

const TIME_FROM_LAST_PING_NS: Duration = 1 * 60 * 10u64.pow(9);
const ONE_DAY_MS: Duration = 24 * 60 * 60 * 1000;

const MINT_PER_DAY: u128 = 100 * PIXEL_COST;

pub mod account;
pub use crate::account::*;

pub mod board;
pub use crate::board::*;

mod fungible_token_core;
mod fungible_token_metadata;
mod fungible_token_storage;
mod internal;
mod mint;

pub use crate::fungible_token_core::*;
pub use crate::fungible_token_metadata::*;
pub use crate::fungible_token_storage::*;
use crate::internal::ns_to_ms;

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum TokenType {
    Potato,
}

#[derive(BorshSerialize, BorshStorageKey)]
pub enum StorageKey {
    AccountIndices,
    Accounts,
    Pixels,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub account_indices: LookupMap<AccountId, u32>,
    pub board: board::PixelBoard,
    pub last_ping_timestamp: u64,
    pub num_accounts: u32,
    pub accounts: LookupMap<u32, UpgradableAccount>,
    pub burned_balances: Vec<Balance>,
    pub farmed_balances: Vec<Balance>,
    pub minted_balances: Vec<Balance>,
    pub potato_pool_id: u32,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        let mut place = Self {
            account_indices: LookupMap::new(StorageKey::AccountIndices),
            board: PixelBoard::new(),
            num_accounts: 0,
            accounts: LookupMap::new(StorageKey::Accounts),
            last_ping_timestamp: env::block_timestamp(),
            burned_balances: vec![0, 0],
            farmed_balances: vec![0, 0],
            minted_balances: vec![0, 0],
            potato_pool_id: 0,
        };

        let mut account = Account::new(env::current_account_id(), 0);
        account.num_pixels = TOTAL_NUM_PIXELS;
        place.save_account(account);

        place.mint_initial_deposit();

        place
    }

    #[private]
    pub fn set_pool_id(&mut self, potato_pool_id: u32) {
        self.potato_pool_id = potato_pool_id;
    }

    pub fn get_pool_id(&self) -> u32 {
        self.potato_pool_id
    }

    pub fn account_exists(&self, account_id: ValidAccountId) -> bool {
        self.account_indices.contains_key(account_id.as_ref())
    }

    pub fn draw(&mut self, pixels: Vec<SetPixelRequest>) {
        if pixels.is_empty() {
            return;
        }
        let mut account = self.get_mut_account(env::predecessor_account_id(), false);
        let new_pixels = pixels.len() as u32;
        let cost = account.charge(TokenType::Potato, new_pixels);
        self.burned_balances[TokenType::Potato as usize] += cost;

        let mut old_owners = self.board.set_pixels(account.account_index, &pixels);
        let replaced_pixels = old_owners.remove(&account.account_index).unwrap_or(0);
        account.num_pixels += new_pixels - replaced_pixels;
        self.save_account(account);

        for (account_index, num_pixels) in old_owners {
            let mut account = self.get_internal_account_by_index(account_index).unwrap();
            self.touch(&mut account);
            account.num_pixels -= num_pixels;
            self.save_account(account);
        }

        self.maybe_ping();
    }

    pub fn get_num_accounts(&self) -> u32 {
        self.num_accounts
    }

    pub fn get_unminted_amount(&self) -> U128 {
        let current_time = env::block_timestamp();
        let duration = current_time - self.last_ping_timestamp;
        if duration == 0 {
            return 0.into();
        }
        (MINT_PER_DAY * ns_to_ms(duration) as u128 / ONE_DAY_MS as u128).into()
    }

    pub fn ping(&mut self) -> PromiseOrValue<()> {
        let current_time = env::block_timestamp();
        let unminted_amount: Balance = self.get_unminted_amount().into();
        if unminted_amount == 0 {
            return PromiseOrValue::Value(());
        }
        self.last_ping_timestamp = current_time;
        self.mint(unminted_amount).into()
    }
}

impl Contract {
    fn maybe_ping(&mut self) {
        let current_time = env::block_timestamp();
        let next_ping = self.last_ping_timestamp + TIME_FROM_LAST_PING_NS;
        if next_ping > current_time {
            return;
        }
        self.ping();
    }
}

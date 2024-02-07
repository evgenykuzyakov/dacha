use crate::*;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::{env, near_bindgen, AccountId};

pub const PIXEL_COST: Balance = 1_000_000_000_000_000_000_000;
pub const ONE_NEAR: Balance = 1_000_000_000_000_000_000_000_000;
pub const DEFAULT_POTATO_BALANCE: Balance = 0;
/// Current reward is 1/10 pixel per day per pixel.
pub const REWARD_PER_PIXEL_PER_NANOSEC: Balance = PIXEL_COST / (24 * 60 * 60 * 1_000_000_000) / 10;

pub type AccountIndex = u32;

#[derive(BorshDeserialize, BorshSerialize)]
pub enum UpgradableAccount {
    Current(Account),
}

impl From<UpgradableAccount> for Account {
    fn from(account: UpgradableAccount) -> Self {
        match account {
            UpgradableAccount::Current(account) => account,
        }
    }
}

impl From<Account> for UpgradableAccount {
    fn from(account: Account) -> Self {
        UpgradableAccount::Current(account)
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Account {
    pub account_id: AccountId,
    pub account_index: AccountIndex,
    pub balances: Vec<Balance>,
    pub num_pixels: u32,
    pub claim_timestamp: u64,
    pub farmed: Vec<Balance>,
    pub burned: Vec<Balance>,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct HumanAccount {
    pub account_id: AccountId,
    pub account_index: AccountIndex,
    pub potato_balance: U128,
    pub farmed_balance: U128,
    pub burned_balance: U128,
    pub num_pixels: u32,
}

impl From<Account> for HumanAccount {
    fn from(account: Account) -> Self {
        Self {
            account_id: account.account_id,
            account_index: account.account_index,
            potato_balance: account.balances[TokenType::Potato as usize].into(),
            farmed_balance: account.farmed[TokenType::Potato as usize].into(),
            burned_balance: account.burned[TokenType::Potato as usize].into(),
            num_pixels: account.num_pixels,
        }
    }
}

impl Account {
    pub fn new(account_id: AccountId, account_index: AccountIndex) -> Self {
        Self {
            account_id,
            account_index,
            balances: vec![DEFAULT_POTATO_BALANCE],
            num_pixels: 0,
            claim_timestamp: env::block_timestamp(),
            farmed: vec![0],
            burned: vec![0],
        }
    }

    pub fn touch(&mut self) -> Balance {
        let block_timestamp = env::block_timestamp();
        let time_diff = block_timestamp - self.claim_timestamp;
        let farmed = Balance::from(self.num_pixels)
            * Balance::from(time_diff)
            * REWARD_PER_PIXEL_PER_NANOSEC;
        self.claim_timestamp = block_timestamp;
        self.balances[TokenType::Potato as usize] += farmed;
        self.farmed[TokenType::Potato as usize] += farmed;
        farmed
    }

    pub fn charge(&mut self, berry: TokenType, num_pixels: u32) -> Balance {
        let cost = Balance::from(num_pixels) * PIXEL_COST;
        assert!(
            self.balances[berry as usize] >= cost,
            "Not enough balance to draw pixels"
        );
        self.balances[berry as usize] -= cost;
        self.burned[berry as usize] += cost;
        cost
    }
}

impl Contract {
    pub fn get_internal_account_by_id(&self, account_id: &AccountId) -> Option<Account> {
        self.account_indices
            .get(&account_id)
            .and_then(|account_index| self.get_internal_account_by_index(account_index))
    }

    pub fn get_mut_account(&mut self, account_id: AccountId, create: bool) -> Account {
        let mut account = self
            .get_internal_account_by_id(&account_id)
            .unwrap_or_else(|| {
                assert!(create, "Account doesn't exist");
                Account::new(account_id, self.num_accounts)
            });
        self.touch(&mut account);
        account
    }

    pub fn get_internal_account_by_index(&self, account_index: AccountIndex) -> Option<Account> {
        self.accounts
            .get(&account_index)
            .map(|account| account.into())
    }

    pub fn touch(&mut self, account: &mut Account) {
        self.farmed_balances[TokenType::Potato as usize] += account.touch();
    }

    pub fn save_account(&mut self, account: Account) {
        let account_index = account.account_index;
        if account_index >= self.num_accounts {
            self.account_indices
                .insert(&account.account_id, &account_index);
            self.num_accounts += 1;
        }
        self.accounts.insert(&account_index, &account.into());
    }
}

#[near_bindgen]
impl Contract {
    pub fn get_pixel_cost(&self) -> U128 {
        PIXEL_COST.into()
    }

    pub fn get_account_by_index(&self, account_index: AccountIndex) -> Option<HumanAccount> {
        self.get_internal_account_by_index(account_index)
            .map(|mut account| {
                account.touch();
                account.into()
            })
    }

    pub fn get_account(&self, account_id: ValidAccountId) -> Option<HumanAccount> {
        self.get_internal_account_by_id(account_id.as_ref())
            .map(|mut account| {
                account.touch();
                account.into()
            })
    }

    pub fn get_account_balance(&self, account_id: ValidAccountId) -> U128 {
        self.get_internal_account_by_id(account_id.as_ref())
            .map(|mut account| {
                account.touch();
                account.balances[TokenType::Potato as usize]
            })
            .unwrap_or(DEFAULT_POTATO_BALANCE)
            .into()
    }

    pub fn get_account_num_pixels(&self, account_id: ValidAccountId) -> u32 {
        self.get_internal_account_by_id(account_id.as_ref())
            .map(|account| account.num_pixels)
            .unwrap_or(0)
    }

    pub fn get_account_id_by_index(&self, account_index: AccountIndex) -> Option<AccountId> {
        self.get_internal_account_by_index(account_index)
            .map(|account| account.account_id)
    }
}

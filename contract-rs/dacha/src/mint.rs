use crate::*;
use near_sdk::{ext_contract, Gas};

// Mainnet config
const REF_FINANCE_ACCOUNT_ID: &str = "v2.ref-finance.near";
const WRAP_NEAR_TOKEN_ID: &str = "wrap.near";

// Testnet config
// const REF_FINANCE_ACCOUNT_ID: &str = "ref-finance-101.testnet";
// const WRAP_NEAR_TOKEN_ID: &str = "wrap.testnet";

const GAS_FOR_SWAP: Gas = 20 * 10u64.pow(12);
const GAS_FOR_STORAGE_DEPOSIT: Gas = 5 * 10u64.pow(12);
const GAS_FOR_DEPOSIT: Gas = 5 * 10u64.pow(12);

const GAS_FOR_WITHDRAW: Gas = 55 * 10u64.pow(12);
const GAS_FOR_NEAR_UNWRAP: Gas = 10 * 10u64.pow(12);

const GAS_FOR_REF_GET_DEPOSIT: Gas = GAS_FOR_WITHDRAW + GAS_FOR_NEAR_UNWRAP + 25 * 10u64.pow(12);

// 100 years supply.
const INITIAL_REF_AMOUNT: u128 = MINT_PER_DAY * 365 * 100;

/// Single swap action.
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapAction {
    /// Pool which should be used for swapping.
    pub pool_id: u32,
    /// Token to swap from.
    pub token_in: AccountId,
    /// Amount to exchange.
    /// If amount_in is None, it will take amount_out from previous step.
    /// Will fail if amount_in is None on the first step.
    pub amount_in: Option<U128>,
    /// Token to swap into.
    pub token_out: AccountId,
    /// Required minimum amount of token_out.
    pub min_amount_out: U128,
}

#[ext_contract(ext_ref_finance)]
pub trait ExtRefFinance {
    fn swap(&mut self, actions: Vec<SwapAction>, referral_id: Option<AccountId>);
    fn withdraw(&mut self, token_id: AccountId, amount: U128);
    fn get_deposit(&self, account_id: AccountId, token_id: AccountId) -> U128;
}

#[near_bindgen]
impl Contract {
    pub fn withdraw_ref_near(&mut self) -> Promise {
        let ref_account_id = REF_FINANCE_ACCOUNT_ID.to_string();

        ext_ref_finance::get_deposit(
            env::current_account_id(),
            WRAP_NEAR_TOKEN_ID.to_string(),
            &ref_account_id,
            0,
            GAS_FOR_DEPOSIT,
        )
        .then(Promise::new(env::current_account_id()).function_call(
            b"on_ref_get_deposit".to_vec(),
            b"{}".to_vec(),
            0,
            GAS_FOR_REF_GET_DEPOSIT,
        ))
    }

    #[private]
    pub fn on_ref_get_deposit(&mut self, #[callback] amount: U128) -> Promise {
        let ref_account_id = REF_FINANCE_ACCOUNT_ID.to_string();

        ext_ref_finance::withdraw(
            WRAP_NEAR_TOKEN_ID.to_string(),
            amount,
            &ref_account_id,
            1,
            GAS_FOR_WITHDRAW,
        )
        .then(Promise::new(WRAP_NEAR_TOKEN_ID.to_string()).function_call(
            b"near_withdraw".to_vec(),
            b"{}".to_vec(),
            1,
            GAS_FOR_NEAR_UNWRAP,
        ))
    }
}

impl Contract {
    pub(crate) fn mint(&mut self, amount: Balance) -> Promise {
        let ref_account_id = REF_FINANCE_ACCOUNT_ID.to_string();
        self.internal_deposit(&ref_account_id, amount);
        self.minted_balances[TokenType::Potato as usize] += amount;

        ext_ref_finance::swap(
            vec![SwapAction {
                pool_id: self.potato_pool_id,
                token_in: env::current_account_id(),
                amount_in: Some(U128(amount)),
                token_out: WRAP_NEAR_TOKEN_ID.to_string(),
                min_amount_out: U128(1),
            }],
            Some(env::current_account_id()),
            &ref_account_id,
            1,
            GAS_FOR_SWAP,
        )
    }

    pub(crate) fn mint_initial_deposit(&mut self) {
        let ref_account_id = REF_FINANCE_ACCOUNT_ID.to_string();
        self.internal_deposit(&ref_account_id, 10000 * PIXEL_COST);
        self.minted_balances[TokenType::Potato as usize] += 10000 * PIXEL_COST;

        Promise::new(WRAP_NEAR_TOKEN_ID.to_string())
            .function_call(
                b"storage_deposit".to_vec(),
                b"{}".to_vec(),
                125 * env::storage_byte_cost(),
                GAS_FOR_STORAGE_DEPOSIT,
            )
            .function_call(
                b"near_deposit".to_vec(),
                b"{}".to_vec(),
                10 * ONE_NEAR,
                GAS_FOR_STORAGE_DEPOSIT,
            );

        Promise::new(ref_account_id)
            .function_call(
                b"storage_deposit".to_vec(),
                b"{}".to_vec(),
                ONE_NEAR / 10,
                GAS_FOR_STORAGE_DEPOSIT,
            )
            .function_call(
                b"register_tokens".to_vec(),
                format!("{{\"token_ids\": [\"{}\"]}}", env::current_account_id(),).into_bytes(),
                1,
                GAS_FOR_DEPOSIT,
            )
            .function_call(
                b"ft_on_transfer".to_vec(),
                format!(
                    "{{\"sender_id\": \"{}\", \"amount\": \"{}\", \"msg\": \"\"}}",
                    env::current_account_id(),
                    INITIAL_REF_AMOUNT
                )
                .into_bytes(),
                0,
                GAS_FOR_DEPOSIT,
            );
    }
}

use crate::*;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use std::convert::TryInto;
use std::mem::size_of;

const STORAGE_AMOUNT_BYTES: usize = size_of::<UpgradableAccount>() + 68 + 40 + 100;

#[allow(unused_variables)]
#[near_bindgen]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<ValidAccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        let account_id = account_id
            .map(|a| a.into())
            .unwrap_or_else(env::predecessor_account_id);
        let attached_deposit = env::attached_deposit();
        let refund_amount = if self.account_indices.contains_key(&account_id) {
            attached_deposit
        } else {
            let amount = self.storage_balance_bounds().min.0;
            assert!(attached_deposit >= amount);
            let account = self.get_mut_account(account_id.clone(), true);
            self.save_account(account);
            attached_deposit - amount
        };
        if refund_amount > 0 {
            Promise::new(env::predecessor_account_id()).transfer(refund_amount);
        }
        self.storage_balance_of(account_id.try_into().unwrap())
            .unwrap()
    }

    fn storage_withdraw(&mut self, amount: Option<U128>) -> StorageBalance {
        env::panic(b"Unimplemented");
    }

    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        env::panic(b"Unimplemented");
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        let v = STORAGE_AMOUNT_BYTES as Balance * env::storage_byte_cost();
        StorageBalanceBounds {
            min: v.into(),
            max: Some(v.into()),
        }
    }

    fn storage_balance_of(&self, account_id: ValidAccountId) -> Option<StorageBalance> {
        if self.account_indices.contains_key(account_id.as_ref()) {
            Some(StorageBalance {
                total: self.storage_balance_bounds().min,
                available: 0.into(),
            })
        } else {
            None
        }
    }
}

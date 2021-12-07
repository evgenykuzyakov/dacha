use crate::*;
use near_sdk::Timestamp;

pub(crate) fn ns_to_ms(ns: Timestamp) -> Timestamp {
    ns / 10u64.pow(6)
}

impl Contract {
    pub(crate) fn internal_deposit(&mut self, account_id: &AccountId, amount: Balance) {
        let mut account = self.get_mut_account(account_id.clone(), amount >= PIXEL_COST);
        let balance = account.balances[TokenType::Potato as usize];

        if let Some(new_balance) = balance.checked_add(amount) {
            account.balances[TokenType::Potato as usize] = new_balance;
            self.save_account(account);
        } else {
            env::panic(b"Balance overflow");
        }
    }

    pub(crate) fn internal_withdraw(&mut self, account_id: &AccountId, amount: Balance) {
        let mut account = self.get_mut_account(account_id.clone(), false);
        let balance = account.balances[TokenType::Potato as usize];

        if let Some(new_balance) = balance.checked_sub(amount) {
            account.balances[TokenType::Potato as usize] = new_balance;
            self.save_account(account);
        } else {
            env::panic(b"The account doesn't have enough balance");
        }
    }

    pub(crate) fn internal_transfer(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        amount: Balance,
        memo: Option<String>,
    ) {
        assert_ne!(
            sender_id, receiver_id,
            "Sender and receiver should be different"
        );
        assert!(amount > 0, "The amount should be a positive number");
        self.internal_withdraw(sender_id, amount);
        self.internal_deposit(receiver_id, amount);
        env::log(format!("Transfer {} from {} to {}", amount, sender_id, receiver_id).as_bytes());
        if let Some(memo) = memo {
            env::log(format!("Memo: {}", memo).as_bytes());
        }
    }
}

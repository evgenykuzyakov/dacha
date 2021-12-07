#!/bin/bash
set -e

WNEAR_AMOUNT=10000000000000000000000000
AMOUNT=10000000000000000000000

echo "Account ID: $ACCOUNT_ID"
echo "Wrap NEAR account ID: $WNEAR"
echo "REF Exchange account ID: $CONTRACT_ID"
echo "Correct?"

read CORRECT

near deploy $ACCOUNT_ID res/dacha.wasm new '{}' --initGas=200000000000000
near call $WNEAR --accountId=$ACCOUNT_ID ft_transfer_call '{"receiver_id": "'$CONTRACT_ID'", "amount": "'$WNEAR_AMOUNT'", "msg": ""}' --gas=100000000000000 --depositYocto=1
near call $CONTRACT_ID add_simple_pool '{"tokens": ["'$ACCOUNT_ID'", "'$WNEAR'"], "fee": 25}' --account_id=$ACCOUNT_ID --amount=0.01

echo "What's POOL_ID?"
read POOL_ID

near call $ACCOUNT_ID --accountId=$ACCOUNT_ID set_pool_id '{"potato_pool_id": '$POOL_ID'}'

near call $CONTRACT_ID add_liquidity --accountId=$ACCOUNT_ID '{"pool_id": '$POOL_ID', "amounts": ["'$AMOUNT'", "'$WNEAR_AMOUNT'"]}'  --amount=0.01

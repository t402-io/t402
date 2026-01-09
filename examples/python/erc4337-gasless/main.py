#!/usr/bin/env python3
"""
ERC-4337 Gasless Transaction Example

This example demonstrates how to use ERC-4337 Account Abstraction
for gasless transactions with T402 in Python.

Features:
- Safe Smart Account: Create a Safe-based smart account with 4337 module
- Pimlico Bundler: Submit UserOperations via Pimlico's bundler
- Gas Sponsorship: Use Pimlico paymaster for gasless transactions
- ERC-4337 v0.7: Full support for the latest EntryPoint version

Required environment variables:
- OWNER_PRIVATE_KEY: EOA private key that owns the Safe (hex encoded with 0x prefix)
- PIMLICO_API_KEY: Your Pimlico API key
- CHAIN_ID: (optional) Chain ID, defaults to 84532 (Base Sepolia)
"""

import os
import sys
from dotenv import load_dotenv

from t402.erc4337 import (
    UserOperation,
    SafeSmartAccount,
    SafeAccountConfig,
    create_bundler_client,
    create_paymaster,
    ENTRYPOINT_V07_ADDRESS,
    DEFAULT_GAS_LIMITS,
)

# Load environment variables
load_dotenv()


def main():
    # Get configuration
    owner_private_key = os.getenv("OWNER_PRIVATE_KEY")
    pimlico_api_key = os.getenv("PIMLICO_API_KEY")
    chain_id = int(os.getenv("CHAIN_ID", "84532"))  # Default to Base Sepolia

    if not owner_private_key:
        print("❌ OWNER_PRIVATE_KEY environment variable is required")
        print("   Example: '0xabc123...' (66 character hex string with 0x prefix)")
        sys.exit(1)

    if not pimlico_api_key:
        print("❌ PIMLICO_API_KEY environment variable is required")
        print("   Get one at: https://dashboard.pimlico.io/")
        sys.exit(1)

    print("🚀 ERC-4337 Gasless Transaction Example (Python)\n")

    # Get owner address from private key
    from eth_account import Account
    owner_account = Account.from_key(owner_private_key)
    owner_address = owner_account.address

    print(f"Owner EOA: {owner_address}")
    print(f"Chain ID: {chain_id}\n")

    # Step 1: Create Safe smart account
    print("📦 Creating Safe smart account...")
    safe_account = SafeSmartAccount(SafeAccountConfig(
        owner_private_key=owner_private_key,
        chain_id=chain_id,
        salt=0,
    ))

    smart_account_address = safe_account.get_address()
    print(f"   Smart Account Address: {smart_account_address}\n")

    # Step 2: Create Pimlico bundler client
    print("🔗 Connecting to Pimlico bundler...")
    bundler = create_bundler_client(
        provider="pimlico",
        api_key=pimlico_api_key,
        chain_id=chain_id,
    )

    # Get current gas prices
    try:
        gas_price = bundler.get_user_operation_gas_price()
        print(f"   Fast gas price: {gas_price.fast_max_fee} wei\n")
        max_fee_per_gas = gas_price.fast_max_fee
        max_priority_fee_per_gas = gas_price.fast_priority_fee
    except Exception as e:
        print(f"   ⚠️  Could not fetch gas prices: {e}")
        max_fee_per_gas = 10_000_000_000  # 10 gwei
        max_priority_fee_per_gas = 1_000_000_000  # 1 gwei
        print()

    # Step 3: Create Pimlico paymaster for gas sponsorship
    print("💰 Setting up Pimlico paymaster...")
    paymaster = create_paymaster(
        provider="pimlico",
        api_key=pimlico_api_key,
        chain_id=chain_id,
    )
    print("   Paymaster configured\n")

    # Step 4: Build UserOperation
    print("📝 Building UserOperation...\n")

    # Example: encode a simple ETH transfer (0 value, no data = no-op)
    target_address = "0x0000000000000000000000000000000000000000"
    call_data = safe_account.encode_execute(target_address, 0, b"")

    # Get init code for account deployment
    init_code = safe_account.get_init_code()

    # Build UserOperation
    user_op = UserOperation(
        sender=smart_account_address,
        nonce=0,
        init_code=init_code,
        call_data=call_data,
        verification_gas_limit=DEFAULT_GAS_LIMITS.verification_gas_limit,
        call_gas_limit=DEFAULT_GAS_LIMITS.call_gas_limit,
        pre_verification_gas=DEFAULT_GAS_LIMITS.pre_verification_gas,
        max_fee_per_gas=max_fee_per_gas,
        max_priority_fee_per_gas=max_priority_fee_per_gas,
    )

    # Step 5: Estimate gas
    print("⛽ Estimating gas...")
    try:
        gas_estimate = bundler.estimate_user_operation_gas(user_op)
        print(f"   Verification Gas: {gas_estimate.verification_gas_limit}")
        print(f"   Call Gas: {gas_estimate.call_gas_limit}")
        print(f"   Pre-verification Gas: {gas_estimate.pre_verification_gas}\n")

        user_op.verification_gas_limit = gas_estimate.verification_gas_limit
        user_op.call_gas_limit = gas_estimate.call_gas_limit
        user_op.pre_verification_gas = gas_estimate.pre_verification_gas
    except Exception as e:
        print(f"   ⚠️  Gas estimation failed (expected without funds): {e}\n")

    # Step 6: Get paymaster sponsorship
    print("🎁 Requesting gas sponsorship...")
    try:
        paymaster_data = paymaster.get_paymaster_data(
            user_op,
            chain_id,
            ENTRYPOINT_V07_ADDRESS,
        )
        print(f"   Paymaster: {paymaster_data.paymaster}\n")
        user_op.paymaster_and_data = paymaster_data.to_bytes()
    except Exception as e:
        print(f"   ⚠️  Sponsorship not available: {e}")
        print("   (Configure a policy in Pimlico dashboard)\n")

    # Step 7: Sign the UserOperation (placeholder for demo)
    print("✍️  Signing UserOperation...")
    # In production:
    # user_op_hash = compute_user_op_hash(user_op, chain_id, ENTRYPOINT_V07_ADDRESS)
    # signature = safe_account.sign_user_op_hash(user_op_hash)
    # user_op.signature = signature
    user_op.signature = b"\x00" * 65
    print("   Signature created (placeholder for demo)\n")

    # Step 8: Ready to submit
    print("📤 Ready to submit UserOperation!")
    print("   (Submission disabled in demo mode)\n")

    # Uncomment to actually submit:
    # user_op_hash = bundler.send_user_operation(user_op)
    # print(f"   UserOp Hash: {user_op_hash}")
    #
    # print("⏳ Waiting for confirmation...")
    # receipt = bundler.wait_for_receipt(user_op_hash)
    # print(f"   Success: {receipt.success}")
    # print(f"   Transaction: {receipt.transaction_hash}")

    # Summary
    print("📋 Summary:")
    print(f"   Smart Account: {smart_account_address}")
    print(f"   Owner: {owner_address}")
    print(f"   Chain: {chain_id}")
    print("   Bundler: Pimlico")
    print("   Paymaster: Pimlico (gas sponsorship)")
    print(f"   EntryPoint: {ENTRYPOINT_V07_ADDRESS}")


if __name__ == "__main__":
    main()

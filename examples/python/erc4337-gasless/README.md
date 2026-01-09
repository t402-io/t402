# ERC-4337 Gasless Transaction Example (Python)

This example demonstrates how to use ERC-4337 Account Abstraction for gasless transactions with T402 in Python.

## Features

- **Safe Smart Account**: Create a Safe-based smart account with 4337 module
- **Pimlico Bundler**: Submit UserOperations via Pimlico's bundler
- **Gas Sponsorship**: Use Pimlico paymaster for gasless transactions
- **ERC-4337 v0.7**: Full support for the latest EntryPoint version

## Prerequisites

1. **Pimlico API Key**: Get one at [dashboard.pimlico.io](https://dashboard.pimlico.io/)
2. **Owner Wallet**: An EOA private key that will own the Safe smart account
3. **Sponsorship Policy**: Configure a gas policy in Pimlico dashboard for sponsorship

## Installation

```bash
pip install t402 python-dotenv eth-account
```

## Environment Variables

Create a `.env` file:

```bash
# Required
OWNER_PRIVATE_KEY=0x...    # EOA private key (with 0x prefix)
PIMLICO_API_KEY=...        # Your Pimlico API key

# Optional
CHAIN_ID=84532             # Chain ID (default: Base Sepolia)
```

## Supported Chains

| Chain | Chain ID | Network |
|-------|----------|---------|
| Ethereum Mainnet | 1 | eth-mainnet |
| Ethereum Sepolia | 11155111 | eth-sepolia |
| Base | 8453 | base-mainnet |
| Base Sepolia | 84532 | base-sepolia |
| Optimism | 10 | opt-mainnet |
| Arbitrum One | 42161 | arb-mainnet |
| Polygon | 137 | polygon-mainnet |

## Running the Example

```bash
# Set environment variables (or use .env file)
export OWNER_PRIVATE_KEY="0x..."
export PIMLICO_API_KEY="..."

# Run the example
python main.py
```

## Code Overview

### 1. Create Safe Smart Account

```python
from t402.erc4337 import SafeSmartAccount, SafeAccountConfig

safe_account = SafeSmartAccount(SafeAccountConfig(
    owner_private_key="0x...",
    chain_id=84532,
    salt=0,
))

address = safe_account.get_address()
```

### 2. Connect to Bundler

```python
from t402.erc4337 import create_bundler_client

bundler = create_bundler_client(
    provider="pimlico",
    api_key=pimlico_api_key,
    chain_id=chain_id,
)

# Get gas prices
gas_price = bundler.get_user_operation_gas_price()
```

### 3. Setup Paymaster

```python
from t402.erc4337 import create_paymaster

paymaster = create_paymaster(
    provider="pimlico",
    api_key=pimlico_api_key,
    chain_id=chain_id,
)

# Get sponsorship data
paymaster_data = paymaster.get_paymaster_data(user_op, chain_id, entry_point)
```

### 4. Build and Submit UserOperation

```python
from t402.erc4337 import UserOperation

# Encode the call
call_data = safe_account.encode_execute(target, value, data)

# Build UserOp
user_op = UserOperation(
    sender=smart_account_address,
    nonce=0,
    init_code=safe_account.get_init_code(),
    call_data=call_data,
    verification_gas_limit=150000,
    call_gas_limit=100000,
    pre_verification_gas=50000,
    max_fee_per_gas=gas_price.fast_max_fee,
    max_priority_fee_per_gas=gas_price.fast_priority_fee,
    paymaster_and_data=paymaster_data.to_bytes(),
    signature=signature,
)

# Submit
user_op_hash = bundler.send_user_operation(user_op)
receipt = bundler.wait_for_receipt(user_op_hash)
```

## Alternative Providers

### Alchemy Bundler

```python
from t402.erc4337 import create_bundler_client, AlchemyPolicyConfig

bundler = create_bundler_client(
    provider="alchemy",
    api_key=alchemy_api_key,
    chain_id=chain_id,
    policy_id="your-policy-id",
)

# Combined gas + paymaster estimation
result = bundler.request_gas_and_paymaster_and_data(user_op)
```

### Biconomy Paymaster

```python
from t402.erc4337 import create_paymaster

paymaster = create_paymaster(
    provider="biconomy",
    api_key=biconomy_api_key,
    chain_id=chain_id,
    paymaster_url="https://paymaster.biconomy.io/api/v1/...",
    mode="sponsored",  # or "erc20"
)
```

### Stackup Paymaster

```python
paymaster = create_paymaster(
    provider="stackup",
    api_key=stackup_api_key,
    chain_id=chain_id,
    paymaster_url="https://api.stackup.sh/v1/paymaster/...",
)
```

## Batch Transactions

Execute multiple transactions in a single UserOperation:

```python
call_data = safe_account.encode_execute_batch(
    targets=[target1, target2, target3],
    values=[value1, value2, value3],
    datas=[data1, data2, data3],
)
```

## Using Unified Paymaster

Try multiple paymasters in sequence:

```python
from t402.erc4337 import UnifiedPaymaster, create_paymaster

paymasters = [
    create_paymaster("pimlico", api_key=pimlico_key, chain_id=chain_id),
    create_paymaster("biconomy", api_key=biconomy_key, chain_id=chain_id, paymaster_url=url),
]

unified = UnifiedPaymaster(paymasters)
paymaster_data = unified.get_paymaster_data(user_op, chain_id, entry_point)
```

## Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [Safe 4337 Module](https://github.com/safe-global/safe-modules)
- [T402 Documentation](https://t402.io/docs)

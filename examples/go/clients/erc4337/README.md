# ERC-4337 Gasless Transaction Example (Go)

This example demonstrates how to use ERC-4337 Account Abstraction for gasless transactions with T402 in Go.

## Features

- **Safe Smart Account**: Create a Safe-based smart account with 4337 module
- **Pimlico Bundler**: Submit UserOperations via Pimlico's bundler
- **Gas Sponsorship**: Use Pimlico paymaster for gasless transactions
- **ERC-4337 v0.7**: Full support for the latest EntryPoint version

## Prerequisites

1. **Pimlico API Key**: Get one at [dashboard.pimlico.io](https://dashboard.pimlico.io/)
2. **Owner Wallet**: An EOA private key that will own the Safe smart account
3. **Sponsorship Policy**: Configure a gas policy in Pimlico dashboard for sponsorship

## Environment Variables

```bash
# Required
OWNER_PRIVATE_KEY=abc123...  # EOA private key (64 char hex, NO 0x prefix)
PIMLICO_API_KEY=...          # Your Pimlico API key

# Optional
CHAIN_ID=84532               # Chain ID (default: Base Sepolia)
```

## Supported Chains

| Chain | Chain ID | Network |
|-------|----------|---------|
| Ethereum Mainnet | 1 | ethereum |
| Ethereum Sepolia | 11155111 | sepolia |
| Base | 8453 | base |
| Base Sepolia | 84532 | base-sepolia |
| Optimism | 10 | optimism |
| Arbitrum One | 42161 | arbitrum |
| Polygon | 137 | polygon |

## Running the Example

```bash
# Set environment variables
export OWNER_PRIVATE_KEY="abc123..."
export PIMLICO_API_KEY="..."

# Run the example
go run main.go
```

## Code Overview

### 1. Create Safe Smart Account

```go
import "github.com/t402-io/t402/go/mechanisms/evm/erc4337"

safeAccount, err := erc4337.NewSafeSmartAccount(erc4337.SafeAccountConfig{
    Owner:   privateKey,     // *ecdsa.PrivateKey
    ChainID: 84532,          // Chain ID
    Salt:    big.NewInt(0),  // For deterministic address
})

address, _ := safeAccount.GetAddress()
```

### 2. Connect to Bundler

```go
bundler := erc4337.NewPimlicoBundlerClient(erc4337.PimlicoConfig{
    APIKey:  pimlicoAPIKey,
    ChainID: chainID,
})

// Get gas prices
gasPrice, _ := bundler.GetUserOperationGasPrice()
```

### 3. Setup Paymaster

```go
paymaster := erc4337.NewPimlicoPaymaster(erc4337.PimlicoPaymasterConfig{
    APIKey:  pimlicoAPIKey,
    ChainID: chainID,
})

// Get sponsorship data
paymasterData, _ := paymaster.SponsorUserOperation(userOp)
```

### 4. Build and Submit UserOperation

```go
// Encode the call
callData, _ := safeAccount.EncodeExecute(target, value, data)

// Build UserOp
userOp := &erc4337.UserOperation{
    Sender:               smartAccountAddress,
    Nonce:                big.NewInt(0),
    InitCode:             initCode,
    CallData:             callData,
    VerificationGasLimit: big.NewInt(150000),
    CallGasLimit:         big.NewInt(100000),
    PreVerificationGas:   big.NewInt(50000),
    MaxFeePerGas:         gasPrice.Fast.MaxFeePerGas,
    MaxPriorityFeePerGas: gasPrice.Fast.MaxPriorityFeePerGas,
    PaymasterAndData:     paymasterAndData,
    Signature:            signature,
}

// Submit
hash, _ := bundler.SendUserOperation(userOp)
receipt, _ := bundler.WaitForReceipt(hash, 60*time.Second, 2*time.Second)
```

## Alternative Providers

### Alchemy Bundler

```go
bundler := erc4337.NewAlchemyBundlerClient(erc4337.AlchemyConfig{
    APIKey:   alchemyAPIKey,
    ChainID:  chainID,
    PolicyID: "your-policy-id", // For gas sponsorship
})

// Combined gas + paymaster estimation
result, _ := bundler.RequestGasAndPaymasterAndData(userOp, nil)
```

### Biconomy Paymaster

```go
paymaster := erc4337.NewBiconomyPaymaster(erc4337.BiconomyPaymasterConfig{
    APIKey:       biconomyAPIKey,
    ChainID:      chainID,
    PaymasterURL: "https://paymaster.biconomy.io/api/v1/...",
    Mode:         "sponsored", // or "erc20"
})
```

### Stackup Paymaster

```go
paymaster := erc4337.NewStackupPaymaster(erc4337.StackupPaymasterConfig{
    APIKey:       stackupAPIKey,
    ChainID:      chainID,
    PaymasterURL: "https://api.stackup.sh/v1/paymaster/...",
})
```

## Batch Transactions

Execute multiple transactions in a single UserOperation:

```go
callData, _ := safeAccount.EncodeExecuteBatch(
    []common.Address{target1, target2, target3},
    []*big.Int{value1, value2, value3},
    [][]byte{data1, data2, data3},
)
```

## Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [Safe 4337 Module](https://github.com/safe-global/safe-modules)
- [T402 Documentation](https://t402.io/docs)

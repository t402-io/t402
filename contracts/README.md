# T402 Smart Contracts

Solidity smart contracts for the T402 payment protocol.

## Contracts

### T402UptoRouter

Router contract for the `upto` payment scheme. Enables usage-based billing by combining EIP-2612 permit with flexible settlement amounts.

**Features:**
- Execute permit + transfer in single transaction
- Settle any amount up to the permitted maximum
- Facilitator access control
- Gas-efficient implementation

**Security:**
- Contract holds no funds
- Only authorized facilitators can execute transfers
- Settlement amount enforced on-chain (≤ max)

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Setup

```bash
cd contracts

# Install dependencies
forge install foundry-rs/forge-std

# Build
forge build

# Test
forge test

# Test with verbosity
forge test -vvv

# Gas report
forge test --gas-report
```

### Deployment

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export BASE_RPC_URL=https://mainnet.base.org

# Deploy to Base Mainnet
forge script script/Deploy.s.sol:DeployT402UptoRouter \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Deploy to Base Sepolia (testnet)
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export FACILITATOR_ADDRESS=0x...

forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast
```

### Contract Verification

```bash
forge verify-contract \
  --chain-id 8453 \
  --constructor-args $(cast abi-encode "constructor(address)" 0xC88f67e776f16DcFBf42e6bDda1B82604448899B) \
  <DEPLOYED_ADDRESS> \
  src/T402UptoRouter.sol:T402UptoRouter
```

## Contract Addresses

| Chain | Address | Status |
|-------|---------|--------|
| Base Mainnet | TBD | Planned |
| Base Sepolia | TBD | Planned |
| Ethereum | TBD | Planned |
| Arbitrum | TBD | Planned |

## Interface

```solidity
interface IT402UptoRouter {
    function executeUptoTransfer(
        address token,
        address from,
        address to,
        uint256 maxAmount,
        uint256 settleAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function isFacilitator(address facilitator) external view returns (bool);
    function addFacilitator(address facilitator) external;
    function removeFacilitator(address facilitator) external;
}
```

## Security

- Contract is designed to be stateless (no fund storage)
- Only authorized facilitators can execute transfers
- Settlement amount is enforced on-chain
- Permit signatures are verified by the token contract

For security concerns, contact: security@t402.io

## License

Apache 2.0

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

| Chain | Address | Status | Explorer |
|-------|---------|--------|----------|
| Base Mainnet | TBD | Pending Audit | - |
| Base Sepolia | TBD | Ready to Deploy | - |
| Ethereum | TBD | Pending Audit | - |
| Arbitrum | TBD | Pending Audit | - |

### Deployment Priority
1. **Base Sepolia** (testnet) - For integration testing
2. **Base Mainnet** - Primary deployment (lowest gas fees)
3. **Ethereum Mainnet** - Secondary deployment
4. **Arbitrum One** - L2 expansion

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

**Security Audit Status**: Internal review complete. See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for findings.

For security concerns, contact: security@t402.io

## Deployment Checklist

### Pre-Deployment
- [ ] Run full test suite: `forge test -vvv`
- [ ] Run gas report: `forge test --gas-report`
- [ ] Verify constructor arguments
- [ ] Confirm facilitator address is correct
- [ ] Ensure deployer wallet has sufficient funds

### Testnet Deployment (Base Sepolia)
```bash
# 1. Set environment variables
export PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export FACILITATOR_ADDRESS=0xC88f67e776f16DcFBf42e6bDda1B82604448899B

# 2. Simulate deployment (dry run)
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# 3. Deploy with broadcast
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# 4. Verify on block explorer
forge verify-contract \
  --chain-id 84532 \
  --constructor-args $(cast abi-encode "constructor(address)" $FACILITATOR_ADDRESS) \
  <DEPLOYED_ADDRESS> \
  src/T402UptoRouter.sol:T402UptoRouter \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Mainnet Deployment (Base)
```bash
# 1. Set environment variables
export PRIVATE_KEY=0x...  # Use multisig or hardware wallet
export BASE_RPC_URL=https://mainnet.base.org

# 2. Simulate deployment
forge script script/Deploy.s.sol:DeployT402UptoRouter \
  --rpc-url $BASE_RPC_URL

# 3. Deploy with broadcast (requires confirmation)
forge script script/Deploy.s.sol:DeployT402UptoRouter \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# 4. Update this README with deployed address
```

### Post-Deployment
- [ ] Verify contract on block explorer
- [ ] Test `executeUptoTransfer` with small amount
- [ ] Confirm facilitator can execute transfers
- [ ] Update contract addresses in this README
- [ ] Update SDK configuration with new addresses
- [ ] Monitor first few transactions

## License

Apache 2.0

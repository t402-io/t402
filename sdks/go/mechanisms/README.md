# t402 Mechanisms

This directory contains **mechanism implementations** for the t402 protocol.

## What are Mechanisms?

**Mechanisms** are network-specific payment scheme implementations. A mechanism defines how payments are created, verified, and settled for a particular blockchain network and payment scheme.

For example:
- The **exact** scheme on **EVM** networks uses EIP-3009 for USDC transfers
- The **exact** scheme on **SVM** networks uses Solana token transfers

## Directory Structure

Mechanisms are organized by network type and scheme:

```
mechanisms/
├── evm/                    - Ethereum Virtual Machine networks
│   └── exact/              - Exact payment scheme for EVM
│       ├── client/         - Client-side: create payments
│       ├── server/         - Server-side: verify payments
│       └── facilitator/    - Facilitator-side: settle payments
│
└── svm/                    - Solana Virtual Machine networks
    └── exact/              - Exact payment scheme for SVM
        ├── client/         - Client-side: create payments
        ├── server/         - Server-side: verify payments
        └── facilitator/    - Facilitator-side: settle payments
```

## Mechanism Roles

Each mechanism has three role-specific implementations:

### Client Mechanisms

Create payment payloads that clients sign and send to servers.

- **Location**: `mechanisms/{network}/exact/client/`
- **Used by**: Applications making paid requests
- **Responsibilities**: Generate payment payloads with signatures

### Server Mechanisms

Verify payment requirements and validate payments (via facilitator).

- **Location**: `mechanisms/{network}/exact/server/`
- **Used by**: Services accepting payments
- **Responsibilities**: Build payment requirements, parse prices

### Facilitator Mechanisms

Verify signatures and settle payments on-chain.

- **Location**: `mechanisms/{network}/exact/facilitator/`
- **Used by**: Payment processing services
- **Responsibilities**: Verify signatures, submit blockchain transactions

## Mechanism Maturity Levels

### Production — Full implementation + comprehensive tests

| Network | Schemes | Files | Notes |
|---------|---------|-------|-------|
| **EVM** | exact, upto, permit2-proxy, exact-direct, exact-legacy | 24+ | EIP-3009, EIP-2612, Permit2 |
| **SVM** | exact | 11+ | Solana token program transfers |

### Beta — Implementation exists, limited production testing

| Network | Schemes | Files | Notes |
|---------|---------|-------|-------|
| **TON** | exact, upto | 7+ | Jetton transfers, wallet seqno |
| **Tron** | exact | 7+ | TRC20 signed transactions |
| **BTC** | exact, lightning | 6+ | PSBT + Lightning BOLT11 |
| **Stellar** | exact | 6+ | Soroban XDR transactions |

### Alpha — Implementation exists but minimal testing

| Network | Schemes | Notes |
|---------|---------|-------|
| **Cosmos** | exact | IBC token transfers |
| **NEAR** | exact | NEP-141 fungible tokens |
| **Polkadot** | exact | Substrate asset transfers |
| **Stacks** | exact | SIP-010 tokens |
| **Tezos** | exact | FA2 tokens |
| **Aptos** | exact | Move coin transfers |

### Experimental — Types only, no logic (skeleton)

| Network | Status |
|---------|--------|
| **Algorand** | Types + constants defined only |
| **Hedera** | Types + constants defined only |
| **Sui** | Types + constants defined only |

### Cross-cutting

| Mechanism | Description |
|-----------|-------------|
| **Upto** | Generic upto scheme (network-agnostic parts) |
| **Spark** | Spark mechanism (TS only, Py + Java missing) |

See [SECURITY.md](SECURITY.md) for replay protection details per mechanism.

## Contributing New Mechanisms

We welcome contributions of new payment schemes and network implementations!

### Guidelines for New Mechanisms

When implementing a new mechanism:

1. **Follow the three-role pattern**: Implement `client/`, `server/`, and `facilitator/` packages
2. **Use the existing structure**: Place under `mechanisms/{network}/{scheme}/`
3. **Implement required interfaces**: Match the interfaces defined in the core package
4. **Include tests**: Comprehensive unit and integration tests
5. **Document thoroughly**: Add README explaining the mechanism
6. **Follow conventions**: Use consistent naming and patterns

### Contribution Process

1. Open an issue describing the mechanism
2. Discuss the implementation approach
3. Submit a PR with:
   - Mechanism implementation (client, server, facilitator)
   - Tests
   - README documentation
   - Example usage

### Questions?

For questions about contributing mechanisms, please:
- Open a GitHub issue
- Reference existing mechanisms (EVM, SVM) as examples
- See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general guidelines

## Mechanism Documentation

- **[EVM Mechanisms](evm/README.md)** - Ethereum Virtual Machine payment schemes
- **[SVM Mechanisms](svm/README.md)** - Solana Virtual Machine payment schemes


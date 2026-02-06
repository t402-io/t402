# t402 Go Package

Go implementation of the t402 protocol - a standard for HTTP 402 Payment Required responses with cryptocurrency micropayments.

## What is t402?

t402 is a protocol that enables HTTP resources to require cryptocurrency payments. When a client requests a paid resource, the server responds with `402 Payment Required` along with payment details. The client creates a payment, retries the request, and receives the resource after successful payment verification and settlement.

## Installation

```bash
go get github.com/t402-io/t402/sdks/go@v1.8.1
```

## What This Package Exports

This package provides modules to support the t402 protocol in Go applications.

### Core Classes

The package exports three core types that can be used by clients, servers, and facilitators:

- **`t402.T402Client`** - Creates payment payloads for clients making paid requests
- **`t402.T402ResourceServer`** - Verifies payments and builds requirements for servers accepting payments
- **`t402.T402Facilitator`** - Verifies and settles payments for facilitator services

These core classes are **framework-agnostic** and can be used in any context (HTTP, gRPC, WebSockets, CLI tools, etc.).

### HTTP Transport Wrappers

The package exports HTTP-specific wrappers around the core classes:

- **`t402http.HTTPClient`** - Wraps `http.Client` with automatic payment handling for clients
- **`t402http.HTTPServer`** - Integrates resource server with HTTP request processing
- **`t402http.HTTPFacilitatorClient`** - HTTP client for calling facilitator endpoints

These wrappers handle HTTP-specific concerns like headers, status codes, and request/response serialization.

### Middleware for Servers

Framework-specific middleware packages for easy server integration:

- **`http/gin`** - Gin framework middleware

Additional framework middleware can be built using the HTTP transport wrappers as a foundation.

### Client Helper Packages

Helper packages to simplify client implementation:

- **`signers/evm`** - EVM signer helpers (creates signers from private keys)
- **`signers/svm`** - SVM signer helpers (creates signers from private keys)

These eliminate 95-99% of boilerplate code for creating signers.

### Mechanism Implementations (Schemes)

Payment scheme implementations that can be registered by clients, servers, and facilitators:

- **`mechanisms/evm/exact`** - Ethereum/Base exact payment using EIP-3009
  - `client/` - Client-side payment creation
  - `server/` - Server-side payment verification
  - `facilitator/` - Facilitator-side payment settlement

- **`mechanisms/svm/exact`** - Solana exact payment using token transfers
  - `client/` - Client-side payment creation
  - `server/` - Server-side payment verification
  - `facilitator/` - Facilitator-side payment settlement

- **`mechanisms/ton/exact`** - TON exact payment using Jetton transfers (USDT)
  - `client/` - Client-side payment creation
  - `server/` - Server-side payment verification
  - `facilitator/` - Facilitator-side payment settlement

Each role (client, server, facilitator) has its own mechanism implementation with appropriate functionality for that role.

### Extensions

Protocol extension implementations:

- **`extensions/bazaar`** - API discovery extension for making resources discoverable

## Architecture

The package is designed with extreme modularity:

### Layered Design

```
┌─────────────────────────────────────────┐
│         Your Application                │
└─────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
  [Client]   [Server]  [Facilitator]
       │          │          │
       ▼          ▼          ▼
┌─────────────────────────────────────────┐
│      HTTP Layer (Optional)              │
│  - HTTPClient wrapper                   │
│  - HTTPResourceServer                   │
│  - Middleware (Gin, etc.)               │
└─────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
┌─────────────────────────────────────────┐
│    Core Classes (Framework-Agnostic)    │
│  - T402Client                           │
│  - T402ResourceServer                   │
│  - T402Facilitator                      │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Mechanisms (Pluggable)          │
│  - EVM exact (client/server/facil.)    │
│  - SVM exact (client/server/facil.)    │
│  - TON exact (client/server/facil.)    │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Signers (Helpers)               │
│  - EVM client signers                   │
│  - SVM client signers                   │
└─────────────────────────────────────────┘
```

### Key Design Principles

1. **Framework-Agnostic Core** - The core client/server/facilitator classes work independently of HTTP or any web framework

2. **HTTP as a Layer** - HTTP functionality is isolated in the `http` package, making the core reusable for other transports

3. **Pluggable Mechanisms** - Payment schemes are modular and can be registered independently by clients, servers, and facilitators

4. **Middleware Wraps Core** - Framework middleware (like Gin) internally uses the core primitives, keeping framework concerns separate

This architecture enables:
- Using core classes in non-HTTP contexts (gRPC, WebSockets, message queues)
- Building custom middleware for any framework
- Registering different mechanisms for different roles
- Mixing and matching components as needed

## Documentation by Role

This package serves three distinct roles. Choose the documentation for what you're building:

### 🔵 **[CLIENT.md](CLIENT.md)** - Building Payment-Enabled Clients

For applications that make requests to payment-protected resources.

**Topics covered:**
- Creating payment-enabled HTTP clients
- Registering payment mechanisms
- Using signer helpers
- Lifecycle hooks and error handling
- Advanced patterns (concurrency, retry logic, custom transports)

**See also:** [`examples/go/clients/`](../examples/go/clients/)

### 🟢 **[SERVER.md](SERVER.md)** - Building Payment-Accepting Servers

For services that protect resources with payment requirements.

**Topics covered:**
- Protecting HTTP endpoints with payments
- Route configuration and pattern matching
- Using middleware (Gin and custom implementations)
- Dynamic pricing and dynamic payment routing
- Verification and settlement handling
- Extensions (Bazaar discovery)

**See also:** [`examples/go/servers/`](../examples/go/servers/)

### 🟡 **[FACILITATOR.md](FACILITATOR.md)** - Building Payment Facilitators

For payment processing services that verify and settle payments.

**Topics covered:**
- Payment signature verification
- On-chain settlement
- Lifecycle hooks for logging and metrics
- Blockchain interaction
- Production deployment considerations
- Monitoring and alerting

**See also:** [`examples/go/facilitator/`](../examples/go/facilitator/), [`e2e/facilitators/go/`](../e2e/facilitators/go/)

## Package Structure

```
github.com/t402-io/t402/sdks/go
│
├── Core (framework-agnostic)
│   ├── client.go              - t402.T402Client
│   ├── server.go              - t402.T402ResourceServer
│   ├── facilitator.go         - t402.T402Facilitator
│   ├── types.go               - Core types
│   └── *_hooks.go             - Lifecycle hooks
│
├── http/                      - HTTP transport layer
│   ├── http.go                - Type aliases and convenience functions
│   ├── client.go              - HTTP client wrapper
│   ├── server.go              - HTTP server integration
│   ├── facilitator_client.go  - Facilitator HTTP client
│   └── gin/                   - Gin middleware
│
├── mechanisms/                - Payment schemes
│   ├── evm/exact/
│   │   ├── client/            - EVM client mechanism
│   │   ├── server/            - EVM server mechanism
│   │   └── facilitator/       - EVM facilitator mechanism
│   ├── svm/exact/
│   │   ├── client/            - SVM client mechanism
│   │   ├── server/            - SVM server mechanism
│   │   └── facilitator/       - SVM facilitator mechanism
│   └── ton/exact/
│       ├── client/            - TON client mechanism
│       ├── server/            - TON server mechanism
│       └── facilitator/       - TON facilitator mechanism
│
├── signers/                   - Signer helpers
│   ├── evm/                   - EVM client signers
│   └── svm/                   - SVM client signers
│
├── extensions/                - Protocol extensions
│   └── bazaar/                - API discovery
│
└── types/                     - Type definitions
    ├── v1.go                  - V1 protocol types
    ├── v2.go                  - V2 protocol types
    ├── helpers.go             - Version detection utilities
    ├── raw.go                 - Raw type handling
    └── extensions.go          - Extension type definitions
```

## Supported Networks

### EVM (Ethereum Virtual Machine)

All EVM-compatible chains using CAIP-2 identifiers:
- Ethereum Mainnet (`eip155:1`)
- Base Mainnet (`eip155:8453`)
- Base Sepolia (`eip155:84532`)
- Optimism, Arbitrum, Polygon, and more

Use `eip155:*` wildcard to support all EVM chains.

### SVM (Solana Virtual Machine)

All Solana networks using CAIP-2 identifiers:
- Solana Mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)
- Solana Testnet (`solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`)

Use `solana:*` wildcard to support all Solana networks.

### TON (The Open Network)

TON networks using CAIP-2 identifiers:
- TON Mainnet (`ton:mainnet`)
- TON Testnet (`ton:testnet`)

Use `ton:*` wildcard to support all TON networks.

## Supported Schemes

### Exact Payment

Transfer an exact amount to access a resource:
- **EVM**: Uses EIP-3009 `transferWithAuthorization` (USDC compatible tokens)
- **SVM**: Uses Solana token transfers (USDC SPL token)
- **TON**: Uses Jetton transfers (USDT)

## Features

- ✅ Protocol v2 with v1 backward compatibility
- ✅ Multi-chain support (EVM and SVM)
- ✅ Modular architecture - use core primitives directly or with helpers
- ✅ Type safe with strong typing throughout
- ✅ Framework agnostic core
- ✅ Concurrent safe operations
- ✅ Context-aware with proper cancellation support
- ✅ Extensible plugin architecture
- ✅ Production ready with comprehensive testing
- ✅ Lifecycle hooks for customization

## Package Documentation

### Core Documentation
- **[CLIENT.md](CLIENT.md)** - Building payment-enabled clients
- **[SERVER.md](SERVER.md)** - Building payment-accepting servers
- **[FACILITATOR.md](FACILITATOR.md)** - Building payment facilitators

### Component Documentation
- **[signers/](signers/README.md)** - Signer helper utilities
- **[mechanisms/evm/](mechanisms/evm/)** - EVM payment mechanisms
- **[mechanisms/svm/](mechanisms/svm/)** - SVM (Solana) payment mechanisms
- **[mechanisms/ton/](mechanisms/ton/)** - TON payment mechanisms
- **[mechanisms/tron/](mechanisms/tron/)** - TRON payment mechanisms
- **[mechanisms/near/](mechanisms/near/)** - NEAR payment mechanisms
- **[mechanisms/aptos/](mechanisms/aptos/)** - Aptos payment mechanisms
- **[mechanisms/tezos/](mechanisms/tezos/)** - Tezos payment mechanisms
- **[mechanisms/polkadot/](mechanisms/polkadot/)** - Polkadot Asset Hub mechanisms
- **[mechanisms/stacks/](mechanisms/stacks/)** - Stacks payment mechanisms
- **[mechanisms/cosmos/](mechanisms/cosmos/)** - Cosmos (Noble) payment mechanisms
- **[extensions/](extensions/)** - Protocol extensions

### Examples
- **[examples/go/clients/](../examples/go/clients/)** - Client implementation examples
- **[examples/go/servers/](../examples/go/servers/)** - Server implementation examples
- **[examples/go/facilitator/](../examples/go/facilitator/)** - Facilitator example

## Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run integration tests
go test ./test/integration/...
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

Apache 2.0 - See [LICENSE](../LICENSE) for details.

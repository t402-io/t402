# T402 TypeScript Examples

This directory contains a collection of TypeScript examples demonstrating how to use the T402 protocol in various contexts. These examples are designed to work with the T402 npm packages and share a workspace with the main T402 packages.

## Setup

Before running any examples, you need to install dependencies and build the packages:

```bash
# From the examples/typescript directory
pnpm install
pnpm build
```

## Example Structure

The examples are organized into several categories:

### Clients

Examples of different client implementations for interacting with T402 services:

- `clients/axios/` - Axios client with t402 payment interceptor from `@t402/axios`.
- `clients/fetch/` - Client using the `@t402/fetch` wrapper around the native fetch API.
- `clients/advanced/` - Advanced client patterns (retry, multi-chain selection).
- `clients/custom/` - Custom client implementation without framework wrappers.
- `clients/bridge/` - Cross-chain bridge payment client using `@t402/evm`.
- `clients/erc4337/` - Gasless ERC-4337 payment client.
- `clients/ton/` - TON Jetton payment client.
- `clients/tron/` - TRON TRC-20 payment client.
- `clients/mcp/` - MCP chatbot client for AI agent payments.

### MCP

- `mcp/` - MCP server that makes paid API requests via `@t402/axios` (Claude Desktop compatible).

### Facilitator

- `facilitator/` - Example implementation of a t402 payment facilitator exposing `/verify` and `/settle`.

### Fullstack

- `fullstack/next/` - Next.js app demonstrating route protection with `@t402/next` middleware.

### Servers

Examples of different server implementations:

- `servers/express/` - Express.js server using `@t402/express` middleware.
- `servers/hono/` - Hono server using `@t402/hono` middleware.
- `servers/advanced/` - Express server without middleware: delayed settlement, dynamic pricing, multiple requirements.
- `servers/custom/` - Custom server implementation with manual header handling.
- `servers/ton/` - TON payment server using `@t402/express` with TON mechanism.
- `servers/tron/` - TRON payment server using `@t402/express` with TRON mechanism.

### WDK Examples

- `wdk-gasless/` - Gasless ERC-4337 payment using `@t402/wdk-gasless`.
- `wdk-bridge/` - Cross-chain bridging with `@t402/wdk-bridge`.
- `wdk-multisig/` - Multi-sig wallet payment with `@t402/wdk-multisig`.
- `wdk-permit2/` - Uniswap Permit2 gasless token approvals with `@t402/evm`.
- `wdk-upto/` - Usage-based (upto) payments with permit scheme.

## Running Examples

Each example directory contains its own README with specific instructions for running that example. Navigate to the desired example directory and follow its instructions.

## Development

This workspace uses:

- pnpm for package management
- Turborepo for monorepo management
- TypeScript for type safety

The examples are designed to work with the main T402 packages, so they must be built before running any examples.

## A note on private keys

The examples in this folder commonly use private keys to sign messages. **Never put a private key with mainnet funds in a `.env` file**. This can result in keys getting checked into codebases and being drained.

There are many ways to generate a keypair to use exclusively for development, one way is via foundry:

```
# install foundry
curl -L https://foundry.paradigm.xyz | bash

# generate a new wallet
cast w new
```

You can fund your new wallet on most networks via testnet faucets for the network you're using (e.g., Base Sepolia, Arbitrum Sepolia).

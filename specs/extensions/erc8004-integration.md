# Extension: ERC-8004 (Trustless Agents) Integration

## Summary

The `@t402/erc8004` package integrates the [ERC-8004 Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004) specification with t402, providing on-chain agent identity verification, reputation-aware payment decisions, and post-payment validation. ERC-8004 defines three singleton registries (Identity, Reputation, Validation) deployed per-chain. Its registration file explicitly includes `x402Support` and the off-chain feedback structure includes `proofOfPayment` fields designed for t402.

This document covers the full design for `@t402/erc8004`: types, architecture, module design, integration points, and phased implementation plan.

## Extension Key

```
erc8004
```

## 1. ERC-8004 Specification Summary

### 1.1 Identity Registry (ERC-721)

Each agent registers as an NFT with:
- `agentId` (uint256 tokenId, auto-incremented)
- `agentURI` (points to registration file)
- `agentWallet` (verified via EIP-712/ERC-1271 signature)
- Arbitrary metadata key-value pairs

Key functions:
```solidity
register(string agentURI, MetadataEntry[] metadata) → uint256 agentId
setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)
getAgentWallet(uint256 agentId) → address
getMetadata(uint256 agentId, string metadataKey) → bytes
```

### 1.2 Reputation Registry

Permissionless feedback with fixed-point ratings:
- `value` (int128) + `valueDecimals` (uint8, 0-18)
- Composable tags: `tag1`, `tag2` (string)
- Off-chain `feedbackURI` with `proofOfPayment`
- Sybil-resistant: queries require explicit `clientAddresses` filter

Key functions:
```solidity
giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals,
  string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)
getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)
  → (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
```

### 1.3 Validation Registry

Generic hook system for independent agent work verification:
```solidity
validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)
validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)
// response: 0 = failed, 100 = passed, 1-99 = spectrum
```

### 1.4 Registration File Schema

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Agent Name",
  "description": "What the agent does",
  "image": "https://example.com/avatar.png",
  "services": [
    { "name": "A2A", "endpoint": "https://agent.example.com/a2a" },
    { "name": "MCP", "endpoint": "https://agent.example.com/mcp" },
    { "name": "web", "endpoint": "https://agent.example.com/api" }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    { "agentId": 42, "agentRegistry": "eip155:8453:0x..." }
  ],
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

### 1.5 Off-Chain Feedback File

```json
{
  "agentRegistry": "eip155:8453:0x...",
  "agentId": 42,
  "clientAddress": "eip155:8453:0x...",
  "createdAt": "2026-02-22T10:00:00Z",
  "value": 95,
  "valueDecimals": 0,
  "tag1": "paymentSuccess",
  "tag2": "responseTime",
  "proofOfPayment": {
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "chainId": "eip155:8453",
    "txHash": "0x..."
  }
}
```

## 2. Package Architecture

### 2.1 Package Structure

```
sdks/typescript/packages/erc8004/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── src/
    ├── index.ts           # Public API re-exports
    ├── types.ts            # ERC-8004 type definitions + Zod schemas
    ├── abis.ts             # Contract ABIs (Identity, Reputation, Validation)
    ├── identity.ts         # Identity Registry client
    ├── reputation.ts       # Reputation Registry client
    ├── validation.ts       # Validation Registry client
    ├── extension.ts        # t402 extension (PaymentRequired/PaymentPayload)
    ├── hooks.ts            # Facilitator lifecycle hooks
    ├── constants.ts        # Registry addresses, EIP-712 domain, tag constants
    └── __tests__/
        ├── types.test.ts
        ├── identity.test.ts
        ├── reputation.test.ts
        ├── validation.test.ts
        ├── extension.test.ts
        └── hooks.test.ts
```

### 2.2 Package Configuration

This is a **standalone package** (`@t402/erc8004`), not a sub-module of `@t402/extensions`. Rationale:
- ERC-8004 brings on-chain contract interactions (a heavier concern than pure protocol extensions)
- It spans identity, reputation, and validation -- three distinct registries
- It requires viem as a peer dependency for contract reads/writes
- Keeping it separate avoids bloating `@t402/extensions` with contract ABIs

```json
{
  "name": "@t402/erc8004",
  "version": "0.1.0",
  "description": "ERC-8004 Trustless Agents integration for t402",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/cjs/index.d.ts",
  "dependencies": {
    "@t402/core": "workspace:*",
    "@t402/evm-core": "workspace:*"
  },
  "peerDependencies": {
    "viem": "^2.0.0"
  },
  "exports": {
    ".": { "import": "...", "require": "..." },
    "./identity": { "import": "...", "require": "..." },
    "./reputation": { "import": "...", "require": "..." },
    "./validation": { "import": "...", "require": "..." },
    "./hooks": { "import": "...", "require": "..." },
    "./extension": { "import": "...", "require": "..." }
  }
}
```

Build uses dual `outDir: "dist/esm"` + `outDir: "dist/cjs"` per t402 convention.

### 2.3 Dependency Graph

```
@t402/core
    ↓
@t402/evm-core  (Address, Hex, Bytes32 primitives — zero viem dep)
    ↓
@t402/erc8004   (viem as peer dep for contract interaction)
    ↓
Used by: @t402/express, @t402/hono, @t402/fastify, @t402/next  (via hooks)
         @t402/a2a  (via identity verification)
         @t402/mcp  (via agent resolution tools)
         @t402/paywall  (via reputation display)
```

### 2.4 Contract Interaction Approach: viem

**Decision:** Use viem (as an optional peer dependency), consistent with `@t402/evm-core` and `@t402/evm`.

**Rationale:**
- `@t402/evm-core` already defines `FacilitatorEvmSigner` and `ClientEvmSigner` interfaces that are viem-compatible but don't require it
- The package will define its own minimal interface (`ERC8004Client`) that mirrors the viem `PublicClient.readContract` API, making it structurally compatible without a hard dependency
- For write operations (feedback submission, validation requests), use the `FacilitatorEvmSigner.writeContract` interface from `@t402/evm-core`

## 3. Module Designs

### 3.1 types.ts — Type Definitions

```typescript
import type { Address, Hex, Bytes32 } from "@t402/evm-core";
import type { Network } from "@t402/core/types";

// ============================================================================
// Agent Identifier
// ============================================================================

/** ERC-8004 agent registry identifier: {namespace}:{chainId}:{contractAddress} */
export type AgentRegistryId = `${string}:${string}:${string}`;

/** Parsed agent registry identifier */
export interface AgentRegistry {
  namespace: string;
  chainId: string;
  address: Address;
  /** Full registry string */
  id: AgentRegistryId;
}

/** Metadata entry for agent registration */
export interface MetadataEntry {
  metadataKey: string;
  metadataValue: Hex;
}

// ============================================================================
// Identity Types
// ============================================================================

/** On-chain agent identity from Identity Registry */
export interface AgentIdentity {
  agentId: bigint;
  owner: Address;
  agentURI: string;
  agentWallet: Address;
  registry: AgentRegistry;
}

/** Resolved agent = on-chain identity + fetched registration file */
export interface ResolvedAgent extends AgentIdentity {
  registration: RegistrationFile;
}

/** ERC-8004 Registration File (off-chain JSON at agentURI) */
export interface RegistrationFile {
  type: string;
  name: string;
  description?: string;
  image?: string;
  services: ServiceEntry[];
  x402Support: boolean;
  active: boolean;
  registrations: RegistrationEntry[];
  supportedTrust?: string[];
}

export interface ServiceEntry {
  name: string;
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
}

export interface RegistrationEntry {
  agentId: number;
  agentRegistry: AgentRegistryId;
}

// ============================================================================
// Reputation Types
// ============================================================================

/** On-chain feedback record */
export interface FeedbackRecord {
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
  feedbackIndex: bigint;
  clientAddress: Address;
}

/** Aggregated reputation summary */
export interface ReputationSummary {
  agentId: bigint;
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
  /** Normalized 0-100 score derived from summaryValue/summaryValueDecimals */
  normalizedScore: number;
}

/** Parameters for submitting feedback */
export interface FeedbackParams {
  agentId: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: Bytes32;
}

/** Off-chain feedback file structure */
export interface FeedbackFile {
  agentRegistry: AgentRegistryId;
  agentId: number;
  clientAddress: string;
  createdAt: string;
  value: number;
  valueDecimals: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  proofOfPayment?: ProofOfPayment;
}

export interface ProofOfPayment {
  fromAddress: string;
  toAddress: string;
  chainId: string;
  txHash: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/** Validation request parameters */
export interface ValidationRequestParams {
  validatorAddress: Address;
  agentId: bigint;
  requestURI: string;
  requestHash: Bytes32;
}

/** Validation response */
export interface ValidationStatus {
  validatorAddress: Address;
  agentId: bigint;
  response: number; // 0-100
  responseHash: Bytes32;
  tag: string;
  lastUpdate: bigint;
}

/** Validation summary */
export interface ValidationSummary {
  count: bigint;
  averageResponse: number; // 0-100
}

// ============================================================================
// Extension Types
// ============================================================================

/** ERC-8004 extension data in PaymentRequired.extensions */
export interface ERC8004Extension {
  /** Agent's ERC-8004 identity */
  agentId: number;
  /** Registry identifier: {namespace}:{chainId}:{address} */
  agentRegistry: AgentRegistryId;
  /** Agent's verified wallet (should match payTo) */
  agentWallet?: string;
  /** Reputation score (0-100, from trusted reviewers) */
  reputationScore?: number;
  /** Number of feedback records */
  feedbackCount?: number;
  /** Validation status (0-100 average) */
  validationScore?: number;
}

/** ERC-8004 extension data echoed in PaymentPayload.extensions */
export interface ERC8004PayloadExtension {
  /** Whether client verified the agent identity */
  identityVerified: boolean;
  /** Agent ID that was verified */
  agentId: number;
  /** Registry used for verification */
  agentRegistry: AgentRegistryId;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Minimal read-only client interface for ERC-8004 registry interactions */
export interface ERC8004ReadClient {
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

/** Write-capable client for submitting feedback and validation */
export interface ERC8004WriteClient extends ERC8004ReadClient {
  writeContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<Hex>;
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: string }>;
}

/** Configuration for ERC-8004 integration */
export interface ERC8004Config {
  /** Network for registry interactions (CAIP-2) */
  network: Network;
  /** Identity Registry contract address */
  identityRegistry: Address;
  /** Reputation Registry contract address */
  reputationRegistry?: Address;
  /** Validation Registry contract address */
  validationRegistry?: Address;
  /** Client for reading registry state */
  client: ERC8004ReadClient;
  /** Client for writing to registries (optional, needed for feedback/validation) */
  writeClient?: ERC8004WriteClient;
}

/** Reputation check configuration */
export interface ReputationCheckConfig {
  /** Minimum normalized score (0-100) required to proceed */
  minScore: number;
  /** Addresses whose feedback is trusted for Sybil-resistance */
  trustedReviewers: Address[];
  /** Tags to filter on (optional) */
  tag1?: string;
  tag2?: string;
  /** Action on score below threshold: "reject" | "warn" */
  onBelowThreshold?: "reject" | "warn";
}

/** Feedback submission configuration */
export interface FeedbackSubmissionConfig {
  /** Default tag1 for payment-related feedback */
  tag1?: string;
  /** Default tag2 for additional classification */
  tag2?: string;
  /** Whether to include proofOfPayment from SettleResponse */
  includeProofOfPayment?: boolean;
  /** Base URI for hosting feedback files (optional, for off-chain data) */
  feedbackBaseURI?: string;
}
```

### 3.2 abis.ts — Contract ABIs

Contains the minimal ABI definitions needed for contract interaction. These are derived directly from the ERC-8004 Solidity interfaces:

```typescript
export const identityRegistryAbi = [
  // register(string agentURI, MetadataEntry[] metadata) → uint256
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "metadata", type: "tuple[]", components: [
        { name: "metadataKey", type: "string" },
        { name: "metadataValue", type: "bytes" },
      ]},
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  // getAgentWallet(uint256 agentId) → address
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  // tokenURI(uint256 tokenId) → string (ERC-721)
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  // ownerOf(uint256 tokenId) → address (ERC-721)
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  // getMetadata(uint256 agentId, string metadataKey) → bytes
  {
    type: "function",
    name: "getMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ type: "bytes" }],
    stateMutability: "view",
  },
  // setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)
  {
    type: "function",
    name: "setAgentWallet",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Events
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export const reputationRegistryAbi = [
  // giveFeedback(...)
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "summaryValue", type: "int128" },
      { name: "summaryValueDecimals", type: "uint8" },
    ],
    stateMutability: "view",
  },
  // revokeFeedback(uint256 agentId, uint64 feedbackIndex)
  {
    type: "function",
    name: "revokeFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // getClients(uint256 agentId) → address[]
  {
    type: "function",
    name: "getClients",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "indexedTag1", type: "string", indexed: true },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const validationRegistryAbi = [
  // validationRequest(...)
  {
    type: "function",
    name: "validationRequest",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // validationResponse(...)
  {
    type: "function",
    name: "validationResponse",
    inputs: [
      { name: "requestHash", type: "bytes32" },
      { name: "response", type: "uint8" },
      { name: "responseURI", type: "string" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // getValidationStatus(bytes32 requestHash)
  {
    type: "function",
    name: "getValidationStatus",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ],
    stateMutability: "view",
  },
  // getSummary(uint256 agentId, address[] validatorAddresses, string tag)
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "validatorAddresses", type: "address[]" },
      { name: "tag", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "averageResponse", type: "uint8" },
    ],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "ValidationRequest",
    inputs: [
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "requestURI", type: "string", indexed: false },
      { name: "requestHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ValidationResponse",
    inputs: [
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "requestHash", type: "bytes32", indexed: true },
      { name: "response", type: "uint8", indexed: false },
      { name: "responseURI", type: "string", indexed: false },
      { name: "responseHash", type: "bytes32", indexed: false },
      { name: "tag", type: "string", indexed: false },
    ],
  },
] as const;
```

### 3.3 constants.ts — Registry Addresses and Tags

```typescript
import type { Address, Network } from "@t402/evm-core";

/**
 * Known Identity Registry addresses per network.
 * Populated as ERC-8004 deploys to each chain.
 * Empty until mainnet deployments exist (spec is in Draft status).
 */
export const IDENTITY_REGISTRIES: Partial<Record<Network, Address>> = {
  // Populated after deployment. Example:
  // "eip155:8453": "0x...",
  // "eip155:1": "0x...",
};

export const REPUTATION_REGISTRIES: Partial<Record<Network, Address>> = {};

export const VALIDATION_REGISTRIES: Partial<Record<Network, Address>> = {};

/** Extension key for t402 PaymentRequired/PaymentPayload.extensions */
export const ERC8004_EXTENSION_KEY = "erc8004";

/** Standard feedback tags for t402 payment interactions */
export const FEEDBACK_TAGS = {
  /** tag1: Payment completed successfully */
  PAYMENT_SUCCESS: "paymentSuccess",
  /** tag1: Payment verification failed */
  PAYMENT_FAILED: "paymentFailed",
  /** tag1: Service quality rating */
  SERVICE_QUALITY: "starred",
  /** tag2: Response time measurement */
  RESPONSE_TIME: "responseTime",
  /** tag2: Uptime measurement */
  UPTIME: "uptime",
} as const;

/** EIP-712 domain for setAgentWallet signature verification */
export const IDENTITY_REGISTRY_DOMAIN = {
  name: "IdentityRegistry",
  version: "1",
} as const;

/** EIP-712 typed data for setAgentWallet */
export const SET_AGENT_WALLET_TYPES = {
  SetAgentWallet: [
    { name: "agentId", type: "uint256" },
    { name: "newWallet", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;
```

### 3.4 identity.ts — Identity Registry Client

```typescript
import type { Address, Hex } from "@t402/evm-core";
import type {
  AgentIdentity,
  AgentRegistry,
  AgentRegistryId,
  ERC8004ReadClient,
  ResolvedAgent,
  RegistrationFile,
} from "./types";
import { identityRegistryAbi } from "./abis";

/**
 * Parse an agent registry ID string into components.
 *
 * @param registryId - Format: "{namespace}:{chainId}:{address}"
 * @returns Parsed AgentRegistry
 *
 * @example
 * parseAgentRegistry("eip155:8453:0x742d35Cc...")
 * // => { namespace: "eip155", chainId: "8453", address: "0x742d35Cc...", id: "eip155:8453:0x742d35Cc..." }
 */
export function parseAgentRegistry(registryId: AgentRegistryId): AgentRegistry {
  const parts = registryId.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid agent registry ID: ${registryId}. Expected format: namespace:chainId:address`);
  }
  return {
    namespace: parts[0],
    chainId: parts[1],
    address: parts[2] as Address,
    id: registryId,
  };
}

/**
 * Resolve an agent's on-chain identity from the Identity Registry.
 *
 * Reads agentWallet, owner, and tokenURI from the contract.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param registryId - Full agent registry identifier
 * @returns Agent identity with wallet, owner, and URI
 */
export async function getAgentIdentity(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  registryId: AgentRegistryId,
): Promise<AgentIdentity> {
  const [agentWallet, owner, agentURI] = await Promise.all([
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "getAgentWallet",
      args: [agentId],
    }) as Promise<Address>,
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [agentId],
    }) as Promise<Address>,
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "tokenURI",
      args: [agentId],
    }) as Promise<string>,
  ]);

  return {
    agentId,
    owner,
    agentURI,
    agentWallet,
    registry: parseAgentRegistry(registryId),
  };
}

/**
 * Fetch and parse the agent's registration file from their agentURI.
 *
 * @param agentURI - URI pointing to the registration JSON file
 * @returns Parsed registration file
 * @throws If the URI is not reachable or the file is malformed
 */
export async function fetchRegistrationFile(agentURI: string): Promise<RegistrationFile> {
  const response = await fetch(agentURI);
  if (!response.ok) {
    throw new Error(`Failed to fetch registration file from ${agentURI}: ${response.status}`);
  }
  return response.json() as Promise<RegistrationFile>;
}

/**
 * Resolve an agent: fetch on-chain identity + off-chain registration file.
 *
 * This is the primary entry point for identity resolution.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param registryId - Full agent registry identifier
 * @returns Fully resolved agent with registration file
 *
 * @example
 * const agent = await resolveAgent(viemClient, registryAddr, 42n, "eip155:8453:0x...");
 * if (agent.agentWallet !== paymentRequirements.payTo) {
 *   throw new Error("Payment address mismatch");
 * }
 */
export async function resolveAgent(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  registryId: AgentRegistryId,
): Promise<ResolvedAgent> {
  const identity = await getAgentIdentity(client, identityRegistry, agentId, registryId);
  const registration = await fetchRegistrationFile(identity.agentURI);

  return {
    ...identity,
    registration,
  };
}

/**
 * Verify that a payTo address matches the on-chain agentWallet.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param payTo - Address from PaymentRequirements.payTo
 * @returns Whether the payTo address matches the on-chain agentWallet
 */
export async function verifyPayToMatchesAgent(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  payTo: string,
): Promise<boolean> {
  const agentWallet = await client.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: "getAgentWallet",
    args: [agentId],
  }) as Address;

  return agentWallet.toLowerCase() === payTo.toLowerCase();
}
```

### 3.5 reputation.ts — Reputation Registry Client

```typescript
import type { Address, Hex, Bytes32 } from "@t402/evm-core";
import type {
  ERC8004ReadClient,
  ERC8004WriteClient,
  FeedbackParams,
  FeedbackRecord,
  ReputationSummary,
} from "./types";
import { reputationRegistryAbi } from "./abis";

/**
 * Get a reputation summary for an agent from trusted reviewers.
 *
 * @param client - Read-only client
 * @param reputationRegistry - Reputation Registry contract address
 * @param agentId - Agent's ID
 * @param trustedReviewers - Addresses whose feedback is trusted (Sybil filter)
 * @param tag1 - Optional primary tag filter
 * @param tag2 - Optional secondary tag filter
 * @returns Reputation summary with normalized 0-100 score
 */
export async function getReputationSummary(
  client: ERC8004ReadClient,
  reputationRegistry: Address,
  agentId: bigint,
  trustedReviewers: Address[],
  tag1: string = "",
  tag2: string = "",
): Promise<ReputationSummary> {
  const result = await client.readContract({
    address: reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, trustedReviewers, tag1, tag2],
  }) as [bigint, bigint, number];

  const [count, summaryValue, summaryValueDecimals] = result;

  // Normalize to 0-100 scale
  const divisor = 10 ** summaryValueDecimals;
  const normalizedScore = count > 0n
    ? Math.min(100, Math.max(0, Number(summaryValue) / divisor))
    : 0;

  return {
    agentId,
    count,
    summaryValue,
    summaryValueDecimals,
    normalizedScore,
  };
}

/**
 * Submit feedback for an agent after a payment interaction.
 *
 * @param client - Write-capable client
 * @param reputationRegistry - Reputation Registry contract address
 * @param params - Feedback parameters
 * @returns Transaction hash
 */
export async function submitFeedback(
  client: ERC8004WriteClient,
  reputationRegistry: Address,
  params: FeedbackParams,
): Promise<Hex> {
  const txHash = await client.writeContract({
    address: reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "giveFeedback",
    args: [
      params.agentId,
      params.value,
      params.valueDecimals,
      params.tag1,
      params.tag2,
      params.endpoint ?? "",
      params.feedbackURI ?? "",
      params.feedbackHash ?? ("0x" + "0".repeat(64)),
    ],
  });

  return txHash;
}

/**
 * Build an off-chain feedback file with proofOfPayment from a t402 settlement.
 *
 * @param agentId - Agent ID
 * @param agentRegistry - Registry identifier
 * @param clientAddress - Address of the client submitting feedback
 * @param value - Feedback value
 * @param valueDecimals - Decimal precision
 * @param tag1 - Primary tag
 * @param tag2 - Secondary tag
 * @param proofOfPayment - Payment proof from SettleResponse
 * @returns Feedback file object ready for serialization
 */
export function buildFeedbackFile(
  agentId: number,
  agentRegistry: string,
  clientAddress: string,
  value: number,
  valueDecimals: number,
  tag1: string,
  tag2: string,
  proofOfPayment?: { fromAddress: string; toAddress: string; chainId: string; txHash: string },
): Record<string, unknown> {
  return {
    agentRegistry,
    agentId,
    clientAddress,
    createdAt: new Date().toISOString(),
    value,
    valueDecimals,
    tag1,
    tag2,
    ...(proofOfPayment && { proofOfPayment }),
  };
}
```

### 3.6 validation.ts — Validation Registry Client

```typescript
import type { Address, Hex, Bytes32 } from "@t402/evm-core";
import type {
  ERC8004ReadClient,
  ERC8004WriteClient,
  ValidationRequestParams,
  ValidationStatus,
  ValidationSummary,
} from "./types";
import { validationRegistryAbi } from "./abis";

/**
 * Submit a validation request for agent work.
 *
 * @param client - Write-capable client
 * @param validationRegistry - Validation Registry contract address
 * @param params - Validation request parameters
 * @returns Transaction hash
 */
export async function submitValidationRequest(
  client: ERC8004WriteClient,
  validationRegistry: Address,
  params: ValidationRequestParams,
): Promise<Hex> {
  return client.writeContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "validationRequest",
    args: [params.validatorAddress, params.agentId, params.requestURI, params.requestHash],
  });
}

/**
 * Get validation status for a specific request.
 *
 * @param client - Read-only client
 * @param validationRegistry - Validation Registry contract address
 * @param requestHash - Keccak256 hash of the validation request
 * @returns Validation status
 */
export async function getValidationStatus(
  client: ERC8004ReadClient,
  validationRegistry: Address,
  requestHash: Bytes32,
): Promise<ValidationStatus> {
  const result = await client.readContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getValidationStatus",
    args: [requestHash],
  }) as [Address, bigint, number, Bytes32, string, bigint];

  return {
    validatorAddress: result[0],
    agentId: result[1],
    response: result[2],
    responseHash: result[3],
    tag: result[4],
    lastUpdate: result[5],
  };
}

/**
 * Get aggregated validation summary for an agent.
 *
 * @param client - Read-only client
 * @param validationRegistry - Validation Registry contract address
 * @param agentId - Agent's ID
 * @param validatorAddresses - Addresses of trusted validators
 * @param tag - Optional tag filter
 * @returns Validation summary with count and average score
 */
export async function getValidationSummary(
  client: ERC8004ReadClient,
  validationRegistry: Address,
  agentId: bigint,
  validatorAddresses: Address[],
  tag: string = "",
): Promise<ValidationSummary> {
  const result = await client.readContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, validatorAddresses, tag],
  }) as [bigint, number];

  return {
    count: result[0],
    averageResponse: result[1],
  };
}
```

### 3.7 extension.ts — t402 Protocol Extension

This module provides the `ResourceServerExtension` for enriching `PaymentRequired` responses and client-side utilities for verifying the extension.

```typescript
import type { ResourceServerExtension, PaymentRequired, PaymentPayload } from "@t402/core/types";
import type {
  ERC8004Extension,
  ERC8004PayloadExtension,
  ERC8004ReadClient,
  AgentRegistryId,
  ReputationCheckConfig,
} from "./types";
import { ERC8004_EXTENSION_KEY } from "./constants";
import { verifyPayToMatchesAgent } from "./identity";
import { getReputationSummary } from "./reputation";
import type { Address } from "@t402/evm-core";

/**
 * Declare an ERC-8004 extension for a PaymentRequired response.
 *
 * @param agentId - Agent's on-chain ID
 * @param agentRegistry - Registry identifier
 * @param agentWallet - Optional verified wallet address
 * @returns Extension object to include in route config extensions
 *
 * @example
 * const routes = {
 *   "/api/data": {
 *     accepts: [...],
 *     extensions: {
 *       erc8004: declareERC8004Extension(42, "eip155:8453:0x...")
 *     }
 *   }
 * };
 */
export function declareERC8004Extension(
  agentId: number,
  agentRegistry: AgentRegistryId,
  agentWallet?: string,
): ERC8004Extension {
  return {
    agentId,
    agentRegistry,
    ...(agentWallet && { agentWallet }),
  };
}

/**
 * Extract ERC-8004 extension data from a PaymentRequired response.
 *
 * @param paymentRequired - The PaymentRequired response
 * @returns ERC-8004 extension data or undefined
 */
export function getERC8004Extension(
  paymentRequired: PaymentRequired,
): ERC8004Extension | undefined {
  return paymentRequired.extensions?.[ERC8004_EXTENSION_KEY] as ERC8004Extension | undefined;
}

/**
 * Create a client-side ERC-8004 payload extension after verifying identity.
 *
 * @param agentId - Agent ID that was verified
 * @param agentRegistry - Registry used
 * @param verified - Whether verification passed
 * @returns Payload extension to echo back
 */
export function createERC8004PayloadExtension(
  agentId: number,
  agentRegistry: AgentRegistryId,
  verified: boolean,
): ERC8004PayloadExtension {
  return {
    identityVerified: verified,
    agentId,
    agentRegistry,
  };
}

/**
 * Client-side: verify agent identity from PaymentRequired before paying.
 *
 * Checks that the payTo address in PaymentRequirements matches the on-chain
 * agentWallet for the declared agentId.
 *
 * @param client - Read-only client for contract calls
 * @param paymentRequired - The PaymentRequired response with ERC-8004 extension
 * @returns Whether all payTo addresses match the on-chain agent wallet
 */
export async function verifyAgentIdentity(
  client: ERC8004ReadClient,
  paymentRequired: PaymentRequired,
): Promise<boolean> {
  const ext = getERC8004Extension(paymentRequired);
  if (!ext) return false;

  const registry = ext.agentRegistry.split(":");
  const registryAddress = registry[2] as Address;

  for (const accept of paymentRequired.accepts) {
    const matches = await verifyPayToMatchesAgent(
      client,
      registryAddress,
      BigInt(ext.agentId),
      accept.payTo,
    );
    if (!matches) return false;
  }

  return true;
}

/**
 * ResourceServerExtension implementation for ERC-8004.
 *
 * Enriches the declared ERC-8004 extension with live reputation data
 * when the extension is registered on the resource server.
 *
 * @param config - Configuration with client and reputation parameters
 * @returns ResourceServerExtension for registration
 *
 * @example
 * const server = new t402ResourceServer(facilitatorClient);
 * server.registerExtension(erc8004ResourceServerExtension({
 *   client: viemPublicClient,
 *   reputationRegistry: "0x...",
 *   trustedReviewers: ["0x..."],
 * }));
 */
export function erc8004ResourceServerExtension(config: {
  client: ERC8004ReadClient;
  reputationRegistry?: Address;
  trustedReviewers?: Address[];
}): ResourceServerExtension {
  return {
    key: ERC8004_EXTENSION_KEY,

    enrichDeclaration: async (declaration) => {
      const ext = declaration as ERC8004Extension;

      // If reputation registry is configured, enrich with live score
      if (config.reputationRegistry && config.trustedReviewers?.length) {
        const summary = await getReputationSummary(
          config.client,
          config.reputationRegistry,
          BigInt(ext.agentId),
          config.trustedReviewers,
        );
        return {
          ...ext,
          reputationScore: summary.normalizedScore,
          feedbackCount: Number(summary.count),
        };
      }

      return ext;
    },
  };
}
```

### 3.8 hooks.ts — Facilitator Lifecycle Hooks

These hooks integrate with the t402 `beforeVerify`, `afterVerify`, `beforeSettle`, `afterSettle` hook system defined in `t402ResourceServer` and `t402Facilitator`.

```typescript
import type { Address, Hex } from "@t402/evm-core";
import type {
  BeforeVerifyHook,
  AfterSettleHook,
  VerifyContext,
  SettleResultContext,
} from "@t402/core/server";
import type {
  ERC8004ReadClient,
  ERC8004WriteClient,
  ReputationCheckConfig,
  FeedbackSubmissionConfig,
  AgentRegistryId,
} from "./types";
import { ERC8004_EXTENSION_KEY, FEEDBACK_TAGS } from "./constants";
import { getReputationSummary, submitFeedback, buildFeedbackFile } from "./reputation";
import { verifyPayToMatchesAgent } from "./identity";

/**
 * Create a beforeVerify hook that checks agent reputation.
 *
 * Queries the Reputation Registry for the agent's score from trusted
 * reviewers. If the score is below the threshold, the hook aborts
 * verification (or logs a warning, depending on configuration).
 *
 * @param client - Read-only client for contract calls
 * @param reputationRegistry - Reputation Registry contract address
 * @param config - Reputation check configuration
 * @returns BeforeVerifyHook for registration on t402ResourceServer
 *
 * @example
 * const server = new t402ResourceServer(facilitatorClient);
 * server.onBeforeVerify(erc8004ReputationCheck(viemClient, reputationRegistryAddr, {
 *   minScore: 70,
 *   trustedReviewers: ["0x..."],
 *   tag1: "paymentSuccess",
 *   onBelowThreshold: "reject",
 * }));
 */
export function erc8004ReputationCheck(
  client: ERC8004ReadClient,
  reputationRegistry: Address,
  config: ReputationCheckConfig,
): BeforeVerifyHook {
  return async (context: VerifyContext) => {
    // Extract ERC-8004 extension from the payment payload
    const ext = context.paymentPayload.extensions?.[ERC8004_EXTENSION_KEY] as
      | { agentId: number; agentRegistry: AgentRegistryId }
      | undefined;

    if (!ext) {
      // No ERC-8004 extension present, skip reputation check
      return;
    }

    const summary = await getReputationSummary(
      client,
      reputationRegistry,
      BigInt(ext.agentId),
      config.trustedReviewers,
      config.tag1 ?? "",
      config.tag2 ?? "",
    );

    if (summary.normalizedScore < config.minScore) {
      const action = config.onBelowThreshold ?? "reject";
      if (action === "reject") {
        return {
          abort: true,
          reason: `Agent ${ext.agentId} reputation score ${summary.normalizedScore} is below minimum ${config.minScore}`,
        };
      }
      // "warn" mode: log but do not abort
      console.warn(
        `[erc8004] Agent ${ext.agentId} reputation score ${summary.normalizedScore} is below minimum ${config.minScore}`,
      );
    }
  };
}

/**
 * Create a beforeVerify hook that verifies the payTo address matches
 * the agent's on-chain agentWallet.
 *
 * @param client - Read-only client for contract calls
 * @returns BeforeVerifyHook
 *
 * @example
 * server.onBeforeVerify(erc8004IdentityCheck(viemClient));
 */
export function erc8004IdentityCheck(
  client: ERC8004ReadClient,
): BeforeVerifyHook {
  return async (context: VerifyContext) => {
    const ext = context.paymentPayload.extensions?.[ERC8004_EXTENSION_KEY] as
      | { agentId: number; agentRegistry: AgentRegistryId }
      | undefined;

    if (!ext) return;

    const registry = ext.agentRegistry.split(":");
    const registryAddress = registry[2] as Address;

    const matches = await verifyPayToMatchesAgent(
      client,
      registryAddress,
      BigInt(ext.agentId),
      context.requirements.payTo,
    );

    if (!matches) {
      return {
        abort: true,
        reason: `payTo address ${context.requirements.payTo} does not match on-chain agentWallet for agent ${ext.agentId}`,
      };
    }
  };
}

/**
 * Create an afterSettle hook that submits feedback to the Reputation Registry.
 *
 * After a successful settlement, this hook submits positive feedback with
 * proofOfPayment linking the on-chain transaction to the agent's reputation.
 *
 * @param writeClient - Write-capable client for submitting feedback tx
 * @param reputationRegistry - Reputation Registry contract address
 * @param config - Feedback submission configuration
 * @returns AfterSettleHook
 *
 * @example
 * server.onAfterSettle(erc8004SubmitFeedback(viemWalletClient, reputationRegistryAddr, {
 *   tag1: "paymentSuccess",
 *   includeProofOfPayment: true,
 * }));
 */
export function erc8004SubmitFeedback(
  writeClient: ERC8004WriteClient,
  reputationRegistry: Address,
  config: FeedbackSubmissionConfig = {},
): AfterSettleHook {
  return async (context: SettleResultContext) => {
    const ext = context.paymentPayload.extensions?.[ERC8004_EXTENSION_KEY] as
      | { agentId: number; agentRegistry: AgentRegistryId }
      | undefined;

    if (!ext) return;
    if (!context.result.success) return;

    const tag1 = config.tag1 ?? FEEDBACK_TAGS.PAYMENT_SUCCESS;
    const tag2 = config.tag2 ?? "";

    // Build proof of payment from settle result
    let feedbackURI = "";
    let feedbackHash = "0x" + "0".repeat(64) as `0x${string}`;

    if (config.includeProofOfPayment && context.result.transaction) {
      const feedbackFile = buildFeedbackFile(
        ext.agentId,
        ext.agentRegistry,
        context.result.payer ?? "",
        100, // positive feedback score
        0,
        tag1,
        tag2,
        {
          fromAddress: context.result.payer ?? "",
          toAddress: context.requirements.payTo,
          chainId: context.requirements.network,
          txHash: context.result.transaction,
        },
      );

      // If a feedbackBaseURI is configured, the file would be uploaded there.
      // For now, use an empty URI (on-chain data only).
      if (config.feedbackBaseURI) {
        feedbackURI = `${config.feedbackBaseURI}/${context.result.transaction}.json`;
      }
    }

    // Submit on-chain feedback (fire-and-forget, do not block settlement flow)
    submitFeedback(writeClient, reputationRegistry, {
      agentId: BigInt(ext.agentId),
      value: 100n, // positive payment feedback
      valueDecimals: 0,
      tag1,
      tag2,
      endpoint: context.paymentPayload.resource?.url,
      feedbackURI,
      feedbackHash,
    }).catch(err => {
      console.warn(`[erc8004] Failed to submit feedback for agent ${ext.agentId}:`, err);
    });
  };
}
```

### 3.9 index.ts — Public API

```typescript
// Types
export type {
  AgentRegistryId,
  AgentRegistry,
  MetadataEntry,
  AgentIdentity,
  ResolvedAgent,
  RegistrationFile,
  ServiceEntry,
  RegistrationEntry,
  FeedbackRecord,
  ReputationSummary,
  FeedbackParams,
  FeedbackFile,
  ProofOfPayment,
  ValidationRequestParams,
  ValidationStatus,
  ValidationSummary,
  ERC8004Extension,
  ERC8004PayloadExtension,
  ERC8004ReadClient,
  ERC8004WriteClient,
  ERC8004Config,
  ReputationCheckConfig,
  FeedbackSubmissionConfig,
} from "./types";

// Constants
export {
  ERC8004_EXTENSION_KEY,
  IDENTITY_REGISTRIES,
  REPUTATION_REGISTRIES,
  VALIDATION_REGISTRIES,
  FEEDBACK_TAGS,
  IDENTITY_REGISTRY_DOMAIN,
  SET_AGENT_WALLET_TYPES,
} from "./constants";

// ABIs
export {
  identityRegistryAbi,
  reputationRegistryAbi,
  validationRegistryAbi,
} from "./abis";

// Identity
export {
  parseAgentRegistry,
  getAgentIdentity,
  fetchRegistrationFile,
  resolveAgent,
  verifyPayToMatchesAgent,
} from "./identity";

// Reputation
export {
  getReputationSummary,
  submitFeedback,
  buildFeedbackFile,
} from "./reputation";

// Validation
export {
  submitValidationRequest,
  getValidationStatus,
  getValidationSummary,
} from "./validation";

// Extension
export {
  declareERC8004Extension,
  getERC8004Extension,
  createERC8004PayloadExtension,
  verifyAgentIdentity,
  erc8004ResourceServerExtension,
} from "./extension";

// Hooks
export {
  erc8004ReputationCheck,
  erc8004IdentityCheck,
  erc8004SubmitFeedback,
} from "./hooks";
```

## 4. Integration Points with t402

### 4.1 Server-Side: PaymentRequired Extension

Servers declare their ERC-8004 identity in route configuration:

```typescript
import { paymentMiddleware } from "@t402/express";
import { declareERC8004Extension, erc8004ResourceServerExtension } from "@t402/erc8004";

const server = new t402ResourceServer(facilitatorClient);
server.registerExtension(erc8004ResourceServerExtension({
  client: viemPublicClient,
  reputationRegistry: "0x...",
  trustedReviewers: ["0x..."],
}));

const routes = {
  "/api/data": {
    accepts: [{ scheme: "exact", network: "eip155:8453", payTo: "0x...", price: 0.01 }],
    extensions: {
      erc8004: declareERC8004Extension(42, "eip155:8453:0x..."),
    },
  },
};

app.use(paymentMiddleware(routes, server));
```

Wire response includes:
```json
{
  "t402Version": 2,
  "extensions": {
    "erc8004": {
      "agentId": 42,
      "agentRegistry": "eip155:8453:0x...",
      "reputationScore": 87,
      "feedbackCount": 156
    }
  }
}
```

### 4.2 Client-Side: Identity Verification Before Payment

```typescript
import { verifyAgentIdentity, createERC8004PayloadExtension, getERC8004Extension } from "@t402/erc8004";

// After receiving 402 response
const ext = getERC8004Extension(paymentRequired);
if (ext) {
  const verified = await verifyAgentIdentity(viemClient, paymentRequired);
  if (!verified) {
    throw new Error("Agent identity verification failed — payTo address mismatch");
  }

  // Echo verification status back in payment payload
  paymentPayload.extensions = {
    ...paymentPayload.extensions,
    erc8004: createERC8004PayloadExtension(ext.agentId, ext.agentRegistry, true),
  };
}
```

### 4.3 Facilitator-Side: Reputation Hooks

```typescript
import { erc8004ReputationCheck, erc8004IdentityCheck, erc8004SubmitFeedback } from "@t402/erc8004";

const server = new t402ResourceServer(facilitatorClient);

// Phase 1: Verify agent identity before processing payment
server.onBeforeVerify(erc8004IdentityCheck(viemClient));

// Phase 2: Check reputation before verifying payment
server.onBeforeVerify(erc8004ReputationCheck(viemClient, reputationRegistryAddr, {
  minScore: 60,
  trustedReviewers: ["0x...", "0x..."],
  tag1: "paymentSuccess",
  onBelowThreshold: "warn",
}));

// Phase 2: Submit feedback after successful settlement
server.onAfterSettle(erc8004SubmitFeedback(viemWalletClient, reputationRegistryAddr, {
  tag1: "paymentSuccess",
  includeProofOfPayment: true,
}));
```

### 4.4 A2A Integration

The A2A `AgentCard` can be enriched with ERC-8004 identity:

```typescript
// Server: include ERC-8004 identity in AgentCard
const agentCard: A2AAgentCard = {
  name: "My Agent",
  url: "https://agent.example.com",
  capabilities: {
    extensions: [
      createT402Extension(true),
      {
        uri: "https://eips.ethereum.org/EIPS/eip-8004",
        description: "On-chain agent identity and reputation via ERC-8004",
        required: false,
      },
    ],
  },
};

// Client: resolve agent identity from AgentCard before sending payment
const agent = await resolveAgent(viemClient, registryAddr, 42n, "eip155:8453:0x...");
if (!agent.registration.x402Support) {
  throw new Error("Agent does not support t402 payments");
}
```

### 4.5 MCP Integration (Future)

New MCP tools could be added to `@t402/mcp`:
- `resolve_agent_identity` — Look up an agent's on-chain identity
- `check_agent_reputation` — Query reputation from trusted reviewers
- `verify_agent_wallet` — Verify payTo matches agentWallet

### 4.6 Paywall Integration (Future)

`@t402/paywall` can display:
- Agent identity badge (name, image from registration file)
- Reputation score bar
- Validation status indicator
- "Verified Agent" label when identity is confirmed

## 5. Answers to Open Questions

### Q1: Should ERC-8004 identity be an optional extension or first-class in PaymentRequirements?

**Answer: Optional extension.**

Rationale:
- ERC-8004 is still in Draft status. Making it first-class creates a hard dependency on an immature spec.
- t402 supports 10 chain families including non-EVM chains (Solana, TON, TRON, etc.). ERC-8004 is EVM-only. A first-class field would be misleading for non-EVM networks.
- The `PaymentRequired.extensions` mechanism exists precisely for this: composable, opt-in capabilities that don't pollute the core protocol.
- The `extra` field in `PaymentRequirements` is scheme-specific and per-option; identity is per-server, so it belongs at the top-level `extensions`.
- If ERC-8004 achieves wide adoption and a cross-chain equivalent emerges, a future t402 V3 could promote it to first-class.

**Implementation:** Use `PaymentRequired.extensions.erc8004` for server declaration, `PaymentPayload.extensions.erc8004` for client acknowledgment.

### Q2: Which chains should be prioritized?

**Answer: Base (eip155:8453), then Ethereum mainnet (eip155:1), then Arbitrum (eip155:42161).**

Rationale:
- **Base** is the primary chain for t402 payment volume (lowest gas, Coinbase ecosystem, USDT0/USDC native). Coinbase co-authored ERC-8004.
- **Ethereum mainnet** is the canonical chain for identity anchoring. Cross-chain agents registered on mainnet can operate on any L2.
- **Arbitrum** is the secondary L2 with significant t402 usage.
- ERC-8004 registries are per-chain singletons; an agent can register on multiple chains. Start with one, expand based on demand.
- The package design (registry addresses in `constants.ts`) makes adding chains trivial.

### Q3: How should reputation threshold be configured?

**Answer: Per-resource (route-level), with server-wide defaults.**

Rationale:
- Different resources have different risk profiles. A $0.01 API call needs minimal reputation; a $100 agent task needs high reputation.
- The hook system already supports this: `beforeVerify` hooks receive the full `VerifyContext` including `requirements` (which contains the resource URL and amount). Hooks can vary thresholds based on context.
- Server-wide defaults via `erc8004ReputationCheck(config)` with per-route overrides via multiple hooks or conditional logic inside the hook.

**Implementation approach:**
```typescript
// Server-wide default
server.onBeforeVerify(erc8004ReputationCheck(client, registry, {
  minScore: 50,
  trustedReviewers,
}));

// Per-resource override: higher threshold for expensive resources
server.onBeforeVerify(async (context) => {
  if (context.requirements.amount > "10000000") { // > $10 USDT
    return erc8004ReputationCheck(client, registry, {
      minScore: 80,
      trustedReviewers,
      onBelowThreshold: "reject",
    })(context);
  }
});
```

### Q4: Should t402 facilitators register as agents?

**Answer: Yes, but as a Phase 2 concern.**

Rationale:
- Facilitators are critical infrastructure for t402. On-chain identity provides:
  - Discoverability (clients can find facilitators via the registry)
  - Accountability (feedback on facilitator service quality)
  - Trust signals (reputation for reliability, uptime, settlement speed)
- The facilitator's `payTo` signers are already published via the `/supported` endpoint. An ERC-8004 identity would formalize this.
- However, facilitators don't operate as "agents" in the ERC-8004 sense (they don't have services, skills, or endpoints in the registration file format). The registration file schema would need a `facilitator` service type.
- **Phase 2 recommendation:** Register the t402 facilitator service as an agent with `services: [{ name: "t402-facilitator", endpoint: "https://facilitator.t402.io" }]` and use reputation feedback to track facilitator reliability.

## 6. Testing Strategy

### Unit Tests

All modules get pure unit tests with mocked contract interactions:

```typescript
// identity.test.ts
describe("parseAgentRegistry", () => {
  it("parses valid registry ID", () => {
    const result = parseAgentRegistry("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05");
    expect(result.namespace).toBe("eip155");
    expect(result.chainId).toBe("8453");
    expect(result.address).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05");
  });

  it("throws on invalid format", () => {
    expect(() => parseAgentRegistry("invalid" as any)).toThrow("Invalid agent registry ID");
  });
});

describe("getAgentIdentity", () => {
  it("reads identity from contract", async () => {
    const mockClient = {
      readContract: vi.fn()
        .mockResolvedValueOnce("0xWallet...")    // getAgentWallet
        .mockResolvedValueOnce("0xOwner...")     // ownerOf
        .mockResolvedValueOnce("https://...")    // tokenURI
    };
    const identity = await getAgentIdentity(mockClient, "0xRegistry...", 42n, "eip155:8453:0xRegistry...");
    expect(identity.agentWallet).toBe("0xWallet...");
    expect(mockClient.readContract).toHaveBeenCalledTimes(3);
  });
});

// hooks.test.ts
describe("erc8004ReputationCheck", () => {
  it("aborts verification when score below threshold", async () => {
    const mockClient = {
      readContract: vi.fn().mockResolvedValue([10n, 30n, 0]),
    };
    const hook = erc8004ReputationCheck(mockClient, "0xRepRegistry...", {
      minScore: 70,
      trustedReviewers: ["0xReviewer..."],
    });
    const context = {
      paymentPayload: {
        t402Version: 2,
        extensions: { erc8004: { agentId: 42, agentRegistry: "eip155:8453:0x..." } },
        accepted: { ... },
        payload: {},
      },
      requirements: { ... },
    };
    const result = await hook(context);
    expect(result).toEqual({ abort: true, reason: expect.stringContaining("below minimum") });
  });

  it("passes when score meets threshold", async () => {
    const mockClient = {
      readContract: vi.fn().mockResolvedValue([10n, 80n, 0]),
    };
    const hook = erc8004ReputationCheck(mockClient, "0xRepRegistry...", {
      minScore: 70,
      trustedReviewers: ["0xReviewer..."],
    });
    const result = await hook(context);
    expect(result).toBeUndefined();
  });

  it("skips check when no ERC-8004 extension present", async () => {
    const hook = erc8004ReputationCheck(mockClient, "0xRepRegistry...", config);
    const context = { paymentPayload: { extensions: {} }, requirements: {} };
    const result = await hook(context);
    expect(result).toBeUndefined();
  });
});

// extension.test.ts
describe("verifyAgentIdentity", () => {
  it("returns true when payTo matches agentWallet", async () => { ... });
  it("returns false when payTo does not match", async () => { ... });
  it("returns false when no ERC-8004 extension", async () => { ... });
});
```

### Integration Tests

Skipped until ERC-8004 contracts are deployed to testnets. Integration tests will use:
- Hardhat/Anvil local fork for contract deployment
- Actual Identity Registry, Reputation Registry, Validation Registry contracts
- End-to-end flow: register agent → serve 402 → verify identity → pay → submit feedback

## 7. Phased Implementation Plan

### Phase 1a: Types + Identity Resolution (Size: S)

**Deliverables:**
- `types.ts` — All type definitions with Zod schemas
- `abis.ts` — Contract ABIs for all three registries
- `constants.ts` — Extension key, tag constants, registry addresses (empty until deployment)
- `identity.ts` — `parseAgentRegistry()`, `getAgentIdentity()`, `fetchRegistrationFile()`, `resolveAgent()`, `verifyPayToMatchesAgent()`
- `extension.ts` — `declareERC8004Extension()`, `getERC8004Extension()`, `createERC8004PayloadExtension()`
- `index.ts` — Public API
- Package setup: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- Unit tests for all of the above

**Dependencies:** None (can proceed immediately; contract reads work against any ERC-8004 deployment or mock)

### Phase 1b: Client-Side Verification (Size: S)

**Deliverables:**
- `extension.ts` — `verifyAgentIdentity()` (client-side payTo verification)
- Integration with `@t402/a2a` client (optional identity check in `A2APaymentClient`)
- Integration with `@t402/fetch` and `@t402/axios` (optional identity check before payment)

**Dependencies:** Phase 1a

### Phase 2a: Reputation Queries + Hooks (Size: M)

**Deliverables:**
- `reputation.ts` — `getReputationSummary()`
- `hooks.ts` — `erc8004ReputationCheck()`, `erc8004IdentityCheck()`
- `extension.ts` — `erc8004ResourceServerExtension()` (enriches declarations with live reputation)
- Unit tests with mocked contract interactions

**Dependencies:** Phase 1a, deployed Reputation Registry on at least one testnet

### Phase 2b: Feedback Submission (Size: M)

**Deliverables:**
- `reputation.ts` — `submitFeedback()`, `buildFeedbackFile()`
- `hooks.ts` — `erc8004SubmitFeedback()` (afterSettle hook)
- Off-chain feedback file generation with `proofOfPayment`
- Unit tests for feedback submission flow

**Dependencies:** Phase 2a, write-capable ERC8004WriteClient

### Phase 3: Validation Registry (Size: L)

**Deliverables:**
- `validation.ts` — `submitValidationRequest()`, `getValidationStatus()`, `getValidationSummary()`
- Escrow pattern design (out of scope for initial implementation; requires smart contract work)
- Paywall UI components showing identity/reputation/validation status
- MCP tools for agent identity resolution

**Dependencies:** Phase 2b, deployed Validation Registry, validator contracts

## 8. Security Considerations

- **Sybil resistance:** Reputation queries always require explicit `trustedReviewers` (clientAddresses). Never expose unfiltered getSummary results to payment decisions.
- **Registration file trust:** The `agentURI` is self-reported. The package verifies `agentWallet` on-chain but cannot verify functional capabilities advertised in the registration file.
- **Cross-chain identity:** An agent registered on Chain A (e.g., mainnet) with `payTo` on Chain B (e.g., Base) requires careful verification. The `agentWallet` is per-registry-per-chain; multi-chain agents should register on the payment chain.
- **Feedback spam:** On-chain feedback is permissionless. The `trustedReviewers` filter is essential. Facilitators should maintain curated reviewer lists.
- **Gas costs:** Feedback submission requires gas. The afterSettle hook uses fire-and-forget to avoid blocking the payment flow. Failed feedback submissions log warnings but do not affect settlement.
- **Contract upgrades:** ERC-8004 is in Draft status. The ABI may change. The package should version-lock ABIs and provide migration guidance when the spec finalizes.

## 9. Compatibility Notes

- **Non-EVM chains:** ERC-8004 is EVM-only. The extension is silently ignored for non-EVM payment options (SVM, TON, TRON, etc.). A future cross-chain identity standard could be added as a separate extension key.
- **t402 V1 compatibility:** ERC-8004 extension uses V2 `PaymentRequired.extensions`. V1 payloads do not support extensions; the extension is not available in V1 mode.
- **viem version:** Requires viem ^2.0.0 as peer dependency, consistent with `@t402/evm-core` and `@t402/evm`.

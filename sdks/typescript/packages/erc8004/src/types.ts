import type { Network } from "@t402/core/types";

// ============================================================================
// Primitive Types (local — avoid @t402/evm-core dependency)
// ============================================================================

/** Ethereum address (0x-prefixed hex string) */
export type Address = `0x${string}`;

/** Hex-encoded bytes (0x-prefixed) */
export type Hex = `0x${string}`;

/** 32-byte hash (0x-prefixed, 66 chars) */
export type Bytes32 = `0x${string}`;

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

import type { Address } from "./types";
import type { Network } from "@t402/core/types";

/**
 * Known Identity Registry addresses per network.
 * Populated as ERC-8004 deploys to each chain.
 * Empty until mainnet deployments exist (spec is in Draft status).
 */
export const IDENTITY_REGISTRIES: Partial<Record<Network, Address>> = {};

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

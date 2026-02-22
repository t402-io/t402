import type { PaymentRequired } from "@t402/core/types";
import type {
  Address,
  ERC8004Extension,
  ERC8004PayloadExtension,
  ERC8004ReadClient,
  AgentRegistryId,
} from "./types";
import { ERC8004_EXTENSION_KEY } from "./constants";
import { verifyPayToMatchesAgent } from "./identity";

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
  return paymentRequired.extensions?.[ERC8004_EXTENSION_KEY] as
    | ERC8004Extension
    | undefined;
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
 * Checks that the payTo address in each PaymentRequirements entry matches
 * the on-chain agentWallet for the declared agentId.
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
  const registryAddress = registry.slice(2).join(":") as Address;

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

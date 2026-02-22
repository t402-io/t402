import type { PaymentRequired, ResourceServerExtension } from "@t402/core/types";
import type {
  Address,
  ERC8004Extension,
  ERC8004PayloadExtension,
  ERC8004ReadClient,
  AgentRegistryId,
} from "./types";
import { ERC8004_EXTENSION_KEY } from "./constants";
import { verifyPayToMatchesAgent } from "./identity";
import { getReputationSummary } from "./reputation";
import { getValidationSummary } from "./validation";

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

/**
 * Create a ResourceServerExtension that enriches ERC-8004 declarations
 * with live reputation data from the on-chain Reputation Registry.
 *
 * When registered on a t402ResourceServer, this extension fetches the
 * agent's current reputation score and feedback count at response time,
 * including them in the PaymentRequired response for client inspection.
 *
 * @param config - Configuration with client and optional reputation parameters
 * @returns ResourceServerExtension for registration on t402ResourceServer
 *
 * @example
 * ```typescript
 * const server = new t402ResourceServer(facilitatorClient);
 * server.registerExtension(erc8004ResourceServerExtension({
 *   client: viemPublicClient,
 *   reputationRegistry: "0x...",
 *   trustedReviewers: ["0x..."],
 * }));
 * ```
 */
export function erc8004ResourceServerExtension(config: {
  client: ERC8004ReadClient;
  reputationRegistry?: Address;
  trustedReviewers?: Address[];
  validationRegistry?: Address;
  trustedValidators?: Address[];
}): ResourceServerExtension {
  return {
    key: ERC8004_EXTENSION_KEY,

    enrichDeclaration: async (declaration) => {
      let enriched = declaration as ERC8004Extension;

      // Enrich with live reputation score
      if (config.reputationRegistry && config.trustedReviewers?.length) {
        const summary = await getReputationSummary(
          config.client,
          config.reputationRegistry,
          BigInt(enriched.agentId),
          config.trustedReviewers,
        );
        enriched = {
          ...enriched,
          reputationScore: summary.normalizedScore,
          feedbackCount: Number(summary.count),
        };
      }

      // Enrich with live validation score
      if (config.validationRegistry && config.trustedValidators?.length) {
        const summary = await getValidationSummary(
          config.client,
          config.validationRegistry,
          BigInt(enriched.agentId),
          config.trustedValidators,
        );
        enriched = {
          ...enriched,
          validationScore: summary.averageResponse,
        };
      }

      return enriched;
    },
  };
}

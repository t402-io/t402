import type {
  BeforePaymentCreationHook,
  PaymentCreationContext,
} from "@t402/core/client";
import type { BeforeVerifyHook, VerifyContext } from "@t402/core/server";
import type { A2ATask } from "@t402/core/types";
import { getPaymentRequired } from "@t402/core/types";
import type {
  Address,
  AgentRegistryId,
  ERC8004ReadClient,
  ReputationCheckConfig,
} from "./types";
import { ERC8004_EXTENSION_KEY } from "./constants";
import { getERC8004Extension, verifyAgentIdentity } from "./extension";
import { verifyPayToMatchesAgent } from "./identity";
import { getReputationSummary } from "./reputation";

/**
 * Options for the ERC-8004 identity check hook.
 */
export interface IdentityCheckOptions {
  /**
   * Abort payment if identity verification fails.
   * @default true
   */
  abortOnFailure?: boolean;

  /**
   * Abort payment if no ERC-8004 extension is present.
   * When false (default), requests without the extension pass through silently.
   * @default false
   */
  abortOnMissing?: boolean;
}

/**
 * Create a BeforePaymentCreationHook that verifies agent identity
 * before signing a payment.
 *
 * Works with `t402Client.onBeforePaymentCreation()`, which means it
 * automatically applies to `@t402/fetch` and `@t402/axios` wrappers.
 *
 * @param client - Read-only client for on-chain contract calls
 * @param options - Hook behavior options
 * @returns A hook for registration on t402Client
 *
 * @example
 * ```typescript
 * import { createPublicClient, http } from "viem";
 * import { base } from "viem/chains";
 * import { erc8004IdentityCheck } from "@t402/erc8004";
 *
 * const viemClient = createPublicClient({ chain: base, transport: http() });
 * const client = new t402Client()
 *   .register("eip155:8453", evmScheme)
 *   .onBeforePaymentCreation(erc8004IdentityCheck(viemClient));
 *
 * const fetchWithPay = wrapFetchWithPayment(fetch, client);
 * ```
 */
export function erc8004IdentityCheck(
  client: ERC8004ReadClient,
  options: IdentityCheckOptions = {},
): BeforePaymentCreationHook {
  const { abortOnFailure = true, abortOnMissing = false } = options;

  return async (
    context: PaymentCreationContext,
  ): Promise<void | { abort: true; reason: string }> => {
    const ext = getERC8004Extension(context.paymentRequired);

    if (!ext) {
      if (abortOnMissing) {
        return {
          abort: true,
          reason: "ERC-8004 extension not present in payment requirements",
        };
      }
      return;
    }

    const verified = await verifyAgentIdentity(
      client,
      context.paymentRequired,
    );

    if (!verified && abortOnFailure) {
      return {
        abort: true,
        reason: `ERC-8004 identity verification failed for agent ${ext.agentId} on registry ${ext.agentRegistry}`,
      };
    }
  };
}

/**
 * Verify agent identity from an A2A task's payment requirements.
 *
 * Convenience wrapper that extracts PaymentRequired from an A2A task
 * and delegates to `verifyAgentIdentity()`.
 *
 * @param client - Read-only client for on-chain contract calls
 * @param task - The A2A task containing payment requirements
 * @returns Whether identity verification passed (false if no requirements or no extension)
 *
 * @example
 * ```typescript
 * const a2aClient = new A2APaymentClient({
 *   onPaymentRequired: async (requirements) => {
 *     const verified = await verifyAgentIdentityFromTask(viemClient, task);
 *     if (!verified) throw new Error("Agent identity not verified");
 *   },
 * });
 * ```
 */
export async function verifyAgentIdentityFromTask(
  client: ERC8004ReadClient,
  task: A2ATask,
): Promise<boolean> {
  const paymentRequired = getPaymentRequired(task);
  if (!paymentRequired) return false;

  return verifyAgentIdentity(client, paymentRequired);
}

// ============================================================================
// Server-Side Hooks (t402ResourceServer lifecycle)
// ============================================================================

/**
 * Helper to extract ERC-8004 extension from a payment payload's extensions.
 */
function getPayloadExtension(
  context: VerifyContext,
): { agentId: number; agentRegistry: AgentRegistryId } | undefined {
  return context.paymentPayload.extensions?.[ERC8004_EXTENSION_KEY] as
    | { agentId: number; agentRegistry: AgentRegistryId }
    | undefined;
}

/**
 * Create a BeforeVerifyHook that checks agent reputation before verification.
 *
 * Queries the Reputation Registry for the agent's score from trusted
 * reviewers. If below threshold, aborts or warns per config.
 *
 * @param client - Read-only client for contract calls
 * @param reputationRegistry - Reputation Registry contract address
 * @param config - Reputation check configuration
 * @returns BeforeVerifyHook for registration on t402ResourceServer
 *
 * @example
 * ```typescript
 * const server = new t402ResourceServer(facilitatorClient);
 * server.onBeforeVerify(erc8004ReputationCheck(viemClient, registryAddr, {
 *   minScore: 70,
 *   trustedReviewers: ["0x..."],
 *   onBelowThreshold: "reject",
 * }));
 * ```
 */
export function erc8004ReputationCheck(
  client: ERC8004ReadClient,
  reputationRegistry: Address,
  config: ReputationCheckConfig,
): BeforeVerifyHook {
  return async (
    context: VerifyContext,
  ): Promise<void | { abort: true; reason: string }> => {
    const ext = getPayloadExtension(context);
    if (!ext) return;

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
 * Create a BeforeVerifyHook that verifies payTo matches the agent's
 * on-chain agentWallet.
 *
 * Server-side counterpart to the client-side `erc8004IdentityCheck`.
 * Ensures the payment recipient address in the accepted requirements
 * matches the registered agent wallet.
 *
 * @param client - Read-only client for contract calls
 * @returns BeforeVerifyHook for registration on t402ResourceServer
 *
 * @example
 * ```typescript
 * server.onBeforeVerify(erc8004ServerIdentityCheck(viemClient));
 * ```
 */
export function erc8004ServerIdentityCheck(
  client: ERC8004ReadClient,
): BeforeVerifyHook {
  return async (
    context: VerifyContext,
  ): Promise<void | { abort: true; reason: string }> => {
    const ext = getPayloadExtension(context);
    if (!ext) return;

    const registry = ext.agentRegistry.split(":");
    const registryAddress = registry.slice(2).join(":") as Address;

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

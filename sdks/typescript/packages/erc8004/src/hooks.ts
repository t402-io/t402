import type {
  BeforePaymentCreationHook,
  PaymentCreationContext,
} from "@t402/core/client";
import type {
  BeforeVerifyHook,
  VerifyContext,
  AfterSettleHook,
  SettleResultContext,
} from "@t402/core/server";
import type { A2ATask } from "@t402/core/types";
import { getPaymentRequired } from "@t402/core/types";
import type {
  Address,
  AgentRegistryId,
  ERC8004ReadClient,
  ERC8004WriteClient,
  ReputationCheckConfig,
  FeedbackSubmissionConfig,
} from "./types";
import { ERC8004_EXTENSION_KEY, FEEDBACK_TAGS } from "./constants";
import { getERC8004Extension, verifyAgentIdentity } from "./extension";
import { verifyPayToMatchesAgent } from "./identity";
import { getReputationSummary, submitFeedback, buildFeedbackFile } from "./reputation";

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
  context: { paymentPayload: { extensions?: Record<string, unknown> } },
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

/**
 * Create an AfterSettleHook that submits positive feedback to the
 * Reputation Registry after a successful payment settlement.
 *
 * Uses fire-and-forget: the feedback submission runs asynchronously
 * and never blocks the settlement flow. Errors are logged as warnings.
 *
 * @param writeClient - Write-capable client for submitting feedback tx
 * @param reputationRegistry - Reputation Registry contract address
 * @param config - Feedback submission configuration
 * @returns AfterSettleHook for registration on t402ResourceServer
 *
 * @example
 * ```typescript
 * server.onAfterSettle(erc8004SubmitFeedback(viemWalletClient, registryAddr, {
 *   tag1: "paymentSuccess",
 *   includeProofOfPayment: true,
 * }));
 * ```
 */
export function erc8004SubmitFeedback(
  writeClient: ERC8004WriteClient,
  reputationRegistry: Address,
  config: FeedbackSubmissionConfig = {},
): AfterSettleHook {
  return async (context: SettleResultContext): Promise<void> => {
    const ext = getPayloadExtension(context);
    if (!ext) return;
    if (!context.result.success) return;

    const tag1 = config.tag1 ?? FEEDBACK_TAGS.PAYMENT_SUCCESS;
    const tag2 = config.tag2 ?? "";

    // Build feedback URI if proof of payment is configured
    let feedbackURI = "";
    const feedbackHash = ("0x" + "0".repeat(64)) as `0x${string}`;

    if (config.includeProofOfPayment && context.result.transaction) {
      buildFeedbackFile(
        ext.agentId,
        ext.agentRegistry,
        context.result.payer ?? "",
        100,
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

      if (config.feedbackBaseURI) {
        feedbackURI = `${config.feedbackBaseURI}/${context.result.transaction}.json`;
      }
    }

    // Fire-and-forget: submit on-chain feedback without blocking
    submitFeedback(writeClient, reputationRegistry, {
      agentId: BigInt(ext.agentId),
      value: 100n,
      valueDecimals: 0,
      tag1,
      tag2,
      endpoint: context.paymentPayload.resource?.url,
      feedbackURI,
      feedbackHash,
    }).catch((err) => {
      console.warn(
        `[erc8004] Failed to submit feedback for agent ${ext.agentId}:`,
        err,
      );
    });
  };
}

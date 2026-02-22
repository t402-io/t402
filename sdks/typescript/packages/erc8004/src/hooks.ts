import type {
  BeforePaymentCreationHook,
  PaymentCreationContext,
} from "@t402/core/client";
import type { A2ATask } from "@t402/core/types";
import { getPaymentRequired } from "@t402/core/types";
import type { ERC8004ReadClient } from "./types";
import { getERC8004Extension, verifyAgentIdentity } from "./extension";

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

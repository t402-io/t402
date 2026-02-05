import type {
  PaywallNetworkHandler,
  PaymentRequirements,
  PaymentRequired,
  PaywallConfig,
} from "../types";
import { getGaslessPaywallHtml } from "./paywall";

/**
 * Gasless ERC-4337 paywall handler for EVM networks.
 *
 * Renders a paywall page that indicates the payment will be gasless
 * (sponsored by a paymaster). Use this handler instead of `evmPaywall`
 * when your application supports gasless payments.
 *
 * The handler checks for `eip155:` network prefix AND
 * the `extra.gasless` field in payment requirements.
 *
 * @example
 * ```typescript
 * import { createPaywall, gaslessPaywall, evmPaywall } from '@t402/paywall';
 *
 * const paywall = createPaywall()
 *   .withNetwork(gaslessPaywall) // gasless first (checked before evm)
 *   .withNetwork(evmPaywall)     // fallback to regular EVM
 *   .build();
 * ```
 */
export const gaslessPaywall: PaywallNetworkHandler = {
  /**
   * Check if this handler supports the given payment requirement.
   * Matches EVM networks with gasless support indicated.
   */
  supports(requirement: PaymentRequirements): boolean {
    if (!requirement.network.startsWith("eip155:")) {
      return false;
    }

    // Check for gasless flag in extra metadata
    if (requirement.extra?.gasless === true) {
      return true;
    }

    // Check for ERC-4337 scheme
    if (requirement.scheme === "erc4337" || requirement.scheme === "gasless") {
      return true;
    }

    return false;
  },

  /**
   * Generate gasless paywall HTML
   */
  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string {
    const amount = requirement.amount
      ? parseFloat(requirement.amount) / 1000000
      : requirement.maxAmountRequired
        ? parseFloat(requirement.maxAmountRequired) / 1000000
        : 0;

    return getGaslessPaywallHtml({
      amount,
      paymentRequired,
      currentUrl: paymentRequired.resource?.url || config.currentUrl || "",
      testnet: config.testnet ?? true,
      appName: config.appName,
      appLogo: config.appLogo,
      theme: config.theme,
    });
  },
};

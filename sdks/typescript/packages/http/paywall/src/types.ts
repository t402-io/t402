/**
 * Theme configuration for the paywall
 */
export interface PaywallTheme {
  /**
   * Color mode: light, dark, or auto (follows system preference)
   */
  mode?: "light" | "dark" | "auto";
  /**
   * Custom color overrides
   */
  colors?: {
    primary?: string;
    background?: string;
    containerBackground?: string;
    text?: string;
    secondaryText?: string;
    border?: string;
  };
  /**
   * Custom border radius (e.g., "0.75rem", "8px")
   */
  borderRadius?: string;
  /**
   * Custom font family
   */
  fontFamily?: string;
}

/**
 * Configuration options for the paywall
 */
export interface PaywallConfig {
  appName?: string;
  appLogo?: string;
  currentUrl?: string;
  testnet?: boolean;
  /**
   * Theme configuration for styling the paywall
   */
  theme?: PaywallTheme;
  /**
   * WalletConnect project ID for mobile deep linking (EVM only)
   * Get your project ID at https://cloud.walletconnect.com
   */
  walletConnectProjectId?: string;
  /**
   * Delivery mode for the paywall HTML.
   * - "cdn" (default): Lightweight HTML shell that loads JS/CSS from jsDelivr CDN (~1KB response).
   * - "inline": All JS/CSS inlined into the HTML (legacy behavior, ~2.7MB response).
   */
  deliveryMode?: "cdn" | "inline";
  /**
   * Custom CDN base URL for loading paywall assets.
   * Only used when deliveryMode is "cdn".
   * Defaults to jsDelivr: https://cdn.jsdelivr.net/npm/@t402/paywall@{VERSION}/dist/browser
   */
  cdnBaseUrl?: string;
}

/**
 * Payment requirements structure (supports both v1 and v2)
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
  // V1 fields
  maxAmountRequired?: string;
  description?: string;
  resource?: string;
  mimeType?: string;
  // V2 fields
  amount?: string;
}

/**
 * Payment required response structure
 */
export interface PaymentRequired {
  t402Version: number;
  error?: string;
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

/**
 * Paywall provider interface for generating HTML
 */
export interface PaywallProvider {
  /**
   * Generate HTML for a payment required response
   *
   * @param paymentRequired - Payment required response with accepts array
   * @param config - Optional runtime configuration
   * @returns HTML string for the paywall page
   */
  generateHtml(paymentRequired: PaymentRequired, config?: PaywallConfig): string;
}

/**
 * Network-specific paywall handler
 */
export interface PaywallNetworkHandler {
  /**
   * Check if this handler supports the given payment requirement
   *
   * @param requirement - Payment requirement to check
   * @returns True if this handler can process this requirement
   */
  supports(requirement: PaymentRequirements): boolean;

  /**
   * Generate HTML for this network's paywall
   *
   * @param requirement - The selected payment requirement
   * @param paymentRequired - Full payment required response
   * @param config - Paywall configuration
   * @returns HTML string for the paywall page
   */
  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string;
}

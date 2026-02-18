import type { PaymentRequired, PaywallTheme } from "../types";
import { getTonTemplate } from "./template-loader";
import { generateThemeScript } from "../themeUtils";
import { getBundledWallets, type TonWalletInfo } from "./wallets";

/**
 * Escapes a string for safe injection into JavaScript string literals
 *
 * @param str - The string to escape
 * @returns The escaped string
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

interface TonPaywallOptions {
  amount: number;
  paymentRequired: PaymentRequired;
  currentUrl: string;
  testnet: boolean;
  appName?: string;
  appLogo?: string;
  tonConnectManifestUrl?: string;
  theme?: PaywallTheme;
  deliveryMode?: "cdn" | "inline";
  cdnBaseUrl?: string;
  /**
   * TON Connect wallet list to embed in the paywall HTML.
   * If not provided, the bundled snapshot is used.
   * Use `fetchTonWallets()` to get a fresh list at server start.
   */
  tonWallets?: TonWalletInfo[];
}

/**
 * Generates TON-specific paywall HTML
 *
 * @param options - The options for generating the paywall
 * @param options.amount - The amount to be paid in USD
 * @param options.paymentRequired - The payment required response with accepts array
 * @param options.currentUrl - The URL of the content being accessed
 * @param options.testnet - Whether to use testnet or mainnet
 * @param options.appName - The name of the application to display in the wallet connection modal
 * @param options.appLogo - The logo of the application to display in the wallet connection modal
 * @param options.tonConnectManifestUrl - Optional TonConnect manifest URL
 * @param options.tonWallets - Optional dynamic wallet list (falls back to bundled)
 * @returns HTML string for the paywall page
 */
export function getTonPaywallHtml(options: TonPaywallOptions): string {
  const mode = options.deliveryMode ?? "cdn";
  const TON_PAYWALL_TEMPLATE = getTonTemplate(mode);

  if (!TON_PAYWALL_TEMPLATE) {
    return `<!DOCTYPE html><html><body><h1>TON Paywall (run pnpm build:paywall to generate full template)</h1></body></html>`;
  }

  const {
    amount,
    testnet,
    paymentRequired,
    currentUrl,
    appName,
    appLogo,
    tonConnectManifestUrl,
    theme,
    tonWallets,
  } = options;

  const logOnTestnet = testnet
    ? "console.log('TON Payment required initialized:', window.t402);"
    : "";

  const manifestUrl = tonConnectManifestUrl || "https://t402.io/tonconnect-manifest.json";
  const themeScript = generateThemeScript(theme);

  // Embed wallet list for client-side wallet selection UI
  const walletList = tonWallets ?? getBundledWallets();

  const configScript = `
  <script>
    window.t402 = {
      amount: ${amount},
      paymentRequired: ${JSON.stringify(paymentRequired)},
      testnet: ${testnet},
      currentUrl: "${escapeString(currentUrl)}",
      config: {
        chainConfig: {},
      },
      appName: "${escapeString(appName || "")}",
      appLogo: "${escapeString(appLogo || "")}",
      tonConnectManifestUrl: "${escapeString(manifestUrl)}",
      tonWallets: ${JSON.stringify(walletList)},
    };
    ${logOnTestnet}
  </script>`;

  return TON_PAYWALL_TEMPLATE.replace("</head>", `${themeScript}${configScript}\n</head>`);
}

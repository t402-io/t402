import type { PaymentRequired, PaywallTheme } from "../types";
import { getTronTemplate } from "./template-loader";
import { generateThemeScript } from "../themeUtils";

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

interface TronPaywallOptions {
  amount: number;
  paymentRequired: PaymentRequired;
  currentUrl: string;
  testnet: boolean;
  appName?: string;
  appLogo?: string;
  theme?: PaywallTheme;
  deliveryMode?: "cdn" | "inline";
  cdnBaseUrl?: string;
}

/**
 * Generates TRON-specific paywall HTML
 *
 * @param options - The options for generating the paywall
 * @param options.amount - The amount to be paid in USD
 * @param options.paymentRequired - The payment required response with accepts array
 * @param options.currentUrl - The URL of the content being accessed
 * @param options.testnet - Whether to use testnet or mainnet
 * @param options.appName - The name of the application to display
 * @param options.appLogo - The logo of the application to display
 * @returns HTML string for the paywall page
 */
export function getTronPaywallHtml(options: TronPaywallOptions): string {
  const mode = options.deliveryMode ?? "cdn";
  const TRON_PAYWALL_TEMPLATE = getTronTemplate(mode);

  if (!TRON_PAYWALL_TEMPLATE) {
    return `<!DOCTYPE html><html><body><h1>TRON Paywall (run pnpm build:paywall to generate full template)</h1></body></html>`;
  }

  const { amount, testnet, paymentRequired, currentUrl, appName, appLogo, theme } = options;

  const logOnTestnet = testnet
    ? "console.log('TRON Payment required initialized:', window.t402);"
    : "";

  const themeScript = generateThemeScript(theme);

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
    };
    ${logOnTestnet}
  </script>`;

  return TRON_PAYWALL_TEMPLATE.replace("</head>", `${themeScript}${configScript}\n</head>`);
}

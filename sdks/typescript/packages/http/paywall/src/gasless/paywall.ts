import type { PaymentRequired, PaywallTheme } from "../types";
import { generateThemeScript } from "../themeUtils";

function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

interface GaslessPaywallOptions {
  amount: number;
  paymentRequired: PaymentRequired;
  currentUrl: string;
  testnet: boolean;
  appName?: string;
  appLogo?: string;
  theme?: PaywallTheme;
}

/**
 * Generates gasless ERC-4337 paywall HTML
 *
 * Unlike the regular EVM paywall, this doesn't require wallet connection.
 * The payment is processed via a smart account with gas sponsorship.
 */
export function getGaslessPaywallHtml(options: GaslessPaywallOptions): string {
  const { amount, testnet, paymentRequired, currentUrl, appName, appLogo, theme } = options;
  const themeScript = generateThemeScript(theme);

  const configScript = `
  <script>
    window.t402 = {
      amount: ${amount},
      paymentRequired: ${JSON.stringify(paymentRequired)},
      testnet: ${testnet},
      currentUrl: "${escapeString(currentUrl)}",
      appName: "${escapeString(appName || "")}",
      appLogo: "${escapeString(appLogo || "")}",
      gasless: true,
    };
  </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Required - ${escapeString(appName || "t402")}</title>
  ${themeScript}
  ${configScript}
  <style>
    :root {
      --primary: #00d4aa;
      --bg: #0a0a0a;
      --container-bg: #141414;
      --text: #ffffff;
      --secondary-text: #888888;
      --border: #2a2a2a;
      --radius: 0.75rem;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .container {
      background: var(--container-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .logo { width: 48px; height: 48px; margin-bottom: 1rem; border-radius: 50%; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .amount { font-size: 2rem; font-weight: 700; color: var(--primary); margin: 1rem 0; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: rgba(0, 212, 170, 0.1);
      color: var(--primary);
      border: 1px solid rgba(0, 212, 170, 0.3);
      border-radius: 2rem;
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
    }
    .badge svg { width: 14px; height: 14px; }
    .info {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: calc(var(--radius) - 2px);
      padding: 1rem;
      margin-bottom: 1.5rem;
      text-align: left;
      font-size: 0.875rem;
    }
    .info-row { display: flex; justify-content: space-between; padding: 0.375rem 0; }
    .info-row .label { color: var(--secondary-text); }
    .info-row .value { font-weight: 500; }
    .divider { height: 1px; background: var(--border); margin: 0.5rem 0; }
    .btn {
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: #000;
      border: none;
      border-radius: var(--radius);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn.loading { position: relative; color: transparent; }
    .btn.loading::after {
      content: '';
      position: absolute;
      width: 1.25rem;
      height: 1.25rem;
      top: 50%;
      left: 50%;
      margin: -0.625rem 0 0 -0.625rem;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: calc(var(--radius) - 2px);
      font-size: 0.875rem;
    }
    .status.success { background: rgba(0, 212, 170, 0.1); color: var(--primary); }
    .status.error { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }
    .footer { margin-top: 1.5rem; font-size: 0.75rem; color: var(--secondary-text); }
  </style>
</head>
<body>
  <div class="container">
    ${appLogo ? `<img class="logo" src="${escapeString(appLogo)}" alt="" />` : ""}
    <h1>Payment Required</h1>
    <div class="amount">$${amount.toFixed(2)}</div>
    <div class="badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      Gasless Payment
    </div>
    <div class="info">
      <div class="info-row">
        <span class="label">Token</span>
        <span class="value">USDT0</span>
      </div>
      <div class="divider"></div>
      <div class="info-row">
        <span class="label">Gas Fee</span>
        <span class="value" style="color: var(--primary)">Sponsored (Free)</span>
      </div>
      <div class="divider"></div>
      <div class="info-row">
        <span class="label">Method</span>
        <span class="value">Smart Account (ERC-4337)</span>
      </div>
    </div>
    <button class="btn" id="payBtn" onclick="handlePay()">
      Pay $${amount.toFixed(2)} — No Gas Required
    </button>
    <div id="status"></div>
    <div class="footer">
      Powered by t402 Protocol${testnet ? " (Testnet)" : ""}
    </div>
  </div>
  <script>
    async function handlePay() {
      var btn = document.getElementById('payBtn');
      var statusEl = document.getElementById('status');
      btn.classList.add('loading');
      btn.disabled = true;
      statusEl.innerHTML = '';
      try {
        var response = await fetch(window.t402.currentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-T402-Gasless': 'true' },
          body: JSON.stringify({ paymentRequired: window.t402.paymentRequired }),
        });
        if (response.ok) {
          statusEl.innerHTML = '<div class="status success">Payment confirmed! Redirecting...</div>';
          setTimeout(function() { window.location.reload(); }, 1500);
        } else {
          var data = await response.json().catch(function() { return {}; });
          throw new Error(data.error || 'Payment failed');
        }
      } catch (err) {
        statusEl.innerHTML = '<div class="status error">' + (err.message || 'Payment failed') + '</div>';
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

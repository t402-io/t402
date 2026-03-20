/**
 * Utility functions for the T402 Explorer.
 */

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function getDecimals(token, network) {
  if (network && network.startsWith("stellar:") && token === "USDC") return 7;
  // BSC USDT and USDC are 18 decimals
  if (network === "eip155:56") return 18;
  // Celo USDT is 18 decimals
  if (network === "eip155:42220") return 18;
  return 6;
}

export function formatAmount(amountStr, token, network) {
  if (!amountStr) return "0.00";
  const decimals = getDecimals(token, network);
  const raw = BigInt(amountStr);
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0").slice(0, 2)}`;
}

const NETWORK_NAMES = { "eip155:1": "Ethereum", "eip155:8453": "Base", "eip155:42161": "Arbitrum", "eip155:137": "Polygon", "eip155:10": "Optimism", "eip155:56": "BNB Chain", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana", "ton:mainnet": "TON", "tron:mainnet": "TRON", "stellar:pubnet": "Stellar" };

export function getNetworkName(caip2) {
  if (!caip2) return "";
  if (NETWORK_NAMES[caip2]) return NETWORK_NAMES[caip2];
  const parts = caip2.split(":");
  if (parts[0] === "eip155") return `EVM (${parts[1]})`;
  return caip2;
}

const TX_URLS = { "eip155:1": "https://etherscan.io/tx/", "eip155:8453": "https://basescan.org/tx/", "eip155:42161": "https://arbiscan.io/tx/", "eip155:137": "https://polygonscan.com/tx/", "eip155:10": "https://optimistic.etherscan.io/tx/", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "https://solscan.io/tx/", "ton:mainnet": "https://tonviewer.com/transaction/", "tron:mainnet": "https://tronscan.org/#/transaction/", "stellar:pubnet": "https://stellar.expert/explorer/public/tx/" };
const ADDR_URLS = { "eip155:1": "https://etherscan.io/address/", "eip155:8453": "https://basescan.org/address/", "eip155:42161": "https://arbiscan.io/address/", "eip155:137": "https://polygonscan.com/address/", "eip155:10": "https://optimistic.etherscan.io/address/", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "https://solscan.io/account/", "ton:mainnet": "https://tonviewer.com/", "tron:mainnet": "https://tronscan.org/#/address/", "stellar:pubnet": "https://stellar.expert/explorer/public/account/" };

export function getExplorerUrl(network, txHash) { return (network && txHash && TX_URLS[network]) ? TX_URLS[network] + txHash : null; }
export function getAddressUrl(network, address) { return (network && address && ADDR_URLS[network]) ? ADDR_URLS[network] + address : null; }
export function formatAddress(address) { if (!address || address.length <= 16) return address || ""; return address.slice(0, 8) + "\u2026" + address.slice(-6); }
export function formatHash(hash) { if (!hash || hash.length <= 20) return hash || ""; return hash.slice(0, 10) + "\u2026" + hash.slice(-6); }
export function formatTime(isoStr) {
  if (!isoStr) return "";
  const ms = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

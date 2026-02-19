/**
 * Dynamic TON Connect wallet registry integration.
 *
 * Fetches the official wallet list from ton-blockchain/wallets-list,
 * with a bundled fallback for offline/error scenarios.
 */

/**
 * Platform types supported by TON Connect wallets
 */
export type TonWalletPlatform =
  | "ios"
  | "android"
  | "chrome"
  | "firefox"
  | "safari"
  | "windows"
  | "macos"
  | "linux";

/**
 * TON wallet bridge configuration
 */
export interface TonWalletBridge {
  type: "sse" | "js";
  url?: string;
  key?: string;
}

/**
 * Information about a TON Connect compatible wallet
 */
export interface TonWalletInfo {
  /** Display name */
  name: string;
  /** Machine-readable identifier */
  appName: string;
  /** Wallet icon URL */
  imageUrl: string;
  /** Wallet info page */
  aboutUrl: string;
  /** Supported platforms */
  platforms: TonWalletPlatform[];
  /** Bridge configurations */
  bridges: TonWalletBridge[];
  /** Universal link for connection */
  universalUrl?: string;
  /** Native deep link scheme */
  deepLink?: string;
}

/**
 * Bundled snapshot of top TON Connect wallets.
 * Used as offline fallback when the remote list cannot be fetched.
 */
const BUNDLED_WALLETS: TonWalletInfo[] = [
  {
    name: "Tonkeeper",
    appName: "tonkeeper",
    imageUrl: "https://tonkeeper.com/assets/tonconnect-icon.png",
    aboutUrl: "https://tonkeeper.com",
    platforms: ["ios", "android", "chrome", "firefox", "macos", "windows", "linux"],
    bridges: [
      { type: "sse", url: "https://bridge.tonapi.io/bridge" },
      { type: "js", key: "tonkeeper" },
    ],
    universalUrl: "https://app.tonkeeper.com/ton-connect",
    deepLink: "tonkeeper-tc://",
  },
  {
    name: "MyTonWallet",
    appName: "mytonwallet",
    imageUrl: "https://static.mytonwallet.io/icon-256.png",
    aboutUrl: "https://mytonwallet.io",
    platforms: ["chrome", "windows", "macos", "linux", "ios", "android", "firefox"],
    bridges: [
      { type: "js", key: "mytonwallet" },
      { type: "sse", url: "https://tonconnectbridge.mytonwallet.org/bridge/" },
    ],
    universalUrl: "https://connect.mytonwallet.org",
    deepLink: "mytonwallet-tc://",
  },
  {
    name: "Wallet",
    appName: "telegram-wallet",
    imageUrl: "https://wallet.tg/images/logo-288.png",
    aboutUrl: "https://wallet.tg/",
    platforms: ["ios", "android", "macos", "windows", "linux"],
    bridges: [{ type: "sse", url: "https://walletbot.me/tonconnect-bridge/bridge" }],
    universalUrl: "https://t.me/wallet?attach=wallet",
  },
  {
    name: "Tonhub",
    appName: "tonhub",
    imageUrl: "https://tonhub.com/tonconnect_logo.png",
    aboutUrl: "https://tonhub.com",
    platforms: ["ios", "android"],
    bridges: [
      { type: "js", key: "tonhub" },
      { type: "sse", url: "https://connect.tonhubapi.com/tonconnect" },
    ],
    universalUrl: "https://tonhub.com/ton-connect",
  },
  {
    name: "Bitget Wallet",
    appName: "bitgetTonWallet",
    imageUrl:
      "https://raw.githubusercontent.com/bitgetwallet/download/refs/heads/main/logo/png/bitget_wallet_logo_288_mini.png",
    aboutUrl: "https://web3.bitget.com",
    platforms: ["ios", "android", "chrome"],
    bridges: [
      { type: "js", key: "bitgetTonWallet" },
      { type: "sse", url: "https://ton-connect-bridge.bgwapi.io/bridge" },
    ],
    universalUrl: "https://bkcode.vip/ton-connect",
    deepLink: "bitkeep://",
  },
  {
    name: "OKX Wallet",
    appName: "okxWallet",
    imageUrl:
      "https://static.okx.com/cdn/web3/assets/imgs/70d223c0-8527-40c1-8292-b3cc10b53d88.png",
    aboutUrl: "https://web3.okx.com",
    platforms: ["chrome", "safari", "firefox", "ios", "android"],
    bridges: [
      { type: "js", key: "okxTonWallet" },
      { type: "sse", url: "https://web3.okx.com/tonbridge/discover/rpc/bridge" },
    ],
    universalUrl:
      "https://web3.okx.com/download?appendQuery=true&deeplink=okxwallet://web3/wallet/tonconnect",
  },
  {
    name: "Binance Wallet",
    appName: "binanceWeb3TonWallet",
    imageUrl: "https://public.bnbstatic.com/static/binance-w3w/ton-provider/binancew3w.png",
    aboutUrl: "https://www.binance.com/en/web3wallet",
    platforms: ["ios", "android", "macos", "windows", "linux", "chrome"],
    bridges: [
      { type: "js", key: "binancew3w" },
      { type: "sse", url: "https://wallet.binance.com/tonbridge/bridge" },
    ],
    universalUrl: "https://app.binance.com/cedefi/ton-connect",
    deepLink: "bnc://app.binance.com/cedefi/ton-connect",
  },
  {
    name: "HOT",
    appName: "hot",
    imageUrl: "https://raw.githubusercontent.com/hot-dao/media/main/logo.png",
    aboutUrl: "https://hot-labs.org/",
    platforms: ["ios", "android", "macos", "windows", "linux"],
    bridges: [
      { type: "sse", url: "https://sse-bridge.hot-labs.org" },
      { type: "js", key: "hotWallet" },
    ],
    universalUrl: "https://t.me/herewalletbot?attach=wallet",
  },
  {
    name: "Bybit Wallet",
    appName: "bybitTonWallet",
    imageUrl:
      "https://raw.githubusercontent.com/bybit-web3/bybit-web3.github.io/main/docs/images/bybit-logo.png",
    aboutUrl: "https://www.bybit.com/web3",
    platforms: ["ios", "android", "chrome"],
    bridges: [
      { type: "js", key: "bybitTonWallet" },
      { type: "sse", url: "https://api-node.bybit.com/spot/api/web3/bridge/ton/bridge" },
    ],
    universalUrl: "https://app.bybit.com/ton-connect",
    deepLink: "bybitapp://",
  },
  {
    name: "DeWallet",
    appName: "dewallet",
    imageUrl: "https://raw.githubusercontent.com/delab-team/manifests-images/main/WalletAvatar.png",
    aboutUrl: "https://delabwallet.com",
    platforms: ["ios", "android", "macos", "windows", "linux"],
    bridges: [{ type: "sse", url: "https://bridge.dewallet.pro/bridge" }],
    universalUrl: "https://t.me/dewallet?attach=wallet",
  },
  {
    name: "SafePal",
    appName: "safepalwallet",
    imageUrl: "https://s.pvcliping.com/web/public_image/SafePal_x288.png",
    aboutUrl: "https://www.safepal.com",
    platforms: ["ios", "android", "chrome", "firefox"],
    bridges: [
      { type: "sse", url: "https://ton-bridge.safepal.com/tonbridge/v1/bridge" },
      { type: "js", key: "safepalwallet" },
    ],
    universalUrl: "https://link.safepal.io/ton-connect",
    deepLink: "safepal-tc://",
  },
  {
    name: "OpenMask",
    appName: "openmask",
    imageUrl:
      "https://raw.githubusercontent.com/OpenProduct/openmask-extension/main/public/openmask-logo-288.png",
    aboutUrl: "https://www.openmask.app/",
    platforms: ["chrome"],
    bridges: [{ type: "js", key: "openmask" }],
  },
];

const WALLETS_LIST_URL =
  "https://raw.githubusercontent.com/ton-blockchain/wallets-list/main/wallets-v2.json";

interface WalletsCacheEntry {
  wallets: TonWalletInfo[];
  fetchedAt: number;
}

let walletsCache: WalletsCacheEntry | null = null;

/**
 * Fetch the official TON Connect wallets list with caching.
 * Falls back to bundled snapshot if the fetch fails.
 *
 * @param cacheTTL - Cache duration in milliseconds (default: 1 hour)
 * @returns Array of wallet information
 */
export async function fetchTonWallets(cacheTTL: number = 3_600_000): Promise<TonWalletInfo[]> {
  const now = Date.now();
  if (walletsCache && now - walletsCache.fetchedAt < cacheTTL) {
    return walletsCache.wallets;
  }

  try {
    const response = await fetch(WALLETS_LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const wallets = parseWalletsList(data);
    walletsCache = { wallets, fetchedAt: now };
    return wallets;
  } catch {
    // Fallback to bundled snapshot
    return BUNDLED_WALLETS;
  }
}

/**
 * Get the bundled wallet list synchronously (no network request).
 *
 * @returns Bundled wallet list
 */
export function getBundledWallets(): TonWalletInfo[] {
  return BUNDLED_WALLETS;
}

/**
 * Reset the in-memory wallet cache.
 * Useful for testing or forcing a fresh fetch.
 */
export function resetWalletsCache(): void {
  walletsCache = null;
}

/**
 * Detect the current platform from the user agent string.
 *
 * @returns Detected platform category
 */
export function detectPlatform(): "ios" | "android" | "desktop" | "browser" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Browser extension platform values that map to "browser" filter
 */
const BROWSER_PLATFORMS = new Set<TonWalletPlatform>(["chrome", "firefox", "safari"]);

/**
 * Desktop platform values
 */
const DESKTOP_PLATFORMS = new Set<TonWalletPlatform>(["windows", "macos", "linux"]);

/**
 * Filter wallets by the detected platform.
 *
 * @param wallets - Full wallet list
 * @param platform - Target platform
 * @returns Wallets that support the given platform
 */
export function filterWalletsByPlatform(
  wallets: TonWalletInfo[],
  platform: "ios" | "android" | "desktop" | "browser",
): TonWalletInfo[] {
  return wallets.filter(wallet => {
    if (platform === "browser") {
      return wallet.platforms.some(p => BROWSER_PLATFORMS.has(p));
    }
    if (platform === "desktop") {
      return wallet.platforms.some(p => DESKTOP_PLATFORMS.has(p) || BROWSER_PLATFORMS.has(p));
    }
    return wallet.platforms.includes(platform);
  });
}

/**
 * Generate a deep link or universal link for a wallet.
 *
 * @param wallet - Wallet info
 * @param connectUrl - TON Connect session URL
 * @returns Link string, or null if the wallet has no link support
 */
export function generateWalletDeepLink(wallet: TonWalletInfo, connectUrl: string): string | null {
  const encodedUrl = encodeURIComponent(connectUrl);

  if (wallet.deepLink) {
    return `${wallet.deepLink}?v=2&id=${encodedUrl}`;
  }
  if (wallet.universalUrl) {
    const separator = wallet.universalUrl.includes("?") ? "&" : "?";
    return `${wallet.universalUrl}${separator}v=2&id=${encodedUrl}`;
  }
  return null;
}

/**
 * Parse the upstream wallets-v2.json format into TonWalletInfo[].
 */
export function parseWalletsList(data: unknown): TonWalletInfo[] {
  if (!Array.isArray(data)) return BUNDLED_WALLETS;

  const wallets: TonWalletInfo[] = [];

  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const name = typeof e.name === "string" ? e.name : "";
    const appName = typeof e.app_name === "string" ? e.app_name : "";
    const imageUrl = typeof e.image === "string" ? e.image : "";
    const aboutUrl = typeof e.about_url === "string" ? e.about_url : "";

    if (!name || !appName) continue;

    const platforms: TonWalletPlatform[] = [];
    if (Array.isArray(e.platforms)) {
      for (const p of e.platforms) {
        if (typeof p === "string") {
          platforms.push(p as TonWalletPlatform);
        }
      }
    }

    const bridges: TonWalletBridge[] = [];
    if (Array.isArray(e.bridge)) {
      for (const b of e.bridge) {
        if (!b || typeof b !== "object") continue;
        const bridge = b as Record<string, unknown>;
        if (bridge.type === "sse" && typeof bridge.url === "string") {
          bridges.push({ type: "sse", url: bridge.url });
        } else if (bridge.type === "js" && typeof bridge.key === "string") {
          bridges.push({ type: "js", key: bridge.key });
        }
      }
    }

    const universalUrl = typeof e.universal_url === "string" ? e.universal_url : undefined;
    const deepLink = typeof e.deepLink === "string" ? e.deepLink : undefined;

    wallets.push({
      name,
      appName,
      imageUrl,
      aboutUrl,
      platforms,
      bridges,
      universalUrl,
      deepLink,
    });
  }

  return wallets.length > 0 ? wallets : BUNDLED_WALLETS;
}

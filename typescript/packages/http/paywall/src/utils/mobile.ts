/**
 * Mobile detection utilities for optimizing wallet connection experience
 */

/**
 * Check if the current device is a mobile device
 */
export function isMobile(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Check for mobile user agent patterns
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;

  return mobileRegex.test(navigator.userAgent);
}

/**
 * Check if the device is iOS
 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Check if the device is Android
 */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent);
}

/**
 * Check if running inside a mobile wallet browser (in-app browser)
 */
export function isInWalletBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check for common wallet browser indicators
  const hasEthereum = "ethereum" in window;
  const hasTronWeb = "tronWeb" in window;
  const hasSolana = "solana" in window;
  const hasTonConnect = "tonconnect" in window;

  // If on mobile and has wallet provider, likely in wallet browser
  return isMobile() && (hasEthereum || hasTronWeb || hasSolana || hasTonConnect);
}

/**
 * Check if the device supports touch
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get the wallet deep link URL for a given wallet on mobile
 */
export function getWalletDeepLink(
  walletId: "metamask" | "coinbase" | "rainbow" | "trust",
  url: string,
): string {
  const encodedUrl = encodeURIComponent(url);

  switch (walletId) {
    case "metamask":
      return `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`;
    case "coinbase":
      return `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`;
    case "rainbow":
      return `https://rnbwapp.com/dapp?url=${encodedUrl}`;
    case "trust":
      return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodedUrl}`;
    default:
      return url;
  }
}

/**
 * Open the current page in a wallet's in-app browser
 */
export function openInWallet(walletId: "metamask" | "coinbase" | "rainbow" | "trust"): void {
  const currentUrl = window.location.href;
  const deepLink = getWalletDeepLink(walletId, currentUrl);
  window.location.href = deepLink;
}

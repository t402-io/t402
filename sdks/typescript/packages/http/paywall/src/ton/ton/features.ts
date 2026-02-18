import type { Wallet } from "./types";

// TODO: Once @ton/appkit is published, update any appkit-specific
// feature detection here. The current API is compatible with both providers.

/**
 * Wallet info type (compatible with both providers)
 */
interface WalletInfo {
  name: string;
  appName: string;
  imageUrl?: string;
  aboutUrl: string;
}

/**
 * Check if wallet supports sending transactions
 *
 * @param wallet - Connected wallet
 * @returns True if wallet can send transactions
 */
export function canSendTransaction(wallet: Wallet | null): boolean {
  return wallet !== null && wallet.account !== undefined;
}

/**
 * Get wallet display info
 *
 * @param wallet - Connected wallet
 * @returns Wallet display information
 */
export function getWalletDisplayInfo(wallet: Wallet): WalletInfo | null {
  if (!wallet.device) {
    return null;
  }

  return {
    name: wallet.device.appName,
    appName: wallet.device.appName,
    imageUrl:
      wallet.device.appName === "Tonkeeper"
        ? "https://tonkeeper.com/assets/tonconnect-icon.png"
        : undefined,
    aboutUrl: "",
  };
}

/**
 * Determine chain from wallet
 *
 * @param wallet - Connected wallet
 * @returns Chain identifier (-239 for mainnet, -3 for testnet)
 */
export function getWalletChain(wallet: Wallet): number {
  // TonConnect wallet.account.chain is the workchain
  // -239 is mainnet, -3 is testnet
  return wallet.account?.chain === "-239" ? -239 : -3;
}

/**
 * Check if wallet is on mainnet
 *
 * @param wallet - Connected wallet
 * @returns True if on mainnet
 */
export function isMainnetWallet(wallet: Wallet): boolean {
  return getWalletChain(wallet) === -239;
}

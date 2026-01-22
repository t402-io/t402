import type { Wallet, WalletInfo } from "@tonconnect/ui-react";

/**
 * Check if wallet supports sending transactions
 *
 * @param wallet - TonConnect wallet
 * @returns True if wallet can send transactions
 */
export function canSendTransaction(wallet: Wallet | null): boolean {
  return wallet !== null && wallet.account !== undefined;
}

/**
 * Get wallet display info
 *
 * @param wallet - TonConnect wallet
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
    tondns: undefined,
    platforms: [],
  } as unknown as WalletInfo;
}

/**
 * Determine chain from wallet
 *
 * @param wallet - TonConnect wallet
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
 * @param wallet - TonConnect wallet
 * @returns True if on mainnet
 */
export function isMainnetWallet(wallet: Wallet): boolean {
  return getWalletChain(wallet) === -239;
}

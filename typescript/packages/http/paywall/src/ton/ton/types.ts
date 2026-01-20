import type { TonConnectUI, Wallet } from "@tonconnect/ui-react";

/**
 * TON network identifiers (CAIP-2 format)
 */
export const TON_NETWORKS = {
  MAINNET: "ton:mainnet",
  TESTNET: "ton:testnet",
} as const;

export type TonNetwork = (typeof TON_NETWORKS)[keyof typeof TON_NETWORKS];

/**
 * USDT Jetton master addresses for TON networks
 */
export const USDT_JETTON_ADDRESSES = {
  [TON_NETWORKS.MAINNET]: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  [TON_NETWORKS.TESTNET]: "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
} as const;

/**
 * TonConnect wallet option for UI display
 */
export interface TonWalletOption {
  /** Display name of the wallet */
  name: string;
  /** Wallet app URL */
  appUrl: string;
  /** Icon URL for the wallet */
  iconUrl: string;
}

/**
 * Connected TON wallet state
 */
export interface ConnectedTonWallet {
  /** TonConnect UI instance */
  tonConnectUI: TonConnectUI;
  /** Connected wallet info */
  wallet: Wallet;
  /** Wallet address (raw format) */
  address: string;
  /** User-friendly address format */
  friendlyAddress: string;
}

/**
 * TON RPC endpoints
 */
export const TON_RPC_ENDPOINTS = {
  [TON_NETWORKS.MAINNET]: "https://toncenter.com/api/v2/jsonRPC",
  [TON_NETWORKS.TESTNET]: "https://testnet.toncenter.com/api/v2/jsonRPC",
} as const;

/**
 * Jetton operation codes (TEP-74)
 */
export const JETTON_OPS = {
  TRANSFER: 0x0f8a7ea5,
  INTERNAL_TRANSFER: 0x178d4519,
  TRANSFER_NOTIFICATION: 0x7362d09c,
  BURN: 0x595f07bc,
} as const;

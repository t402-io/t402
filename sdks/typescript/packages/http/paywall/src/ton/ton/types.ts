// Types compatible with both @ton/appkit@0.0.8+ and @tonconnect/ui-react.
// When @ton/appkit-react is installed, its native hooks provide WalletInterface
// objects. These local types preserve backward compatibility with @tonconnect/ui-react.

/**
 * Wallet type (compatible with both @ton/appkit and @tonconnect/ui-react)
 */
export type Wallet = {
  account?: {
    address: string;
    chain?: string;
  };
  device?: {
    appName: string;
  };
};

/**
 * UI instance type (compatible with both providers)
 *
 * TransactionRequest in @ton/appkit@0.0.8 uses `TokenAmount` (string) for
 * `amount` and adds optional `network`, `fromAddress`, and `extraCurrency`
 * fields.  The shape below is the intersection that works with both
 * @tonconnect/ui-react's sendTransaction and @ton/appkit's sendTransaction.
 */
export type TonConnectUI = {
  openModal: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (request: {
    validUntil?: number;
    network?: string;
    fromAddress?: string;
    messages: Array<{
      address: string;
      amount: string;
      payload?: string;
      stateInit?: string;
    }>;
  }) => Promise<{ boc: string }>;
};

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
  [TON_NETWORKS.TESTNET]: "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy",
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
  /** UI instance */
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

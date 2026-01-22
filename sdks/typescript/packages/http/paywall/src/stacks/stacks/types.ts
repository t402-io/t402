/**
 * Stacks network identifiers (CAIP-2 format)
 * Stacks uses chain IDs: 1 for mainnet, 2147483648 for testnet
 */
export const STACKS_NETWORKS = {
  MAINNET: "stacks:1",
  TESTNET: "stacks:2147483648",
} as const;

export type StacksNetwork = (typeof STACKS_NETWORKS)[keyof typeof STACKS_NETWORKS];

/**
 * Stacks network chain IDs
 */
export const STACKS_CHAIN_IDS = {
  [STACKS_NETWORKS.MAINNET]: 1,
  [STACKS_NETWORKS.TESTNET]: 2147483648,
} as const;

/**
 * sUSDC contract addresses on Stacks
 * sUSDC is the bridged USDC on Stacks via the Stacks Bridge
 */
export const USDC_CONTRACT_ADDRESSES = {
  // sUSDC on mainnet (Alex Bridge)
  [STACKS_NETWORKS.MAINNET]: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
  // Test token on testnet
  [STACKS_NETWORKS.TESTNET]: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
} as const;

/**
 * Stacks API endpoints
 */
export const STACKS_API_ENDPOINTS = {
  [STACKS_NETWORKS.MAINNET]: "https://api.mainnet.hiro.so",
  [STACKS_NETWORKS.TESTNET]: "https://api.testnet.hiro.so",
} as const;

/**
 * Stacks explorer URLs
 */
export const STACKS_EXPLORER_URLS = {
  [STACKS_NETWORKS.MAINNET]: "https://explorer.hiro.so",
  [STACKS_NETWORKS.TESTNET]: "https://explorer.hiro.so/?chain=testnet",
} as const;

/**
 * Supported Stacks wallets
 */
export type StacksWalletId = "leather" | "xverse";

export const STACKS_WALLETS: Record<StacksWalletId, { name: string; installUrl: string }> = {
  leather: {
    name: "Leather",
    installUrl: "https://leather.io/install-extension",
  },
  xverse: {
    name: "Xverse",
    installUrl: "https://www.xverse.app/download",
  },
};

/**
 * Stacks address (principal) type
 */
export type StacksPrincipal = string;

/**
 * Stacks account info
 */
export interface StacksAccount {
  /** STX address (principal) */
  address: StacksPrincipal;
  /** Public key */
  publicKey?: string;
}

/**
 * SIP-010 fungible token info
 */
export interface Sip010Token {
  /** Contract identifier (e.g., "SP...abc.token-name") */
  contractId: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Decimal places */
  decimals: number;
}

/**
 * Token balance response
 */
export interface TokenBalance {
  balance: string;
  total_sent: string;
  total_received: string;
}

/**
 * Stacks transaction result
 */
export interface StacksTransactionResult {
  txId: string;
  txRaw: string;
}

/**
 * Provider request types for wallet connection
 */
export interface StacksProvider {
  /** Check if wallet is installed */
  isInstalled(): boolean;
  /** Connect to wallet */
  connect(): Promise<StacksAccount>;
  /** Disconnect from wallet */
  disconnect(): Promise<void>;
  /** Sign and broadcast a transaction */
  signTransaction(options: SignTransactionOptions): Promise<StacksTransactionResult>;
  /** Get current account */
  getAccount(): StacksAccount | null;
}

/**
 * Options for signing a transaction
 */
export interface SignTransactionOptions {
  /** Contract call function name */
  functionName: string;
  /** Contract address */
  contractAddress: string;
  /** Contract name */
  contractName: string;
  /** Function arguments */
  functionArgs: unknown[];
  /** Post conditions for safety */
  postConditions?: unknown[];
  /** Network to use */
  network: StacksNetwork;
}

/**
 * Window augmentation for Stacks wallets
 */
declare global {
  interface Window {
    /** Leather wallet provider */
    LeatherProvider?: {
      request(method: string, params?: unknown): Promise<unknown>;
    };
    /** Hiro wallet provider (legacy Leather) */
    HiroWalletProvider?: {
      request(method: string, params?: unknown): Promise<unknown>;
    };
    /** Xverse wallet provider */
    XverseProviders?: {
      StacksProvider?: {
        request(method: string, params?: unknown): Promise<unknown>;
      };
    };
  }
}

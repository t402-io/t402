/**
 * NEAR network identifiers (CAIP-2 format)
 */
export const NEAR_NETWORKS = {
  MAINNET: "near:mainnet",
  TESTNET: "near:testnet",
} as const;

export type NearNetwork = (typeof NEAR_NETWORKS)[keyof typeof NEAR_NETWORKS];

/**
 * NEAR network IDs for wallet connection
 */
export const NEAR_NETWORK_IDS = {
  [NEAR_NETWORKS.MAINNET]: "mainnet",
  [NEAR_NETWORKS.TESTNET]: "testnet",
} as const;

/**
 * USDC contract addresses on NEAR
 * Mainnet: Bridged USDC via Rainbow Bridge
 * Testnet: Fake USDC for testing
 */
export const USDC_CONTRACT_ADDRESSES = {
  [NEAR_NETWORKS.MAINNET]: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  [NEAR_NETWORKS.TESTNET]: "usdc.fakes.testnet",
} as const;

/**
 * NEAR RPC endpoints
 */
export const NEAR_RPC_ENDPOINTS = {
  [NEAR_NETWORKS.MAINNET]: "https://rpc.mainnet.near.org",
  [NEAR_NETWORKS.TESTNET]: "https://rpc.testnet.near.org",
} as const;

/**
 * Connected NEAR account
 */
export interface NearAccount {
  /** Account ID (e.g., "alice.near") */
  accountId: string;
  /** Public key (if available) */
  publicKey?: string;
  /** Wallet name */
  walletName: string;
}

/**
 * NEAR wallet provider interface (simplified for browser wallets)
 */
export interface NearWalletProvider {
  /** Check if wallet is installed */
  isInstalled(): boolean;
  /** Connect to wallet */
  connect(): Promise<NearAccount>;
  /** Disconnect from wallet */
  disconnect(): Promise<void>;
  /** Sign and send a transaction */
  signAndSendTransaction(params: {
    receiverId: string;
    actions: NearAction[];
  }): Promise<{ transaction: { hash: string } }>;
}

/**
 * NEAR action types
 */
export interface NearAction {
  type: "FunctionCall";
  params: {
    methodName: string;
    args: Record<string, unknown>;
    gas: string;
    deposit: string;
  };
}

/**
 * MyNearWallet window interface
 */
export interface MyNearWalletWindow {
  near?: {
    isSignedIn(): boolean;
    getAccountId(): string;
    requestSignIn(params: { contractId?: string; methodNames?: string[] }): Promise<void>;
    signOut(): Promise<void>;
    signAndSendTransaction(params: {
      receiverId: string;
      actions: Array<{
        type: string;
        params: {
          methodName: string;
          args: Record<string, unknown>;
          gas: string;
          deposit: string;
        };
      }>;
    }): Promise<{ transaction: { hash: string } }>;
  };
}

/**
 * Meteor wallet window interface
 */
export interface MeteorWalletWindow {
  meteorWallet?: {
    isSignedIn(): Promise<boolean>;
    getAccountId(): Promise<string>;
    signIn(): Promise<{ accountId: string }>;
    signOut(): Promise<void>;
    signAndSendTransaction(params: {
      receiverId: string;
      actions: Array<{
        type: string;
        params: {
          methodName: string;
          args: Record<string, unknown>;
          gas: string;
          deposit: string;
        };
      }>;
    }): Promise<{ transaction: { hash: string } }>;
  };
}

// Extend window interface for NEAR wallets
declare global {
  interface Window {
    near?: MyNearWalletWindow["near"];
    meteorWallet?: MeteorWalletWindow["meteorWallet"];
  }
}

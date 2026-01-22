/**
 * Cosmos/Noble network identifiers (CAIP-2 format)
 */
export const COSMOS_NETWORKS = {
  NOBLE_MAINNET: "cosmos:noble-1",
  NOBLE_TESTNET: "cosmos:grand-1", // Noble Grand testnet
} as const;

export type CosmosNetwork = (typeof COSMOS_NETWORKS)[keyof typeof COSMOS_NETWORKS];

/**
 * Chain IDs for Noble networks
 */
export const NOBLE_CHAIN_IDS = {
  [COSMOS_NETWORKS.NOBLE_MAINNET]: "noble-1",
  [COSMOS_NETWORKS.NOBLE_TESTNET]: "grand-1",
} as const;

/**
 * USDC denom on Noble (native USDC)
 */
export const USDC_DENOM = "uusdc"; // micro-USDC (6 decimals)

/**
 * Noble RPC endpoints
 */
export const NOBLE_RPC_ENDPOINTS = {
  [COSMOS_NETWORKS.NOBLE_MAINNET]: "https://noble-rpc.polkachu.com",
  [COSMOS_NETWORKS.NOBLE_TESTNET]: "https://rpc.testnet.noble.strange.love",
} as const;

/**
 * Noble REST endpoints
 */
export const NOBLE_REST_ENDPOINTS = {
  [COSMOS_NETWORKS.NOBLE_MAINNET]: "https://noble-api.polkachu.com",
  [COSMOS_NETWORKS.NOBLE_TESTNET]: "https://api.testnet.noble.strange.love",
} as const;

/**
 * Connected Cosmos account
 */
export interface CosmosAccount {
  /** Bech32 address */
  address: string;
  /** Public key (hex) */
  pubKey?: string;
  /** Wallet name */
  walletName: string;
}

/**
 * Keplr window extension types
 */
export interface KeplrWindow {
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{
    name: string;
    algo: string;
    pubKey: Uint8Array;
    address: Uint8Array;
    bech32Address: string;
    isNanoLedger: boolean;
  }>;
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>;
  signDirect(
    chainId: string,
    signer: string,
    signDoc: SignDoc,
  ): Promise<{
    signed: SignDoc;
    signature: { signature: string; pub_key: { type: string; value: string } };
  }>;
  sendTx(chainId: string, tx: Uint8Array, mode: "sync" | "async" | "block"): Promise<Uint8Array>;
}

export interface LeapWindow {
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{
    name: string;
    algo: string;
    pubKey: Uint8Array;
    address: Uint8Array;
    bech32Address: string;
    isNanoLedger: boolean;
  }>;
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>;
  signDirect(
    chainId: string,
    signer: string,
    signDoc: SignDoc,
  ): Promise<{
    signed: SignDoc;
    signature: { signature: string; pub_key: { type: string; value: string } };
  }>;
  sendTx(chainId: string, tx: Uint8Array, mode: "sync" | "async" | "block"): Promise<Uint8Array>;
}

export interface ChainInfo {
  chainId: string;
  chainName: string;
  rpc: string;
  rest: string;
  bip44: { coinType: number };
  bech32Config: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
  currencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
  }>;
  feeCurrencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    gasPriceStep?: { low: number; average: number; high: number };
  }>;
  stakeCurrency: {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
  };
}

export interface SignDoc {
  bodyBytes: Uint8Array;
  authInfoBytes: Uint8Array;
  chainId: string;
  accountNumber: string;
}

// Extend window interface for Cosmos wallets
declare global {
  interface Window {
    keplr?: KeplrWindow;
    leap?: LeapWindow;
  }
}

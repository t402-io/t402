/**
 * TRON network identifiers (CAIP-2 format)
 */
export const TRON_NETWORKS = {
  MAINNET: "tron:mainnet",
  NILE: "tron:nile",
  SHASTA: "tron:shasta",
} as const;

export type TronNetwork = (typeof TRON_NETWORKS)[keyof typeof TRON_NETWORKS];

/**
 * USDT TRC-20 contract addresses for TRON networks
 */
export const USDT_CONTRACT_ADDRESSES = {
  [TRON_NETWORKS.MAINNET]: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  [TRON_NETWORKS.NILE]: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
  [TRON_NETWORKS.SHASTA]: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs",
} as const;

/**
 * TRON RPC endpoints
 */
export const TRON_RPC_ENDPOINTS = {
  [TRON_NETWORKS.MAINNET]: "https://api.trongrid.io",
  [TRON_NETWORKS.NILE]: "https://nile.trongrid.io",
  [TRON_NETWORKS.SHASTA]: "https://api.shasta.trongrid.io",
} as const;

/**
 * TronWeb instance type (injected by TronLink)
 */
export interface TronWeb {
  ready: boolean;
  defaultAddress: {
    base58: string;
    hex: string;
  };
  trx: {
    getBlock(blockNumber: number | "latest"): Promise<TronBlock>;
    sign(transaction: unknown): Promise<SignedTransaction>;
    getAccount(address: string): Promise<TronAccount>;
  };
  transactionBuilder: {
    triggerSmartContract(
      contractAddress: string,
      functionSelector: string,
      options: { feeLimit?: number; callValue?: number },
      parameters: Array<{ type: string; value: unknown }>,
      issuerAddress: string,
    ): Promise<{ transaction: unknown; result: { result: boolean } }>;
  };
  address: {
    fromHex(hex: string): string;
    toHex(base58: string): string;
  };
  contract(): {
    at(address: string): Promise<TronContract>;
  };
  toHex(str: string): string;
  fromUtf8(str: string): string;
}

/**
 * TRON block structure
 */
export interface TronBlock {
  blockID: string;
  block_header: {
    raw_data: {
      timestamp: number;
      number: number;
    };
  };
}

/**
 * Signed transaction structure
 */
export interface SignedTransaction {
  txID: string;
  raw_data: unknown;
  raw_data_hex: string;
  signature: string[];
}

/**
 * TRON account structure
 */
export interface TronAccount {
  address: string;
  balance: number;
  create_time: number;
}

/**
 * TRC-20 contract interface
 */
export interface TronContract {
  balanceOf(address: string): {
    call(): Promise<{ _hex?: string; toNumber?: () => number } | string | number>;
  };
  decimals(): {
    call(): Promise<number>;
  };
}

/**
 * Window with TronLink injection
 */
declare global {
  interface Window {
    tronWeb?: TronWeb;
    tronLink?: {
      ready: boolean;
      request(params: { method: string }): Promise<unknown>;
    };
  }
}

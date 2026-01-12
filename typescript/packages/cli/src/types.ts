/**
 * CLI configuration stored in user config file
 */
export interface CliConfig {
  /** Default network to use */
  defaultNetwork: string;
  /** Facilitator URL */
  facilitatorUrl: string;
  /** Whether to use testnet networks */
  testnet: boolean;
  /** Encrypted seed phrase (optional) */
  encryptedSeed?: string;
  /** Custom RPC endpoints by network */
  rpcEndpoints: Record<string, string>;
}

/**
 * Wallet information
 */
export interface WalletInfo {
  /** Wallet addresses by network type */
  addresses: {
    evm?: string;
    solana?: string;
    ton?: string;
    tron?: string;
  };
  /** Whether the wallet has a seed configured */
  hasSeed: boolean;
}

/**
 * Balance result for a specific network
 */
export interface BalanceResult {
  network: string;
  asset: string;
  balance: string;
  formatted: string;
  address: string;
}

/**
 * Payment result
 */
export interface PaymentResult {
  success: boolean;
  txHash?: string;
  network?: string;
  amount?: string;
  error?: string;
}

/**
 * Supported network information
 */
export interface NetworkInfo {
  id: string;
  name: string;
  type: "evm" | "solana" | "ton" | "tron";
  testnet: boolean;
  assets: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: CliConfig = {
  defaultNetwork: "eip155:8453",
  facilitatorUrl: "https://facilitator.t402.io",
  testnet: false,
  rpcEndpoints: {},
};

/**
 * Supported networks
 */
export const NETWORKS: NetworkInfo[] = [
  // EVM Mainnets
  { id: "eip155:1", name: "Ethereum", type: "evm", testnet: false, assets: ["usdt", "usdt0"] },
  { id: "eip155:42161", name: "Arbitrum", type: "evm", testnet: false, assets: ["usdt0"] },
  { id: "eip155:8453", name: "Base", type: "evm", testnet: false, assets: ["usdt0"] },
  { id: "eip155:10", name: "Optimism", type: "evm", testnet: false, assets: ["usdt0"] },
  { id: "eip155:57073", name: "Ink", type: "evm", testnet: false, assets: ["usdt0"] },
  { id: "eip155:80094", name: "Berachain", type: "evm", testnet: false, assets: ["usdt0"] },
  // EVM Testnets
  { id: "eip155:11155111", name: "Sepolia", type: "evm", testnet: true, assets: ["usdt0"] },
  { id: "eip155:421614", name: "Arbitrum Sepolia", type: "evm", testnet: true, assets: ["usdt0"] },
  { id: "eip155:84532", name: "Base Sepolia", type: "evm", testnet: true, assets: ["usdt0"] },
  // Solana
  {
    id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    name: "Solana",
    type: "solana",
    testnet: false,
    assets: ["usdt"],
  },
  {
    id: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    name: "Solana Devnet",
    type: "solana",
    testnet: true,
    assets: ["usdt"],
  },
  // TON
  { id: "ton:-239", name: "TON", type: "ton", testnet: false, assets: ["usdt"] },
  { id: "ton:-3", name: "TON Testnet", type: "ton", testnet: true, assets: ["usdt"] },
  // TRON
  { id: "tron:mainnet", name: "TRON", type: "tron", testnet: false, assets: ["usdt"] },
  { id: "tron:nile", name: "TRON Nile", type: "tron", testnet: true, assets: ["usdt"] },
];

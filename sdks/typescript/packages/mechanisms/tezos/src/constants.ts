/**
 * Tezos mechanism constants
 */

// Scheme identifiers
export const SCHEME_EXACT_DIRECT = "exact-direct";

// CAIP-2 namespace
export const TEZOS_CAIP2_NAMESPACE = "tezos";

// CAIP-2 network identifiers (derived from genesis block hash)
export const TEZOS_MAINNET_CAIP2 = "tezos:NetXdQprcVkpaWU";
export const TEZOS_GHOSTNET_CAIP2 = "tezos:NetXnHfVqm9iesp";

// Default RPC endpoints
export const DEFAULT_MAINNET_RPC = "https://mainnet.api.tez.ie";
export const DEFAULT_GHOSTNET_RPC = "https://ghostnet.tezos.marigold.dev";

// Default indexer API endpoints (TzKT)
export const DEFAULT_MAINNET_INDEXER = "https://api.tzkt.io";
export const DEFAULT_GHOSTNET_INDEXER = "https://api.ghostnet.tzkt.io";

// FA2 token standard (TZIP-12)
export const FA2_TRANSFER_ENTRYPOINT = "transfer";
export const FA2_BALANCE_OF_ENTRYPOINT = "balance_of";
export const FA2_UPDATE_OPERATORS_ENTRYPOINT = "update_operators";

// Supported networks
export const SUPPORTED_NETWORKS = [
  TEZOS_MAINNET_CAIP2,
  TEZOS_GHOSTNET_CAIP2,
] as const;

// Network configurations
export const NETWORK_CONFIGS: Record<
  string,
  {
    name: string;
    rpcUrl: string;
    indexerUrl: string;
  }
> = {
  [TEZOS_MAINNET_CAIP2]: {
    name: "Tezos Mainnet",
    rpcUrl: DEFAULT_MAINNET_RPC,
    indexerUrl: DEFAULT_MAINNET_INDEXER,
  },
  [TEZOS_GHOSTNET_CAIP2]: {
    name: "Tezos Ghostnet",
    rpcUrl: DEFAULT_GHOSTNET_RPC,
    indexerUrl: DEFAULT_GHOSTNET_INDEXER,
  },
};

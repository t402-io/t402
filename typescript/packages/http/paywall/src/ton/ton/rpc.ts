import { TonClient } from "@ton/ton";
import { TON_NETWORKS, TON_RPC_ENDPOINTS, type TonNetwork } from "./types";

let mainnetClient: TonClient | null = null;
let testnetClient: TonClient | null = null;

/**
 * Creates or returns cached TonClient for mainnet
 */
export function getMainnetClient(): TonClient {
  if (!mainnetClient) {
    mainnetClient = new TonClient({
      endpoint: TON_RPC_ENDPOINTS[TON_NETWORKS.MAINNET],
    });
  }
  return mainnetClient;
}

/**
 * Creates or returns cached TonClient for testnet
 */
export function getTestnetClient(): TonClient {
  if (!testnetClient) {
    testnetClient = new TonClient({
      endpoint: TON_RPC_ENDPOINTS[TON_NETWORKS.TESTNET],
    });
  }
  return testnetClient;
}

/**
 * Gets TonClient for the specified network
 *
 * @param network - TON network identifier (CAIP-2 format)
 * @returns TonClient instance
 */
export function getTonClient(network: string): TonClient {
  if (network === TON_NETWORKS.MAINNET) {
    return getMainnetClient();
  }
  return getTestnetClient();
}

/**
 * Determines if the network is TON mainnet
 *
 * @param network - Network identifier
 * @returns True if mainnet
 */
export function isTonMainnet(network: string): boolean {
  return network === TON_NETWORKS.MAINNET;
}

/**
 * Gets the target TON network for a given CAIP-2 network string
 *
 * @param network - CAIP-2 network string
 * @returns Normalized TON network
 */
export function getTargetTonNetwork(network: string): TonNetwork {
  return network === TON_NETWORKS.MAINNET ? TON_NETWORKS.MAINNET : TON_NETWORKS.TESTNET;
}

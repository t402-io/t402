import {
  STACKS_NETWORKS,
  STACKS_API_ENDPOINTS,
  USDC_CONTRACT_ADDRESSES,
  type StacksNetwork,
  type TokenBalance,
} from "./types";

/**
 * Gets the API endpoint for a Stacks network
 *
 * @param network - Stacks network identifier (CAIP-2 format)
 * @returns API endpoint URL
 */
export function getStacksEndpoint(network: string): string {
  if (network === STACKS_NETWORKS.MAINNET) {
    return STACKS_API_ENDPOINTS[STACKS_NETWORKS.MAINNET];
  }
  return STACKS_API_ENDPOINTS[STACKS_NETWORKS.TESTNET];
}

/**
 * Determines if the network is Stacks mainnet
 *
 * @param network - Network identifier
 * @returns True if mainnet
 */
export function isStacksMainnet(network: string): boolean {
  return network === STACKS_NETWORKS.MAINNET;
}

/**
 * Gets the target Stacks network for a given CAIP-2 network string
 *
 * @param network - CAIP-2 network string
 * @returns Normalized Stacks network
 */
export function getTargetStacksNetwork(network: string): StacksNetwork {
  if (network === STACKS_NETWORKS.MAINNET) {
    return STACKS_NETWORKS.MAINNET;
  }
  return STACKS_NETWORKS.TESTNET;
}

/**
 * Gets the USDC contract address for a network
 *
 * @param network - Stacks network
 * @returns Contract address
 */
export function getUsdcContractAddress(network: StacksNetwork): string {
  return USDC_CONTRACT_ADDRESSES[network];
}

/**
 * Parse contract identifier into address and name
 *
 * @param contractId - Full contract identifier (e.g., "SP...abc.token-name")
 * @returns Object with address and name
 */
export function parseContractId(contractId: string): { address: string; name: string } {
  const parts = contractId.split(".");
  if (parts.length !== 2) {
    throw new Error(`Invalid contract ID: ${contractId}`);
  }
  return {
    address: parts[0],
    name: parts[1],
  };
}

/**
 * Check if Leather wallet is installed
 *
 * @returns True if Leather is available
 */
export function isLeatherInstalled(): boolean {
  return typeof window !== "undefined" && (!!window.LeatherProvider || !!window.HiroWalletProvider);
}

/**
 * Check if Xverse wallet is installed
 *
 * @returns True if Xverse is available
 */
export function isXverseInstalled(): boolean {
  return typeof window !== "undefined" && !!window.XverseProviders?.StacksProvider;
}

/**
 * Check if any Stacks wallet is installed
 *
 * @returns True if any wallet is available
 */
export function isStacksWalletInstalled(): boolean {
  return isLeatherInstalled() || isXverseInstalled();
}

/**
 * Get available Stacks wallets
 *
 * @returns List of available wallet IDs
 */
export function getAvailableWallets(): ("leather" | "xverse")[] {
  const wallets: ("leather" | "xverse")[] = [];
  if (isLeatherInstalled()) wallets.push("leather");
  if (isXverseInstalled()) wallets.push("xverse");
  return wallets;
}

/**
 * Fetch token balance for an address
 *
 * @param address - Stacks address
 * @param contractId - Token contract identifier
 * @param network - Target network
 * @returns Token balance info
 */
export async function fetchTokenBalance(
  address: string,
  contractId: string,
  network: StacksNetwork,
): Promise<TokenBalance | null> {
  const endpoint = getStacksEndpoint(network);

  try {
    const response = await fetch(`${endpoint}/extended/v1/address/${address}/balances`);

    if (!response.ok) {
      console.error("Failed to fetch balance:", response.status);
      return null;
    }

    const data = await response.json();

    // Look for the token in fungible tokens
    const tokenKey = Object.keys(data.fungible_tokens || {}).find(
      key => key.toLowerCase() === contractId.toLowerCase(),
    );

    if (tokenKey && data.fungible_tokens[tokenKey]) {
      return data.fungible_tokens[tokenKey] as TokenBalance;
    }

    return null;
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return null;
  }
}

/**
 * Fetch account info including STX balance
 *
 * @param address - Stacks address
 * @param network - Target network
 * @returns Account info
 */
export async function fetchAccountInfo(
  address: string,
  network: StacksNetwork,
): Promise<{ balance: string; nonce: number } | null> {
  const endpoint = getStacksEndpoint(network);

  try {
    const response = await fetch(`${endpoint}/extended/v1/address/${address}/stx`);

    if (!response.ok) {
      console.error("Failed to fetch account info:", response.status);
      return null;
    }

    const data = await response.json();
    return {
      balance: data.balance || "0",
      nonce: data.nonce || 0,
    };
  } catch (error) {
    console.error("Error fetching account info:", error);
    return null;
  }
}

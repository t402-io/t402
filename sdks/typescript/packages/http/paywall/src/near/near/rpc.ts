import {
  type NearNetwork,
  NEAR_RPC_ENDPOINTS,
  NEAR_NETWORK_IDS,
  USDC_CONTRACT_ADDRESSES,
} from "./types";

/**
 * Get the RPC endpoint for a NEAR network
 */
export function getRpcEndpoint(network: NearNetwork): string {
  return NEAR_RPC_ENDPOINTS[network] || NEAR_RPC_ENDPOINTS["near:mainnet"];
}

/**
 * Get the network ID for a NEAR network
 */
export function getNetworkId(network: NearNetwork): string {
  return NEAR_NETWORK_IDS[network] || "mainnet";
}

/**
 * Get the USDC contract address for a NEAR network
 */
export function getUsdcContractAddress(network: NearNetwork): string {
  return USDC_CONTRACT_ADDRESSES[network] || USDC_CONTRACT_ADDRESSES["near:mainnet"];
}

/**
 * Make a JSON-RPC call to NEAR
 */
async function rpcCall<T>(
  network: NearNetwork,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const endpoint = getRpcEndpoint(network);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method,
      params,
    }),
  });

  const data = (await response.json()) as {
    result?: T;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result as T;
}

/**
 * Fetch USDC balance for an account on NEAR
 * USDC on NEAR uses NEP-141 (fungible token standard)
 */
export async function fetchUsdcBalance(accountId: string, network: NearNetwork): Promise<bigint> {
  const contractId = getUsdcContractAddress(network);

  try {
    const result = await rpcCall<{ result: number[] }>(network, "query", {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: "ft_balance_of",
      args_base64: btoa(JSON.stringify({ account_id: accountId })),
    });

    // Result is a byte array representing the JSON response
    const bytes = new Uint8Array(result.result);
    const text = new TextDecoder().decode(bytes);
    // Remove quotes from JSON string response
    const balance = text.replace(/"/g, "");
    return BigInt(balance);
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    return 0n;
  }
}

/**
 * Check if an account exists on NEAR
 */
export async function accountExists(accountId: string, network: NearNetwork): Promise<boolean> {
  try {
    await rpcCall(network, "query", {
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get access key for an account
 */
export async function getAccessKeys(
  accountId: string,
  network: NearNetwork,
): Promise<Array<{ public_key: string; access_key: { permission: string } }>> {
  try {
    const result = await rpcCall<{
      keys: Array<{ public_key: string; access_key: { permission: string } }>;
    }>(network, "query", {
      request_type: "view_access_key_list",
      finality: "final",
      account_id: accountId,
    });
    return result.keys || [];
  } catch {
    return [];
  }
}

/**
 * Format USDC balance for display (6 decimals)
 */
export function formatUsdcBalance(balance: bigint): string {
  const divisor = 1000000n;
  const whole = balance / divisor;
  const remainder = balance % divisor;
  const decimal = remainder.toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${decimal}`;
}

/**
 * Build a NEP-141 ft_transfer action
 */
export function buildFtTransferAction(
  receiverId: string,
  amount: bigint,
  memo?: string,
): {
  type: "FunctionCall";
  params: {
    methodName: string;
    args: Record<string, unknown>;
    gas: string;
    deposit: string;
  };
} {
  return {
    type: "FunctionCall",
    params: {
      methodName: "ft_transfer",
      args: {
        receiver_id: receiverId,
        amount: amount.toString(),
        memo: memo || null,
      },
      gas: "30000000000000", // 30 TGas
      deposit: "1", // 1 yoctoNEAR required for ft_transfer
    },
  };
}

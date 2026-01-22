import { type CosmosNetwork, NOBLE_REST_ENDPOINTS, NOBLE_CHAIN_IDS, USDC_DENOM } from "./types";

/**
 * Get the REST endpoint for a Noble network
 */
export function getRestEndpoint(network: CosmosNetwork): string {
  return NOBLE_REST_ENDPOINTS[network] || NOBLE_REST_ENDPOINTS["cosmos:noble-1"];
}

/**
 * Get the chain ID for a Noble network
 */
export function getChainId(network: CosmosNetwork): string {
  return NOBLE_CHAIN_IDS[network] || "noble-1";
}

/**
 * Fetch USDC balance for an address on Noble
 */
export async function fetchUsdcBalance(address: string, network: CosmosNetwork): Promise<bigint> {
  const endpoint = getRestEndpoint(network);
  const url = `${endpoint}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${USDC_DENOM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch balance: ${response.status}`);
      return 0n;
    }

    const data = (await response.json()) as {
      balance?: { denom: string; amount: string };
    };

    if (data.balance?.amount) {
      return BigInt(data.balance.amount);
    }
    return 0n;
  } catch (error) {
    console.error("Error fetching USDC balance:", error);
    return 0n;
  }
}

/**
 * Fetch account info (sequence and account number)
 */
export async function fetchAccountInfo(
  address: string,
  network: CosmosNetwork,
): Promise<{ accountNumber: string; sequence: string } | null> {
  const endpoint = getRestEndpoint(network);
  const url = `${endpoint}/cosmos/auth/v1beta1/accounts/${address}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      account?: {
        account_number?: string;
        sequence?: string;
        "@type"?: string;
        base_account?: {
          account_number?: string;
          sequence?: string;
        };
      };
    };

    // Handle different account types
    const account = data.account;
    if (!account) return null;

    // Standard account
    if (account.account_number !== undefined) {
      return {
        accountNumber: account.account_number || "0",
        sequence: account.sequence || "0",
      };
    }

    // Vesting or special account (has base_account)
    if (account.base_account) {
      return {
        accountNumber: account.base_account.account_number || "0",
        sequence: account.base_account.sequence || "0",
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching account info:", error);
    return null;
  }
}

/**
 * Broadcast a signed transaction
 */
export async function broadcastTx(
  txBytes: Uint8Array,
  network: CosmosNetwork,
): Promise<{ txHash: string; code: number; rawLog?: string }> {
  const endpoint = getRestEndpoint(network);
  const url = `${endpoint}/cosmos/tx/v1beta1/txs`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_bytes: uint8ArrayToBase64(txBytes),
      mode: "BROADCAST_MODE_SYNC",
    }),
  });

  const data = (await response.json()) as {
    tx_response?: {
      txhash: string;
      code: number;
      raw_log?: string;
    };
  };

  if (!data.tx_response) {
    throw new Error("Invalid broadcast response");
  }

  return {
    txHash: data.tx_response.txhash,
    code: data.tx_response.code,
    rawLog: data.tx_response.raw_log,
  };
}

/**
 * Convert Uint8Array to base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

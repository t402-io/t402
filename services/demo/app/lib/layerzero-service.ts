/**
 * LayerZero Scan API integration
 * Fetches real cross-chain USDT0 bridge transaction data
 * Public API, no key required
 */

interface LayerZeroMessage {
  guid: string;
  srcTxHash: string;
  dstTxHash: string | null;
  srcChainId: number;
  dstChainId: number;
  status: string; // "DELIVERED", "INFLIGHT", "CONFIRMING"
  created: number; // unix timestamp
  updated: number;
}

// Cache recent messages for 120s
let cache: { data: LayerZeroMessage[]; ts: number } | null = null;
const CACHE_TTL = 120_000;

export async function getRecentBridgeMessages(): Promise<LayerZeroMessage[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  try {
    // LayerZero Scan API - get recent USDT0/OFT messages
    const res = await fetch(
      "https://scan.layerzero-api.com/v1/messages?limit=5&status=DELIVERED",
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const messages: LayerZeroMessage[] = (data.data || data.messages || [])
      .slice(0, 5)
      .map((m: any) => ({
        guid: m.guid || m.messageGuid || "",
        srcTxHash: m.srcTxHash || m.source?.tx?.txHash || "",
        dstTxHash: m.dstTxHash || m.destination?.tx?.txHash || null,
        srcChainId: m.srcChainId || m.pathway?.sender?.chain || 0,
        dstChainId: m.dstChainId || m.pathway?.receiver?.chain || 0,
        status: m.status || "UNKNOWN",
        created: m.created || Date.now() / 1000,
        updated: m.updated || Date.now() / 1000,
      }));

    cache = { data: messages, ts: Date.now() };
    return messages;
  } catch {
    return [];
  }
}

// Map LayerZero chain IDs to human-readable names
const LZ_CHAIN_NAMES: Record<number, string> = {
  30101: "Ethereum",
  30110: "Arbitrum",
  30184: "Base",
  30111: "Optimism",
  30102: "BSC",
  30106: "Avalanche",
  30109: "Polygon",
  30112: "Fantom",
};

export function getChainName(chainId: number): string {
  return LZ_CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

/**
 * Price service using CoinGecko API with caching.
 * Cache TTL: 60 seconds to avoid rate limiting.
 */

export interface PriceData {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
}

interface CacheEntry {
  data: PriceData;
  timestamp: number;
}

// In-memory cache with 60-second TTL
let btcCache: CacheEntry | null = null;
const CACHE_TTL = 60000; // 60 seconds

// Fallback data if API fails
const FALLBACK_DATA: PriceData = {
  price: 98432.5,
  change24h: 3.2,
  volume24h: 24000000000,
  high24h: 99100.0,
  low24h: 95800.0,
  lastUpdated: new Date().toISOString(),
};

/**
 * Fetch BTC/USD price data from CoinGecko.
 * Uses caching to avoid rate limiting (free tier: ~10-30 calls/minute).
 */
export async function getBtcPrice(): Promise<PriceData> {
  // Return cached data if still valid
  if (btcCache && Date.now() - btcCache.timestamp < CACHE_TTL) {
    return btcCache.data;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_24hr_high=true&include_24hr_low=true",
      {
        headers: {
          Accept: "application/json",
        },
        // Use no-store to always fetch fresh data from the API (but we cache internally)
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const bitcoin = data.bitcoin;

    const priceData: PriceData = {
      price: bitcoin.usd,
      change24h: bitcoin.usd_24h_change ?? 0,
      volume24h: bitcoin.usd_24h_vol ?? 0,
      high24h: bitcoin.usd_24h_high ?? bitcoin.usd * 1.02,
      low24h: bitcoin.usd_24h_low ?? bitcoin.usd * 0.98,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    btcCache = {
      data: priceData,
      timestamp: Date.now(),
    };

    return priceData;
  } catch (error) {
    console.error("Failed to fetch BTC price:", error);

    // Return cached data if available, otherwise fallback
    if (btcCache) {
      return btcCache.data;
    }

    return FALLBACK_DATA;
  }
}

/**
 * Get multiple token prices (BTC, ETH, SOL, etc.)
 * Uses a single CoinGecko API call for efficiency.
 */
export async function getMultipleTokenPrices(
  tokenIds: string[] = ["bitcoin", "ethereum", "solana", "toncoin"]
): Promise<Record<string, PriceData>> {
  try {
    const ids = tokenIds.join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, PriceData> = {};

    for (const id of tokenIds) {
      if (data[id]) {
        result[id] = {
          price: data[id].usd,
          change24h: data[id].usd_24h_change ?? 0,
          volume24h: data[id].usd_24h_vol ?? 0,
          high24h: data[id].usd * 1.02, // Estimate since not all fields available
          low24h: data[id].usd * 0.98,
          lastUpdated: new Date().toISOString(),
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to fetch token prices:", error);
    return {};
  }
}

/**
 * Format price for display.
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format large numbers (volume, market cap).
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1e12) {
    return `$${(num / 1e12).toFixed(1)}T`;
  }
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(1)}B`;
  }
  if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(1)}M`;
  }
  return `$${num.toLocaleString()}`;
}

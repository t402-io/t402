/**
 * Pricing Provider Abstraction
 *
 * Pluggable price backend with built-in caching.
 * Default: CoinGecko. Can be swapped to Bitfinex, Chainlink, etc.
 */

export interface PriceData {
  base: string;
  quote: string;
  price: number;
  timestamp: number;
}

export interface HistoricalPriceData {
  base: string;
  quote: string;
  points: Array<{ timestamp: number; open: number; high: number; low: number; close: number }>;
}

/**
 * Abstract pricing client — implement for each data source.
 */
export interface PricingClient {
  readonly name: string;
  getCurrentPrice(base: string, quote: string): Promise<PriceData>;
  getHistoricalPrice(base: string, quote: string, days: number): Promise<HistoricalPriceData>;
}

/**
 * Caching pricing provider wrapping any PricingClient.
 */
export class PricingProvider {
  private client: PricingClient;
  private cache = new Map<string, { data: PriceData; expiresAt: number }>();
  private ttlMs: number;

  constructor(client: PricingClient, ttlMs: number = 300_000) {
    this.client = client;
    this.ttlMs = ttlMs;
  }

  get providerName(): string {
    return this.client.name;
  }

  async getCurrentPrice(base: string, quote: string = "usd"): Promise<PriceData> {
    const key = `${base}:${quote}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const data = await this.client.getCurrentPrice(base, quote);
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
    return data;
  }

  async getHistoricalPrice(base: string, quote: string = "usd", days: number = 7): Promise<HistoricalPriceData> {
    // Historical data not cached (different time ranges)
    return this.client.getHistoricalPrice(base, quote, days);
  }

  clearCache(): void {
    this.cache.clear();
  }

  get cacheSize(): number {
    return this.cache.size;
  }
}

/**
 * CoinGecko pricing client (default).
 */
export class CoinGeckoPricingClient implements PricingClient {
  readonly name = "coingecko";
  private apiUrl: string;

  constructor(apiUrl: string = "https://api.coingecko.com/api/v3") {
    this.apiUrl = apiUrl;
  }

  async getCurrentPrice(base: string, quote: string): Promise<PriceData> {
    const id = tokenToCoingeckoId(base);
    const res = await fetch(`${this.apiUrl}/simple/price?ids=${id}&vs_currencies=${quote}`);
    const data = await res.json() as Record<string, Record<string, number>>;
    return {
      base,
      quote,
      price: data[id]?.[quote] ?? 0,
      timestamp: Date.now(),
    };
  }

  async getHistoricalPrice(base: string, quote: string, days: number): Promise<HistoricalPriceData> {
    const id = tokenToCoingeckoId(base);
    const res = await fetch(`${this.apiUrl}/coins/${id}/market_chart?vs_currency=${quote}&days=${days}`);
    const data = await res.json() as { prices: [number, number][] };
    return {
      base,
      quote,
      points: (data.prices ?? []).map(([ts, price]) => ({
        timestamp: ts,
        open: price,
        high: price,
        low: price,
        close: price,
      })),
    };
  }
}

/**
 * Bitfinex pricing client.
 */
export class BitfinexPricingClient implements PricingClient {
  readonly name = "bitfinex";

  async getCurrentPrice(base: string, quote: string): Promise<PriceData> {
    const symbol = `t${base.toUpperCase()}${quote.toUpperCase()}`;
    const res = await fetch(`https://api-pub.bitfinex.com/v2/ticker/${symbol}`);
    const data = await res.json() as number[];
    return {
      base,
      quote,
      price: data[6] ?? 0, // LAST_PRICE
      timestamp: Date.now(),
    };
  }

  async getHistoricalPrice(base: string, quote: string, days: number): Promise<HistoricalPriceData> {
    const symbol = `t${base.toUpperCase()}${quote.toUpperCase()}`;
    const end = Date.now();
    const start = end - days * 86400000;
    const res = await fetch(
      `https://api-pub.bitfinex.com/v2/candles/trade:1D:${symbol}/hist?start=${start}&end=${end}&limit=${days}`,
    );
    const data = await res.json() as number[][];
    return {
      base,
      quote,
      points: (data ?? []).map(([ts, open, close, high, low]) => ({
        timestamp: ts,
        open,
        high,
        low,
        close,
      })),
    };
  }
}

function tokenToCoingeckoId(symbol: string): string {
  const map: Record<string, string> = {
    ETH: "ethereum",
    BTC: "bitcoin",
    USDC: "usd-coin",
    USDT: "tether",
    SOL: "solana",
    MATIC: "matic-network",
    AVAX: "avalanche-2",
    TON: "the-open-network",
    TRX: "tron",
    XAU: "tether-gold",
  };
  return map[symbol.toUpperCase()] || symbol.toLowerCase();
}

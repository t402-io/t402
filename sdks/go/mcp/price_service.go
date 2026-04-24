package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// coinGeckoAPI is the base URL for the CoinGecko simple price endpoint.
const coinGeckoAPI = "https://api.coingecko.com/api/v3/simple/price"

// priceCacheTTL controls how long a single (tokens, currency) lookup is
// reused. CoinGecko free tier rate limits are generous but not unlimited;
// five minutes matches the TS implementation.
const priceCacheTTL = 5 * time.Minute

// tokenToCoinGeckoID maps common token tickers to their CoinGecko slugs.
// Unknown tokens fall back to lowercased ticker as the slug guess.
var tokenToCoinGeckoID = map[string]string{
	"ETH":   "ethereum",
	"MATIC": "matic-network",
	"AVAX":  "avalanche-2",
	"BERA":  "berachain-bera",
	"USDC":  "usd-coin",
	"USDT":  "tether",
	"USDT0": "tether",
}

type priceCacheEntry struct {
	prices    map[string]float64
	timestamp time.Time
}

// priceCache holds recent CoinGecko responses keyed by "<currency>:<sorted-tokens>".
var priceCache = struct {
	sync.RWMutex
	entries map[string]priceCacheEntry
}{entries: make(map[string]priceCacheEntry)}

// getTokenPrices fetches live prices from CoinGecko with in-memory caching.
// Demo results live in getTokenPricesDemo — see below.
func getTokenPrices(ctx context.Context, tokens []string, currency string) (map[string]float64, error) {
	if currency == "" {
		currency = "usd"
	}

	// Deduplicate and uppercase tokens for consistent cache keys.
	upper := make([]string, 0, len(tokens))
	seen := make(map[string]bool, len(tokens))
	for _, t := range tokens {
		u := strings.ToUpper(t)
		if !seen[u] {
			upper = append(upper, u)
			seen[u] = true
		}
	}

	sortedKey := strings.Join(sortStrings(upper), ",")
	cacheKey := currency + ":" + sortedKey

	priceCache.RLock()
	if entry, ok := priceCache.entries[cacheKey]; ok &&
		time.Since(entry.timestamp) < priceCacheTTL {
		priceCache.RUnlock()
		return entry.prices, nil
	}
	priceCache.RUnlock()

	// Build the CoinGecko query: unique coin IDs plus the target currency.
	coinIDs := make([]string, 0, len(upper))
	tokenToCoin := make(map[string]string, len(upper))
	coinSeen := make(map[string]bool, len(upper))
	for _, token := range upper {
		coinID, ok := tokenToCoinGeckoID[token]
		if !ok {
			coinID = strings.ToLower(token)
		}
		tokenToCoin[token] = coinID
		if !coinSeen[coinID] {
			coinIDs = append(coinIDs, coinID)
			coinSeen[coinID] = true
		}
	}

	url := fmt.Sprintf(
		"%s?ids=%s&vs_currencies=%s",
		coinGeckoAPI,
		strings.Join(coinIDs, ","),
		currency,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build CoinGecko request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CoinGecko request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CoinGecko API error: %s", resp.Status)
	}

	var data map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("decode CoinGecko response: %w", err)
	}

	prices := make(map[string]float64, len(upper))
	for _, token := range upper {
		if entry, ok := data[tokenToCoin[token]]; ok {
			prices[token] = entry[currency]
		} else {
			prices[token] = 0
		}
	}

	priceCache.Lock()
	priceCache.entries[cacheKey] = priceCacheEntry{
		prices:    prices,
		timestamp: time.Now(),
	}
	priceCache.Unlock()

	return prices, nil
}

// getTokenPricesDemo returns fixed prices without hitting the network.
// Mirrors the TS demo table so cross-SDK demo behavior is identical.
func getTokenPricesDemo(tokens []string) map[string]float64 {
	demo := map[string]float64{
		"ETH":   3250.42,
		"MATIC": 0.58,
		"AVAX":  24.15,
		"BERA":  3.82,
		"USDC":  1.0,
		"USDT":  1.0,
		"USDT0": 1.0,
	}
	out := make(map[string]float64, len(tokens))
	for _, t := range tokens {
		u := strings.ToUpper(t)
		out[u] = demo[u]
	}
	return out
}

// sortStrings returns a lexicographically sorted copy of s.
func sortStrings(s []string) []string {
	out := append([]string(nil), s...)
	// Inline insertion sort — n is small (handful of tokens) and we don't
	// want to pull in sort.Slice just for this.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j-1] > out[j]; j-- {
			out[j-1], out[j] = out[j], out[j-1]
		}
	}
	return out
}

// clearPriceCache clears the cache. Exposed for tests only.
func clearPriceCache() {
	priceCache.Lock()
	priceCache.entries = make(map[string]priceCacheEntry)
	priceCache.Unlock()
}

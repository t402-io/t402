package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.util.Json;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Price oracle service using CoinGecko free API.
 * Provides cached token price lookups with a 5-minute TTL.
 */
public class PriceService {

    private static final String COINGECKO_API = "https://api.coingecko.com/api/v3";
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    private static final Map<String, String> TOKEN_TO_COINGECKO_ID = Map.ofEntries(
        Map.entry("USDC", "usd-coin"),
        Map.entry("USDT", "tether"),
        Map.entry("USDT0", "tether"),
        Map.entry("USDt", "tether"),
        Map.entry("ETH", "ethereum"),
        Map.entry("BTC", "bitcoin"),
        Map.entry("SOL", "solana"),
        Map.entry("MATIC", "matic-network"),
        Map.entry("AVAX", "avalanche-2"),
        Map.entry("TON", "the-open-network"),
        Map.entry("TRX", "tron"),
        Map.entry("NEAR", "near"),
        Map.entry("APT", "aptos"),
        Map.entry("XTZ", "tezos"),
        Map.entry("BERA", "berachain-bera")
    );

    private final HttpClient httpClient;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public PriceService() {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    /**
     * Get token prices in the given currency.
     *
     * @param tokens list of token symbols (e.g., "ETH", "USDC")
     * @param currency target currency (e.g., "usd")
     * @return map of token symbol to price
     */
    public Map<String, Double> getTokenPrices(List<String> tokens, String currency) {
        Map<String, Double> result = new HashMap<>();
        List<String> uncached = new java.util.ArrayList<>();

        // Check cache first
        long now = System.currentTimeMillis();
        for (String token : tokens) {
            String cacheKey = token.toUpperCase() + ":" + currency.toLowerCase();
            CacheEntry entry = cache.get(cacheKey);
            if (entry != null && (now - entry.timestamp) < CACHE_TTL_MS) {
                result.put(token.toUpperCase(), entry.price);
            } else {
                uncached.add(token);
            }
        }

        if (uncached.isEmpty()) {
            return result;
        }

        // Build CoinGecko IDs
        List<String> cgIds = uncached.stream()
            .map(t -> TOKEN_TO_COINGECKO_ID.getOrDefault(t.toUpperCase(), t.toLowerCase()))
            .distinct()
            .collect(Collectors.toList());

        String idsParam = String.join(",", cgIds);

        try {
            String url = COINGECKO_API + "/simple/price?ids=" + idsParam
                + "&vs_currencies=" + currency.toLowerCase();

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode body = Json.MAPPER.readTree(response.body());
                String curr = currency.toLowerCase();

                for (String token : uncached) {
                    String cgId = TOKEN_TO_COINGECKO_ID.getOrDefault(
                        token.toUpperCase(), token.toLowerCase());
                    JsonNode priceNode = body.path(cgId).path(curr);
                    if (!priceNode.isMissingNode()) {
                        double price = priceNode.asDouble();
                        result.put(token.toUpperCase(), price);
                        String cacheKey = token.toUpperCase() + ":" + curr;
                        cache.put(cacheKey, new CacheEntry(price, System.currentTimeMillis()));
                    }
                }
            }
        } catch (Exception e) {
            // Return partial results on failure
        }

        return result;
    }

    /**
     * Resolve a CoinGecko ID for a token symbol.
     */
    public static String getCoinGeckoId(String symbol) {
        return TOKEN_TO_COINGECKO_ID.getOrDefault(symbol.toUpperCase(), symbol.toLowerCase());
    }

    private static class CacheEntry {
        final double price;
        final long timestamp;

        CacheEntry(double price, long timestamp) {
            this.price = price;
            this.timestamp = timestamp;
        }
    }
}

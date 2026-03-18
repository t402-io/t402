package io.t402.schemes.svm;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory settlement cache to prevent duplicate concurrent settlement requests.
 * Thread-safe via ConcurrentHashMap. Can be shared across V1/V2 facilitator instances.
 */
public class SettlementCache {

    private static final Duration DEFAULT_TTL = Duration.ofSeconds(60);

    private final Map<String, Instant> entries = new ConcurrentHashMap<>();
    private final Duration ttl;

    public SettlementCache() {
        this(DEFAULT_TTL);
    }

    public SettlementCache(Duration ttl) {
        this.ttl = ttl;
    }

    /**
     * Compute a cache key from transaction bytes.
     */
    public static String transactionKey(byte[] txBytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(txBytes);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Check if a transaction is already being settled.
     * Returns true if duplicate, false if new (and records it).
     */
    public synchronized boolean isDuplicate(String key) {
        pruneExpired();
        if (entries.containsKey(key)) {
            return true;
        }
        entries.put(key, Instant.now());
        return false;
    }

    /**
     * Remove a key from the cache (called after settlement completes).
     */
    public void remove(String key) {
        entries.remove(key);
    }

    /**
     * Current number of entries (for testing).
     */
    public int size() {
        return entries.size();
    }

    private void pruneExpired() {
        Instant cutoff = Instant.now().minus(ttl);
        entries.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoff));
    }
}

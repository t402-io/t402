package io.t402.schemes.svm;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for SVM SettlementCache.
 */
@DisplayName("SVM SettlementCache")
class SettlementCacheTest {

    @Nested
    @DisplayName("isDuplicate")
    class IsDuplicateTest {

        @Test
        @DisplayName("should return false for first entry and true for duplicate")
        void testFirstEntryAndDuplicate() {
            SettlementCache cache = new SettlementCache();
            String key = "test-key-1";

            assertFalse(cache.isDuplicate(key), "First call should return false");
            assertTrue(cache.isDuplicate(key), "Second call should return true (duplicate)");
        }

        @Test
        @DisplayName("should allow different keys")
        void testDifferentKeys() {
            SettlementCache cache = new SettlementCache();

            assertFalse(cache.isDuplicate("key-a"));
            assertFalse(cache.isDuplicate("key-b"));
            assertEquals(2, cache.size());
        }
    }

    @Nested
    @DisplayName("remove")
    class RemoveTest {

        @Test
        @DisplayName("should allow re-settlement after remove")
        void testRemoveAllowsReSettlement() {
            SettlementCache cache = new SettlementCache();
            String key = "test-key-2";

            assertFalse(cache.isDuplicate(key));
            assertTrue(cache.isDuplicate(key));

            cache.remove(key);
            assertEquals(0, cache.size());

            assertFalse(cache.isDuplicate(key), "Should allow entry after removal");
        }

        @Test
        @DisplayName("should be no-op for non-existent key")
        void testRemoveNonExistent() {
            SettlementCache cache = new SettlementCache();
            assertDoesNotThrow(() -> cache.remove("non-existent"));
        }
    }

    @Nested
    @DisplayName("TTL expiry")
    class TtlExpiryTest {

        @Test
        @DisplayName("should expire entries after TTL")
        void testTtlExpiry() throws InterruptedException {
            SettlementCache cache = new SettlementCache(Duration.ofMillis(50));
            String key = "ttl-key";

            assertFalse(cache.isDuplicate(key));
            assertTrue(cache.isDuplicate(key), "Should be duplicate before TTL");

            Thread.sleep(100);

            assertFalse(cache.isDuplicate(key), "Should not be duplicate after TTL expires");
        }

        @Test
        @DisplayName("should prune only expired entries")
        void testSelectivePruning() throws InterruptedException {
            SettlementCache cache = new SettlementCache(Duration.ofMillis(80));

            assertFalse(cache.isDuplicate("early-key"));
            Thread.sleep(50);
            assertFalse(cache.isDuplicate("late-key"));

            assertEquals(2, cache.size());

            // Wait for early-key to expire but not late-key
            Thread.sleep(50);

            // Trigger pruning via isDuplicate
            assertFalse(cache.isDuplicate("new-key"));

            // early-key should be pruned, late-key and new-key should remain
            assertEquals(2, cache.size());
        }
    }

    @Nested
    @DisplayName("cross-instance deduplication")
    class CrossInstanceTest {

        @Test
        @DisplayName("should deduplicate when sharing a single cache instance")
        void testSharedCacheInstance() {
            SettlementCache sharedCache = new SettlementCache();
            String key = SettlementCache.transactionKey("same-tx".getBytes(StandardCharsets.UTF_8));

            // Simulate two facilitator instances sharing the same cache
            assertFalse(sharedCache.isDuplicate(key), "Instance 1 should succeed");
            assertTrue(sharedCache.isDuplicate(key), "Instance 2 should see duplicate");
        }
    }

    @Nested
    @DisplayName("transactionKey")
    class TransactionKeyTest {

        @Test
        @DisplayName("should produce deterministic keys")
        void testDeterministicKeys() {
            byte[] txBytes = "test-transaction-data".getBytes(StandardCharsets.UTF_8);

            String key1 = SettlementCache.transactionKey(txBytes);
            String key2 = SettlementCache.transactionKey(txBytes);

            assertEquals(key1, key2, "Same input should produce same key");
            assertEquals(64, key1.length(), "SHA-256 hex should be 64 characters");
        }

        @Test
        @DisplayName("should produce different keys for different inputs")
        void testDifferentInputsDifferentKeys() {
            String key1 = SettlementCache.transactionKey("tx-1".getBytes(StandardCharsets.UTF_8));
            String key2 = SettlementCache.transactionKey("tx-2".getBytes(StandardCharsets.UTF_8));

            assertNotEquals(key1, key2);
        }

        @Test
        @DisplayName("should produce valid hex string")
        void testValidHexOutput() {
            String key = SettlementCache.transactionKey("data".getBytes(StandardCharsets.UTF_8));
            assertTrue(key.matches("^[0-9a-f]{64}$"), "Should be lowercase hex SHA-256");
        }
    }
}

"""Tests for the SettlementCache module."""

import threading
import time

from t402.settlement_cache import SettlementCache, DEFAULT_TTL


class TestSettlementCacheBasic:
    """Basic cache operations."""

    def test_is_duplicate_first_false_second_true(self):
        cache = SettlementCache()
        key = SettlementCache.transaction_key(b"tx-abc")
        assert cache.is_duplicate(key) is False
        assert cache.is_duplicate(key) is True

    def test_remove_allows_reinsert(self):
        cache = SettlementCache()
        key = SettlementCache.transaction_key(b"tx-remove")
        assert cache.is_duplicate(key) is False
        cache.remove(key)
        assert cache.is_duplicate(key) is False

    def test_remove_nonexistent_key_is_noop(self):
        cache = SettlementCache()
        cache.remove("nonexistent")  # should not raise

    def test_size(self):
        cache = SettlementCache()
        assert cache.size == 0
        cache.is_duplicate("a")
        assert cache.size == 1
        cache.is_duplicate("b")
        assert cache.size == 2
        cache.remove("a")
        assert cache.size == 1


class TestTransactionKey:
    """transaction_key determinism and types."""

    def test_deterministic_bytes(self):
        a = SettlementCache.transaction_key(b"hello")
        b = SettlementCache.transaction_key(b"hello")
        assert a == b

    def test_deterministic_str(self):
        a = SettlementCache.transaction_key("hello")
        b = SettlementCache.transaction_key("hello")
        assert a == b

    def test_bytes_and_str_equivalent(self):
        a = SettlementCache.transaction_key(b"hello")
        b = SettlementCache.transaction_key("hello")
        assert a == b

    def test_different_inputs_different_keys(self):
        a = SettlementCache.transaction_key(b"tx1")
        b = SettlementCache.transaction_key(b"tx2")
        assert a != b

    def test_key_is_hex_sha256(self):
        key = SettlementCache.transaction_key(b"test")
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)


class TestTTLExpiry:
    """TTL-based expiry."""

    def test_entry_expires_after_ttl(self):
        cache = SettlementCache(ttl=0.1)
        key = "expire-me"
        assert cache.is_duplicate(key) is False
        time.sleep(0.15)
        # After TTL, the entry should be pruned and allow re-insert
        assert cache.is_duplicate(key) is False

    def test_entry_still_valid_before_ttl(self):
        cache = SettlementCache(ttl=5.0)
        key = "still-valid"
        assert cache.is_duplicate(key) is False
        assert cache.is_duplicate(key) is True

    def test_default_ttl(self):
        cache = SettlementCache()
        assert cache._ttl == DEFAULT_TTL

    def test_custom_ttl(self):
        cache = SettlementCache(ttl=120.0)
        assert cache._ttl == 120.0


class TestCrossInstanceDedup:
    """Shared cache across multiple facilitator instances."""

    def test_shared_cache_dedup(self):
        shared = SettlementCache()
        key = SettlementCache.transaction_key(b"shared-tx")

        # First "instance" claims it
        assert shared.is_duplicate(key) is False
        # Second "instance" sees it as duplicate
        assert shared.is_duplicate(key) is True

    def test_separate_caches_independent(self):
        cache1 = SettlementCache()
        cache2 = SettlementCache()
        key = SettlementCache.transaction_key(b"independent-tx")

        assert cache1.is_duplicate(key) is False
        assert cache2.is_duplicate(key) is False  # different cache, no dedup


class TestThreadSafety:
    """Concurrent access safety."""

    def test_concurrent_is_duplicate_only_one_wins(self):
        cache = SettlementCache()
        key = "race-key"
        results = []
        barrier = threading.Barrier(10)

        def worker():
            barrier.wait()
            results.append(cache.is_duplicate(key))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Exactly one thread should get False (first insert),
        # all others should get True (duplicate).
        assert results.count(False) == 1
        assert results.count(True) == 9

    def test_concurrent_mixed_operations(self):
        cache = SettlementCache()
        errors = []

        def inserter(n):
            try:
                for i in range(50):
                    cache.is_duplicate(f"key-{n}-{i}")
            except Exception as e:
                errors.append(e)

        def remover(n):
            try:
                for i in range(50):
                    cache.remove(f"key-{n}-{i}")
            except Exception as e:
                errors.append(e)

        threads = []
        for n in range(5):
            threads.append(threading.Thread(target=inserter, args=(n,)))
            threads.append(threading.Thread(target=remover, args=(n,)))

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0

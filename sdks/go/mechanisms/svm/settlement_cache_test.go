package svm

import (
	"sync"
	"testing"
	"time"
)

func TestSettlementCache_IsDuplicate(t *testing.T) {
	cache := NewSettlementCache(DefaultSettlementTTL)

	key := TransactionKey([]byte("test-transaction-1"))

	// First call should not be a duplicate
	if cache.IsDuplicate(key) {
		t.Error("expected first call to not be a duplicate")
	}

	// Second call with same key should be a duplicate
	if !cache.IsDuplicate(key) {
		t.Error("expected second call to be a duplicate")
	}

	// Different key should not be a duplicate
	key2 := TransactionKey([]byte("test-transaction-2"))
	if cache.IsDuplicate(key2) {
		t.Error("expected different key to not be a duplicate")
	}
}

func TestSettlementCache_Remove(t *testing.T) {
	cache := NewSettlementCache(DefaultSettlementTTL)

	key := TransactionKey([]byte("test-transaction"))

	// Record it
	if cache.IsDuplicate(key) {
		t.Fatal("unexpected duplicate")
	}

	// Remove it
	cache.Remove(key)

	// Should no longer be a duplicate
	if cache.IsDuplicate(key) {
		t.Error("expected key to not be a duplicate after removal")
	}
}

func TestSettlementCache_TTLExpiry(t *testing.T) {
	cache := NewSettlementCache(50 * time.Millisecond)

	key := TransactionKey([]byte("test-transaction"))

	if cache.IsDuplicate(key) {
		t.Fatal("unexpected duplicate")
	}

	// Should be duplicate immediately
	if !cache.IsDuplicate(key) {
		t.Error("expected duplicate before TTL")
	}

	// Wait for TTL to expire
	time.Sleep(100 * time.Millisecond)

	// Should be pruned and no longer duplicate
	if cache.IsDuplicate(key) {
		t.Error("expected key to be expired after TTL")
	}
}

func TestSettlementCache_DefaultTTL(t *testing.T) {
	cache := NewSettlementCache(0)
	if cache.ttl != DefaultSettlementTTL {
		t.Errorf("expected default TTL %v, got %v", DefaultSettlementTTL, cache.ttl)
	}
}

func TestSettlementCache_ConcurrentAccess(t *testing.T) {
	cache := NewSettlementCache(DefaultSettlementTTL)
	key := TransactionKey([]byte("concurrent-tx"))

	var wg sync.WaitGroup
	duplicates := make(chan bool, 100)

	// Launch 100 goroutines all trying to claim the same key
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			duplicates <- cache.IsDuplicate(key)
		}()
	}

	wg.Wait()
	close(duplicates)

	// Exactly one should return false (not duplicate), rest should be true
	notDuplicate := 0
	for dup := range duplicates {
		if !dup {
			notDuplicate++
		}
	}

	if notDuplicate != 1 {
		t.Errorf("expected exactly 1 non-duplicate, got %d", notDuplicate)
	}
}

func TestSettlementCache_CrossVersionDedup(t *testing.T) {
	// Simulate sharing a cache across V1 and V2 facilitator instances
	sharedCache := NewSettlementCache(DefaultSettlementTTL)

	txBytes := []byte("same-solana-transaction-bytes")
	key := TransactionKey(txBytes)

	// V1 settles first
	if sharedCache.IsDuplicate(key) {
		t.Fatal("V1 should not see duplicate on first attempt")
	}

	// V2 tries to settle same transaction concurrently
	if !sharedCache.IsDuplicate(key) {
		t.Error("V2 should see duplicate for same transaction")
	}

	// V1 completes settlement
	sharedCache.Remove(key)

	// Cache should be empty
	if sharedCache.Size() != 0 {
		t.Error("expected empty cache after removal")
	}
}

func TestTransactionKey_Deterministic(t *testing.T) {
	tx := []byte("some-transaction-bytes")
	key1 := TransactionKey(tx)
	key2 := TransactionKey(tx)

	if key1 != key2 {
		t.Error("expected deterministic keys for same input")
	}

	// Different input should produce different key
	key3 := TransactionKey([]byte("different-bytes"))
	if key1 == key3 {
		t.Error("expected different keys for different input")
	}
}

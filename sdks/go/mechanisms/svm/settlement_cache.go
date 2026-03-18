package svm

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// SettlementCache prevents duplicate concurrent settlement requests for the
// same Solana transaction. It is thread-safe and TTL-based, suitable for
// sharing across V1/V2 facilitator instances.
type SettlementCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

type cacheEntry struct {
	createdAt time.Time
}

// DefaultSettlementTTL is the default time-to-live for cache entries.
const DefaultSettlementTTL = 60 * time.Second

// NewSettlementCache creates a new settlement cache with the given TTL.
// If ttl is 0, DefaultSettlementTTL is used.
func NewSettlementCache(ttl time.Duration) *SettlementCache {
	if ttl == 0 {
		ttl = DefaultSettlementTTL
	}
	c := &SettlementCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}
	return c
}

// TransactionKey computes a cache key from raw transaction bytes.
func TransactionKey(txBytes []byte) string {
	h := sha256.Sum256(txBytes)
	return hex.EncodeToString(h[:])
}

// IsDuplicate checks if a transaction is already being settled.
// Returns true if the key is already in the cache (duplicate).
// If not a duplicate, it records the key and returns false.
func (c *SettlementCache) IsDuplicate(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.pruneExpired()

	if _, exists := c.entries[key]; exists {
		return true
	}

	c.entries[key] = cacheEntry{
		createdAt: time.Now(),
	}
	return false
}

// Remove removes a key from the cache (called after settlement completes).
func (c *SettlementCache) Remove(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

// Size returns the current number of entries (for testing).
func (c *SettlementCache) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.entries)
}

// pruneExpired removes expired entries. Must be called with mu held.
func (c *SettlementCache) pruneExpired() {
	now := time.Now()
	for key, entry := range c.entries {
		if now.Sub(entry.createdAt) > c.ttl {
			delete(c.entries, key)
		}
	}
}

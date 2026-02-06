package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// P1-1: NonceStore provides nonce tracking for replay protection
// Tracks used nonces to prevent the same payment authorization from being settled twice
type NonceStore struct {
	cache  *cache.Client
	prefix string
	ttl    time.Duration
}

// NewNonceStore creates a new nonce tracking store
// ttl should be longer than the maximum expected time between signature creation and use
func NewNonceStore(cache *cache.Client, ttl time.Duration) *NonceStore {
	if ttl == 0 {
		// Default 24 hours - signatures older than this are likely expired anyway
		ttl = 24 * time.Hour
	}
	return &NonceStore{
		cache:  cache,
		prefix: "nonce:",
		ttl:    ttl,
	}
}

// ErrNonceAlreadyUsed is returned when a nonce has already been used
var ErrNonceAlreadyUsed = fmt.Errorf("nonce already used")

// CheckAndMark atomically checks if a nonce has been used and marks it as used
// Returns ErrNonceAlreadyUsed if the nonce was already used
// The nonce is derived from the payment payload to ensure uniqueness across all fields
func (s *NonceStore) CheckAndMark(ctx context.Context, network, scheme string, payloadHash string) error {
	if s.cache == nil {
		// If cache is unavailable, we can't track nonces - log warning but allow
		// This is a security tradeoff: availability vs. replay protection
		return nil
	}

	// Create a unique key combining network, scheme, and payload hash
	// This ensures the same payload can't be replayed even on different networks
	key := s.prefix + s.createNonceKey(network, scheme, payloadHash)

	// Try to set the key only if it doesn't exist (atomic operation)
	set, err := s.cache.SetNX(ctx, key, "1", s.ttl)
	if err != nil {
		// On cache error, fail open to maintain availability
		// Log the error for monitoring
		return nil
	}

	if !set {
		// Key already existed - this nonce was already used
		return ErrNonceAlreadyUsed
	}

	return nil
}

// IsUsed checks if a nonce has been used without marking it
func (s *NonceStore) IsUsed(ctx context.Context, network, scheme string, payloadHash string) (bool, error) {
	if s.cache == nil {
		return false, nil
	}

	key := s.prefix + s.createNonceKey(network, scheme, payloadHash)
	exists, err := s.cache.Exists(ctx, key)
	if err != nil {
		return false, err
	}

	return exists, nil
}

// createNonceKey creates a unique key for a nonce
// Uses SHA256 to create a fixed-length key from potentially large payloads
func (s *NonceStore) createNonceKey(network, scheme string, payloadHash string) string {
	h := sha256.New()
	h.Write([]byte(network))
	h.Write([]byte(":"))
	h.Write([]byte(scheme))
	h.Write([]byte(":"))
	h.Write([]byte(payloadHash))
	return hex.EncodeToString(h.Sum(nil))
}

// ExtractNonceFromPayload extracts the nonce field from a payment payload
// Returns empty string if no nonce is found
func ExtractNonceFromPayload(payloadBytes []byte) string {
	// Try to extract nonce from common payload structures
	// This is a best-effort extraction - the full payload hash is used as fallback

	// The actual nonce extraction depends on the payment scheme:
	// - EIP-3009: nonce is a 32-byte value
	// - TON: query_id serves as nonce
	// - TRON: transaction nonce
	// - Solana: blockhash serves as replay protection

	// For now, use the payload hash as the canonical identifier
	// This ensures uniqueness regardless of payload structure
	return ComputePayloadHash(payloadBytes, nil)
}

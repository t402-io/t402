package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// newTestNonceCacheClient creates a cache.Client backed by miniredis for testing
func newTestNonceCacheClient(t *testing.T) (*cache.Client, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return cache.NewClientFromRedis(redisClient), mr
}

// ============== Test NewNonceStore ==============

func TestNewNonceStore(t *testing.T) {
	tests := []struct {
		name        string
		ttl         time.Duration
		expectedTTL time.Duration
	}{
		{
			name:        "with custom TTL",
			ttl:         2 * time.Hour,
			expectedTTL: 2 * time.Hour,
		},
		{
			name:        "with zero TTL uses default 24h",
			ttl:         0,
			expectedTTL: 24 * time.Hour,
		},
		{
			name:        "with short TTL",
			ttl:         5 * time.Minute,
			expectedTTL: 5 * time.Minute,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewNonceStore(nil, tt.ttl)
			require.NotNil(t, store)
			assert.Equal(t, tt.expectedTTL, store.ttl)
			assert.Equal(t, "nonce:", store.prefix)
		})
	}
}

func TestNewNonceStore_WithCache(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	require.NotNil(t, store)
	assert.Equal(t, time.Hour, store.ttl)
	assert.Equal(t, "nonce:", store.prefix)
	assert.NotNil(t, store.cache)
}

func TestNewNonceStore_NilCache(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)
	require.NotNil(t, store)
	assert.Nil(t, store.cache)
}

// ============== Test ErrNonceAlreadyUsed ==============

func TestErrNonceAlreadyUsed(t *testing.T) {
	assert.NotNil(t, ErrNonceAlreadyUsed)
	assert.Equal(t, "nonce already used", ErrNonceAlreadyUsed.Error())
}

// ============== Test CheckAndMark ==============

func TestCheckAndMark_Success_FirstUse(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.NoError(t, err)
}

func TestCheckAndMark_NonceAlreadyUsed(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// First call should succeed
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-123")
	require.NoError(t, err)

	// Second call with same nonce should return ErrNonceAlreadyUsed
	err = store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-123")
	assert.ErrorIs(t, err, ErrNonceAlreadyUsed)
}

func TestCheckAndMark_DifferentPayloads(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Different payload hashes should not conflict
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-1")
	assert.NoError(t, err)

	err = store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-2")
	assert.NoError(t, err)
}

func TestCheckAndMark_DifferentNetworks(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Same payload hash on different networks should not conflict
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-same")
	assert.NoError(t, err)

	err = store.CheckAndMark(ctx, "eip155:8453", "exact", "payload-hash-same")
	assert.NoError(t, err)
}

func TestCheckAndMark_DifferentSchemes(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Same payload hash with different schemes should not conflict
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-same")
	assert.NoError(t, err)

	err = store.CheckAndMark(ctx, "eip155:1", "upto", "payload-hash-same")
	assert.NoError(t, err)
}

func TestCheckAndMark_NilCache(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)
	ctx := context.Background()

	// Should return nil (fail open) when cache is nil
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.NoError(t, err)

	// Calling again should also return nil (no tracking without cache)
	err = store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.NoError(t, err)
}

func TestCheckAndMark_CacheError_FailOpen(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	cacheClient := cache.NewClientFromRedis(redisClient)

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Close miniredis to simulate cache error
	mr.Close()

	// Should fail open (return nil) when cache is unavailable
	err = store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.NoError(t, err)
}

// ============== Test IsUsed ==============

func TestIsUsed_NotUsed(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	used, err := store.IsUsed(ctx, "eip155:1", "exact", "payload-hash-new")
	assert.NoError(t, err)
	assert.False(t, used)
}

func TestIsUsed_Used(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Mark the nonce as used
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "payload-hash-used")
	require.NoError(t, err)

	// IsUsed should return true
	used, err := store.IsUsed(ctx, "eip155:1", "exact", "payload-hash-used")
	assert.NoError(t, err)
	assert.True(t, used)
}

func TestIsUsed_NilCache(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)
	ctx := context.Background()

	// Should return false when cache is nil
	used, err := store.IsUsed(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.NoError(t, err)
	assert.False(t, used)
}

func TestIsUsed_CacheError(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	cacheClient := cache.NewClientFromRedis(redisClient)

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	// Close miniredis to simulate cache error
	mr.Close()

	// Should return error when cache is unavailable
	used, err := store.IsUsed(ctx, "eip155:1", "exact", "payload-hash-abc")
	assert.Error(t, err)
	assert.False(t, used)
}

// ============== Test createNonceKey ==============

func TestCreateNonceKey_Deterministic(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	key1 := store.createNonceKey("eip155:1", "exact", "hash123")
	key2 := store.createNonceKey("eip155:1", "exact", "hash123")

	assert.Equal(t, key1, key2, "Same inputs should produce identical keys")
}

func TestCreateNonceKey_DifferentInputs(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	// Different networks
	keyA := store.createNonceKey("eip155:1", "exact", "hash123")
	keyB := store.createNonceKey("eip155:8453", "exact", "hash123")
	assert.NotEqual(t, keyA, keyB, "Different networks should produce different keys")

	// Different schemes
	keyC := store.createNonceKey("eip155:1", "exact", "hash123")
	keyD := store.createNonceKey("eip155:1", "upto", "hash123")
	assert.NotEqual(t, keyC, keyD, "Different schemes should produce different keys")

	// Different payload hashes
	keyE := store.createNonceKey("eip155:1", "exact", "hash123")
	keyF := store.createNonceKey("eip155:1", "exact", "hash456")
	assert.NotEqual(t, keyE, keyF, "Different payload hashes should produce different keys")
}

func TestCreateNonceKey_Format(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	key := store.createNonceKey("eip155:1", "exact", "hash123")

	// Should be a valid SHA256 hex string (64 characters)
	assert.Len(t, key, 64, "Key should be 64 hex characters (SHA256)")

	// Verify it decodes as valid hex
	_, err := hex.DecodeString(key)
	assert.NoError(t, err, "Key should be valid hex")
}

func TestCreateNonceKey_MatchesExpectedHash(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	key := store.createNonceKey("eip155:1", "exact", "hash123")

	// Manually compute expected hash
	h := sha256.New()
	h.Write([]byte("eip155:1"))
	h.Write([]byte(":"))
	h.Write([]byte("exact"))
	h.Write([]byte(":"))
	h.Write([]byte("hash123"))
	expected := hex.EncodeToString(h.Sum(nil))

	assert.Equal(t, expected, key)
}

func TestCreateNonceKey_EmptyInputs(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	// Empty inputs should still produce a valid key
	key := store.createNonceKey("", "", "")
	assert.Len(t, key, 64, "Empty inputs should still produce a valid SHA256 hash")
	assert.NotEmpty(t, key)

	// Non-empty vs empty should differ
	keyNonEmpty := store.createNonceKey("eip155:1", "exact", "hash123")
	assert.NotEqual(t, key, keyNonEmpty)
}

func TestCreateNonceKey_AllNetworks(t *testing.T) {
	store := NewNonceStore(nil, time.Hour)

	networks := []string{
		"eip155:1",
		"eip155:8453",
		"eip155:42161",
		"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		"ton:mainnet",
		"tron:mainnet",
		"near:mainnet",
		"aptos:1",
		"tezos:NetXdQprcVkpaWU",
		"polkadot:68d56f15f85d3136970ec16946040bc1",
		"stacks:1",
	}

	keys := make(map[string]bool)
	for _, network := range networks {
		key := store.createNonceKey(network, "exact", "same-hash")
		assert.Len(t, key, 64)
		assert.False(t, keys[key], "Key collision detected for network %s", network)
		keys[key] = true
	}
}

// ============== Test ExtractNonceFromPayload ==============

func TestExtractNonceFromPayload_Basic(t *testing.T) {
	payload := []byte(`{"amount":"100","nonce":"abc123"}`)

	nonce := ExtractNonceFromPayload(payload)
	assert.NotEmpty(t, nonce)
	assert.Len(t, nonce, 64, "Should return a SHA256 hash (64 hex chars)")
}

func TestExtractNonceFromPayload_Deterministic(t *testing.T) {
	payload := []byte(`{"amount":"100","nonce":"abc123"}`)

	nonce1 := ExtractNonceFromPayload(payload)
	nonce2 := ExtractNonceFromPayload(payload)

	assert.Equal(t, nonce1, nonce2, "Same payload should produce same nonce")
}

func TestExtractNonceFromPayload_DifferentPayloads(t *testing.T) {
	payload1 := []byte(`{"amount":"100"}`)
	payload2 := []byte(`{"amount":"200"}`)

	nonce1 := ExtractNonceFromPayload(payload1)
	nonce2 := ExtractNonceFromPayload(payload2)

	assert.NotEqual(t, nonce1, nonce2, "Different payloads should produce different nonces")
}

func TestExtractNonceFromPayload_EmptyPayload(t *testing.T) {
	payload := []byte{}

	nonce := ExtractNonceFromPayload(payload)
	assert.NotEmpty(t, nonce, "Empty payload should still produce a hash")
	assert.Len(t, nonce, 64)
}

func TestExtractNonceFromPayload_NilPayload(t *testing.T) {
	nonce := ExtractNonceFromPayload(nil)
	assert.NotEmpty(t, nonce, "Nil payload should still produce a hash")
	assert.Len(t, nonce, 64)
}

func TestExtractNonceFromPayload_UsesComputePayloadHash(t *testing.T) {
	payload := []byte(`{"amount":"100"}`)

	// ExtractNonceFromPayload should return the same as ComputePayloadHash with nil requirements
	nonce := ExtractNonceFromPayload(payload)
	expected := ComputePayloadHash(payload, nil)

	assert.Equal(t, expected, nonce, "ExtractNonceFromPayload should use ComputePayloadHash internally")
}

// ============== Integration: Full Nonce Lifecycle ==============

func TestNonceStore_FullLifecycle(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	network := "eip155:8453"
	scheme := "exact"
	payloadHash := "lifecycle-test-hash"

	// Step 1: Nonce should not be used
	used, err := store.IsUsed(ctx, network, scheme, payloadHash)
	require.NoError(t, err)
	assert.False(t, used)

	// Step 2: Mark the nonce
	err = store.CheckAndMark(ctx, network, scheme, payloadHash)
	require.NoError(t, err)

	// Step 3: Nonce should now be used
	used, err = store.IsUsed(ctx, network, scheme, payloadHash)
	require.NoError(t, err)
	assert.True(t, used)

	// Step 4: CheckAndMark again should fail
	err = store.CheckAndMark(ctx, network, scheme, payloadHash)
	assert.ErrorIs(t, err, ErrNonceAlreadyUsed)
}

func TestNonceStore_TTLExpiry(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	// Use a short TTL
	store := NewNonceStore(cacheClient, 2*time.Second)
	ctx := context.Background()

	// Mark a nonce
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "expiry-test-hash")
	require.NoError(t, err)

	// Should be used
	used, err := store.IsUsed(ctx, "eip155:1", "exact", "expiry-test-hash")
	require.NoError(t, err)
	assert.True(t, used)

	// Fast-forward time past TTL
	mr.FastForward(3 * time.Second)

	// Should be expired and no longer used
	used, err = store.IsUsed(ctx, "eip155:1", "exact", "expiry-test-hash")
	require.NoError(t, err)
	assert.False(t, used)

	// Should be able to mark it again
	err = store.CheckAndMark(ctx, "eip155:1", "exact", "expiry-test-hash")
	assert.NoError(t, err)
}

func TestNonceStore_MultipleNonces(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)
	ctx := context.Background()

	nonces := []struct {
		network     string
		scheme      string
		payloadHash string
	}{
		{"eip155:1", "exact", "hash-1"},
		{"eip155:8453", "exact", "hash-2"},
		{"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "exact", "hash-3"},
		{"ton:mainnet", "exact", "hash-4"},
		{"tron:mainnet", "exact", "hash-5"},
	}

	// Mark all nonces
	for _, n := range nonces {
		err := store.CheckAndMark(ctx, n.network, n.scheme, n.payloadHash)
		require.NoError(t, err, "Failed to mark nonce for %s/%s/%s", n.network, n.scheme, n.payloadHash)
	}

	// All should be used
	for _, n := range nonces {
		used, err := store.IsUsed(ctx, n.network, n.scheme, n.payloadHash)
		require.NoError(t, err)
		assert.True(t, used, "Nonce should be used for %s/%s/%s", n.network, n.scheme, n.payloadHash)
	}

	// All should fail on reuse
	for _, n := range nonces {
		err := store.CheckAndMark(ctx, n.network, n.scheme, n.payloadHash)
		assert.ErrorIs(t, err, ErrNonceAlreadyUsed, "Nonce should be rejected for %s/%s/%s", n.network, n.scheme, n.payloadHash)
	}
}

func TestCheckAndMark_ContextCancellation(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	// With cancelled context, SetNX will error but CheckAndMark fails open
	err := store.CheckAndMark(ctx, "eip155:1", "exact", "ctx-cancel-hash")
	// Should fail open (return nil) since it's a cache error
	assert.NoError(t, err)
}

func TestIsUsed_ContextCancellation(t *testing.T) {
	cacheClient, mr := newTestNonceCacheClient(t)
	defer mr.Close()

	store := NewNonceStore(cacheClient, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	// With cancelled context, Exists will error
	used, err := store.IsUsed(ctx, "eip155:1", "exact", "ctx-cancel-hash")
	assert.Error(t, err)
	assert.False(t, used)
}

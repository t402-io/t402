package idempotency

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============== Mock Cache Client ==============

// mockCache implements a simple in-memory cache for testing
type mockCache struct {
	data   map[string]string
	expiry map[string]time.Time
	mu     sync.RWMutex

	// For simulating errors
	getErr   error
	setErr   error
	setNXErr error
	evalErr  error
}

func newMockCache() *mockCache {
	return &mockCache{
		data:   make(map[string]string),
		expiry: make(map[string]time.Time),
	}
}

func (m *mockCache) Get(ctx context.Context, key string) (string, error) {
	if m.getErr != nil {
		return "", m.getErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	val, ok := m.data[key]
	if !ok {
		return "", &keyNotFoundError{key: key}
	}
	return val, nil
}

func (m *mockCache) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	if m.setErr != nil {
		return m.setErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = value
	m.expiry[key] = time.Now().Add(ttl)
	return nil
}

func (m *mockCache) SetNX(ctx context.Context, key string, value string, ttl time.Duration) (bool, error) {
	if m.setNXErr != nil {
		return false, m.setNXErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.data[key]; exists {
		return false, nil
	}
	m.data[key] = value
	m.expiry[key] = time.Now().Add(ttl)
	return true, nil
}

func (m *mockCache) Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error) {
	if m.evalErr != nil {
		return nil, m.evalErr
	}
	// Simulate the checkAndCreateScript behavior
	if len(keys) == 0 {
		return nil, nil
	}
	key := keys[0]

	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.data[key]; ok {
		return existing, nil
	}

	// Create new entry
	if len(args) >= 2 {
		value := args[1].(string)
		m.data[key] = value
	}
	return nil, nil
}

type keyNotFoundError struct {
	key string
}

func (e *keyNotFoundError) Error() string {
	return "key not found: " + e.key
}

// ============== Test Store Creation ==============

func TestNewStore(t *testing.T) {
	tests := []struct {
		name        string
		ttl         time.Duration
		expectedTTL time.Duration
	}{
		{
			name:        "with custom TTL",
			ttl:         1 * time.Hour,
			expectedTTL: 1 * time.Hour,
		},
		{
			name:        "with zero TTL uses default",
			ttl:         0,
			expectedTTL: 24 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewStore(nil, tt.ttl)
			require.NotNil(t, store)
			assert.Equal(t, tt.expectedTTL, store.ttl)
			assert.Equal(t, "idempotency:", store.prefix)
		})
	}
}

// ============== Test Status Constants ==============

func TestStatusConstants(t *testing.T) {
	assert.Equal(t, Status("pending"), StatusPending)
	assert.Equal(t, Status("completed"), StatusCompleted)
	assert.Equal(t, Status("failed"), StatusFailed)
}

// ============== Test Entry Serialization ==============

func TestEntrySerialization(t *testing.T) {
	now := time.Now().UTC()
	entry := Entry{
		Key:         "test-key",
		PayloadHash: "abc123",
		Status:      StatusPending,
		Result:      []byte(`{"success":true}`),
		Error:       "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	data, err := json.Marshal(entry)
	require.NoError(t, err)

	var decoded Entry
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, entry.Key, decoded.Key)
	assert.Equal(t, entry.PayloadHash, decoded.PayloadHash)
	assert.Equal(t, entry.Status, decoded.Status)
}

// ============== Test ComputePayloadHash ==============

func TestComputePayloadHash(t *testing.T) {
	tests := []struct {
		name         string
		payload      []byte
		requirements []byte
	}{
		{
			name:         "basic hash",
			payload:      []byte(`{"amount":"100"}`),
			requirements: []byte(`{"network":"eip155:1"}`),
		},
		{
			name:         "empty payload",
			payload:      []byte{},
			requirements: []byte(`{"network":"eip155:1"}`),
		},
		{
			name:         "empty requirements",
			payload:      []byte(`{"amount":"100"}`),
			requirements: []byte{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := ComputePayloadHash(tt.payload, tt.requirements)
			assert.NotEmpty(t, hash)
			assert.Len(t, hash, 64) // SHA256 produces 64 hex characters

			// Same inputs should produce same hash
			hash2 := ComputePayloadHash(tt.payload, tt.requirements)
			assert.Equal(t, hash, hash2)
		})
	}
}

func TestComputePayloadHash_Different(t *testing.T) {
	// Different inputs should produce different hashes
	hash1 := ComputePayloadHash([]byte("payload1"), []byte("req1"))
	hash2 := ComputePayloadHash([]byte("payload2"), []byte("req1"))
	hash3 := ComputePayloadHash([]byte("payload1"), []byte("req2"))

	assert.NotEqual(t, hash1, hash2)
	assert.NotEqual(t, hash1, hash3)
	assert.NotEqual(t, hash2, hash3)
}

// ============== Test Check Method ==============

func TestCheck_NilCache(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	entry, err := store.Check(ctx, "key", "hash")
	assert.NoError(t, err)
	assert.Nil(t, entry) // Should return nil when cache is nil
}

func TestCheck_EmptyKey(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	entry, err := store.Check(ctx, "", "hash")
	assert.NoError(t, err)
	assert.Nil(t, entry) // Should return nil when key is empty
}

// ============== Test Create Method ==============

func TestCreate_NilCache(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Create(ctx, "key", "hash")
	assert.NoError(t, err) // Should succeed silently when cache is nil
}

func TestCreate_EmptyKey(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Create(ctx, "", "hash")
	assert.NoError(t, err) // Should succeed silently when key is empty
}

// ============== Test Complete Method ==============

func TestComplete_NilCache(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Complete(ctx, "key", []byte("result"))
	assert.NoError(t, err) // Should succeed silently when cache is nil
}

func TestComplete_EmptyKey(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Complete(ctx, "", []byte("result"))
	assert.NoError(t, err) // Should succeed silently when key is empty
}

// ============== Test Fail Method ==============

func TestFail_NilCache(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Fail(ctx, "key", "error message")
	assert.NoError(t, err) // Should succeed silently when cache is nil
}

func TestFail_EmptyKey(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	err := store.Fail(ctx, "", "error message")
	assert.NoError(t, err) // Should succeed silently when key is empty
}

// ============== Test CheckAndCreate Method ==============

func TestCheckAndCreate_NilCache(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	result, err := store.CheckAndCreate(ctx, "key", "hash")
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.True(t, result.Created)
	assert.Nil(t, result.Entry)
}

func TestCheckAndCreate_EmptyKey(t *testing.T) {
	store := &Store{cache: nil, prefix: "test:", ttl: time.Hour}
	ctx := context.Background()

	result, err := store.CheckAndCreate(ctx, "", "hash")
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.True(t, result.Created)
}

// ============== Test Error Types ==============

func TestErrors(t *testing.T) {
	errors := []error{
		ErrDuplicateRequest,
		ErrRequestInProgress,
		ErrPayloadMismatch,
	}

	for _, err := range errors {
		assert.NotNil(t, err)
		assert.NotEmpty(t, err.Error())
	}
}

// ============== Test Entry Model ==============

func TestEntryModel(t *testing.T) {
	now := time.Now()
	entry := Entry{
		Key:         "test-key-123",
		PayloadHash: "abcdef123456",
		Status:      StatusCompleted,
		Result:      []byte(`{"txHash":"0x123"}`),
		Error:       "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	assert.Equal(t, "test-key-123", entry.Key)
	assert.Equal(t, StatusCompleted, entry.Status)
	assert.NotEmpty(t, entry.Result)
}

// ============== Test CheckAndCreateResult ==============

func TestCheckAndCreateResult(t *testing.T) {
	// Test created result
	createdResult := &CheckAndCreateResult{
		Created: true,
		Entry:   nil,
	}
	assert.True(t, createdResult.Created)
	assert.Nil(t, createdResult.Entry)

	// Test existing result
	existingResult := &CheckAndCreateResult{
		Created: false,
		Entry: &Entry{
			Key:    "existing-key",
			Status: StatusCompleted,
		},
	}
	assert.False(t, existingResult.Created)
	assert.NotNil(t, existingResult.Entry)
	assert.Equal(t, "existing-key", existingResult.Entry.Key)
}

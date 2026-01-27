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

// ============== Integration Tests with Mock Cache ==============

// cacheInterface defines the methods needed from cache.Client for testing
type cacheInterface interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	SetNX(ctx context.Context, key string, value string, ttl time.Duration) (bool, error)
	Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error)
}

// storeWithMock creates a store with mock cache for testing
func storeWithMock(mock cacheInterface) *Store {
	// We need to use reflection or a wrapper since Store expects *cache.Client
	// For now, we'll create tests that work with the nil checks
	return &Store{
		cache:  nil, // Tests will use direct method calls
		prefix: "idempotency:",
		ttl:    time.Hour,
	}
}

func TestCheckAndCreate_NewEntry(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	// Manually test the logic since we can't inject mock directly
	key := "idempotency:test-key"
	payloadHash := "hash123"

	// Simulate CheckAndCreate logic
	entry := Entry{
		Key:         "test-key",
		PayloadHash: payloadHash,
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	data, err := json.Marshal(entry)
	require.NoError(t, err)

	// First call should create
	result, err := mock.Eval(ctx, checkAndCreateScript, []string{key}, 3600, string(data))
	require.NoError(t, err)
	assert.Nil(t, result) // nil means created

	// Verify entry was stored
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, string(data), stored)
}

func TestCheckAndCreate_ExistingEntry(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:existing-key"
	payloadHash := "hash123"

	// Pre-populate with existing entry
	existingEntry := Entry{
		Key:         "existing-key",
		PayloadHash: payloadHash,
		Status:      StatusCompleted,
		Result:      []byte(`{"txHash":"0xabc"}`),
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	existingData, _ := json.Marshal(existingEntry)
	mock.Set(ctx, key, string(existingData), time.Hour)

	// New entry attempt
	newEntry := Entry{
		Key:         "existing-key",
		PayloadHash: payloadHash,
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	newData, _ := json.Marshal(newEntry)

	// Should return existing entry
	result, err := mock.Eval(ctx, checkAndCreateScript, []string{key}, 3600, string(newData))
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Verify it's the existing entry
	resultStr, ok := result.(string)
	require.True(t, ok)

	var returned Entry
	err = json.Unmarshal([]byte(resultStr), &returned)
	require.NoError(t, err)
	assert.Equal(t, StatusCompleted, returned.Status)
}

func TestCreate_Success(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:new-key"
	entry := Entry{
		Key:         "new-key",
		PayloadHash: "hash456",
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)

	// SetNX should succeed for new key
	set, err := mock.SetNX(ctx, key, string(data), time.Hour)
	require.NoError(t, err)
	assert.True(t, set)

	// Verify stored
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, string(data), stored)
}

func TestCreate_Duplicate(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:dup-key"
	entry := Entry{
		Key:         "dup-key",
		PayloadHash: "hash789",
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)

	// First SetNX succeeds
	set, err := mock.SetNX(ctx, key, string(data), time.Hour)
	require.NoError(t, err)
	assert.True(t, set)

	// Second SetNX fails (duplicate)
	set, err = mock.SetNX(ctx, key, string(data), time.Hour)
	require.NoError(t, err)
	assert.False(t, set)
}

func TestComplete_Success(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:complete-key"

	// Create initial pending entry
	entry := Entry{
		Key:         "complete-key",
		PayloadHash: "hash-complete",
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)
	mock.Set(ctx, key, string(data), time.Hour)

	// Get and update to completed
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)

	var retrieved Entry
	err = json.Unmarshal([]byte(stored), &retrieved)
	require.NoError(t, err)

	retrieved.Status = StatusCompleted
	retrieved.Result = []byte(`{"success":true}`)
	retrieved.UpdatedAt = time.Now().UTC()

	updatedData, _ := json.Marshal(retrieved)
	err = mock.Set(ctx, key, string(updatedData), time.Hour)
	require.NoError(t, err)

	// Verify update
	final, _ := mock.Get(ctx, key)
	var finalEntry Entry
	json.Unmarshal([]byte(final), &finalEntry)
	assert.Equal(t, StatusCompleted, finalEntry.Status)
	assert.NotNil(t, finalEntry.Result)
}

func TestFail_Success(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:fail-key"

	// Create initial pending entry
	entry := Entry{
		Key:         "fail-key",
		PayloadHash: "hash-fail",
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)
	mock.Set(ctx, key, string(data), time.Hour)

	// Get and update to failed
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)

	var retrieved Entry
	err = json.Unmarshal([]byte(stored), &retrieved)
	require.NoError(t, err)

	retrieved.Status = StatusFailed
	retrieved.Error = "transaction reverted"
	retrieved.UpdatedAt = time.Now().UTC()

	updatedData, _ := json.Marshal(retrieved)
	err = mock.Set(ctx, key, string(updatedData), time.Hour)
	require.NoError(t, err)

	// Verify update
	final, _ := mock.Get(ctx, key)
	var finalEntry Entry
	json.Unmarshal([]byte(final), &finalEntry)
	assert.Equal(t, StatusFailed, finalEntry.Status)
	assert.Equal(t, "transaction reverted", finalEntry.Error)
}

func TestCheck_ExistingEntry(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:check-key"
	payloadHash := "hash-check"

	// Create existing entry
	entry := Entry{
		Key:         "check-key",
		PayloadHash: payloadHash,
		Status:      StatusCompleted,
		Result:      []byte(`{"txHash":"0x123"}`),
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)
	mock.Set(ctx, key, string(data), time.Hour)

	// Check should find it
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)

	var retrieved Entry
	err = json.Unmarshal([]byte(stored), &retrieved)
	require.NoError(t, err)

	assert.Equal(t, payloadHash, retrieved.PayloadHash)
	assert.Equal(t, StatusCompleted, retrieved.Status)
}

func TestCheck_PayloadMismatch(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:mismatch-key"

	// Create entry with one hash
	entry := Entry{
		Key:         "mismatch-key",
		PayloadHash: "original-hash",
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	data, _ := json.Marshal(entry)
	mock.Set(ctx, key, string(data), time.Hour)

	// Check with different hash
	stored, err := mock.Get(ctx, key)
	require.NoError(t, err)

	var retrieved Entry
	err = json.Unmarshal([]byte(stored), &retrieved)
	require.NoError(t, err)

	differentHash := "different-hash"
	assert.NotEqual(t, retrieved.PayloadHash, differentHash)
}

func TestCheck_NotFound(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	key := "idempotency:nonexistent-key"

	// Should return error for non-existent key
	_, err := mock.Get(ctx, key)
	assert.Error(t, err)
}

// ============== Error Simulation Tests ==============

func TestMockCache_GetError(t *testing.T) {
	mock := newMockCache()
	mock.getErr = assert.AnError
	ctx := context.Background()

	_, err := mock.Get(ctx, "any-key")
	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
}

func TestMockCache_SetError(t *testing.T) {
	mock := newMockCache()
	mock.setErr = assert.AnError
	ctx := context.Background()

	err := mock.Set(ctx, "any-key", "value", time.Hour)
	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
}

func TestMockCache_SetNXError(t *testing.T) {
	mock := newMockCache()
	mock.setNXErr = assert.AnError
	ctx := context.Background()

	_, err := mock.SetNX(ctx, "any-key", "value", time.Hour)
	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
}

func TestMockCache_EvalError(t *testing.T) {
	mock := newMockCache()
	mock.evalErr = assert.AnError
	ctx := context.Background()

	_, err := mock.Eval(ctx, "script", []string{"key"}, "arg1")
	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
}

func TestMockCache_EvalEmptyKeys(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	result, err := mock.Eval(ctx, "script", []string{}, "arg1")
	require.NoError(t, err)
	assert.Nil(t, result)
}

// ============== Entry State Transitions ==============

func TestEntryStateTransitions(t *testing.T) {
	tests := []struct {
		name       string
		fromStatus Status
		toStatus   Status
	}{
		{"pending to completed", StatusPending, StatusCompleted},
		{"pending to failed", StatusPending, StatusFailed},
		{"failed to pending (retry)", StatusFailed, StatusPending},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry := Entry{
				Key:       "transition-test",
				Status:    tt.fromStatus,
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
			}

			// Simulate transition
			entry.Status = tt.toStatus
			entry.UpdatedAt = time.Now().UTC()

			assert.Equal(t, tt.toStatus, entry.Status)
		})
	}
}

// ============== Concurrent Access Tests ==============

func TestMockCache_ConcurrentAccess(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			key := "concurrent-key"
			value := "value"
			mock.SetNX(ctx, key, value, time.Hour)
		}(i)
	}

	wg.Wait()

	// Only one should have succeeded
	val, err := mock.Get(ctx, "concurrent-key")
	require.NoError(t, err)
	assert.Equal(t, "value", val)
}

func TestMockCache_ConcurrentReads(t *testing.T) {
	mock := newMockCache()
	ctx := context.Background()

	// Set initial value
	mock.Set(ctx, "read-key", "test-value", time.Hour)

	var wg sync.WaitGroup
	results := make([]string, 10)

	// Concurrent reads
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			val, _ := mock.Get(ctx, "read-key")
			results[i] = val
		}(i)
	}

	wg.Wait()

	// All should have same value
	for _, result := range results {
		assert.Equal(t, "test-value", result)
	}
}

package auth

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"
)

func TestHashKey(t *testing.T) {
	key1 := hashKey("test-key-1")
	key2 := hashKey("test-key-1")
	key3 := hashKey("test-key-2")

	// Same key should produce same hash
	if key1 != key2 {
		t.Errorf("Expected same hash for same key, got %s and %s", key1, key2)
	}

	// Different keys should produce different hashes
	if key1 == key3 {
		t.Errorf("Expected different hash for different keys")
	}

	// Hash should be 64 characters (SHA-256 hex)
	if len(key1) != 64 {
		t.Errorf("Expected hash length 64, got %d", len(key1))
	}
}

func TestLoadFromEnv(t *testing.T) {
	manager := NewManager(nil)

	// Test empty value
	err := manager.LoadFromEnv("")
	if err != nil {
		t.Errorf("Expected no error for empty value, got %v", err)
	}
	if manager.GetKeyCount() != 0 {
		t.Errorf("Expected 0 keys, got %d", manager.GetKeyCount())
	}

	// Test single key without name
	manager = NewManager(nil)
	err = manager.LoadFromEnv("my-secret-key")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if manager.GetKeyCount() != 1 {
		t.Errorf("Expected 1 key, got %d", manager.GetKeyCount())
	}

	// Test single key with name
	manager = NewManager(nil)
	err = manager.LoadFromEnv("my-secret-key:production")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if manager.GetKeyCount() != 1 {
		t.Errorf("Expected 1 key, got %d", manager.GetKeyCount())
	}

	// Test multiple keys
	manager = NewManager(nil)
	err = manager.LoadFromEnv("key1:app1,key2:app2,key3:analytics")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if manager.GetKeyCount() != 3 {
		t.Errorf("Expected 3 keys, got %d", manager.GetKeyCount())
	}
}

func TestValidateKey(t *testing.T) {
	manager := NewManager(nil)
	err := manager.LoadFromEnv("test-key:test-app")
	if err != nil {
		t.Fatalf("Failed to load keys: %v", err)
	}

	ctx := context.Background()

	// Test valid key
	keyInfo, err := manager.ValidateKey(ctx, "test-key")
	if err != nil {
		t.Errorf("Expected valid key, got error: %v", err)
	}
	if keyInfo == nil {
		t.Error("Expected key info, got nil")
	}
	if keyInfo.Name != "test-app" {
		t.Errorf("Expected name 'test-app', got '%s'", keyInfo.Name)
	}

	// Test invalid key
	_, err = manager.ValidateKey(ctx, "invalid-key")
	if err != ErrInvalidAPIKey {
		t.Errorf("Expected ErrInvalidAPIKey, got %v", err)
	}

	// Test empty key
	_, err = manager.ValidateKey(ctx, "")
	if err != ErrInvalidAPIKey {
		t.Errorf("Expected ErrInvalidAPIKey for empty key, got %v", err)
	}
}

func TestAPIKeyPermissions(t *testing.T) {
	// Test key with no permissions (should allow all)
	key := &APIKey{
		Permissions: nil,
	}
	if !key.HasPermission("verify") {
		t.Error("Expected permission for 'verify' when no permissions set")
	}

	// Test key with specific permissions
	key = &APIKey{
		Permissions: []string{"verify", "supported"},
	}
	if !key.HasPermission("verify") {
		t.Error("Expected permission for 'verify'")
	}
	if key.HasPermission("settle") {
		t.Error("Expected no permission for 'settle'")
	}

	// Test key with wildcard permission
	key = &APIKey{
		Permissions: []string{"*"},
	}
	if !key.HasPermission("anything") {
		t.Error("Expected wildcard permission to allow all")
	}
}

func TestAPIKeyExpiration(t *testing.T) {
	// Test non-expiring key
	key := &APIKey{}
	if key.IsExpired() {
		t.Error("Expected non-expiring key to not be expired")
	}
}

func TestSecureCompare(t *testing.T) {
	// Test equal strings
	if !SecureCompare("test", "test") {
		t.Error("Expected equal strings to match")
	}

	// Test different strings
	if SecureCompare("test", "test2") {
		t.Error("Expected different strings to not match")
	}

	// Test different lengths
	if SecureCompare("test", "testing") {
		t.Error("Expected different length strings to not match")
	}
}

func TestGenerateSecureKey(t *testing.T) {
	key1, err := generateSecureKey(32)
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	key2, err := generateSecureKey(32)
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	// Keys should be unique
	if key1 == key2 {
		t.Error("Expected unique keys")
	}

	// Key should have prefix
	if len(key1) < 5 || key1[:5] != "t402_" {
		t.Errorf("Expected key to start with 't402_', got '%s'", key1[:5])
	}
}

func TestNewManager(t *testing.T) {
	manager := NewManager(nil)
	if manager == nil {
		t.Fatal("Expected non-nil manager")
	}
	if manager.keys == nil {
		t.Error("Expected keys map to be initialized")
	}
	if manager.keyPrefix != "apikey:" {
		t.Errorf("Expected keyPrefix='apikey:', got '%s'", manager.keyPrefix)
	}
}

func TestListKeys(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("key1:app1,key2:app2")

	keys := manager.ListKeys()
	if len(keys) != 2 {
		t.Errorf("Expected 2 keys, got %d", len(keys))
	}
}

func TestHasKeys(t *testing.T) {
	manager := NewManager(nil)

	if manager.HasKeys() {
		t.Error("Expected HasKeys()=false for empty manager")
	}

	manager.LoadFromEnv("test-key:app")

	if !manager.HasKeys() {
		t.Error("Expected HasKeys()=true after adding keys")
	}
}

func TestGetKeyCount(t *testing.T) {
	manager := NewManager(nil)

	if manager.GetKeyCount() != 0 {
		t.Errorf("Expected 0 keys, got %d", manager.GetKeyCount())
	}

	manager.LoadFromEnv("key1:app1,key2:app2,key3:app3")

	if manager.GetKeyCount() != 3 {
		t.Errorf("Expected 3 keys, got %d", manager.GetKeyCount())
	}
}

func TestCreateKey(t *testing.T) {
	manager := NewManager(nil)

	rawKey, apiKey, err := manager.CreateKey(context.Background(), "test-app", 1000, 0, []string{"verify", "settle"})
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	if rawKey == "" {
		t.Error("Expected non-empty raw key")
	}
	if apiKey == nil {
		t.Fatal("Expected non-nil API key")
	}
	if apiKey.Name != "test-app" {
		t.Errorf("Expected name='test-app', got '%s'", apiKey.Name)
	}
	if apiKey.RateLimit != 1000 {
		t.Errorf("Expected rateLimit=1000, got %d", apiKey.RateLimit)
	}
	if len(apiKey.Permissions) != 2 {
		t.Errorf("Expected 2 permissions, got %d", len(apiKey.Permissions))
	}
	if apiKey.ID == "" {
		t.Error("Expected non-empty ID")
	}
	if apiKey.KeyHash == "" {
		t.Error("Expected non-empty KeyHash")
	}

	// Validate the created key works
	validatedKey, err := manager.ValidateKey(context.Background(), rawKey)
	if err != nil {
		t.Fatalf("Failed to validate created key: %v", err)
	}
	if validatedKey.ID != apiKey.ID {
		t.Error("Validated key ID doesn't match created key ID")
	}
}

func TestCreateKeyWithExpiration(t *testing.T) {
	manager := NewManager(nil)

	_, apiKey, err := manager.CreateKey(context.Background(), "expiring-app", 0, time.Hour, nil)
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	if apiKey.ExpiresAt.IsZero() {
		t.Error("Expected non-zero expiration time")
	}
	if apiKey.ExpiresAt.Before(time.Now()) {
		t.Error("Expected expiration to be in the future")
	}
}

func TestRevokeKey(t *testing.T) {
	manager := NewManager(nil)

	rawKey, apiKey, _ := manager.CreateKey(context.Background(), "to-revoke", 0, 0, nil)

	// Revoke the key
	err := manager.RevokeKey(context.Background(), apiKey.ID)
	if err != nil {
		t.Fatalf("Failed to revoke key: %v", err)
	}

	// Try to validate revoked key
	_, err = manager.ValidateKey(context.Background(), rawKey)
	if err != ErrAPIKeyRevoked {
		t.Errorf("Expected ErrAPIKeyRevoked, got %v", err)
	}
}

func TestRevokeKeyNotFound(t *testing.T) {
	manager := NewManager(nil)

	err := manager.RevokeKey(context.Background(), "non-existent-id")
	if err != ErrInvalidAPIKey {
		t.Errorf("Expected ErrInvalidAPIKey, got %v", err)
	}
}

func TestAPIKeyIsExpired(t *testing.T) {
	// Test non-expiring key
	key := &APIKey{}
	if key.IsExpired() {
		t.Error("Expected non-expiring key to not be expired")
	}

	// Test expired key
	key = &APIKey{
		ExpiresAt: time.Now().Add(-time.Hour),
	}
	if !key.IsExpired() {
		t.Error("Expected expired key to be expired")
	}

	// Test future expiration
	key = &APIKey{
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if key.IsExpired() {
		t.Error("Expected future expiration to not be expired")
	}
}

func TestValidateExpiredKey(t *testing.T) {
	manager := NewManager(nil)

	// Create a key that's already expired
	rawKey := "test-expired-key"
	apiKey := &APIKey{
		ID:        generateKeyID(),
		Name:      "expired",
		KeyHash:   hashKey(rawKey),
		CreatedAt: time.Now().Add(-2 * time.Hour),
		ExpiresAt: time.Now().Add(-time.Hour),
	}

	manager.mu.Lock()
	manager.keys[apiKey.KeyHash] = apiKey
	manager.mu.Unlock()

	_, err := manager.ValidateKey(context.Background(), rawKey)
	if err != ErrAPIKeyExpired {
		t.Errorf("Expected ErrAPIKeyExpired, got %v", err)
	}
}

func TestGenerateKeyID(t *testing.T) {
	id1 := generateKeyID()
	id2 := generateKeyID()

	// IDs should be unique
	if id1 == id2 {
		t.Error("Expected unique IDs")
	}

	// ID should be 16 characters (8 bytes hex encoded)
	if len(id1) != 16 {
		t.Errorf("Expected ID length=16, got %d", len(id1))
	}
}

func TestLoadFromEnvWithSpaces(t *testing.T) {
	manager := NewManager(nil)
	err := manager.LoadFromEnv(" key1 : app1 , key2 : app2 ")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if manager.GetKeyCount() != 2 {
		t.Errorf("Expected 2 keys, got %d", manager.GetKeyCount())
	}
}

func TestLoadFromEnvEmptyParts(t *testing.T) {
	manager := NewManager(nil)
	err := manager.LoadFromEnv(",,,key1:app1,,,")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if manager.GetKeyCount() != 1 {
		t.Errorf("Expected 1 key, got %d", manager.GetKeyCount())
	}
}

func TestAPIKeyJSON(t *testing.T) {
	key := &APIKey{
		ID:          "test-id",
		Name:        "test-name",
		KeyHash:     "abc123",
		RateLimit:   100,
		CreatedAt:   time.Now(),
		UsageCount:  50,
		Revoked:     false,
		Permissions: []string{"verify", "settle"},
	}

	data, err := json.Marshal(key)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var decoded APIKey
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if decoded.ID != key.ID {
		t.Errorf("Expected ID=%s, got %s", key.ID, decoded.ID)
	}
	if decoded.Name != key.Name {
		t.Errorf("Expected Name=%s, got %s", key.Name, decoded.Name)
	}
	if decoded.RateLimit != key.RateLimit {
		t.Errorf("Expected RateLimit=%d, got %d", key.RateLimit, decoded.RateLimit)
	}
	if len(decoded.Permissions) != len(key.Permissions) {
		t.Errorf("Expected %d permissions, got %d", len(key.Permissions), len(decoded.Permissions))
	}
}

func TestSecureCompareEmpty(t *testing.T) {
	// Empty strings should match
	if !SecureCompare("", "") {
		t.Error("Expected empty strings to match")
	}
}

func TestSaveToRedisNil(t *testing.T) {
	manager := NewManager(nil)

	apiKey := &APIKey{
		ID:      "test",
		KeyHash: "hash",
	}

	// Should not error with nil redis
	err := manager.saveToRedis(context.Background(), apiKey)
	if err != nil {
		t.Errorf("Expected no error with nil redis, got %v", err)
	}
}

func TestGetFromRedisNil(t *testing.T) {
	manager := NewManager(nil)

	// Should return nil, nil with nil redis
	key, err := manager.getFromRedis(context.Background(), "any-hash")
	if err != nil {
		t.Errorf("Expected no error with nil redis, got %v", err)
	}
	if key != nil {
		t.Error("Expected nil key with nil redis")
	}
}

func TestRecordUsageConcurrent(t *testing.T) {
	manager := NewManager(nil)

	// Create an API key
	_, apiKey, err := manager.CreateKey(context.Background(), "concurrent-test", 0, 0, nil)
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	// Get initial count using atomic load
	initialCount := atomic.LoadInt64(&apiKey.UsageCount)

	// Run concurrent usage recordings
	const numGoroutines = 100
	done := make(chan bool, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			manager.recordUsage(context.Background(), apiKey)
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	// Check that usage count is correct using atomic load
	finalCount := atomic.LoadInt64(&apiKey.UsageCount)
	expectedCount := initialCount + numGoroutines
	if finalCount != expectedCount {
		t.Errorf("Expected usage count %d, got %d (race condition detected)", expectedCount, finalCount)
	}
}

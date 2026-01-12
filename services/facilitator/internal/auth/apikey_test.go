package auth

import (
	"context"
	"testing"
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

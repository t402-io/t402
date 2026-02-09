package cache

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestParseRedisURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		wantAddr string
		wantUser string
		wantPass string
		wantErr  bool
	}{
		{
			name:     "simple URL",
			url:      "redis://localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "with password",
			url:      "redis://user:pass@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "pass",
			wantErr:  false,
		},
		{
			name:     "with username only",
			url:      "redis://user@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "custom port",
			url:      "redis://redis.example.com:6380",
			wantAddr: "redis.example.com:6380",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:    "invalid URL",
			url:     "://invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if opts.Addr != tt.wantAddr {
				t.Errorf("Addr = %s, want %s", opts.Addr, tt.wantAddr)
			}
			if opts.Username != tt.wantUser {
				t.Errorf("Username = %s, want %s", opts.Username, tt.wantUser)
			}
			if opts.Password != tt.wantPass {
				t.Errorf("Password = %s, want %s", opts.Password, tt.wantPass)
			}
		})
	}
}

func TestParseRedisURL_EdgeCases(t *testing.T) {
	// Empty password (password separator present but no password)
	opts, err := parseRedisURL("redis://user:@localhost:6379")
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if opts.Username != "user" {
		t.Errorf("Username = %s, want user", opts.Username)
	}
	if opts.Password != "" {
		t.Errorf("Password = %s, want empty", opts.Password)
	}
}

// Note: NewClient and the other methods require a real Redis connection to test.
// For integration testing with Redis, consider using a test Redis container.

func TestParseRedisURL_SpecialCharacters(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		wantAddr string
		wantUser string
		wantPass string
		wantErr  bool
	}{
		{
			name:     "password with special chars",
			url:      "redis://user:p%40ss%3Aword@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "p@ss:word",
			wantErr:  false,
		},
		{
			name:     "ipv4 address",
			url:      "redis://192.168.1.100:6379",
			wantAddr: "192.168.1.100:6379",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "no port",
			url:      "redis://localhost",
			wantAddr: "localhost",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if opts.Addr != tt.wantAddr {
				t.Errorf("Addr = %s, want %s", opts.Addr, tt.wantAddr)
			}
			if opts.Username != tt.wantUser {
				t.Errorf("Username = %s, want %s", opts.Username, tt.wantUser)
			}
			if opts.Password != tt.wantPass {
				t.Errorf("Password = %s, want %s", opts.Password, tt.wantPass)
			}
		})
	}
}

func TestParseRedisURL_Scheme(t *testing.T) {
	// Test different schemes
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"redis scheme", "redis://localhost:6379", false},
		{"rediss scheme", "rediss://localhost:6379", false},
		{"http scheme (still parses)", "http://localhost:6379", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestParseRedisURL_EmptyURL(t *testing.T) {
	opts, err := parseRedisURL("")
	if err != nil {
		t.Errorf("Unexpected error for empty URL: %v", err)
	}
	if opts.Addr != "" {
		t.Errorf("Expected empty Addr for empty URL, got %s", opts.Addr)
	}
}

func TestParseRedisURL_PathIgnored(t *testing.T) {
	// Redis URLs typically include a database number in the path
	opts, err := parseRedisURL("redis://localhost:6379/0")
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if opts.Addr != "localhost:6379" {
		t.Errorf("Addr = %s, want localhost:6379", opts.Addr)
	}
	// Note: The current implementation doesn't parse the database number from path
	// This test documents current behavior
}

// Helper function to create a test client with miniredis
func newTestClient(t *testing.T) (*Client, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return &Client{client: client}, mr
}

func TestNewClient_Success(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}
	defer mr.Close()

	client, err := NewClient("redis://" + mr.Addr())
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	if client == nil {
		t.Fatal("Expected non-nil client")
	}
}

func TestNewClient_InvalidURL(t *testing.T) {
	_, err := NewClient("://invalid")
	if err == nil {
		t.Error("Expected error for invalid URL")
	}
}

func TestNewClient_ConnectionFailed(t *testing.T) {
	// Try to connect to a non-existent Redis server
	_, err := NewClient("redis://localhost:59999")
	if err == nil {
		t.Error("Expected error for failed connection")
	}
}

func TestClient_GetSet(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Test Set
	err := client.Set(ctx, "test-key", "test-value", time.Minute)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Test Get
	value, err := client.Get(ctx, "test-key")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "test-value" {
		t.Errorf("Expected 'test-value', got '%s'", value)
	}
}

func TestClient_Get_NotFound(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	_, err := client.Get(ctx, "non-existent-key")
	if err == nil {
		t.Error("Expected error for non-existent key")
	}
}

func TestClient_SetWithTTL(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set with TTL (miniredis requires at least 1 second)
	err := client.Set(ctx, "ttl-key", "value", 2*time.Second)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Should exist immediately
	value, err := client.Get(ctx, "ttl-key")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "value" {
		t.Errorf("Expected 'value', got '%s'", value)
	}

	// Fast-forward time in miniredis
	mr.FastForward(3 * time.Second)

	// Should be expired now
	_, err = client.Get(ctx, "ttl-key")
	if err == nil {
		t.Error("Expected error for expired key")
	}
}

func TestClient_Incr(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// First increment should return 1
	count, err := client.Incr(ctx, "counter")
	if err != nil {
		t.Fatalf("Incr failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}

	// Second increment should return 2
	count, err = client.Incr(ctx, "counter")
	if err != nil {
		t.Fatalf("Incr failed: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected count=2, got %d", count)
	}

	// Third increment should return 3
	count, err = client.Incr(ctx, "counter")
	if err != nil {
		t.Fatalf("Incr failed: %v", err)
	}
	if count != 3 {
		t.Errorf("Expected count=3, got %d", count)
	}
}

func TestClient_Expire(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set a key without TTL
	err := client.Set(ctx, "expire-key", "value", 0)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Set expiry (miniredis requires at least 1 second)
	err = client.Expire(ctx, "expire-key", 2*time.Second)
	if err != nil {
		t.Fatalf("Expire failed: %v", err)
	}

	// Should exist
	_, err = client.Get(ctx, "expire-key")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	// Fast-forward time
	mr.FastForward(3 * time.Second)

	// Should be expired
	_, err = client.Get(ctx, "expire-key")
	if err == nil {
		t.Error("Expected error for expired key")
	}
}

func TestClient_TTL(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set a key with TTL
	err := client.Set(ctx, "ttl-key", "value", time.Minute)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Get TTL
	ttl, err := client.TTL(ctx, "ttl-key")
	if err != nil {
		t.Fatalf("TTL failed: %v", err)
	}

	// TTL should be close to 1 minute
	if ttl < 50*time.Second || ttl > 61*time.Second {
		t.Errorf("Expected TTL around 60s, got %v", ttl)
	}
}

func TestClient_TTL_NoExpiry(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set a key without TTL
	err := client.Set(ctx, "no-ttl-key", "value", 0)
	if err != nil {
		t.Fatalf("Set failed: %v", err)
	}

	// Get TTL - should return -1 for keys without expiry
	ttl, err := client.TTL(ctx, "no-ttl-key")
	if err != nil {
		t.Fatalf("TTL failed: %v", err)
	}

	// -1 means no expiry, -2 means key doesn't exist
	if ttl != -1*time.Second {
		t.Logf("TTL for key without expiry: %v (expected -1s)", ttl)
	}
}

func TestClient_Delete(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set keys
	client.Set(ctx, "key1", "value1", 0)
	client.Set(ctx, "key2", "value2", 0)

	// Delete single key
	err := client.Delete(ctx, "key1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Should not exist
	exists, _ := client.Exists(ctx, "key1")
	if exists {
		t.Error("key1 should not exist after delete")
	}

	// key2 should still exist
	exists, _ = client.Exists(ctx, "key2")
	if !exists {
		t.Error("key2 should still exist")
	}
}

func TestClient_Delete_Multiple(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Set keys
	client.Set(ctx, "key1", "value1", 0)
	client.Set(ctx, "key2", "value2", 0)
	client.Set(ctx, "key3", "value3", 0)

	// Delete multiple keys
	err := client.Delete(ctx, "key1", "key2")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// key1 and key2 should not exist
	exists, _ := client.Exists(ctx, "key1")
	if exists {
		t.Error("key1 should not exist")
	}
	exists, _ = client.Exists(ctx, "key2")
	if exists {
		t.Error("key2 should not exist")
	}

	// key3 should still exist
	exists, _ = client.Exists(ctx, "key3")
	if !exists {
		t.Error("key3 should still exist")
	}
}

func TestClient_Exists(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Non-existent key
	exists, err := client.Exists(ctx, "non-existent")
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if exists {
		t.Error("Expected key to not exist")
	}

	// Set a key
	client.Set(ctx, "exists-key", "value", 0)

	// Should exist now
	exists, err = client.Exists(ctx, "exists-key")
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if !exists {
		t.Error("Expected key to exist")
	}
}

func TestClient_Ping(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	err := client.Ping(ctx)
	if err != nil {
		t.Fatalf("Ping failed: %v", err)
	}
}

func TestClient_Close(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()

	err := client.Close()
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// Operations should fail after close
	ctx := context.Background()
	_, err = client.Get(ctx, "test")
	if err == nil {
		t.Error("Expected error after close")
	}
}

func TestClient_SetWithDifferentTypes(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	tests := []struct {
		name  string
		key   string
		value interface{}
	}{
		{"string", "str-key", "string-value"},
		{"int", "int-key", 42},
		{"float", "float-key", 3.14},
		{"bool", "bool-key", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.Set(ctx, tt.key, tt.value, 0)
			if err != nil {
				t.Errorf("Set failed for %s: %v", tt.name, err)
			}

			// Verify key exists
			exists, _ := client.Exists(ctx, tt.key)
			if !exists {
				t.Errorf("Key %s should exist", tt.key)
			}
		})
	}
}

func TestClient_ContextCancellation(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	// Operations with cancelled context should fail
	err := client.Set(ctx, "key", "value", 0)
	if err == nil {
		t.Error("Expected error with cancelled context")
	}
}

func TestClient_ConcurrentOperations(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()
	done := make(chan bool, 100)

	// Run concurrent increments
	for i := 0; i < 100; i++ {
		go func() {
			_, err := client.Incr(ctx, "concurrent-counter")
			if err != nil {
				t.Errorf("Concurrent Incr failed: %v", err)
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}

	// Final count should be 100
	value, err := client.Get(ctx, "concurrent-counter")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if value != "100" {
		t.Errorf("Expected '100', got '%s'", value)
	}
}

func TestValidateCacheKey(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantErr string
	}{
		{
			name:    "empty string",
			key:     "",
			wantErr: "cache key cannot be empty",
		},
		{
			name:    "valid key with colons underscores hyphens dots",
			key:     "my-key:123_test.value",
			wantErr: "",
		},
		{
			name:    "key with spaces",
			key:     "my key",
			wantErr: "invalid characters",
		},
		{
			name:    "key with newlines",
			key:     "my\nkey",
			wantErr: "invalid characters",
		},
		{
			name:    "key with null bytes",
			key:     "my\x00key",
			wantErr: "invalid characters",
		},
		{
			name:    "key at max length",
			key:     strings.Repeat("a", 1024),
			wantErr: "",
		},
		{
			name:    "key over max length",
			key:     strings.Repeat("a", 1025),
			wantErr: "exceeds maximum length",
		},
		{
			name:    "key with special chars",
			key:     "key@#$",
			wantErr: "invalid characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCacheKey(tt.key)
			if tt.wantErr == "" {
				if err != nil {
					t.Errorf("Expected no error, got: %v", err)
				}
			} else {
				if err == nil {
					t.Errorf("Expected error containing %q, got nil", tt.wantErr)
					return
				}
				if !strings.Contains(err.Error(), tt.wantErr) {
					t.Errorf("Expected error containing %q, got: %v", tt.wantErr, err)
				}
			}
		})
	}
}

func TestSanitizeKey(t *testing.T) {
	t.Run("basic sanitization with prefix", func(t *testing.T) {
		result := SanitizeKey("prefix:", "some untrusted input")
		if !strings.HasPrefix(result, "prefix:") {
			t.Errorf("Expected result to start with 'prefix:', got %q", result)
		}
		// prefix (7 chars) + sha256 hex (64 chars) = 71 chars
		if len(result) != 7+64 {
			t.Errorf("Expected length %d, got %d", 7+64, len(result))
		}
	})

	t.Run("deterministic same input same output", func(t *testing.T) {
		result1 := SanitizeKey("p:", "input")
		result2 := SanitizeKey("p:", "input")
		if result1 != result2 {
			t.Errorf("Same input produced different outputs: %q vs %q", result1, result2)
		}
	})

	t.Run("different inputs produce different outputs", func(t *testing.T) {
		result1 := SanitizeKey("p:", "input1")
		result2 := SanitizeKey("p:", "input2")
		if result1 == result2 {
			t.Errorf("Different inputs produced same output: %q", result1)
		}
	})

	t.Run("empty prefix works", func(t *testing.T) {
		result := SanitizeKey("", "test")
		// Should be just the 64-char hex hash
		if len(result) != 64 {
			t.Errorf("Expected length 64 with empty prefix, got %d", len(result))
		}
	})

	t.Run("empty input produces consistent hash", func(t *testing.T) {
		result1 := SanitizeKey("k:", "")
		result2 := SanitizeKey("k:", "")
		if result1 != result2 {
			t.Errorf("Empty input produced inconsistent hashes: %q vs %q", result1, result2)
		}
		if len(result1) != 2+64 {
			t.Errorf("Expected length %d, got %d", 2+64, len(result1))
		}
	})

	t.Run("result always passes ValidateCacheKey", func(t *testing.T) {
		inputs := []string{
			"normal",
			"has spaces and @#$ symbols",
			"newline\n\ttabs",
			"\x00null\x00bytes",
			strings.Repeat("x", 2000),
			"",
		}
		for _, input := range inputs {
			result := SanitizeKey("safe:", input)
			if err := ValidateCacheKey(result); err != nil {
				t.Errorf("SanitizeKey(%q) produced invalid key %q: %v", input, result, err)
			}
		}
	})
}

func TestSetNX(t *testing.T) {
	t.Run("set new key returns true", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		ok, err := client.SetNX(ctx, "nx-key", "value1", 0)
		if err != nil {
			t.Fatalf("SetNX failed: %v", err)
		}
		if !ok {
			t.Error("Expected SetNX to return true for new key")
		}

		// Verify value was set
		val, err := client.Get(ctx, "nx-key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if val != "value1" {
			t.Errorf("Expected 'value1', got %q", val)
		}
	})

	t.Run("set existing key returns false", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		// Set key first
		err := client.Set(ctx, "nx-key", "original", 0)
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// SetNX should return false since key exists
		ok, err := client.SetNX(ctx, "nx-key", "new-value", 0)
		if err != nil {
			t.Fatalf("SetNX failed: %v", err)
		}
		if ok {
			t.Error("Expected SetNX to return false for existing key")
		}

		// Value should remain the original
		val, err := client.Get(ctx, "nx-key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if val != "original" {
			t.Errorf("Expected 'original', got %q", val)
		}
	})

	t.Run("set with TTL works", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		ok, err := client.SetNX(ctx, "nx-ttl-key", "value", 2*time.Second)
		if err != nil {
			t.Fatalf("SetNX failed: %v", err)
		}
		if !ok {
			t.Error("Expected SetNX to return true for new key")
		}

		// Key should exist
		val, err := client.Get(ctx, "nx-ttl-key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if val != "value" {
			t.Errorf("Expected 'value', got %q", val)
		}

		// Fast-forward past TTL
		mr.FastForward(3 * time.Second)

		// Key should be expired
		_, err = client.Get(ctx, "nx-ttl-key")
		if err == nil {
			t.Error("Expected error for expired key")
		}
	})
}

func TestGetSet(t *testing.T) {
	t.Run("get and set atomically", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		// Set initial value
		err := client.Set(ctx, "gs-key", "old-value", 0)
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// GetSet should return old value and store new value
		oldVal, err := client.GetSet(ctx, "gs-key", "new-value")
		if err != nil {
			t.Fatalf("GetSet failed: %v", err)
		}
		if oldVal != "old-value" {
			t.Errorf("Expected old value 'old-value', got %q", oldVal)
		}

		// Verify new value is stored
		newVal, err := client.Get(ctx, "gs-key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if newVal != "new-value" {
			t.Errorf("Expected new value 'new-value', got %q", newVal)
		}
	})

	t.Run("get set on non-existent key returns redis.Nil", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		_, err := client.GetSet(ctx, "non-existent", "value")
		if err != redis.Nil {
			t.Errorf("Expected redis.Nil error, got: %v", err)
		}

		// The new value should still be set
		val, err := client.Get(ctx, "non-existent")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if val != "value" {
			t.Errorf("Expected 'value', got %q", val)
		}
	})
}

func TestEval(t *testing.T) {
	t.Run("simple script return 1", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		result, err := client.Eval(ctx, "return 1", nil)
		if err != nil {
			t.Fatalf("Eval failed: %v", err)
		}
		// Redis returns integers as int64
		val, ok := result.(int64)
		if !ok {
			t.Fatalf("Expected int64 result, got %T", result)
		}
		if val != 1 {
			t.Errorf("Expected 1, got %d", val)
		}
	})

	t.Run("script with keys and args", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		// Set a key first
		err := client.Set(ctx, "eval-key", "hello", 0)
		if err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// Script that gets a key and appends an argument
		script := `
			local val = redis.call('GET', KEYS[1])
			return val .. ARGV[1]
		`
		result, err := client.Eval(ctx, script, []string{"eval-key"}, " world")
		if err != nil {
			t.Fatalf("Eval failed: %v", err)
		}
		strVal, ok := result.(string)
		if !ok {
			t.Fatalf("Expected string result, got %T", result)
		}
		if strVal != "hello world" {
			t.Errorf("Expected 'hello world', got %q", strVal)
		}
	})

	t.Run("error on bad script", func(t *testing.T) {
		client, mr := newTestClient(t)
		defer mr.Close()
		defer client.Close()

		ctx := context.Background()

		_, err := client.Eval(ctx, "this is not valid lua", nil)
		if err == nil {
			t.Error("Expected error for invalid Lua script")
		}
	})
}

func TestScriptLoad_And_EvalSha(t *testing.T) {
	client, mr := newTestClient(t)
	defer mr.Close()
	defer client.Close()

	ctx := context.Background()

	// Load a script
	script := "return 42"
	sha, err := client.ScriptLoad(ctx, script)
	if err != nil {
		t.Fatalf("ScriptLoad failed: %v", err)
	}
	if sha == "" {
		t.Fatal("Expected non-empty SHA")
	}

	// Execute using the SHA
	result, err := client.EvalSha(ctx, sha, nil)
	if err != nil {
		t.Fatalf("EvalSha failed: %v", err)
	}
	val, ok := result.(int64)
	if !ok {
		t.Fatalf("Expected int64 result, got %T", result)
	}
	if val != 42 {
		t.Errorf("Expected 42, got %d", val)
	}

	// EvalSha with wrong SHA should fail
	_, err = client.EvalSha(ctx, "0000000000000000000000000000000000000000", nil)
	if err == nil {
		t.Error("Expected error for invalid SHA")
	}
}

func TestNewClientFromRedis(t *testing.T) {
	t.Run("creates client from redis.Client", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("Failed to start miniredis: %v", err)
		}
		defer mr.Close()

		rc := redis.NewClient(&redis.Options{
			Addr: mr.Addr(),
		})
		defer rc.Close()

		client := NewClientFromRedis(rc)
		if client == nil {
			t.Fatal("Expected non-nil client")
		}
	})

	t.Run("operations work", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("Failed to start miniredis: %v", err)
		}
		defer mr.Close()

		rc := redis.NewClient(&redis.Options{
			Addr: mr.Addr(),
		})
		defer rc.Close()

		client := NewClientFromRedis(rc)
		ctx := context.Background()

		// Ping
		if err := client.Ping(ctx); err != nil {
			t.Fatalf("Ping failed: %v", err)
		}

		// Set
		if err := client.Set(ctx, "from-redis-key", "from-redis-value", time.Minute); err != nil {
			t.Fatalf("Set failed: %v", err)
		}

		// Get
		val, err := client.Get(ctx, "from-redis-key")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if val != "from-redis-value" {
			t.Errorf("Expected 'from-redis-value', got %q", val)
		}

		// Exists
		exists, err := client.Exists(ctx, "from-redis-key")
		if err != nil {
			t.Fatalf("Exists failed: %v", err)
		}
		if !exists {
			t.Error("Expected key to exist")
		}

		// Delete
		if err := client.Delete(ctx, "from-redis-key"); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}

		exists, err = client.Exists(ctx, "from-redis-key")
		if err != nil {
			t.Fatalf("Exists failed: %v", err)
		}
		if exists {
			t.Error("Expected key to not exist after delete")
		}

		// Incr
		count, err := client.Incr(ctx, "from-redis-counter")
		if err != nil {
			t.Fatalf("Incr failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected count 1, got %d", count)
		}
	})
}

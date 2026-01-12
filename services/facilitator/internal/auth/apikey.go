package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

var (
	ErrInvalidAPIKey = errors.New("invalid API key")
	ErrAPIKeyExpired = errors.New("API key expired")
	ErrAPIKeyRevoked = errors.New("API key revoked")
)

// APIKey represents an API key with metadata
type APIKey struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	KeyHash     string    `json:"keyHash"` // SHA-256 hash of the key
	RateLimit   int       `json:"rateLimit,omitempty"` // Custom rate limit (0 = use default)
	CreatedAt   time.Time `json:"createdAt"`
	ExpiresAt   time.Time `json:"expiresAt,omitempty"` // Zero = never expires
	LastUsedAt  time.Time `json:"lastUsedAt,omitempty"`
	UsageCount  int64     `json:"usageCount"`
	Revoked     bool      `json:"revoked"`
	Permissions []string  `json:"permissions,omitempty"` // e.g., ["verify", "settle", "supported"]
}

// HasPermission checks if the key has a specific permission
func (k *APIKey) HasPermission(perm string) bool {
	// If no permissions specified, allow all
	if len(k.Permissions) == 0 {
		return true
	}
	for _, p := range k.Permissions {
		if p == perm || p == "*" {
			return true
		}
	}
	return false
}

// IsExpired checks if the key has expired
func (k *APIKey) IsExpired() bool {
	if k.ExpiresAt.IsZero() {
		return false
	}
	return time.Now().After(k.ExpiresAt)
}

// Manager handles API key operations
type Manager struct {
	redis      *cache.Client
	keys       map[string]*APIKey // keyHash -> APIKey (in-memory cache)
	mu         sync.RWMutex
	keyPrefix  string
}

// NewManager creates a new API key manager
func NewManager(redis *cache.Client) *Manager {
	return &Manager{
		redis:     redis,
		keys:      make(map[string]*APIKey),
		keyPrefix: "apikey:",
	}
}

// LoadFromEnv loads API keys from environment variable format: "key1:name1,key2:name2"
func (m *Manager) LoadFromEnv(envValue string) error {
	if envValue == "" {
		return nil
	}

	pairs := strings.Split(envValue, ",")
	for _, pair := range pairs {
		parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
		if len(parts) == 0 || parts[0] == "" {
			continue
		}

		key := strings.TrimSpace(parts[0])
		name := "default"
		if len(parts) == 2 && parts[1] != "" {
			name = strings.TrimSpace(parts[1])
		}

		apiKey := &APIKey{
			ID:        generateKeyID(),
			Name:      name,
			KeyHash:   hashKey(key),
			CreatedAt: time.Now(),
		}

		m.mu.Lock()
		m.keys[apiKey.KeyHash] = apiKey
		m.mu.Unlock()
	}

	return nil
}

// ValidateKey validates an API key and returns its metadata
func (m *Manager) ValidateKey(ctx context.Context, rawKey string) (*APIKey, error) {
	if rawKey == "" {
		return nil, ErrInvalidAPIKey
	}

	keyHash := hashKey(rawKey)

	// Check in-memory cache first
	m.mu.RLock()
	apiKey, exists := m.keys[keyHash]
	m.mu.RUnlock()

	if !exists {
		// Try Redis
		apiKey, _ = m.getFromRedis(ctx, keyHash)
		if apiKey == nil {
			return nil, ErrInvalidAPIKey
		}
	}

	// Check if revoked
	if apiKey.Revoked {
		return nil, ErrAPIKeyRevoked
	}

	// Check expiration
	if apiKey.IsExpired() {
		return nil, ErrAPIKeyExpired
	}

	// Update usage (async)
	go m.recordUsage(context.Background(), apiKey)

	return apiKey, nil
}

// CreateKey creates a new API key and returns the raw key (only shown once)
func (m *Manager) CreateKey(ctx context.Context, name string, rateLimit int, expiresIn time.Duration, permissions []string) (string, *APIKey, error) {
	// Generate a secure random key
	rawKey, err := generateSecureKey(32)
	if err != nil {
		return "", nil, err
	}

	var expiresAt time.Time
	if expiresIn > 0 {
		expiresAt = time.Now().Add(expiresIn)
	}

	apiKey := &APIKey{
		ID:          generateKeyID(),
		Name:        name,
		KeyHash:     hashKey(rawKey),
		RateLimit:   rateLimit,
		CreatedAt:   time.Now(),
		ExpiresAt:   expiresAt,
		Permissions: permissions,
	}

	// Store in Redis
	if err := m.saveToRedis(ctx, apiKey); err != nil {
		return "", nil, err
	}

	// Cache in memory
	m.mu.Lock()
	m.keys[apiKey.KeyHash] = apiKey
	m.mu.Unlock()

	return rawKey, apiKey, nil
}

// RevokeKey revokes an API key
func (m *Manager) RevokeKey(ctx context.Context, keyID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for hash, key := range m.keys {
		if key.ID == keyID {
			key.Revoked = true
			m.keys[hash] = key
			return m.saveToRedis(ctx, key)
		}
	}

	return ErrInvalidAPIKey
}

// ListKeys returns all API keys (without the actual key values)
func (m *Manager) ListKeys() []*APIKey {
	m.mu.RLock()
	defer m.mu.RUnlock()

	keys := make([]*APIKey, 0, len(m.keys))
	for _, key := range m.keys {
		keys = append(keys, key)
	}
	return keys
}

// GetKeyCount returns the number of registered API keys
func (m *Manager) GetKeyCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.keys)
}

// HasKeys returns true if any API keys are configured
func (m *Manager) HasKeys() bool {
	return m.GetKeyCount() > 0
}

// recordUsage updates the usage statistics for a key
func (m *Manager) recordUsage(ctx context.Context, apiKey *APIKey) {
	m.mu.Lock()
	apiKey.LastUsedAt = time.Now()
	apiKey.UsageCount++
	m.mu.Unlock()

	// Update in Redis (non-blocking)
	_ = m.saveToRedis(ctx, apiKey)
}

// saveToRedis saves an API key to Redis
func (m *Manager) saveToRedis(ctx context.Context, apiKey *APIKey) error {
	if m.redis == nil {
		return nil
	}

	data, err := json.Marshal(apiKey)
	if err != nil {
		return err
	}

	key := m.keyPrefix + apiKey.KeyHash
	return m.redis.Set(ctx, key, string(data), 0)
}

// getFromRedis retrieves an API key from Redis
func (m *Manager) getFromRedis(ctx context.Context, keyHash string) (*APIKey, error) {
	if m.redis == nil {
		return nil, nil
	}

	key := m.keyPrefix + keyHash
	data, err := m.redis.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	var apiKey APIKey
	if err := json.Unmarshal([]byte(data), &apiKey); err != nil {
		return nil, err
	}

	return &apiKey, nil
}

// hashKey creates a SHA-256 hash of the key for secure storage
func hashKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// generateKeyID generates a short unique ID for the key
func generateKeyID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// generateSecureKey generates a cryptographically secure random key
func generateSecureKey(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "t402_" + hex.EncodeToString(b), nil
}

// SecureCompare performs a constant-time comparison to prevent timing attacks
func SecureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

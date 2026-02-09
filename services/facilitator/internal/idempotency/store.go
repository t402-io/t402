package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// Status represents the status of an idempotent request
type Status string

const (
	StatusPending   Status = "pending"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

// Entry represents an idempotency entry stored in Redis
type Entry struct {
	Key         string    `json:"key"`
	PayloadHash string    `json:"payloadHash"`
	Status      Status    `json:"status"`
	Result      []byte    `json:"result,omitempty"`
	Error       string    `json:"error,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Store provides idempotency checking and storage
type Store struct {
	cache  *cache.Client
	prefix string
	ttl    time.Duration
}

// NewStore creates a new idempotency store
func NewStore(cache *cache.Client, ttl time.Duration) *Store {
	if ttl == 0 {
		ttl = 24 * time.Hour // Default 24 hour TTL
	}
	return &Store{
		cache:  cache,
		prefix: "idempotency:",
		ttl:    ttl,
	}
}

// ErrDuplicateRequest is returned when a duplicate request is detected
var ErrDuplicateRequest = errors.New("duplicate request detected")

// ErrRequestInProgress is returned when a request with the same key is still processing
var ErrRequestInProgress = errors.New("request with this idempotency key is still being processed")

// ErrPayloadMismatch is returned when the payload hash doesn't match an existing request
var ErrPayloadMismatch = errors.New("payload does not match existing request with this idempotency key")

// CheckAndCreateResult represents the result of an atomic check-and-create operation
type CheckAndCreateResult struct {
	Created bool   // true if a new entry was created
	Entry   *Entry // existing entry if not created, nil if created
}

// Lua script for atomic check-and-create operation
// Returns: nil if created, existing data if already exists
const checkAndCreateScript = `
local existing = redis.call('GET', KEYS[1])
if existing then
    return existing
end
redis.call('SETEX', KEYS[1], ARGV[1], ARGV[2])
return nil
`

// CheckAndCreate atomically checks for an existing entry and creates one if not found
// This eliminates the TOCTOU race condition between Check() and Create()
// Returns: (result, error)
//   - If entry created: result.Created=true, result.Entry=nil
//   - If entry exists: result.Created=false, result.Entry=existing entry
//   - If payload mismatch: returns ErrPayloadMismatch
func (s *Store) CheckAndCreate(ctx context.Context, idempotencyKey string, payloadHash string) (*CheckAndCreateResult, error) {
	if s.cache == nil || idempotencyKey == "" {
		return &CheckAndCreateResult{Created: true, Entry: nil}, nil
	}

	key := s.prefix + idempotencyKey

	// Prepare new entry data
	entry := Entry{
		Key:         idempotencyKey,
		PayloadHash: payloadHash,
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal idempotency entry: %w", err)
	}

	ttlSeconds := int(s.ttl.Seconds())

	// Execute atomic Lua script
	result, err := s.cache.Eval(ctx, checkAndCreateScript, []string{key}, ttlSeconds, string(data))
	if err != nil {
		// redis.Nil means the Lua script returned nil, i.e. a new entry was created
		if errors.Is(err, redis.Nil) {
			return &CheckAndCreateResult{Created: true, Entry: nil}, nil
		}
		return nil, fmt.Errorf("failed to execute idempotency check-and-create: %w", err)
	}

	// nil result means we created a new entry (mock cache path)
	if result == nil {
		return &CheckAndCreateResult{Created: true, Entry: nil}, nil
	}

	// Non-nil result means entry already exists
	existingData, ok := result.(string)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from idempotency script: %T", result)
	}

	var existingEntry Entry
	if err := json.Unmarshal([]byte(existingData), &existingEntry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal existing idempotency entry: %w", err)
	}

	// Verify payload hash matches
	if existingEntry.PayloadHash != payloadHash {
		return nil, ErrPayloadMismatch
	}

	return &CheckAndCreateResult{Created: false, Entry: &existingEntry}, nil
}

// Check checks if a request with the given idempotency key exists
// Returns the existing entry if found, or nil if this is a new request
func (s *Store) Check(ctx context.Context, idempotencyKey string, payloadHash string) (*Entry, error) {
	if s.cache == nil || idempotencyKey == "" {
		return nil, nil // No idempotency checking if cache unavailable or no key provided
	}

	key := s.prefix + idempotencyKey
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		// Key doesn't exist - this is a new request
		return nil, nil
	}

	var entry Entry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal idempotency entry: %w", err)
	}

	// Verify payload hash matches
	if entry.PayloadHash != payloadHash {
		return nil, ErrPayloadMismatch
	}

	return &entry, nil
}

// Create creates a new pending idempotency entry
// Returns ErrDuplicateRequest if an entry already exists
func (s *Store) Create(ctx context.Context, idempotencyKey string, payloadHash string) error {
	if s.cache == nil || idempotencyKey == "" {
		return nil // No idempotency if cache unavailable or no key provided
	}

	entry := Entry{
		Key:         idempotencyKey,
		PayloadHash: payloadHash,
		Status:      StatusPending,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal idempotency entry: %w", err)
	}

	key := s.prefix + idempotencyKey
	set, err := s.cache.SetNX(ctx, key, string(data), s.ttl)
	if err != nil {
		return fmt.Errorf("failed to create idempotency entry: %w", err)
	}

	if !set {
		// Entry already exists
		return ErrDuplicateRequest
	}

	return nil
}

// Complete marks a request as completed with the given result
func (s *Store) Complete(ctx context.Context, idempotencyKey string, result []byte) error {
	if s.cache == nil || idempotencyKey == "" {
		return nil
	}

	key := s.prefix + idempotencyKey

	// Get existing entry
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to get idempotency entry: %w", err)
	}

	var entry Entry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return fmt.Errorf("failed to unmarshal idempotency entry: %w", err)
	}

	// Update entry
	entry.Status = StatusCompleted
	entry.Result = result
	entry.UpdatedAt = time.Now().UTC()

	newData, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal idempotency entry: %w", err)
	}

	if err := s.cache.Set(ctx, key, string(newData), s.ttl); err != nil {
		return fmt.Errorf("failed to update idempotency entry: %w", err)
	}

	return nil
}

// Fail marks a request as failed with the given error
func (s *Store) Fail(ctx context.Context, idempotencyKey string, errMsg string) error {
	if s.cache == nil || idempotencyKey == "" {
		return nil
	}

	key := s.prefix + idempotencyKey

	// Get existing entry
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to get idempotency entry: %w", err)
	}

	var entry Entry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return fmt.Errorf("failed to unmarshal idempotency entry: %w", err)
	}

	// Update entry
	entry.Status = StatusFailed
	entry.Error = errMsg
	entry.UpdatedAt = time.Now().UTC()

	newData, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal idempotency entry: %w", err)
	}

	if err := s.cache.Set(ctx, key, string(newData), s.ttl); err != nil {
		return fmt.Errorf("failed to update idempotency entry: %w", err)
	}

	return nil
}

// ComputePayloadHash computes a SHA256 hash of the payload and requirements
func ComputePayloadHash(payload, requirements []byte) string {
	h := sha256.New()
	h.Write(payload)
	h.Write([]byte(":"))
	h.Write(requirements)
	return hex.EncodeToString(h.Sum(nil))
}

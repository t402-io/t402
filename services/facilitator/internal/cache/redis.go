package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"time"

	"github.com/redis/go-redis/v9"
)

// P1-4: Cache key validation constants
const (
	maxKeyLength = 1024 // Maximum cache key length
)

// P1-4: validKeyPattern matches safe cache key characters
// Only alphanumeric, colons, underscores, hyphens, and dots are allowed
var validKeyPattern = regexp.MustCompile(`^[a-zA-Z0-9:_\-\.]+$`)

// P1-4: ValidateCacheKey validates a cache key to prevent cache poisoning
// Returns an error if the key is invalid or potentially malicious
func ValidateCacheKey(key string) error {
	if key == "" {
		return fmt.Errorf("cache key cannot be empty")
	}
	if len(key) > maxKeyLength {
		return fmt.Errorf("cache key exceeds maximum length of %d", maxKeyLength)
	}
	if !validKeyPattern.MatchString(key) {
		return fmt.Errorf("cache key contains invalid characters")
	}
	return nil
}

// P1-4: SanitizeKey sanitizes a potentially unsafe string into a valid cache key
// Uses SHA256 hash for untrusted input to ensure consistent, safe key format
func SanitizeKey(prefix string, untrustedInput string) string {
	h := sha256.Sum256([]byte(untrustedInput))
	return prefix + hex.EncodeToString(h[:])
}

// Client wraps a Redis client with common operations
type Client struct {
	client *redis.Client
}

// NewClient creates a new Redis client from a URL
func NewClient(redisURL string) (*Client, error) {
	opts, err := parseRedisURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Client{client: client}, nil
}

// parseRedisURL parses a Redis URL into options
func parseRedisURL(redisURL string) (*redis.Options, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	opts := &redis.Options{
		Addr: u.Host,
	}

	if u.User != nil {
		opts.Username = u.User.Username()
		if password, ok := u.User.Password(); ok {
			opts.Password = password
		}
	}

	return opts, nil
}

// Get retrieves a value by key
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.client.Get(ctx, key).Result()
}

// Set stores a value with optional TTL
func (c *Client) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

// Incr increments a key's value
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.client.Incr(ctx, key).Result()
}

// Expire sets a TTL on a key
func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return c.client.Expire(ctx, key, ttl).Err()
}

// TTL returns the remaining TTL of a key
func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.client.TTL(ctx, key).Result()
}

// Delete removes a key
func (c *Client) Delete(ctx context.Context, keys ...string) error {
	return c.client.Del(ctx, keys...).Err()
}

// Exists checks if a key exists
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	return result > 0, err
}

// Ping checks if Redis is reachable
func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.client.Close()
}

// SetNX sets a key only if it doesn't exist (atomic operation)
// Returns true if the key was set, false if it already existed
func (c *Client) SetNX(ctx context.Context, key string, value interface{}, ttl time.Duration) (bool, error) {
	return c.client.SetNX(ctx, key, value, ttl).Result()
}

// GetSet atomically sets a key and returns the old value
func (c *Client) GetSet(ctx context.Context, key string, value interface{}) (string, error) {
	return c.client.GetSet(ctx, key, value).Result()
}

// Eval executes a Lua script on Redis
// Returns the script result as interface{} which can be type-asserted
func (c *Client) Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error) {
	return c.client.Eval(ctx, script, keys, args...).Result()
}

// EvalSha executes a cached Lua script by its SHA
func (c *Client) EvalSha(ctx context.Context, sha string, keys []string, args ...interface{}) (interface{}, error) {
	return c.client.EvalSha(ctx, sha, keys, args...).Result()
}

// ScriptLoad loads a Lua script into Redis and returns its SHA
func (c *Client) ScriptLoad(ctx context.Context, script string) (string, error) {
	return c.client.ScriptLoad(ctx, script).Result()
}

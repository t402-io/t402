package cache

import (
	"context"
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
)

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

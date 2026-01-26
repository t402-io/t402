package cache

import (
	"github.com/redis/go-redis/v9"
)

// NewClientFromRedis creates a Client from an existing redis.Client
// This is primarily useful for testing with mock Redis servers like miniredis
func NewClientFromRedis(client *redis.Client) *Client {
	return &Client{client: client}
}

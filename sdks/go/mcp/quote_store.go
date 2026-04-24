package mcp

// QuoteStore is a small TTL-gated in-memory quote cache. Used by
// t402/quoteBridge (and the swap analogues if they were implemented
// here) to hand callers a compact `quoteId` they can re-submit to
// executeBridge / executeSwap. Keeping it in-memory is deliberate:
// quotes are session-scoped and the cost of losing them on restart
// is just "request a new quote".
//
// See also: sdks/typescript/packages/mcp/src/tools/quoteStore.ts

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// QuoteType is the flavor of a stored quote.
type QuoteType string

const (
	QuoteTypeSwap   QuoteType = "swap"
	QuoteTypeBridge QuoteType = "bridge"
)

// Quote is a single entry in the store.
type Quote struct {
	ID        string
	Type      QuoteType
	CreatedAt time.Time
	ExpiresAt time.Time
	// Data holds scheme-specific fields. The caller owns the shape;
	// this package only round-trips it.
	Data map[string]any
}

// defaultQuoteTTL matches the TS implementation: 5 minutes is plenty
// for a user to confirm but short enough that stale quotes don't
// hang around across RPC-denominated price shifts.
const defaultQuoteTTL = 5 * time.Minute

var (
	quoteStoreMu sync.RWMutex
	quoteStore   = map[string]*Quote{}
)

// CreateQuote adds a quote to the store and returns its ID.
func CreateQuote(quoteType QuoteType, data map[string]any) string {
	return CreateQuoteWithTTL(quoteType, data, defaultQuoteTTL)
}

// CreateQuoteWithTTL adds a quote with a custom TTL.
func CreateQuoteWithTTL(quoteType QuoteType, data map[string]any, ttl time.Duration) string {
	id := newUUID()
	now := time.Now()

	quoteStoreMu.Lock()
	defer quoteStoreMu.Unlock()
	quoteStore[id] = &Quote{
		ID:        id,
		Type:      quoteType,
		CreatedAt: now,
		ExpiresAt: now.Add(ttl),
		Data:      data,
	}
	return id
}

// GetQuote looks up a quote and returns it if it exists and is not
// expired. Expired quotes are garbage-collected on read.
func GetQuote(id string) (*Quote, bool) {
	quoteStoreMu.RLock()
	q, ok := quoteStore[id]
	quoteStoreMu.RUnlock()
	if !ok {
		return nil, false
	}
	if time.Now().After(q.ExpiresAt) {
		DeleteQuote(id)
		return nil, false
	}
	return q, true
}

// DeleteQuote removes a quote by ID.
func DeleteQuote(id string) {
	quoteStoreMu.Lock()
	delete(quoteStore, id)
	quoteStoreMu.Unlock()
}

// ClearQuoteStore empties the store. Intended for tests.
func ClearQuoteStore() {
	quoteStoreMu.Lock()
	quoteStore = map[string]*Quote{}
	quoteStoreMu.Unlock()
}

// newUUID returns a v4-style UUID. We roll our own rather than pulling
// in github.com/google/uuid just for one call.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	// Set the version to 4 and variant to RFC 4122.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf(
		"%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}

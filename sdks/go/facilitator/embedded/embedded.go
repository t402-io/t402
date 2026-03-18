// Package embedded provides an in-process facilitator that can be embedded
// directly into a resource server, eliminating the need for a separate
// facilitator service.
//
// Usage:
//
//	f := embedded.New()
//	f.Register("exact:eip155:8453", mySchemeHandler)
//	f.Register("exact:eip155:*", myWildcardHandler)
//
//	result, err := f.Verify(ctx, payload, requirements)
//	if err != nil { ... }
//	settle, err := f.Settle(ctx, payload, requirements)
package embedded

import (
	"context"
	"fmt"
	"strings"
	"sync"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// SchemeHandler processes verify and settle requests for a specific scheme+network.
type SchemeHandler interface {
	Verify(ctx context.Context, payload types.PaymentPayload, requirements types.PaymentRequirements) (*t402.VerifyResponse, error)
	Settle(ctx context.Context, payload types.PaymentPayload, requirements types.PaymentRequirements) (*t402.SettleResponse, error)
}

// Facilitator is an in-process facilitator that routes requests to registered scheme handlers.
type Facilitator struct {
	mu       sync.RWMutex
	handlers map[string]SchemeHandler // "scheme:network" or "scheme:family:*"
	listener LifecycleListener
}

// LifecycleListener receives payment lifecycle events.
type LifecycleListener interface {
	OnEvent(event LifecycleEvent)
}

// LifecycleEvent represents a payment lifecycle event.
type LifecycleEvent struct {
	Type      string // "payment.verifying", "payment.verified", etc.
	Scheme    string
	Network   string
	PaymentID string
	Error     string
}

// New creates a new embedded facilitator.
func New(opts ...Option) *Facilitator {
	f := &Facilitator{
		handlers: make(map[string]SchemeHandler),
	}
	for _, opt := range opts {
		opt(f)
	}
	return f
}

// Option configures an embedded facilitator.
type Option func(*Facilitator)

// WithLifecycleListener sets a lifecycle event listener.
func WithLifecycleListener(l LifecycleListener) Option {
	return func(f *Facilitator) { f.listener = l }
}

// Register adds a scheme handler for a pattern.
// Pattern format: "scheme:network" (exact) or "scheme:family:*" (wildcard).
func (f *Facilitator) Register(pattern string, handler SchemeHandler) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.handlers[pattern] = handler
}

// Unregister removes a scheme handler.
func (f *Facilitator) Unregister(pattern string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.handlers, pattern)
}

// Supported returns all registered patterns (kinds).
func (f *Facilitator) Supported() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	kinds := make([]string, 0, len(f.handlers))
	for k := range f.handlers {
		kinds = append(kinds, k)
	}
	return kinds
}

// Verify verifies a payment using the appropriate scheme handler.
func (f *Facilitator) Verify(ctx context.Context, payload types.PaymentPayload, requirements types.PaymentRequirements) (*t402.VerifyResponse, error) {
	handler, err := f.findHandler(requirements.Scheme, string(requirements.Network))
	if err != nil {
		return nil, err
	}

	f.emit(LifecycleEvent{Type: "payment.verifying", Scheme: requirements.Scheme, Network: string(requirements.Network)})

	resp, err := handler.Verify(ctx, payload, requirements)
	if err != nil {
		f.emit(LifecycleEvent{Type: "payment.failed", Scheme: requirements.Scheme, Network: string(requirements.Network), Error: err.Error()})
		return nil, err
	}

	f.emit(LifecycleEvent{Type: "payment.verified", Scheme: requirements.Scheme, Network: string(requirements.Network)})
	return resp, nil
}

// Settle settles a payment using the appropriate scheme handler.
func (f *Facilitator) Settle(ctx context.Context, payload types.PaymentPayload, requirements types.PaymentRequirements) (*t402.SettleResponse, error) {
	handler, err := f.findHandler(requirements.Scheme, string(requirements.Network))
	if err != nil {
		return nil, err
	}

	f.emit(LifecycleEvent{Type: "payment.settling", Scheme: requirements.Scheme, Network: string(requirements.Network)})

	resp, err := handler.Settle(ctx, payload, requirements)
	if err != nil {
		f.emit(LifecycleEvent{Type: "payment.failed", Scheme: requirements.Scheme, Network: string(requirements.Network), Error: err.Error()})
		return nil, err
	}

	f.emit(LifecycleEvent{Type: "payment.settled", Scheme: requirements.Scheme, Network: string(requirements.Network)})
	return resp, nil
}

func (f *Facilitator) findHandler(scheme, network string) (SchemeHandler, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	// Exact match: "exact:eip155:8453"
	key := scheme + ":" + network
	if h, ok := f.handlers[key]; ok {
		return h, nil
	}

	// Wildcard match: "exact:eip155:*"
	parts := strings.SplitN(network, ":", 2)
	if len(parts) == 2 {
		wildcard := scheme + ":" + parts[0] + ":*"
		if h, ok := f.handlers[wildcard]; ok {
			return h, nil
		}
	}

	return nil, fmt.Errorf("no handler for scheme=%s network=%s", scheme, network)
}

func (f *Facilitator) emit(event LifecycleEvent) {
	if f.listener != nil {
		f.listener.OnEvent(event)
	}
}

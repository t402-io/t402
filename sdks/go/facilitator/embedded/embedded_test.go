package embedded

import (
	"context"
	"errors"
	"sync"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

type mockHandler struct {
	verifyResp *t402.VerifyResponse
	settleResp *t402.SettleResponse
	verifyErr  error
	settleErr  error
}

func (m *mockHandler) Verify(_ context.Context, _ types.PaymentPayload, _ types.PaymentRequirements) (*t402.VerifyResponse, error) {
	return m.verifyResp, m.verifyErr
}
func (m *mockHandler) Settle(_ context.Context, _ types.PaymentPayload, _ types.PaymentRequirements) (*t402.SettleResponse, error) {
	return m.settleResp, m.settleErr
}

type eventRecorder struct {
	mu     sync.Mutex
	events []LifecycleEvent
}

func (r *eventRecorder) OnEvent(e LifecycleEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}
func (r *eventRecorder) getEvents() []LifecycleEvent {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]LifecycleEvent{}, r.events...)
}

func TestRegisterAndSupported(t *testing.T) {
	f := New()
	f.Register("exact:eip155:8453", &mockHandler{})
	f.Register("exact:eip155:1", &mockHandler{})
	kinds := f.Supported()
	if len(kinds) != 2 {
		t.Fatalf("expected 2 kinds, got %d", len(kinds))
	}
}

func TestUnregister(t *testing.T) {
	f := New()
	f.Register("exact:eip155:8453", &mockHandler{})
	f.Unregister("exact:eip155:8453")
	if len(f.Supported()) != 0 {
		t.Error("expected 0 kinds after unregister")
	}
}

func TestVerifyExactMatch(t *testing.T) {
	f := New()
	f.Register("exact:eip155:8453", &mockHandler{
		verifyResp: &t402.VerifyResponse{IsValid: true, Payer: "0xpayer"},
	})
	resp, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsValid {
		t.Error("expected valid")
	}
	if resp.Payer != "0xpayer" {
		t.Errorf("expected 0xpayer, got %s", resp.Payer)
	}
}

func TestVerifyWildcardMatch(t *testing.T) {
	f := New()
	f.Register("exact:eip155:*", &mockHandler{
		verifyResp: &t402.VerifyResponse{IsValid: true},
	})
	resp, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:42161",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsValid {
		t.Error("expected valid via wildcard")
	}
}

func TestVerifyExactOverWildcard(t *testing.T) {
	f := New()
	f.Register("exact:eip155:*", &mockHandler{verifyResp: &t402.VerifyResponse{Payer: "wildcard"}})
	f.Register("exact:eip155:8453", &mockHandler{verifyResp: &t402.VerifyResponse{Payer: "exact"}})
	resp, _ := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if resp.Payer != "exact" {
		t.Errorf("expected exact match, got %s", resp.Payer)
	}
}

func TestVerifyNoHandler(t *testing.T) {
	f := New()
	_, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if err == nil {
		t.Error("expected error for missing handler")
	}
}

func TestVerifyHandlerError(t *testing.T) {
	f := New()
	f.Register("exact:eip155:*", &mockHandler{verifyErr: errors.New("verify failed")})
	_, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if err == nil {
		t.Error("expected error")
	}
}

func TestSettleSuccess(t *testing.T) {
	f := New()
	f.Register("exact:eip155:8453", &mockHandler{
		settleResp: &t402.SettleResponse{Success: true, Transaction: "0xtx"},
	})
	resp, err := f.Settle(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success || resp.Transaction != "0xtx" {
		t.Error("unexpected settle response")
	}
}

func TestSettleError(t *testing.T) {
	f := New()
	f.Register("exact:eip155:*", &mockHandler{settleErr: errors.New("settle failed")})
	_, err := f.Settle(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "eip155:8453",
	})
	if err == nil {
		t.Error("expected error")
	}
}

func TestLifecycleEvents(t *testing.T) {
	recorder := &eventRecorder{}
	f := New(WithLifecycleListener(recorder))
	f.Register("exact:eip155:*", &mockHandler{
		verifyResp: &t402.VerifyResponse{IsValid: true},
		settleResp: &t402.SettleResponse{Success: true},
	})

	f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{Scheme: "exact", Network: "eip155:8453"})
	f.Settle(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{Scheme: "exact", Network: "eip155:8453"})

	events := recorder.getEvents()
	if len(events) != 4 {
		t.Fatalf("expected 4 events, got %d", len(events))
	}
	if events[0].Type != "payment.verifying" {
		t.Errorf("expected verifying, got %s", events[0].Type)
	}
	if events[1].Type != "payment.verified" {
		t.Errorf("expected verified, got %s", events[1].Type)
	}
	if events[2].Type != "payment.settling" {
		t.Errorf("expected settling, got %s", events[2].Type)
	}
	if events[3].Type != "payment.settled" {
		t.Errorf("expected settled, got %s", events[3].Type)
	}
}

func TestLifecycleFailureEvent(t *testing.T) {
	recorder := &eventRecorder{}
	f := New(WithLifecycleListener(recorder))
	f.Register("exact:eip155:*", &mockHandler{verifyErr: errors.New("bad sig")})

	f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{Scheme: "exact", Network: "eip155:8453"})

	events := recorder.getEvents()
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if events[1].Type != "payment.failed" {
		t.Errorf("expected failed event, got %s", events[1].Type)
	}
	if events[1].Error != "bad sig" {
		t.Errorf("expected 'bad sig', got %s", events[1].Error)
	}
}

func TestNoListener(t *testing.T) {
	f := New() // no listener
	f.Register("exact:eip155:*", &mockHandler{verifyResp: &t402.VerifyResponse{IsValid: true}})
	// Should not panic
	_, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{Scheme: "exact", Network: "eip155:8453"})
	if err != nil {
		t.Error("unexpected error")
	}
}

func TestSolanaWildcard(t *testing.T) {
	f := New()
	f.Register("exact:solana:*", &mockHandler{verifyResp: &t402.VerifyResponse{IsValid: true}})
	resp, err := f.Verify(context.Background(), types.PaymentPayload{}, types.PaymentRequirements{
		Scheme: "exact", Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsValid {
		t.Error("expected valid")
	}
}

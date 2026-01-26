package streaming

import (
	"context"
	"testing"
	"time"
)

func TestStreamStatus(t *testing.T) {
	tests := []struct {
		status StreamStatus
		valid  bool
	}{
		{StreamStatusPending, true},
		{StreamStatusActive, true},
		{StreamStatusPaused, true},
		{StreamStatusClosing, true},
		{StreamStatusClosed, true},
		{StreamStatusCancelled, true},
		{StreamStatusExpired, true},
		{StreamStatus("invalid"), false},
	}

	validStatuses := map[StreamStatus]bool{
		StreamStatusPending:   true,
		StreamStatusActive:    true,
		StreamStatusPaused:    true,
		StreamStatusClosing:   true,
		StreamStatusClosed:    true,
		StreamStatusCancelled: true,
		StreamStatusExpired:   true,
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			_, exists := validStatuses[tt.status]
			if exists != tt.valid {
				t.Errorf("status %s: expected valid=%v, got %v", tt.status, tt.valid, exists)
			}
		})
	}
}

func TestStreamEventType(t *testing.T) {
	events := []StreamEventType{
		StreamEventOpened,
		StreamEventActivated,
		StreamEventUpdated,
		StreamEventPaused,
		StreamEventResumed,
		StreamEventClosing,
		StreamEventClosed,
		StreamEventCancelled,
		StreamEventExpired,
		StreamEventError,
	}

	for _, e := range events {
		if e == "" {
			t.Errorf("event type should not be empty")
		}
	}
}

func TestStreamModel(t *testing.T) {
	now := time.Now()
	stream := &Stream{
		ID:            "test-id",
		Network:       "eip155:1",
		Scheme:        "exact",
		Payer:         "0xPayer",
		Payee:         "0xPayee",
		Asset:         "0xUSDT",
		MaxAmount:     "1000000000",
		CurrentAmount: "500000000",
		SettledAmount: "0",
		RatePerSecond: "1000",
		Status:        StreamStatusActive,
		CreatedAt:     now,
		LastUpdatedAt: now,
		ExpiresAt:     &now,
		Metadata: Metadata{
			ResourceID:  "resource-123",
			Description: "Test stream",
			Tags:        []string{"test"},
			Extra:       map[string]string{"key": "value"},
		},
	}

	if stream.ID != "test-id" {
		t.Errorf("expected ID 'test-id', got %s", stream.ID)
	}
	if stream.Status != StreamStatusActive {
		t.Errorf("expected status 'active', got %s", stream.Status)
	}
	if stream.Metadata.ResourceID != "resource-123" {
		t.Errorf("expected resourceID 'resource-123', got %s", stream.Metadata.ResourceID)
	}
}

func TestStreamUpdateModel(t *testing.T) {
	update := &StreamUpdate{
		ID:            "update-1",
		StreamID:      "stream-1",
		Amount:        "100000000",
		Signature:     "0xsig...",
		Timestamp:     time.Now(),
		SequenceNum:   1,
		ResourceUnits: 100,
	}

	if update.SequenceNum != 1 {
		t.Errorf("expected sequence 1, got %d", update.SequenceNum)
	}
}

func TestOpenStreamRequest(t *testing.T) {
	expires := time.Now().Add(24 * time.Hour)
	req := &OpenStreamRequest{
		Network:       "eip155:1",
		Scheme:        "exact",
		Payer:         "0xPayer",
		Payee:         "0xPayee",
		Asset:         "0xUSDT",
		MaxAmount:     "1000000000",
		RatePerSecond: "1000",
		ExpiresAt:     &expires,
		Signature:     "0xsig...",
		Metadata: &Metadata{
			Description: "Test",
		},
	}

	if req.Network != "eip155:1" {
		t.Errorf("expected network 'eip155:1', got %s", req.Network)
	}
}

func TestListStreamsRequest(t *testing.T) {
	req := ListStreamsRequest{
		Network:   "eip155:1",
		Payer:     "0xPayer",
		Payee:     "0xPayee",
		Status:    []StreamStatus{StreamStatusActive, StreamStatusPaused},
		Limit:     50,
		Offset:    10,
		OrderBy:   "created_at",
		OrderDesc: true,
	}

	if len(req.Status) != 2 {
		t.Errorf("expected 2 statuses, got %d", len(req.Status))
	}
	if req.Limit != 50 {
		t.Errorf("expected limit 50, got %d", req.Limit)
	}
}

func TestDefaultServiceConfig(t *testing.T) {
	config := DefaultServiceConfig()

	if config.DefaultExpiry != 24*time.Hour {
		t.Errorf("expected default expiry 24h, got %v", config.DefaultExpiry)
	}
	if config.MaxStreamDuration != 30*24*time.Hour {
		t.Errorf("expected max duration 30 days, got %v", config.MaxStreamDuration)
	}
	if config.MinUpdateInterval != 100*time.Millisecond {
		t.Errorf("expected min interval 100ms, got %v", config.MinUpdateInterval)
	}
	if config.MaxUpdatesPerSecond != 100 {
		t.Errorf("expected max 100 updates/s, got %d", config.MaxUpdatesPerSecond)
	}
	if config.EnableAutoSettle {
		t.Error("expected auto settle to be disabled by default")
	}
}

// Mock implementations for testing

type mockVerifier struct {
	verifyResult bool
	verifyErr    error
}

func (m *mockVerifier) VerifyStreamSignature(ctx context.Context, network, payer, message, signature string) (bool, error) {
	return m.verifyResult, m.verifyErr
}

type mockSettler struct {
	settleTxHash string
	settleErr    error
}

func (m *mockSettler) SettleStream(ctx context.Context, network, scheme, from, to, asset, amount string) (string, error) {
	return m.settleTxHash, m.settleErr
}

func TestServiceCreation(t *testing.T) {
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0xtx"}

	service := NewService(nil, verifier, settler, nil, nil)
	if service == nil {
		t.Fatal("expected non-nil service")
	}

	// Check default config is applied
	if service.config.DefaultExpiry != 24*time.Hour {
		t.Errorf("expected default config to be applied")
	}
}

func TestServiceWithCustomConfig(t *testing.T) {
	config := &ServiceConfig{
		DefaultExpiry:       48 * time.Hour,
		MaxStreamDuration:   60 * 24 * time.Hour,
		MinUpdateInterval:   50 * time.Millisecond,
		MaxUpdatesPerSecond: 200,
	}

	service := NewService(nil, nil, nil, nil, config)

	if service.config.DefaultExpiry != 48*time.Hour {
		t.Errorf("expected custom expiry 48h, got %v", service.config.DefaultExpiry)
	}
	if service.config.MaxUpdatesPerSecond != 200 {
		t.Errorf("expected custom rate 200, got %d", service.config.MaxUpdatesPerSecond)
	}
}

func TestStreamStats(t *testing.T) {
	stats := &StreamStats{
		TotalUpdates:    100,
		AverageRate:     "1000",
		Duration:        3600,
		ResourcesUsed:   10000,
		EfficiencyScore: 0.95,
	}

	if stats.TotalUpdates != 100 {
		t.Errorf("expected 100 updates, got %d", stats.TotalUpdates)
	}
	if stats.Duration != 3600 {
		t.Errorf("expected duration 3600, got %d", stats.Duration)
	}
}

func TestErrors(t *testing.T) {
	errors := []error{
		ErrStreamNotFound,
		ErrStreamAlreadyExists,
		ErrInvalidStatus,
		ErrStreamExpired,
		ErrAmountExceeded,
		ErrInvalidSequence,
		ErrInvalidAmount,
		ErrInvalidSignature,
		ErrStreamNotActive,
		ErrUnauthorized,
	}

	for _, err := range errors {
		if err == nil {
			t.Error("expected non-nil error")
		}
		if err.Error() == "" {
			t.Error("expected non-empty error message")
		}
	}
}

func TestListStreamsResponse(t *testing.T) {
	resp := &ListStreamsResponse{
		Streams: []*Stream{
			{ID: "1"},
			{ID: "2"},
		},
		Total:   10,
		Limit:   20,
		Offset:  0,
		HasMore: true,
	}

	if len(resp.Streams) != 2 {
		t.Errorf("expected 2 streams, got %d", len(resp.Streams))
	}
	if !resp.HasMore {
		t.Error("expected HasMore to be true")
	}
}

func TestCloseStreamRequest(t *testing.T) {
	req := &CloseStreamRequest{
		StreamID:       "stream-1",
		FinalAmount:    "500000000",
		PayerSignature: "0xpayer-sig",
		PayeeSignature: "0xpayee-sig",
		Reason:         "completed",
	}

	if req.StreamID != "stream-1" {
		t.Errorf("expected stream ID 'stream-1', got %s", req.StreamID)
	}
	if req.Reason != "completed" {
		t.Errorf("expected reason 'completed', got %s", req.Reason)
	}
}

func TestStreamEvent(t *testing.T) {
	event := &StreamEvent{
		ID:        "event-1",
		StreamID:  "stream-1",
		Type:      StreamEventOpened,
		Data:      map[string]interface{}{"key": "value"},
		Timestamp: time.Now(),
	}

	if event.Type != StreamEventOpened {
		t.Errorf("expected event type 'opened', got %s", event.Type)
	}
}

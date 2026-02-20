package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewStreamingClient(t *testing.T) {
	// Test with default config
	client := NewStreamingClient(nil)
	if client == nil {
		t.Fatal("Expected client to be created")
	}
	if client.url != DefaultFacilitatorURL {
		t.Errorf("Expected default URL %s, got %s", DefaultFacilitatorURL, client.url)
	}

	// Test with custom config
	client = NewStreamingClient(&StreamingClientConfig{
		URL:              "https://custom.example.com",
		APIKey:           "test-key",
		RequesterAddress: "0xaddr",
	})
	if client.url != "https://custom.example.com" {
		t.Errorf("Expected custom URL, got %s", client.url)
	}
	if client.apiKey != "test-key" {
		t.Errorf("Expected apiKey 'test-key', got %s", client.apiKey)
	}
	if client.requesterAddress != "0xaddr" {
		t.Errorf("Expected requesterAddress '0xaddr', got %s", client.requesterAddress)
	}
}

func TestStreamingClientOpenStream(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/stream/open" {
			t.Errorf("Expected path /v1/stream/open, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("Expected POST, got %s", r.Method)
		}

		var req OpenStreamRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("Failed to decode request: %v", err)
		}
		if req.Network != "eip155:8453" {
			t.Errorf("Expected network eip155:8453, got %s", req.Network)
		}
		if req.Payer != "0xpayer" {
			t.Errorf("Expected payer 0xpayer, got %s", req.Payer)
		}

		now := time.Now()
		resp := OpenStreamResponse{
			Stream: &Stream{
				ID:            "stream-1",
				Network:       req.Network,
				Scheme:        req.Scheme,
				Payer:         req.Payer,
				Payee:         req.Payee,
				Asset:         req.Asset,
				MaxAmount:     req.MaxAmount,
				CurrentAmount: "0",
				Status:        StreamStatusPending,
				CreatedAt:     now,
				LastUpdatedAt: now,
			},
			DepositAmount: "1000000",
			DepositTo:     "0xdeposit",
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	resp, err := client.OpenStream(ctx, &OpenStreamRequest{
		Network:   "eip155:8453",
		Scheme:    "exact",
		Payer:     "0xpayer",
		Payee:     "0xpayee",
		Asset:     "0xusdt",
		MaxAmount: "10000000",
		Signature: "sig123",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Stream.ID != "stream-1" {
		t.Errorf("Expected stream ID stream-1, got %s", resp.Stream.ID)
	}
	if resp.DepositAmount != "1000000" {
		t.Errorf("Expected deposit amount 1000000, got %s", resp.DepositAmount)
	}
}

func TestStreamingClientUpdateStream(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/stream/update" {
			t.Errorf("Expected path /v1/stream/update, got %s", r.URL.Path)
		}

		var req UpdateStreamRequest
		json.NewDecoder(r.Body).Decode(&req)

		resp := UpdateStreamResponse{
			Stream: &Stream{
				ID:            req.StreamID,
				CurrentAmount: req.Amount,
				Status:        StreamStatusActive,
			},
			Update: &StreamUpdate{
				ID:       "update-1",
				StreamID: req.StreamID,
				Amount:   req.Amount,
			},
			Remaining:   "9000000",
			CanContinue: true,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	resp, err := client.UpdateStream(ctx, &UpdateStreamRequest{
		StreamID:  "stream-1",
		Amount:    "1000000",
		Signature: "sig456",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !resp.CanContinue {
		t.Error("Expected canContinue to be true")
	}
	if resp.Remaining != "9000000" {
		t.Errorf("Expected remaining 9000000, got %s", resp.Remaining)
	}
}

func TestStreamingClientCloseStream(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/stream/close" {
			t.Errorf("Expected path /v1/stream/close, got %s", r.URL.Path)
		}

		resp := CloseStreamResponse{
			Stream: &Stream{
				ID:     "stream-1",
				Status: StreamStatusClosed,
			},
			SettledAmount: "5000000",
			TxHash:        "0xtxhash",
			RefundAmount:  "5000000",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	resp, err := client.CloseStream(ctx, &CloseStreamRequest{
		StreamID:       "stream-1",
		FinalAmount:    "5000000",
		PayerSignature: "sig789",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.TxHash != "0xtxhash" {
		t.Errorf("Expected txHash 0xtxhash, got %s", resp.TxHash)
	}
	if resp.SettledAmount != "5000000" {
		t.Errorf("Expected settledAmount 5000000, got %s", resp.SettledAmount)
	}
}

func TestStreamingClientGetStream(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/stream/stream-1" {
			t.Errorf("Expected path /v1/stream/stream-1, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("Expected GET, got %s", r.Method)
		}

		// Check query params
		if r.URL.Query().Get("include_updates") != "true" {
			t.Error("Expected include_updates=true")
		}
		if r.URL.Query().Get("include_stats") != "true" {
			t.Error("Expected include_stats=true")
		}

		resp := GetStreamResponse{
			Stream: &Stream{
				ID:     "stream-1",
				Status: StreamStatusActive,
			},
			Updates: []*StreamUpdate{
				{ID: "update-1", Amount: "1000000"},
			},
			Stats: &StreamStats{
				TotalUpdates: 5,
				Duration:     3600,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	resp, err := client.GetStream(ctx, "stream-1", &GetStreamOptions{
		IncludeUpdates: true,
		IncludeStats:   true,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Stream.ID != "stream-1" {
		t.Errorf("Expected stream ID stream-1, got %s", resp.Stream.ID)
	}
	if len(resp.Updates) != 1 {
		t.Errorf("Expected 1 update, got %d", len(resp.Updates))
	}
	if resp.Stats.TotalUpdates != 5 {
		t.Errorf("Expected 5 total updates, got %d", resp.Stats.TotalUpdates)
	}
}

func TestStreamingClientPauseResume(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check auth header is set
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("Expected auth header, got %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-Requester-Address") != "0xaddr" {
			t.Errorf("Expected requester address header, got %s", r.Header.Get("X-Requester-Address"))
		}

		resp := PauseResumeResponse{
			Status:  "paused",
			Message: "stream paused successfully",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{
		URL:              server.URL,
		APIKey:           "test-key",
		RequesterAddress: "0xaddr",
	})

	resp, err := client.PauseStream(ctx, "stream-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Status != "paused" {
		t.Errorf("Expected status 'paused', got %s", resp.Status)
	}
}

func TestStreamingClientListStreams(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("Expected GET, got %s", r.Method)
		}

		// Check query params
		q := r.URL.Query()
		if q.Get("payer") != "0xpayer" {
			t.Errorf("Expected payer=0xpayer, got %s", q.Get("payer"))
		}
		if q.Get("limit") != "10" {
			t.Errorf("Expected limit=10, got %s", q.Get("limit"))
		}

		resp := ListStreamsResponse{
			Streams: []*Stream{
				{ID: "stream-1", Status: StreamStatusActive},
				{ID: "stream-2", Status: StreamStatusClosed},
			},
			Total:   2,
			Limit:   10,
			Offset:  0,
			HasMore: false,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	resp, err := client.ListStreams(ctx, &ListStreamsParams{
		Payer: "0xpayer",
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(resp.Streams) != 2 {
		t.Errorf("Expected 2 streams, got %d", len(resp.Streams))
	}
	if resp.Total != 2 {
		t.Errorf("Expected total 2, got %d", resp.Total)
	}
}

func TestStreamingClientErrorHandling(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"code":"INVALID_REQUEST","message":"bad request"}`))
	}))
	defer server.Close()

	client := NewStreamingClient(&StreamingClientConfig{URL: server.URL})

	_, err := client.OpenStream(ctx, &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0xpayer",
		Payee:     "0xpayee",
		Asset:     "0xusdt",
		MaxAmount: "1000000",
		Signature: "sig",
	})
	if err == nil {
		t.Error("Expected error for bad request")
	}

	_, err = client.GetStream(ctx, "nonexistent", nil)
	if err == nil {
		t.Error("Expected error for bad request")
	}

	_, err = client.ListStreams(ctx, nil)
	if err == nil {
		t.Error("Expected error for bad request")
	}
}

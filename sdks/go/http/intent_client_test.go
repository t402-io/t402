package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewIntentClient(t *testing.T) {
	// Test with default config
	client := NewIntentClient(nil)
	if client == nil {
		t.Fatal("Expected client to be created")
	}
	if client.url != DefaultFacilitatorURL {
		t.Errorf("Expected default URL %s, got %s", DefaultFacilitatorURL, client.url)
	}

	// Test with custom config
	client = NewIntentClient(&IntentClientConfig{
		URL:    "https://custom.example.com",
		APIKey: "test-key",
	})
	if client.url != "https://custom.example.com" {
		t.Errorf("Expected custom URL, got %s", client.url)
	}
	if client.apiKey != "test-key" {
		t.Errorf("Expected apiKey 'test-key', got %s", client.apiKey)
	}
}

func TestIntentClientCreateIntent(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent" {
			t.Errorf("Expected path /v1/intent, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("Expected POST, got %s", r.Method)
		}

		var req CreateIntentRequest
		json.NewDecoder(r.Body).Decode(&req)

		if req.Payer != "0xpayer" {
			t.Errorf("Expected payer 0xpayer, got %s", req.Payer)
		}
		if req.Amount != "5000000" {
			t.Errorf("Expected amount 5000000, got %s", req.Amount)
		}

		now := time.Now()
		resp := CreateIntentResponse{
			Intent: &Intent{
				ID:        "intent-1",
				Payer:     req.Payer,
				Payee:     req.Payee,
				Amount:    req.Amount,
				Asset:     req.Asset,
				Status:    IntentStatusPending,
				Priority:  IntentPriorityNormal,
				CreatedAt: now,
				ExpiresAt: now.Add(5 * time.Minute),
			},
			AvailableRoutes: []*Route{
				{
					ID:            "route-1",
					SourceNetwork: "eip155:1",
					TargetNetwork: "eip155:8453",
					InputAmount:   "5000000",
					OutputAmount:  "4990000",
					Score:         0.95,
					Steps: []*RouteStep{
						{Order: 1, Type: RouteStepBridge, Network: "eip155:1"},
					},
				},
			},
			RecommendedRoute: &Route{
				ID:    "route-1",
				Score: 0.95,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.CreateIntent(ctx, &CreateIntentRequest{
		Payer:  "0xpayer",
		Payee:  "0xpayee",
		Amount: "5000000",
		Asset:  "USDT",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Intent.ID != "intent-1" {
		t.Errorf("Expected intent ID intent-1, got %s", resp.Intent.ID)
	}
	if len(resp.AvailableRoutes) != 1 {
		t.Errorf("Expected 1 available route, got %d", len(resp.AvailableRoutes))
	}
	if resp.RecommendedRoute == nil {
		t.Error("Expected recommended route")
	}
}

func TestIntentClientGetIntent(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/intent-1" {
			t.Errorf("Expected path /v1/intent/intent-1, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("Expected GET, got %s", r.Method)
		}

		resp := GetIntentResponse{
			Intent: &Intent{
				ID:     "intent-1",
				Status: IntentStatusPending,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.GetIntent(ctx, "intent-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Intent.ID != "intent-1" {
		t.Errorf("Expected intent ID intent-1, got %s", resp.Intent.ID)
	}
}

func TestIntentClientSelectRoute(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/intent-1/route" {
			t.Errorf("Expected path /v1/intent/intent-1/route, got %s", r.URL.Path)
		}

		var req SelectRouteRequest
		json.NewDecoder(r.Body).Decode(&req)

		if req.RouteID != "route-1" {
			t.Errorf("Expected routeId route-1, got %s", req.RouteID)
		}

		resp := SelectRouteResponse{
			Intent: &Intent{
				ID:     "intent-1",
				Status: IntentStatusRouted,
			},
			SelectedRoute: &Route{
				ID:    "route-1",
				Score: 0.95,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.SelectRoute(ctx, "intent-1", &SelectRouteRequest{
		RouteID: "route-1",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Intent.Status != IntentStatusRouted {
		t.Errorf("Expected status routed, got %s", resp.Intent.Status)
	}
	if resp.SelectedRoute.ID != "route-1" {
		t.Errorf("Expected route ID route-1, got %s", resp.SelectedRoute.ID)
	}
}

func TestIntentClientExecuteIntent(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/intent-1/execute" {
			t.Errorf("Expected path /v1/intent/intent-1/execute, got %s", r.URL.Path)
		}

		var req ExecuteIntentRequest
		json.NewDecoder(r.Body).Decode(&req)

		if req.Signature != "sig123" {
			t.Errorf("Expected signature sig123, got %s", req.Signature)
		}

		resp := ExecuteIntentResponse{
			Intent: &Intent{
				ID:     "intent-1",
				Status: IntentStatusCompleted,
			},
			TxHashes: []string{"0xtx1", "0xtx2"},
			Status:   "completed",
			Message:  "Intent executed successfully",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.ExecuteIntent(ctx, "intent-1", &ExecuteIntentRequest{
		Signature: "sig123",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(resp.TxHashes) != 2 {
		t.Errorf("Expected 2 tx hashes, got %d", len(resp.TxHashes))
	}
	if resp.Status != "completed" {
		t.Errorf("Expected status completed, got %s", resp.Status)
	}
}

func TestIntentClientCancelIntent(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/intent-1/cancel" {
			t.Errorf("Expected path /v1/intent/intent-1/cancel, got %s", r.URL.Path)
		}

		resp := CancelIntentResponse{
			Status:  "cancelled",
			Message: "intent cancelled successfully",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.CancelIntent(ctx, "intent-1", &CancelIntentRequest{
		Reason: "no longer needed",
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.Status != "cancelled" {
		t.Errorf("Expected status cancelled, got %s", resp.Status)
	}
}

func TestIntentClientRefreshRoutes(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/intent-1/refresh" {
			t.Errorf("Expected path /v1/intent/intent-1/refresh, got %s", r.URL.Path)
		}

		resp := RefreshRoutesResponse{
			Intent: &Intent{
				ID:     "intent-1",
				Status: IntentStatusPending,
			},
			AvailableRoutes: []*Route{
				{ID: "route-2", Score: 0.98},
			},
			RecommendedRoute: &Route{ID: "route-2", Score: 0.98},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.RefreshRoutes(ctx, "intent-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(resp.AvailableRoutes) != 1 {
		t.Errorf("Expected 1 available route, got %d", len(resp.AvailableRoutes))
	}
}

func TestIntentClientListIntents(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("Expected GET, got %s", r.Method)
		}

		q := r.URL.Query()
		if q.Get("payer") != "0xpayer" {
			t.Errorf("Expected payer=0xpayer, got %s", q.Get("payer"))
		}
		if q.Get("limit") != "5" {
			t.Errorf("Expected limit=5, got %s", q.Get("limit"))
		}

		resp := ListIntentsResponse{
			Intents: []*Intent{
				{ID: "intent-1", Status: IntentStatusCompleted},
				{ID: "intent-2", Status: IntentStatusPending},
			},
			Total:   2,
			Limit:   5,
			Offset:  0,
			HasMore: false,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	resp, err := client.ListIntents(ctx, &ListIntentsParams{
		Payer: "0xpayer",
		Limit: 5,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if len(resp.Intents) != 2 {
		t.Errorf("Expected 2 intents, got %d", len(resp.Intents))
	}
	if resp.Total != 2 {
		t.Errorf("Expected total 2, got %d", resp.Total)
	}
}

func TestIntentClientGetIntentStats(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/intent/stats" {
			t.Errorf("Expected path /v1/intent/stats, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("Expected GET, got %s", r.Method)
		}

		resp := IntentStats{
			"pending":   5,
			"completed": 42,
			"failed":    3,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	stats, err := client.GetIntentStats(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if stats["completed"] != 42 {
		t.Errorf("Expected 42 completed, got %d", stats["completed"])
	}
	if stats["pending"] != 5 {
		t.Errorf("Expected 5 pending, got %d", stats["pending"])
	}
}

func TestIntentClientWithAuth(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer api-key-123" {
			t.Errorf("Expected auth header 'Bearer api-key-123', got %s", r.Header.Get("Authorization"))
		}

		resp := GetIntentResponse{
			Intent: &Intent{ID: "intent-1", Status: IntentStatusPending},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{
		URL:    server.URL,
		APIKey: "api-key-123",
	})

	_, err := client.GetIntent(ctx, "intent-1")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

func TestIntentClientErrorHandling(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"code":"INTENT_NOT_FOUND","message":"intent not found"}`))
	}))
	defer server.Close()

	client := NewIntentClient(&IntentClientConfig{URL: server.URL})

	_, err := client.GetIntent(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for not found")
	}

	_, err = client.CreateIntent(ctx, &CreateIntentRequest{
		Payer:  "0xpayer",
		Payee:  "0xpayee",
		Amount: "1000000",
		Asset:  "USDT",
	})
	if err == nil {
		t.Error("Expected error for not found")
	}
}

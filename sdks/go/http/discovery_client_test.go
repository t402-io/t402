package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestListResources(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/v1/discovery/resources" {
			t.Errorf("expected /discovery/resources, got %s", r.URL.Path)
		}
		if r.URL.Query().Get("type") != "http" {
			t.Errorf("expected type=http, got %s", r.URL.Query().Get("type"))
		}
		if r.URL.Query().Get("limit") != "10" {
			t.Errorf("expected limit=10, got %s", r.URL.Query().Get("limit"))
		}
		_ = json.NewEncoder(w).Encode(DiscoveryResponse{
			T402Version: 2,
			Items: []DiscoveryItem{
				{ID: "res-1", Resource: "https://example.com/api", Type: "http", T402Version: 2},
			},
			Pagination: PaginationInfo{Limit: 10, Offset: 0, Total: 1},
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	resp, err := client.ListResources(context.Background(), &ListResourcesParams{Type: "http", Limit: 10})
	if err != nil {
		t.Fatalf("ListResources failed: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Items[0].ID != "res-1" {
		t.Errorf("expected id res-1, got %s", resp.Items[0].ID)
	}
	if resp.Pagination.Total != 1 {
		t.Errorf("expected total 1, got %d", resp.Pagination.Total)
	}
}

func TestListResourcesNilParams(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "" {
			t.Errorf("expected no query params, got %s", r.URL.RawQuery)
		}
		_ = json.NewEncoder(w).Encode(DiscoveryResponse{
			T402Version: 2,
			Items:       []DiscoveryItem{},
			Pagination:  PaginationInfo{Limit: 20, Offset: 0, Total: 0},
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	resp, err := client.ListResources(context.Background(), nil)
	if err != nil {
		t.Fatalf("ListResources failed: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Errorf("expected 0 items, got %d", len(resp.Items))
	}
}

func TestGetResource(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/v1/discovery/resources/res-123" {
			t.Errorf("expected /discovery/resources/res-123, got %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(DiscoveryItem{
			ID:          "res-123",
			Resource:    "https://example.com/api",
			Type:        "http",
			T402Version: 2,
			Accepts: []DiscoveryPaymentOption{
				{Scheme: "exact", Network: "eip155:8453", Amount: "100", Asset: "USDT", PayTo: "0xabc"},
			},
			LastUpdated: time.Now().Unix(),
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	item, err := client.GetResource(context.Background(), "res-123")
	if err != nil {
		t.Fatalf("GetResource failed: %v", err)
	}
	if item.ID != "res-123" {
		t.Errorf("expected id res-123, got %s", item.ID)
	}
	if len(item.Accepts) != 1 {
		t.Errorf("expected 1 payment option, got %d", len(item.Accepts))
	}
}

func TestGetResourceNotFound(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"not found"}`))
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	_, err := client.GetResource(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for not found resource")
	}
}

func TestRegisterResource(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/v1/discovery/register" {
			t.Errorf("expected /discovery/register, got %s", r.URL.Path)
		}

		var req RegisterResourceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if req.Resource != "https://example.com/api" {
			t.Errorf("expected resource https://example.com/api, got %s", req.Resource)
		}
		if req.Type != "http" {
			t.Errorf("expected type http, got %s", req.Type)
		}
		if len(req.Accepts) != 1 {
			t.Errorf("expected 1 payment option, got %d", len(req.Accepts))
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(RegisterResourceResponse{
			ID:          "res-new",
			Resource:    req.Resource,
			Type:        req.Type,
			T402Version: 2,
			CreatedAt:   time.Now(),
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	resp, err := client.RegisterResource(context.Background(), &RegisterResourceRequest{
		Resource: "https://example.com/api",
		Type:     "http",
		Accepts: []DiscoveryPaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "100", Asset: "USDT", PayTo: "0xabc", MaxTimeoutSeconds: 3600},
		},
	})
	if err != nil {
		t.Fatalf("RegisterResource failed: %v", err)
	}
	if resp.ID != "res-new" {
		t.Errorf("expected id res-new, got %s", resp.ID)
	}
}

func TestUpdateResource(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		if r.URL.Path != "/v1/discovery/resources/res-123" {
			t.Errorf("expected /discovery/resources/res-123, got %s", r.URL.Path)
		}

		var req UpdateResourceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if req.Active == nil || !*req.Active {
			t.Error("expected active=true")
		}

		_ = json.NewEncoder(w).Encode(DiscoveryItem{
			ID:          "res-123",
			Resource:    "https://example.com/api",
			Type:        "http",
			T402Version: 2,
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	active := true
	item, err := client.UpdateResource(context.Background(), "res-123", &UpdateResourceRequest{Active: &active})
	if err != nil {
		t.Fatalf("UpdateResource failed: %v", err)
	}
	if item.ID != "res-123" {
		t.Errorf("expected id res-123, got %s", item.ID)
	}
}

func TestDeleteResource(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("expected DELETE, got %s", r.Method)
		}
		if r.URL.Path != "/v1/discovery/resources/res-123" {
			t.Errorf("expected /discovery/resources/res-123, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	err := client.DeleteResource(context.Background(), "res-123")
	if err != nil {
		t.Fatalf("DeleteResource failed: %v", err)
	}
}

func TestDeleteResourceForbidden(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":"not authorized"}`))
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	err := client.DeleteResource(context.Background(), "res-123")
	if err == nil {
		t.Fatal("expected error for forbidden delete")
	}
}

func TestListResourcesWithAllParams(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("network") != "eip155:8453" {
			t.Errorf("expected network eip155:8453, got %s", q.Get("network"))
		}
		if q.Get("scheme") != "exact" {
			t.Errorf("expected scheme exact, got %s", q.Get("scheme"))
		}
		if q.Get("category") != "ai" {
			t.Errorf("expected category ai, got %s", q.Get("category"))
		}
		_ = json.NewEncoder(w).Encode(DiscoveryResponse{
			T402Version: 2,
			Items:       []DiscoveryItem{},
			Pagination:  PaginationInfo{Limit: 20, Offset: 0, Total: 0},
		})
	}))
	defer ts.Close()

	client := NewHTTPFacilitatorClient(&FacilitatorConfig{URL: ts.URL})
	_, err := client.ListResources(context.Background(), &ListResourcesParams{
		Network:  "eip155:8453",
		Scheme:   "exact",
		Category: "ai",
	})
	if err != nil {
		t.Fatalf("ListResources failed: %v", err)
	}
}

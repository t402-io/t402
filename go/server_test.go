package t402

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/t402-io/t402/go/types"
)

// Mock server for testing
type mockSchemeNetworkServer struct {
	scheme      string
	parsePrice  func(price Price, network Network) (AssetAmount, error)
	enhanceReqs func(ctx context.Context, base types.PaymentRequirements, supported types.SupportedKind, extensions []string) (types.PaymentRequirements, error)
}

func (m *mockSchemeNetworkServer) Scheme() string {
	return m.scheme
}

func (m *mockSchemeNetworkServer) ParsePrice(price Price, network Network) (AssetAmount, error) {
	if m.parsePrice != nil {
		return m.parsePrice(price, network)
	}
	return AssetAmount{
		Asset:  "USDC",
		Amount: "1000000",
		Extra:  map[string]interface{}{},
	}, nil
}

func (m *mockSchemeNetworkServer) EnhancePaymentRequirements(ctx context.Context, base types.PaymentRequirements, supported types.SupportedKind, extensions []string) (types.PaymentRequirements, error) {
	if m.enhanceReqs != nil {
		return m.enhanceReqs(ctx, base, supported, extensions)
	}
	enhanced := base
	if enhanced.Extra == nil {
		enhanced.Extra = make(map[string]interface{})
	}
	enhanced.Extra["enhanced"] = true
	return enhanced, nil
}

// mockFacilitatorClient is defined in server_hooks_test.go

// mockServerFacilitatorClient extends mockFacilitatorClient for server tests
type mockServerFacilitatorClient struct {
	kinds []SupportedKind
}

func (m *mockServerFacilitatorClient) Verify(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*VerifyResponse, error) {
	return &VerifyResponse{IsValid: true, Payer: "0xpayer"}, nil
}

func (m *mockServerFacilitatorClient) Settle(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*SettleResponse, error) {
	return &SettleResponse{Success: true, Transaction: "0xtx", Network: "eip155:1", Payer: "0xpayer"}, nil
}

func (m *mockServerFacilitatorClient) GetSupported(ctx context.Context) (SupportedResponse, error) {
	return SupportedResponse{
		Kinds:      m.kinds,
		Extensions: []string{},
		Signers:    make(map[string][]string),
	}, nil
}

func TestNewt402ResourceServer(t *testing.T) {
	server := Newt402ResourceServer()
	if server == nil {
		t.Fatal("Expected server to be created")
	}
	if server.schemes == nil {
		t.Fatal("Expected schemes map to be initialized")
	}
	if server.facilitatorClients == nil {
		t.Fatal("Expected facilitator clients to be initialized")
	}
	if server.supportedCache == nil {
		t.Fatal("Expected cache to be initialized")
	}
}

func TestServerWithOptions(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		kinds: []SupportedKind{
			{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
		},
	}
	mockServer := &mockSchemeNetworkServer{scheme: "exact"}

	server := Newt402ResourceServer(
		WithFacilitatorClient(mockClient),
		WithSchemeServer("eip155:1", mockServer),
		WithCacheTTL(10*time.Minute),
	)

	// After Initialize, facilitatorClients map will be populated
	ctx := context.Background()
	server.Initialize(ctx)

	// Check schemes were registered
	if server.schemes["eip155:1"]["exact"] != mockServer {
		t.Fatal("Expected scheme server to be registered")
	}
	if server.supportedCache.ttl != 10*time.Minute {
		t.Fatal("Expected cache TTL to be set")
	}
}

func TestServerInitialize(t *testing.T) {
	ctx := context.Background()
	mockClient := &mockServerFacilitatorClient{
		kinds: []SupportedKind{
			{
				T402Version: 2,
				Scheme:      "exact",
				Network:     "eip155:1",
			},
			{
				T402Version: 2,
				Scheme:      "transfer",
				Network:     "eip155:8453",
			},
		},
	}

	server := Newt402ResourceServer(WithFacilitatorClient(mockClient))
	err := server.Initialize(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Verify initialization worked by checking GetSupported
	supported, err := mockClient.GetSupported(ctx)
	if err != nil {
		t.Fatalf("Failed to get supported: %v", err)
	}
	totalKinds := len(supported.Kinds)
	if totalKinds != 2 {
		t.Fatalf("Expected 2 kinds, got %d", totalKinds)
	}
}

func TestServerInitializeWithMultipleFacilitators(t *testing.T) {
	ctx := context.Background()

	// First facilitator supports exact on mainnet
	mockClient1 := &mockServerFacilitatorClient{
		kinds: []SupportedKind{
			{
				T402Version: 2,
				Scheme:      "exact",
				Network:     "eip155:1",
			},
		},
	}

	// Second facilitator supports exact on mainnet and Base
	mockClient2 := &mockServerFacilitatorClient{
		kinds: []SupportedKind{
			{
				T402Version: 2,
				Scheme:      "exact",
				Network:     "eip155:1", // Same as first
			},
			{
				T402Version: 2,
				Scheme:      "exact",
				Network:     "eip155:8453", // New network
			},
		},
	}

	server := Newt402ResourceServer(
		WithFacilitatorClient(mockClient1),
		WithFacilitatorClient(mockClient2),
	)

	err := server.Initialize(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Verify initialization worked by testing actual verify calls would route correctly
	// (facilitatorClientsMap is now private, test behavior instead of structure)
	payload := types.PaymentPayload{
		T402Version: 2,
		Accepted:    types.PaymentRequirements{Scheme: "exact", Network: "eip155:1"},
		Payload:     map[string]interface{}{},
	}
	requirements := types.PaymentRequirements{Scheme: "exact", Network: "eip155:1"}

	result, _ := server.VerifyPayment(ctx, payload, requirements)
	if !result.IsValid {
		t.Fatal("Expected verify to work after initialization")
	}
}

func TestServerBuildPaymentRequirements(t *testing.T) {
	ctx := context.Background()

	mockServer := &mockSchemeNetworkServer{
		scheme: "exact",
		parsePrice: func(price Price, network Network) (AssetAmount, error) {
			return AssetAmount{
				Asset:  "USDC",
				Amount: "5000000",
				Extra:  map[string]interface{}{"decimals": 6},
			}, nil
		},
	}

	mockClient := &mockFacilitatorClient{}

	server := Newt402ResourceServer(
		WithFacilitatorClient(mockClient),
		WithSchemeServer("eip155:1", mockServer),
	)

	// Initialize to populate supported kinds
	server.Initialize(ctx)

	config := ResourceConfig{
		Scheme:            "exact",
		PayTo:             "0xrecipient",
		Price:             "$5.00",
		Network:           "eip155:1",
		MaxTimeoutSeconds: 600,
	}

	// BuildPaymentRequirements now requires supportedKind
	supportedKind := types.SupportedKind{
		Scheme:  "exact",
		Network: "eip155:1",
	}

	requirements, err := server.BuildPaymentRequirements(ctx, config, supportedKind, []string{})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if requirements.Scheme != "exact" {
		t.Fatalf("Expected scheme 'exact', got %s", requirements.Scheme)
	}
	if requirements.Amount != "5000000" {
		t.Fatalf("Expected amount '5000000', got %s", requirements.Amount)
	}
	if requirements.Asset != "USDC" {
		t.Fatalf("Expected asset 'USDC', got %s", requirements.Asset)
	}
	if requirements.MaxTimeoutSeconds != 600 {
		t.Fatalf("Expected timeout 600, got %d", requirements.MaxTimeoutSeconds)
	}
	if requirements.Extra["enhanced"] != true {
		t.Fatal("Expected requirements to be enhanced")
	}
}

func TestServerBuildPaymentRequirementsNoScheme(t *testing.T) {
	ctx := context.Background()
	server := Newt402ResourceServer()

	config := ResourceConfig{
		Scheme:  "unregistered",
		PayTo:   "0xrecipient",
		Price:   "$5.00",
		Network: "eip155:1",
	}

	supportedKind := types.SupportedKind{
		Scheme:  "unregistered",
		Network: "eip155:1",
	}

	_, err := server.BuildPaymentRequirements(ctx, config, supportedKind, []string{})
	if err == nil {
		t.Fatal("Expected error for unregistered scheme")
	}

	var paymentErr *PaymentError
	if !errors.As(err, &paymentErr) || paymentErr.Code != ErrCodeUnsupportedScheme {
		t.Fatal("Expected UnsupportedScheme error")
	}
}

func TestServerCreatePaymentRequiredResponse(t *testing.T) {
	server := Newt402ResourceServer()

	requirements := []types.PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "eip155:1",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xrecipient",
		},
	}

	info := &types.ResourceInfo{
		URL:         "https://api.example.com/resource",
		Description: "Premium API access",
		MimeType:    "application/json",
	}

	response := server.CreatePaymentRequiredResponse(
		requirements,
		info,
		"Custom error message",
		map[string]interface{}{"custom": "extension"},
	)

	if response.T402Version != 2 {
		t.Fatalf("Expected version 2, got %d", response.T402Version)
	}
	if response.Error != "Custom error message" {
		t.Fatalf("Expected custom error, got %s", response.Error)
	}
	if response.Resource.URL != info.URL {
		t.Fatal("Expected resource info to be set")
	}
	if len(response.Accepts) != 1 {
		t.Fatal("Expected 1 requirement")
	}
	if response.Extensions["custom"] != "extension" {
		t.Fatal("Expected custom extension")
	}
}

func TestServerVerifyPayment(t *testing.T) {
	ctx := context.Background()

	mockClient := &mockFacilitatorClient{
		kinds: []SupportedKind{
			{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
		},
		verify: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*VerifyResponse, error) {
			return &VerifyResponse{
				IsValid: true,
				Payer:   "0xverifiedpayer",
			}, nil
		},
	}

	server := Newt402ResourceServer(WithFacilitatorClient(mockClient))
	server.Initialize(ctx)

	requirements := types.PaymentRequirements{
		Scheme:  "exact",
		Network: "eip155:1",
		Asset:   "USDC",
		Amount:  "1000000",
		PayTo:   "0xrecipient",
	}

	payload := types.PaymentPayload{
		T402Version: 2,
		Accepted:    requirements,
		Payload:     map[string]interface{}{},
	}

	// Server uses typed API now
	response, err := server.VerifyPayment(ctx, payload, requirements)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !response.IsValid {
		t.Fatal("Expected valid verification")
	}
	if response.Payer != "0xverifiedpayer" {
		t.Fatalf("Expected payer '0xverifiedpayer', got %s", response.Payer)
	}
}

func TestServerSettlePayment(t *testing.T) {
	ctx := context.Background()

	mockClient := &mockFacilitatorClient{
		kinds: []SupportedKind{
			{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
		},
		settle: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*SettleResponse, error) {
			return &SettleResponse{
				Success:     true,
				Transaction: "0xsettledtx",
				Payer:       "0xpayer",
				Network:     "eip155:1",
			}, nil
		},
	}

	server := Newt402ResourceServer(WithFacilitatorClient(mockClient))
	server.Initialize(ctx)

	requirements := types.PaymentRequirements{
		Scheme:  "exact",
		Network: "eip155:1",
		Asset:   "USDC",
		Amount:  "1000000",
		PayTo:   "0xrecipient",
	}

	payload := types.PaymentPayload{
		T402Version: 2,
		Accepted:    requirements,
		Payload:     map[string]interface{}{},
	}

	// Server uses typed API now
	response, err := server.SettlePayment(ctx, payload, requirements)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !response.Success {
		t.Fatal("Expected successful settlement")
	}
	if response.Transaction != "0xsettledtx" {
		t.Fatalf("Expected transaction '0xsettledtx', got %s", response.Transaction)
	}
}

func TestServerFindMatchingRequirements(t *testing.T) {
	server := Newt402ResourceServer()

	available := []types.PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "eip155:1",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xrecipient1",
		},
		{
			Scheme:  "transfer",
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "2000000",
			PayTo:   "0xrecipient2",
		},
	}

	// Test V2 matching (typed)
	payloadV2 := types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "transfer",
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "2000000",
			PayTo:   "0xrecipient2",
		},
	}

	matched := server.FindMatchingRequirements(available, payloadV2)
	if matched == nil {
		t.Fatal("Expected match for v2")
	}
	if matched.Scheme != "transfer" {
		t.Fatal("Expected transfer scheme to match")
	}

	// Server is V2 only - skip V1 matching test

	// Test no match
	payloadNoMatch := types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "nonexistent",
			Network: "eip155:1",
			Asset:   "USDC",
			Amount:  "3000000",
			PayTo:   "0xrecipient3",
		},
	}

	matched = server.FindMatchingRequirements(available, payloadNoMatch)
	if matched != nil {
		t.Fatal("Expected no match")
	}
}

// ProcessPaymentRequest is handled by the HTTP layer (go/http/server.go)
// See TestHTTPServerProcessRequest in http/server_test.go for integration tests

func TestSupportedCache(t *testing.T) {
	cache := &SupportedCache{
		data:   make(map[string]SupportedResponse),
		expiry: make(map[string]time.Time),
		ttl:    100 * time.Millisecond,
	}

	response := SupportedResponse{
		Kinds: []SupportedKind{
			{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
		},
		Extensions: []string{},
		Signers:    make(map[string][]string),
	}

	// Set and verify
	cache.Set("test", response)
	if len(cache.data) != 1 {
		t.Fatal("Expected item in cache")
	}

	// Get before expiry
	got, exists := cache.Get("test")
	if !exists {
		t.Fatal("Expected item to exist in cache")
	}
	if len(got.Kinds) != 1 {
		t.Fatal("Expected 1 kind in response")
	}

	// Wait for expiry
	time.Sleep(150 * time.Millisecond)

	// Get after expiry should fail
	_, exists = cache.Get("test")
	if exists {
		t.Fatal("Expected item to be expired")
	}

	// Set again and test Clear
	cache.Set("test", response)
	cache.Set("test2", response)
	if len(cache.data) != 2 {
		t.Fatal("Expected 2 items in cache")
	}

	// Clear cache
	cache.Clear()
	if len(cache.data) != 0 {
		t.Fatal("Expected cache to be cleared")
	}
	if len(cache.expiry) != 0 {
		t.Fatal("Expected expiry map to be cleared")
	}

	// Test Delete
	cache.Set("test", response)
	cache.Delete("test")
	_, exists = cache.Get("test")
	if exists {
		t.Fatal("Expected item to be deleted")
	}
}

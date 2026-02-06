package chi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	t402http "github.com/t402-io/t402/sdks/go/http"
	"github.com/t402-io/t402/sdks/go/types"
	chi "github.com/go-chi/chi/v5"
)

// ============================================================================
// Mock Implementations
// ============================================================================

// mockSchemeServer implements t402.SchemeNetworkServer for testing
type mockSchemeServer struct {
	scheme string
}

func (m *mockSchemeServer) Scheme() string {
	return m.scheme
}

func (m *mockSchemeServer) ParsePrice(_ t402.Price, _ t402.Network) (t402.AssetAmount, error) {
	return t402.AssetAmount{
		Asset:  "USDC",
		Amount: "1000000",
	}, nil
}

func (m *mockSchemeServer) EnhancePaymentRequirements(_ context.Context, base types.PaymentRequirements, _ types.SupportedKind, _ []string) (types.PaymentRequirements, error) {
	return base, nil
}

// mockFacilitatorClient implements t402.FacilitatorClient for testing
type mockFacilitatorClient struct {
	verifyFunc    func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error)
	settleFunc    func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error)
	supportedFunc func(ctx context.Context) (t402.SupportedResponse, error)
}

func (m *mockFacilitatorClient) Verify(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
	if m.verifyFunc != nil {
		return m.verifyFunc(ctx, payloadBytes, requirementsBytes)
	}
	return &t402.VerifyResponse{IsValid: true, Payer: "0xmock"}, nil
}

func (m *mockFacilitatorClient) Settle(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
	if m.settleFunc != nil {
		return m.settleFunc(ctx, payloadBytes, requirementsBytes)
	}
	return &t402.SettleResponse{Success: true, Transaction: "0xtx", Network: "eip155:1", Payer: "0xmock"}, nil
}

func (m *mockFacilitatorClient) GetSupported(ctx context.Context) (t402.SupportedResponse, error) {
	if m.supportedFunc != nil {
		return m.supportedFunc(ctx)
	}
	return t402.SupportedResponse{
		Kinds: []t402.SupportedKind{
			{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
		},
		Extensions: []string{},
		Signers:    make(map[string][]string),
	}, nil
}

func (m *mockFacilitatorClient) Identifier() string {
	return "mock"
}

// ============================================================================
// Test Helpers
// ============================================================================

// createPaymentHeader creates a base64-encoded payment header for testing
func createPaymentHeader(payTo string) string {
	payload := t402.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{"sig": "test"},
		Accepted: t402.PaymentRequirements{
			Scheme:            "exact",
			Network:           "eip155:1",
			Asset:             "USDC",
			Amount:            "1000000",
			PayTo:             payTo,
			MaxTimeoutSeconds: 300,
			Extra: map[string]interface{}{
				"resourceUrl": "http://example.com/api",
			},
		},
	}

	payloadJSON, _ := json.Marshal(payload)
	return base64.StdEncoding.EncodeToString(payloadJSON)
}

// defaultSupportedFunc returns a standard mock supported function
func defaultSupportedFunc() func(ctx context.Context) (t402.SupportedResponse, error) {
	return func(_ context.Context) (t402.SupportedResponse, error) {
		return t402.SupportedResponse{
			Kinds: []t402.SupportedKind{
				{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
			},
			Extensions: []string{},
			Signers:    make(map[string][]string),
		}, nil
	}
}

// ============================================================================
// ChiAdapter Tests
// ============================================================================

func TestChiAdapter_GetHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Custom-Header", "test-value")
	req.Header.Set("payment-signature", "sig-data")

	adapter := NewChiAdapter(req)

	if adapter.GetHeader("X-Custom-Header") != "test-value" {
		t.Error("Expected X-Custom-Header to be 'test-value'")
	}

	if adapter.GetHeader("payment-signature") != "sig-data" {
		t.Error("Expected payment-signature header")
	}
}

func TestChiAdapter_GetMethod(t *testing.T) {
	tests := []struct {
		method   string
		expected string
	}{
		{"GET", "GET"},
		{"POST", "POST"},
		{"PUT", "PUT"},
		{"DELETE", "DELETE"},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", nil)
			adapter := NewChiAdapter(req)

			if adapter.GetMethod() != tt.expected {
				t.Errorf("Expected method %s, got %s", tt.expected, adapter.GetMethod())
			}
		})
	}
}

func TestChiAdapter_GetPath(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/users/123", nil)
	adapter := NewChiAdapter(req)

	if adapter.GetPath() != "/api/users/123" {
		t.Errorf("Expected path '/api/users/123', got '%s'", adapter.GetPath())
	}
}

func TestChiAdapter_GetURL(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Host = "example.com"
	adapter := NewChiAdapter(req)

	expected := "http://example.com/api/test"
	if adapter.GetURL() != expected {
		t.Errorf("Expected URL '%s', got '%s'", expected, adapter.GetURL())
	}
}

func TestChiAdapter_GetAcceptHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Accept", "text/html")
	adapter := NewChiAdapter(req)

	if adapter.GetAcceptHeader() != "text/html" {
		t.Errorf("Expected Accept header 'text/html', got '%s'", adapter.GetAcceptHeader())
	}
}

func TestChiAdapter_GetUserAgent(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	adapter := NewChiAdapter(req)

	if adapter.GetUserAgent() != "Mozilla/5.0" {
		t.Errorf("Expected User-Agent 'Mozilla/5.0', got '%s'", adapter.GetUserAgent())
	}
}

// ============================================================================
// PaymentMiddleware Tests
// ============================================================================

func TestPaymentMiddleware_CallsNextWhenNoPaymentRequired(t *testing.T) {
	routes := t402http.RoutesConfig{
		"GET /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes, WithSyncFacilitatorOnStart(false)))

	nextCalled := false
	r.Get("/public", func(w http.ResponseWriter, req *http.Request) {
		nextCalled = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"success"}`))
	})

	req := httptest.NewRequest("GET", "/public", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if !nextCalled {
		t.Error("Expected next() to be called for non-protected route")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}
}

func TestPaymentMiddleware_Returns402JSONForPaymentError(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"GET /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
			Description: "API access",
		},
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Get("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected"}`))
	})

	req := httptest.NewRequest("GET", "/api", nil)
	req.Header.Set("Accept", "application/json")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", rec.Code)
	}

	if rec.Header().Get("PAYMENT-REQUIRED") == "" {
		t.Error("Expected PAYMENT-REQUIRED header")
	}
}

func TestPaymentMiddleware_Returns402HTMLForBrowserRequest(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"*": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$5.00",
					Network: "eip155:1",
				},
			},
			Description: "Premium content",
		},
	}

	paywallConfig := &t402http.PaywallConfig{
		AppName:      "Test App",
		CDPClientKey: "test-key",
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithPaywallConfig(paywallConfig),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Get("/content", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected"}`))
	})

	req := httptest.NewRequest("GET", "/content", nil)
	req.Header.Set("Accept", "text/html")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if !bytes.Contains([]byte(contentType), []byte("text/html")) {
		t.Errorf("Expected Content-Type to contain 'text/html', got '%s'", contentType)
	}

	body := rec.Body.String()
	if !bytes.Contains([]byte(body), []byte("Payment Required")) {
		t.Error("Expected 'Payment Required' in HTML body")
	}
}

func TestPaymentMiddleware_SettlesAndReturnsResponseForVerifiedPayment(t *testing.T) {
	settleCalled := false

	mockClient := &mockFacilitatorClient{
		verifyFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true, Payer: "0xpayer"}, nil
		},
		settleFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.SettleResponse, error) {
			settleCalled = true
			return &t402.SettleResponse{
				Success:     true,
				Transaction: "0xtx",
				Network:     "eip155:1",
				Payer:       "0xpayer",
			}, nil
		},
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"POST /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Post("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected-data"}`))
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	if !settleCalled {
		t.Error("Expected settlement to be called")
	}

	if rec.Header().Get("PAYMENT-RESPONSE") == "" {
		t.Error("Expected PAYMENT-RESPONSE header")
	}
}

func TestPaymentMiddleware_Returns402WhenSettlementFails(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		verifyFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true, Payer: "0xpayer"}, nil
		},
		settleFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     false,
				ErrorReason: "Insufficient funds",
			}, nil
		},
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"POST /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Post("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected-data"}`))
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", rec.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["error"] != "Settlement failed" {
		t.Errorf("Expected error 'Settlement failed', got '%v'", response["error"])
	}
	if response["details"] != "Insufficient funds" {
		t.Errorf("Expected details 'Insufficient funds', got '%v'", response["details"])
	}
}

func TestPaymentMiddleware_CustomErrorHandler(t *testing.T) {
	customHandlerCalled := false

	mockClient := &mockFacilitatorClient{
		verifyFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true, Payer: "0xpayer"}, nil
		},
		settleFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     false,
				ErrorReason: "Settlement rejected",
			}, nil
		},
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"POST /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	customErrorHandler := func(w http.ResponseWriter, r *http.Request, err error) {
		customHandlerCalled = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		body, _ := json.Marshal(map[string]string{
			"custom_error": err.Error(),
		})
		_, _ = w.Write(body)
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithErrorHandler(customErrorHandler),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Post("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected-data"}`))
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if !customHandlerCalled {
		t.Error("Expected custom error handler to be called")
	}

	var response map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if response["custom_error"] == nil {
		t.Error("Expected custom_error in response")
	}
}

func TestPaymentMiddleware_CustomSettlementHandler(t *testing.T) {
	settlementHandlerCalled := false
	var capturedSettleResponse *t402.SettleResponse

	mockClient := &mockFacilitatorClient{
		verifyFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true, Payer: "0xpayer"}, nil
		},
		settleFunc: func(_ context.Context, _ []byte, _ []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     true,
				Transaction: "0xtx123",
				Network:     "eip155:1",
				Payer:       "0xpayer",
			}, nil
		},
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"POST /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	customSettlementHandler := func(w http.ResponseWriter, r *http.Request, settleResponse *t402.SettleResponse) {
		settlementHandlerCalled = true
		capturedSettleResponse = settleResponse
		w.Header().Set("X-Transaction-ID", settleResponse.Transaction)
	}

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSettlementHandler(customSettlementHandler),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	r.Post("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected-data"}`))
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	if !settlementHandlerCalled {
		t.Error("Expected custom settlement handler to be called")
	}

	if capturedSettleResponse == nil {
		t.Fatal("Expected settle response to be captured")
	}

	if capturedSettleResponse.Transaction != "0xtx123" {
		t.Errorf("Expected transaction '0xtx123', got '%s'", capturedSettleResponse.Transaction)
	}
}

func TestPaymentMiddleware_WithTimeout(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"*": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	timeout := 10 * time.Second

	r := chi.NewRouter()
	r.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithTimeout(timeout),
		WithSyncFacilitatorOnStart(true),
	))

	r.Get("/test", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"success"}`))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", rec.Code)
	}
}

// ============================================================================
// T402Payment (Builder Pattern) Tests
// ============================================================================

func TestT402Payment_CreatesWorkingMiddleware(t *testing.T) {
	mockClient := &mockFacilitatorClient{
		supportedFunc: defaultSupportedFunc(),
	}

	mockServer := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"GET /api": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	r := chi.NewRouter()
	r.Use(T402Payment(Config{
		Routes:      routes,
		Facilitator: mockClient,
		Schemes: []SchemeConfig{
			{Network: "eip155:1", Server: mockServer},
		},
		SyncFacilitatorOnStart: true,
		Timeout:                5 * time.Second,
	}))

	r.Get("/api", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":"protected"}`))
	})

	r.Get("/public", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"public"}`))
	})

	// Test non-protected route passes through
	req := httptest.NewRequest("GET", "/public", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200 for public route, got %d", rec.Code)
	}

	// Test protected route requires payment
	req = httptest.NewRequest("GET", "/api", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402 for protected route, got %d", rec.Code)
	}
}

func TestT402Payment_RegistersMultipleSchemes(t *testing.T) {
	mockServer1 := &mockSchemeServer{scheme: "exact"}
	mockServer2 := &mockSchemeServer{scheme: "exact"}

	routes := t402http.RoutesConfig{
		"*": t402http.RouteConfig{
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   "0xtest",
					Price:   "$1.00",
					Network: "eip155:1",
				},
			},
		},
	}

	r := chi.NewRouter()
	r.Use(T402Payment(Config{
		Routes: routes,
		Schemes: []SchemeConfig{
			{Network: "eip155:1", Server: mockServer1},
			{Network: "eip155:8453", Server: mockServer2},
		},
		SyncFacilitatorOnStart: false,
	}))

	r.Get("/test", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"success"}`))
	})

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", rec.Code)
	}
}

// ============================================================================
// responseCapture Tests
// ============================================================================

func TestResponseCapture_CapturesStatusCode(t *testing.T) {
	capture := &responseCapture{
		header:     make(http.Header),
		body:       &bytes.Buffer{},
		statusCode: http.StatusOK,
	}

	capture.WriteHeader(http.StatusCreated)

	if capture.statusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", capture.statusCode)
	}
}

func TestResponseCapture_CapturesBody(t *testing.T) {
	capture := &responseCapture{
		header:     make(http.Header),
		body:       &bytes.Buffer{},
		statusCode: http.StatusOK,
	}

	data := []byte(`{"message":"test"}`)
	n, err := capture.Write(data)

	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}
	if n != len(data) {
		t.Errorf("Expected to write %d bytes, wrote %d", len(data), n)
	}
	if capture.body.String() != `{"message":"test"}` {
		t.Errorf("Expected body '%s', got '%s'", `{"message":"test"}`, capture.body.String())
	}
}

func TestResponseCapture_WriteHeaderOnlyOnce(t *testing.T) {
	capture := &responseCapture{
		header:     make(http.Header),
		body:       &bytes.Buffer{},
		statusCode: http.StatusOK,
	}

	capture.WriteHeader(http.StatusCreated)
	capture.WriteHeader(http.StatusAccepted) // Should be ignored

	if capture.statusCode != http.StatusCreated {
		t.Errorf("Expected status 201 (first call), got %d", capture.statusCode)
	}
}

func TestResponseCapture_Header(t *testing.T) {
	capture := &responseCapture{
		header:     make(http.Header),
		body:       &bytes.Buffer{},
		statusCode: http.StatusOK,
	}

	capture.Header().Set("X-Test", "value")

	if capture.Header().Get("X-Test") != "value" {
		t.Errorf("Expected header X-Test to be 'value', got '%s'", capture.Header().Get("X-Test"))
	}
}

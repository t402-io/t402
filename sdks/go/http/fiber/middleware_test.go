package fiber

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	t402http "github.com/t402-io/t402/sdks/go/http"
	"github.com/t402-io/t402/sdks/go/types"
	"github.com/gofiber/fiber/v2"
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

// readBody reads the response body and returns it as a string
func readBody(resp *http.Response) string {
	if resp.Body == nil {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return string(body)
}

// ============================================================================
// FiberAdapter Tests
// ============================================================================

// Note: Fiber's *fiber.Ctx is only valid during the request lifecycle.
// All adapter assertions must happen inside the handler before the context is released.

func TestFiberAdapter_GetHeader(t *testing.T) {
	app := fiber.New()

	var headerValue, sigValue string
	app.Get("/test", func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		headerValue = adapter.GetHeader("X-Custom-Header")
		sigValue = adapter.GetHeader("Payment-Signature")
		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Custom-Header", "test-value")
	req.Header.Set("Payment-Signature", "sig-data")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if headerValue != "test-value" {
		t.Errorf("Expected X-Custom-Header to be 'test-value', got '%s'", headerValue)
	}

	if sigValue != "sig-data" {
		t.Errorf("Expected Payment-Signature header 'sig-data', got '%s'", sigValue)
	}
}

func TestFiberAdapter_GetMethod(t *testing.T) {
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
			app := fiber.New()

			var gotMethod string
			app.Add(tt.method, "/test", func(c *fiber.Ctx) error {
				adapter := NewFiberAdapter(c)
				gotMethod = adapter.GetMethod()
				return c.SendStatus(200)
			})

			req := httptest.NewRequest(tt.method, "/test", nil)
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("Failed to test: %v", err)
			}
			defer resp.Body.Close()

			if gotMethod != tt.expected {
				t.Errorf("Expected method %s, got %s", tt.expected, gotMethod)
			}
		})
	}
}

func TestFiberAdapter_GetPath(t *testing.T) {
	app := fiber.New()

	var gotPath string
	app.Get("/api/users/:id", func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		gotPath = adapter.GetPath()
		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/api/users/123", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if gotPath != "/api/users/123" {
		t.Errorf("Expected path '/api/users/123', got '%s'", gotPath)
	}
}

func TestFiberAdapter_GetURL(t *testing.T) {
	app := fiber.New()

	var gotURL string
	app.Get("/api/test", func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		gotURL = adapter.GetURL()
		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Host = "example.com"
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	expected := "http://example.com/api/test"
	if gotURL != expected {
		t.Errorf("Expected URL '%s', got '%s'", expected, gotURL)
	}
}

func TestFiberAdapter_GetAcceptHeader(t *testing.T) {
	app := fiber.New()

	var gotAccept string
	app.Get("/test", func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		gotAccept = adapter.GetAcceptHeader()
		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Accept", "text/html")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if gotAccept != "text/html" {
		t.Errorf("Expected Accept header 'text/html', got '%s'", gotAccept)
	}
}

func TestFiberAdapter_GetUserAgent(t *testing.T) {
	app := fiber.New()

	var gotUserAgent string
	app.Get("/test", func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		gotUserAgent = adapter.GetUserAgent()
		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if gotUserAgent != "Mozilla/5.0" {
		t.Errorf("Expected User-Agent 'Mozilla/5.0', got '%s'", gotUserAgent)
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes, WithSyncFacilitatorOnStart(false)))

	nextCalled := false
	app.Get("/public", func(c *fiber.Ctx) error {
		nextCalled = true
		return c.JSON(fiber.Map{"message": "success"})
	})

	req := httptest.NewRequest("GET", "/public", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if !nextCalled {
		t.Error("Expected next() to be called for non-protected route")
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Get("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected"})
	})

	req := httptest.NewRequest("GET", "/api", nil)
	req.Header.Set("Accept", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}

	if resp.Header.Get("PAYMENT-REQUIRED") == "" {
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithPaywallConfig(paywallConfig),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Get("/content", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected"})
	})

	req := httptest.NewRequest("GET", "/content", nil)
	req.Header.Set("Accept", "text/html")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}

	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" || (contentType != "text/html; charset=utf-8" && contentType != "text/html") {
		t.Errorf("Expected Content-Type to be 'text/html; charset=utf-8', got '%s'", contentType)
	}

	body := readBody(resp)
	if len(body) == 0 {
		t.Error("Expected non-empty HTML body")
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Post("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected-data"})
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}

	body := readBody(resp)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", resp.StatusCode, body)
	}

	if !settleCalled {
		t.Error("Expected settlement to be called")
	}

	if resp.Header.Get("PAYMENT-RESPONSE") == "" {
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Post("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected-data"})
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}

	if resp.StatusCode != http.StatusPaymentRequired {
		body := readBody(resp)
		t.Errorf("Expected status 402, got %d. Body: %s", resp.StatusCode, body)
	}

	body := readBody(resp)
	var response map[string]interface{}
	if err := json.Unmarshal([]byte(body), &response); err != nil {
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

	customErrorHandler := func(c *fiber.Ctx, err error) error {
		customHandlerCalled = true
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"custom_error": err.Error(),
		})
	}

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithErrorHandler(customErrorHandler),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Post("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected-data"})
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}

	if !customHandlerCalled {
		t.Error("Expected custom error handler to be called")
	}

	body := readBody(resp)
	var response map[string]interface{}
	if err := json.Unmarshal([]byte(body), &response); err != nil {
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

	customSettlementHandler := func(c *fiber.Ctx, settleResponse *t402.SettleResponse) {
		settlementHandlerCalled = true
		capturedSettleResponse = settleResponse
		c.Set("X-Transaction-ID", settleResponse.Transaction)
	}

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithSettlementHandler(customSettlementHandler),
		WithSyncFacilitatorOnStart(true),
		WithTimeout(5*time.Second),
	))

	app.Post("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected-data"})
	})

	req := httptest.NewRequest("POST", "/api", nil)
	req.Header.Set("PAYMENT-SIGNATURE", createPaymentHeader("0xtest"))
	req.Host = "example.com"

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}

	body := readBody(resp)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", resp.StatusCode, body)
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

	app := fiber.New()
	app.Use(PaymentMiddlewareFromConfig(routes,
		WithFacilitatorClient(mockClient),
		WithScheme("eip155:1", mockServer),
		WithTimeout(timeout),
		WithSyncFacilitatorOnStart(true),
	))

	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "success"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
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

	app := fiber.New()
	app.Use(T402Payment(Config{
		Routes:      routes,
		Facilitator: mockClient,
		Schemes: []SchemeConfig{
			{Network: "eip155:1", Server: mockServer},
		},
		SyncFacilitatorOnStart: true,
		Timeout:                5 * time.Second,
	}))

	app.Get("/api", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"data": "protected"})
	})

	app.Get("/public", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "public"})
	})

	// Test non-protected route passes through
	req := httptest.NewRequest("GET", "/public", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200 for public route, got %d", resp.StatusCode)
	}

	// Test protected route requires payment
	req = httptest.NewRequest("GET", "/api", nil)
	resp2, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402 for protected route, got %d", resp2.StatusCode)
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

	app := fiber.New()
	app.Use(T402Payment(Config{
		Routes: routes,
		Schemes: []SchemeConfig{
			{Network: "eip155:1", Server: mockServer1},
			{Network: "eip155:8453", Server: mockServer2},
		},
		SyncFacilitatorOnStart: false,
	}))

	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "success"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to test: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}
}

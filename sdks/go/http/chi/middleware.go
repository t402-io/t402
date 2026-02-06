package chi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/extensions/bazaar"
	t402http "github.com/t402-io/t402/sdks/go/http"
)

// ============================================================================
// Chi Adapter Implementation
// ============================================================================

// ChiAdapter implements HTTPAdapter for the Chi framework (standard net/http)
type ChiAdapter struct {
	r *http.Request
}

// NewChiAdapter creates a new Chi adapter
func NewChiAdapter(r *http.Request) *ChiAdapter {
	return &ChiAdapter{r: r}
}

// GetHeader gets a request header
func (a *ChiAdapter) GetHeader(name string) string {
	return a.r.Header.Get(name)
}

// GetMethod gets the HTTP method
func (a *ChiAdapter) GetMethod() string {
	return a.r.Method
}

// GetPath gets the request path
func (a *ChiAdapter) GetPath() string {
	return a.r.URL.Path
}

// GetURL gets the full request URL
func (a *ChiAdapter) GetURL() string {
	scheme := "http"
	if a.r.TLS != nil {
		scheme = "https"
	}
	host := a.r.Host
	if host == "" {
		host = a.r.Header.Get("Host")
	}
	return fmt.Sprintf("%s://%s%s", scheme, host, a.r.URL.Path)
}

// GetAcceptHeader gets the Accept header
func (a *ChiAdapter) GetAcceptHeader() string {
	return a.r.Header.Get("Accept")
}

// GetUserAgent gets the User-Agent header
func (a *ChiAdapter) GetUserAgent() string {
	return a.r.Header.Get("User-Agent")
}

// ============================================================================
// Middleware Configuration
// ============================================================================

// MiddlewareConfig configures the payment middleware
type MiddlewareConfig struct {
	// Routes configuration
	Routes t402http.RoutesConfig

	// Facilitator client(s)
	FacilitatorClients []t402.FacilitatorClient

	// Scheme registrations
	Schemes []SchemeRegistration

	// Paywall configuration
	PaywallConfig *t402http.PaywallConfig

	// Sync with facilitator on start
	SyncFacilitatorOnStart bool

	// Custom error handler
	ErrorHandler func(http.ResponseWriter, *http.Request, error)

	// Custom settlement handler
	SettlementHandler func(http.ResponseWriter, *http.Request, *t402.SettleResponse)

	// Context timeout for payment operations
	Timeout time.Duration
}

// SchemeRegistration registers a scheme with the server
type SchemeRegistration struct {
	Network t402.Network
	Server  t402.SchemeNetworkServer
}

// MiddlewareOption configures the middleware
type MiddlewareOption func(*MiddlewareConfig)

// WithFacilitatorClient adds a facilitator client
func WithFacilitatorClient(client t402.FacilitatorClient) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.FacilitatorClients = append(c.FacilitatorClients, client)
	}
}

// WithScheme registers a scheme server
func WithScheme(network t402.Network, schemeServer t402.SchemeNetworkServer) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.Schemes = append(c.Schemes, SchemeRegistration{
			Network: network,
			Server:  schemeServer,
		})
	}
}

// WithPaywallConfig sets the paywall configuration
func WithPaywallConfig(config *t402http.PaywallConfig) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.PaywallConfig = config
	}
}

// WithSyncFacilitatorOnStart sets whether to sync with facilitator on startup
func WithSyncFacilitatorOnStart(sync bool) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.SyncFacilitatorOnStart = sync
	}
}

// WithErrorHandler sets a custom error handler
func WithErrorHandler(handler func(http.ResponseWriter, *http.Request, error)) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.ErrorHandler = handler
	}
}

// WithSettlementHandler sets a custom settlement handler
func WithSettlementHandler(handler func(http.ResponseWriter, *http.Request, *t402.SettleResponse)) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.SettlementHandler = handler
	}
}

// WithTimeout sets the context timeout for payment operations
func WithTimeout(timeout time.Duration) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.Timeout = timeout
	}
}

// ============================================================================
// Payment Middleware
// ============================================================================

// PaymentMiddleware creates Chi middleware for t402 payment handling using a pre-configured server.
// Chi uses standard net/http middleware: func(http.Handler) http.Handler
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	server: Pre-configured t402 resource server
//	opts: Middleware options
//
// Returns:
//
//	Standard net/http middleware function compatible with Chi
func PaymentMiddleware(routes t402http.RoutesConfig, server *t402.T402ResourceServer, opts ...MiddlewareOption) func(http.Handler) http.Handler {
	config := &MiddlewareConfig{
		Routes:                 routes,
		SyncFacilitatorOnStart: true,
		Timeout:                30 * time.Second,
	}

	for _, opt := range opts {
		opt(config)
	}

	httpServer := t402http.Wrappedt402HTTPResourceServer(routes, server)

	httpServer.RegisterExtension(bazaar.BazaarResourceServerExtension)

	if config.SyncFacilitatorOnStart {
		ctx, cancel := context.WithTimeout(context.Background(), config.Timeout)
		defer cancel()
		if err := httpServer.Initialize(ctx); err != nil {
			fmt.Printf("Warning: failed to initialize t402 server: %v\n", err)
		}
	}

	return createMiddlewareHandler(httpServer, config)
}

// PaymentMiddlewareFromConfig creates Chi middleware for t402 payment handling.
// This creates the server internally from the provided options.
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	opts: Middleware options
//
// Returns:
//
//	Standard net/http middleware function compatible with Chi
func PaymentMiddlewareFromConfig(routes t402http.RoutesConfig, opts ...MiddlewareOption) func(http.Handler) http.Handler {
	config := &MiddlewareConfig{
		Routes:                 routes,
		FacilitatorClients:     []t402.FacilitatorClient{},
		Schemes:                []SchemeRegistration{},
		SyncFacilitatorOnStart: true,
		Timeout:                30 * time.Second,
	}

	for _, opt := range opts {
		opt(config)
	}

	serverOpts := []t402.ResourceServerOption{}
	for _, client := range config.FacilitatorClients {
		serverOpts = append(serverOpts, t402.WithFacilitatorClient(client))
	}

	httpServer := t402http.Newt402HTTPResourceServer(config.Routes, serverOpts...)

	httpServer.RegisterExtension(bazaar.BazaarResourceServerExtension)

	for _, scheme := range config.Schemes {
		httpServer.Register(scheme.Network, scheme.Server)
	}

	if config.SyncFacilitatorOnStart {
		ctx, cancel := context.WithTimeout(context.Background(), config.Timeout)
		defer cancel()
		if err := httpServer.Initialize(ctx); err != nil {
			fmt.Printf("Warning: failed to initialize t402 server: %v\n", err)
		}
	}

	return createMiddlewareHandler(httpServer, config)
}

// createMiddlewareHandler creates the actual Chi middleware handler function.
func createMiddlewareHandler(server *t402http.HTTPServer, config *MiddlewareConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			adapter := NewChiAdapter(r)
			reqCtx := t402http.HTTPRequestContext{
				Adapter: adapter,
				Path:    r.URL.Path,
				Method:  r.Method,
			}

			// Check if route requires payment
			if !server.RequiresPayment(reqCtx) {
				next.ServeHTTP(w, r)
				return
			}

			// Create context with timeout
			ctx, cancel := context.WithTimeout(r.Context(), config.Timeout)
			defer cancel()

			result := server.ProcessHTTPRequest(ctx, reqCtx, config.PaywallConfig)

			switch result.Type {
			case t402http.ResultNoPaymentRequired:
				next.ServeHTTP(w, r)

			case t402http.ResultPaymentError:
				handlePaymentError(w, result.Response)

			case t402http.ResultPaymentVerified:
				handlePaymentVerified(w, r, server, ctx, next, result, config)
			}
		})
	}
}

// handlePaymentError handles payment error responses
func handlePaymentError(w http.ResponseWriter, response *t402http.HTTPResponseInstructions) {
	// Set headers
	for key, value := range response.Headers {
		w.Header().Set(key, value)
	}

	if response.IsHTML {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(response.Status)
		_, _ = w.Write([]byte(response.Body.(string)))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(response.Status)
	if response.Body != nil {
		bodyBytes, err := json.Marshal(response.Body)
		if err == nil {
			_, _ = w.Write(bodyBytes)
		}
	}
}

// handlePaymentVerified handles verified payments with settlement
func handlePaymentVerified(w http.ResponseWriter, r *http.Request, server *t402http.HTTPServer, ctx context.Context, next http.Handler, result t402http.HTTPProcessResult, config *MiddlewareConfig) {
	// Capture response for settlement
	capture := &responseCapture{
		header:     make(http.Header),
		body:       &bytes.Buffer{},
		statusCode: http.StatusOK,
	}

	// Copy existing headers
	for key, values := range w.Header() {
		for _, value := range values {
			capture.header.Add(key, value)
		}
	}

	// Continue to protected handler
	next.ServeHTTP(capture, r)

	// Don't settle if response failed
	if capture.statusCode >= 400 {
		copyHeaders(w, capture.header)
		w.WriteHeader(capture.statusCode)
		_, _ = w.Write(capture.body.Bytes())
		return
	}

	// Process settlement
	settleResult := server.ProcessSettlement(
		ctx,
		*result.PaymentPayload,
		*result.PaymentRequirements,
	)

	if !settleResult.Success {
		errorReason := settleResult.ErrorReason
		if errorReason == "" {
			errorReason = "Settlement failed"
		}
		if config.ErrorHandler != nil {
			config.ErrorHandler(w, r, fmt.Errorf("settlement failed: %s", errorReason))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		body, _ := json.Marshal(map[string]string{
			"error":   "Settlement failed",
			"details": errorReason,
		})
		_, _ = w.Write(body)
		return
	}

	// Copy captured headers to the real response
	copyHeaders(w, capture.header)

	// Add settlement headers
	for key, value := range settleResult.Headers {
		w.Header().Set(key, value)
	}

	// Call settlement handler if configured
	if config.SettlementHandler != nil {
		settleResponse := &t402.SettleResponse{
			Success:     true,
			Transaction: settleResult.Transaction,
			Network:     settleResult.Network,
			Payer:       settleResult.Payer,
		}
		config.SettlementHandler(w, r, settleResponse)
	}

	// Write captured response
	w.WriteHeader(capture.statusCode)
	_, _ = w.Write(capture.body.Bytes())
}

// copyHeaders copies headers from source to destination
func copyHeaders(dst http.ResponseWriter, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Header().Add(key, value)
		}
	}
}

// ============================================================================
// Response Capture
// ============================================================================

// responseCapture captures the response for settlement processing
type responseCapture struct {
	header     http.Header
	body       *bytes.Buffer
	statusCode int
	written    bool
	mu         sync.Mutex
}

// Header returns the header map
func (w *responseCapture) Header() http.Header {
	return w.header
}

// WriteHeader captures the status code
func (w *responseCapture) WriteHeader(code int) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.written {
		w.statusCode = code
		w.written = true
	}
}

// Write captures the response body
func (w *responseCapture) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.written {
		w.statusCode = http.StatusOK
		w.written = true
	}
	return w.body.Write(data)
}

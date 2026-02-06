package echo

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/extensions/bazaar"
	t402http "github.com/t402-io/t402/sdks/go/http"
	"github.com/labstack/echo/v4"
)

// ============================================================================
// Echo Adapter Implementation
// ============================================================================

// EchoAdapter implements HTTPAdapter for the Echo framework
type EchoAdapter struct {
	ctx echo.Context
}

// NewEchoAdapter creates a new Echo adapter
func NewEchoAdapter(ctx echo.Context) *EchoAdapter {
	return &EchoAdapter{ctx: ctx}
}

// GetHeader gets a request header
func (a *EchoAdapter) GetHeader(name string) string {
	return a.ctx.Request().Header.Get(name)
}

// GetMethod gets the HTTP method
func (a *EchoAdapter) GetMethod() string {
	return a.ctx.Request().Method
}

// GetPath gets the request path
func (a *EchoAdapter) GetPath() string {
	return a.ctx.Request().URL.Path
}

// GetURL gets the full request URL
func (a *EchoAdapter) GetURL() string {
	req := a.ctx.Request()
	scheme := "http"
	if req.TLS != nil {
		scheme = "https"
	}
	host := req.Host
	if host == "" {
		host = a.ctx.Request().Header.Get("Host")
	}
	return fmt.Sprintf("%s://%s%s", scheme, host, req.URL.Path)
}

// GetAcceptHeader gets the Accept header
func (a *EchoAdapter) GetAcceptHeader() string {
	return a.ctx.Request().Header.Get("Accept")
}

// GetUserAgent gets the User-Agent header
func (a *EchoAdapter) GetUserAgent() string {
	return a.ctx.Request().Header.Get("User-Agent")
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
	ErrorHandler func(echo.Context, error) error

	// Custom settlement handler
	SettlementHandler func(echo.Context, *t402.SettleResponse)

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
func WithErrorHandler(handler func(echo.Context, error) error) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.ErrorHandler = handler
	}
}

// WithSettlementHandler sets a custom settlement handler
func WithSettlementHandler(handler func(echo.Context, *t402.SettleResponse)) MiddlewareOption {
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

// PaymentMiddleware creates Echo middleware for t402 payment handling using a pre-configured server.
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	server: Pre-configured t402 resource server
//	opts: Middleware options
//
// Returns:
//
//	Echo middleware function
func PaymentMiddleware(routes t402http.RoutesConfig, server *t402.T402ResourceServer, opts ...MiddlewareOption) echo.MiddlewareFunc {
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

// PaymentMiddlewareFromConfig creates Echo middleware for t402 payment handling.
// This creates the server internally from the provided options.
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	opts: Middleware options
//
// Returns:
//
//	Echo middleware function
func PaymentMiddlewareFromConfig(routes t402http.RoutesConfig, opts ...MiddlewareOption) echo.MiddlewareFunc {
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

// createMiddlewareHandler creates the actual Echo middleware handler function.
func createMiddlewareHandler(server *t402http.HTTPServer, config *MiddlewareConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			adapter := NewEchoAdapter(c)
			reqCtx := t402http.HTTPRequestContext{
				Adapter: adapter,
				Path:    c.Request().URL.Path,
				Method:  c.Request().Method,
			}

			// Check if route requires payment
			if !server.RequiresPayment(reqCtx) {
				return next(c)
			}

			// Create context with timeout
			ctx, cancel := context.WithTimeout(c.Request().Context(), config.Timeout)
			defer cancel()

			result := server.ProcessHTTPRequest(ctx, reqCtx, config.PaywallConfig)

			switch result.Type {
			case t402http.ResultNoPaymentRequired:
				return next(c)

			case t402http.ResultPaymentError:
				return handlePaymentError(c, result.Response)

			case t402http.ResultPaymentVerified:
				return handlePaymentVerified(c, server, ctx, next, result, config)
			}

			return next(c)
		}
	}
}

// handlePaymentError handles payment error responses
func handlePaymentError(c echo.Context, response *t402http.HTTPResponseInstructions) error {
	// Set headers
	for key, value := range response.Headers {
		c.Response().Header().Set(key, value)
	}

	if response.IsHTML {
		return c.HTML(response.Status, response.Body.(string))
	}

	return c.JSON(response.Status, response.Body)
}

// handlePaymentVerified handles verified payments with settlement
func handlePaymentVerified(c echo.Context, server *t402http.HTTPServer, ctx context.Context, next echo.HandlerFunc, result t402http.HTTPProcessResult, config *MiddlewareConfig) error {
	// Capture response for settlement
	origWriter := c.Response().Writer
	capture := &responseCapture{
		ResponseWriter: origWriter,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
	}
	c.Response().Writer = capture

	// Continue to protected handler
	err := next(c)
	if err != nil {
		// Restore writer and return error
		c.Response().Writer = origWriter
		return err
	}

	// Capture the status that Echo recorded
	capturedStatus := capture.statusCode

	// Restore original writer and reset Echo's committed state
	// so we can still write error responses if settlement fails
	c.Response().Writer = origWriter
	c.Response().Committed = false
	c.Response().Status = 0

	// Don't settle if response failed
	if capturedStatus >= 400 {
		// Copy captured headers to the original writer
		for key, values := range capture.Header() {
			for _, value := range values {
				origWriter.Header().Add(key, value)
			}
		}
		origWriter.WriteHeader(capturedStatus)
		_, _ = origWriter.Write(capture.body.Bytes())
		return nil
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
			return config.ErrorHandler(c, fmt.Errorf("settlement failed: %s", errorReason))
		}
		return c.JSON(http.StatusPaymentRequired, map[string]string{
			"error":   "Settlement failed",
			"details": errorReason,
		})
	}

	// Add settlement headers
	for key, value := range settleResult.Headers {
		c.Response().Header().Set(key, value)
	}

	// Call settlement handler if configured
	if config.SettlementHandler != nil {
		settleResponse := &t402.SettleResponse{
			Success:     true,
			Transaction: settleResult.Transaction,
			Network:     settleResult.Network,
			Payer:       settleResult.Payer,
		}
		config.SettlementHandler(c, settleResponse)
	}

	// Write captured response
	origWriter.WriteHeader(capturedStatus)
	_, _ = origWriter.Write(capture.body.Bytes())
	return nil
}

// ============================================================================
// Response Capture
// ============================================================================

// responseCapture captures the response for settlement processing
type responseCapture struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
	written    bool
	mu         sync.Mutex
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

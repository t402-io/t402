package fiber

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/extensions/bazaar"
	t402http "github.com/t402-io/t402/sdks/go/http"
	"github.com/gofiber/fiber/v2"
)

// ============================================================================
// Fiber Adapter Implementation
// ============================================================================

// FiberAdapter implements HTTPAdapter for the Fiber framework
type FiberAdapter struct {
	ctx *fiber.Ctx
}

// NewFiberAdapter creates a new Fiber adapter
func NewFiberAdapter(ctx *fiber.Ctx) *FiberAdapter {
	return &FiberAdapter{ctx: ctx}
}

// GetHeader gets a request header
func (a *FiberAdapter) GetHeader(name string) string {
	return a.ctx.Get(name)
}

// GetMethod gets the HTTP method
func (a *FiberAdapter) GetMethod() string {
	return a.ctx.Method()
}

// GetPath gets the request path
func (a *FiberAdapter) GetPath() string {
	return a.ctx.Path()
}

// GetURL gets the full request URL
func (a *FiberAdapter) GetURL() string {
	return fmt.Sprintf("%s://%s%s", a.ctx.Protocol(), a.ctx.Hostname(), a.ctx.Path())
}

// GetAcceptHeader gets the Accept header
func (a *FiberAdapter) GetAcceptHeader() string {
	return a.ctx.Get("Accept")
}

// GetUserAgent gets the User-Agent header
func (a *FiberAdapter) GetUserAgent() string {
	return a.ctx.Get("User-Agent")
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
	ErrorHandler func(*fiber.Ctx, error) error

	// Custom settlement handler
	SettlementHandler func(*fiber.Ctx, *t402.SettleResponse)

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
func WithErrorHandler(handler func(*fiber.Ctx, error) error) MiddlewareOption {
	return func(c *MiddlewareConfig) {
		c.ErrorHandler = handler
	}
}

// WithSettlementHandler sets a custom settlement handler
func WithSettlementHandler(handler func(*fiber.Ctx, *t402.SettleResponse)) MiddlewareOption {
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

// PaymentMiddleware creates Fiber middleware for t402 payment handling using a pre-configured server.
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	server: Pre-configured t402 resource server
//	opts: Middleware options
//
// Returns:
//
//	Fiber handler function
func PaymentMiddleware(routes t402http.RoutesConfig, server *t402.T402ResourceServer, opts ...MiddlewareOption) fiber.Handler {
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

// PaymentMiddlewareFromConfig creates Fiber middleware for t402 payment handling.
// This creates the server internally from the provided options.
//
// Args:
//
//	routes: Route configuration mapping patterns to payment requirements
//	opts: Middleware options
//
// Returns:
//
//	Fiber handler function
func PaymentMiddlewareFromConfig(routes t402http.RoutesConfig, opts ...MiddlewareOption) fiber.Handler {
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

// createMiddlewareHandler creates the actual Fiber middleware handler function.
func createMiddlewareHandler(server *t402http.HTTPServer, config *MiddlewareConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		adapter := NewFiberAdapter(c)
		reqCtx := t402http.HTTPRequestContext{
			Adapter: adapter,
			Path:    c.Path(),
			Method:  c.Method(),
		}

		// Check if route requires payment
		if !server.RequiresPayment(reqCtx) {
			return c.Next()
		}

		// Create context with timeout
		ctx, cancel := context.WithTimeout(c.UserContext(), config.Timeout)
		defer cancel()

		result := server.ProcessHTTPRequest(ctx, reqCtx, config.PaywallConfig)

		switch result.Type {
		case t402http.ResultNoPaymentRequired:
			return c.Next()

		case t402http.ResultPaymentError:
			return handlePaymentError(c, result.Response)

		case t402http.ResultPaymentVerified:
			return handlePaymentVerified(c, server, ctx, result, config)
		}

		return c.Next()
	}
}

// handlePaymentError handles payment error responses
func handlePaymentError(c *fiber.Ctx, response *t402http.HTTPResponseInstructions) error {
	// Set headers
	for key, value := range response.Headers {
		c.Set(key, value)
	}

	if response.IsHTML {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Status(response.Status).SendString(response.Body.(string))
	}

	return c.Status(response.Status).JSON(response.Body)
}

// handlePaymentVerified handles verified payments with settlement
func handlePaymentVerified(c *fiber.Ctx, server *t402http.HTTPServer, ctx context.Context, result t402http.HTTPProcessResult, config *MiddlewareConfig) error {
	// Continue to protected handler
	err := c.Next()
	if err != nil {
		return err
	}

	// Get the response status from fasthttp
	statusCode := c.Response().StatusCode()

	// Don't settle if response failed
	if statusCode >= 400 {
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

		// Reset response and send error
		c.Response().Reset()
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error":   "Settlement failed",
			"details": errorReason,
		})
	}

	// Add settlement headers to the response
	for key, value := range settleResult.Headers {
		c.Set(key, value)
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

	return nil
}

// ============================================================================
// JSON Helper
// ============================================================================

// jsonResponse is a helper to write JSON responses with Fiber
//
//nolint:unused // Available for extension use
func jsonResponse(c *fiber.Ctx, status int, data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(body)
}

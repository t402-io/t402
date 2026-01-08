// Package http provides HTTP-specific implementations of t402 components.
// This includes HTTP-aware clients, services, and facilitator clients.
package http

import (
	"context"
	"io"
	"net/http"

	t402 "github.com/coinbase/t402/go"
)

// ============================================================================
// Re-export main types for convenience
// ============================================================================

// HTTP Client types
type (
	// HTTPClient is an alias for t402HTTPClient
	HTTPClient = t402HTTPClient

	// HTTPServer is an alias for t402HTTPResourceServer
	HTTPServer = t402HTTPResourceServer
)

// ============================================================================
// Constructor functions with simpler names
// ============================================================================

// NewClient creates a new HTTP-aware t402 client
func NewClient(client *t402.T402Client) *t402HTTPClient {
	return Newt402HTTPClient(client)
}

// NewServer creates a new HTTP resource server
func NewServer(routes RoutesConfig, opts ...t402.ResourceServerOption) *t402HTTPResourceServer {
	return Newt402HTTPResourceServer(routes, opts...)
}

// NewFacilitatorClient creates a new HTTP facilitator client
func NewFacilitatorClient(config *FacilitatorConfig) *HTTPFacilitatorClient {
	return NewHTTPFacilitatorClient(config)
}

// ============================================================================
// Convenience functions
// ============================================================================

// WrapClient wraps a standard HTTP client with t402 payment handling
func WrapClient(client *http.Client, t402Client *t402HTTPClient) *http.Client {
	return WrapHTTPClientWithPayment(client, t402Client)
}

// Get performs a GET request with automatic payment handling
func Get(ctx context.Context, url string, t402Client *t402HTTPClient) (*http.Response, error) {
	return t402Client.GetWithPayment(ctx, url)
}

// Post performs a POST request with automatic payment handling
func Post(ctx context.Context, url string, body io.Reader, t402Client *t402HTTPClient) (*http.Response, error) {
	return t402Client.PostWithPayment(ctx, url, body)
}

// Do performs an HTTP request with automatic payment handling
func Do(ctx context.Context, req *http.Request, t402Client *t402HTTPClient) (*http.Response, error) {
	return t402Client.DoWithPayment(ctx, req)
}

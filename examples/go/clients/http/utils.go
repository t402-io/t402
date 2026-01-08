package main

import (
	"encoding/base64"
	"encoding/json"
	"net/http"

	t402 "github.com/coinbase/t402/go"
	t402http "github.com/coinbase/t402/go/http"
)

// wrapHTTPClient wraps a standard HTTP client with t402 payment handling
func wrapHTTPClient(t402Client *t402.T402Client) *http.Client {
	// Create t402 HTTP client wrapper
	httpClient := t402http.Newt402HTTPClient(t402Client)

	// Wrap standard HTTP client with payment handling
	return t402http.WrapHTTPClientWithPayment(http.DefaultClient, httpClient)
}

// extractPaymentResponse extracts settlement details from response headers
func extractPaymentResponse(headers http.Header) (*t402.SettleResponse, error) {
	// Try v2 header first
	paymentHeader := headers.Get("PAYMENT-RESPONSE")
	if paymentHeader == "" {
		// Try v1 header
		paymentHeader = headers.Get("X-PAYMENT-RESPONSE")
	}

	if paymentHeader == "" {
		return nil, nil
	}

	// Decode base64
	decoded, err := base64.StdEncoding.DecodeString(paymentHeader)
	if err != nil {
		return nil, err
	}

	// Parse settlement response
	var settleResp t402.SettleResponse
	if err := json.Unmarshal(decoded, &settleResp); err != nil {
		return nil, err
	}

	return &settleResp, nil
}


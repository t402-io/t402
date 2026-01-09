package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	t402 "github.com/awesome-doge/t402/go"
	"github.com/awesome-doge/t402/go/mechanisms/ton"
	tonclient "github.com/awesome-doge/t402/go/mechanisms/ton/exact/client"
	"github.com/joho/godotenv"
)

/**
 * Example demonstrating how to use the t402 Go client with TON payments.
 *
 * This example shows how to:
 * 1. Implement the ClientTonSigner interface
 * 2. Create a t402 client with TON scheme
 * 3. Make HTTP requests with automatic TON USDT Jetton payments
 *
 * Required environment variables:
 * - TON_PRIVATE_KEY: Private key for TON wallet (hex encoded)
 * - TON_ADDRESS: TON wallet address
 * - SERVER_URL: URL of the resource server (optional)
 */

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found, using environment variables")
	}

	// Get configuration
	tonAddress := os.Getenv("TON_ADDRESS")
	if tonAddress == "" {
		fmt.Println("❌ TON_ADDRESS environment variable is required")
		os.Exit(1)
	}

	url := os.Getenv("SERVER_URL")
	if url == "" {
		url = "http://localhost:4021/weather"
	}

	fmt.Printf("🚀 TON t402 Client Example\n")
	fmt.Printf("   TON Address: %s\n", tonAddress)
	fmt.Printf("   Server URL: %s\n\n", url)

	// Create TON signer (example implementation)
	signer := &ExampleTonSigner{
		address: tonAddress,
		seqno:   1,
	}

	// Create t402 client with TON scheme
	tonScheme := tonclient.NewExactTonScheme(signer)
	client := t402.NewClient().
		Register(t402.Network("ton:testnet"), tonScheme).
		Register(t402.Network("ton:mainnet"), tonScheme)

	// Make the request with automatic payment handling
	if err := makeRequest(client, url); err != nil {
		fmt.Printf("❌ Request failed: %v\n", err)
		os.Exit(1)
	}
}

// ExampleTonSigner is a basic implementation of the ClientTonSigner interface
// In production, this would use actual TON wallet libraries
type ExampleTonSigner struct {
	address string
	seqno   int64
}

// Address returns the signer's TON address
func (s *ExampleTonSigner) Address() string {
	return s.address
}

// GetSeqno returns the current wallet sequence number
func (s *ExampleTonSigner) GetSeqno(ctx context.Context) (int64, error) {
	// In production: query the TON network for the actual seqno
	return s.seqno, nil
}

// SignMessage signs a Jetton transfer message and returns the BOC
func (s *ExampleTonSigner) SignMessage(ctx context.Context, params ton.SignMessageParams) (string, error) {
	// In production: build and sign the actual Jetton transfer message
	// This would:
	// 1. Build a Jetton transfer body (op=0x0f8a7ea5, query_id, amount, destination, response_destination, forward_ton_amount, forward_payload)
	// 2. Create an internal message to the Jetton wallet
	// 3. Create an external message signed by the wallet
	// 4. Return the BOC as base64

	// Example placeholder - in production use actual TON SDK
	fmt.Printf("📝 Signing Jetton transfer:\n")
	fmt.Printf("   To: %s\n", params.To)
	fmt.Printf("   Value: %d nanoTON\n", params.Value)
	fmt.Printf("   Timeout: %d seconds\n", params.Timeout)

	// Return a placeholder BOC (in production, this would be the actual signed message)
	return "te6cckEBAQEAAgAAAEysuc0=", nil
}

// makeRequest performs an HTTP GET request with payment handling
func makeRequest(client *t402.T402Client, url string) error {
	httpClient := wrapHTTPClient(client)

	fmt.Printf("Making request to: %s\n\n", url)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	var responseData interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	fmt.Println("✅ Response body:")
	prettyJSON, _ := json.MarshalIndent(responseData, "  ", "  ")
	fmt.Printf("  %s\n", string(prettyJSON))

	// Extract payment response from headers if present
	paymentHeader := resp.Header.Get("PAYMENT-RESPONSE")
	if paymentHeader == "" {
		paymentHeader = resp.Header.Get("X-PAYMENT-RESPONSE")
	}

	if paymentHeader != "" {
		fmt.Println("\n💰 Payment Details:")
		fmt.Printf("   Payment response header present\n")
	}

	return nil
}

// wrapHTTPClient wraps an HTTP client with t402 payment handling
func wrapHTTPClient(client *t402.T402Client) *http.Client {
	return &http.Client{
		Transport: &t402Transport{
			client:    client,
			transport: http.DefaultTransport,
		},
	}
}

// t402Transport is an HTTP transport that handles t402 payments
type t402Transport struct {
	client    *t402.T402Client
	transport http.RoundTripper
}

// RoundTrip implements http.RoundTripper with t402 payment handling
func (t *t402Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Make initial request
	resp, err := t.transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	// Check for 402 Payment Required
	if resp.StatusCode != http.StatusPaymentRequired {
		return resp, nil
	}

	fmt.Println("📋 Received 402 Payment Required")

	// Get payment requirements from header
	paymentRequiredHeader := resp.Header.Get("PAYMENT-REQUIRED")
	if paymentRequiredHeader == "" {
		paymentRequiredHeader = resp.Header.Get("X-PAYMENT-REQUIRED")
	}

	if paymentRequiredHeader == "" {
		return resp, nil
	}

	// Close the 402 response body
	resp.Body.Close()

	// Parse payment requirements
	paymentRequired, err := t.client.ParsePaymentRequired(paymentRequiredHeader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse payment requirements: %w", err)
	}

	// Select a payment option (prefer TON if available)
	var selectedOption *t402.PaymentRequirements
	for _, opt := range paymentRequired.Accepts {
		network := string(opt.Network)
		if network == "ton:mainnet" || network == "ton:testnet" {
			selectedOption = &opt
			fmt.Printf("   Selected: %s on %s\n", opt.Scheme, opt.Network)
			break
		}
	}

	if selectedOption == nil && len(paymentRequired.Accepts) > 0 {
		selectedOption = &paymentRequired.Accepts[0]
		fmt.Printf("   Selected: %s on %s\n", selectedOption.Scheme, selectedOption.Network)
	}

	if selectedOption == nil {
		return nil, fmt.Errorf("no payment options available")
	}

	// Create payment payload
	ctx := req.Context()
	payload, err := t.client.CreatePaymentPayload(ctx, *selectedOption)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment payload: %w", err)
	}

	fmt.Println("✍️  Created payment payload")

	// Encode payload
	payloadStr, err := t.client.EncodePaymentPayload(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode payment payload: %w", err)
	}

	// Create new request with payment
	newReq, err := http.NewRequestWithContext(ctx, req.Method, req.URL.String(), req.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to create new request: %w", err)
	}

	// Copy headers and add payment
	for key, values := range req.Header {
		for _, value := range values {
			newReq.Header.Add(key, value)
		}
	}
	newReq.Header.Set("PAYMENT-SIGNATURE", payloadStr)
	newReq.Header.Set("X-PAYMENT-SIGNATURE", payloadStr)

	fmt.Println("📤 Sending request with payment...")

	// Make the paid request
	return t.transport.RoundTrip(newReq)
}

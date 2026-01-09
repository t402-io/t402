package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	t402 "github.com/t402-io/t402/go"
	"github.com/t402-io/t402/go/mechanisms/tron"
	tronclient "github.com/t402-io/t402/go/mechanisms/tron/exact/client"
	"github.com/joho/godotenv"
)

/**
 * Example demonstrating how to use the t402 Go client with TRON payments.
 *
 * This example shows how to:
 * 1. Implement the ClientTronSigner interface
 * 2. Create a t402 client with TRON scheme
 * 3. Make HTTP requests with automatic TRON TRC20 USDT payments
 *
 * Required environment variables:
 * - TRON_PRIVATE_KEY: Private key for TRON wallet (hex encoded)
 * - TRON_ADDRESS: TRON wallet address (T...)
 * - SERVER_URL: URL of the resource server (optional)
 */

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found, using environment variables")
	}

	// Get configuration
	tronAddress := os.Getenv("TRON_ADDRESS")
	if tronAddress == "" {
		fmt.Println("❌ TRON_ADDRESS environment variable is required")
		os.Exit(1)
	}

	url := os.Getenv("SERVER_URL")
	if url == "" {
		url = "http://localhost:4021/weather"
	}

	fmt.Printf("🚀 TRON t402 Client Example\n")
	fmt.Printf("   TRON Address: %s\n", tronAddress)
	fmt.Printf("   Server URL: %s\n\n", url)

	// Create TRON signer (example implementation)
	signer := &ExampleTronSigner{
		address: tronAddress,
	}

	// Create t402 client with TRON scheme
	tronScheme := tronclient.NewExactTronScheme(signer)
	client := t402.NewClient().
		Register(t402.Network("tron:mainnet"), tronScheme).
		Register(t402.Network("tron:nile"), tronScheme).
		Register(t402.Network("tron:shasta"), tronScheme)

	// Make the request with automatic payment handling
	if err := makeRequest(client, url); err != nil {
		fmt.Printf("❌ Request failed: %v\n", err)
		os.Exit(1)
	}
}

// ExampleTronSigner is a basic implementation of the ClientTronSigner interface
// In production, this would use actual TRON wallet libraries like go-tron-sdk
type ExampleTronSigner struct {
	address string
}

// Address returns the signer's TRON address
func (s *ExampleTronSigner) Address() string {
	return s.address
}

// GetBlockInfo returns block info for transaction building
func (s *ExampleTronSigner) GetBlockInfo(ctx context.Context) (*tron.BlockInfo, error) {
	// In production: query the TRON network for the latest block
	// Example using TronGrid API:
	//
	// resp, err := http.Get("https://api.trongrid.io/wallet/getnowblock")
	// if err != nil { return nil, err }
	// var block struct {
	//     BlockID string `json:"blockID"`
	//     BlockHeader struct {
	//         RawData struct {
	//             Number int64 `json:"number"`
	//         } `json:"raw_data"`
	//     } `json:"block_header"`
	// }
	// json.NewDecoder(resp.Body).Decode(&block)
	//
	// return &tron.BlockInfo{
	//     RefBlockBytes: fmt.Sprintf("%04x", block.BlockHeader.RawData.Number & 0xFFFF),
	//     RefBlockHash:  block.BlockID[16:32],
	//     Expiration:    time.Now().Add(time.Minute).UnixMilli(),
	// }, nil

	now := time.Now()
	return &tron.BlockInfo{
		RefBlockBytes: "0000",
		RefBlockHash:  "0000000000000000",
		Expiration:    now.Add(time.Minute).UnixMilli(),
	}, nil
}

// SignTransaction signs a TRC20 transfer and returns the signed transaction
func (s *ExampleTronSigner) SignTransaction(ctx context.Context, params tron.SignTransactionParams) (string, error) {
	// In production: build and sign the actual TRC20 transfer transaction
	// This would:
	// 1. Build a TriggerSmartContract transaction for transfer(address,uint256)
	// 2. Set the fee limit
	// 3. Sign the transaction with the private key
	// 4. Return the signed transaction as JSON

	fmt.Printf("📝 Signing TRC20 transfer:\n")
	fmt.Printf("   Contract: %s\n", params.ContractAddress)
	fmt.Printf("   To: %s\n", params.To)
	fmt.Printf("   Amount: %s\n", params.Amount)
	fmt.Printf("   Fee Limit: %d SUN\n", params.FeeLimit)

	// Return a placeholder signed transaction (in production, this would be the actual signed message)
	signedTx := map[string]interface{}{
		"txID": "placeholder_tx_id",
		"raw_data": map[string]interface{}{
			"contract": []interface{}{},
		},
		"signature": []string{"placeholder_signature"},
	}

	txJSON, _ := json.Marshal(signedTx)
	return string(txJSON), nil
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

	// Select a payment option (prefer TRON if available)
	var selectedOption *t402.PaymentRequirements
	for _, opt := range paymentRequired.Accepts {
		network := string(opt.Network)
		if network == "tron:mainnet" || network == "tron:nile" || network == "tron:shasta" {
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

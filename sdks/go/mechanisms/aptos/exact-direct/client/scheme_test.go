package client

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientAptosSigner for testing
type mockClientSigner struct {
	address         string
	returnedTxHash  string
	returnedErr     error
	lastPayload     aptos.TransactionPayload
	lastNetwork     t402.Network
	callCount       int
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) SignAndSubmitTransaction(
	ctx context.Context,
	payload aptos.TransactionPayload,
	network t402.Network,
) (string, error) {
	m.callCount++
	m.lastPayload = payload
	m.lastNetwork = network
	return m.returnedTxHash, m.returnedErr
}

const (
	validAddress    = "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb"
	validPayTo      = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
	validAsset      = "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb"
	validTxHash     = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
)

func TestExactDirectAptosScheme_Scheme(t *testing.T) {
	signer := &mockClientSigner{address: validAddress}
	scheme := NewExactDirectAptosScheme(signer)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("expected scheme 'exact-direct', got '%s'", scheme.Scheme())
	}
}

func TestExactDirectAptosScheme_CreatePaymentPayload(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockClientSigner
		requirements types.PaymentRequirements
		wantErr      bool
		errContains  string
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner)
	}{
		{
			name: "valid payment on mainnet",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.T402Version != 2 {
					t.Errorf("expected t402Version 2, got %d", payload.T402Version)
				}
				if payload.Payload == nil {
					t.Fatal("expected non-nil payload")
				}
				if payload.Payload["txHash"] != validTxHash {
					t.Errorf("expected txHash '%s', got '%v'", validTxHash, payload.Payload["txHash"])
				}
				if payload.Payload["from"] != validAddress {
					t.Errorf("expected from '%s', got '%v'", validAddress, payload.Payload["from"])
				}
				if payload.Payload["to"] != validPayTo {
					t.Errorf("expected to '%s', got '%v'", validPayTo, payload.Payload["to"])
				}
				if payload.Payload["amount"] != "1000000" {
					t.Errorf("expected amount '1000000', got '%v'", payload.Payload["amount"])
				}
				if payload.Payload["metadataAddress"] != validAsset {
					t.Errorf("expected metadataAddress '%s', got '%v'", validAsset, payload.Payload["metadataAddress"])
				}
			},
		},
		{
			name: "valid payment on testnet",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:2",
				Asset:   validAsset,
				Amount:  "5000000",
				PayTo:   validPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastNetwork != "aptos:2" {
					t.Errorf("expected network 'aptos:2', got '%s'", signer.lastNetwork)
				}
				if payload.Payload["amount"] != "5000000" {
					t.Errorf("expected amount '5000000', got '%v'", payload.Payload["amount"])
				}
			},
		},
		{
			name: "constructs correct transaction payload",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "2500000",
				PayTo:   validPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastPayload.Type != "entry_function_payload" {
					t.Errorf("expected type 'entry_function_payload', got '%s'", signer.lastPayload.Type)
				}
				if signer.lastPayload.Function != aptos.FATransferFunction {
					t.Errorf("expected function '%s', got '%s'", aptos.FATransferFunction, signer.lastPayload.Function)
				}
				if len(signer.lastPayload.TypeArguments) != 0 {
					t.Errorf("expected 0 type arguments, got %d", len(signer.lastPayload.TypeArguments))
				}
				if len(signer.lastPayload.Arguments) != 3 {
					t.Fatalf("expected 3 arguments, got %d", len(signer.lastPayload.Arguments))
				}
				if signer.lastPayload.Arguments[0] != validAsset {
					t.Errorf("expected argument[0] (metadata) '%s', got '%v'", validAsset, signer.lastPayload.Arguments[0])
				}
				if signer.lastPayload.Arguments[1] != validPayTo {
					t.Errorf("expected argument[1] (recipient) '%s', got '%v'", validPayTo, signer.lastPayload.Arguments[1])
				}
				if signer.lastPayload.Arguments[2] != "2500000" {
					t.Errorf("expected argument[2] (amount) '2500000', got '%v'", signer.lastPayload.Arguments[2])
				}
			},
		},
		{
			name: "wrong scheme",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid scheme",
		},
		{
			name: "unsupported network namespace",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid network",
		},
		{
			name: "unsupported aptos network",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:999",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "unsupported network",
		},
		{
			name: "invalid payTo address",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   "invalid-address",
			},
			wantErr:     true,
			errContains: "invalid payTo address",
		},
		{
			name: "empty payTo address",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   "",
			},
			wantErr:     true,
			errContains: "invalid payTo address",
		},
		{
			name: "empty asset",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   "",
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "asset (FA metadata address) is required",
		},
		{
			name: "invalid asset address",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   "not-an-address",
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid asset address",
		},
		{
			name: "empty amount",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "amount is required",
		},
		{
			name: "invalid amount format",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "not-a-number",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "zero amount",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "0",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "amount must be positive",
		},
		{
			name: "negative amount",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "-1000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "amount must be positive",
		},
		{
			name: "signer returns error",
			signer: &mockClientSigner{
				address:     validAddress,
				returnedErr: fmt.Errorf("network timeout"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "failed to sign and submit transaction",
		},
		{
			name: "signer returns invalid tx hash",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: "invalid-hash",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid transaction hash",
		},
		{
			name: "signer returns short tx hash",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: "0x1234",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid transaction hash",
		},
		{
			name: "invalid signer address",
			signer: &mockClientSigner{
				address:        "invalid-signer",
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr:     true,
			errContains: "invalid signer address",
		},
		{
			name: "large amount",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   validAsset,
				Amount:  "999999999999999999",
				PayTo:   validPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["amount"] != "999999999999999999" {
					t.Errorf("expected large amount, got '%v'", payload.Payload["amount"])
				}
			},
		},
		{
			name: "devnet network",
			signer: &mockClientSigner{
				address:        validAddress,
				returnedTxHash: validTxHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:149",
				Asset:   validAsset,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastNetwork != "aptos:149" {
					t.Errorf("expected network 'aptos:149', got '%s'", signer.lastNetwork)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectAptosScheme(tt.signer)

			payload, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" {
					if got := err.Error(); !contains(got, tt.errContains) {
						t.Errorf("expected error containing '%s', got '%s'", tt.errContains, got)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.validate != nil {
				tt.validate(t, payload, tt.signer)
			}
		})
	}
}

func TestExactDirectAptosScheme_CreatePaymentPayload_CallCount(t *testing.T) {
	signer := &mockClientSigner{
		address:        validAddress,
		returnedTxHash: validTxHash,
	}
	scheme := NewExactDirectAptosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "aptos:1",
		Asset:   validAsset,
		Amount:  "1000000",
		PayTo:   validPayTo,
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if signer.callCount != 1 {
		t.Errorf("expected signer to be called once, got %d calls", signer.callCount)
	}
}

func TestNewExactDirectAptosScheme_Config(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		signer := &mockClientSigner{address: validAddress}
		scheme := NewExactDirectAptosScheme(signer)

		if scheme.config.VerifyTransfer != true {
			t.Error("expected default VerifyTransfer to be true")
		}
	})

	t.Run("custom config", func(t *testing.T) {
		signer := &mockClientSigner{address: validAddress}
		scheme := NewExactDirectAptosScheme(signer, &ExactDirectAptosClientConfig{
			VerifyTransfer: false,
		})

		if scheme.config.VerifyTransfer != false {
			t.Error("expected VerifyTransfer to be false")
		}
	})

	t.Run("nil config uses defaults", func(t *testing.T) {
		signer := &mockClientSigner{address: validAddress}
		scheme := NewExactDirectAptosScheme(signer, nil)

		if scheme.config.VerifyTransfer != true {
			t.Error("expected default VerifyTransfer to be true with nil config")
		}
	})
}

func TestExactDirectAptosScheme_ContextCancellation(t *testing.T) {
	signer := &mockClientSigner{
		address:     validAddress,
		returnedErr: context.Canceled,
	}
	scheme := NewExactDirectAptosScheme(signer)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "aptos:1",
		Asset:   validAsset,
		Amount:  "1000000",
		PayTo:   validPayTo,
	}

	_, err := scheme.CreatePaymentPayload(ctx, requirements)
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

// contains checks if a string contains a substring (case-sensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && searchString(s, substr)))
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

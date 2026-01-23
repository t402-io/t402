package client

import (
	"context"
	"fmt"
	"math/big"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientTezosSigner for testing
type mockClientSigner struct {
	address       string
	balance       string
	balanceErr    error
	opHash        string
	transferErr   error
	lastContract  string
	lastTokenID   int
	lastTo        string
	lastAmount    *big.Int
	lastNetwork   t402.Network
	transferCalls int
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) GetBalance(ctx context.Context, contractAddress string, tokenID int) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockClientSigner) Transfer(ctx context.Context, contractAddress string, tokenID int, to string, amount *big.Int, network t402.Network) (string, error) {
	m.transferCalls++
	m.lastContract = contractAddress
	m.lastTokenID = tokenID
	m.lastTo = to
	m.lastAmount = amount
	m.lastNetwork = network
	return m.opHash, m.transferErr
}

const (
	validTz1Address    = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
	validTz2Address    = "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m"
	validKT1Address    = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"
	validOpHash        = "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH"
	mainnetCAIP19Asset = "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
	ghostnetCAIP19Asset = "tezos:NetXnHfVqm9iesp/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
)

func TestExactDirectTezosScheme_Scheme(t *testing.T) {
	signer := &mockClientSigner{address: validTz1Address}
	scheme := NewExactDirectTezosScheme(signer)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("expected scheme 'exact-direct', got '%s'", scheme.Scheme())
	}
}

func TestExactDirectTezosScheme_CreatePaymentPayload(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockClientSigner
		config       *ExactDirectTezosClientConfig
		requirements types.PaymentRequirements
		wantErr      bool
		errContains  string
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner)
	}{
		{
			name: "successful transfer with CAIP-19 asset",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.T402Version != 2 {
					t.Errorf("expected t402Version 2, got %d", payload.T402Version)
				}
				if payload.Payload == nil {
					t.Fatal("expected non-nil payload")
				}
				if payload.Payload["opHash"] != validOpHash {
					t.Errorf("expected opHash '%s', got '%v'", validOpHash, payload.Payload["opHash"])
				}
				if payload.Payload["from"] != validTz1Address {
					t.Errorf("expected from '%s', got '%v'", validTz1Address, payload.Payload["from"])
				}
				if payload.Payload["to"] != validTz2Address {
					t.Errorf("expected to '%s', got '%v'", validTz2Address, payload.Payload["to"])
				}
				if payload.Payload["amount"] != "1000000" {
					t.Errorf("expected amount '1000000', got '%v'", payload.Payload["amount"])
				}
				if payload.Payload["contractAddress"] != validKT1Address {
					t.Errorf("expected contractAddress '%s', got '%v'", validKT1Address, payload.Payload["contractAddress"])
				}
				if payload.Payload["tokenId"] != 0 {
					t.Errorf("expected tokenId 0, got '%v'", payload.Payload["tokenId"])
				}

				// Verify signer was called correctly
				if signer.lastContract != validKT1Address {
					t.Errorf("expected contract '%s', got '%s'", validKT1Address, signer.lastContract)
				}
				if signer.lastTokenID != 0 {
					t.Errorf("expected tokenID 0, got %d", signer.lastTokenID)
				}
				if signer.lastTo != validTz2Address {
					t.Errorf("expected to '%s', got '%s'", validTz2Address, signer.lastTo)
				}
				expectedAmount := big.NewInt(1000000)
				if signer.lastAmount.Cmp(expectedAmount) != 0 {
					t.Errorf("expected amount %s, got %s", expectedAmount, signer.lastAmount)
				}
			},
		},
		{
			name: "successful transfer with simple asset format (KT1/tokenId)",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "10000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "2000000",
				PayTo:   validTz1Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["contractAddress"] != validKT1Address {
					t.Errorf("expected contractAddress '%s', got '%v'", validKT1Address, payload.Payload["contractAddress"])
				}
				if payload.Payload["tokenId"] != 0 {
					t.Errorf("expected tokenId 0, got '%v'", payload.Payload["tokenId"])
				}
			},
		},
		{
			name: "successful transfer with KT1-only asset (defaults token ID to 0)",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   validKT1Address,
				Amount:  "500000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastTokenID != 0 {
					t.Errorf("expected default tokenID 0, got %d", signer.lastTokenID)
				}
			},
		},
		{
			name: "ghostnet network",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXnHfVqm9iesp",
				Asset:   ghostnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if string(signer.lastNetwork) != "tezos:NetXnHfVqm9iesp" {
					t.Errorf("expected ghostnet network, got '%s'", signer.lastNetwork)
				}
			},
		},
		{
			name: "non-zero token ID",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/5",
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastTokenID != 5 {
					t.Errorf("expected tokenID 5, got %d", signer.lastTokenID)
				}
				if payload.Payload["tokenId"] != 5 {
					t.Errorf("expected tokenId 5 in payload, got '%v'", payload.Payload["tokenId"])
				}
			},
		},
		{
			name: "exact balance equal to amount",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "1000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["opHash"] != validOpHash {
					t.Errorf("expected opHash '%s', got '%v'", validOpHash, payload.Payload["opHash"])
				}
			},
		},
		{
			name: "skip balance check when configured",
			signer: &mockClientSigner{
				address:    validTz1Address,
				balance:    "0", // Zero balance but check disabled
				opHash:     validOpHash,
			},
			config: &ExactDirectTezosClientConfig{CheckBalance: false},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["opHash"] != validOpHash {
					t.Errorf("expected opHash '%s', got '%v'", validOpHash, payload.Payload["opHash"])
				}
			},
		},
		{
			name: "wrong scheme",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid scheme",
		},
		{
			name: "non-Tezos network",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid network",
		},
		{
			name: "invalid payTo address",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   "invalid-address",
			},
			wantErr:     true,
			errContains: "invalid payTo address",
		},
		{
			name: "empty amount",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "amount is required",
		},
		{
			name: "zero amount",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "0",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "negative amount",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "-1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "non-numeric amount",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "not-a-number",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "empty asset",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "",
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "asset is required",
		},
		{
			name: "invalid asset format",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "invalid-asset-format",
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid asset",
		},
		{
			name: "insufficient balance",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "500000", // Less than required 1000000
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "insufficient balance",
		},
		{
			name: "balance query error",
			signer: &mockClientSigner{
				address:    validTz1Address,
				balanceErr: fmt.Errorf("RPC connection failed"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "failed to get balance",
		},
		{
			name: "transfer execution error",
			signer: &mockClientSigner{
				address:     validTz1Address,
				balance:     "5000000",
				transferErr: fmt.Errorf("gas estimation failed"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "failed to execute transfer",
		},
		{
			name: "signer returns invalid op hash",
			signer: &mockClientSigner{
				address: validTz1Address,
				balance: "5000000",
				opHash:  "invalid-hash",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid operation hash",
		},
		{
			name: "invalid signer address",
			signer: &mockClientSigner{
				address: "invalid-signer",
				balance: "5000000",
				opHash:  validOpHash,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   mainnetCAIP19Asset,
				Amount:  "1000000",
				PayTo:   validTz2Address,
			},
			wantErr:     true,
			errContains: "invalid signer address",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var scheme *ExactDirectTezosScheme
			if tt.config != nil {
				scheme = NewExactDirectTezosScheme(tt.signer, tt.config)
			} else {
				scheme = NewExactDirectTezosScheme(tt.signer)
			}

			payload, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !containsStr(err.Error(), tt.errContains) {
					t.Errorf("expected error containing '%s', got '%s'", tt.errContains, err.Error())
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

func TestExactDirectTezosScheme_TransferCallCount(t *testing.T) {
	signer := &mockClientSigner{
		address: validTz1Address,
		balance: "5000000",
		opHash:  validOpHash,
	}
	scheme := NewExactDirectTezosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "tezos:NetXdQprcVkpaWU",
		Asset:   mainnetCAIP19Asset,
		Amount:  "1000000",
		PayTo:   validTz2Address,
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if signer.transferCalls != 1 {
		t.Errorf("expected 1 transfer call, got %d", signer.transferCalls)
	}
}

func TestNewExactDirectTezosScheme_Config(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		signer := &mockClientSigner{address: validTz1Address}
		scheme := NewExactDirectTezosScheme(signer)

		if scheme.config.CheckBalance != true {
			t.Error("expected default CheckBalance to be true")
		}
	})

	t.Run("custom config", func(t *testing.T) {
		signer := &mockClientSigner{address: validTz1Address}
		scheme := NewExactDirectTezosScheme(signer, &ExactDirectTezosClientConfig{
			CheckBalance: false,
		})

		if scheme.config.CheckBalance != false {
			t.Error("expected CheckBalance to be false")
		}
	})

	t.Run("nil config uses defaults", func(t *testing.T) {
		signer := &mockClientSigner{address: validTz1Address}
		scheme := NewExactDirectTezosScheme(signer, nil)

		if scheme.config.CheckBalance != true {
			t.Error("expected default CheckBalance to be true with nil config")
		}
	})
}

func TestExactDirectTezosScheme_ContextCancellation(t *testing.T) {
	signer := &mockClientSigner{
		address:     validTz1Address,
		balance:     "5000000",
		transferErr: context.Canceled,
	}
	scheme := NewExactDirectTezosScheme(signer)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "tezos:NetXdQprcVkpaWU",
		Asset:   mainnetCAIP19Asset,
		Amount:  "1000000",
		PayTo:   validTz2Address,
	}

	_, err := scheme.CreatePaymentPayload(ctx, requirements)
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

func TestExactDirectTezosScheme_LargeAmount(t *testing.T) {
	signer := &mockClientSigner{
		address: validTz1Address,
		balance: "999999999999999999",
		opHash:  validOpHash,
	}
	scheme := NewExactDirectTezosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "tezos:NetXdQprcVkpaWU",
		Asset:   mainnetCAIP19Asset,
		Amount:  "999999999999999999",
		PayTo:   validTz2Address,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.Payload["amount"] != "999999999999999999" {
		t.Errorf("expected large amount, got '%v'", payload.Payload["amount"])
	}
}

// containsStr checks if a string contains a substring
func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

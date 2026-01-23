package client

import (
	"context"
	"errors"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockSigner is a mock implementation of ClientNearSigner for testing
type mockSigner struct {
	accountID   string
	txHash      string
	err         error
	lastActions []near.Action
	lastNetwork string
}

func (m *mockSigner) AccountID() string {
	return m.accountID
}

func (m *mockSigner) SignAndSendTransaction(ctx context.Context, receiverID string, actions []near.Action, network string) (string, error) {
	m.lastActions = actions
	m.lastNetwork = network
	if m.err != nil {
		return "", m.err
	}
	return m.txHash, nil
}

func TestScheme(t *testing.T) {
	signer := &mockSigner{accountID: "alice.near"}
	scheme := NewExactDirectNearScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	tests := []struct {
		name         string
		accountID    string
		txHash       string
		requirements types.PaymentRequirements
		config       *ExactDirectNearClientConfig
		wantFrom     string
		wantTo       string
		wantAmount   string
		wantTxHash   string
	}{
		{
			name:      "mainnet USDT transfer",
			accountID: "alice.near",
			txHash:    "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			config:     nil,
			wantFrom:   "alice.near",
			wantTo:     "bob.near",
			wantAmount: "1000000",
			wantTxHash: "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		},
		{
			name:      "testnet USDC transfer",
			accountID: "alice.testnet",
			txHash:    "6c9HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:testnet",
				Asset:   "usdc.fakes.testnet",
				Amount:  "5000000",
				PayTo:   "bob.testnet",
			},
			config:     nil,
			wantFrom:   "alice.testnet",
			wantTo:     "bob.testnet",
			wantAmount: "5000000",
			wantTxHash: "6c9HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		},
		{
			name:      "with memo configuration",
			accountID: "sender.near",
			txHash:    "7d0HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "2000000",
				PayTo:   "merchant.near",
			},
			config: &ExactDirectNearClientConfig{
				Memo: "payment for service",
			},
			wantFrom:   "sender.near",
			wantTo:     "merchant.near",
			wantAmount: "2000000",
			wantTxHash: "7d0HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		},
		{
			name:      "with custom gas",
			accountID: "payer.near",
			txHash:    "8e1HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "10000000",
				PayTo:   "service.near",
			},
			config: &ExactDirectNearClientConfig{
				GasAmount: "50000000000000",
			},
			wantFrom:   "payer.near",
			wantTo:     "service.near",
			wantAmount: "10000000",
			wantTxHash: "8e1HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		},
		{
			name:      "implicit account (64 hex chars)",
			accountID: "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de",
			txHash:    "9f2HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "500000",
				PayTo:   "ab793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de",
			},
			config:     nil,
			wantFrom:   "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de",
			wantTo:     "ab793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de",
			wantAmount: "500000",
			wantTxHash: "9f2HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer := &mockSigner{
				accountID: tt.accountID,
				txHash:    tt.txHash,
			}
			scheme := NewExactDirectNearScheme(signer, tt.config)

			payload, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if err != nil {
				t.Fatalf("CreatePaymentPayload() error: %v", err)
			}

			// Verify t402 version
			if payload.T402Version != 2 {
				t.Errorf("T402Version = %v, want 2", payload.T402Version)
			}

			// Verify payload fields
			if payload.Payload["txHash"] != tt.wantTxHash {
				t.Errorf("Payload.txHash = %v, want %v", payload.Payload["txHash"], tt.wantTxHash)
			}
			if payload.Payload["from"] != tt.wantFrom {
				t.Errorf("Payload.from = %v, want %v", payload.Payload["from"], tt.wantFrom)
			}
			if payload.Payload["to"] != tt.wantTo {
				t.Errorf("Payload.to = %v, want %v", payload.Payload["to"], tt.wantTo)
			}
			if payload.Payload["amount"] != tt.wantAmount {
				t.Errorf("Payload.amount = %v, want %v", payload.Payload["amount"], tt.wantAmount)
			}

			// Verify that the correct network was passed to the signer
			if signer.lastNetwork != tt.requirements.Network {
				t.Errorf("SignAndSendTransaction network = %v, want %v", signer.lastNetwork, tt.requirements.Network)
			}
		})
	}
}

func TestCreatePaymentPayload_ActionStructure(t *testing.T) {
	signer := &mockSigner{
		accountID: "alice.near",
		txHash:    "txhash123",
	}
	scheme := NewExactDirectNearScheme(signer, nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	// Verify action structure
	if len(signer.lastActions) != 1 {
		t.Fatalf("Expected 1 action, got %d", len(signer.lastActions))
	}

	action := signer.lastActions[0]
	if action.FunctionCall == nil {
		t.Fatal("Expected FunctionCall action, got nil")
	}
	if action.FunctionCall.MethodName != "ft_transfer" {
		t.Errorf("MethodName = %v, want ft_transfer", action.FunctionCall.MethodName)
	}
	if action.FunctionCall.Deposit != "1" {
		t.Errorf("Deposit = %v, want 1 (yoctoNEAR)", action.FunctionCall.Deposit)
	}
	if action.FunctionCall.Gas != 30000000000000 {
		t.Errorf("Gas = %v, want 30000000000000", action.FunctionCall.Gas)
	}
}

func TestCreatePaymentPayload_CustomGas(t *testing.T) {
	signer := &mockSigner{
		accountID: "alice.near",
		txHash:    "txhash123",
	}
	config := &ExactDirectNearClientConfig{
		GasAmount: "50000000000000",
	}
	scheme := NewExactDirectNearScheme(signer, config)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if signer.lastActions[0].FunctionCall.Gas != 50000000000000 {
		t.Errorf("Gas = %v, want 50000000000000", signer.lastActions[0].FunctionCall.Gas)
	}
}

func TestCreatePaymentPayload_Errors(t *testing.T) {
	tests := []struct {
		name         string
		accountID    string
		txHash       string
		signerErr    error
		requirements types.PaymentRequirements
		wantErrMsg   string
	}{
		{
			name:      "unsupported network",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			wantErrMsg: "unsupported network",
		},
		{
			name:      "empty network",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			wantErrMsg: "unsupported network",
		},
		{
			name:      "missing asset",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			wantErrMsg: "asset (token contract address) is required",
		},
		{
			name:      "missing payTo",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "",
			},
			wantErrMsg: "payTo address is required",
		},
		{
			name:      "missing amount",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "",
				PayTo:   "bob.near",
			},
			wantErrMsg: "amount is required",
		},
		{
			name:      "invalid payTo account ID",
			accountID: "alice.near",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "x",
			},
			wantErrMsg: "invalid recipient account ID",
		},
		{
			name:      "invalid sender account ID",
			accountID: "x",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			wantErrMsg: "invalid sender account ID",
		},
		{
			name:      "signer error",
			accountID: "alice.near",
			signerErr: errors.New("network timeout"),
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "near:mainnet",
				Asset:   "usdt.tether-token.near",
				Amount:  "1000000",
				PayTo:   "bob.near",
			},
			wantErrMsg: "failed to execute ft_transfer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer := &mockSigner{
				accountID: tt.accountID,
				txHash:    tt.txHash,
				err:       tt.signerErr,
			}
			scheme := NewExactDirectNearScheme(signer, nil)

			_, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if err == nil {
				t.Fatal("Expected error, got nil")
			}
			if tt.wantErrMsg != "" && !contains(err.Error(), tt.wantErrMsg) {
				t.Errorf("Error = %v, want to contain %v", err.Error(), tt.wantErrMsg)
			}
		})
	}
}

func TestNewExactDirectNearScheme_DefaultConfig(t *testing.T) {
	signer := &mockSigner{accountID: "alice.near"}
	scheme := NewExactDirectNearScheme(signer, nil)

	if scheme.config.GasAmount != near.DefaultGas {
		t.Errorf("Default GasAmount = %v, want %v", scheme.config.GasAmount, near.DefaultGas)
	}
	if scheme.config.Memo != "" {
		t.Errorf("Default Memo = %v, want empty", scheme.config.Memo)
	}
}

func TestNewExactDirectNearScheme_CustomConfig(t *testing.T) {
	signer := &mockSigner{accountID: "alice.near"}
	config := &ExactDirectNearClientConfig{
		Memo:      "test memo",
		GasAmount: "50000000000000",
	}
	scheme := NewExactDirectNearScheme(signer, config)

	if scheme.config.GasAmount != "50000000000000" {
		t.Errorf("GasAmount = %v, want 50000000000000", scheme.config.GasAmount)
	}
	if scheme.config.Memo != "test memo" {
		t.Errorf("Memo = %v, want 'test memo'", scheme.config.Memo)
	}
}

func TestIsValidNetwork(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{"mainnet", "near:mainnet", true},
		{"testnet", "near:testnet", true},
		{"empty", "", false},
		{"evm network", "eip155:1", false},
		{"invalid", "near:devnet", false},
		{"partial", "near:", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isValidNetwork(tt.network); got != tt.want {
				t.Errorf("isValidNetwork(%v) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestIsValidAccountID(t *testing.T) {
	tests := []struct {
		name      string
		accountID string
		want      bool
	}{
		{"named account", "alice.near", true},
		{"named testnet", "alice.testnet", true},
		{"sub-account", "sub.alice.near", true},
		{"contract account", "usdt.tether-token.near", true},
		{"with hyphen", "my-account.near", true},
		{"with underscore", "my_account.near", true},
		{"implicit account (64 hex)", "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de", true},
		{"empty", "", false},
		{"single char", "x", false},
		{"too long", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false},
		{"no dot for named", "alice", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isValidAccountID(tt.accountID); got != tt.want {
				t.Errorf("isValidAccountID(%v) = %v, want %v", tt.accountID, got, tt.want)
			}
		})
	}
}

func TestParseGasToUint64(t *testing.T) {
	tests := []struct {
		name string
		gas  string
		want uint64
	}{
		{"default gas", "30000000000000", 30000000000000},
		{"custom gas", "50000000000000", 50000000000000},
		{"small gas", "1000", 1000},
		{"invalid chars", "abc", 30000000000000},
		{"mixed chars", "123abc", 30000000000000},
		{"empty", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseGasToUint64(tt.gas); got != tt.want {
				t.Errorf("parseGasToUint64(%v) = %v, want %v", tt.gas, got, tt.want)
			}
		})
	}
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

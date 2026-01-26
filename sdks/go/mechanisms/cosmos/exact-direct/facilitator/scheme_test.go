package facilitator

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

// MockCosmosSigner implements cosmos.FacilitatorCosmosSigner for testing
type MockCosmosSigner struct {
	addresses    map[string][]string
	transactions map[string]*cosmos.TransactionResult
	balances     map[string]map[string]string // address -> denom -> amount
}

func NewMockCosmosSigner() *MockCosmosSigner {
	return &MockCosmosSigner{
		addresses: map[string][]string{
			cosmos.NobleMainnetCAIP2: {"noble1facilitator"},
			cosmos.NobleTestnetCAIP2: {"noble1testfacilitator"},
		},
		transactions: make(map[string]*cosmos.TransactionResult),
		balances:     make(map[string]map[string]string),
	}
}

func (m *MockCosmosSigner) GetAddresses(ctx context.Context, network string) []string {
	return m.addresses[network]
}

func (m *MockCosmosSigner) QueryTransaction(ctx context.Context, network, txHash string) (*cosmos.TransactionResult, error) {
	if tx, ok := m.transactions[txHash]; ok {
		return tx, nil
	}
	return nil, nil
}

func (m *MockCosmosSigner) GetBalance(ctx context.Context, network, address, denom string) (string, error) {
	if addrBalances, ok := m.balances[address]; ok {
		if balance, ok := addrBalances[denom]; ok {
			return balance, nil
		}
	}
	return "0", nil
}

func (m *MockCosmosSigner) AddTransaction(txHash string, tx *cosmos.TransactionResult) {
	m.transactions[txHash] = tx
}

func TestNewExactDirectCosmosScheme(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
	if scheme.signer != signer {
		t.Error("signer not set correctly")
	}
	if scheme.config.MaxTransactionAge != 5*time.Minute {
		t.Errorf("MaxTransactionAge = %v, want 5m", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 24*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 24h", scheme.config.UsedTxCacheDuration)
	}
}

func TestNewExactDirectCosmosScheme_CustomConfig(t *testing.T) {
	signer := NewMockCosmosSigner()
	config := &ExactDirectCosmosSchemeConfig{
		MaxTransactionAge:   10 * time.Minute,
		UsedTxCacheDuration: 12 * time.Hour,
	}
	scheme := NewExactDirectCosmosScheme(signer, config)

	if scheme.config.MaxTransactionAge != 10*time.Minute {
		t.Errorf("MaxTransactionAge = %v, want 10m", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 12*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 12h", scheme.config.UsedTxCacheDuration)
	}
}

func TestExactDirectCosmosScheme_Scheme(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	if got := scheme.Scheme(); got != cosmos.SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", got, cosmos.SchemeExactDirect)
	}
}

func TestExactDirectCosmosScheme_CaipFamily(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	if got := scheme.CaipFamily(); got != "cosmos:*" {
		t.Errorf("CaipFamily() = %v, want cosmos:*", got)
	}
}

func TestExactDirectCosmosScheme_GetSigners(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	signers := scheme.GetSigners("cosmos:noble-1")
	if len(signers) != 1 {
		t.Fatalf("expected 1 signer, got %d", len(signers))
	}
	if signers[0] != "noble1facilitator" {
		t.Errorf("signer = %v, want noble1facilitator", signers[0])
	}
}

func TestExactDirectCosmosScheme_GetExtra(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	extra := scheme.GetExtra("cosmos:noble-1")
	if extra == nil {
		t.Fatal("expected non-nil extra")
	}
	if extra["assetSymbol"] != "USDC" {
		t.Errorf("assetSymbol = %v, want USDC", extra["assetSymbol"])
	}
	if extra["assetDecimals"] != 6 {
		t.Errorf("assetDecimals = %v, want 6", extra["assetDecimals"])
	}
	if extra["assetDenom"] != "uusdc" {
		t.Errorf("assetDenom = %v, want uusdc", extra["assetDenom"])
	}
}

func TestExactDirectCosmosScheme_GetExtra_UnknownNetwork(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	extra := scheme.GetExtra("cosmos:unknown")
	if extra != nil {
		t.Errorf("expected nil extra for unknown network, got %v", extra)
	}
}

func TestExactDirectCosmosScheme_Verify_Success(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	// Add a successful transaction
	msgSend := cosmos.MsgSend{
		Type:        cosmos.MsgTypeSend,
		FromAddress: "noble1sender",
		ToAddress:   "noble1receiver",
		Amount: []cosmos.Coin{
			{Denom: "uusdc", Amount: "1000000"},
		},
	}
	msgBytes, _ := json.Marshal(msgSend)

	signer.AddTransaction("tx123", &cosmos.TransactionResult{
		TxHash: "tx123",
		Code:   0,
		Tx: cosmos.TxWrapper{
			Body: cosmos.TxBody{
				Messages: []json.RawMessage{msgBytes},
			},
		},
	})

	payload := types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleMainnetCAIP2,
			Asset:   "uusdc",
			Amount:  "1000000",
			PayTo:   "noble1receiver",
		},
		Payload: map[string]interface{}{
			"txHash": "tx123",
			"from":   "noble1sender",
			"to":     "noble1receiver",
			"amount": "1000000",
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "uusdc",
		Amount:  "1000000",
		PayTo:   "noble1receiver",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if !resp.IsValid {
		t.Error("expected IsValid = true")
	}
	if resp.Payer != "noble1sender" {
		t.Errorf("Payer = %v, want noble1sender", resp.Payer)
	}
}

func TestExactDirectCosmosScheme_Verify_WrongScheme(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  "wrong-scheme",
			Network: cosmos.NobleMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Error("expected error for wrong scheme")
	}
}

func TestExactDirectCosmosScheme_Verify_NetworkMismatch(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleTestnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Error("expected error for network mismatch")
	}
}

func TestExactDirectCosmosScheme_Verify_MissingTxHash(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleMainnetCAIP2,
		},
		Payload: map[string]interface{}{
			"from": "noble1sender",
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Error("expected error for missing txHash")
	}
}

func TestExactDirectCosmosScheme_Verify_ReplayAttack(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	// Add a successful transaction
	msgSend := cosmos.MsgSend{
		Type:        cosmos.MsgTypeSend,
		FromAddress: "noble1sender",
		ToAddress:   "noble1receiver",
		Amount: []cosmos.Coin{
			{Denom: "uusdc", Amount: "1000000"},
		},
	}
	msgBytes, _ := json.Marshal(msgSend)

	signer.AddTransaction("tx123", &cosmos.TransactionResult{
		TxHash: "tx123",
		Code:   0,
		Tx: cosmos.TxWrapper{
			Body: cosmos.TxBody{
				Messages: []json.RawMessage{msgBytes},
			},
		},
	})

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleMainnetCAIP2,
		},
		Payload: map[string]interface{}{
			"txHash": "tx123",
			"from":   "noble1sender",
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "uusdc",
		Amount:  "1000000",
		PayTo:   "noble1receiver",
	}

	// First verification should succeed
	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("First Verify() error = %v", err)
	}

	// Second verification should fail (replay attack)
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Error("expected error for replay attack")
	}
}

func TestExactDirectCosmosScheme_Verify_InsufficientAmount(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	msgSend := cosmos.MsgSend{
		Type:        cosmos.MsgTypeSend,
		FromAddress: "noble1sender",
		ToAddress:   "noble1receiver",
		Amount: []cosmos.Coin{
			{Denom: "uusdc", Amount: "500000"}, // Less than required
		},
	}
	msgBytes, _ := json.Marshal(msgSend)

	signer.AddTransaction("tx456", &cosmos.TransactionResult{
		TxHash: "tx456",
		Code:   0,
		Tx: cosmos.TxWrapper{
			Body: cosmos.TxBody{
				Messages: []json.RawMessage{msgBytes},
			},
		},
	})

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleMainnetCAIP2,
		},
		Payload: map[string]interface{}{
			"txHash": "tx456",
			"from":   "noble1sender",
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "uusdc",
		Amount:  "1000000", // Required more than sent
		PayTo:   "noble1receiver",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Error("expected error for insufficient amount")
	}
}

func TestExactDirectCosmosScheme_Settle_Success(t *testing.T) {
	signer := NewMockCosmosSigner()
	scheme := NewExactDirectCosmosScheme(signer, nil)

	msgSend := cosmos.MsgSend{
		Type:        cosmos.MsgTypeSend,
		FromAddress: "noble1sender",
		ToAddress:   "noble1receiver",
		Amount: []cosmos.Coin{
			{Denom: "uusdc", Amount: "1000000"},
		},
	}
	msgBytes, _ := json.Marshal(msgSend)

	signer.AddTransaction("tx789", &cosmos.TransactionResult{
		TxHash: "tx789",
		Code:   0,
		Tx: cosmos.TxWrapper{
			Body: cosmos.TxBody{
				Messages: []json.RawMessage{msgBytes},
			},
		},
	})

	payload := types.PaymentPayload{
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: cosmos.NobleMainnetCAIP2,
		},
		Payload: map[string]interface{}{
			"txHash": "tx789",
			"from":   "noble1sender",
		},
	}

	requirements := types.PaymentRequirements{
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "uusdc",
		Amount:  "1000000",
		PayTo:   "noble1receiver",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error = %v", err)
	}
	if !resp.Success {
		t.Error("expected Success = true")
	}
	if resp.Transaction != "tx789" {
		t.Errorf("Transaction = %v, want tx789", resp.Transaction)
	}
	if resp.Payer != "noble1sender" {
		t.Errorf("Payer = %v, want noble1sender", resp.Payer)
	}
}

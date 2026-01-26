package client

import (
	"context"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
)

// MockCosmosSigner implements CosmosSigner for testing
type MockCosmosSigner struct {
	address   string
	txHash    string
	sendError error
}

func NewMockCosmosSigner(address, txHash string) *MockCosmosSigner {
	return &MockCosmosSigner{
		address: address,
		txHash:  txHash,
	}
}

func (m *MockCosmosSigner) GetAddress() string {
	return m.address
}

func (m *MockCosmosSigner) SendTokens(ctx context.Context, network, to, amount, denom string) (string, error) {
	if m.sendError != nil {
		return "", m.sendError
	}
	return m.txHash, nil
}

func (m *MockCosmosSigner) SetSendError(err error) {
	m.sendError = err
}

func TestNewExactDirectCosmosScheme(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
	if scheme.signer != signer {
		t.Error("signer not set correctly")
	}
}

func TestExactDirectCosmosScheme_Scheme(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	if got := scheme.Scheme(); got != cosmos.SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", got, cosmos.SchemeExactDirect)
	}
}

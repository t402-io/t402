package upto

import (
	"context"
	"fmt"
	"math/big"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements evm.FacilitatorEvmSigner for testing
type mockFacilitatorSigner struct {
	addresses           []string
	readContractResult  interface{}
	readContractErr     error
	verifyTypedDataResult bool
	verifyTypedDataErr  error
	writeContractResult string
	writeContractErr    error
	waitReceiptResult   *evm.TransactionReceipt
	waitReceiptErr      error
	balanceResult       *big.Int
	balanceErr          error
	chainIDResult       *big.Int
	chainIDErr          error
	codeResult          []byte
	codeErr             error

	// Tracking calls
	writeContractCalls []writeContractCall
	readContractCalls  []readContractCall
}

type writeContractCall struct {
	address      string
	functionName string
}

type readContractCall struct {
	address      string
	functionName string
}

func (m *mockFacilitatorSigner) GetAddresses() []string {
	return m.addresses
}

func (m *mockFacilitatorSigner) ReadContract(ctx context.Context, address string, abi []byte, functionName string, args ...interface{}) (interface{}, error) {
	m.readContractCalls = append(m.readContractCalls, readContractCall{address: address, functionName: functionName})
	return m.readContractResult, m.readContractErr
}

func (m *mockFacilitatorSigner) VerifyTypedData(ctx context.Context, address string, domain evm.TypedDataDomain, types map[string][]evm.TypedDataField, primaryType string, message map[string]interface{}, signature []byte) (bool, error) {
	return m.verifyTypedDataResult, m.verifyTypedDataErr
}

func (m *mockFacilitatorSigner) WriteContract(ctx context.Context, address string, abi []byte, functionName string, args ...interface{}) (string, error) {
	m.writeContractCalls = append(m.writeContractCalls, writeContractCall{address: address, functionName: functionName})
	return m.writeContractResult, m.writeContractErr
}

func (m *mockFacilitatorSigner) SendTransaction(ctx context.Context, to string, data []byte) (string, error) {
	return "", nil
}

func (m *mockFacilitatorSigner) WaitForTransactionReceipt(ctx context.Context, txHash string) (*evm.TransactionReceipt, error) {
	return m.waitReceiptResult, m.waitReceiptErr
}

func (m *mockFacilitatorSigner) GetBalance(ctx context.Context, address string, tokenAddress string) (*big.Int, error) {
	return m.balanceResult, m.balanceErr
}

func (m *mockFacilitatorSigner) GetChainID(ctx context.Context) (*big.Int, error) {
	return m.chainIDResult, m.chainIDErr
}

func (m *mockFacilitatorSigner) GetCode(ctx context.Context, address string) ([]byte, error) {
	return m.codeResult, m.codeErr
}

// createValidPermitPayload creates a valid EIP-2612 permit payload map for testing
func createValidPermitPayload(owner, spender string) map[string]interface{} {
	return map[string]interface{}{
		"signature": map[string]interface{}{
			"v": float64(28),
			"r": "0x0101010101010101010101010101010101010101010101010101010101010101",
			"s": "0x0202020202020202020202020202020202020202020202020202020202020202",
		},
		"authorization": map[string]interface{}{
			"owner":    owner,
			"spender":  spender,
			"value":    "1000000",
			"deadline": "9999999999",
			"nonce":    float64(0),
		},
		"paymentNonce": "0xabc123",
	}
}

func TestUptoEvmFacilitator_Scheme(t *testing.T) {
	signer := &mockFacilitatorSigner{addresses: []string{"0xFacilitator"}}
	facilitator := NewUptoEvmFacilitator(signer, nil)

	if facilitator.Scheme() != "upto" {
		t.Errorf("expected scheme 'upto', got '%s'", facilitator.Scheme())
	}
}

func TestUptoEvmFacilitator_CaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{addresses: []string{"0xFacilitator"}}
	facilitator := NewUptoEvmFacilitator(signer, nil)

	if facilitator.CaipFamily() != "eip155:*" {
		t.Errorf("expected caipFamily 'eip155:*', got '%s'", facilitator.CaipFamily())
	}
}

func TestUptoEvmFacilitator_GetSigners(t *testing.T) {
	addresses := []string{"0xAddr1", "0xAddr2"}
	signer := &mockFacilitatorSigner{addresses: addresses}
	facilitator := NewUptoEvmFacilitator(signer, nil)

	signers := facilitator.GetSigners("eip155:8453")
	if len(signers) != 2 {
		t.Fatalf("expected 2 signers, got %d", len(signers))
	}
	if signers[0] != "0xAddr1" {
		t.Errorf("expected first signer '0xAddr1', got '%s'", signers[0])
	}
}

func TestUptoEvmFacilitator_GetExtra(t *testing.T) {
	t.Run("should return routerAddress when addresses exist", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{"0xRouter123"}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		extra := facilitator.GetExtra("eip155:8453")
		if extra == nil {
			t.Fatal("expected non-nil extra")
		}
		if extra["routerAddress"] != "0xRouter123" {
			t.Errorf("expected routerAddress '0xRouter123', got '%v'", extra["routerAddress"])
		}
	})

	t.Run("should return nil when no addresses", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		extra := facilitator.GetExtra("eip155:8453")
		if extra != nil {
			t.Errorf("expected nil extra, got '%v'", extra)
		}
	})
}

func TestUptoEvmFacilitator_Verify(t *testing.T) {
	facilitatorAddr := "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"

	t.Run("should verify valid permit payload", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0), // nonce = 0
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000), // 10 USDC
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		resp, err := facilitator.Verify(context.Background(), payload, requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.IsValid {
			t.Error("expected IsValid to be true")
		}
		if resp.Payer != ownerAddr {
			t.Errorf("expected payer '%s', got '%s'", ownerAddr, resp.Payer)
		}
	})

	t.Run("should fail for invalid scheme", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{facilitatorAddr}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload("0x1234567890123456789012345678901234567890", facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "exact", // Wrong scheme
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for invalid scheme")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "invalid_scheme" {
			t.Errorf("expected reason 'invalid_scheme', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for network mismatch", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{facilitatorAddr}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload("0x1234567890123456789012345678901234567890", facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:1", // Different network
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for network mismatch")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "network_mismatch" {
			t.Errorf("expected reason 'network_mismatch', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for missing signature", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{facilitatorAddr}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payloadMap := createValidPermitPayload("0x1234567890123456789012345678901234567890", facilitatorAddr)
		// Remove R from signature
		sig := payloadMap["signature"].(map[string]interface{})
		sig["r"] = ""

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     payloadMap,
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for missing signature")
		}
	})

	t.Run("should fail for invalid spender", func(t *testing.T) {
		signer := &mockFacilitatorSigner{addresses: []string{facilitatorAddr}}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		// Spender is not the facilitator address
		payloadMap := createValidPermitPayload(
			"0x1234567890123456789012345678901234567890",
			"0xWrongSpender12345678901234567890abcdef12",
		)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     payloadMap,
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for invalid spender")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "invalid_spender" {
			t.Errorf("expected reason 'invalid_spender', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for insufficient approved amount", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:          []string{facilitatorAddr},
			readContractResult: big.NewInt(0), // nonce = 0
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		// Approved value is 1000000, but required is 5000000
		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "5000000", // More than approved 1000000
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for insufficient approved amount")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "insufficient_approved_amount" {
			t.Errorf("expected reason 'insufficient_approved_amount', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for invalid nonce", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:          []string{facilitatorAddr},
			readContractResult: big.NewInt(5), // On-chain nonce is 5, but payload has 0
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for invalid nonce")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "invalid_nonce" {
			t.Errorf("expected reason 'invalid_nonce', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for insufficient balance", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:          []string{facilitatorAddr},
			readContractResult: big.NewInt(0),
			balanceResult:      big.NewInt(500000), // Only 0.5 USDC, need 1 USDC
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for insufficient balance")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "insufficient_balance" {
			t.Errorf("expected reason 'insufficient_balance', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should fail for invalid signature", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			balanceResult:         big.NewInt(10000000),
			verifyTypedDataResult: false, // Invalid signature
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Verify(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for invalid signature")
		}

		verifyErr, ok := err.(*t402.VerifyError)
		if !ok {
			t.Fatalf("expected VerifyError, got %T", err)
		}
		if verifyErr.Reason != "invalid_signature" {
			t.Errorf("expected reason 'invalid_signature', got '%s'", verifyErr.Reason)
		}
	})

	t.Run("should use token info from extra", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
			Extra: map[string]interface{}{
				"name":    "Custom Token",
				"version": "3",
			},
		}

		resp, err := facilitator.Verify(context.Background(), payload, requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.IsValid {
			t.Error("expected IsValid to be true")
		}
	})
}

func TestUptoEvmFacilitator_Settle(t *testing.T) {
	facilitatorAddr := "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"

	t.Run("should settle valid payment with permit + transferFrom", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
			writeContractResult:   "0xTxHash123",
			waitReceiptResult: &evm.TransactionReceipt{
				Status: evm.TxStatusSuccess,
				TxHash: "0xTxHash123",
			},
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		resp, err := facilitator.Settle(context.Background(), payload, requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.Success {
			t.Error("expected Success to be true")
		}
		if resp.Transaction != "0xTxHash123" {
			t.Errorf("expected transaction '0xTxHash123', got '%s'", resp.Transaction)
		}
		if resp.Payer != ownerAddr {
			t.Errorf("expected payer '%s', got '%s'", ownerAddr, resp.Payer)
		}
		if resp.Network != "eip155:8453" {
			t.Errorf("expected network 'eip155:8453', got '%s'", resp.Network)
		}

		// Should have called WriteContract twice: permit + transferFrom
		if len(signer.writeContractCalls) != 2 {
			t.Fatalf("expected 2 WriteContract calls, got %d", len(signer.writeContractCalls))
		}
		if signer.writeContractCalls[0].functionName != FunctionPermit {
			t.Errorf("expected first call to be 'permit', got '%s'", signer.writeContractCalls[0].functionName)
		}
		if signer.writeContractCalls[1].functionName != FunctionTransferFrom {
			t.Errorf("expected second call to be 'transferFrom', got '%s'", signer.writeContractCalls[1].functionName)
		}
	})

	t.Run("should settle full approved amount when configured", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
			writeContractResult:   "0xTxHash456",
			waitReceiptResult: &evm.TransactionReceipt{
				Status: evm.TxStatusSuccess,
				TxHash: "0xTxHash456",
			},
		}

		config := &UptoEvmFacilitatorConfig{SettleFullAmount: true}
		facilitator := NewUptoEvmFacilitator(signer, config)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "500000", // Required is 0.5, but approved is 1.0
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		resp, err := facilitator.Settle(context.Background(), payload, requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.Success {
			t.Error("expected Success to be true")
		}
	})

	t.Run("should fail when verification fails", func(t *testing.T) {
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: false, // Signature invalid
			balanceResult:         big.NewInt(10000000),
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload("0x1234567890123456789012345678901234567890", facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Settle(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error when verification fails")
		}

		settleErr, ok := err.(*t402.SettleError)
		if !ok {
			t.Fatalf("expected SettleError, got %T", err)
		}
		if settleErr.Reason != "invalid_signature" {
			t.Errorf("expected reason 'invalid_signature', got '%s'", settleErr.Reason)
		}
	})

	t.Run("should fail when permit transaction fails", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
			writeContractErr:      fmt.Errorf("permit reverted"),
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Settle(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error when permit fails")
		}

		settleErr, ok := err.(*t402.SettleError)
		if !ok {
			t.Fatalf("expected SettleError, got %T", err)
		}
		if settleErr.Reason != "failed_to_execute_permit" {
			t.Errorf("expected reason 'failed_to_execute_permit', got '%s'", settleErr.Reason)
		}
	})

	t.Run("should fail when permit receipt shows failure", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
			writeContractResult:   "0xPermitTx",
			waitReceiptResult: &evm.TransactionReceipt{
				Status: evm.TxStatusFailed,
				TxHash: "0xPermitTx",
			},
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Settle(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error when permit tx fails on-chain")
		}

		settleErr, ok := err.(*t402.SettleError)
		if !ok {
			t.Fatalf("expected SettleError, got %T", err)
		}
		if settleErr.Reason != "permit_transaction_failed" {
			t.Errorf("expected reason 'permit_transaction_failed', got '%s'", settleErr.Reason)
		}
	})

	t.Run("should fail for invalid settle amount", func(t *testing.T) {
		ownerAddr := "0x1234567890123456789012345678901234567890"
		signer := &mockFacilitatorSigner{
			addresses:             []string{facilitatorAddr},
			readContractResult:    big.NewInt(0),
			verifyTypedDataResult: true,
			balanceResult:         big.NewInt(10000000),
		}
		facilitator := NewUptoEvmFacilitator(signer, nil)

		payload := types.PaymentPayload{
			T402Version: 2,
			Payload:     createValidPermitPayload(ownerAddr, facilitatorAddr),
			Accepted: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
			},
		}

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "not-a-number", // Invalid
			PayTo:   "0xPayToAddress12345678901234567890abcdef",
		}

		_, err := facilitator.Settle(context.Background(), payload, requirements)
		if err == nil {
			t.Fatal("expected error for invalid settle amount")
		}
	})
}

func TestUptoEvmFacilitator_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{addresses: []string{"0xAddr"}}
	facilitator := NewUptoEvmFacilitator(signer, nil)

	if facilitator.config.SettleFullAmount {
		t.Error("expected SettleFullAmount to be false by default")
	}
}

func TestHashPermitAuthorization(t *testing.T) {
	t.Run("should produce consistent hash", func(t *testing.T) {
		auth := PermitAuthorization{
			Owner:    "0x1234567890123456789012345678901234567890",
			Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Value:    "1000000",
			Deadline: "1740675689",
			Nonce:    0,
		}

		hash1, err := HashPermitAuthorization(auth, big.NewInt(8453), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		hash2, err := HashPermitAuthorization(auth, big.NewInt(8453), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(hash1) != 32 {
			t.Errorf("expected 32-byte hash, got %d bytes", len(hash1))
		}

		// Same inputs should produce same hash
		for i := range hash1 {
			if hash1[i] != hash2[i] {
				t.Errorf("hash mismatch at byte %d", i)
				break
			}
		}
	})

	t.Run("should produce different hash for different values", func(t *testing.T) {
		auth1 := PermitAuthorization{
			Owner:    "0x1234567890123456789012345678901234567890",
			Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Value:    "1000000",
			Deadline: "1740675689",
			Nonce:    0,
		}

		auth2 := PermitAuthorization{
			Owner:    "0x1234567890123456789012345678901234567890",
			Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Value:    "2000000", // Different value
			Deadline: "1740675689",
			Nonce:    0,
		}

		hash1, err := HashPermitAuthorization(auth1, big.NewInt(8453), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		hash2, err := HashPermitAuthorization(auth2, big.NewInt(8453), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		same := true
		for i := range hash1 {
			if hash1[i] != hash2[i] {
				same = false
				break
			}
		}
		if same {
			t.Error("expected different hashes for different values")
		}
	})

	t.Run("should produce different hash for different chains", func(t *testing.T) {
		auth := PermitAuthorization{
			Owner:    "0x1234567890123456789012345678901234567890",
			Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Value:    "1000000",
			Deadline: "1740675689",
			Nonce:    0,
		}

		hash1, err := HashPermitAuthorization(auth, big.NewInt(1), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		hash2, err := HashPermitAuthorization(auth, big.NewInt(8453), "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "2")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		same := true
		for i := range hash1 {
			if hash1[i] != hash2[i] {
				same = false
				break
			}
		}
		if same {
			t.Error("expected different hashes for different chains")
		}
	})
}

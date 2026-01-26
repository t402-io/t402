package facilitator

import (
	"context"
	"math/big"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockEvmSigner implements FacilitatorEvmSigner for testing
type mockEvmSigner struct {
	addresses  []string
	readResult interface{}
	readErr    error
	writeHash  string
	writeErr   error
	verifyOK   bool
	verifyErr  error
	receipt    *evm.TransactionReceipt
	receiptErr error
	balance    *big.Int
	balanceErr error
	chainID    *big.Int
	chainIDErr error
	code       []byte
	codeErr    error
	sendHash   string
	sendErr    error
}

func (m *mockEvmSigner) GetAddresses() []string                    { return m.addresses }
func (m *mockEvmSigner) GetChainID(_ context.Context) (*big.Int, error) { return m.chainID, m.chainIDErr }
func (m *mockEvmSigner) GetCode(_ context.Context, _ string) ([]byte, error) { return m.code, m.codeErr }
func (m *mockEvmSigner) SendTransaction(_ context.Context, _ string, _ []byte) (string, error) {
	return m.sendHash, m.sendErr
}

func (m *mockEvmSigner) ReadContract(_ context.Context, _ string, _ []byte, _ string, _ ...interface{}) (interface{}, error) {
	return m.readResult, m.readErr
}

func (m *mockEvmSigner) VerifyTypedData(_ context.Context, _ string, _ evm.TypedDataDomain, _ map[string][]evm.TypedDataField, _ string, _ map[string]interface{}, _ []byte) (bool, error) {
	return m.verifyOK, m.verifyErr
}

func (m *mockEvmSigner) WriteContract(_ context.Context, _ string, _ []byte, _ string, _ ...interface{}) (string, error) {
	return m.writeHash, m.writeErr
}

func (m *mockEvmSigner) WaitForTransactionReceipt(_ context.Context, _ string) (*evm.TransactionReceipt, error) {
	return m.receipt, m.receiptErr
}

func (m *mockEvmSigner) GetBalance(_ context.Context, _ string, _ string) (*big.Int, error) {
	return m.balance, m.balanceErr
}

func TestScheme(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	if scheme.Scheme() != "exact-legacy" {
		t.Errorf("Scheme() = %v, want exact-legacy", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	if scheme.CaipFamily() != "eip155:*" {
		t.Errorf("CaipFamily() = %v, want eip155:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator1", "0xFacilitator2"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	signers := scheme.GetSigners(t402.Network("eip155:1"))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	extra := scheme.GetExtra(t402.Network("eip155:1"))
	if extra == nil {
		t.Fatal("GetExtra() returned nil")
	}
	if extra["spender"] != "0xFacilitator" {
		t.Errorf("extra.spender = %v, want 0xFacilitator", extra["spender"])
	}
	if extra["tokenType"] != "legacy" {
		t.Errorf("extra.tokenType = %v, want legacy", extra["tokenType"])
	}
}

func TestVerify_InvalidScheme(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:1",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_scheme" {
		t.Errorf("Reason = %v, want invalid_scheme", ve.Reason)
	}
}

func TestVerify_NetworkMismatch(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExactLegacy,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "network_mismatch" {
		t.Errorf("Reason = %v, want network_mismatch", ve.Reason)
	}
}

func TestVerify_MissingSignature(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
				"spender":     "0xFacilitator",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExactLegacy,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:1",
		Asset:   "USDT",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "missing_signature" {
		t.Errorf("Reason = %v, want missing_signature", ve.Reason)
	}
}

func TestVerify_SpenderNotFacilitator(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
				"spender":     "0xMaliciousSpender",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExactLegacy,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:1",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_spender" {
		t.Errorf("Reason = %v, want invalid_spender", ve.Reason)
	}
}

func TestVerify_RecipientMismatch(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
		balance:   big.NewInt(2000000),
		verifyOK:  true,
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xWrongRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
				"spender":     "0xFacilitator",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExactLegacy,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:1",
		PayTo:   "0xCorrectRecipient",
		Amount:  "1000000",
		Asset:   "USDT",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "recipient_mismatch" {
		t.Errorf("Reason = %v, want recipient_mismatch", ve.Reason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := &mockEvmSigner{
		addresses:  []string{"0xFacilitator"},
		balance:    big.NewInt(2000000),
		verifyOK:   true,
		readResult: big.NewInt(2000000), // allowance check
	}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "500000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
				"spender":     "0xFacilitator",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExactLegacy,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:1",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "insufficient_amount" {
		t.Errorf("Reason = %v, want insufficient_amount", ve.Reason)
	}
}

func TestNewExactLegacyEvmScheme_DefaultConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactLegacyEvmScheme(signer, nil)

	if scheme.config.MinAllowanceRatio != 1.0 {
		t.Errorf("MinAllowanceRatio = %v, want 1.0", scheme.config.MinAllowanceRatio)
	}
}

func TestNewExactLegacyEvmScheme_CustomConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactLegacyEvmScheme(signer, &ExactLegacyEvmSchemeConfig{
		MinAllowanceRatio: 0.9,
	})

	if scheme.config.MinAllowanceRatio != 0.9 {
		t.Errorf("MinAllowanceRatio = %v, want 0.9", scheme.config.MinAllowanceRatio)
	}
}

// TestCalculateMinAllowance tests the calculateMinAllowance function for precision
func TestCalculateMinAllowance(t *testing.T) {
	tests := []struct {
		name           string
		requiredAmount *big.Int
		minRatio       float64
		expected       *big.Int
	}{
		{
			name:           "normal ratio 1.0",
			requiredAmount: big.NewInt(1000000),
			minRatio:       1.0,
			expected:       big.NewInt(1000000),
		},
		{
			name:           "ratio 0.9",
			requiredAmount: big.NewInt(1000000),
			minRatio:       0.9,
			expected:       big.NewInt(900000),
		},
		{
			name:           "ratio 0.5",
			requiredAmount: big.NewInt(1000000),
			minRatio:       0.5,
			expected:       big.NewInt(500000),
		},
		{
			name:           "ratio 0.0 returns 0",
			requiredAmount: big.NewInt(1000000),
			minRatio:       0.0,
			expected:       big.NewInt(0),
		},
		{
			name:           "negative ratio returns 0",
			requiredAmount: big.NewInt(1000000),
			minRatio:       -0.5,
			expected:       big.NewInt(0),
		},
		{
			name:           "nil amount returns 0",
			requiredAmount: nil,
			minRatio:       1.0,
			expected:       big.NewInt(0),
		},
		{
			name:           "zero amount returns 0",
			requiredAmount: big.NewInt(0),
			minRatio:       1.0,
			expected:       big.NewInt(0),
		},
		{
			name:           "ratio > 1.0 returns full amount",
			requiredAmount: big.NewInt(1000000),
			minRatio:       1.5,
			expected:       big.NewInt(1000000),
		},
		{
			name:           "fractional result truncated",
			requiredAmount: big.NewInt(100),
			minRatio:       0.33,
			expected:       big.NewInt(33),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateMinAllowance(tt.requiredAmount, tt.minRatio)
			if result.Cmp(tt.expected) != 0 {
				t.Errorf("calculateMinAllowance(%v, %v) = %v, want %v",
					tt.requiredAmount, tt.minRatio, result, tt.expected)
			}
		})
	}
}

// TestCalculateMinAllowance_LargeValues tests precision for large values
// that would overflow int64 or lose precision with float64
func TestCalculateMinAllowance_LargeValues(t *testing.T) {
	// Create a value larger than 2^63-1 (max int64)
	// This would overflow if we used int64 conversion
	largeAmount, _ := new(big.Int).SetString("100000000000000000000000000", 10) // 10^26

	// Test with ratio 0.9
	expected, _ := new(big.Int).SetString("90000000000000000000000000", 10) // 9 * 10^25
	result := calculateMinAllowance(largeAmount, 0.9)

	if result.Cmp(expected) != 0 {
		t.Errorf("Large value precision test failed: got %v, want %v", result, expected)
	}

	// Test with ratio 0.5
	expected, _ = new(big.Int).SetString("50000000000000000000000000", 10) // 5 * 10^25
	result = calculateMinAllowance(largeAmount, 0.5)

	if result.Cmp(expected) != 0 {
		t.Errorf("Large value precision test (0.5) failed: got %v, want %v", result, expected)
	}

	// Test with a value that would lose precision in float64
	// float64 can only represent integers exactly up to 2^53
	precisionAmount, _ := new(big.Int).SetString("9007199254740993", 10) // 2^53 + 1
	expectedPrecision, _ := new(big.Int).SetString("8106479329266893", 10) // 9007199254740993 * 0.9 truncated

	result = calculateMinAllowance(precisionAmount, 0.9)

	// The result should be close to expected (within 1 due to truncation)
	diff := new(big.Int).Sub(result, expectedPrecision)
	diff.Abs(diff)
	if diff.Cmp(big.NewInt(1)) > 0 {
		t.Errorf("Precision test failed: got %v, want approximately %v (diff: %v)",
			result, expectedPrecision, diff)
	}
}

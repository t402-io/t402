package facilitator

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"testing"

	solana "github.com/gagliardetto/solana-go"
	computebudget "github.com/gagliardetto/solana-go/programs/compute-budget"
	"github.com/gagliardetto/solana-go/programs/token"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements upto.UptoFacilitatorSvmSigner for testing
type mockFacilitatorSigner struct {
	addresses       map[string][]solana.PublicKey
	signErr         error
	simulateErr     error
	sendSig         solana.Signature
	sendErr         error
	confirmErr      error
	tokenBalance    uint64
	tokenBalanceErr error
	delegateInfo    *upto.DelegateInfo
	delegateInfoErr error
	createTxResult  *solana.Transaction
	createTxErr     error
	recentBlockhash solana.Hash
	recentBhErr     error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []solana.PublicKey {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) SignTransaction(_ context.Context, _ *solana.Transaction, _ solana.PublicKey, _ string) error {
	return m.signErr
}

func (m *mockFacilitatorSigner) SimulateTransaction(_ context.Context, _ *solana.Transaction, _ string) error {
	return m.simulateErr
}

func (m *mockFacilitatorSigner) SendTransaction(_ context.Context, _ *solana.Transaction, _ string) (solana.Signature, error) {
	return m.sendSig, m.sendErr
}

func (m *mockFacilitatorSigner) ConfirmTransaction(_ context.Context, _ solana.Signature, _ string) error {
	return m.confirmErr
}

func (m *mockFacilitatorSigner) GetTokenBalance(_ context.Context, _ solana.PublicKey, _ string) (uint64, error) {
	return m.tokenBalance, m.tokenBalanceErr
}

func (m *mockFacilitatorSigner) GetDelegatedAmount(_ context.Context, _ solana.PublicKey, _ string) (*upto.DelegateInfo, error) {
	return m.delegateInfo, m.delegateInfoErr
}

func (m *mockFacilitatorSigner) CreateTransferTransaction(_ context.Context, _ upto.TransferParams) (*solana.Transaction, error) {
	return m.createTxResult, m.createTxErr
}

func (m *mockFacilitatorSigner) GetRecentBlockhash(_ context.Context, _ string) (solana.Hash, error) {
	return m.recentBlockhash, m.recentBhErr
}

// buildTestTransaction builds a valid approve transaction for testing
func buildTestTransaction(
	feePayer solana.PublicKey,
	owner solana.PublicKey,
	delegate solana.PublicKey,
	mint solana.PublicKey,
	sourceATA solana.PublicKey,
	amount uint64,
	decimals uint8,
) (*solana.Transaction, error) {
	cuLimit, err := computebudget.NewSetComputeUnitLimitInstructionBuilder().
		SetUnits(svm.DefaultComputeUnitLimit).
		ValidateAndBuild()
	if err != nil {
		return nil, err
	}

	cuPrice, err := computebudget.NewSetComputeUnitPriceInstructionBuilder().
		SetMicroLamports(svm.DefaultComputeUnitPriceMicrolamports).
		ValidateAndBuild()
	if err != nil {
		return nil, err
	}

	approveIx, err := token.NewApproveCheckedInstructionBuilder().
		SetAmount(amount).
		SetDecimals(decimals).
		SetSourceAccount(sourceATA).
		SetMintAccount(mint).
		SetDelegateAccount(delegate).
		SetOwnerAccount(owner).
		ValidateAndBuild()
	if err != nil {
		return nil, err
	}

	tx, err := solana.NewTransactionBuilder().
		AddInstruction(cuLimit).
		AddInstruction(cuPrice).
		AddInstruction(approveIx).
		SetRecentBlockHash(solana.Hash{}).
		SetFeePayer(feePayer).
		Build()
	if err != nil {
		return nil, err
	}

	return tx, nil
}

func encodeTransaction(tx *solana.Transaction) (string, error) {
	txBytes, err := tx.MarshalBinary()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(txBytes), nil
}

// Test fixtures
var (
	testFeePayer  = solana.MustPublicKeyFromBase58("BPFLoaderUpgradeab1e11111111111111111111111")
	testOwner     = solana.MustPublicKeyFromBase58("7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3")
	testMint      = solana.MustPublicKeyFromBase58("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
	testSourceATA = solana.MustPublicKeyFromBase58("3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ")
	testPayTo     = solana.MustPublicKeyFromBase58("11111111111111111111111111111111")
)

func newValidMockSigner() *mockFacilitatorSigner {
	// Build a valid transfer transaction for settlement
	dummyTx, _ := solana.NewTransactionBuilder().
		SetRecentBlockHash(solana.Hash{}).
		SetFeePayer(testFeePayer).
		Build()

	return &mockFacilitatorSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {testFeePayer},
		},
		tokenBalance:   10000000,
		createTxResult: dummyTx,
		sendSig:        solana.Signature{1, 2, 3, 4},
	}
}

func validPayloadMap(base64Tx string) map[string]interface{} {
	return map[string]interface{}{
		"transaction": base64Tx,
		"authorization": map[string]interface{}{
			"owner":     testOwner.String(),
			"delegate":  testFeePayer.String(),
			"mint":      testMint.String(),
			"maxAmount": "5000000",
			"sourceATA": testSourceATA.String(),
		},
		"paymentNonce": "0x1234567890abcdef",
	}
}

func validPayload(base64Tx string) types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: svm.SolanaMainnetCAIP2,
		},
		Payload: validPayloadMap(base64Tx),
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  "upto",
		Network: svm.SolanaMainnetCAIP2,
		PayTo:   testPayTo.String(),
		Amount:  "1000000",
		Asset:   testMint.String(),
		Extra: map[string]interface{}{
			"feePayer": testFeePayer.String(),
		},
	}
}

func mustBuildTestTx() (string, *solana.Transaction) {
	tx, err := buildTestTransaction(
		testFeePayer,
		testOwner,
		testFeePayer,
		testMint,
		testSourceATA,
		5000000,
		6,
	)
	if err != nil {
		panic(fmt.Sprintf("failed to build test transaction: %v", err))
	}
	encoded, err := encodeTransaction(tx)
	if err != nil {
		panic(fmt.Sprintf("failed to encode test transaction: %v", err))
	}
	return encoded, tx
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoSvmScheme(signer)

	if scheme.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoSvmScheme(signer)

	if scheme.CaipFamily() != "solana:*" {
		t.Errorf("CaipFamily() = %v, want solana:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	feePayer1 := solana.NewWallet().PublicKey()
	feePayer2 := solana.NewWallet().PublicKey()
	signer := &mockFacilitatorSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {feePayer1, feePayer2},
		},
	}
	scheme := NewUptoSvmScheme(signer)

	signers := scheme.GetSigners(t402.Network(svm.SolanaMainnetCAIP2))
	if len(signers) != 2 {
		t.Fatalf("GetSigners() returned %d addresses, want 2", len(signers))
	}
	if signers[0] != feePayer1.String() {
		t.Errorf("signers[0] = %v, want %v", signers[0], feePayer1.String())
	}
	if signers[1] != feePayer2.String() {
		t.Errorf("signers[1] = %v, want %v", signers[1], feePayer2.String())
	}
}

func TestGetSigners_EmptyNetwork(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]solana.PublicKey{},
	}
	scheme := NewUptoSvmScheme(signer)

	signers := scheme.GetSigners(t402.Network(svm.SolanaMainnetCAIP2))
	if len(signers) != 0 {
		t.Errorf("GetSigners() returned %d addresses, want 0", len(signers))
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {testFeePayer},
		},
	}
	scheme := NewUptoSvmScheme(signer)

	extra := scheme.GetExtra(t402.Network(svm.SolanaMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra() returned nil")
	}
	if _, ok := extra["feePayer"]; !ok {
		t.Error("GetExtra() should contain feePayer key")
	}
	if extra["feePayer"] != testFeePayer.String() {
		t.Errorf("GetExtra().feePayer = %v, want %v", extra["feePayer"], testFeePayer.String())
	}
}

func TestNewUptoSvmScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	if scheme == nil {
		t.Fatal("NewUptoSvmScheme returned nil")
	}
}

func TestNewUptoSvmScheme_WithConfig(t *testing.T) {
	signer := newValidMockSigner()
	config := &UptoSvmSchemeConfig{SettleFullAmount: true}
	scheme := NewUptoSvmScheme(signer, config)

	if scheme == nil {
		t.Fatal("NewUptoSvmScheme returned nil")
	}
	if scheme.config == nil {
		t.Fatal("Config should not be nil")
	}
	if !scheme.config.SettleFullAmount {
		t.Error("SettleFullAmount should be true")
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	requirements := validRequirements()

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Errorf("IsValid = false, InvalidReason: %s", resp.InvalidReason)
	}
	if resp.Payer == "" {
		t.Error("Payer should not be empty")
	}
	if resp.Payer != testOwner.String() {
		t.Errorf("Payer = %v, want %v", resp.Payer, testOwner.String())
	}
}

func TestVerify_WrongScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	payload.Accepted.Scheme = "exact"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "unsupported_scheme" {
		t.Errorf("InvalidReason = %v, want unsupported_scheme", resp.InvalidReason)
	}
}

func TestVerify_RequirementsSchemeMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	requirements := validRequirements()
	requirements.Scheme = "exact"

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "unsupported_scheme" {
		t.Errorf("InvalidReason = %v, want unsupported_scheme", resp.InvalidReason)
	}
}

func TestVerify_NetworkMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	payload.Accepted.Network = svm.SolanaDevnetCAIP2

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "network_mismatch" {
		t.Errorf("InvalidReason = %v, want network_mismatch", resp.InvalidReason)
	}
}

func TestVerify_UnsupportedNetwork(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	payload.Accepted.Network = "eip155:1"

	requirements := validRequirements()
	requirements.Network = "eip155:1"

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "unsupported_network" {
		t.Errorf("InvalidReason = %v, want unsupported_network", resp.InvalidReason)
	}
}

func TestVerify_MissingFeePayer(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	requirements := validRequirements()
	requirements.Extra = nil

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "missing_fee_payer" {
		t.Errorf("InvalidReason = %v, want missing_fee_payer", resp.InvalidReason)
	}
}

func TestVerify_FeePayerNotManaged(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	requirements := validRequirements()
	unmanagedAddr := solana.NewWallet().PublicKey().String()
	requirements.Extra["feePayer"] = unmanagedAddr

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "fee_payer_not_managed" {
		t.Errorf("InvalidReason = %v, want fee_payer_not_managed", resp.InvalidReason)
	}
}

func TestVerify_InvalidPayload(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: svm.SolanaMainnetCAIP2,
		},
	}

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_payload" {
		t.Errorf("InvalidReason = %v, want invalid_payload", resp.InvalidReason)
	}
}

func TestVerify_InvalidOwnerAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["owner"] = "invalid-solana-address!!!"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_owner_address" {
		t.Errorf("InvalidReason = %v, want invalid_owner_address", resp.InvalidReason)
	}
}

func TestVerify_InvalidDelegateAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["delegate"] = "invalid-solana-address!!!"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_delegate_address" {
		t.Errorf("InvalidReason = %v, want invalid_delegate_address", resp.InvalidReason)
	}
}

func TestVerify_InvalidDelegate(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	// Set delegate to a valid address but one that isn't managed by the facilitator
	wrongDelegate := solana.NewWallet().PublicKey().String()
	authMap["delegate"] = wrongDelegate

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_delegate" {
		t.Errorf("InvalidReason = %v, want invalid_delegate", resp.InvalidReason)
	}
}

func TestVerify_InvalidTransaction(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	payload := validPayload("not-valid-base64!!!")

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_transaction" {
		t.Errorf("InvalidReason = %v, want invalid_transaction", resp.InvalidReason)
	}
}

func TestVerify_InsufficientApprovedAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	// Build a transaction with approve amount 500000 matching the authorization
	tx, err := buildTestTransaction(
		testFeePayer, testOwner, testFeePayer, testMint, testSourceATA,
		500000, // amount matches authorization.maxAmount
		6,
	)
	if err != nil {
		t.Fatalf("failed to build test tx: %v", err)
	}
	base64Tx, err := encodeTransaction(tx)
	if err != nil {
		t.Fatalf("failed to encode tx: %v", err)
	}

	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["maxAmount"] = "500000" // Less than required 1000000, matches tx approve amount

	resp, verifyErr := scheme.Verify(context.Background(), payload, validRequirements())
	if verifyErr != nil {
		t.Fatalf("Verify() unexpected error: %v", verifyErr)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_approved_amount" {
		t.Errorf("InvalidReason = %v, want insufficient_approved_amount", resp.InvalidReason)
	}
}

func TestVerify_InvalidMaxAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	// Build a tx with amount 0 (which is what "not-a-number" parses to via ParseUint)
	tx, err := buildTestTransaction(
		testFeePayer, testOwner, testFeePayer, testMint, testSourceATA,
		0, // Matches what "not-a-number" parses to (0)
		6,
	)
	if err != nil {
		t.Fatalf("failed to build test tx: %v", err)
	}
	base64Tx, err := encodeTransaction(tx)
	if err != nil {
		t.Fatalf("failed to encode tx: %v", err)
	}

	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["maxAmount"] = "not-a-number"

	resp, verifyErr := scheme.Verify(context.Background(), payload, validRequirements())
	if verifyErr != nil {
		t.Fatalf("Verify() unexpected error: %v", verifyErr)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_max_amount" {
		t.Errorf("InvalidReason = %v, want invalid_max_amount", resp.InvalidReason)
	}
}

func TestVerify_InvalidRequiredAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	requirements := validRequirements()
	requirements.Amount = "not-a-number"

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_required_amount" {
		t.Errorf("InvalidReason = %v, want invalid_required_amount", resp.InvalidReason)
	}
}

func TestVerify_SourceATAMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	// Set sourceATA to a different valid address than what's in the transaction
	authMap["sourceATA"] = solana.NewWallet().PublicKey().String()

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	// verifyApproveInstruction catches the source mismatch
	if resp.InvalidReason != "source_mismatch" {
		t.Errorf("InvalidReason = %v, want source_mismatch", resp.InvalidReason)
	}
}

func TestVerify_InvalidSourceATAAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	// Invalid Solana address that doesn't match the tx source
	authMap["sourceATA"] = "invalid-solana-address!!!"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	// verifyApproveInstruction catches source mismatch before the PublicKeyFromBase58 check
	if resp.InvalidReason != "source_mismatch" {
		t.Errorf("InvalidReason = %v, want source_mismatch", resp.InvalidReason)
	}
}

func TestVerify_InsufficientBalance(t *testing.T) {
	signer := newValidMockSigner()
	signer.tokenBalance = 500000 // Less than required 1000000
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_balance" {
		t.Errorf("InvalidReason = %v, want insufficient_balance", resp.InvalidReason)
	}
}

func TestVerify_BalanceCheckFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.tokenBalanceErr = fmt.Errorf("RPC error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "balance_check_failed" {
		t.Errorf("Reason = %v, want balance_check_failed", ve.Reason)
	}
}

func TestVerify_SigningFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.signErr = fmt.Errorf("signing error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "signing_failed" {
		t.Errorf("Reason = %v, want signing_failed", ve.Reason)
	}
}

func TestVerify_SimulationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.simulateErr = fmt.Errorf("simulation error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "simulation_failed" {
		t.Errorf("Reason = %v, want simulation_failed", ve.Reason)
	}
}

func TestVerify_AssetMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["mint"] = solana.NewWallet().PublicKey().String() // Different mint

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	// The error comes from verifyApproveInstruction which checks mint_mismatch
	if resp.InvalidReason != "mint_mismatch" {
		t.Errorf("InvalidReason = %v, want mint_mismatch", resp.InvalidReason)
	}
}

func TestVerify_NonStringFeePayer(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	requirements := validRequirements()
	requirements.Extra["feePayer"] = 12345 // non-string

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_fee_payer" {
		t.Errorf("InvalidReason = %v, want invalid_fee_payer", resp.InvalidReason)
	}
}

func TestSettle_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	requirements := validRequirements()

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}
	if resp.Transaction == "" {
		t.Error("Transaction should not be empty")
	}
	if resp.Payer == "" {
		t.Error("Payer should not be empty")
	}
	if resp.Network != t402.Network(svm.SolanaMainnetCAIP2) {
		t.Errorf("Network = %v, want %v", resp.Network, svm.SolanaMainnetCAIP2)
	}
}

func TestSettle_VerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.signErr = fmt.Errorf("signing error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "signing_failed" {
		t.Errorf("Reason = %v, want signing_failed", se.Reason)
	}
}

func TestSettle_VerificationInvalid(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)
	payload.Accepted.Scheme = "exact" // Wrong scheme to trigger invalid verify

	resp, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false")
	}
	if resp.ErrorReason != "unsupported_scheme" {
		t.Errorf("ErrorReason = %v, want unsupported_scheme", resp.ErrorReason)
	}
}

func TestSettle_ApproveSigningFailed(t *testing.T) {
	// For Settle, signing happens twice: once during Verify and once for the approve tx broadcast.
	// We need the first sign (Verify) to succeed but the second (Settle) to fail.
	// Since the mock doesn't distinguish calls, we test with sign failing which makes
	// Verify fail and returns a SettleError.
	signer := newValidMockSigner()
	signer.signErr = fmt.Errorf("approve signing error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	// The error propagates from Verify as a SettleError
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if !strings.Contains(se.Reason, "signing_failed") {
		t.Errorf("Reason = %v, want to contain signing_failed", se.Reason)
	}
}

func TestSettle_SendFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.sendErr = fmt.Errorf("send error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "approve_send_failed" {
		t.Errorf("Reason = %v, want approve_send_failed", se.Reason)
	}
}

func TestSettle_ConfirmFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.confirmErr = fmt.Errorf("confirm error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "approve_confirmation_failed" {
		t.Errorf("Reason = %v, want approve_confirmation_failed", se.Reason)
	}
}

func TestSettle_TransferCreationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.createTxErr = fmt.Errorf("transfer creation error")
	scheme := NewUptoSvmScheme(signer)

	base64Tx, _ := mustBuildTestTx()
	payload := validPayload(base64Tx)

	_, err := scheme.Settle(context.Background(), payload, validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transfer_creation_failed" {
		t.Errorf("Reason = %v, want transfer_creation_failed", se.Reason)
	}
}

func TestSecureRandomIndex(t *testing.T) {
	// Test that secureRandomIndex handles edge cases
	if secureRandomIndex(0) != 0 {
		t.Error("secureRandomIndex(0) should return 0")
	}

	if secureRandomIndex(-1) != 0 {
		t.Error("secureRandomIndex(-1) should return 0")
	}

	// Test that secureRandomIndex returns values in range
	for i := 0; i < 100; i++ {
		idx := secureRandomIndex(5)
		if idx < 0 || idx >= 5 {
			t.Errorf("secureRandomIndex(5) returned %d, want 0-4", idx)
		}
	}

	// Test single element
	if secureRandomIndex(1) != 0 {
		t.Error("secureRandomIndex(1) should always return 0")
	}
}

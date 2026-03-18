// Package facilitator implements the Spark exact payment facilitator scheme.
//
// Verification:
//   - SPARK: Lookup transfer_id via SparkSigner, confirm amount/recipient/status
//   - LIGHTNING: Verify SHA256(preimage) === payment_hash, confirm receipt
//
// Settlement:
//   - Spark transfers have instant finality — settle is a confirmation no-op.
package facilitator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/spark"
	"github.com/t402-io/t402/sdks/go/types"
)

// SparkFacilitatorScheme implements the facilitator for Spark payments.
type SparkFacilitatorScheme struct {
	signer spark.SparkSigner
	// Replay protection: set of verified transfer IDs
	mu       sync.Mutex
	verified map[string]bool
}

// NewSparkFacilitatorScheme creates a new Spark facilitator scheme.
func NewSparkFacilitatorScheme(signer spark.SparkSigner) *SparkFacilitatorScheme {
	return &SparkFacilitatorScheme{
		signer:   signer,
		verified: make(map[string]bool),
	}
}

// Scheme returns the scheme identifier.
func (f *SparkFacilitatorScheme) Scheme() string {
	return spark.SchemeExact
}

// CaipFamily returns the CAIP family pattern.
func (f *SparkFacilitatorScheme) CaipFamily() string {
	return "spark:*"
}

// Verify verifies a Spark payment.
func (f *SparkFacilitatorScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	sparkPayload, err := spark.SparkPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_spark_payload", "", network, err)
	}

	switch sparkPayload.PaymentType {
	case spark.PaymentTypeSpark:
		return f.verifySpark(sparkPayload, requirements)
	case spark.PaymentTypeLightning:
		return f.verifyLightning(sparkPayload, requirements)
	default:
		return nil, t402.NewVerifyError("unsupported_payment_type", "", network,
			fmt.Errorf("unsupported payment type: %s", sparkPayload.PaymentType))
	}
}

// Settle acknowledges settlement. Spark has instant finality, so this is a no-op.
func (f *SparkFacilitatorScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(requirements.Network)

	// Verify first
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	sparkPayload, _ := spark.SparkPayloadFromMap(payload.Payload)
	txID := sparkPayload.TransferID
	if txID == "" {
		txID = sparkPayload.PaymentHash
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: txID,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

func (f *SparkFacilitatorScheme) verifySpark(
	payload *spark.SparkPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	if payload.TransferID == "" {
		return nil, t402.NewVerifyError("missing_transfer_id", "", network, nil)
	}

	// Replay protection
	f.mu.Lock()
	if f.verified[payload.TransferID] {
		f.mu.Unlock()
		return nil, t402.NewVerifyError("replay_detected", "", network,
			fmt.Errorf("transfer %s already verified", payload.TransferID))
	}
	f.verified[payload.TransferID] = true
	f.mu.Unlock()

	// Lookup transfer
	transfer, err := f.signer.GetTransfer(payload.TransferID)
	if err != nil {
		return nil, t402.NewVerifyError("transfer_not_found", "", network, err)
	}

	// Check status
	if transfer.Status != spark.TransferCompleted {
		return nil, t402.NewVerifyError("transfer_not_completed", "", network,
			fmt.Errorf("status: %d", transfer.Status))
	}

	// Check amount (requirements amount is in satoshis)
	requiredAmount, err := strconv.ParseInt(requirements.Amount, 10, 64)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_amount", "", network, err)
	}
	if transfer.Amount < requiredAmount {
		return nil, t402.NewVerifyError("insufficient_amount", "", network,
			fmt.Errorf("got %d, need %d", transfer.Amount, requiredAmount))
	}

	// Check recipient
	serverAddr := f.signer.GetAddress()
	if !strings.EqualFold(transfer.Receiver, serverAddr) {
		return nil, t402.NewVerifyError("wrong_recipient", "", network,
			fmt.Errorf("expected %s, got %s", serverAddr, transfer.Receiver))
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   transfer.Sender,
	}, nil
}

func (f *SparkFacilitatorScheme) verifyLightning(
	payload *spark.SparkPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	if payload.Preimage == "" || payload.PaymentHash == "" {
		return nil, t402.NewVerifyError("missing_lightning_proof", "", network, nil)
	}

	// Verify: SHA256(preimage) === paymentHash
	preimageBytes, err := hex.DecodeString(strings.TrimPrefix(payload.Preimage, "0x"))
	if err != nil {
		return nil, t402.NewVerifyError("invalid_preimage", "", network, err)
	}

	computedHash := sha256.Sum256(preimageBytes)
	computedHashHex := hex.EncodeToString(computedHash[:])
	expectedHash := strings.TrimPrefix(payload.PaymentHash, "0x")

	if computedHashHex != expectedHash {
		return nil, t402.NewVerifyError("preimage_mismatch", "", network,
			fmt.Errorf("SHA256(preimage) != paymentHash"))
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   "lightning:" + payload.PaymentHash[:16],
	}, nil
}

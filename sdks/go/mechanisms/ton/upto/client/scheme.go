// Package client implements the client role for TON upto payments.
package client

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoTonClient implements the SchemeNetworkClient interface for TON upto payments
type UptoTonClient struct {
	signer upto.UptoClientTonSigner
	config *ClientConfig
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	// Endpoint is a custom RPC endpoint
	Endpoint string

	// DefaultTimeout is the message validity duration in seconds
	DefaultTimeout int64

	// GasAmount is the TON amount for gas (in nanoTON)
	GasAmount uint64
}

// NewUptoTonClient creates a new UptoTonClient
func NewUptoTonClient(signer upto.UptoClientTonSigner, config ...*ClientConfig) *UptoTonClient {
	var cfg *ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	} else {
		cfg = &ClientConfig{
			DefaultTimeout: ton.DefaultValidityDuration,
			GasAmount:      ton.DefaultJettonTransferTon,
		}
	}
	return &UptoTonClient{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *UptoTonClient) Scheme() string {
	return upto.SchemeUpto
}

// CreatePaymentPayload creates an upto payment payload for TON
func (c *UptoTonClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	if !ton.IsValidNetwork(string(requirements.Network)) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate scheme
	if requirements.Scheme != upto.SchemeUpto {
		return types.PaymentPayload{}, fmt.Errorf("invalid scheme: expected %s, got %s", upto.SchemeUpto, requirements.Scheme)
	}

	// Get facilitator address from requirements
	extra := requirements.Extra
	if extra == nil {
		return types.PaymentPayload{}, fmt.Errorf("missing extra data in requirements")
	}

	facilitator, ok := extra["facilitator"].(string)
	if !ok || facilitator == "" {
		return types.PaymentPayload{}, fmt.Errorf("missing facilitator in requirements.extra")
	}

	// Get max amount from requirements (or use required amount as max)
	maxAmount := string(requirements.Amount)
	if ma, ok := extra["maxAmount"].(string); ok && ma != "" {
		maxAmount = ma
	}

	// Get current seqno
	seqno, err := c.signer.GetSeqno(ctx)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get seqno: %w", err)
	}

	// Generate query ID (timestamp * 1000000 + seqno for uniqueness)
	now := time.Now().Unix()
	queryId := fmt.Sprintf("%d", now*1000000+seqno)

	// Calculate timeout and validity
	timeout := c.config.DefaultTimeout
	if requirements.MaxTimeoutSeconds > 0 {
		timeout = int64(requirements.MaxTimeoutSeconds)
	}
	validUntil := now + timeout

	// Get gas amount from extra or use default
	gasAmount := c.config.GasAmount
	if tonAmountStr, ok := extra["tonAmount"].(string); ok {
		if parsed, err := parseUint64(tonAmountStr); err == nil {
			gasAmount = parsed
		}
	}

	// Sign the message - the signer handles Jetton transfer body construction
	signedBoc, err := c.signer.SignMessage(ctx, upto.SignMessageParams{
		To:      facilitator,
		Value:   gasAmount,
		Body:    "", // Signer builds the Jetton transfer body with maxAmount
		Timeout: timeout,
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign message: %w", err)
	}

	// Generate payment nonce
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to generate nonce: %w", err)
	}
	paymentNonce := "0x" + hex.EncodeToString(nonceBytes)

	// Create the payload
	uptoPayload := &upto.UptoTonPayload{
		SignedBoc: signedBoc,
		Authorization: upto.UptoTonAuthorization{
			From:         c.signer.Address(),
			Facilitator:  facilitator,
			JettonMaster: string(requirements.Asset),
			MaxAmount:    maxAmount,
			TonAmount:    fmt.Sprintf("%d", gasAmount),
			ValidUntil:   validUntil,
			Seqno:        seqno,
			QueryId:      queryId,
		},
		PaymentNonce: paymentNonce,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     uptoPayload.ToMap(),
	}, nil
}

// GetAddress returns the client's TON address
func (c *UptoTonClient) GetAddress() string {
	return c.signer.Address()
}

// parseUint64 parses a string to uint64
func parseUint64(s string) (uint64, error) {
	var v uint64
	_, err := fmt.Sscanf(s, "%d", &v)
	return v, err
}

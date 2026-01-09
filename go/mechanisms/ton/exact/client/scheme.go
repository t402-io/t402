package client

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/awesome-doge/t402/go/mechanisms/ton"
	"github.com/awesome-doge/t402/go/types"
)

// ExactTonScheme implements the SchemeNetworkClient interface for TON exact payments (V2)
type ExactTonScheme struct {
	signer ton.ClientTonSigner
	config *ton.ClientConfig // Optional custom configuration
}

// NewExactTonScheme creates a new ExactTonScheme
// Config is optional - if not provided, uses network defaults
func NewExactTonScheme(signer ton.ClientTonSigner, config ...*ton.ClientConfig) *ExactTonScheme {
	var cfg *ton.ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &ExactTonScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactTonScheme) Scheme() string {
	return ton.SchemeExact
}

// CreatePaymentPayload creates a V2 payment payload for the Exact scheme
func (c *ExactTonScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := string(requirements.Network)
	if !ton.IsValidNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate required fields
	if requirements.Asset == "" {
		return types.PaymentPayload{}, fmt.Errorf("asset (Jetton master address) is required")
	}
	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	// Parse amount
	jettonAmount, err := strconv.ParseUint(requirements.Amount, 10, 64)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %w", err)
	}

	// Get seqno for replay protection
	seqno, err := c.signer.GetSeqno(ctx)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get seqno: %w", err)
	}

	// Calculate validity period
	now := time.Now().Unix()
	validUntil := now + int64(requirements.MaxTimeoutSeconds)
	if requirements.MaxTimeoutSeconds == 0 {
		validUntil = now + ton.DefaultValidityDuration
	}

	// Generate unique query ID (timestamp * 1000000 + random component)
	queryId := fmt.Sprintf("%d", now*1000000+seqno)

	// Get gas amount from extra or use default
	tonAmount := uint64(ton.DefaultJettonTransferTon)
	if extra, ok := requirements.Extra["tonAmount"]; ok {
		if tonAmountStr, ok := extra.(string); ok {
			if parsed, err := strconv.ParseUint(tonAmountStr, 10, 64); err == nil {
				tonAmount = parsed
			}
		}
	}

	// Build authorization metadata
	authorization := ton.ExactTonAuthorization{
		From:         c.signer.Address(),
		To:           requirements.PayTo,
		JettonMaster: requirements.Asset,
		JettonAmount: strconv.FormatUint(jettonAmount, 10),
		TonAmount:    strconv.FormatUint(tonAmount, 10),
		ValidUntil:   validUntil,
		Seqno:        seqno,
		QueryId:      queryId,
	}

	// Build the Jetton transfer message body (this would need BOC encoding)
	// For now, we create the authorization structure and the client-side
	// signer implementation will handle the actual message building and signing
	signedBoc, err := c.signer.SignMessage(ctx, ton.SignMessageParams{
		To:      requirements.PayTo,
		Value:   tonAmount,
		Body:    "", // The signer implementation builds the Jetton transfer body
		Timeout: int64(requirements.MaxTimeoutSeconds),
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign message: %w", err)
	}

	// Create TON payload
	tonPayload := &ton.ExactTonPayload{
		SignedBoc:     signedBoc,
		Authorization: authorization,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     tonPayload.ToMap(),
	}, nil
}

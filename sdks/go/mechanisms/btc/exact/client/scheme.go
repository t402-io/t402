// Package client provides the client-side implementation for Bitcoin exact payments.
package client

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"

	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactBtcScheme implements the SchemeNetworkClient for Bitcoin on-chain PSBT payments.
//
// Creates signed PSBTs for on-chain Bitcoin payments that can be
// finalized and broadcast by a facilitator.
type ExactBtcScheme struct {
	signer btc.ClientBtcSigner
}

// NewExactBtcScheme creates a new ExactBtcScheme client.
func NewExactBtcScheme(signer btc.ClientBtcSigner) *ExactBtcScheme {
	return &ExactBtcScheme{signer: signer}
}

// Scheme returns the scheme identifier
func (c *ExactBtcScheme) Scheme() string {
	return btc.SchemeExact
}

// CreatePaymentPayload creates a payment payload by building and signing a PSBT.
func (c *ExactBtcScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	_ = ctx

	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	if !btc.ValidateBitcoinAddress(requirements.PayTo) {
		return types.PaymentPayload{}, fmt.Errorf("invalid Bitcoin address: %s", requirements.PayTo)
	}

	// Validate amount is above dust limit
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount format: %s", requirements.Amount)
	}
	if amount.Int64() < btc.DustLimit {
		return types.PaymentPayload{}, fmt.Errorf("amount %s satoshis is below dust limit (%d)", requirements.Amount, btc.DustLimit)
	}

	// Build unsigned PSBT data
	psbtData := map[string]interface{}{
		"outputs": []map[string]interface{}{
			{
				"address": requirements.PayTo,
				"value":   requirements.Amount,
			},
		},
		"network":    requirements.Network,
		"fromAddress": c.signer.GetAddress(),
		"fromPubKey":  c.signer.GetPublicKey(),
	}

	psbtJSON, err := json.Marshal(psbtData)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to encode PSBT data: %w", err)
	}
	unsignedPsbt := base64.StdEncoding.EncodeToString(psbtJSON)

	// Sign the PSBT
	signedPsbt, err := c.signer.SignPsbt(unsignedPsbt)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign PSBT: %w", err)
	}

	payload := &btc.PSBTPayload{
		SignedPsbt: signedPsbt,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: requirements.Network,
			Asset:   "BTC",
			Amount:  requirements.Amount,
			PayTo:   requirements.PayTo,
		},
	}, nil
}

// LightningScheme implements the SchemeNetworkClient for Lightning Network payments.
//
// Pays BOLT11 invoices and returns the preimage as proof of payment.
type LightningScheme struct {
	signer btc.ClientLightningSigner
}

// NewLightningScheme creates a new LightningScheme client.
func NewLightningScheme(signer btc.ClientLightningSigner) *LightningScheme {
	return &LightningScheme{signer: signer}
}

// Scheme returns the scheme identifier
func (c *LightningScheme) Scheme() string {
	return btc.SchemeExact
}

// CreatePaymentPayload pays a BOLT11 invoice and returns the preimage as proof.
func (c *LightningScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	_ = ctx

	// Extract BOLT11 invoice from requirements
	var bolt11Invoice string
	if requirements.Extra != nil {
		if v, ok := requirements.Extra["bolt11Invoice"].(string); ok {
			bolt11Invoice = v
		}
	}

	if bolt11Invoice == "" {
		return types.PaymentPayload{}, fmt.Errorf("BOLT11 invoice is required in requirements.extra.bolt11Invoice")
	}

	if !btc.ValidateBolt11Invoice(bolt11Invoice) {
		return types.PaymentPayload{}, fmt.Errorf("invalid BOLT11 invoice format")
	}

	// Pay the invoice
	preimage, paymentHash, err := c.signer.PayInvoice(bolt11Invoice)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to pay invoice: %w", err)
	}

	payload := &btc.LightningPayload{
		PaymentHash:   paymentHash,
		Preimage:      preimage,
		Bolt11Invoice: bolt11Invoice,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: requirements.Network,
			Asset:   "BTC",
			Amount:  requirements.Amount,
			PayTo:   requirements.PayTo,
		},
	}, nil
}

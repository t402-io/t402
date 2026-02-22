package btc

import "context"

// PSBTPayload represents the payment payload for Bitcoin on-chain PSBT payments
type PSBTPayload struct {
	SignedPsbt string `json:"signedPsbt"`
	TxID       string `json:"txId,omitempty"`
}

// PayloadFromMap creates a PSBTPayload from a map
func PayloadFromMap(data map[string]interface{}) *PSBTPayload {
	payload := &PSBTPayload{}
	if signedPsbt, ok := data["signedPsbt"].(string); ok {
		payload.SignedPsbt = signedPsbt
	}
	if txID, ok := data["txId"].(string); ok {
		payload.TxID = txID
	}
	return payload
}

// ToMap converts the PSBTPayload to a map
func (p *PSBTPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{
		"signedPsbt": p.SignedPsbt,
	}
	if p.TxID != "" {
		m["txId"] = p.TxID
	}
	return m
}

// LightningPayload represents the payment payload for Lightning Network payments
type LightningPayload struct {
	PaymentHash   string `json:"paymentHash"`
	Preimage      string `json:"preimage"`
	Bolt11Invoice string `json:"bolt11Invoice"`
}

// LightningPayloadFromMap creates a LightningPayload from a map
func LightningPayloadFromMap(data map[string]interface{}) *LightningPayload {
	payload := &LightningPayload{}
	if paymentHash, ok := data["paymentHash"].(string); ok {
		payload.PaymentHash = paymentHash
	}
	if preimage, ok := data["preimage"].(string); ok {
		payload.Preimage = preimage
	}
	if bolt11, ok := data["bolt11Invoice"].(string); ok {
		payload.Bolt11Invoice = bolt11
	}
	return payload
}

// ToMap converts the LightningPayload to a map
func (p *LightningPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"paymentHash":   p.PaymentHash,
		"preimage":      p.Preimage,
		"bolt11Invoice": p.Bolt11Invoice,
	}
}

// ClientBtcSigner is used by t402 clients to sign Bitcoin on-chain transactions
type ClientBtcSigner interface {
	// SignPsbt signs a PSBT and returns the base64-encoded signed PSBT
	SignPsbt(psbt string) (string, error)

	// GetAddress returns the signer's Bitcoin address
	GetAddress() string

	// GetPublicKey returns the signer's public key as a hex string
	GetPublicKey() string
}

// ClientLightningSigner is used by t402 clients to pay Lightning invoices
type ClientLightningSigner interface {
	// PayInvoice pays a BOLT11 invoice and returns the preimage and payment hash
	PayInvoice(bolt11 string) (preimage string, paymentHash string, err error)

	// GetNodePubKey returns the Lightning node's public key as a hex string
	GetNodePubKey() string
}

// FacilitatorBtcSigner is used by facilitators for on-chain PSBT verification and settlement
type FacilitatorBtcSigner interface {
	// GetAddresses returns the facilitator's Bitcoin addresses
	GetAddresses() []string

	// VerifyPsbt verifies a signed PSBT against expected payment details
	VerifyPsbt(ctx context.Context, signedPsbt, expectedPayTo, expectedAmount string) (valid bool, reason string, payer string, err error)

	// BroadcastPsbt finalizes and broadcasts a signed PSBT, returning the transaction ID
	BroadcastPsbt(ctx context.Context, signedPsbt string) (txID string, err error)

	// WaitForConfirmation waits for a transaction to be confirmed
	WaitForConfirmation(ctx context.Context, txID string, confirmations int) (confirmed bool, blockHash string, confs int, err error)
}

// FacilitatorLightningSigner is used by facilitators for Lightning payment verification
type FacilitatorLightningSigner interface {
	// GetAddresses returns the facilitator's Lightning node public keys
	GetAddresses() []string

	// LookupPayment looks up a payment by its payment hash
	LookupPayment(ctx context.Context, paymentHash string) (settled bool, amountSats string, preimage string, err error)
}

// Package client implements the client role for NEAR upto payments.
package client

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoNearClient implements the SchemeNetworkClient interface for NEAR upto payments
type UptoNearClient struct {
	signer upto.UptoClientNearSigner
	config *ClientConfig
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	// RPCURL is a custom RPC URL for the client
	RPCURL string
}

// NewUptoNearClient creates a new UptoNearClient
func NewUptoNearClient(signer upto.UptoClientNearSigner, config ...*ClientConfig) *UptoNearClient {
	var cfg *ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &UptoNearClient{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *UptoNearClient) Scheme() string {
	return upto.SchemeUpto
}

// CreatePaymentPayload creates an upto payment payload for NEAR
// This executes the ft_transfer to the facilitator and returns the tx hash
func (c *UptoNearClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	_, ok := near.GetNetworkConfig(string(requirements.Network))
	if !ok {
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

	// Generate payment nonce
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to generate nonce: %w", err)
	}
	paymentNonce := "0x" + hex.EncodeToString(nonceBytes)

	// Execute the ft_transfer to facilitator
	txHash, err := c.signer.FtTransfer(ctx, upto.FtTransferParams{
		TokenContract: string(requirements.Asset),
		ReceiverID:    facilitator,
		Amount:        maxAmount,
		Memo:          fmt.Sprintf("t402-upto:%s", paymentNonce),
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to execute ft_transfer: %w", err)
	}

	// Create the payload
	uptoPayload := &upto.UptoNearPayload{
		TxHash: txHash,
		Authorization: upto.UptoNearAuthorization{
			From:          c.signer.AccountID(),
			Facilitator:   facilitator,
			TokenContract: string(requirements.Asset),
			MaxAmount:     maxAmount,
		},
		PaymentNonce: paymentNonce,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     uptoPayload.ToMap(),
	}, nil
}

// GetAddress returns the client's NEAR account ID
func (c *UptoNearClient) GetAddress() string {
	return c.signer.AccountID()
}

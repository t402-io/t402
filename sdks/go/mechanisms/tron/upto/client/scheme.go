// Package client implements the client role for TRON upto payments.
package client

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoTronClient implements the SchemeNetworkClient interface for TRON upto payments
type UptoTronClient struct {
	signer upto.UptoClientTronSigner
	config *ClientConfig
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	// FeeLimit is the maximum fee in SUN for transactions
	FeeLimit int64
}

// NewUptoTronClient creates a new UptoTronClient
func NewUptoTronClient(signer upto.UptoClientTronSigner, config ...*ClientConfig) *UptoTronClient {
	var cfg *ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	} else {
		cfg = &ClientConfig{
			FeeLimit: 100000000, // 100 TRX default
		}
	}
	return &UptoTronClient{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *UptoTronClient) Scheme() string {
	return upto.SchemeUpto
}

// CreatePaymentPayload creates an upto payment payload for TRON
func (c *UptoTronClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	if !tron.IsValidNetwork(string(requirements.Network)) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate scheme
	if requirements.Scheme != upto.SchemeUpto {
		return types.PaymentPayload{}, fmt.Errorf("invalid scheme: expected %s, got %s", upto.SchemeUpto, requirements.Scheme)
	}

	// Get spender address from requirements
	extra := requirements.Extra
	if extra == nil {
		return types.PaymentPayload{}, fmt.Errorf("missing extra data in requirements")
	}

	spender, ok := extra["spenderAddress"].(string)
	if !ok || spender == "" {
		return types.PaymentPayload{}, fmt.Errorf("missing spenderAddress in requirements.extra")
	}

	// Get max amount from requirements (or use required amount as max)
	maxAmount := string(requirements.Amount)
	if ma, ok := extra["maxAmount"].(string); ok && ma != "" {
		maxAmount = ma
	}

	// Get block info for transaction building
	blockInfo, err := c.signer.GetBlockInfo()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get block info: %w", err)
	}

	// Calculate expiration based on maxTimeoutSeconds or default
	expiration := blockInfo.Expiration
	if requirements.MaxTimeoutSeconds > 0 {
		expiration = time.Now().UnixMilli() + int64(requirements.MaxTimeoutSeconds)*1000
	}

	// Sign the approve transaction
	signedTx, err := c.signer.SignApproveTransaction(upto.SignApproveParams{
		ContractAddress: string(requirements.Asset),
		Spender:         spender,
		Amount:          maxAmount,
		FeeLimit:        c.config.FeeLimit,
		Expiration:      expiration,
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign approve transaction: %w", err)
	}

	// Generate payment nonce for replay protection
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to generate nonce: %w", err)
	}
	paymentNonce := "0x" + hex.EncodeToString(nonceBytes)

	// Create the payload
	uptoPayload := &upto.UptoTronPayload{
		SignedTransaction: signedTx,
		Authorization: upto.UptoTronAuthorization{
			Owner:           c.signer.Address(),
			Spender:         spender,
			ContractAddress: string(requirements.Asset),
			MaxAmount:       maxAmount,
			Expiration:      expiration,
			RefBlockBytes:   blockInfo.RefBlockBytes,
			RefBlockHash:    blockInfo.RefBlockHash,
			Timestamp:       blockInfo.Timestamp,
		},
		PaymentNonce: paymentNonce,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     uptoPayload.ToMap(),
	}, nil
}

// GetAddress returns the client's TRON address
func (c *UptoTronClient) GetAddress() string {
	return c.signer.Address()
}

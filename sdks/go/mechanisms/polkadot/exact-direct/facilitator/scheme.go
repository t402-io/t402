package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectPolkadotSchemeConfig holds configuration for the facilitator
type ExactDirectPolkadotSchemeConfig struct {
	// MaxExtrinsicAge is the maximum age of an extrinsic to accept (in seconds)
	// Default: 3600 (1 hour)
	MaxExtrinsicAge int64

	// UsedExtrinsicCacheDuration is how long to cache used extrinsic identifiers
	// Default: 24 hours
	UsedExtrinsicCacheDuration time.Duration
}

// ExactDirectPolkadotScheme implements the SchemeNetworkFacilitator for Polkadot
type ExactDirectPolkadotScheme struct {
	signer polkadot.FacilitatorPolkadotSigner
	config ExactDirectPolkadotSchemeConfig

	// Used extrinsic cache for replay protection
	usedExtrinsicMu sync.RWMutex
	usedExtrinsics  map[string]time.Time
}

// NewExactDirectPolkadotScheme creates a new ExactDirectPolkadotScheme
func NewExactDirectPolkadotScheme(signer polkadot.FacilitatorPolkadotSigner, config *ExactDirectPolkadotSchemeConfig) *ExactDirectPolkadotScheme {
	cfg := ExactDirectPolkadotSchemeConfig{
		MaxExtrinsicAge:            3600, // 1 hour
		UsedExtrinsicCacheDuration: 24 * time.Hour,
	}
	if config != nil {
		if config.MaxExtrinsicAge > 0 {
			cfg.MaxExtrinsicAge = config.MaxExtrinsicAge
		}
		if config.UsedExtrinsicCacheDuration > 0 {
			cfg.UsedExtrinsicCacheDuration = config.UsedExtrinsicCacheDuration
		}
	}

	scheme := &ExactDirectPolkadotScheme{
		signer:         signer,
		config:         cfg,
		usedExtrinsics: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedExtrinsics()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectPolkadotScheme) Scheme() string {
	return polkadot.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectPolkadotScheme) CaipFamily() string {
	return "polkadot:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectPolkadotScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := polkadot.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	return map[string]interface{}{
		"assetId":       config.DefaultToken.AssetID,
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
		"networkName":   config.Name,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectPolkadotScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectPolkadotScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != polkadot.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse payload
	polkadotPayload, err := polkadot.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if polkadotPayload.ExtrinsicHash == "" && polkadotPayload.BlockHash == "" {
		return nil, t402.NewVerifyError("missing_extrinsic_identifier", "", network, nil)
	}

	// Validate hash formats
	if polkadotPayload.ExtrinsicHash != "" && !polkadot.IsValidExtrinsicHash(polkadotPayload.ExtrinsicHash) {
		return nil, t402.NewVerifyError("invalid_extrinsic_hash_format", "", network, nil)
	}

	if polkadotPayload.BlockHash != "" && !polkadot.IsValidBlockHash(polkadotPayload.BlockHash) {
		return nil, t402.NewVerifyError("invalid_block_hash_format", "", network, nil)
	}

	if polkadotPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Build unique identifier for replay protection
	extrinsicID := polkadotPayload.ExtrinsicHash
	if extrinsicID == "" {
		extrinsicID = fmt.Sprintf("%s-%d", polkadotPayload.BlockHash, polkadotPayload.ExtrinsicIndex)
	}

	// Check for replay attack
	if f.isExtrinsicUsed(extrinsicID) {
		return nil, t402.NewVerifyError("extrinsic_already_used", polkadotPayload.From, network, nil)
	}

	// Query extrinsic
	result, err := f.signer.QueryExtrinsic(ctx, polkadotPayload.ExtrinsicHash, polkadotPayload.BlockHash, polkadotPayload.ExtrinsicIndex)
	if err != nil {
		return nil, t402.NewVerifyError("extrinsic_not_found", polkadotPayload.From, network, err)
	}

	// Verify extrinsic was successful
	if !result.Success {
		return nil, t402.NewVerifyError("extrinsic_failed", polkadotPayload.From, network, nil)
	}

	// Check extrinsic age
	if f.config.MaxExtrinsicAge > 0 {
		extrinsicTime, err := time.Parse(time.RFC3339, result.Timestamp)
		if err == nil {
			age := time.Since(extrinsicTime).Seconds()
			if int64(age) > f.config.MaxExtrinsicAge {
				return nil, t402.NewVerifyError("extrinsic_too_old", polkadotPayload.From, network,
					fmt.Errorf("age: %.0f seconds", age))
			}
		}
	}

	// Extract transfer details
	transfer := polkadot.ExtractAssetTransfer(result)
	if transfer == nil {
		return nil, t402.NewVerifyError("not_asset_transfer", polkadotPayload.From, network, nil)
	}

	// Verify asset ID
	expectedAssetID := polkadotPayload.AssetID
	if extra, ok := requirements.Extra["assetId"]; ok {
		if id, ok := extra.(float64); ok {
			expectedAssetID = int(id)
		} else if id, ok := extra.(int); ok {
			expectedAssetID = id
		}
	}
	if transfer.AssetID != expectedAssetID {
		return nil, t402.NewVerifyError("asset_mismatch", polkadotPayload.From, network,
			fmt.Errorf("expected %d, got %d", expectedAssetID, transfer.AssetID))
	}

	// Verify recipient
	if !polkadot.CompareAddresses(transfer.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", polkadotPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, transfer.To))
	}

	// Verify amount
	txAmount, ok := new(big.Int).SetString(transfer.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", polkadotPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", polkadotPayload.From, network, nil)
	}

	if txAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", polkadotPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, transfer.Amount))
	}

	// Mark extrinsic as used
	f.markExtrinsicUsed(extrinsicID)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   polkadotPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectPolkadotScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// Verify first
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve, ok := err.(*t402.VerifyError)
		if !ok {
			ve = &t402.VerifyError{
				Reason:  "verification_failed",
				Network: network,
				Err:     err,
			}
		}
		return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
	}

	// Parse payload for extrinsic hash
	polkadotPayload, _ := polkadot.PayloadFromMap(payload.Payload)

	// Build transaction ID
	txID := polkadotPayload.ExtrinsicHash
	if txID == "" {
		txID = fmt.Sprintf("%s-%d", polkadotPayload.BlockHash, polkadotPayload.ExtrinsicIndex)
	}

	// For exact-direct, settlement is already complete
	return &t402.SettleResponse{
		Success:     true,
		Transaction: txID,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isExtrinsicUsed checks if an extrinsic has been used
func (f *ExactDirectPolkadotScheme) isExtrinsicUsed(extrinsicID string) bool {
	f.usedExtrinsicMu.RLock()
	defer f.usedExtrinsicMu.RUnlock()
	_, used := f.usedExtrinsics[extrinsicID]
	return used
}

// markExtrinsicUsed marks an extrinsic as used
func (f *ExactDirectPolkadotScheme) markExtrinsicUsed(extrinsicID string) {
	f.usedExtrinsicMu.Lock()
	defer f.usedExtrinsicMu.Unlock()
	f.usedExtrinsics[extrinsicID] = time.Now()
}

// cleanupUsedExtrinsics periodically cleans up old used extrinsics
func (f *ExactDirectPolkadotScheme) cleanupUsedExtrinsics() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedExtrinsicMu.Lock()
		cutoff := time.Now().Add(-f.config.UsedExtrinsicCacheDuration)
		for extrinsicID, usedAt := range f.usedExtrinsics {
			if usedAt.Before(cutoff) {
				delete(f.usedExtrinsics, extrinsicID)
			}
		}
		f.usedExtrinsicMu.Unlock()
	}
}

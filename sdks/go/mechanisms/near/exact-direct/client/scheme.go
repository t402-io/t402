package client

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

// nearAccountIDRegex validates NEAR account IDs.
// NEAR accounts are either implicit (64 hex chars) or named (multiple dot-separated segments
// where each segment is alphanumeric with optional hyphens/underscores).
// Examples: alice.near, sub.alice.near, usdt.tether-token.near, my_account.testnet
var nearAccountIDRegex = regexp.MustCompile(`^(([a-z\d]+[-_])*[a-z\d]+\.)+([a-z\d]+[-_])*[a-z\d]+$|^[0-9a-f]{64}$`)

// ClientNearSigner defines the interface for NEAR client-side signing operations
type ClientNearSigner interface {
	// AccountID returns the signer's NEAR account ID
	AccountID() string

	// SignAndSendTransaction signs and sends a NEAR transaction, returning the transaction hash.
	//
	// Args:
	//   ctx: Context for cancellation and timeouts
	//   receiverID: The contract account receiving the function call
	//   actions: The actions to include in the transaction
	//   network: The network to send the transaction on (e.g., "near:mainnet")
	//
	// Returns:
	//   Transaction hash string on success, or an error
	SignAndSendTransaction(ctx context.Context, receiverID string, actions []near.Action, network string) (string, error)
}

// ExactDirectNearClientConfig holds optional configuration for the client
type ExactDirectNearClientConfig struct {
	// Memo is an optional memo to include in the ft_transfer call
	Memo string

	// GasAmount overrides the default gas for ft_transfer (default: 30 TGas)
	GasAmount string
}

// ExactDirectNearScheme implements the SchemeNetworkClient interface for NEAR exact-direct payments (V2)
type ExactDirectNearScheme struct {
	signer ClientNearSigner
	config ExactDirectNearClientConfig
}

// NewExactDirectNearScheme creates a new ExactDirectNearScheme client.
//
// Args:
//
//	signer: The NEAR signer for executing transactions
//	config: Optional configuration (pass nil for defaults)
func NewExactDirectNearScheme(signer ClientNearSigner, config *ExactDirectNearClientConfig) *ExactDirectNearScheme {
	cfg := ExactDirectNearClientConfig{
		GasAmount: near.DefaultGas,
	}
	if config != nil {
		if config.Memo != "" {
			cfg.Memo = config.Memo
		}
		if config.GasAmount != "" {
			cfg.GasAmount = config.GasAmount
		}
	}

	return &ExactDirectNearScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectNearScheme) Scheme() string {
	return near.SchemeExactDirect
}

// CreatePaymentPayload creates a V2 payment payload by executing the ft_transfer on-chain.
//
// Unlike other schemes where the client creates a signed message for the facilitator to execute,
// the exact-direct scheme has the client execute the transfer directly. The transaction hash
// is then used as proof of payment.
//
// Args:
//
//	ctx: Context for cancellation and timeouts
//	requirements: The payment requirements specifying amount, asset, payTo, and network
//
// Returns:
//
//	PaymentPayload with the transaction hash in the payload field
func (c *ExactDirectNearScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	if !isValidNetwork(requirements.Network) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate required fields
	if requirements.Asset == "" {
		return types.PaymentPayload{}, fmt.Errorf("asset (token contract address) is required")
	}
	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	// Validate account IDs
	if !isValidAccountID(requirements.PayTo) {
		return types.PaymentPayload{}, fmt.Errorf("invalid recipient account ID: %s", requirements.PayTo)
	}
	if !isValidAccountID(c.signer.AccountID()) {
		return types.PaymentPayload{}, fmt.Errorf("invalid sender account ID: %s", c.signer.AccountID())
	}

	// Build ft_transfer arguments
	ftTransferArgs := near.FtTransferArgs{
		ReceiverID: requirements.PayTo,
		Amount:     requirements.Amount,
	}
	if c.config.Memo != "" {
		memo := c.config.Memo
		ftTransferArgs.Memo = &memo
	}

	// Marshal arguments to JSON
	argsJSON, err := json.Marshal(ftTransferArgs)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to marshal ft_transfer args: %w", err)
	}

	// Build the function call action
	actions := []near.Action{
		{
			FunctionCall: &near.FunctionCallAction{
				MethodName: near.FunctionFtTransfer,
				Args:       argsJSON,
				Gas:        parseGasToUint64(c.config.GasAmount),
				Deposit:    near.StorageDeposit, // 1 yoctoNEAR required for ft_transfer
			},
		},
	}

	// Execute the transfer via the signer
	txHash, err := c.signer.SignAndSendTransaction(ctx, requirements.Asset, actions, requirements.Network)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to execute ft_transfer: %w", err)
	}

	// Build the payload
	payload := &near.ExactDirectPayload{
		TxHash: txHash,
		From:   c.signer.AccountID(),
		To:     requirements.PayTo,
		Amount: requirements.Amount,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
	}, nil
}

// isValidNetwork checks if a network identifier is a supported NEAR network
func isValidNetwork(network string) bool {
	_, ok := near.GetNetworkConfig(network)
	return ok
}

// isValidAccountID validates a NEAR account ID format
func isValidAccountID(accountID string) bool {
	if accountID == "" {
		return false
	}
	if len(accountID) < 2 || len(accountID) > 64 {
		return false
	}
	return nearAccountIDRegex.MatchString(accountID)
}

// parseGasToUint64 converts a gas string to uint64.
// Returns the default gas value if parsing fails.
func parseGasToUint64(gas string) uint64 {
	var result uint64
	for _, ch := range gas {
		if ch < '0' || ch > '9' {
			return 30000000000000 // default 30 TGas
		}
		result = result*10 + uint64(ch-'0')
	}
	return result
}

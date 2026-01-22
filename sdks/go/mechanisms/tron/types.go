package tron

import (
	"context"
	"encoding/json"
	"fmt"
)

// ExactTronPayload represents a TRON payment payload
type ExactTronPayload struct {
	// SignedTransaction is the hex-encoded signed transaction
	SignedTransaction string `json:"signedTransaction"`

	// Authorization contains transfer metadata for verification
	Authorization ExactTronAuthorization `json:"authorization"`
}

// ExactTronAuthorization contains transfer authorization metadata
type ExactTronAuthorization struct {
	// From is the sender wallet address (T-prefix base58check)
	From string `json:"from"`

	// To is the recipient wallet address
	To string `json:"to"`

	// ContractAddress is the TRC20 contract address
	ContractAddress string `json:"contractAddress"`

	// Amount is the transfer amount in smallest units (as string)
	Amount string `json:"amount"`

	// Expiration is the transaction expiration timestamp (milliseconds)
	Expiration int64 `json:"expiration"`

	// RefBlockBytes is the reference block bytes (hex string)
	RefBlockBytes string `json:"refBlockBytes"`

	// RefBlockHash is the reference block hash (hex string)
	RefBlockHash string `json:"refBlockHash"`

	// Timestamp is the transaction timestamp (milliseconds)
	Timestamp int64 `json:"timestamp"`
}

// ExactTronPayloadV2 - alias for v2 compatibility
type ExactTronPayloadV2 = ExactTronPayload

// ClientTronSigner defines client-side operations for TRON
type ClientTronSigner interface {
	// Address returns the signer's TRON address (T-prefix base58check)
	Address() string

	// GetBlockInfo returns current block info for transaction building
	GetBlockInfo(ctx context.Context) (*BlockInfo, error)

	// SignTransaction signs a TRC20 transfer transaction
	SignTransaction(ctx context.Context, params SignTransactionParams) (string, error)
}

// BlockInfo contains block information for transaction building
type BlockInfo struct {
	// RefBlockBytes is the reference block bytes (hex string)
	RefBlockBytes string `json:"refBlockBytes"`

	// RefBlockHash is the reference block hash (hex string)
	RefBlockHash string `json:"refBlockHash"`

	// Expiration is the transaction expiration timestamp (milliseconds)
	Expiration int64 `json:"expiration"`

	// Timestamp is the block timestamp (milliseconds)
	Timestamp int64 `json:"timestamp"`
}

// SignTransactionParams contains parameters for signing a transaction
type SignTransactionParams struct {
	// ContractAddress is the TRC20 contract address
	ContractAddress string

	// To is the recipient address
	To string

	// Amount is the transfer amount in smallest units
	Amount string

	// FeeLimit is the maximum fee in SUN
	FeeLimit int64

	// Expiration is the transaction expiration timestamp
	Expiration int64
}

// FacilitatorTronSigner defines facilitator operations for TRON
type FacilitatorTronSigner interface {
	// GetAddresses returns all addresses this facilitator can use
	GetAddresses(ctx context.Context, network string) []string

	// GetBalance returns the TRC20 balance for an owner
	GetBalance(ctx context.Context, params GetBalanceParams) (string, error)

	// VerifyTransaction verifies a signed transaction
	VerifyTransaction(ctx context.Context, params VerifyTransactionParams) (*VerifyMessageResult, error)

	// BroadcastTransaction broadcasts a signed transaction
	BroadcastTransaction(ctx context.Context, signedTransaction string, network string) (string, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(ctx context.Context, params WaitForTransactionParams) (*TransactionConfirmation, error)

	// IsActivated checks if an account is activated
	IsActivated(ctx context.Context, address string, network string) (bool, error)
}

// GetBalanceParams contains parameters for getting TRC20 balance
type GetBalanceParams struct {
	OwnerAddress    string
	ContractAddress string
	Network         string
}

// VerifyTransactionParams contains parameters for verifying a transaction
type VerifyTransactionParams struct {
	SignedTransaction string
	ExpectedFrom      string
	ExpectedTransfer  ExpectedTransfer
	Network           string
}

// ExpectedTransfer contains expected transfer details for verification
type ExpectedTransfer struct {
	To              string
	ContractAddress string
	Amount          string
}

// VerifyMessageResult contains the result of message verification
type VerifyMessageResult struct {
	Valid    bool          `json:"valid"`
	Reason   string        `json:"reason,omitempty"`
	Transfer *TransferInfo `json:"transfer,omitempty"`
}

// TransferInfo contains parsed transfer information
type TransferInfo struct {
	From            string `json:"from"`
	To              string `json:"to"`
	ContractAddress string `json:"contractAddress"`
	Amount          string `json:"amount"`
	TxId            string `json:"txId"`
}

// WaitForTransactionParams contains parameters for waiting for transaction
type WaitForTransactionParams struct {
	TxId    string
	Network string
	Timeout int64
}

// TransactionConfirmation contains transaction confirmation result
type TransactionConfirmation struct {
	Success     bool   `json:"success"`
	TxId        string `json:"txId,omitempty"`
	BlockNumber int64  `json:"blockNumber,omitempty"`
	Error       string `json:"error,omitempty"`
}

// AssetInfo contains information about a TRC20 token
type AssetInfo struct {
	ContractAddress string // TRC20 contract address
	Symbol          string // Token symbol (e.g., "USDT")
	Name            string // Token name (e.g., "Tether USD")
	Decimals        int    // Token decimals
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	Name            string               // Network name
	CAIP2           string               // CAIP-2 identifier
	Endpoint        string               // API endpoint
	DefaultAsset    AssetInfo            // Default TRC20 (USDT)
	SupportedAssets map[string]AssetInfo // Symbol -> AssetInfo
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	Endpoint string // Custom API endpoint
	FeeLimit int64  // Custom fee limit in SUN
}

// ToMap converts an ExactTronPayload to a map for JSON marshaling
func (p *ExactTronPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signedTransaction": p.SignedTransaction,
		"authorization": map[string]interface{}{
			"from":            p.Authorization.From,
			"to":              p.Authorization.To,
			"contractAddress": p.Authorization.ContractAddress,
			"amount":          p.Authorization.Amount,
			"expiration":      p.Authorization.Expiration,
			"refBlockBytes":   p.Authorization.RefBlockBytes,
			"refBlockHash":    p.Authorization.RefBlockHash,
			"timestamp":       p.Authorization.Timestamp,
		},
	}
}

// PayloadFromMap creates an ExactTronPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactTronPayload, error) {
	// Try to convert to JSON and back for type safety
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload ExactTronPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.SignedTransaction == "" {
		return nil, fmt.Errorf("missing signedTransaction field in payload")
	}

	if payload.Authorization.From == "" {
		return nil, fmt.Errorf("missing authorization.from field in payload")
	}

	return &payload, nil
}

// IsValidNetwork checks if the network is supported for TRON
func IsValidNetwork(network string) bool {
	_, ok := NetworkConfigs[network]
	return ok
}

package stellar

import (
	"context"
	"encoding/json"
	"fmt"
)

// ExactStellarPayload represents a Stellar payment payload
type ExactStellarPayload struct {
	// SignedXDR is the base64 encoded signed Soroban transaction envelope (XDR format)
	SignedXDR string `json:"signedXdr"`

	// Authorization contains transfer metadata for verification
	Authorization ExactStellarAuthorization `json:"authorization"`
}

// ExactStellarAuthorization contains transfer authorization metadata
type ExactStellarAuthorization struct {
	// From is the sender's Stellar public key (G-account)
	From string `json:"from"`

	// To is the recipient's Stellar public key (G-account)
	To string `json:"to"`

	// TokenContract is the Soroban token contract address (C-account)
	TokenContract string `json:"tokenContract"`

	// Amount is the amount in smallest units (stroops, as string for large numbers)
	Amount string `json:"amount"`

	// MaxLedger is the maximum ledger number by which the transaction must be included
	MaxLedger int64 `json:"maxLedger"`

	// Network is the CAIP-2 network identifier
	Network string `json:"network"`
}

// ExactStellarPayloadV2 - alias for v2 compatibility
type ExactStellarPayloadV2 = ExactStellarPayload

// ClientStellarSigner defines client-side operations for Stellar
type ClientStellarSigner interface {
	// Address returns the signer's Stellar public key (G-account)
	Address() string

	// GetCurrentLedger returns the current ledger sequence number
	GetCurrentLedger(ctx context.Context) (int64, error)

	// SignTransaction signs a Soroban transfer transaction and returns the signed XDR
	SignTransaction(ctx context.Context, params SignTransactionParams) (string, error)
}

// SignTransactionParams contains parameters for signing a transaction
type SignTransactionParams struct {
	// To is the destination address (G-account)
	To string

	// TokenContract is the Soroban token contract (C-account)
	TokenContract string

	// Amount is the transfer amount in smallest units (stroops)
	Amount string

	// MaxLedger is the maximum ledger for transaction validity
	MaxLedger int64

	// NetworkPassphrase is the network passphrase for signing
	NetworkPassphrase string
}

// FacilitatorStellarSigner defines facilitator operations for Stellar
type FacilitatorStellarSigner interface {
	// GetAddresses returns all addresses this facilitator can use
	GetAddresses(ctx context.Context, network string) []string

	// GetTokenBalance returns the token balance for an account
	GetTokenBalance(ctx context.Context, params GetTokenBalanceParams) (string, error)

	// VerifyTransaction verifies a signed XDR transaction
	VerifyTransaction(ctx context.Context, params VerifyTransactionParams) (*VerifyTransactionResult, error)

	// SubmitTransaction submits a signed transaction to the network
	SubmitTransaction(ctx context.Context, signedXDR string, network string) (string, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(ctx context.Context, params WaitForTransactionParams) (*TransactionConfirmation, error)

	// GetCurrentLedger returns the current ledger sequence number
	GetCurrentLedger(ctx context.Context, network string) (int64, error)

	// AccountExists checks if a Stellar account exists (is funded)
	AccountExists(ctx context.Context, address string, network string) (bool, error)
}

// GetTokenBalanceParams contains parameters for getting token balance
type GetTokenBalanceParams struct {
	OwnerAddress    string
	TokenContract   string
	Network         string
}

// VerifyTransactionParams contains parameters for verifying a transaction
type VerifyTransactionParams struct {
	SignedXDR        string
	ExpectedFrom     string
	ExpectedTransfer ExpectedTransfer
	Network          string
}

// ExpectedTransfer contains expected transfer details for verification
type ExpectedTransfer struct {
	Amount        string
	Destination   string
	TokenContract string
}

// VerifyTransactionResult contains the result of transaction verification
type VerifyTransactionResult struct {
	Valid    bool          `json:"valid"`
	Reason   string        `json:"reason,omitempty"`
	Transfer *TransferInfo `json:"transfer,omitempty"`
}

// TransferInfo contains parsed transfer information
type TransferInfo struct {
	From          string `json:"from"`
	To            string `json:"to"`
	Amount        string `json:"amount"`
	TokenContract string `json:"tokenContract"`
}

// WaitForTransactionParams contains parameters for waiting for transaction
type WaitForTransactionParams struct {
	TxHash  string
	Timeout int64
	Network string
}

// TransactionStatus represents the lifecycle state of a transaction
type TransactionStatus string

const (
	// TransactionStatusPending indicates the transaction has been submitted but not yet confirmed
	TransactionStatusPending TransactionStatus = "pending"
	// TransactionStatusConfirmed indicates the transaction was confirmed on-chain
	TransactionStatusConfirmed TransactionStatus = "confirmed"
	// TransactionStatusFailed indicates the transaction failed
	TransactionStatusFailed TransactionStatus = "failed"
)

// TransactionConfirmation contains transaction confirmation result
type TransactionConfirmation struct {
	Success bool              `json:"success"`
	Status  TransactionStatus `json:"status,omitempty"`
	Ledger  int64             `json:"ledger,omitempty"`
	Hash    string            `json:"hash,omitempty"`
	Error   string            `json:"error,omitempty"`
}

// TransactionStatusChecker is an optional interface that signers can implement
// to enable post-confirmation failure detection.
type TransactionStatusChecker interface {
	// GetTransactionStatus returns the status of a transaction by its hash.
	GetTransactionStatus(ctx context.Context, hash string, network string) (TransactionStatus, error)
}

// AssetInfo contains information about a Soroban token
type AssetInfo struct {
	ContractAddress string // Soroban contract address (C-account)
	Symbol          string // Token symbol (e.g., "USDC")
	Name            string // Token name (e.g., "USD Coin")
	Decimals        int    // Token decimals (7 for Stellar USDC)
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	Name              string               // Network name
	CAIP2             string               // CAIP-2 identifier
	HorizonURL        string               // Horizon API endpoint
	SorobanRPCURL     string               // Soroban RPC endpoint
	NetworkPassphrase string               // Network passphrase for signing
	DefaultAsset      AssetInfo            // Default token (USDC)
	SupportedAssets   map[string]AssetInfo // Symbol -> AssetInfo
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	HorizonURL    string // Custom Horizon API endpoint
	SorobanRPCURL string // Custom Soroban RPC endpoint
}

// ToMap converts an ExactStellarPayload to a map for JSON marshaling
func (p *ExactStellarPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signedXdr": p.SignedXDR,
		"authorization": map[string]interface{}{
			"from":          p.Authorization.From,
			"to":            p.Authorization.To,
			"tokenContract": p.Authorization.TokenContract,
			"amount":        p.Authorization.Amount,
			"maxLedger":     p.Authorization.MaxLedger,
			"network":       p.Authorization.Network,
		},
	}
}

// PayloadFromMap creates an ExactStellarPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactStellarPayload, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload ExactStellarPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.SignedXDR == "" {
		return nil, fmt.Errorf("missing signedXdr field in payload")
	}

	if payload.Authorization.From == "" {
		return nil, fmt.Errorf("missing authorization.from field in payload")
	}

	return &payload, nil
}

// IsValidNetwork checks if the network is supported for Stellar
func IsValidNetwork(network string) bool {
	_, ok := NetworkConfigs[network]
	return ok
}

// Package upto implements the upto payment scheme for TRON.
// The upto scheme allows clients to authorize payments up to a maximum amount,
// with the actual settlement amount determined at settlement time.
package upto

import (
	"encoding/json"
	"fmt"
)

// SchemeUpto is the scheme identifier for upto payments
const SchemeUpto = "upto"

// UptoTronPayload represents a TRON upto payment payload.
// It contains a signed approve transaction that authorizes the facilitator
// to transfer up to maxAmount of tokens on behalf of the payer.
type UptoTronPayload struct {
	// SignedTransaction is the hex-encoded signed approve transaction
	SignedTransaction string `json:"signedTransaction"`

	// Authorization contains approval metadata for verification
	Authorization UptoTronAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce for replay protection (hex string)
	PaymentNonce string `json:"paymentNonce"`
}

// UptoTronAuthorization contains approval authorization metadata
type UptoTronAuthorization struct {
	// Owner is the token owner address (T-prefix base58check)
	Owner string `json:"owner"`

	// Spender is the approved spender address (facilitator)
	Spender string `json:"spender"`

	// ContractAddress is the TRC20 contract address
	ContractAddress string `json:"contractAddress"`

	// MaxAmount is the maximum approved amount in smallest units (as string)
	MaxAmount string `json:"maxAmount"`

	// Expiration is the transaction expiration timestamp (milliseconds)
	Expiration int64 `json:"expiration"`

	// RefBlockBytes is the reference block bytes (hex string)
	RefBlockBytes string `json:"refBlockBytes"`

	// RefBlockHash is the reference block hash (hex string)
	RefBlockHash string `json:"refBlockHash"`

	// Timestamp is the transaction timestamp (milliseconds)
	Timestamp int64 `json:"timestamp"`
}

// UptoTronExtra contains upto-specific extra fields for payment requirements
type UptoTronExtra struct {
	// MaxAmount is the maximum payment amount authorized
	MaxAmount string `json:"maxAmount,omitempty"`

	// MinAmount is the minimum acceptable settlement amount
	MinAmount string `json:"minAmount,omitempty"`

	// Unit is the billing unit (e.g., "token", "request", "second")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`

	// SpenderAddress is the facilitator address that will be approved
	SpenderAddress string `json:"spenderAddress,omitempty"`
}

// ToMap converts an UptoTronPayload to a map for JSON marshaling
func (p *UptoTronPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signedTransaction": p.SignedTransaction,
		"authorization": map[string]interface{}{
			"owner":           p.Authorization.Owner,
			"spender":         p.Authorization.Spender,
			"contractAddress": p.Authorization.ContractAddress,
			"maxAmount":       p.Authorization.MaxAmount,
			"expiration":      p.Authorization.Expiration,
			"refBlockBytes":   p.Authorization.RefBlockBytes,
			"refBlockHash":    p.Authorization.RefBlockHash,
			"timestamp":       p.Authorization.Timestamp,
		},
		"paymentNonce": p.PaymentNonce,
	}
}

// UptoPayloadFromMap creates an UptoTronPayload from a map
func UptoPayloadFromMap(data map[string]interface{}) (*UptoTronPayload, error) {
	// Try to convert to JSON and back for type safety
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload UptoTronPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.SignedTransaction == "" {
		return nil, fmt.Errorf("missing signedTransaction field in payload")
	}

	if payload.Authorization.Owner == "" {
		return nil, fmt.Errorf("missing authorization.owner field in payload")
	}

	if payload.Authorization.Spender == "" {
		return nil, fmt.Errorf("missing authorization.spender field in payload")
	}

	if payload.PaymentNonce == "" {
		return nil, fmt.Errorf("missing paymentNonce field in payload")
	}

	return &payload, nil
}

// UptoClientTronSigner defines client-side operations for TRON upto payments
type UptoClientTronSigner interface {
	// Address returns the signer's TRON address (T-prefix base58check)
	Address() string

	// GetBlockInfo returns current block info for transaction building
	GetBlockInfo() (*BlockInfo, error)

	// SignApproveTransaction signs a TRC20 approve transaction
	SignApproveTransaction(params SignApproveParams) (string, error)
}

// BlockInfo contains block information for transaction building
type BlockInfo struct {
	RefBlockBytes string `json:"refBlockBytes"`
	RefBlockHash  string `json:"refBlockHash"`
	Expiration    int64  `json:"expiration"`
	Timestamp     int64  `json:"timestamp"`
}

// SignApproveParams contains parameters for signing an approve transaction
type SignApproveParams struct {
	// ContractAddress is the TRC20 contract address
	ContractAddress string

	// Spender is the address being approved
	Spender string

	// Amount is the approved amount in smallest units
	Amount string

	// FeeLimit is the maximum fee in SUN
	FeeLimit int64

	// Expiration is the transaction expiration timestamp
	Expiration int64
}

// UptoFacilitatorTronSigner defines facilitator operations for TRON upto payments
type UptoFacilitatorTronSigner interface {
	// GetAddresses returns all addresses this facilitator can use
	GetAddresses(network string) []string

	// GetBalance returns the TRC20 balance for an owner
	GetBalance(params GetBalanceParams) (string, error)

	// GetAllowance returns the TRC20 allowance for owner->spender
	GetAllowance(params GetAllowanceParams) (string, error)

	// VerifyApproveTransaction verifies a signed approve transaction
	VerifyApproveTransaction(params VerifyApproveParams) (*VerifyApproveResult, error)

	// BroadcastTransaction broadcasts a signed transaction
	BroadcastTransaction(signedTransaction string, network string) (string, error)

	// ExecuteTransferFrom executes a transferFrom on behalf of the owner
	ExecuteTransferFrom(params TransferFromParams) (*TransferFromResult, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(params WaitForTransactionParams) (*TransactionConfirmation, error)

	// IsActivated checks if an account is activated
	IsActivated(address string, network string) (bool, error)
}

// GetBalanceParams contains parameters for getting TRC20 balance
type GetBalanceParams struct {
	OwnerAddress    string
	ContractAddress string
	Network         string
}

// GetAllowanceParams contains parameters for getting TRC20 allowance
type GetAllowanceParams struct {
	OwnerAddress    string
	SpenderAddress  string
	ContractAddress string
	Network         string
}

// VerifyApproveParams contains parameters for verifying an approve transaction
type VerifyApproveParams struct {
	SignedTransaction string
	ExpectedOwner     string
	ExpectedSpender   string
	ContractAddress   string
	Network           string
}

// VerifyApproveResult contains the result of approve verification
type VerifyApproveResult struct {
	Valid   bool   `json:"valid"`
	Reason  string `json:"reason,omitempty"`
	Owner   string `json:"owner,omitempty"`
	Spender string `json:"spender,omitempty"`
	Amount  string `json:"amount,omitempty"`
}

// TransferFromParams contains parameters for executing transferFrom
type TransferFromParams struct {
	ContractAddress string
	From            string
	To              string
	Amount          string
	Network         string
}

// TransferFromResult contains the result of a transferFrom execution
type TransferFromResult struct {
	Success bool   `json:"success"`
	TxId    string `json:"txId,omitempty"`
	Error   string `json:"error,omitempty"`
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

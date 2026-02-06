// Package upto implements the upto payment scheme for SVM (Solana).
// The upto scheme allows clients to authorize payments up to a maximum amount,
// with the actual settlement amount determined at settlement time.
package upto

import (
	"context"
	"encoding/json"
	"fmt"

	solana "github.com/gagliardetto/solana-go"
)

// SchemeUpto is the scheme identifier for upto payments
const SchemeUpto = "upto"

// UptoSvmPayload represents a Solana upto payment payload.
// It contains a signed approve transaction that authorizes the facilitator
// to transfer up to maxAmount of tokens on behalf of the payer.
type UptoSvmPayload struct {
	// Transaction is the base64 encoded signed approve transaction
	Transaction string `json:"transaction"`

	// Authorization contains approval metadata for verification
	Authorization UptoSvmAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce for replay protection (hex string)
	PaymentNonce string `json:"paymentNonce"`
}

// UptoSvmAuthorization contains approval authorization metadata
type UptoSvmAuthorization struct {
	// Owner is the token owner address (base58)
	Owner string `json:"owner"`

	// Delegate is the approved delegate address (facilitator)
	Delegate string `json:"delegate"`

	// Mint is the SPL token mint address
	Mint string `json:"mint"`

	// MaxAmount is the maximum approved amount in smallest units (as string)
	MaxAmount string `json:"maxAmount"`

	// SourceATA is the owner's associated token account
	SourceATA string `json:"sourceATA"`
}

// UptoSvmExtra contains upto-specific extra fields for payment requirements
type UptoSvmExtra struct {
	// FeePayer is the facilitator address that will pay transaction fees
	FeePayer string `json:"feePayer,omitempty"`

	// MaxAmount is the maximum payment amount authorized
	MaxAmount string `json:"maxAmount,omitempty"`

	// MinAmount is the minimum acceptable settlement amount
	MinAmount string `json:"minAmount,omitempty"`

	// Unit is the billing unit (e.g., "token", "request", "second")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`
}

// ToMap converts an UptoSvmPayload to a map for JSON marshaling
func (p *UptoSvmPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"transaction": p.Transaction,
		"authorization": map[string]interface{}{
			"owner":     p.Authorization.Owner,
			"delegate":  p.Authorization.Delegate,
			"mint":      p.Authorization.Mint,
			"maxAmount": p.Authorization.MaxAmount,
			"sourceATA": p.Authorization.SourceATA,
		},
		"paymentNonce": p.PaymentNonce,
	}
}

// UptoPayloadFromMap creates an UptoSvmPayload from a map
func UptoPayloadFromMap(data map[string]interface{}) (*UptoSvmPayload, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload UptoSvmPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.Transaction == "" {
		return nil, fmt.Errorf("missing transaction field in payload")
	}

	if payload.Authorization.Owner == "" {
		return nil, fmt.Errorf("missing authorization.owner field in payload")
	}

	if payload.Authorization.Delegate == "" {
		return nil, fmt.Errorf("missing authorization.delegate field in payload")
	}

	if payload.PaymentNonce == "" {
		return nil, fmt.Errorf("missing paymentNonce field in payload")
	}

	return &payload, nil
}

// UptoClientSvmSigner defines client-side operations for SVM upto payments
type UptoClientSvmSigner interface {
	// Address returns the signer's Solana address
	Address() solana.PublicKey

	// SignTransaction signs a Solana transaction
	SignTransaction(ctx context.Context, tx *solana.Transaction) error

	// GetAssociatedTokenAddress returns the ATA for the given mint
	GetAssociatedTokenAddress(ctx context.Context, mint solana.PublicKey) (solana.PublicKey, error)
}

// UptoFacilitatorSvmSigner defines facilitator operations for SVM upto payments
type UptoFacilitatorSvmSigner interface {
	// GetAddresses returns all addresses this facilitator can use as fee payers/delegates
	GetAddresses(ctx context.Context, network string) []solana.PublicKey

	// SignTransaction signs a transaction with the signer matching feePayer
	SignTransaction(ctx context.Context, tx *solana.Transaction, feePayer solana.PublicKey, network string) error

	// SimulateTransaction simulates a signed transaction to verify it would succeed
	SimulateTransaction(ctx context.Context, tx *solana.Transaction, network string) error

	// SendTransaction sends a signed transaction to the network
	SendTransaction(ctx context.Context, tx *solana.Transaction, network string) (solana.Signature, error)

	// ConfirmTransaction waits for transaction confirmation
	ConfirmTransaction(ctx context.Context, signature solana.Signature, network string) error

	// GetTokenBalance returns the token balance for an account
	GetTokenBalance(ctx context.Context, tokenAccount solana.PublicKey, network string) (uint64, error)

	// GetDelegatedAmount returns the delegated amount for an owner->delegate pair
	GetDelegatedAmount(ctx context.Context, tokenAccount solana.PublicKey, network string) (*DelegateInfo, error)

	// CreateTransferTransaction creates a transfer transaction using delegated authority
	CreateTransferTransaction(ctx context.Context, params TransferParams) (*solana.Transaction, error)

	// GetRecentBlockhash returns a recent blockhash for transaction building
	GetRecentBlockhash(ctx context.Context, network string) (solana.Hash, error)
}

// DelegateInfo contains delegation information for a token account
type DelegateInfo struct {
	// Delegate is the delegated address (nil if no delegate)
	Delegate *solana.PublicKey

	// Amount is the delegated amount
	Amount uint64
}

// TransferParams contains parameters for creating a transfer transaction
type TransferParams struct {
	// Source is the source token account (owner's ATA)
	Source solana.PublicKey

	// Destination is the destination token account (payTo's ATA)
	Destination solana.PublicKey

	// Mint is the token mint address
	Mint solana.PublicKey

	// Authority is the delegate (facilitator) address
	Authority solana.PublicKey

	// Amount is the transfer amount
	Amount uint64

	// Decimals is the token decimals (for TransferChecked)
	Decimals uint8

	// FeePayer is the fee payer address
	FeePayer solana.PublicKey

	// Network is the network identifier
	Network string
}

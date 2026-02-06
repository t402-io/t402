// Package upto implements the upto payment scheme for TON.
// The upto scheme allows clients to authorize payments up to a maximum amount,
// with the actual settlement amount determined at settlement time.
//
// Note: TON Jettons (TEP-74) don't have native approve/transferFrom like EVM.
// This implementation uses a two-step pattern:
// 1. Client signs a transfer of maxAmount to the facilitator's address
// 2. Facilitator broadcasts the transfer, then sends settleAmount to payTo
//    and refunds (maxAmount - settleAmount) back to the client.
package upto

import (
	"context"
	"encoding/json"
	"fmt"
)

// SchemeUpto is the scheme identifier for upto payments
const SchemeUpto = "upto"

// UptoTonPayload represents a TON upto payment payload.
// It contains a signed transfer message to the facilitator's holding address.
type UptoTonPayload struct {
	// SignedBoc is the base64 encoded signed external message (BOC format)
	SignedBoc string `json:"signedBoc"`

	// Authorization contains transfer metadata for verification
	Authorization UptoTonAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce for replay protection (hex string)
	PaymentNonce string `json:"paymentNonce"`
}

// UptoTonAuthorization contains upto authorization metadata
type UptoTonAuthorization struct {
	// From is the sender wallet address (friendly format, bounceable)
	From string `json:"from"`

	// Facilitator is the facilitator's holding address that receives the transfer
	Facilitator string `json:"facilitator"`

	// JettonMaster is the Jetton master contract address
	JettonMaster string `json:"jettonMaster"`

	// MaxAmount is the maximum authorized amount in smallest units (as string)
	MaxAmount string `json:"maxAmount"`

	// TonAmount is the gas amount in nanoTON (as string)
	TonAmount string `json:"tonAmount"`

	// ValidUntil is the Unix timestamp (seconds) until which the message is valid
	ValidUntil int64 `json:"validUntil"`

	// Seqno is the wallet sequence number for replay protection
	Seqno int64 `json:"seqno"`

	// QueryId is the unique message ID (as string for large numbers)
	QueryId string `json:"queryId"`
}

// UptoTonExtra contains upto-specific extra fields for payment requirements
type UptoTonExtra struct {
	// Facilitator is the facilitator address that will receive the initial transfer
	Facilitator string `json:"facilitator,omitempty"`

	// MaxAmount is the maximum payment amount authorized
	MaxAmount string `json:"maxAmount,omitempty"`

	// MinAmount is the minimum acceptable settlement amount
	MinAmount string `json:"minAmount,omitempty"`

	// Unit is the billing unit (e.g., "token", "request", "second")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`
}

// ToMap converts an UptoTonPayload to a map for JSON marshaling
func (p *UptoTonPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signedBoc": p.SignedBoc,
		"authorization": map[string]interface{}{
			"from":         p.Authorization.From,
			"facilitator":  p.Authorization.Facilitator,
			"jettonMaster": p.Authorization.JettonMaster,
			"maxAmount":    p.Authorization.MaxAmount,
			"tonAmount":    p.Authorization.TonAmount,
			"validUntil":   p.Authorization.ValidUntil,
			"seqno":        p.Authorization.Seqno,
			"queryId":      p.Authorization.QueryId,
		},
		"paymentNonce": p.PaymentNonce,
	}
}

// UptoPayloadFromMap creates an UptoTonPayload from a map
func UptoPayloadFromMap(data map[string]interface{}) (*UptoTonPayload, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload UptoTonPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.SignedBoc == "" {
		return nil, fmt.Errorf("missing signedBoc field in payload")
	}

	if payload.Authorization.From == "" {
		return nil, fmt.Errorf("missing authorization.from field in payload")
	}

	if payload.Authorization.Facilitator == "" {
		return nil, fmt.Errorf("missing authorization.facilitator field in payload")
	}

	if payload.PaymentNonce == "" {
		return nil, fmt.Errorf("missing paymentNonce field in payload")
	}

	return &payload, nil
}

// UptoClientTonSigner defines client-side operations for TON upto payments
type UptoClientTonSigner interface {
	// Address returns the signer's TON address (friendly format)
	Address() string

	// GetSeqno returns the current wallet sequence number
	GetSeqno(ctx context.Context) (int64, error)

	// SignMessage signs a Jetton transfer message and returns the BOC
	SignMessage(ctx context.Context, params SignMessageParams) (string, error)
}

// SignMessageParams contains parameters for signing a message
type SignMessageParams struct {
	// To is the destination address (Jetton wallet address)
	To string

	// Value is the TON amount for gas (in nanoTON)
	Value uint64

	// Body is the Jetton transfer message body (as base64 BOC)
	Body string

	// Timeout is the message validity duration in seconds
	Timeout int64
}

// UptoFacilitatorTonSigner defines facilitator operations for TON upto payments
type UptoFacilitatorTonSigner interface {
	// GetAddresses returns all addresses this facilitator can use
	GetAddresses(ctx context.Context, network string) []string

	// GetJettonBalance returns the Jetton balance for an owner
	GetJettonBalance(ctx context.Context, params GetJettonBalanceParams) (string, error)

	// GetJettonWalletAddress returns the Jetton wallet address for an owner
	GetJettonWalletAddress(ctx context.Context, params GetJettonWalletParams) (string, error)

	// VerifyMessage verifies a signed BOC message for upto transfer
	VerifyMessage(ctx context.Context, params VerifyMessageParams) (*VerifyMessageResult, error)

	// SendExternalMessage sends a pre-signed external message to the network
	SendExternalMessage(ctx context.Context, signedBoc string, network string) (string, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(ctx context.Context, params WaitForTransactionParams) (*TransactionConfirmation, error)

	// GetSeqno returns the current wallet sequence number
	GetSeqno(ctx context.Context, address string, network string) (int64, error)

	// IsDeployed checks if a wallet is deployed
	IsDeployed(ctx context.Context, address string, network string) (bool, error)

	// TransferJetton transfers Jettons from facilitator to destination
	TransferJetton(ctx context.Context, params TransferJettonParams) (*TransferJettonResult, error)
}

// GetJettonBalanceParams contains parameters for getting Jetton balance
type GetJettonBalanceParams struct {
	OwnerAddress        string
	JettonMasterAddress string
	Network             string
}

// GetJettonWalletParams contains parameters for getting Jetton wallet address
type GetJettonWalletParams struct {
	OwnerAddress        string
	JettonMasterAddress string
	Network             string
}

// VerifyMessageParams contains parameters for verifying a message
type VerifyMessageParams struct {
	SignedBoc        string
	ExpectedFrom     string
	ExpectedTransfer ExpectedTransfer
	Network          string
}

// ExpectedTransfer contains expected transfer details for verification
type ExpectedTransfer struct {
	JettonAmount string
	Destination  string
	JettonMaster string
}

// VerifyMessageResult contains the result of message verification
type VerifyMessageResult struct {
	Valid    bool          `json:"valid"`
	Reason   string        `json:"reason,omitempty"`
	Transfer *TransferInfo `json:"transfer,omitempty"`
}

// TransferInfo contains parsed transfer information
type TransferInfo struct {
	From         string `json:"from"`
	To           string `json:"to"`
	JettonAmount string `json:"jettonAmount"`
	QueryId      string `json:"queryId"`
}

// WaitForTransactionParams contains parameters for waiting for transaction
type WaitForTransactionParams struct {
	Address string
	Seqno   int64
	Timeout int64
	Network string
}

// TransactionConfirmation contains transaction confirmation result
type TransactionConfirmation struct {
	Success bool   `json:"success"`
	Lt      string `json:"lt,omitempty"`
	Hash    string `json:"hash,omitempty"`
	Error   string `json:"error,omitempty"`
}

// TransferJettonParams contains parameters for transferring Jettons
type TransferJettonParams struct {
	// JettonMaster is the Jetton master contract address
	JettonMaster string

	// Destination is the recipient address
	Destination string

	// Amount is the Jetton amount in smallest units
	Amount string

	// Network is the network identifier
	Network string

	// ResponseDestination is where to send excess gas (usually the sender)
	ResponseDestination string

	// ForwardTonAmount is the amount of TON to forward with the transfer
	ForwardTonAmount string
}

// TransferJettonResult contains the result of a Jetton transfer
type TransferJettonResult struct {
	Success bool   `json:"success"`
	TxHash  string `json:"txHash,omitempty"`
	Error   string `json:"error,omitempty"`
}

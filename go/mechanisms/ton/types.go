package ton

import (
	"context"
	"encoding/json"
	"fmt"
)

// ExactTonPayload represents a TON payment payload
type ExactTonPayload struct {
	// SignedBoc is the base64 encoded signed external message (BOC format)
	SignedBoc string `json:"signedBoc"`

	// Authorization contains transfer metadata for verification
	Authorization ExactTonAuthorization `json:"authorization"`
}

// ExactTonAuthorization contains transfer authorization metadata
type ExactTonAuthorization struct {
	// From is the sender wallet address (friendly format, bounceable)
	From string `json:"from"`

	// To is the recipient wallet address
	To string `json:"to"`

	// JettonMaster is the Jetton master contract address
	JettonMaster string `json:"jettonMaster"`

	// JettonAmount is the amount in smallest units (as string for large numbers)
	JettonAmount string `json:"jettonAmount"`

	// TonAmount is the gas amount in nanoTON (as string)
	TonAmount string `json:"tonAmount"`

	// ValidUntil is the Unix timestamp (seconds) until which the message is valid
	ValidUntil int64 `json:"validUntil"`

	// Seqno is the wallet sequence number for replay protection
	Seqno int64 `json:"seqno"`

	// QueryId is the unique message ID (as string for large numbers)
	QueryId string `json:"queryId"`
}

// ExactTonPayloadV2 - alias for v2 compatibility
type ExactTonPayloadV2 = ExactTonPayload

// ClientTonSigner defines client-side operations for TON
type ClientTonSigner interface {
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

// FacilitatorTonSigner defines facilitator operations for TON
type FacilitatorTonSigner interface {
	// GetAddresses returns all addresses this facilitator can use
	GetAddresses(ctx context.Context, network string) []string

	// GetJettonBalance returns the Jetton balance for an owner
	GetJettonBalance(ctx context.Context, params GetJettonBalanceParams) (string, error)

	// GetJettonWalletAddress returns the Jetton wallet address for an owner
	GetJettonWalletAddress(ctx context.Context, params GetJettonWalletParams) (string, error)

	// VerifyMessage verifies a signed BOC message
	VerifyMessage(ctx context.Context, params VerifyMessageParams) (*VerifyMessageResult, error)

	// SendExternalMessage sends a pre-signed external message to the network
	SendExternalMessage(ctx context.Context, signedBoc string, network string) (string, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(ctx context.Context, params WaitForTransactionParams) (*TransactionConfirmation, error)

	// GetSeqno returns the current wallet sequence number
	GetSeqno(ctx context.Context, address string, network string) (int64, error)

	// IsDeployed checks if a wallet is deployed
	IsDeployed(ctx context.Context, address string, network string) (bool, error)
}

// GetJettonBalanceParams contains parameters for getting Jetton balance
type GetJettonBalanceParams struct {
	OwnerAddress       string
	JettonMasterAddress string
	Network            string
}

// GetJettonWalletParams contains parameters for getting Jetton wallet address
type GetJettonWalletParams struct {
	OwnerAddress       string
	JettonMasterAddress string
	Network            string
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
	JettonAmount  string
	Destination   string
	JettonMaster  string
}

// VerifyMessageResult contains the result of message verification
type VerifyMessageResult struct {
	Valid    bool   `json:"valid"`
	Reason   string `json:"reason,omitempty"`
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

// AssetInfo contains information about a Jetton token
type AssetInfo struct {
	MasterAddress string // Jetton master contract address
	Symbol        string // Token symbol (e.g., "USDT")
	Name          string // Token name (e.g., "Tether USD")
	Decimals      int    // Token decimals
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	Name            string               // Network name
	CAIP2           string               // CAIP-2 identifier
	Endpoint        string               // RPC endpoint
	DefaultAsset    AssetInfo            // Default Jetton (USDT)
	SupportedAssets map[string]AssetInfo // Symbol -> AssetInfo
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	Endpoint string // Custom RPC endpoint
}

// ToMap converts an ExactTonPayload to a map for JSON marshaling
func (p *ExactTonPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signedBoc": p.SignedBoc,
		"authorization": map[string]interface{}{
			"from":         p.Authorization.From,
			"to":           p.Authorization.To,
			"jettonMaster": p.Authorization.JettonMaster,
			"jettonAmount": p.Authorization.JettonAmount,
			"tonAmount":    p.Authorization.TonAmount,
			"validUntil":   p.Authorization.ValidUntil,
			"seqno":        p.Authorization.Seqno,
			"queryId":      p.Authorization.QueryId,
		},
	}
}

// PayloadFromMap creates an ExactTonPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactTonPayload, error) {
	// Try to convert to JSON and back for type safety
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload ExactTonPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.SignedBoc == "" {
		return nil, fmt.Errorf("missing signedBoc field in payload")
	}

	if payload.Authorization.From == "" {
		return nil, fmt.Errorf("missing authorization.from field in payload")
	}

	return &payload, nil
}

// IsValidNetwork checks if the network is supported for TON
func IsValidNetwork(network string) bool {
	_, ok := NetworkConfigs[network]
	return ok
}

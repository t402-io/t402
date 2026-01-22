package aptos

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme on Aptos
type ExactDirectPayload struct {
	TxHash          string `json:"txHash"`
	From            string `json:"from"`
	To              string `json:"to"`
	Amount          string `json:"amount"`
	MetadataAddress string `json:"metadataAddress"`
	Version         string `json:"version,omitempty"`
}

// PayloadFromMap creates an ExactDirectPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactDirectPayload, error) {
	payload := &ExactDirectPayload{}

	if txHash, ok := data["txHash"].(string); ok {
		payload.TxHash = txHash
	}
	if from, ok := data["from"].(string); ok {
		payload.From = from
	}
	if to, ok := data["to"].(string); ok {
		payload.To = to
	}
	if amount, ok := data["amount"].(string); ok {
		payload.Amount = amount
	}
	if metadataAddress, ok := data["metadataAddress"].(string); ok {
		payload.MetadataAddress = metadataAddress
	}
	if version, ok := data["version"].(string); ok {
		payload.Version = version
	}

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{
		"txHash":          p.TxHash,
		"from":            p.From,
		"to":              p.To,
		"amount":          p.Amount,
		"metadataAddress": p.MetadataAddress,
	}
	if p.Version != "" {
		m["version"] = p.Version
	}
	return m
}

// FacilitatorAptosSigner defines the interface for Aptos facilitator operations
type FacilitatorAptosSigner interface {
	// GetAddresses returns the facilitator's Aptos addresses
	GetAddresses(ctx context.Context, network string) []string

	// QueryTransaction queries a transaction by hash
	QueryTransaction(ctx context.Context, txHash string) (*TransactionResult, error)

	// GetBalance gets the token balance for an account
	GetBalance(ctx context.Context, address string, metadataAddress string) (string, error)
}

// TransactionResult represents the result of an Aptos transaction query
type TransactionResult struct {
	Hash           string                 `json:"hash"`
	Version        string                 `json:"version"`
	Success        bool                   `json:"success"`
	VMStatus       string                 `json:"vm_status"`
	Sender         string                 `json:"sender"`
	SequenceNumber string                 `json:"sequence_number"`
	GasUsed        string                 `json:"gas_used"`
	Timestamp      string                 `json:"timestamp"`
	Payload        *TransactionPayload    `json:"payload,omitempty"`
	Events         []TransactionEvent     `json:"events,omitempty"`
	Changes        []StateChange          `json:"changes,omitempty"`
}

// TransactionPayload represents the payload of an Aptos transaction
type TransactionPayload struct {
	Type          string        `json:"type"`
	Function      string        `json:"function,omitempty"`
	TypeArguments []string      `json:"type_arguments,omitempty"`
	Arguments     []interface{} `json:"arguments,omitempty"`
}

// TransactionEvent represents an event in an Aptos transaction
type TransactionEvent struct {
	GUID struct {
		CreationNumber string `json:"creation_number"`
		AccountAddress string `json:"account_address"`
	} `json:"guid"`
	SequenceNumber string                 `json:"sequence_number"`
	Type           string                 `json:"type"`
	Data           map[string]interface{} `json:"data"`
}

// StateChange represents a state change in an Aptos transaction
type StateChange struct {
	Type         string `json:"type"`
	Address      string `json:"address"`
	StateKeyHash string `json:"state_key_hash"`
	Data         *struct {
		Type string                 `json:"type"`
		Data map[string]interface{} `json:"data"`
	} `json:"data,omitempty"`
}

// ParsedFATransfer represents a parsed fungible asset transfer
type ParsedFATransfer struct {
	From            string
	To              string
	Amount          string
	MetadataAddress string
}

// ExtractTransferDetails extracts transfer details from a transaction
func ExtractTransferDetails(tx *TransactionResult) *ParsedFATransfer {
	if tx == nil || !tx.Success {
		return nil
	}
	if tx.Payload == nil || tx.Payload.Type != "entry_function_payload" {
		return nil
	}

	// Check if it's a FA transfer
	if !strings.Contains(tx.Payload.Function, "primary_fungible_store::transfer") {
		return nil
	}

	// Extract arguments
	args := tx.Payload.Arguments
	if len(args) < 3 {
		return nil
	}

	// Arguments for primary_fungible_store::transfer:
	// [0] - metadata object address
	// [1] - recipient address
	// [2] - amount
	metadataAddress, ok := args[0].(string)
	if !ok {
		return nil
	}
	to, ok := args[1].(string)
	if !ok {
		return nil
	}

	// Amount can be string or json.Number
	var amount string
	switch v := args[2].(type) {
	case string:
		amount = v
	case json.Number:
		amount = v.String()
	case float64:
		amount = json.Number(fmt.Sprintf("%.0f", v)).String()
	default:
		return nil
	}

	return &ParsedFATransfer{
		From:            tx.Sender,
		To:              to,
		Amount:          amount,
		MetadataAddress: metadataAddress,
	}
}

// IsValidAddress checks if an address is valid
func IsValidAddress(address string) bool {
	if address == "" {
		return false
	}
	if !strings.HasPrefix(address, "0x") {
		return false
	}
	hex := address[2:]
	if len(hex) == 0 || len(hex) > 64 {
		return false
	}
	for _, c := range hex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// IsValidTxHash checks if a transaction hash is valid
func IsValidTxHash(txHash string) bool {
	if txHash == "" {
		return false
	}
	if !strings.HasPrefix(txHash, "0x") {
		return false
	}
	hex := txHash[2:]
	// Transaction hash is 64 hex characters
	if len(hex) != 64 {
		return false
	}
	for _, c := range hex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// CompareAddresses compares two Aptos addresses (case-insensitive)
func CompareAddresses(addr1, addr2 string) bool {
	return strings.ToLower(normalizeAddress(addr1)) == strings.ToLower(normalizeAddress(addr2))
}

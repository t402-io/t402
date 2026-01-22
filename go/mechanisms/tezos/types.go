package tezos

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme on Tezos
type ExactDirectPayload struct {
	OpHash          string `json:"opHash"`
	From            string `json:"from"`
	To              string `json:"to"`
	Amount          string `json:"amount"`
	ContractAddress string `json:"contractAddress"`
	TokenID         int    `json:"tokenId"`
}

// PayloadFromMap creates an ExactDirectPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactDirectPayload, error) {
	payload := &ExactDirectPayload{}

	if opHash, ok := data["opHash"].(string); ok {
		payload.OpHash = opHash
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
	if contractAddress, ok := data["contractAddress"].(string); ok {
		payload.ContractAddress = contractAddress
	}
	if tokenID, ok := data["tokenId"].(float64); ok {
		payload.TokenID = int(tokenID)
	} else if tokenID, ok := data["tokenId"].(int); ok {
		payload.TokenID = tokenID
	}

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"opHash":          p.OpHash,
		"from":            p.From,
		"to":              p.To,
		"amount":          p.Amount,
		"contractAddress": p.ContractAddress,
		"tokenId":         p.TokenID,
	}
}

// FacilitatorTezosSigner defines the interface for Tezos facilitator operations
type FacilitatorTezosSigner interface {
	// GetAddresses returns the facilitator's Tezos addresses
	GetAddresses(ctx context.Context, network string) []string

	// QueryOperation queries an operation by hash
	QueryOperation(ctx context.Context, opHash string) (*OperationResult, error)

	// GetBalance gets the token balance for an account
	GetBalance(ctx context.Context, contractAddress string, tokenID int, address string) (string, error)
}

// OperationResult represents the result of a Tezos operation query from TzKT
type OperationResult struct {
	Hash       string          `json:"hash"`
	Level      int64           `json:"level"`
	Timestamp  string          `json:"timestamp"`
	Status     string          `json:"status"` // applied, failed, backtracked, skipped
	Sender     *OperationActor `json:"sender"`
	Target     *OperationActor `json:"target,omitempty"`
	Entrypoint string          `json:"entrypoint,omitempty"`
	Parameter  json.RawMessage `json:"parameter,omitempty"`
	Amount     int64           `json:"amount,omitempty"`
	Errors     []OperationError `json:"errors,omitempty"`
}

// OperationActor represents an address in an operation
type OperationActor struct {
	Address string `json:"address"`
	Alias   string `json:"alias,omitempty"`
}

// OperationError represents an error in an operation
type OperationError struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}

// FA2TransferParam represents the structure of FA2 transfer parameter
type FA2TransferParam struct {
	From string                 `json:"from_"`
	Txs  []FA2TransferTx        `json:"txs"`
}

// FA2TransferTx represents a single transfer in FA2
type FA2TransferTx struct {
	To      string `json:"to_"`
	TokenID int    `json:"token_id"`
	Amount  string `json:"amount"`
}

// ParsedFA2Transfer represents a parsed FA2 transfer
type ParsedFA2Transfer struct {
	From            string
	To              string
	Amount          string
	ContractAddress string
	TokenID         int
}

// ExtractTransferDetails extracts transfer details from an operation
func ExtractTransferDetails(op *OperationResult) *ParsedFA2Transfer {
	if op == nil || op.Status != "applied" {
		return nil
	}
	if op.Entrypoint != FA2TransferEntrypoint {
		return nil
	}
	if op.Target == nil {
		return nil
	}

	// Parse the parameter JSON
	var params []FA2TransferParam
	if err := json.Unmarshal(op.Parameter, &params); err != nil {
		// Try parsing as a single object
		var singleParam FA2TransferParam
		if err := json.Unmarshal(op.Parameter, &singleParam); err != nil {
			return nil
		}
		params = []FA2TransferParam{singleParam}
	}

	if len(params) == 0 || len(params[0].Txs) == 0 {
		return nil
	}

	firstParam := params[0]
	firstTx := firstParam.Txs[0]

	return &ParsedFA2Transfer{
		From:            firstParam.From,
		To:              firstTx.To,
		Amount:          firstTx.Amount,
		ContractAddress: op.Target.Address,
		TokenID:         firstTx.TokenID,
	}
}

// IsValidAddress checks if an address is valid Tezos address
func IsValidAddress(address string) bool {
	if address == "" {
		return false
	}
	// tz1, tz2, tz3 for implicit accounts, KT1 for contracts
	if !strings.HasPrefix(address, "tz1") &&
		!strings.HasPrefix(address, "tz2") &&
		!strings.HasPrefix(address, "tz3") &&
		!strings.HasPrefix(address, "KT1") {
		return false
	}
	// Base58 check - length should be 36 characters
	return len(address) == 36
}

// IsValidOperationHash checks if an operation hash is valid
func IsValidOperationHash(opHash string) bool {
	if opHash == "" {
		return false
	}
	// Operation hashes start with 'o' and are 51 characters
	return strings.HasPrefix(opHash, "o") && len(opHash) == 51
}

// CompareAddresses compares two Tezos addresses
func CompareAddresses(addr1, addr2 string) bool {
	return addr1 == addr2
}

// FormatAmount formats an amount with decimals
func FormatAmount(amount string, decimals int) string {
	// Simple implementation - for display purposes
	if len(amount) <= decimals {
		return fmt.Sprintf("0.%s", strings.Repeat("0", decimals-len(amount))+amount)
	}
	return fmt.Sprintf("%s.%s", amount[:len(amount)-decimals], amount[len(amount)-decimals:])
}

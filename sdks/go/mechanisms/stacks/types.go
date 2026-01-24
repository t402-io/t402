package stacks

import (
	"context"
	"math/big"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme on Stacks
type ExactDirectPayload struct {
	TxId            string `json:"txId"`
	From            string `json:"from"`
	To              string `json:"to"`
	Amount          string `json:"amount"`
	ContractAddress string `json:"contractAddress"`
}

// PayloadFromMap creates an ExactDirectPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactDirectPayload, error) {
	payload := &ExactDirectPayload{}

	if txId, ok := data["txId"].(string); ok {
		payload.TxId = txId
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

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"txId":            p.TxId,
		"from":            p.From,
		"to":              p.To,
		"amount":          p.Amount,
		"contractAddress": p.ContractAddress,
	}
}

// StacksTransactionResult represents the result of querying a Stacks transaction
type StacksTransactionResult struct {
	TxId           string            `json:"tx_id"`
	TxStatus       string            `json:"tx_status"` // "success", "pending", "abort_by_response", "abort_by_post_condition"
	TxType         string            `json:"tx_type"`   // "contract_call"
	ContractCall   *ContractCallInfo `json:"contract_call"`
	PostConditions []PostCondition   `json:"post_conditions"`
	BlockHeight    int64             `json:"block_height"`
	BurnBlockTime  int64             `json:"burn_block_time"`
	SenderAddress  string            `json:"sender_address"`
}

// ContractCallInfo represents the contract call details in a transaction
type ContractCallInfo struct {
	ContractID   string        `json:"contract_id"`
	FunctionName string        `json:"function_name"`
	FunctionArgs []FunctionArg `json:"function_args"`
}

// FunctionArg represents a function argument in a contract call
type FunctionArg struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Repr string `json:"repr"`
}

// PostCondition represents a post-condition in a transaction
type PostCondition struct {
	Type          string      `json:"type"`
	ConditionCode string      `json:"condition_code"`
	Amount        string      `json:"amount"`
	Principal     interface{} `json:"principal"`
	AssetValue    *AssetValue `json:"asset_value"`
}

// AssetValue represents asset information in a post-condition
type AssetValue struct {
	ContractAddress string `json:"contract_address"`
	AssetName       string `json:"asset_name"`
}

// ClientStacksSigner defines the interface for signing and submitting Stacks transactions
type ClientStacksSigner interface {
	// Address returns the principal address of the signer
	Address() string

	// TransferToken signs and submits a SIP-010 token transfer transaction.
	// Returns the transaction ID (0x-prefixed hex string) on success.
	//
	// Args:
	//   ctx: Context for cancellation and timeouts
	//   contractAddress: The SIP-010 token contract address (e.g., "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc")
	//   to: The recipient principal address
	//   amount: The atomic amount to transfer
	//
	// Returns:
	//   txId: The 0x-prefixed transaction hash
	//   err: Error if the transaction fails
	TransferToken(ctx context.Context, contractAddress, to string, amount *big.Int) (txId string, err error)
}

// FacilitatorStacksSigner defines the interface for Stacks facilitator operations
type FacilitatorStacksSigner interface {
	// GetAddresses returns the facilitator's principal addresses for a given network
	GetAddresses(network string) []string

	// QueryTransaction queries a transaction by its ID and returns the result
	//
	// Args:
	//   ctx: Context for cancellation and timeouts
	//   txId: The 0x-prefixed transaction hash
	//
	// Returns:
	//   The transaction result or an error if the query fails
	QueryTransaction(ctx context.Context, txId string) (*StacksTransactionResult, error)
}

// ParsedTransfer represents a parsed SIP-010 token transfer from a transaction
type ParsedTransfer struct {
	From            string
	To              string
	Amount          string
	ContractAddress string
	Success         bool
}

// ExtractTransfer extracts transfer details from a Stacks transaction result.
// It validates that the transaction is a successful SIP-010 transfer call.
func ExtractTransfer(result *StacksTransactionResult) *ParsedTransfer {
	if result == nil {
		return nil
	}

	// Must be a successful transaction
	if result.TxStatus != "success" {
		return nil
	}

	// Must be a contract call
	if result.TxType != "contract_call" {
		return nil
	}

	if result.ContractCall == nil {
		return nil
	}

	// Must be a transfer function
	if result.ContractCall.FunctionName != "transfer" {
		return nil
	}

	// Extract transfer parameters from function args
	var to string
	var amount string

	for _, arg := range result.ContractCall.FunctionArgs {
		switch arg.Name {
		case "amount":
			amount = extractUintFromRepr(arg.Repr)
		case "recipient", "to":
			to = extractPrincipalFromRepr(arg.Repr)
		}
	}

	if to == "" || amount == "" {
		return nil
	}

	return &ParsedTransfer{
		From:            result.SenderAddress,
		To:              to,
		Amount:          amount,
		ContractAddress: result.ContractCall.ContractID,
		Success:         true,
	}
}

// extractUintFromRepr extracts a uint value from a Clarity repr string (e.g., "u1000000" -> "1000000")
func extractUintFromRepr(repr string) string {
	if len(repr) > 1 && repr[0] == 'u' {
		return repr[1:]
	}
	return repr
}

// extractPrincipalFromRepr extracts a principal from a Clarity repr string (e.g., "'SP..." -> "SP...")
func extractPrincipalFromRepr(repr string) string {
	if len(repr) > 1 && repr[0] == '\'' {
		return repr[1:]
	}
	return repr
}

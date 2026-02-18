package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
	"github.com/t402-io/t402/sdks/go/types"
)

// Permit2TransferFromABI is the ABI for the Permit2 permitTransferFrom function
var Permit2TransferFromABI = []byte(`[
	{
		"inputs": [
			{
				"components": [
					{
						"components": [
							{"name": "token", "type": "address"},
							{"name": "amount", "type": "uint256"}
						],
						"name": "permitted",
						"type": "tuple"
					},
					{"name": "nonce", "type": "uint256"},
					{"name": "deadline", "type": "uint256"}
				],
				"name": "permit",
				"type": "tuple"
			},
			{
				"components": [
					{"name": "to", "type": "address"},
					{"name": "requestedAmount", "type": "uint256"}
				],
				"name": "transferDetails",
				"type": "tuple"
			},
			{"name": "owner", "type": "address"},
			{"name": "signature", "type": "bytes"}
		],
		"name": "permitTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// Permit2EvmScheme implements the SchemeNetworkFacilitator interface for EVM Permit2 payments
type Permit2EvmScheme struct {
	signer evm.FacilitatorEvmSigner
}

// NewPermit2EvmScheme creates a new Permit2EvmScheme facilitator
func NewPermit2EvmScheme(signer evm.FacilitatorEvmSigner) *Permit2EvmScheme {
	return &Permit2EvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (f *Permit2EvmScheme) Scheme() string {
	return permit2.SchemePermit2
}

// CaipFamily returns the CAIP family pattern
func (f *Permit2EvmScheme) CaipFamily() string {
	return "eip155:*"
}

// GetExtra returns Permit2-specific extra data
func (f *Permit2EvmScheme) GetExtra(_ t402.Network) map[string]interface{} {
	return map[string]interface{}{
		"permit2Address": permit2.Permit2Address,
	}
}

// GetSigners returns signer addresses used by this facilitator
func (f *Permit2EvmScheme) GetSigners(_ t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a Permit2 payment payload
func (f *Permit2EvmScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != permit2.SchemePermit2 {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network matches
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse Permit2 payload
	p2Payload, err := permit2.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if p2Payload.Owner == "" || p2Payload.Permit.Permitted.Token == "" {
		return nil, t402.NewVerifyError("invalid_payload_structure", "", network, nil)
	}

	// Verify token matches
	if !strings.EqualFold(p2Payload.Permit.Permitted.Token, requirements.Asset) {
		return nil, t402.NewVerifyError("token_mismatch", p2Payload.Owner, network, nil)
	}

	// Verify recipient matches
	if !strings.EqualFold(p2Payload.TransferDetails.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", p2Payload.Owner, network, nil)
	}

	// Verify permitted amount
	permittedAmount, ok := new(big.Int).SetString(p2Payload.Permit.Permitted.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_permitted_amount", p2Payload.Owner, network, nil)
	}
	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", p2Payload.Owner, network,
			fmt.Errorf("invalid amount: %s", requirements.Amount))
	}

	if permittedAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_permitted_amount", p2Payload.Owner, network, nil)
	}

	// Verify requested amount
	requestedAmount, ok := new(big.Int).SetString(p2Payload.TransferDetails.RequestedAmount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_requested_amount", p2Payload.Owner, network, nil)
	}
	if requestedAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_requested_amount", p2Payload.Owner, network, nil)
	}

	// Check balance
	balance, err := f.signer.GetBalance(ctx, p2Payload.Owner, requirements.Asset)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_balance", p2Payload.Owner, network, err)
	}
	if balance.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_balance", p2Payload.Owner, network, nil)
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   p2Payload.Owner,
	}, nil
}

// Settle settles a Permit2 payment on-chain
func (f *Permit2EvmScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// First verify the payment
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	// Parse Permit2 payload
	p2Payload, err := permit2.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Parse signature
	signatureBytes, err := evm.HexToBytes(p2Payload.Signature)
	if err != nil {
		return nil, t402.NewSettleError("invalid_signature_format", verifyResp.Payer, network, "", err)
	}

	// Parse amounts
	permittedAmount, _ := new(big.Int).SetString(p2Payload.Permit.Permitted.Amount, 10)
	nonce, _ := new(big.Int).SetString(p2Payload.Permit.Nonce, 10)
	deadline, _ := new(big.Int).SetString(p2Payload.Permit.Deadline, 10)
	requestedAmount, _ := new(big.Int).SetString(p2Payload.TransferDetails.RequestedAmount, 10)

	// Call permitTransferFrom on the Permit2 contract
	// Note: The ABI encoder handles struct encoding
	txHash, err := f.signer.WriteContract(
		ctx,
		permit2.Permit2Address,
		Permit2TransferFromABI,
		"permitTransferFrom",
		// permit struct
		p2Payload.Permit.Permitted.Token,
		permittedAmount,
		nonce,
		deadline,
		// transferDetails struct
		p2Payload.TransferDetails.To,
		requestedAmount,
		// owner
		p2Payload.Owner,
		// signature
		signatureBytes,
	)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_execute_transfer", verifyResp.Payer, network, "", err)
	}

	// Wait for transaction confirmation
	receipt, err := f.signer.WaitForTransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_receipt", verifyResp.Payer, network, txHash, err)
	}

	if receipt.Status != evm.TxStatusSuccess {
		return nil, t402.NewSettleError("transaction_failed", verifyResp.Payer, network, txHash, nil)
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: txHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

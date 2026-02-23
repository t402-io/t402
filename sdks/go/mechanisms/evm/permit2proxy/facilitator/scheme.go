package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2proxy"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactProxySettleABI is the ABI for the T402ExactPermit2Proxy settle function
var ExactProxySettleABI = []byte(`[
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
			{"name": "owner", "type": "address"},
			{
				"components": [
					{"name": "to", "type": "address"},
					{"name": "facilitator", "type": "address"},
					{"name": "validAfter", "type": "uint256"}
				],
				"name": "witness",
				"type": "tuple"
			},
			{"name": "signature", "type": "bytes"}
		],
		"name": "settle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// UptoProxySettleABI is the ABI for the T402UptoPermit2Proxy settle function
var UptoProxySettleABI = []byte(`[
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
			{"name": "amount", "type": "uint256"},
			{"name": "owner", "type": "address"},
			{
				"components": [
					{"name": "to", "type": "address"},
					{"name": "facilitator", "type": "address"},
					{"name": "validAfter", "type": "uint256"}
				],
				"name": "witness",
				"type": "tuple"
			},
			{"name": "signature", "type": "bytes"}
		],
		"name": "settle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// Permit2ProxyEvmScheme implements the SchemeNetworkFacilitator interface for EVM Permit2 Proxy payments
type Permit2ProxyEvmScheme struct {
	signer evm.FacilitatorEvmSigner
}

// NewPermit2ProxyEvmScheme creates a new Permit2ProxyEvmScheme facilitator
func NewPermit2ProxyEvmScheme(signer evm.FacilitatorEvmSigner) *Permit2ProxyEvmScheme {
	return &Permit2ProxyEvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (f *Permit2ProxyEvmScheme) Scheme() string {
	return permit2proxy.SchemePermit2Proxy
}

// CaipFamily returns the CAIP family pattern
func (f *Permit2ProxyEvmScheme) CaipFamily() string {
	return "eip155:*"
}

// GetExtra returns Permit2 Proxy-specific extra data
func (f *Permit2ProxyEvmScheme) GetExtra(_ t402.Network) map[string]interface{} {
	return map[string]interface{}{
		"permit2Address":    permit2.Permit2Address,
		"exactProxyAddress": permit2proxy.ExactProxyAddress,
		"uptoProxyAddress":  permit2proxy.UptoProxyAddress,
	}
}

// GetSigners returns signer addresses used by this facilitator
func (f *Permit2ProxyEvmScheme) GetSigners(_ t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a Permit2 Proxy payment payload
func (f *Permit2ProxyEvmScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != permit2proxy.SchemePermit2Proxy {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network matches
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse Permit2 Proxy payload
	proxyPayload, err := permit2proxy.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if proxyPayload.Owner == "" || proxyPayload.Permit.Permitted.Token == "" {
		return nil, t402.NewVerifyError("invalid_payload_structure", "", network, nil)
	}

	// Validate witness fields
	if proxyPayload.Witness.To == "" || proxyPayload.Witness.Facilitator == "" {
		return nil, t402.NewVerifyError("invalid_witness_structure", proxyPayload.Owner, network, nil)
	}

	// Verify token matches
	if !strings.EqualFold(proxyPayload.Permit.Permitted.Token, requirements.Asset) {
		return nil, t402.NewVerifyError("token_mismatch", proxyPayload.Owner, network, nil)
	}

	// Verify witness destination matches requirements payTo
	if !strings.EqualFold(proxyPayload.Witness.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", proxyPayload.Owner, network, nil)
	}

	// Verify the facilitator in the witness is one of our addresses
	facilitatorMatch := false
	for _, addr := range f.signer.GetAddresses() {
		if strings.EqualFold(addr, proxyPayload.Witness.Facilitator) {
			facilitatorMatch = true
			break
		}
	}
	if !facilitatorMatch {
		return nil, t402.NewVerifyError("unauthorized_facilitator", proxyPayload.Owner, network, nil)
	}

	// Verify permitted amount
	permittedAmount, ok := new(big.Int).SetString(proxyPayload.Permit.Permitted.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_permitted_amount", proxyPayload.Owner, network, nil)
	}
	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", proxyPayload.Owner, network,
			fmt.Errorf("invalid amount: %s", requirements.Amount))
	}

	if permittedAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_permitted_amount", proxyPayload.Owner, network, nil)
	}

	// Verify validAfter is not in the future
	validAfter, ok := new(big.Int).SetString(proxyPayload.Witness.ValidAfter, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_valid_after", proxyPayload.Owner, network, nil)
	}
	now := big.NewInt(time.Now().Unix())
	if validAfter.Cmp(now) > 0 {
		return nil, t402.NewVerifyError("payment_too_early", proxyPayload.Owner, network, nil)
	}

	// Check balance
	balance, err := f.signer.GetBalance(ctx, proxyPayload.Owner, requirements.Asset)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_balance", proxyPayload.Owner, network, err)
	}
	if balance.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_balance", proxyPayload.Owner, network, nil)
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   proxyPayload.Owner,
	}, nil
}

// Settle settles a Permit2 Proxy payment on-chain via the proxy contract
func (f *Permit2ProxyEvmScheme) Settle(
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

	// Parse Permit2 Proxy payload
	proxyPayload, err := permit2proxy.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Parse signature
	signatureBytes, err := evm.HexToBytes(proxyPayload.Signature)
	if err != nil {
		return nil, t402.NewSettleError("invalid_signature_format", verifyResp.Payer, network, "", err)
	}

	// Parse amounts
	permittedAmount, _ := new(big.Int).SetString(proxyPayload.Permit.Permitted.Amount, 10)
	nonce, _ := new(big.Int).SetString(proxyPayload.Permit.Nonce, 10)
	deadline, _ := new(big.Int).SetString(proxyPayload.Permit.Deadline, 10)
	validAfter, _ := new(big.Int).SetString(proxyPayload.Witness.ValidAfter, 10)

	// Determine which proxy contract and ABI to use based on the scheme
	// For exact: settle(permit, owner, witness, signature)
	// For upto: settle(permit, amount, owner, witness, signature)
	proxyAddress := permit2proxy.ExactProxyAddress
	if addr, ok := requirements.Extra["exactProxyAddress"].(string); ok && addr != "" {
		proxyAddress = addr
	}

	// Determine the settlement amount
	settlementAmount := new(big.Int).Set(permittedAmount)
	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewSettleError("invalid_required_amount", verifyResp.Payer, network, "", nil)
	}

	// Use the exact proxy contract: settle(permit, owner, witness, signature)
	// The proxy contract always transfers permit.permitted.amount for exact scheme
	isUpto := requirements.Scheme == "upto" || (settlementAmount.Cmp(requiredAmount) > 0)
	var txHash string

	if isUpto {
		// Use upto proxy: settle(permit, amount, owner, witness, signature)
		uptoProxyAddress := permit2proxy.UptoProxyAddress
		if addr, ok := requirements.Extra["uptoProxyAddress"].(string); ok && addr != "" {
			uptoProxyAddress = addr
		}

		txHash, err = f.signer.WriteContract(
			ctx,
			uptoProxyAddress,
			UptoProxySettleABI,
			"settle",
			// permit struct
			proxyPayload.Permit.Permitted.Token,
			permittedAmount,
			nonce,
			deadline,
			// amount
			requiredAmount,
			// owner
			proxyPayload.Owner,
			// witness struct
			proxyPayload.Witness.To,
			proxyPayload.Witness.Facilitator,
			validAfter,
			// signature
			signatureBytes,
		)
	} else {
		// Use exact proxy: settle(permit, owner, witness, signature)
		txHash, err = f.signer.WriteContract(
			ctx,
			proxyAddress,
			ExactProxySettleABI,
			"settle",
			// permit struct
			proxyPayload.Permit.Permitted.Token,
			permittedAmount,
			nonce,
			deadline,
			// owner
			proxyPayload.Owner,
			// witness struct
			proxyPayload.Witness.To,
			proxyPayload.Witness.Facilitator,
			validAfter,
			// signature
			signatureBytes,
		)
	}

	if err != nil {
		return nil, t402.NewSettleError("failed_to_execute_settlement", verifyResp.Payer, network, "", err)
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

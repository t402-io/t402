// Package facilitator implements the ERC-7710 delegation-based payment facilitator scheme.
//
// ERC-7710 enables payments from smart contract accounts (ERC-4337, ERC-7579) via
// delegation. The facilitator calls DelegationManager.redeemDelegations() to execute
// token transfers on behalf of the delegator.
//
// Verification is performed entirely through simulation (eth_call). The permissionContext
// is opaque to the facilitator but verifiable by simulating the intended action.
package facilitator

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// ERC-7579 execution mode for single call (default mode)
// Mode encoding: 1 byte callType (0x00=single) + 1 byte execType (0x00=default) + 4 bytes unused + 22 bytes modePayload
var SingleCallMode = [32]byte{} // all zeros = single call, default execution

// ERC-20 transfer function selector: keccak256("transfer(address,uint256)")[:4]
var erc20TransferSelector = [4]byte{0xa9, 0x05, 0x9c, 0xbb}

// redeemDelegations ABI for the DelegationManager contract
var redeemDelegationsABI = []byte(`[
	{
		"inputs": [
			{"name": "_permissionContexts", "type": "bytes[]"},
			{"name": "_modes", "type": "bytes32[]"},
			{"name": "_executionCallDatas", "type": "bytes[]"}
		],
		"name": "redeemDelegations",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// ERC7710Scheme implements the facilitator scheme for ERC-7710 delegation payments.
type ERC7710Scheme struct {
	signer evm.FacilitatorEvmSigner
}

// NewERC7710Scheme creates a new ERC-7710 facilitator scheme.
func NewERC7710Scheme(signer evm.FacilitatorEvmSigner) *ERC7710Scheme {
	return &ERC7710Scheme{signer: signer}
}

// Scheme returns the scheme identifier.
func (f *ERC7710Scheme) Scheme() string {
	return evm.SchemeExact
}

// CaipFamily returns the CAIP family pattern.
func (f *ERC7710Scheme) CaipFamily() string {
	return "eip155:*"
}

// Verify verifies an ERC-7710 delegation payment by simulating the redeemDelegations call.
func (f *ERC7710Scheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Parse ERC-7710 payload
	erc7710Payload, err := evm.ERC7710PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_erc7710_payload", "", network, err)
	}

	// Validate required fields
	if erc7710Payload.DelegationManager == "" {
		return nil, t402.NewVerifyError("missing_delegation_manager", erc7710Payload.Delegator, network, nil)
	}

	// Verify transfer method is erc7710
	transferMethod, _ := requirements.Extra["assetTransferMethod"].(string)
	if transferMethod != "" && transferMethod != string(evm.TransferMethodERC7710) {
		return nil, t402.NewVerifyError("invalid_transfer_method", erc7710Payload.Delegator, network,
			fmt.Errorf("expected erc7710, got %s", transferMethod))
	}

	// Encode the ERC-20 transfer call: transfer(payTo, amount)
	executionCallData, err := encodeERC20Transfer(
		requirements.Asset,
		requirements.PayTo,
		requirements.Amount,
	)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_transfer_encoding", erc7710Payload.Delegator, network, err)
	}

	// Encode redeemDelegations call for simulation
	permissionContextBytes, err := hexToBytes(erc7710Payload.PermissionContext)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_permission_context", erc7710Payload.Delegator, network, err)
	}

	// Simulate the redeemDelegations call via eth_call
	_, err = f.signer.ReadContract(
		ctx,
		erc7710Payload.DelegationManager,
		redeemDelegationsABI,
		"redeemDelegations",
		[][]byte{permissionContextBytes},       // bytes[] _permissionContexts
		[][32]byte{SingleCallMode},              // bytes32[] _modes
		[][]byte{executionCallData},             // bytes[] _executionCallDatas
	)
	if err != nil {
		return nil, t402.NewVerifyError("delegation_simulation_failed", erc7710Payload.Delegator, network,
			fmt.Errorf("redeemDelegations simulation failed: %w", err))
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   erc7710Payload.Delegator,
	}, nil
}

// Settle settles an ERC-7710 delegation payment by calling redeemDelegations on-chain.
func (f *ERC7710Scheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(requirements.Network)

	// First verify
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	// Parse payload again for settlement
	erc7710Payload, err := evm.ERC7710PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_erc7710_payload", verifyResp.Payer, network, "", err)
	}

	// Encode the ERC-20 transfer call
	executionCallData, err := encodeERC20Transfer(
		requirements.Asset,
		requirements.PayTo,
		requirements.Amount,
	)
	if err != nil {
		return nil, t402.NewSettleError("invalid_transfer_encoding", verifyResp.Payer, network, "", err)
	}

	permissionContextBytes, err := hexToBytes(erc7710Payload.PermissionContext)
	if err != nil {
		return nil, t402.NewSettleError("invalid_permission_context", verifyResp.Payer, network, "", err)
	}

	// Execute redeemDelegations on-chain
	txHash, err := f.signer.WriteContract(
		ctx,
		erc7710Payload.DelegationManager,
		redeemDelegationsABI,
		"redeemDelegations",
		[][]byte{permissionContextBytes},
		[][32]byte{SingleCallMode},
		[][]byte{executionCallData},
	)
	if err != nil {
		return nil, t402.NewSettleError("delegation_execution_failed", verifyResp.Payer, network, "",
			fmt.Errorf("redeemDelegations call failed: %w", err))
	}

	// Wait for confirmation
	receipt, err := f.signer.WaitForTransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, t402.NewSettleError("transaction_confirmation_failed", verifyResp.Payer, network, txHash, err)
	}

	if receipt.Status != evm.TxStatusSuccess {
		return nil, t402.NewSettleError("transaction_reverted", verifyResp.Payer, network, txHash,
			fmt.Errorf("transaction reverted"))
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: txHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// encodeERC20Transfer encodes an ERC-20 transfer(address,uint256) call wrapped in
// ERC-7579 single execution format: target (20 bytes) + value (32 bytes) + callData.
func encodeERC20Transfer(tokenAddress, recipient, amount string) ([]byte, error) {
	// Parse amount
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}

	// Parse addresses
	tokenAddr, err := hexToAddress(tokenAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid token address: %w", err)
	}
	recipientAddr, err := hexToAddress(recipient)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address: %w", err)
	}

	// Encode ERC-20 transfer(address,uint256) calldata
	// selector (4 bytes) + address (32 bytes padded) + uint256 (32 bytes)
	transferCallData := make([]byte, 4+32+32)
	copy(transferCallData[0:4], erc20TransferSelector[:])
	copy(transferCallData[4+12:4+32], recipientAddr[:]) // left-pad address to 32 bytes
	amountBytes := amountBig.Bytes()
	copy(transferCallData[4+32+(32-len(amountBytes)):4+64], amountBytes) // left-pad uint256

	// ERC-7579 single execution encoding: target (20 bytes) + value (32 bytes) + callData
	executionCallData := make([]byte, 20+32+len(transferCallData))
	copy(executionCallData[0:20], tokenAddr[:])
	// value = 0 (no ETH sent), 32 zero bytes already there
	copy(executionCallData[20+32:], transferCallData)

	return executionCallData, nil
}

// hexToBytes converts a hex string (with or without 0x prefix) to bytes.
func hexToBytes(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	return hex.DecodeString(s)
}

// hexToAddress converts a hex address string to a 20-byte array.
func hexToAddress(s string) ([20]byte, error) {
	var addr [20]byte
	b, err := hexToBytes(s)
	if err != nil {
		return addr, err
	}
	if len(b) != 20 {
		return addr, fmt.Errorf("address must be 20 bytes, got %d", len(b))
	}
	copy(addr[:], b)
	return addr, nil
}

package upto

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// EIP-2612 Permit ABI for calling permit on the token contract
var PermitABI = []byte(`[
	{
		"inputs": [
			{"name": "owner", "type": "address"},
			{"name": "spender", "type": "address"},
			{"name": "value", "type": "uint256"},
			{"name": "deadline", "type": "uint256"},
			{"name": "v", "type": "uint8"},
			{"name": "r", "type": "bytes32"},
			{"name": "s", "type": "bytes32"}
		],
		"name": "permit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// ERC20 transferFrom ABI for executing the actual transfer after permit
var TransferFromABI = []byte(`[
	{
		"inputs": [
			{"name": "from", "type": "address"},
			{"name": "to", "type": "address"},
			{"name": "amount", "type": "uint256"}
		],
		"name": "transferFrom",
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// ERC20 allowance ABI for checking current allowance
var AllowanceABI = []byte(`[
	{
		"inputs": [
			{"name": "owner", "type": "address"},
			{"name": "spender", "type": "address"}
		],
		"name": "allowance",
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view",
		"type": "function"
	}
]`)

// EIP-2612 nonces ABI for getting the current permit nonce
var NoncesABI = []byte(`[
	{
		"inputs": [
			{"name": "owner", "type": "address"}
		],
		"name": "nonces",
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view",
		"type": "function"
	}
]`)

// Function names for contract calls
const (
	FunctionPermit       = "permit"
	FunctionTransferFrom = "transferFrom"
	FunctionAllowance    = "allowance"
	FunctionNonces       = "nonces"
)

// UptoEvmFacilitatorConfig holds configuration for the UptoEvmFacilitator.
type UptoEvmFacilitatorConfig struct {
	// SettleFullAmount when true, settles the full permitted amount.
	// When false (default), the settle amount must be provided in the settlement request.
	SettleFullAmount bool
}

// UptoEvmFacilitator implements the SchemeNetworkFacilitator interface for EVM upto payments (V2).
// It verifies EIP-2612 permit signatures and settles payments by calling permit() + transferFrom().
type UptoEvmFacilitator struct {
	signer evm.FacilitatorEvmSigner
	config UptoEvmFacilitatorConfig
}

// NewUptoEvmFacilitator creates a new UptoEvmFacilitator.
//
// Args:
//
//	signer: The EVM signer for facilitator operations (reading contracts, sending transactions)
//	config: Optional configuration (nil uses defaults)
//
// Returns:
//
//	Configured UptoEvmFacilitator instance
func NewUptoEvmFacilitator(signer evm.FacilitatorEvmSigner, config *UptoEvmFacilitatorConfig) *UptoEvmFacilitator {
	cfg := UptoEvmFacilitatorConfig{}
	if config != nil {
		cfg = *config
	}
	return &UptoEvmFacilitator{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier.
func (f *UptoEvmFacilitator) Scheme() string {
	return Scheme
}

// CaipFamily returns the CAIP family pattern this facilitator supports.
func (f *UptoEvmFacilitator) CaipFamily() string {
	return "eip155:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint.
// For EVM upto, returns the router/facilitator addresses.
func (f *UptoEvmFacilitator) GetExtra(_ t402.Network) map[string]interface{} {
	addresses := f.signer.GetAddresses()
	if len(addresses) > 0 {
		return map[string]interface{}{
			"routerAddress": addresses[0],
		}
	}
	return nil
}

// GetSigners returns signer addresses used by this facilitator.
// These are the addresses that will be the "spender" in permit approvals.
func (f *UptoEvmFacilitator) GetSigners(_ t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a V2 upto payment payload against requirements.
// It validates the EIP-2612 permit signature, checks the approved amount
// meets the requirements, and verifies the owner has sufficient balance.
//
// Args:
//
//	ctx: Context for cancellation and timeout control
//	payload: The V2 payment payload containing the permit signature
//	requirements: The V2 payment requirements to verify against
//
// Returns:
//
//	VerifyResponse if verification succeeds
//	error (VerifyError) if verification fails
func (f *UptoEvmFacilitator) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != Scheme {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse EIP-2612 payload
	permitPayload, err := PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate signature exists
	if permitPayload.Signature.R == "" || permitPayload.Signature.S == "" {
		return nil, t402.NewVerifyError("missing_signature", "", network, nil)
	}

	// Validate owner address
	if permitPayload.Authorization.Owner == "" || !evm.IsValidAddress(permitPayload.Authorization.Owner) {
		return nil, t402.NewVerifyError("invalid_owner_address", "", network, nil)
	}

	// Validate spender is one of our facilitator addresses
	spenderValid := false
	for _, addr := range f.signer.GetAddresses() {
		if strings.EqualFold(addr, permitPayload.Authorization.Spender) {
			spenderValid = true
			break
		}
	}
	if !spenderValid {
		return nil, t402.NewVerifyError("invalid_spender", permitPayload.Authorization.Owner, network, nil)
	}

	// Get network configuration
	networkStr := string(requirements.Network)
	config, err := evm.GetNetworkConfig(networkStr)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_network_config", "", network, err)
	}

	// Get asset info
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_asset_info", "", network, err)
	}

	// Parse and validate the approved value meets requirements
	approvedValue, ok := new(big.Int).SetString(permitPayload.Authorization.Value, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_authorization_value", permitPayload.Authorization.Owner, network, nil)
	}

	requiredValue, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", "", network,
			fmt.Errorf("invalid amount: %s", requirements.Amount))
	}

	if approvedValue.Cmp(requiredValue) < 0 {
		return nil, t402.NewVerifyError("insufficient_approved_amount", permitPayload.Authorization.Owner, network, nil)
	}

	// Validate deadline is in the future
	deadline, ok := new(big.Int).SetString(permitPayload.Authorization.Deadline, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_deadline", permitPayload.Authorization.Owner, network, nil)
	}
	// We don't strictly enforce current time here (clock skew is acceptable),
	// but the chain will enforce it when permit() is called.
	if deadline.Sign() <= 0 {
		return nil, t402.NewVerifyError("invalid_deadline", permitPayload.Authorization.Owner, network, nil)
	}

	// Verify the permit nonce matches the on-chain nonce
	onChainNonce, err := f.getPermitNonce(ctx, permitPayload.Authorization.Owner, assetInfo.Address)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_nonce", permitPayload.Authorization.Owner, network, err)
	}
	if onChainNonce != permitPayload.Authorization.Nonce {
		return nil, t402.NewVerifyError("invalid_nonce", permitPayload.Authorization.Owner, network,
			fmt.Errorf("expected nonce %d, got %d", onChainNonce, permitPayload.Authorization.Nonce))
	}

	// Check balance
	balance, err := f.signer.GetBalance(ctx, permitPayload.Authorization.Owner, assetInfo.Address)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_balance", permitPayload.Authorization.Owner, network, err)
	}
	if balance.Cmp(requiredValue) < 0 {
		return nil, t402.NewVerifyError("insufficient_balance", permitPayload.Authorization.Owner, network, nil)
	}

	// Extract token info from requirements
	tokenName := assetInfo.Name
	tokenVersion := assetInfo.Version
	if requirements.Extra != nil {
		if name, ok := requirements.Extra["name"].(string); ok {
			tokenName = name
		}
		if version, ok := requirements.Extra["version"].(string); ok {
			tokenVersion = version
		}
	}

	// Verify the EIP-712 permit signature
	valid, err := f.verifyPermitSignature(
		ctx,
		permitPayload,
		config.ChainID,
		assetInfo.Address,
		tokenName,
		tokenVersion,
	)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_verify_signature", permitPayload.Authorization.Owner, network, err)
	}
	if !valid {
		return nil, t402.NewVerifyError("invalid_signature", permitPayload.Authorization.Owner, network, nil)
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   permitPayload.Authorization.Owner,
	}, nil
}

// Settle settles a V2 upto payment on-chain.
// It first verifies the payment, then calls permit() on the token contract
// to set the allowance, followed by transferFrom() to transfer the settle amount.
//
// The settle amount can be:
// - The full approved amount (if SettleFullAmount config is true)
// - A specific amount from the requirements
//
// Args:
//
//	ctx: Context for cancellation and timeout control
//	payload: The V2 payment payload containing the permit signature
//	requirements: The V2 payment requirements
//
// Returns:
//
//	SettleResponse with transaction hash and payer info
//	error (SettleError) if settlement fails
func (f *UptoEvmFacilitator) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// First verify the payment
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		// Convert VerifyError to SettleError
		ve := &t402.VerifyError{}
		if errors.As(err, &ve) {
			return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
		}
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	// Parse the permit payload
	permitPayload, err := PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Get asset info
	networkStr := string(requirements.Network)
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_asset_info", verifyResp.Payer, network, "", err)
	}

	// Determine settle amount
	settleAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewSettleError("invalid_settle_amount", verifyResp.Payer, network, "", nil)
	}

	if f.config.SettleFullAmount {
		// Use the full approved amount
		settleAmount, ok = new(big.Int).SetString(permitPayload.Authorization.Value, 10)
		if !ok {
			return nil, t402.NewSettleError("invalid_approved_value", verifyResp.Payer, network, "", nil)
		}
	}

	// Parse signature components
	rBytes, err := evm.HexToBytes(permitPayload.Signature.R)
	if err != nil {
		return nil, t402.NewSettleError("invalid_signature_r", verifyResp.Payer, network, "", err)
	}
	sBytes, err := evm.HexToBytes(permitPayload.Signature.S)
	if err != nil {
		return nil, t402.NewSettleError("invalid_signature_s", verifyResp.Payer, network, "", err)
	}
	v := uint8(permitPayload.Signature.V)

	// Parse permit parameters
	value, _ := new(big.Int).SetString(permitPayload.Authorization.Value, 10)
	deadline, _ := new(big.Int).SetString(permitPayload.Authorization.Deadline, 10)

	// Step 1: Call permit() on the token contract
	permitTxHash, err := f.signer.WriteContract(
		ctx,
		assetInfo.Address,
		PermitABI,
		FunctionPermit,
		common.HexToAddress(permitPayload.Authorization.Owner),
		common.HexToAddress(permitPayload.Authorization.Spender),
		value,
		deadline,
		v,
		[32]byte(rBytes),
		[32]byte(sBytes),
	)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_execute_permit", verifyResp.Payer, network, "", err)
	}

	// Wait for permit transaction confirmation
	permitReceipt, err := f.signer.WaitForTransactionReceipt(ctx, permitTxHash)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_permit_receipt", verifyResp.Payer, network, permitTxHash, err)
	}
	if permitReceipt.Status != evm.TxStatusSuccess {
		return nil, t402.NewSettleError("permit_transaction_failed", verifyResp.Payer, network, permitTxHash, nil)
	}

	// Step 2: Call transferFrom() to transfer the settle amount
	transferTxHash, err := f.signer.WriteContract(
		ctx,
		assetInfo.Address,
		TransferFromABI,
		FunctionTransferFrom,
		common.HexToAddress(permitPayload.Authorization.Owner),
		common.HexToAddress(requirements.PayTo),
		settleAmount,
	)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_execute_transfer", verifyResp.Payer, network, "", err)
	}

	// Wait for transfer transaction confirmation
	transferReceipt, err := f.signer.WaitForTransactionReceipt(ctx, transferTxHash)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_transfer_receipt", verifyResp.Payer, network, transferTxHash, err)
	}
	if transferReceipt.Status != evm.TxStatusSuccess {
		return nil, t402.NewSettleError("transfer_transaction_failed", verifyResp.Payer, network, transferTxHash, nil)
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: transferTxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// getPermitNonce gets the current permit nonce for an owner from the token contract.
func (f *UptoEvmFacilitator) getPermitNonce(ctx context.Context, owner string, tokenAddress string) (int, error) {
	result, err := f.signer.ReadContract(
		ctx,
		tokenAddress,
		NoncesABI,
		FunctionNonces,
		common.HexToAddress(owner),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to read nonces: %w", err)
	}

	// The result should be a *big.Int
	switch v := result.(type) {
	case *big.Int:
		return int(v.Int64()), nil
	case int64:
		return int(v), nil
	case float64:
		return int(v), nil
	default:
		return 0, fmt.Errorf("unexpected nonce type: %T", result)
	}
}

// verifyPermitSignature verifies the EIP-712 permit signature by recovering the signer.
func (f *UptoEvmFacilitator) verifyPermitSignature(
	ctx context.Context,
	permitPayload *EIP2612Payload,
	chainID *big.Int,
	verifyingContract string,
	tokenName string,
	tokenVersion string,
) (bool, error) {
	// Create EIP-712 domain
	domain := evm.TypedDataDomain{
		Name:              tokenName,
		Version:           tokenVersion,
		ChainID:           chainID,
		VerifyingContract: verifyingContract,
	}

	// Define EIP-712 types for Permit
	typedDataTypes := map[string][]evm.TypedDataField{
		"EIP712Domain": {
			{Name: "name", Type: "string"},
			{Name: "version", Type: "string"},
			{Name: "chainId", Type: "uint256"},
			{Name: "verifyingContract", Type: "address"},
		},
		"Permit": {
			{Name: "owner", Type: "address"},
			{Name: "spender", Type: "address"},
			{Name: "value", Type: "uint256"},
			{Name: "nonce", Type: "uint256"},
			{Name: "deadline", Type: "uint256"},
		},
	}

	// Create message from authorization
	message := CreatePermitMessage(permitPayload.Authorization)

	// Reconstruct the signature bytes (65 bytes: r[32] + s[32] + v[1])
	rBytes, err := evm.HexToBytes(permitPayload.Signature.R)
	if err != nil {
		return false, fmt.Errorf("invalid R value: %w", err)
	}
	sBytes, err := evm.HexToBytes(permitPayload.Signature.S)
	if err != nil {
		return false, fmt.Errorf("invalid S value: %w", err)
	}

	signatureBytes := make([]byte, 65)
	copy(signatureBytes[0:32], rBytes)
	copy(signatureBytes[32:64], sBytes)
	signatureBytes[64] = byte(permitPayload.Signature.V)

	// Use the facilitator signer's VerifyTypedData for signature verification
	valid, err := f.signer.VerifyTypedData(
		ctx,
		permitPayload.Authorization.Owner,
		domain,
		typedDataTypes,
		"Permit",
		message,
		signatureBytes,
	)
	if err != nil {
		return false, err
	}

	return valid, nil
}

// HashPermitAuthorization hashes a Permit message for EIP-2612.
// This is a convenience function for computing the EIP-712 hash of a permit.
//
// Args:
//
//	authorization: The permit authorization data
//	chainID: The chain ID for the EIP-712 domain
//	verifyingContract: The token contract address
//	tokenName: The token name for the EIP-712 domain
//	tokenVersion: The token version for the EIP-712 domain
//
// Returns:
//
//	32-byte hash suitable for signing or verification
//	error if hashing fails
func HashPermitAuthorization(
	authorization PermitAuthorization,
	chainID *big.Int,
	verifyingContract string,
	tokenName string,
	tokenVersion string,
) ([]byte, error) {
	domain := evm.TypedDataDomain{
		Name:              tokenName,
		Version:           tokenVersion,
		ChainID:           chainID,
		VerifyingContract: verifyingContract,
	}

	typedDataTypes := map[string][]evm.TypedDataField{
		"EIP712Domain": {
			{Name: "name", Type: "string"},
			{Name: "version", Type: "string"},
			{Name: "chainId", Type: "uint256"},
			{Name: "verifyingContract", Type: "address"},
		},
		"Permit": {
			{Name: "owner", Type: "address"},
			{Name: "spender", Type: "address"},
			{Name: "value", Type: "uint256"},
			{Name: "nonce", Type: "uint256"},
			{Name: "deadline", Type: "uint256"},
		},
	}

	message := CreatePermitMessage(authorization)

	return evm.HashTypedData(domain, typedDataTypes, "Permit", message)
}

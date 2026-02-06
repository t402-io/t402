// Package facilitator implements the facilitator role for SVM upto payments.
package facilitator

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strconv"

	solana "github.com/gagliardetto/solana-go"
	computebudget "github.com/gagliardetto/solana-go/programs/compute-budget"
	"github.com/gagliardetto/solana-go/programs/token"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoSvmScheme implements the SchemeNetworkFacilitator interface for SVM upto payments
type UptoSvmScheme struct {
	signer upto.UptoFacilitatorSvmSigner
	config *UptoSvmSchemeConfig
}

// UptoSvmSchemeConfig contains configuration for the facilitator scheme
type UptoSvmSchemeConfig struct {
	// SettleFullAmount if true, settles the full approved amount instead of required amount
	SettleFullAmount bool
}

// NewUptoSvmScheme creates a new UptoSvmScheme
func NewUptoSvmScheme(signer upto.UptoFacilitatorSvmSigner, config ...*UptoSvmSchemeConfig) *UptoSvmScheme {
	var cfg *UptoSvmSchemeConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &UptoSvmScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (f *UptoSvmScheme) Scheme() string {
	return upto.SchemeUpto
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *UptoSvmScheme) CaipFamily() string {
	return "solana:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint
func (f *UptoSvmScheme) GetExtra(network t402.Network) map[string]interface{} {
	addresses := f.signer.GetAddresses(context.Background(), string(network))

	// Cryptographically secure random selection
	randomIndex := secureRandomIndex(len(addresses))

	return map[string]interface{}{
		"feePayer": addresses[randomIndex].String(),
	}
}

// secureRandomIndex returns a cryptographically secure random index
func secureRandomIndex(max int) int {
	if max <= 0 {
		return 0
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0
	}
	return int(n.Int64())
}

// GetSigners returns signer addresses used by this facilitator
func (f *UptoSvmScheme) GetSigners(network t402.Network) []string {
	addresses := f.signer.GetAddresses(context.Background(), string(network))
	result := make([]string, len(addresses))
	for i, addr := range addresses {
		result[i] = addr.String()
	}
	return result
}

// Verify verifies a upto payment payload against requirements
func (f *UptoSvmScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Step 1: Validate scheme
	if payload.Accepted.Scheme != upto.SchemeUpto || requirements.Scheme != upto.SchemeUpto {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_scheme",
		}, nil
	}

	// Step 2: Validate network matching
	if string(payload.Accepted.Network) != string(requirements.Network) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "network_mismatch",
		}, nil
	}

	// Validate network is supported
	if !svm.IsValidNetwork(string(network)) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_network",
		}, nil
	}

	// Step 3: Validate fee payer
	if requirements.Extra == nil || requirements.Extra["feePayer"] == nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "missing_fee_payer",
		}, nil
	}

	feePayerStr, ok := requirements.Extra["feePayer"].(string)
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_fee_payer",
		}, nil
	}

	// Verify fee payer is managed by this facilitator
	signerAddresses := f.signer.GetAddresses(ctx, string(network))
	signerAddressStrs := make([]string, len(signerAddresses))
	for i, addr := range signerAddresses {
		signerAddressStrs[i] = addr.String()
	}

	feePayerManaged := false
	for _, addr := range signerAddressStrs {
		if addr == feePayerStr {
			feePayerManaged = true
			break
		}
	}
	if !feePayerManaged {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "fee_payer_not_managed",
		}, nil
	}

	// Step 4: Parse payload
	uptoPayload, err := upto.UptoPayloadFromMap(payload.Payload)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload",
		}, nil
	}

	authorization := uptoPayload.Authorization
	payer := authorization.Owner

	// Step 5: Validate addresses
	if _, err := solana.PublicKeyFromBase58(authorization.Owner); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_owner_address",
			Payer:         payer,
		}, nil
	}

	if _, err := solana.PublicKeyFromBase58(authorization.Delegate); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_delegate_address",
			Payer:         payer,
		}, nil
	}

	// Step 6: Verify delegate is one of our addresses
	validDelegate := false
	for _, addr := range signerAddressStrs {
		if authorization.Delegate == addr {
			validDelegate = true
			break
		}
	}
	if !validDelegate {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_delegate",
			Payer:         payer,
		}, nil
	}

	// Step 7: Decode and verify the approve transaction
	tx, err := svm.DecodeTransaction(uptoPayload.Transaction)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_transaction",
			Payer:         payer,
		}, nil
	}

	// Verify transaction structure (should have compute budget + approve)
	if len(tx.Message.Instructions) < 3 {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_transaction_instructions",
			Payer:         payer,
		}, nil
	}

	// Verify compute budget instructions
	if err := f.verifyComputeLimitInstruction(tx, tx.Message.Instructions[0]); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_compute_limit",
			Payer:         payer,
		}, nil
	}

	if err := f.verifyComputePriceInstruction(tx, tx.Message.Instructions[1]); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_compute_price",
			Payer:         payer,
		}, nil
	}

	// Verify approve instruction
	if err := f.verifyApproveInstruction(tx, tx.Message.Instructions[2], authorization, requirements); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: err.Error(),
			Payer:         payer,
		}, nil
	}

	// Step 8: Verify approved amount is sufficient
	maxAmount, ok := new(big.Int).SetString(authorization.MaxAmount, 10)
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_max_amount",
			Payer:         payer,
		}, nil
	}

	requiredAmount, err := strconv.ParseUint(requirements.Amount, 10, 64)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_required_amount",
			Payer:         payer,
		}, nil
	}

	requiredBig := new(big.Int).SetUint64(requiredAmount)
	if maxAmount.Cmp(requiredBig) < 0 {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_approved_amount",
			Payer:         payer,
		}, nil
	}

	// Step 9: Verify token balance
	sourceATA, err := solana.PublicKeyFromBase58(authorization.SourceATA)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_source_ata",
			Payer:         payer,
		}, nil
	}

	balance, err := f.signer.GetTokenBalance(ctx, sourceATA, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("balance_check_failed", payer, network, err)
	}

	if balance < requiredAmount {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_balance",
			Payer:         payer,
		}, nil
	}

	// Step 10: Sign and simulate transaction
	feePayer, err := solana.PublicKeyFromBase58(feePayerStr)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_fee_payer",
			Payer:         payer,
		}, nil
	}

	if err := f.signer.SignTransaction(ctx, tx, feePayer, string(network)); err != nil {
		return nil, t402.NewVerifyError("signing_failed", payer, network, err)
	}

	if err := f.signer.SimulateTransaction(ctx, tx, string(network)); err != nil {
		return nil, t402.NewVerifyError("simulation_failed", payer, network, err)
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a upto payment
func (f *UptoSvmScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(requirements.Network)

	// First verify the payment
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve := &t402.VerifyError{}
		if errors.As(err, &ve) {
			return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
		}
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	if !verifyResp.IsValid {
		return &t402.SettleResponse{
			Success:     false,
			Network:     network,
			ErrorReason: verifyResp.InvalidReason,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Parse payload
	uptoPayload, err := upto.UptoPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Step 1: Broadcast the approve transaction
	tx, err := svm.DecodeTransaction(uptoPayload.Transaction)
	if err != nil {
		return nil, t402.NewSettleError("invalid_transaction", verifyResp.Payer, network, "", err)
	}

	feePayerStr := requirements.Extra["feePayer"].(string)
	feePayer, _ := solana.PublicKeyFromBase58(feePayerStr)

	// Sign and send approve transaction
	if err := f.signer.SignTransaction(ctx, tx, feePayer, string(network)); err != nil {
		return nil, t402.NewSettleError("approve_signing_failed", verifyResp.Payer, network, "", err)
	}

	approveSignature, err := f.signer.SendTransaction(ctx, tx, string(network))
	if err != nil {
		return nil, t402.NewSettleError("approve_send_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for approve confirmation
	if err := f.signer.ConfirmTransaction(ctx, approveSignature, string(network)); err != nil {
		return nil, t402.NewSettleError("approve_confirmation_failed", verifyResp.Payer, network, approveSignature.String(), err)
	}

	// Step 2: Execute transfer using delegated authority
	authorization := uptoPayload.Authorization

	// Determine settlement amount
	settleAmount, err := strconv.ParseUint(requirements.Amount, 10, 64)
	if err != nil {
		return nil, t402.NewSettleError("invalid_amount", verifyResp.Payer, network, approveSignature.String(), err)
	}

	if f.config != nil && f.config.SettleFullAmount {
		maxAmount, _ := strconv.ParseUint(authorization.MaxAmount, 10, 64)
		settleAmount = maxAmount
	}

	// Get mint info for decimals
	mint, _ := solana.PublicKeyFromBase58(authorization.Mint)
	sourceATA, _ := solana.PublicKeyFromBase58(authorization.SourceATA)
	delegate, _ := solana.PublicKeyFromBase58(authorization.Delegate)
	payTo, _ := solana.PublicKeyFromBase58(requirements.PayTo)

	// Get destination ATA
	destATA, _, err := solana.FindAssociatedTokenAddress(payTo, mint)
	if err != nil {
		return nil, t402.NewSettleError("invalid_destination", verifyResp.Payer, network, approveSignature.String(), err)
	}

	// Get decimals from network config
	decimals := uint8(6) // Default for USDC/USDT
	if config, ok := svm.NetworkConfigs[string(network)]; ok {
		if asset, ok := config.SupportedAssets[requirements.Asset]; ok {
			decimals = uint8(asset.Decimals)
		} else if requirements.Asset == config.DefaultAsset.Address {
			decimals = uint8(config.DefaultAsset.Decimals)
		}
	}

	// Create transfer transaction
	transferTx, err := f.signer.CreateTransferTransaction(ctx, upto.TransferParams{
		Source:      sourceATA,
		Destination: destATA,
		Mint:        mint,
		Authority:   delegate,
		Amount:      settleAmount,
		Decimals:    decimals,
		FeePayer:    feePayer,
		Network:     string(network),
	})
	if err != nil {
		return nil, t402.NewSettleError("transfer_creation_failed", verifyResp.Payer, network, approveSignature.String(), err)
	}

	// Sign and send transfer transaction
	if err := f.signer.SignTransaction(ctx, transferTx, feePayer, string(network)); err != nil {
		return nil, t402.NewSettleError("transfer_signing_failed", verifyResp.Payer, network, approveSignature.String(), err)
	}

	transferSignature, err := f.signer.SendTransaction(ctx, transferTx, string(network))
	if err != nil {
		return nil, t402.NewSettleError("transfer_send_failed", verifyResp.Payer, network, approveSignature.String(), err)
	}

	// Wait for transfer confirmation
	if err := f.signer.ConfirmTransaction(ctx, transferSignature, string(network)); err != nil {
		return nil, t402.NewSettleError("transfer_confirmation_failed", verifyResp.Payer, network, transferSignature.String(), err)
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: transferSignature.String(),
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// verifyComputeLimitInstruction verifies the compute unit limit instruction
func (f *UptoSvmScheme) verifyComputeLimitInstruction(tx *solana.Transaction, inst solana.CompiledInstruction) error {
	progID := tx.Message.AccountKeys[inst.ProgramIDIndex]

	if !progID.Equals(solana.ComputeBudget) {
		return fmt.Errorf("invalid_compute_limit_program")
	}

	if len(inst.Data) < 1 || inst.Data[0] != 2 {
		return fmt.Errorf("invalid_compute_limit_discriminator")
	}

	accounts, err := inst.ResolveInstructionAccounts(&tx.Message)
	if err != nil {
		return fmt.Errorf("invalid_compute_limit_accounts")
	}

	_, err = computebudget.DecodeInstruction(accounts, inst.Data)
	if err != nil {
		return fmt.Errorf("invalid_compute_limit_decode")
	}

	return nil
}

// verifyComputePriceInstruction verifies the compute unit price instruction
func (f *UptoSvmScheme) verifyComputePriceInstruction(tx *solana.Transaction, inst solana.CompiledInstruction) error {
	progID := tx.Message.AccountKeys[inst.ProgramIDIndex]

	if !progID.Equals(solana.ComputeBudget) {
		return fmt.Errorf("invalid_compute_price_program")
	}

	if len(inst.Data) < 1 || inst.Data[0] != 3 {
		return fmt.Errorf("invalid_compute_price_discriminator")
	}

	accounts, err := inst.ResolveInstructionAccounts(&tx.Message)
	if err != nil {
		return fmt.Errorf("invalid_compute_price_accounts")
	}

	decoded, err := computebudget.DecodeInstruction(accounts, inst.Data)
	if err != nil {
		return fmt.Errorf("invalid_compute_price_decode")
	}

	if priceInst, ok := decoded.Impl.(*computebudget.SetComputeUnitPrice); ok {
		if priceInst.MicroLamports > uint64(svm.MaxComputeUnitPriceMicrolamports) {
			return fmt.Errorf("compute_price_too_high")
		}
	} else {
		return fmt.Errorf("invalid_compute_price_type")
	}

	return nil
}

// verifyApproveInstruction verifies the approve instruction
func (f *UptoSvmScheme) verifyApproveInstruction(
	tx *solana.Transaction,
	inst solana.CompiledInstruction,
	authorization upto.UptoSvmAuthorization,
	requirements types.PaymentRequirements,
) error {
	progID := tx.Message.AccountKeys[inst.ProgramIDIndex]

	// Must be Token Program or Token-2022 Program
	if progID != solana.TokenProgramID && progID != solana.Token2022ProgramID {
		return fmt.Errorf("invalid_approve_program")
	}

	accounts, err := inst.ResolveInstructionAccounts(&tx.Message)
	if err != nil {
		return fmt.Errorf("invalid_approve_accounts")
	}

	decoded, err := token.DecodeInstruction(accounts, inst.Data)
	if err != nil {
		return fmt.Errorf("invalid_approve_decode")
	}

	// Can be Approve or ApproveChecked
	var approveAmount uint64
	var delegate solana.PublicKey
	var source solana.PublicKey

	switch impl := decoded.Impl.(type) {
	case *token.Approve:
		approveAmount = *impl.Amount
		delegate = impl.GetDelegateAccount().PublicKey
		source = impl.GetSourceAccount().PublicKey
	case *token.ApproveChecked:
		approveAmount = *impl.Amount
		delegate = impl.GetDelegateAccount().PublicKey
		source = impl.GetSourceAccount().PublicKey
	default:
		return fmt.Errorf("invalid_approve_instruction_type")
	}

	// Verify delegate matches authorization
	if delegate.String() != authorization.Delegate {
		return fmt.Errorf("delegate_mismatch")
	}

	// Verify source matches authorization
	if source.String() != authorization.SourceATA {
		return fmt.Errorf("source_mismatch")
	}

	// Verify approved amount matches authorization
	maxAmount, _ := strconv.ParseUint(authorization.MaxAmount, 10, 64)
	if approveAmount != maxAmount {
		return fmt.Errorf("amount_mismatch")
	}

	// Verify mint matches requirements
	if authorization.Mint != requirements.Asset {
		return fmt.Errorf("mint_mismatch")
	}

	return nil
}

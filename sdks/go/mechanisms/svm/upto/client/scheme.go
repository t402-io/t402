// Package client implements the client role for SVM upto payments.
package client

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"

	bin "github.com/gagliardetto/binary"
	solana "github.com/gagliardetto/solana-go"
	computebudget "github.com/gagliardetto/solana-go/programs/compute-budget"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"

	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoSvmClient implements the SchemeNetworkClient interface for SVM upto payments
type UptoSvmClient struct {
	signer upto.UptoClientSvmSigner
	config *ClientConfig
}

// ClientConfig contains optional client configuration
type ClientConfig struct {
	// RPCURL is a custom RPC URL for the client
	RPCURL string
}

// NewUptoSvmClient creates a new UptoSvmClient
func NewUptoSvmClient(signer upto.UptoClientSvmSigner, config ...*ClientConfig) *UptoSvmClient {
	var cfg *ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &UptoSvmClient{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *UptoSvmClient) Scheme() string {
	return upto.SchemeUpto
}

// CreatePaymentPayload creates an upto payment payload for SVM
func (c *UptoSvmClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := string(requirements.Network)
	if !svm.IsValidNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate scheme
	if requirements.Scheme != upto.SchemeUpto {
		return types.PaymentPayload{}, fmt.Errorf("invalid scheme: expected %s, got %s", upto.SchemeUpto, requirements.Scheme)
	}

	// Get network configuration
	config, err := svm.GetNetworkConfig(networkStr)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Get RPC URL
	rpcURL := config.RPCURL
	if c.config != nil && c.config.RPCURL != "" {
		rpcURL = c.config.RPCURL
	}

	rpcClient := rpc.New(rpcURL)

	// Get fee payer from requirements.extra
	extra := requirements.Extra
	if extra == nil {
		return types.PaymentPayload{}, fmt.Errorf("missing extra data in requirements")
	}

	feePayerAddr, ok := extra["feePayer"].(string)
	if !ok || feePayerAddr == "" {
		return types.PaymentPayload{}, fmt.Errorf("feePayer is required in requirements.extra")
	}

	feePayer, err := solana.PublicKeyFromBase58(feePayerAddr)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid feePayer address: %w", err)
	}

	// Get max amount from requirements (or use required amount as max)
	maxAmountStr := string(requirements.Amount)
	if ma, ok := extra["maxAmount"].(string); ok && ma != "" {
		maxAmountStr = ma
	}

	maxAmount, err := strconv.ParseUint(maxAmountStr, 10, 64)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid maxAmount: %w", err)
	}

	// Parse mint address
	mintPubkey, err := solana.PublicKeyFromBase58(requirements.Asset)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid asset address: %w", err)
	}

	// Get mint account to determine token program and decimals
	mintAccount, err := rpcClient.GetAccountInfo(ctx, mintPubkey)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get mint account: %w", err)
	}

	tokenProgramID := mintAccount.Value.Owner
	if tokenProgramID != solana.TokenProgramID && tokenProgramID != solana.Token2022ProgramID {
		return types.PaymentPayload{}, fmt.Errorf("asset was not created by a known token program")
	}

	var mintData token.Mint
	err = bin.NewBinDecoder(mintAccount.Value.Data.GetBinary()).Decode(&mintData)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to decode mint data: %w", err)
	}

	// Find source ATA (client's token account)
	sourceATA, _, err := solana.FindAssociatedTokenAddress(c.signer.Address(), mintPubkey)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to derive source ATA: %w", err)
	}

	// The delegate is the fee payer (facilitator)
	delegate := feePayer

	// Get latest blockhash
	latestBlockhash, err := rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get latest blockhash: %w", err)
	}
	recentBlockhash := latestBlockhash.Value.Blockhash

	// Build compute budget instructions
	cuLimit, err := computebudget.NewSetComputeUnitLimitInstructionBuilder().
		SetUnits(svm.DefaultComputeUnitLimit).
		ValidateAndBuild()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to build compute limit instruction: %w", err)
	}

	cuPrice, err := computebudget.NewSetComputeUnitPriceInstructionBuilder().
		SetMicroLamports(svm.DefaultComputeUnitPriceMicrolamports).
		ValidateAndBuild()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to build compute price instruction: %w", err)
	}

	// Build approve instruction (ApproveChecked for Token-2022 compatibility)
	approveIx, err := token.NewApproveCheckedInstructionBuilder().
		SetAmount(maxAmount).
		SetDecimals(mintData.Decimals).
		SetSourceAccount(sourceATA).
		SetMintAccount(mintPubkey).
		SetDelegateAccount(delegate).
		SetOwnerAccount(c.signer.Address()).
		ValidateAndBuild()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to build approve instruction: %w", err)
	}

	// Create transaction
	tx, err := solana.NewTransactionBuilder().
		AddInstruction(cuLimit).
		AddInstruction(cuPrice).
		AddInstruction(approveIx).
		SetRecentBlockHash(recentBlockhash).
		SetFeePayer(feePayer).
		Build()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Sign with client's key
	if err := c.signer.SignTransaction(ctx, tx); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Encode transaction to base64
	base64Tx, err := svm.EncodeTransaction(tx)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to encode transaction: %w", err)
	}

	// Generate payment nonce for replay protection
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to generate nonce: %w", err)
	}
	paymentNonce := "0x" + hex.EncodeToString(nonceBytes)

	// Create the payload
	uptoPayload := &upto.UptoSvmPayload{
		Transaction: base64Tx,
		Authorization: upto.UptoSvmAuthorization{
			Owner:     c.signer.Address().String(),
			Delegate:  delegate.String(),
			Mint:      requirements.Asset,
			MaxAmount: maxAmountStr,
			SourceATA: sourceATA.String(),
		},
		PaymentNonce: paymentNonce,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     uptoPayload.ToMap(),
	}, nil
}

// GetAddress returns the client's Solana address
func (c *UptoSvmClient) GetAddress() string {
	return c.signer.Address().String()
}

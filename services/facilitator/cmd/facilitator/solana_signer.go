package main

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	bin "github.com/gagliardetto/binary"
	solana "github.com/gagliardetto/solana-go"
	computebudget "github.com/gagliardetto/solana-go/programs/compute-budget"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	svmupto "github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
)

// facilitatorSolanaSigner implements the FacilitatorSvmSigner interface
type facilitatorSolanaSigner struct {
	privateKey solana.PrivateKey
	publicKey  solana.PublicKey
	clients    map[string]*rpc.Client // network -> RPC client
}

// newFacilitatorSolanaSigner creates a new Solana facilitator signer from a private key
func newFacilitatorSolanaSigner(privateKeyHex string, mainnetRPC string, devnetRPC string) (*facilitatorSolanaSigner, error) {
	if privateKeyHex == "" {
		return nil, fmt.Errorf("private key is required")
	}

	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Parse private key (hex encoded)
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	// SECURITY: Clear private key bytes from memory after use
	defer func() {
		for i := range privateKeyBytes {
			privateKeyBytes[i] = 0
		}
	}()

	// Solana private keys are 64 bytes (32 bytes seed + 32 bytes public key)
	// If we only have 32 bytes (seed), we need to derive the full keypair using ed25519
	var privateKey solana.PrivateKey
	var publicKey solana.PublicKey

	if len(privateKeyBytes) == 32 {
		// This is a 32-byte seed, derive the full ed25519 keypair
		ed25519PrivateKey := ed25519.NewKeyFromSeed(privateKeyBytes)
		privateKey = solana.PrivateKey(ed25519PrivateKey)
		publicKey = solana.PublicKeyFromBytes(ed25519PrivateKey.Public().(ed25519.PublicKey))

		// SECURITY: Clear the derived ed25519 private key bytes
		// Note: The seed (privateKeyBytes) is already cleared by the outer defer
		for i := range ed25519PrivateKey {
			ed25519PrivateKey[i] = 0
		}
	} else if len(privateKeyBytes) == 64 {
		privateKey = solana.PrivateKey(privateKeyBytes)
		publicKey = privateKey.PublicKey()
	} else {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	signer := &facilitatorSolanaSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		clients:    make(map[string]*rpc.Client),
	}

	// Set up RPC clients for each network
	if mainnetRPC != "" {
		signer.clients[svm.SolanaMainnetCAIP2] = rpc.New(mainnetRPC)
	} else {
		// Use default mainnet endpoint
		signer.clients[svm.SolanaMainnetCAIP2] = rpc.New("https://api.mainnet-beta.solana.com")
	}

	if devnetRPC != "" {
		signer.clients[svm.SolanaDevnetCAIP2] = rpc.New(devnetRPC)
	} else {
		// Use default devnet endpoint
		signer.clients[svm.SolanaDevnetCAIP2] = rpc.New("https://api.devnet.solana.com")
	}

	// Also add testnet
	signer.clients[svm.SolanaTestnetCAIP2] = rpc.New("https://api.testnet.solana.com")

	return signer, nil
}

func (s *facilitatorSolanaSigner) getClient(network string) (*rpc.Client, error) {
	// Normalize network to CAIP-2 format
	caip2Network, err := svm.NormalizeNetwork(network)
	if err != nil {
		return nil, err
	}

	client, ok := s.clients[caip2Network]
	if !ok {
		return nil, fmt.Errorf("no RPC client configured for network: %s", network)
	}

	return client, nil
}

// Zeroize securely clears the private key from memory
// SECURITY: Should be called when the signer is no longer needed (e.g., on shutdown)
func (s *facilitatorSolanaSigner) Zeroize() {
	// SECURITY: Clear the 64-byte Solana private key
	if len(s.privateKey) > 0 {
		for i := range s.privateKey {
			s.privateKey[i] = 0
		}
		s.privateKey = nil
	}
	// Note: publicKey is derived from privateKey, but is public info - no need to clear
}

func (s *facilitatorSolanaSigner) GetAddresses(ctx context.Context, network string) []solana.PublicKey {
	return []solana.PublicKey{s.publicKey}
}

func (s *facilitatorSolanaSigner) SignTransaction(ctx context.Context, tx *solana.Transaction, feePayer solana.PublicKey, network string) error {
	// Verify that the requested feePayer matches our public key
	if !feePayer.Equals(s.publicKey) {
		return fmt.Errorf("fee payer %s not managed by this signer (expected %s)", feePayer, s.publicKey)
	}

	// Get the latest blockhash for the transaction
	client, err := s.getClient(network)
	if err != nil {
		return err
	}

	// Get latest blockhash
	recent, err := client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return fmt.Errorf("failed to get latest blockhash: %w", err)
	}

	// Update transaction blockhash
	tx.Message.RecentBlockhash = recent.Value.Blockhash

	// Sign the transaction
	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(s.publicKey) {
			return &s.privateKey
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to sign transaction: %w", err)
	}

	return nil
}

func (s *facilitatorSolanaSigner) SimulateTransaction(ctx context.Context, tx *solana.Transaction, network string) error {
	client, err := s.getClient(network)
	if err != nil {
		return err
	}

	// Simulate the transaction
	result, err := client.SimulateTransaction(ctx, tx)
	if err != nil {
		return fmt.Errorf("simulation request failed: %w", err)
	}

	// Check for simulation errors
	if result.Value.Err != nil {
		return fmt.Errorf("simulation failed: %v", result.Value.Err)
	}

	return nil
}

func (s *facilitatorSolanaSigner) SendTransaction(ctx context.Context, tx *solana.Transaction, network string) (solana.Signature, error) {
	client, err := s.getClient(network)
	if err != nil {
		return solana.Signature{}, err
	}

	// Send the transaction
	sig, err := client.SendTransaction(ctx, tx)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %w", err)
	}

	return sig, nil
}

func (s *facilitatorSolanaSigner) ConfirmTransaction(ctx context.Context, signature solana.Signature, network string) error {
	client, err := s.getClient(network)
	if err != nil {
		return err
	}

	// Poll for confirmation
	maxAttempts := 30
	interval := 2 * time.Second

	for i := 0; i < maxAttempts; i++ {
		// Get signature status
		statuses, err := client.GetSignatureStatuses(ctx, false, signature)
		if err != nil {
			// Log but continue polling
			time.Sleep(interval)
			continue
		}

		if len(statuses.Value) > 0 && statuses.Value[0] != nil {
			status := statuses.Value[0]

			// Check for error
			if status.Err != nil {
				return fmt.Errorf("transaction failed: %v", status.Err)
			}

			// Check if confirmed
			if status.ConfirmationStatus == rpc.ConfirmationStatusConfirmed ||
				status.ConfirmationStatus == rpc.ConfirmationStatusFinalized {
				return nil
			}
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled while waiting for confirmation")
		case <-time.After(interval):
			continue
		}
	}

	return fmt.Errorf("transaction confirmation timeout after %d attempts", maxAttempts)
}

func (s *facilitatorSolanaSigner) GetTokenBalance(ctx context.Context, tokenAccount solana.PublicKey, network string) (uint64, error) {
	client, err := s.getClient(network)
	if err != nil {
		return 0, err
	}

	result, err := client.GetTokenAccountBalance(ctx, tokenAccount, rpc.CommitmentFinalized)
	if err != nil {
		return 0, fmt.Errorf("failed to get token balance: %w", err)
	}

	if result == nil || result.Value == nil {
		return 0, nil
	}

	amount, err := strconv.ParseUint(result.Value.Amount, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse token balance amount %q: %w", result.Value.Amount, err)
	}

	return amount, nil
}

func (s *facilitatorSolanaSigner) GetDelegatedAmount(ctx context.Context, tokenAccount solana.PublicKey, network string) (*svmupto.DelegateInfo, error) {
	client, err := s.getClient(network)
	if err != nil {
		return nil, err
	}

	info, err := client.GetAccountInfoWithOpts(ctx, tokenAccount, &rpc.GetAccountInfoOpts{
		Commitment: rpc.CommitmentFinalized,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get account info: %w", err)
	}

	if info == nil || info.Value == nil || info.Value.Data == nil {
		return &svmupto.DelegateInfo{Amount: 0}, nil
	}

	var account token.Account
	if err := bin.NewBinDecoder(info.Value.Data.GetBinary()).Decode(&account); err != nil {
		return nil, fmt.Errorf("failed to decode token account: %w", err)
	}

	return &svmupto.DelegateInfo{
		Delegate: account.Delegate,
		Amount:   account.DelegatedAmount,
	}, nil
}

func (s *facilitatorSolanaSigner) CreateTransferTransaction(ctx context.Context, params svmupto.TransferParams) (*solana.Transaction, error) {
	// Get a recent blockhash
	blockhash, err := s.GetRecentBlockhash(ctx, params.Network)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	// Build compute budget instructions
	cuLimit, err := computebudget.NewSetComputeUnitLimitInstructionBuilder().
		SetUnits(svm.DefaultComputeUnitLimit).
		ValidateAndBuild()
	if err != nil {
		return nil, fmt.Errorf("failed to build compute limit instruction: %w", err)
	}

	cuPrice, err := computebudget.NewSetComputeUnitPriceInstructionBuilder().
		SetMicroLamports(svm.DefaultComputeUnitPriceMicrolamports).
		ValidateAndBuild()
	if err != nil {
		return nil, fmt.Errorf("failed to build compute price instruction: %w", err)
	}

	// Build TransferChecked instruction using delegated authority
	transferIx, err := token.NewTransferCheckedInstructionBuilder().
		SetAmount(params.Amount).
		SetDecimals(params.Decimals).
		SetSourceAccount(params.Source).
		SetMintAccount(params.Mint).
		SetDestinationAccount(params.Destination).
		SetOwnerAccount(params.Authority).
		ValidateAndBuild()
	if err != nil {
		return nil, fmt.Errorf("failed to build transfer instruction: %w", err)
	}

	// Build the transaction
	tx, err := solana.NewTransactionBuilder().
		AddInstruction(cuLimit).
		AddInstruction(cuPrice).
		AddInstruction(transferIx).
		SetRecentBlockHash(blockhash).
		SetFeePayer(params.FeePayer).
		Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction: %w", err)
	}

	return tx, nil
}

func (s *facilitatorSolanaSigner) GetRecentBlockhash(ctx context.Context, network string) (solana.Hash, error) {
	client, err := s.getClient(network)
	if err != nil {
		return solana.Hash{}, err
	}

	result, err := client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return solana.Hash{}, fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	return result.Value.Blockhash, nil
}

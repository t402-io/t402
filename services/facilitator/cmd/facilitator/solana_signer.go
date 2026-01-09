package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	solana "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/t402-io/t402/go/mechanisms/svm"
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

	// Parse private key (64 bytes hex = 32 bytes key)
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	// Solana private keys are 64 bytes (32 bytes seed + 32 bytes public key)
	// If we only have 32 bytes (seed), we need to derive the full key
	var privateKey solana.PrivateKey
	if len(privateKeyBytes) == 32 {
		// This is a seed, derive the full keypair
		privateKey = solana.PrivateKey(privateKeyBytes)
	} else if len(privateKeyBytes) == 64 {
		privateKey = solana.PrivateKey(privateKeyBytes)
	} else {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	publicKey := privateKey.PublicKey()

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

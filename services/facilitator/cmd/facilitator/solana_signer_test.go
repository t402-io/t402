package main

import (
	"context"
	"encoding/hex"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
)

func TestNewFacilitatorSolanaSigner(t *testing.T) {
	// Generate a valid 32-byte private key (seed)
	validSeed := "0000000000000000000000000000000000000000000000000000000000000001"

	tests := []struct {
		name       string
		privateKey string
		wantErr    bool
	}{
		{
			name:       "valid 32-byte seed",
			privateKey: validSeed,
			wantErr:    false,
		},
		{
			name:       "valid with 0x prefix",
			privateKey: "0x" + validSeed,
			wantErr:    false,
		},
		{
			name:       "empty private key",
			privateKey: "",
			wantErr:    true,
		},
		{
			name:       "invalid hex",
			privateKey: "not-valid-hex",
			wantErr:    true,
		},
		{
			name:       "wrong length (16 bytes)",
			privateKey: "00000000000000000000000000000001",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := newFacilitatorSolanaSigner(tt.privateKey, "", "")

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if signer == nil {
				t.Fatal("Expected non-nil signer")
			}

			// Check that clients are configured
			if len(signer.clients) != 3 { // mainnet, devnet, testnet
				t.Errorf("Expected 3 RPC clients, got %d", len(signer.clients))
			}
		})
	}
}

func TestNewFacilitatorSolanaSigner_64ByteKey(t *testing.T) {
	// 64-byte private key (full keypair)
	seed := make([]byte, 32)
	seed[31] = 1
	pubKey := make([]byte, 32)
	pubKey[0] = 1

	// Combine seed + pubkey for 64-byte key
	fullKey := append(seed, pubKey...)
	fullKeyHex := hex.EncodeToString(fullKey)

	signer, err := newFacilitatorSolanaSigner(fullKeyHex, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	if signer == nil {
		t.Fatal("Expected non-nil signer")
	}
}

func TestNewFacilitatorSolanaSigner_WithCustomRPCs(t *testing.T) {
	validSeed := "0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorSolanaSigner(
		validSeed,
		"https://custom-mainnet.example.com",
		"https://custom-devnet.example.com",
	)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	if signer == nil {
		t.Fatal("Expected non-nil signer")
	}

	// Verify clients are created
	if _, ok := signer.clients[svm.SolanaMainnetCAIP2]; !ok {
		t.Error("Expected mainnet client to be configured")
	}
	if _, ok := signer.clients[svm.SolanaDevnetCAIP2]; !ok {
		t.Error("Expected devnet client to be configured")
	}
}

func TestFacilitatorSolanaSigner_GetAddresses(t *testing.T) {
	validSeed := "0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorSolanaSigner(validSeed, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	ctx := context.Background()
	addresses := signer.GetAddresses(ctx, svm.SolanaMainnetCAIP2)

	if len(addresses) != 1 {
		t.Errorf("Expected 1 address, got %d", len(addresses))
	}

	// Verify the public key is not empty
	if len(addresses) > 0 && addresses[0].IsZero() {
		t.Error("Expected non-zero public key")
	}
}

func TestFacilitatorSolanaSigner_getClient(t *testing.T) {
	validSeed := "0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorSolanaSigner(validSeed, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	tests := []struct {
		name    string
		network string
		wantErr bool
	}{
		{
			name:    "mainnet",
			network: svm.SolanaMainnetCAIP2,
			wantErr: false,
		},
		{
			name:    "devnet",
			network: svm.SolanaDevnetCAIP2,
			wantErr: false,
		},
		{
			name:    "testnet",
			network: svm.SolanaTestnetCAIP2,
			wantErr: false,
		},
		{
			name:    "invalid network",
			network: "invalid:network",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := signer.getClient(tt.network)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if client == nil {
				t.Error("Expected non-nil client")
			}
		})
	}
}

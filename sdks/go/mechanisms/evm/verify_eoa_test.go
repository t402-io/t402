package evm

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestVerifyEOASignature(t *testing.T) {
	// Generate a test private key
	privateKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	address := crypto.PubkeyToAddress(privateKey.PublicKey)
	testHash := crypto.Keccak256([]byte("test message"))

	// Create a valid signature
	sig, err := crypto.Sign(testHash, privateKey)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	// Adjust v value for Ethereum (27/28)
	sig[64] += 27

	tests := []struct {
		name            string
		hash            []byte
		signature       func() []byte
		expectedAddress common.Address
		want            bool
		wantErr         bool
	}{
		{
			name:            "valid EOA signature",
			hash:            testHash,
			signature:       func() []byte { return sig },
			expectedAddress: address,
			want:            true,
			wantErr:         false,
		},
		{
			name:            "invalid signature length (64 bytes)",
			hash:            testHash,
			signature:       func() []byte { return make([]byte, 64) },
			expectedAddress: address,
			want:            false,
			wantErr:         true,
		},
		{
			name:            "invalid signature length (66 bytes)",
			hash:            testHash,
			signature:       func() []byte { return make([]byte, 66) },
			expectedAddress: address,
			want:            false,
			wantErr:         true,
		},
		{
			name:            "wrong address",
			hash:            testHash,
			signature:       func() []byte { return sig },
			expectedAddress: common.HexToAddress("0x0000000000000000000000000000000000000001"),
			want:            false,
			wantErr:         false,
		},
		{
			name: "wrong hash",
			hash: crypto.Keccak256([]byte("different message")),
			signature: func() []byte {
				// Create signature for a different hash
				wrongHash := crypto.Keccak256([]byte("wrong message"))
				wrongSig, _ := crypto.Sign(wrongHash, privateKey)
				wrongSig[64] += 27
				return wrongSig
			},
			expectedAddress: address,
			want:            false,
			wantErr:         false,
		},
		{
			name:            "empty signature",
			hash:            testHash,
			signature:       func() []byte { return []byte{} },
			expectedAddress: address,
			want:            false,
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := VerifyEOASignature(tt.hash, tt.signature(), tt.expectedAddress)

			if (err != nil) != tt.wantErr {
				t.Errorf("VerifyEOASignature() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && got != tt.want {
				t.Errorf("VerifyEOASignature() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestVerifyEOASignature_VValueAdjustment tests that v value adjustment works correctly
func TestVerifyEOASignature_VValueAdjustment(t *testing.T) {
	privateKey, _ := crypto.GenerateKey()
	address := crypto.PubkeyToAddress(privateKey.PublicKey)
	testHash := crypto.Keccak256([]byte("test"))

	t.Run("accepts v = 0 or 1 (already adjusted)", func(t *testing.T) {
		sig, _ := crypto.Sign(testHash, privateKey)
		// sig has v = 0 or 1

		got, err := VerifyEOASignature(testHash, sig, address)
		if err != nil {
			t.Errorf("VerifyEOASignature() unexpected error = %v", err)
			return
		}
		if !got {
			t.Error("VerifyEOASignature() with v=0/1 should be valid")
		}
	})

	t.Run("accepts v = 27 or 28 (Ethereum format)", func(t *testing.T) {
		sig, _ := crypto.Sign(testHash, privateKey)
		// Adjust to Ethereum format
		sig[64] += 27

		got, err := VerifyEOASignature(testHash, sig, address)
		if err != nil {
			t.Errorf("VerifyEOASignature() unexpected error = %v", err)
			return
		}
		if !got {
			t.Error("VerifyEOASignature() with v=27/28 should be valid")
		}
	})
}

// TestVerifyEOASignature_Malleability tests that high-s signatures are rejected
func TestVerifyEOASignature_Malleability(t *testing.T) {
	privateKey, _ := crypto.GenerateKey()
	address := crypto.PubkeyToAddress(privateKey.PublicKey)
	testHash := crypto.Keccak256([]byte("malleability test"))

	// Generate a valid signature
	sig, err := crypto.Sign(testHash, privateKey)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	// First, verify the original signature works (should have low s)
	t.Run("accepts low-s signature", func(t *testing.T) {
		// Make a copy with Ethereum v format
		lowSSig := make([]byte, 65)
		copy(lowSSig, sig)
		lowSSig[64] += 27

		got, err := VerifyEOASignature(testHash, lowSSig, address)
		if err != nil {
			t.Errorf("VerifyEOASignature() unexpected error for low-s: %v", err)
			return
		}
		if !got {
			t.Error("VerifyEOASignature() should accept low-s signature")
		}
	})

	t.Run("rejects high-s signature (malleability)", func(t *testing.T) {
		// Create a malleable signature by computing s' = n - s
		// Original s is bytes 32-63
		s := new(big.Int).SetBytes(sig[32:64])

		// Compute s' = n - s (this creates the malleable counterpart)
		sPrime := new(big.Int).Sub(secp256k1N, s)

		// Create the malleable signature
		malleableSig := make([]byte, 65)
		copy(malleableSig, sig[:32])                       // Keep r
		copy(malleableSig[32:64], sPrime.FillBytes(make([]byte, 32))) // Replace s with s'
		malleableSig[64] = sig[64] + 27                    // Keep v with Ethereum format

		// Flip the recovery bit since s changed
		if malleableSig[64] == 27 {
			malleableSig[64] = 28
		} else {
			malleableSig[64] = 27
		}

		// This should fail with malleability error
		_, err := VerifyEOASignature(testHash, malleableSig, address)
		if err == nil {
			t.Error("VerifyEOASignature() should reject high-s signature")
			return
		}
		if err != ErrSignatureMalleability {
			t.Errorf("VerifyEOASignature() error = %v, want %v", err, ErrSignatureMalleability)
		}
	})
}

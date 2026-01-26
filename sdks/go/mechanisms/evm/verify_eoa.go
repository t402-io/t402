package evm

import (
	"errors"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// secp256k1N is the order of the secp256k1 curve
// n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
var secp256k1N, _ = new(big.Int).SetString("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16)

// secp256k1HalfN is n/2, used for signature malleability check
// halfN = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
var secp256k1HalfN = new(big.Int).Div(secp256k1N, big.NewInt(2))

// ErrSignatureMalleability is returned when a signature has high s-value
var ErrSignatureMalleability = errors.New("signature malleability: s value is too high")

// VerifyEOASignature verifies an ECDSA signature from an externally owned account (EOA)
//
// This function uses secp256k1 public key recovery to verify that the signature
// was created by the expected address. It handles the Ethereum-specific v value
// adjustment (27/28 → 0/1 for recovery).
//
// It also checks for signature malleability by ensuring the s value is in the
// lower half of the curve order (s <= n/2). This prevents transaction malleability
// attacks where an attacker could create a second valid signature (r, n-s) from
// an existing signature (r, s).
//
// Args:
//
//	hash: The 32-byte message hash that was signed
//	signature: The 65-byte ECDSA signature (r: 32 bytes, s: 32 bytes, v: 1 byte)
//	expectedAddress: The Ethereum address that should have signed the message
//
// Returns:
//
//	true if the signature is valid and recovers to the expected address
//	error if the signature is malformed, has high s-value, or recovery fails
func VerifyEOASignature(
	hash []byte,
	signature []byte,
	expectedAddress common.Address,
) (bool, error) {
	if len(signature) != 65 {
		return false, errors.New("invalid EOA signature length: expected 65 bytes")
	}

	// Create a copy to avoid modifying the original signature
	sig := make([]byte, 65)
	copy(sig, signature)

	// Check for signature malleability
	// The s value is bytes 32-63 (0-indexed: sig[32:64])
	s := new(big.Int).SetBytes(sig[32:64])
	if s.Cmp(secp256k1HalfN) > 0 {
		return false, ErrSignatureMalleability
	}

	// Adjust v value for recovery
	// Ethereum uses v = 27 or 28, but crypto.SigToPub expects v = 0 or 1
	v := sig[64]
	if v >= 27 {
		sig[64] = v - 27
	}

	// Recover the public key from the signature
	pubKey, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return false, err
	}

	// Derive the Ethereum address from the recovered public key
	recoveredAddress := crypto.PubkeyToAddress(*pubKey)

	// Compare the recovered address with the expected address
	return recoveredAddress == expectedAddress, nil
}

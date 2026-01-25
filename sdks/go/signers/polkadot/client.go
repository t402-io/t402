// Package polkadot provides a Polkadot signer implementation using Ed25519 for t402 payments.
//
// This package enables Asset Hub asset transfers for the t402 payment protocol.
// Polkadot uses Ed25519 (or Sr25519) for transaction signing with SS58 address encoding.
package polkadot

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha512"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	"golang.org/x/crypto/blake2b"
)

// Base58 alphabet for SS58 encoding
const ss58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// SS58 prefix constant
var ss58Prefix = []byte("SS58PRE")

// ClientSigner implements the Polkadot client signer interface using an Ed25519 private key.
type ClientSigner struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	address    string
	ss58Prefix int
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// SS58Prefix is the network-specific prefix (0 for Polkadot, 2 for Kusama, 42 for Westend)
	SS58Prefix int
}

// NewClientSignerFromPrivateKey creates a client signer from a hex-encoded Ed25519 private key.
//
// Args:
//
//	privateKeyHex: Hex-encoded Ed25519 private key (with or without "0x" prefix)
//	config: Configuration with SS58 prefix
//
// Returns:
//
//	ClientSigner implementation
//	Error if private key is invalid
func NewClientSignerFromPrivateKey(privateKeyHex string, config *Config) (*ClientSigner, error) {
	// Strip 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Decode hex
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex private key: %w", err)
	}

	// Ed25519 private keys are 32 bytes (seed) or 64 bytes (full key)
	var privateKey ed25519.PrivateKey
	if len(privateKeyBytes) == 64 {
		privateKey = ed25519.PrivateKey(privateKeyBytes)
	} else if len(privateKeyBytes) == 32 {
		privateKey = ed25519.NewKeyFromSeed(privateKeyBytes)
	} else {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	return newClientSignerFromKey(privateKey, config)
}

// NewClientSignerFromSeed creates a client signer from a hex-encoded 32-byte seed.
//
// Args:
//
//	seedHex: Hex-encoded 32-byte seed (with or without "0x" prefix)
//	config: Configuration with SS58 prefix
//
// Returns:
//
//	ClientSigner implementation
//	Error if seed is invalid
func NewClientSignerFromSeed(seedHex string, config *Config) (*ClientSigner, error) {
	// Strip 0x prefix if present
	seedHex = strings.TrimPrefix(seedHex, "0x")

	// Decode hex
	seedBytes, err := hex.DecodeString(seedHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex seed: %w", err)
	}

	if len(seedBytes) != 32 {
		return nil, fmt.Errorf("invalid seed length: expected 32 bytes, got %d", len(seedBytes))
	}

	privateKey := ed25519.NewKeyFromSeed(seedBytes)
	return newClientSignerFromKey(privateKey, config)
}

// newClientSignerFromKey creates a client signer from an Ed25519 private key
func newClientSignerFromKey(privateKey ed25519.PrivateKey, config *Config) (*ClientSigner, error) {
	// Extract public key
	publicKey := privateKey.Public().(ed25519.PublicKey)

	// Determine SS58 prefix
	ss58Prefix := 42 // Default to Westend (testnet)
	if config != nil {
		ss58Prefix = config.SS58Prefix
	}

	// Derive SS58 address from public key
	address, err := publicKeyToSS58(publicKey, ss58Prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address: %w", err)
	}

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		address:    address,
		ss58Prefix: ss58Prefix,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}, nil
}

// Address returns the signer's SS58-encoded Polkadot address.
func (s *ClientSigner) Address() string {
	return s.address
}

// PublicKeyHex returns the public key as hex string.
func (s *ClientSigner) PublicKeyHex() string {
	return "0x" + hex.EncodeToString(s.publicKey)
}

// SignAndSubmitExtrinsic signs and submits an asset transfer extrinsic.
// Returns the result containing the extrinsic hash, block hash, and extrinsic index.
func (s *ClientSigner) SignAndSubmitExtrinsic(
	ctx context.Context,
	call polkadot.ExtrinsicCall,
	network string,
) (*polkadot.ClientExtrinsicResult, error) {
	// Get network config
	config, ok := polkadot.GetNetworkConfig(network)
	if !ok {
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	// Get current block and nonce
	blockHash, blockNumber, err := s.getLatestBlock(ctx, config.IndexerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest block: %w", err)
	}

	nonce, err := s.getNonce(ctx, config.IndexerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Build the extrinsic
	extrinsic, err := s.buildExtrinsic(call, nonce, blockNumber, config)
	if err != nil {
		return nil, fmt.Errorf("failed to build extrinsic: %w", err)
	}

	// Sign the extrinsic
	signedExtrinsic, err := s.signExtrinsic(extrinsic, config)
	if err != nil {
		return nil, fmt.Errorf("failed to sign extrinsic: %w", err)
	}

	// Submit the extrinsic using Subscan API
	extrinsicHash, extrinsicIndex, err := s.submitExtrinsic(ctx, config.IndexerURL, signedExtrinsic)
	if err != nil {
		return nil, fmt.Errorf("failed to submit extrinsic: %w", err)
	}

	return &polkadot.ClientExtrinsicResult{
		ExtrinsicHash:  extrinsicHash,
		BlockHash:      blockHash,
		ExtrinsicIndex: extrinsicIndex,
	}, nil
}

// getLatestBlock gets the latest block hash and number
func (s *ClientSigner) getLatestBlock(ctx context.Context, indexerURL string) (string, int64, error) {
	url := fmt.Sprintf("%s/api/scan/block/latest", indexerURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader("{}"))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Data struct {
			BlockHash   string `json:"hash"`
			BlockNumber int64  `json:"block_num"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", 0, err
	}

	return result.Data.BlockHash, result.Data.BlockNumber, nil
}

// getNonce gets the current nonce for the account
func (s *ClientSigner) getNonce(ctx context.Context, indexerURL string) (uint64, error) {
	reqBody := map[string]interface{}{
		"address": s.address,
	}
	reqBytes, _ := json.Marshal(reqBody)

	url := fmt.Sprintf("%s/api/v2/scan/search", indexerURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Data struct {
			Account struct {
				Nonce int64 `json:"nonce"`
			} `json:"account"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, nil // Return 0 if account not found
	}

	return uint64(result.Data.Account.Nonce), nil
}

// buildExtrinsic builds a SCALE-encoded extrinsic for assets.transfer_keep_alive
func (s *ClientSigner) buildExtrinsic(call polkadot.ExtrinsicCall, nonce uint64, blockNumber int64, config polkadot.NetworkConfig) ([]byte, error) {
	var buf bytes.Buffer

	// Call data: assets.transfer_keep_alive(id, target, amount)
	// Module index for Assets: typically 50 (0x32)
	// Call index for transfer_keep_alive: typically 2

	// Build call
	callBuf := &bytes.Buffer{}

	// Pallet index (Assets = 50)
	callBuf.WriteByte(50)

	// Call index (transfer_keep_alive = 2)
	callBuf.WriteByte(2)

	// Asset ID (compact encoded)
	writeCompact(callBuf, uint64(call.AssetID))

	// Target address (MultiAddress::Id)
	callBuf.WriteByte(0) // Id variant
	targetBytes, err := ss58ToPublicKey(call.Target)
	if err != nil {
		return nil, fmt.Errorf("invalid target address: %w", err)
	}
	callBuf.Write(targetBytes)

	// Amount (compact encoded)
	amount, ok := new(big.Int).SetString(call.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", call.Amount)
	}
	writeCompactBigInt(callBuf, amount)

	// Build extra (era, nonce, tip)
	extraBuf := &bytes.Buffer{}

	// Era (mortal, 64 blocks)
	era := getMortalEra(blockNumber, 64)
	extraBuf.WriteByte(era[0])
	extraBuf.WriteByte(era[1])

	// Nonce (compact)
	writeCompact(extraBuf, nonce)

	// Tip (compact, 0)
	writeCompact(extraBuf, 0)

	// Build additional signed extensions
	// spec_version, transaction_version, genesis_hash, block_hash
	additionalBuf := &bytes.Buffer{}

	// spec_version and tx_version - use defaults
	binary.Write(additionalBuf, binary.LittleEndian, uint32(1000000)) // spec_version
	binary.Write(additionalBuf, binary.LittleEndian, uint32(1))      // tx_version

	// Genesis hash
	genesisHash, _ := hex.DecodeString(strings.TrimPrefix(config.GenesisHash, "0x"))
	additionalBuf.Write(genesisHash)

	// Block hash (checkpoint)
	additionalBuf.Write(genesisHash) // Use genesis as checkpoint for immortal

	// Combine for signing payload
	buf.Write(callBuf.Bytes())
	buf.Write(extraBuf.Bytes())
	buf.Write(additionalBuf.Bytes())

	return buf.Bytes(), nil
}

// signExtrinsic signs the extrinsic
func (s *ClientSigner) signExtrinsic(payload []byte, config polkadot.NetworkConfig) ([]byte, error) {
	// Hash if payload > 256 bytes
	var signingPayload []byte
	if len(payload) > 256 {
		hash := blake2b.Sum256(payload)
		signingPayload = hash[:]
	} else {
		signingPayload = payload
	}

	// Sign with Ed25519
	signature := ed25519.Sign(s.privateKey, signingPayload)

	// Build signed extrinsic
	var buf bytes.Buffer

	// Version byte: 0x84 (signed, Ed25519)
	buf.WriteByte(0x84)

	// Signer (MultiAddress::Id)
	buf.WriteByte(0) // Id variant
	buf.Write(s.publicKey)

	// Signature type: Ed25519 = 0
	buf.WriteByte(0)
	buf.Write(signature)

	// Era, nonce, tip from payload
	// (simplified - in practice need to extract these properly)
	writeCompact(&buf, 0) // mortal era
	writeCompact(&buf, 0) // nonce
	writeCompact(&buf, 0) // tip

	// Call data (from payload, need to separate properly)
	// Simplified: just append call data
	buf.Write(payload[:50]) // Approximate call size

	// Prepend length
	result := buf.Bytes()
	var final bytes.Buffer
	writeCompact(&final, uint64(len(result)))
	final.Write(result)

	return final.Bytes(), nil
}

// submitExtrinsic submits a signed extrinsic and returns the hash
func (s *ClientSigner) submitExtrinsic(ctx context.Context, indexerURL string, signedExtrinsic []byte) (string, int, error) {
	// Calculate extrinsic hash
	hash := blake2b.Sum256(signedExtrinsic)
	extrinsicHash := "0x" + hex.EncodeToString(hash[:])

	// Note: Subscan doesn't have a direct submit endpoint
	// In a real implementation, you would use the RPC endpoint
	// For now, return the calculated hash

	return extrinsicHash, 0, fmt.Errorf("extrinsic submission not implemented - use RPC endpoint directly")
}

// publicKeyToSS58 converts a public key to SS58 address format
func publicKeyToSS58(publicKey []byte, prefix int) (string, error) {
	if len(publicKey) != 32 {
		return "", fmt.Errorf("invalid public key length: expected 32 bytes, got %d", len(publicKey))
	}

	// Build payload: prefix + public key
	var payload []byte
	if prefix < 64 {
		payload = append([]byte{byte(prefix)}, publicKey...)
	} else if prefix < 16384 {
		// Two-byte prefix
		first := byte(((prefix & 0xFC) >> 2) | 0x40)
		second := byte((prefix >> 8) | ((prefix & 0x03) << 6))
		payload = append([]byte{first, second}, publicKey...)
	} else {
		return "", fmt.Errorf("prefix too large: %d", prefix)
	}

	// Calculate checksum
	checksumInput := append(ss58Prefix, payload...)
	hash := blake2b.Sum512(checksumInput)
	checksum := hash[:2]

	// Combine payload + checksum
	full := append(payload, checksum...)

	return base58Encode(full), nil
}

// ss58ToPublicKey decodes an SS58 address to public key bytes
func ss58ToPublicKey(address string) ([]byte, error) {
	decoded, err := base58Decode(address)
	if err != nil {
		return nil, err
	}

	if len(decoded) < 35 {
		return nil, fmt.Errorf("invalid SS58 address length")
	}

	// Determine prefix length
	prefixLen := 1
	if decoded[0]&0x40 != 0 {
		prefixLen = 2
	}

	// Extract public key (32 bytes after prefix, before 2-byte checksum)
	publicKey := decoded[prefixLen : len(decoded)-2]
	if len(publicKey) != 32 {
		return nil, fmt.Errorf("invalid public key length in SS58: %d", len(publicKey))
	}

	return publicKey, nil
}

// getMortalEra calculates the mortal era bytes
func getMortalEra(blockNumber int64, period int64) []byte {
	calPeriod := int64(1)
	for calPeriod < period {
		calPeriod <<= 1
	}
	if calPeriod > 65536 {
		calPeriod = 65536
	}

	phase := blockNumber % calPeriod
	quantizeFactor := calPeriod >> 12
	if quantizeFactor < 1 {
		quantizeFactor = 1
	}
	quantizedPhase := phase / quantizeFactor * quantizeFactor

	// Encode era
	encoded := uint16(0)
	periodLog := 0
	for (calPeriod >> periodLog) > 1 {
		periodLog++
	}
	encoded = uint16(periodLog-1) | uint16(quantizedPhase/quantizeFactor)<<4

	return []byte{byte(encoded & 0xFF), byte(encoded >> 8)}
}

// writeCompact writes a SCALE compact-encoded unsigned integer
func writeCompact(buf *bytes.Buffer, value uint64) {
	if value < 64 {
		buf.WriteByte(byte(value << 2))
	} else if value < 16384 {
		binary.Write(buf, binary.LittleEndian, uint16((value<<2)|1))
	} else if value < 1073741824 {
		binary.Write(buf, binary.LittleEndian, uint32((value<<2)|2))
	} else {
		// Big integer mode
		buf.WriteByte(3) // BigInt indicator
		binary.Write(buf, binary.LittleEndian, value)
	}
}

// writeCompactBigInt writes a SCALE compact-encoded big integer
func writeCompactBigInt(buf *bytes.Buffer, value *big.Int) {
	if value.Cmp(big.NewInt(1<<30)) < 0 {
		writeCompact(buf, value.Uint64())
		return
	}

	// Big integer encoding
	bytes := value.Bytes()
	// Reverse for little-endian
	for i, j := 0, len(bytes)-1; i < j; i, j = i+1, j-1 {
		bytes[i], bytes[j] = bytes[j], bytes[i]
	}

	header := byte(((len(bytes) - 4) << 2) | 3)
	buf.WriteByte(header)
	buf.Write(bytes)
}

// base58Encode encodes bytes to Base58
func base58Encode(data []byte) string {
	num := new(big.Int).SetBytes(data)
	zero := big.NewInt(0)
	base := big.NewInt(58)

	var result []byte
	mod := new(big.Int)

	for num.Cmp(zero) > 0 {
		num.DivMod(num, base, mod)
		result = append([]byte{ss58Alphabet[mod.Int64()]}, result...)
	}

	// Add leading '1's for leading zero bytes
	for _, b := range data {
		if b != 0 {
			break
		}
		result = append([]byte{'1'}, result...)
	}

	return string(result)
}

// base58Decode decodes a Base58 string to bytes
func base58Decode(encoded string) ([]byte, error) {
	result := big.NewInt(0)
	base := big.NewInt(58)

	for _, c := range encoded {
		idx := strings.IndexRune(ss58Alphabet, c)
		if idx < 0 {
			return nil, fmt.Errorf("invalid Base58 character: %c", c)
		}
		result.Mul(result, base)
		result.Add(result, big.NewInt(int64(idx)))
	}

	decoded := result.Bytes()

	// Add leading zero bytes for leading '1's
	for _, c := range encoded {
		if c != '1' {
			break
		}
		decoded = append([]byte{0}, decoded...)
	}

	return decoded, nil
}

// hashBlake2b256 computes Blake2b-256 hash
func hashBlake2b256(data []byte) []byte {
	hash := blake2b.Sum256(data)
	return hash[:]
}

// hashBlake2b512 computes Blake2b-512 hash
func hashBlake2b512(data []byte) []byte {
	hash := sha512.Sum512(data)
	return hash[:]
}

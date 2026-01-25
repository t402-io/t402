// Package stacks provides a Stacks signer implementation using secp256k1 for t402 payments.
//
// This package enables SIP-010 fungible token transfers for the t402 payment protocol.
// Stacks uses secp256k1 ECDSA (same curve as Bitcoin) with a unique address encoding.
package stacks

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"golang.org/x/crypto/ripemd160"
)

// Base58 alphabet
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// C32 alphabet (Stacks uses Crockford Base32 variant)
const c32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// C32 version characters (mapped from version byte to character)
var c32VersionChars = map[byte]byte{
	22: 'P', // SP - single-sig mainnet
	20: 'M', // SM - multi-sig mainnet
	26: 'T', // ST - single-sig testnet
	21: 'N', // SN - multi-sig testnet
}

// Address version bytes
const (
	MainnetSingleSig   byte = 22 // P (single-sig mainnet)
	MainnetMultiSig    byte = 20 // M (multi-sig mainnet)
	TestnetSingleSig   byte = 26 // T (single-sig testnet)
	TestnetMultiSig    byte = 21 // N (multi-sig testnet)
)

// Hash mode for address derivation
const (
	SerializeP2PKH byte = 0x00 // Single-sig
	SerializeP2SH  byte = 0x01 // Multi-sig
)

// Transaction auth type
const (
	AuthStandard     byte = 0x04
	AuthSponsored    byte = 0x05
)

// Transaction type
const (
	TxTypeTokenTransfer       byte = 0x00
	TxTypeSmartContract       byte = 0x01
	TxTypeContractCall        byte = 0x02
)

// Post condition mode
const (
	PostConditionModeAllow byte = 0x01
	PostConditionModeDeny  byte = 0x02
)

// Anchor mode
const (
	AnchorModeOnChainOnly byte = 0x01
	AnchorModeOffChainOnly byte = 0x02
	AnchorModeAny         byte = 0x03
)

// ClientSigner implements the Stacks client signer interface using a secp256k1 private key.
type ClientSigner struct {
	privateKey *btcec.PrivateKey
	publicKey  *btcec.PublicKey
	address    string
	isTestnet  bool
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// IsTestnet determines address prefix (SP for mainnet, ST for testnet)
	IsTestnet bool
}

// NewClientSignerFromPrivateKey creates a client signer from a hex-encoded secp256k1 private key.
//
// Args:
//
//	privateKeyHex: Hex-encoded secp256k1 private key (with or without "0x" prefix)
//	config: Configuration with network mode
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

	if len(privateKeyBytes) != 32 {
		return nil, fmt.Errorf("invalid private key length: expected 32 bytes, got %d", len(privateKeyBytes))
	}

	privateKey, publicKey := btcec.PrivKeyFromBytes(privateKeyBytes)
	return newClientSignerFromKey(privateKey, publicKey, config)
}

// NewClientSignerFromSeed creates a client signer from a hex-encoded 32-byte seed.
//
// Args:
//
//	seedHex: Hex-encoded 32-byte seed (with or without "0x" prefix)
//	config: Configuration with network mode
//
// Returns:
//
//	ClientSigner implementation
//	Error if seed is invalid
func NewClientSignerFromSeed(seedHex string, config *Config) (*ClientSigner, error) {
	return NewClientSignerFromPrivateKey(seedHex, config)
}

// newClientSignerFromKey creates a client signer from a secp256k1 key pair
func newClientSignerFromKey(privateKey *btcec.PrivateKey, publicKey *btcec.PublicKey, config *Config) (*ClientSigner, error) {
	// Determine network
	isTestnet := false
	if config != nil {
		isTestnet = config.IsTestnet
	}

	// Derive address from public key
	address := publicKeyToAddress(publicKey, isTestnet)

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		address:    address,
		isTestnet:  isTestnet,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}, nil
}

// Address returns the signer's Stacks principal address.
func (s *ClientSigner) Address() string {
	return s.address
}

// PublicKeyHex returns the public key as hex string.
func (s *ClientSigner) PublicKeyHex() string {
	return hex.EncodeToString(s.publicKey.SerializeCompressed())
}

// TransferToken signs and submits a SIP-010 token transfer transaction.
func (s *ClientSigner) TransferToken(
	ctx context.Context,
	contractAddress string,
	to string,
	amount *big.Int,
) (string, error) {
	// Parse contract address
	contractPrincipal, contractName, err := parseContractId(contractAddress)
	if err != nil {
		return "", fmt.Errorf("invalid contract address: %w", err)
	}

	// Get API URL based on network
	apiURL := stacks.DefaultHiroMainnetAPI
	if s.isTestnet {
		apiURL = stacks.DefaultHiroTestnetAPI
	}

	// Get nonce
	nonce, err := s.getNonce(ctx, apiURL)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get fee estimate
	fee := uint64(50000) // Default fee in microSTX

	// Build the transaction
	tx, err := s.buildContractCall(contractPrincipal, contractName, to, amount, nonce, fee)
	if err != nil {
		return "", fmt.Errorf("failed to build transaction: %w", err)
	}

	// Sign the transaction
	signedTx, err := s.signTransaction(tx)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Broadcast the transaction
	txId, err := s.broadcastTransaction(ctx, apiURL, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to broadcast transaction: %w", err)
	}

	return txId, nil
}

// getNonce gets the current nonce for the account
func (s *ClientSigner) getNonce(ctx context.Context, apiURL string) (uint64, error) {
	url := fmt.Sprintf("%s/extended/v1/address/%s/nonces", apiURL, s.address)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		PossibleNextNonce uint64 `json:"possible_next_nonce"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	return result.PossibleNextNonce, nil
}

// buildContractCall builds a SIP-010 transfer contract call transaction
func (s *ClientSigner) buildContractCall(
	contractPrincipal string,
	contractName string,
	to string,
	amount *big.Int,
	nonce uint64,
	fee uint64,
) ([]byte, error) {
	var buf bytes.Buffer

	// Transaction version
	if s.isTestnet {
		buf.WriteByte(0x80) // Testnet
	} else {
		buf.WriteByte(0x00) // Mainnet
	}

	// Chain ID
	chainID := uint32(1)
	if s.isTestnet {
		chainID = 0x80000000
	}
	binary.Write(&buf, binary.BigEndian, chainID)

	// Authorization: Standard with single-sig spending condition
	buf.WriteByte(AuthStandard)
	buf.WriteByte(SerializeP2PKH) // Hash mode: single-sig

	// Signer public key hash (20 bytes)
	pubKeyHash := hash160(s.publicKey.SerializeCompressed())
	buf.Write(pubKeyHash)

	// Nonce
	binary.Write(&buf, binary.BigEndian, nonce)

	// Fee
	binary.Write(&buf, binary.BigEndian, fee)

	// Signature (placeholder - will be filled in signTransaction)
	// Signature type (0x00 for uncompressed, 0x01 for compressed recoverable)
	// We'll use placeholder bytes here
	for i := 0; i < 65; i++ {
		buf.WriteByte(0x00)
	}

	// Anchor mode
	buf.WriteByte(AnchorModeAny)

	// Post-condition mode (allow)
	buf.WriteByte(PostConditionModeAllow)

	// Post-conditions (empty vec)
	binary.Write(&buf, binary.BigEndian, uint32(0))

	// Payload: Contract call
	buf.WriteByte(TxTypeContractCall)

	// Contract address (principal)
	if err := writePrincipal(&buf, contractPrincipal, s.isTestnet); err != nil {
		return nil, err
	}

	// Contract name (LengthPrefixedString)
	writeLengthPrefixedString(&buf, contractName)

	// Function name: "transfer"
	writeLengthPrefixedString(&buf, "transfer")

	// Function arguments (4 for SIP-010 transfer: amount, sender, recipient, memo)
	binary.Write(&buf, binary.BigEndian, uint32(4))

	// Argument 1: amount (uint)
	buf.WriteByte(0x01) // Clarity type: uint
	amountBytes := make([]byte, 16)
	amount.FillBytes(amountBytes)
	buf.Write(amountBytes)

	// Argument 2: sender (principal)
	buf.WriteByte(0x05) // Clarity type: principal
	if err := writePrincipal(&buf, s.address, s.isTestnet); err != nil {
		return nil, err
	}

	// Argument 3: recipient (principal)
	buf.WriteByte(0x05) // Clarity type: principal
	if err := writePrincipal(&buf, to, s.isTestnet); err != nil {
		return nil, err
	}

	// Argument 4: memo (optional none)
	buf.WriteByte(0x09) // Clarity type: none

	return buf.Bytes(), nil
}

// signTransaction signs the transaction
func (s *ClientSigner) signTransaction(tx []byte) ([]byte, error) {
	// Calculate sighash
	// Skip past the signature placeholder to get presign transaction
	presignEnd := 65 + 1 + 1 + 20 + 8 + 8 // Skip auth type, hash mode, pubkey hash, nonce, fee
	presign := append(tx[:presignEnd-65], tx[presignEnd:]...)

	// Compute sighash
	hash := sha256.Sum256(presign)

	// Sign with secp256k1 using btcec/ecdsa
	signature := ecdsa.Sign(s.privateKey, hash[:])

	// Serialize signature to bytes
	sigBytes := signature.Serialize()

	// Build recoverable signature (65 bytes)
	// Stacks uses: recovery_id (1 byte) + r (32 bytes) + s (32 bytes)
	recoverableSig := make([]byte, 65)
	recoverableSig[0] = 0x01 // Compressed recoverable signature type

	// Copy r and s from DER-encoded signature
	// btcec.Serialize returns DER format, we need to extract r and s
	rLen := int(sigBytes[3])
	rStart := 4
	if sigBytes[rStart] == 0x00 {
		rStart++
		rLen--
	}
	sStart := rStart + rLen + 2
	sLen := int(sigBytes[sStart-1])
	if sigBytes[sStart] == 0x00 {
		sStart++
		sLen--
	}

	// Copy r (right-aligned to 32 bytes)
	copy(recoverableSig[1+32-rLen:33], sigBytes[rStart:rStart+rLen])
	// Copy s (right-aligned to 32 bytes)
	copy(recoverableSig[33+32-sLen:65], sigBytes[sStart:sStart+sLen])

	// Replace signature placeholder in transaction
	result := make([]byte, len(tx))
	copy(result, tx)
	copy(result[presignEnd-65:presignEnd], recoverableSig)

	return result, nil
}

// broadcastTransaction broadcasts a signed transaction
func (s *ClientSigner) broadcastTransaction(ctx context.Context, apiURL string, signedTx []byte) (string, error) {
	url := fmt.Sprintf("%s/v2/transactions", apiURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(signedTx))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/octet-stream")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	// The response should be the txid as a string
	txId := strings.Trim(string(body), "\"")
	if !strings.HasPrefix(txId, "0x") {
		txId = "0x" + txId
	}

	return txId, nil
}

// publicKeyToAddress derives a Stacks address from a secp256k1 public key
func publicKeyToAddress(publicKey *btcec.PublicKey, isTestnet bool) string {
	// Hash160 of compressed public key
	pubKeyHash := hash160(publicKey.SerializeCompressed())

	// Determine version byte
	var version byte
	if isTestnet {
		version = TestnetSingleSig
	} else {
		version = MainnetSingleSig
	}

	// Build address data: hash mode + pubkey hash (21 bytes)
	data := make([]byte, 0, 21)
	data = append(data, SerializeP2PKH) // hash mode
	data = append(data, pubKeyHash...)

	// C32Check encode with version
	return c32CheckEncode(version, data)
}

// c32CheckEncode encodes data with version using C32Check (Stacks address encoding)
func c32CheckEncode(version byte, data []byte) string {
	// Build checksum input: version + data
	checksumInput := append([]byte{version}, data...)

	// Double SHA256 checksum
	hash1 := sha256.Sum256(checksumInput)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum to data
	full := append(data, checksum...)

	// C32 encode the data
	c32Encoded := c32Encode(full)

	// Get version character
	versionChar := c32VersionChars[version]

	// Build final address: S + version_char + c32_encoded
	return "S" + string(versionChar) + c32Encoded
}

// c32Encode encodes bytes using C32 (Crockford Base32 variant)
func c32Encode(data []byte) string {
	if len(data) == 0 {
		return ""
	}

	// Convert bytes to 5-bit groups
	var result []byte
	bitBuffer := uint64(0)
	bitCount := 0

	for _, b := range data {
		bitBuffer = (bitBuffer << 8) | uint64(b)
		bitCount += 8

		for bitCount >= 5 {
			bitCount -= 5
			idx := (bitBuffer >> bitCount) & 0x1F
			result = append(result, c32Alphabet[idx])
		}
	}

	// Handle remaining bits
	if bitCount > 0 {
		idx := (bitBuffer << (5 - bitCount)) & 0x1F
		result = append(result, c32Alphabet[idx])
	}

	return string(result)
}

// hash160 computes RIPEMD160(SHA256(data))
func hash160(data []byte) []byte {
	sha := sha256.Sum256(data)
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	return ripemd.Sum(nil)
}

// base58CheckEncode encodes data with checksum
func base58CheckEncode(payload []byte) string {
	// Double SHA256 checksum
	hash1 := sha256.Sum256(payload)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum
	full := append(payload, checksum...)

	return base58Encode(full)
}

// base58CheckDecode decodes a Base58Check string
func base58CheckDecode(encoded string) ([]byte, error) {
	decoded, err := base58Decode(encoded)
	if err != nil {
		return nil, err
	}

	if len(decoded) < 4 {
		return nil, fmt.Errorf("invalid Base58Check: too short")
	}

	// Split payload and checksum
	payload := decoded[:len(decoded)-4]
	checksum := decoded[len(decoded)-4:]

	// Verify checksum
	hash1 := sha256.Sum256(payload)
	hash2 := sha256.Sum256(hash1[:])
	expectedChecksum := hash2[:4]

	if !bytes.Equal(checksum, expectedChecksum) {
		return nil, fmt.Errorf("invalid Base58Check: checksum mismatch")
	}

	return payload, nil
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
		result = append([]byte{base58Alphabet[mod.Int64()]}, result...)
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
		idx := strings.IndexRune(base58Alphabet, c)
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

// parseContractId parses a contract ID into principal and name
func parseContractId(contractId string) (string, string, error) {
	parts := strings.Split(contractId, ".")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid contract ID format: %s", contractId)
	}
	return parts[0], parts[1], nil
}

// writePrincipal writes a Stacks principal to the buffer
func writePrincipal(buf *bytes.Buffer, principal string, isTestnet bool) error {
	// Check for contract principal
	if strings.Contains(principal, ".") {
		parts := strings.Split(principal, ".")
		if len(parts) != 2 {
			return fmt.Errorf("invalid contract principal: %s", principal)
		}

		// Contract principal type
		buf.WriteByte(0x06)

		// Standard principal version
		if isTestnet {
			buf.WriteByte(TestnetSingleSig)
		} else {
			buf.WriteByte(MainnetSingleSig)
		}

		// Decode address
		decoded, err := base58CheckDecode(parts[0])
		if err != nil {
			return err
		}
		if len(decoded) < 21 {
			return fmt.Errorf("invalid address length")
		}
		// Write hash mode + address hash (skip version byte)
		buf.Write(decoded[1:21])

		// Contract name
		writeLengthPrefixedString(buf, parts[1])
	} else {
		// Standard principal type
		buf.WriteByte(0x05)

		// Version
		if isTestnet {
			buf.WriteByte(TestnetSingleSig)
		} else {
			buf.WriteByte(MainnetSingleSig)
		}

		// Decode address
		decoded, err := base58CheckDecode(principal)
		if err != nil {
			return err
		}
		if len(decoded) < 21 {
			return fmt.Errorf("invalid address length")
		}
		// Write hash mode + address hash (skip version byte)
		buf.Write(decoded[1:21])
	}

	return nil
}

// writeLengthPrefixedString writes a length-prefixed string
func writeLengthPrefixedString(buf *bytes.Buffer, s string) {
	buf.WriteByte(byte(len(s)))
	buf.WriteString(s)
}


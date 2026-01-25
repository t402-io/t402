// Package tron provides a TRON signer implementation using ECDSA secp256k1 for t402 payments.
//
// This package enables TRC20 token transfers for the t402 payment protocol.
// TRON uses the same secp256k1 curve as Ethereum but with different address encoding.
package tron

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"

	t402tron "github.com/t402-io/t402/sdks/go/mechanisms/tron"
)

// TronAddressPrefix is the version byte for TRON mainnet addresses
const TronAddressPrefix = 0x41

// DefaultFeeLimit is the default fee limit for TRC20 transfers (100 TRX in SUN)
const DefaultFeeLimit = 100_000_000

// DefaultExpiration is the default transaction validity duration
const DefaultExpiration = 300 // 5 minutes

// Base58 alphabet for TRON addresses
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// ClientSigner implements t402tron.ClientTronSigner using an ECDSA private key.
type ClientSigner struct {
	privateKey *ecdsa.PrivateKey
	address    string
	endpoint   string
	feeLimit   int64
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// Endpoint is the TRON API endpoint URL (e.g., https://api.trongrid.io)
	// or "mainnet", "nile", "shasta" for default endpoints
	Endpoint string
	// FeeLimit is the maximum fee in SUN (default: 100 TRX)
	FeeLimit int64
}

// NewClientSignerFromPrivateKey creates a client signer from a hex-encoded private key.
//
// Args:
//
//	privateKeyHex: Hex-encoded secp256k1 private key (with or without "0x" prefix)
//	config: Optional configuration (use nil for mainnet defaults)
//
// Returns:
//
//	ClientTronSigner implementation ready for use
//	Error if private key is invalid
//
// Example:
//
//	signer, err := tron.NewClientSignerFromPrivateKey("0x1234...", nil)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	client := t402.NewT402Client().
//	    Register("tron:*", tron.NewExactTronClient(signer))
func NewClientSignerFromPrivateKey(privateKeyHex string, config *Config) (t402tron.ClientTronSigner, error) {
	// Strip 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Parse hex string to ECDSA private key
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	return newClientSignerFromKey(privateKey, config)
}

// newClientSignerFromKey creates a client signer from an ECDSA private key
func newClientSignerFromKey(privateKey *ecdsa.PrivateKey, config *Config) (*ClientSigner, error) {
	if config == nil {
		config = &Config{
			Endpoint: "mainnet",
			FeeLimit: DefaultFeeLimit,
		}
	}

	// Derive TRON address from public key
	address := PublicKeyToAddress(&privateKey.PublicKey)

	// Select endpoint
	endpoint := resolveEndpoint(config.Endpoint)

	feeLimit := config.FeeLimit
	if feeLimit == 0 {
		feeLimit = DefaultFeeLimit
	}

	return &ClientSigner{
		privateKey: privateKey,
		address:    address,
		endpoint:   endpoint,
		feeLimit:   feeLimit,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Address returns the signer's TRON address (T-prefix base58check).
func (s *ClientSigner) Address() string {
	return s.address
}

// GetBlockInfo returns current block info for transaction building.
func (s *ClientSigner) GetBlockInfo(ctx context.Context) (*t402tron.BlockInfo, error) {
	// Get the latest block from TRON API
	reqBody := []byte(`{}`)
	req, err := http.NewRequestWithContext(ctx, "POST", s.endpoint+"/wallet/getnowblock", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get block: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var blockResp struct {
		BlockHeader struct {
			RawData struct {
				Number    int64  `json:"number"`
				TxTrieRoot string `json:"txTrieRoot"`
				WitnessAddress string `json:"witness_address"`
				ParentHash string `json:"parentHash"`
				Timestamp  int64  `json:"timestamp"`
			} `json:"raw_data"`
		} `json:"block_header"`
		BlockID string `json:"blockID"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&blockResp); err != nil {
		return nil, fmt.Errorf("failed to decode block response: %w", err)
	}

	// Extract ref_block_bytes (last 2 bytes of block number)
	blockNum := blockResp.BlockHeader.RawData.Number
	refBlockBytes := fmt.Sprintf("%04x", blockNum&0xFFFF)

	// Extract ref_block_hash (bytes 8-16 of block hash)
	blockID := blockResp.BlockID
	if len(blockID) < 16 {
		return nil, fmt.Errorf("invalid block ID: %s", blockID)
	}
	refBlockHash := blockID[16:32]

	// Calculate expiration (current time + 5 minutes)
	timestamp := time.Now().UnixMilli()
	expiration := timestamp + int64(DefaultExpiration*1000)

	return &t402tron.BlockInfo{
		RefBlockBytes: refBlockBytes,
		RefBlockHash:  refBlockHash,
		Expiration:    expiration,
		Timestamp:     timestamp,
	}, nil
}

// SignTransaction signs a TRC20 transfer transaction and returns the hex-encoded signed transaction.
func (s *ClientSigner) SignTransaction(ctx context.Context, params t402tron.SignTransactionParams) (string, error) {
	// Build the TRC20 transfer transaction using triggerSmartContract
	tx, err := s.buildTRC20Transaction(ctx, params)
	if err != nil {
		return "", fmt.Errorf("failed to build transaction: %w", err)
	}

	// Sign the transaction
	signedTx, err := s.signRawTransaction(tx)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Return hex-encoded signed transaction
	return signedTx, nil
}

// buildTRC20Transaction builds a TRC20 transfer transaction
func (s *ClientSigner) buildTRC20Transaction(ctx context.Context, params t402tron.SignTransactionParams) (map[string]interface{}, error) {
	// Build the transfer function data
	// transfer(address,uint256) = 0xa9059cbb
	amount, ok := new(big.Int).SetString(params.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", params.Amount)
	}

	// Convert recipient address to hex (without 0x prefix)
	toAddrHex, err := AddressToHex(params.To)
	if err != nil {
		return nil, fmt.Errorf("invalid to address: %w", err)
	}

	// Build ABI-encoded function data
	// Function selector (4 bytes) + address (32 bytes, padded) + amount (32 bytes, padded)
	functionData := "a9059cbb" // transfer(address,uint256)
	functionData += fmt.Sprintf("%064s", toAddrHex[2:]) // Remove 0x41 prefix, pad to 32 bytes
	functionData += fmt.Sprintf("%064x", amount)

	// Use triggerSmartContract API
	reqBody := map[string]interface{}{
		"owner_address":   s.address,
		"contract_address": params.ContractAddress,
		"function_selector": "transfer(address,uint256)",
		"parameter":       functionData[8:], // Exclude function selector for API
		"fee_limit":       s.feeLimit,
		"visible":         true,
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.endpoint+"/wallet/triggersmartcontract", bytes.NewReader(reqBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call triggerSmartContract: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var triggerResp struct {
		Result struct {
			Result  bool   `json:"result"`
			Message string `json:"message,omitempty"`
		} `json:"result"`
		Transaction map[string]interface{} `json:"transaction"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&triggerResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !triggerResp.Result.Result {
		return nil, fmt.Errorf("triggerSmartContract failed: %s", triggerResp.Result.Message)
	}

	return triggerResp.Transaction, nil
}

// signRawTransaction signs a raw TRON transaction
func (s *ClientSigner) signRawTransaction(tx map[string]interface{}) (string, error) {
	// Get the txID (hash to sign)
	txID, ok := tx["txID"].(string)
	if !ok {
		return "", fmt.Errorf("missing txID in transaction")
	}

	// Decode txID from hex
	txIDBytes, err := hex.DecodeString(txID)
	if err != nil {
		return "", fmt.Errorf("invalid txID hex: %w", err)
	}

	// Sign the txID hash with secp256k1
	signature, err := crypto.Sign(txIDBytes, s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign: %w", err)
	}

	// Add signature to transaction
	tx["signature"] = []string{hex.EncodeToString(signature)}

	// Serialize transaction to JSON
	txBytes, err := json.Marshal(tx)
	if err != nil {
		return "", fmt.Errorf("failed to marshal signed transaction: %w", err)
	}

	return string(txBytes), nil
}

// PublicKeyToAddress derives a TRON address from a secp256k1 public key.
func PublicKeyToAddress(publicKey *ecdsa.PublicKey) string {
	// Get uncompressed public key bytes (without 0x04 prefix)
	pubBytes := crypto.FromECDSAPub(publicKey)

	// Keccak256 hash of public key (without the 0x04 prefix)
	hash := crypto.Keccak256(pubBytes[1:])

	// Take last 20 bytes and prepend TRON address prefix
	addressBytes := make([]byte, 21)
	addressBytes[0] = TronAddressPrefix
	copy(addressBytes[1:], hash[12:])

	// Base58check encode
	return Base58CheckEncode(addressBytes)
}

// AddressToHex converts a TRON T-address to hex format (0x41...)
func AddressToHex(address string) (string, error) {
	addressBytes, err := Base58CheckDecode(address)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(addressBytes), nil
}

// HexToAddress converts a hex address (41...) to T-prefix base58check
func HexToAddress(hexAddr string) (string, error) {
	hexAddr = strings.TrimPrefix(hexAddr, "0x")
	addressBytes, err := hex.DecodeString(hexAddr)
	if err != nil {
		return "", err
	}
	return Base58CheckEncode(addressBytes), nil
}

// Base58CheckEncode encodes bytes to base58check format
func Base58CheckEncode(input []byte) string {
	// Double SHA256 checksum
	hash1 := sha256.Sum256(input)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum
	full := append(input, checksum...)

	// Convert to big integer
	intVal := new(big.Int).SetBytes(full)

	// Base58 encode
	var result []byte
	base := big.NewInt(58)
	zero := big.NewInt(0)
	mod := new(big.Int)

	for intVal.Cmp(zero) > 0 {
		intVal.DivMod(intVal, base, mod)
		result = append([]byte{base58Alphabet[mod.Int64()]}, result...)
	}

	// Handle leading zeros
	for _, b := range full {
		if b != 0 {
			break
		}
		result = append([]byte{base58Alphabet[0]}, result...)
	}

	return string(result)
}

// Base58CheckDecode decodes base58check format to bytes
func Base58CheckDecode(input string) ([]byte, error) {
	// Decode base58
	intVal := big.NewInt(0)
	base := big.NewInt(58)

	for _, char := range input {
		index := strings.IndexRune(base58Alphabet, char)
		if index == -1 {
			return nil, fmt.Errorf("invalid base58 character: %c", char)
		}
		intVal.Mul(intVal, base)
		intVal.Add(intVal, big.NewInt(int64(index)))
	}

	// Convert to bytes
	decoded := intVal.Bytes()

	// Handle leading zeros
	for _, char := range input {
		if char != rune(base58Alphabet[0]) {
			break
		}
		decoded = append([]byte{0}, decoded...)
	}

	// Verify checksum
	if len(decoded) < 4 {
		return nil, fmt.Errorf("decoded data too short")
	}

	payload := decoded[:len(decoded)-4]
	checksum := decoded[len(decoded)-4:]

	hash1 := sha256.Sum256(payload)
	hash2 := sha256.Sum256(hash1[:])
	expectedChecksum := hash2[:4]

	if !bytes.Equal(checksum, expectedChecksum) {
		return nil, fmt.Errorf("checksum mismatch")
	}

	return payload, nil
}

// ValidateTronAddress validates a TRON address format
func ValidateTronAddress(address string) bool {
	if len(address) != 34 || !strings.HasPrefix(address, "T") {
		return false
	}

	_, err := Base58CheckDecode(address)
	return err == nil
}

// resolveEndpoint converts endpoint shortcuts to full URLs
func resolveEndpoint(endpoint string) string {
	switch endpoint {
	case "mainnet", "":
		return "https://api.trongrid.io"
	case "nile":
		return "https://nile.trongrid.io"
	case "shasta":
		return "https://api.shasta.trongrid.io"
	default:
		return endpoint
	}
}

// GetAPI returns the API endpoint for advanced operations.
func (s *ClientSigner) GetAPI() string {
	return s.endpoint
}

// GetPrivateKey returns the underlying private key.
// Warning: Handle with care, do not expose.
func (s *ClientSigner) GetPrivateKey() *ecdsa.PrivateKey {
	return s.privateKey
}

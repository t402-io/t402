// Package tezos provides a Tezos signer implementation using Ed25519 for t402 payments.
//
// This package enables FA2 token transfers for the t402 payment protocol.
// Tezos uses Ed25519 for tz1 addresses with Blake2b hashing and Base58Check encoding.
package tezos

import (
	"bytes"
	"context"
	"crypto/ed25519"
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

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
	"golang.org/x/crypto/blake2b"
)

// Base58 alphabet for Tezos
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// Tezos-specific prefixes for Base58Check encoding
var (
	// Address prefixes
	tz1Prefix = []byte{6, 161, 159}    // tz1 (Ed25519)
	tz2Prefix = []byte{6, 161, 161}    // tz2 (secp256k1)
	tz3Prefix = []byte{6, 161, 164}    // tz3 (P-256)
	kt1Prefix = []byte{2, 90, 121}     // KT1 (contract)

	// Key prefixes
	edpkPrefix = []byte{13, 15, 37, 217}   // edpk (Ed25519 public key)
	edskPrefix = []byte{43, 246, 78, 7}    // edsk (Ed25519 secret key)
	edsigPrefix = []byte{9, 245, 205, 134, 18} // edsig (Ed25519 signature)

	// Operation prefixes
	opPrefix = []byte{5, 116}  // operation hash prefix

	// Generic signature prefix for operations
	genericWatermark = byte(0x03) // Generic operation watermark
)

// ClientSigner implements the Tezos client signer interface using an Ed25519 private key.
type ClientSigner struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	address    string
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// Placeholder for future configuration options
}

// NewClientSignerFromPrivateKey creates a client signer from a Base58Check-encoded Ed25519 private key.
//
// Args:
//
//	privateKeyBase58: Base58Check-encoded Ed25519 private key (edsk...)
//	config: Optional configuration
//
// Returns:
//
//	ClientSigner implementation
//	Error if private key is invalid
func NewClientSignerFromPrivateKey(privateKeyBase58 string, config *Config) (*ClientSigner, error) {
	// Decode Base58Check
	decoded, err := base58CheckDecode(privateKeyBase58)
	if err != nil {
		return nil, fmt.Errorf("invalid private key encoding: %w", err)
	}

	// Check prefix
	if len(decoded) < 4 || !bytes.HasPrefix(decoded, edskPrefix) {
		return nil, fmt.Errorf("invalid private key prefix: expected edsk")
	}

	// Extract seed (32 bytes after prefix)
	seedBytes := decoded[len(edskPrefix):]
	if len(seedBytes) != 32 && len(seedBytes) != 64 {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(seedBytes))
	}

	// Use first 32 bytes as seed
	if len(seedBytes) > 32 {
		seedBytes = seedBytes[:32]
	}

	privateKey := ed25519.NewKeyFromSeed(seedBytes)
	return newClientSignerFromKey(privateKey)
}

// NewClientSignerFromSeed creates a client signer from a hex-encoded 32-byte seed.
//
// Args:
//
//	seedHex: Hex-encoded 32-byte seed (with or without "0x" prefix)
//	config: Optional configuration
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
	return newClientSignerFromKey(privateKey)
}

// newClientSignerFromKey creates a client signer from an Ed25519 private key
func newClientSignerFromKey(privateKey ed25519.PrivateKey) (*ClientSigner, error) {
	// Extract public key
	publicKey := privateKey.Public().(ed25519.PublicKey)

	// Derive address from public key
	// tz1 address = Base58Check(tz1Prefix + Blake2b(publicKey, 20))
	hash, err := blake2b.New(20, nil)
	if err != nil {
		return nil, err
	}
	hash.Write(publicKey)
	pkHash := hash.Sum(nil)

	address := base58CheckEncode(tz1Prefix, pkHash)

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		address:    address,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Address returns the signer's Tezos address (tz1).
func (s *ClientSigner) Address() string {
	return s.address
}

// PublicKeyBase58 returns the public key in Tezos Base58Check format (edpk).
func (s *ClientSigner) PublicKeyBase58() string {
	return base58CheckEncode(edpkPrefix, s.publicKey)
}

// GetBalance retrieves the FA2 token balance for the signer's address.
func (s *ClientSigner) GetBalance(ctx context.Context, contractAddress string, tokenID int) (string, error) {
	// Use TzKT API to get balance
	url := fmt.Sprintf("%s/v1/tokens/balances?account=%s&token.contract=%s&token.tokenId=%d",
		tezos.TezosMainnetIndexer, s.address, contractAddress, tokenID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var balances []struct {
		Balance string `json:"balance"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&balances); err != nil {
		return "", err
	}

	if len(balances) == 0 {
		return "0", nil
	}

	return balances[0].Balance, nil
}

// Transfer executes an FA2 transfer operation on-chain.
func (s *ClientSigner) Transfer(
	ctx context.Context,
	contractAddress string,
	tokenID int,
	to string,
	amount *big.Int,
	network t402.Network,
) (string, error) {
	// Get network config
	config, ok := tezos.GetNetworkConfig(string(network))
	if !ok {
		return "", fmt.Errorf("unsupported network: %s", network)
	}

	// Get the current counter (nonce) for the account
	counter, err := s.getCounter(ctx, config.RpcURL)
	if err != nil {
		return "", fmt.Errorf("failed to get counter: %w", err)
	}

	// Get the head block hash
	headHash, err := s.getHeadHash(ctx, config.RpcURL)
	if err != nil {
		return "", fmt.Errorf("failed to get head hash: %w", err)
	}

	// Build the FA2 transfer parameters
	params := buildFA2TransferParams(s.address, to, tokenID, amount.String())

	// Build the operation
	operation := map[string]interface{}{
		"kind":         "transaction",
		"source":       s.address,
		"fee":          "100000",  // 0.1 XTZ in mutez
		"counter":      fmt.Sprintf("%d", counter+1),
		"gas_limit":    "100000",
		"storage_limit": "10000",
		"amount":       "0",
		"destination":  contractAddress,
		"parameters": map[string]interface{}{
			"entrypoint": "transfer",
			"value":      params,
		},
	}

	// Forge the operation
	forgedOp, err := s.forgeOperation(ctx, config.RpcURL, headHash, []map[string]interface{}{operation})
	if err != nil {
		return "", fmt.Errorf("failed to forge operation: %w", err)
	}

	// Sign the operation
	signature, err := s.signOperation(forgedOp)
	if err != nil {
		return "", fmt.Errorf("failed to sign operation: %w", err)
	}

	// Inject the operation
	opHash, err := s.injectOperation(ctx, config.RpcURL, forgedOp, signature)
	if err != nil {
		return "", fmt.Errorf("failed to inject operation: %w", err)
	}

	return opHash, nil
}

// getCounter gets the current counter for the account
func (s *ClientSigner) getCounter(ctx context.Context, rpcURL string) (int64, error) {
	url := fmt.Sprintf("%s/chains/main/blocks/head/context/contracts/%s/counter", rpcURL, s.address)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("API error: %s", string(body))
	}

	var counter string
	if err := json.Unmarshal(body, &counter); err != nil {
		return 0, err
	}

	var result int64
	fmt.Sscanf(counter, "%d", &result)
	return result, nil
}

// getHeadHash gets the current head block hash
func (s *ClientSigner) getHeadHash(ctx context.Context, rpcURL string) (string, error) {
	url := fmt.Sprintf("%s/chains/main/blocks/head/hash", rpcURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error: %s", string(body))
	}

	var hash string
	if err := json.Unmarshal(body, &hash); err != nil {
		return "", err
	}

	return hash, nil
}

// forgeOperation forges an operation using the RPC
func (s *ClientSigner) forgeOperation(ctx context.Context, rpcURL, branch string, operations []map[string]interface{}) ([]byte, error) {
	reqBody := map[string]interface{}{
		"branch":   branch,
		"contents": operations,
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/chains/main/blocks/head/helpers/forge/operations", rpcURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("API error: %s", string(body))
	}

	var forgedHex string
	if err := json.Unmarshal(body, &forgedHex); err != nil {
		return nil, err
	}

	return hex.DecodeString(forgedHex)
}

// signOperation signs a forged operation
func (s *ClientSigner) signOperation(forgedOp []byte) ([]byte, error) {
	// Prepend generic watermark
	message := append([]byte{genericWatermark}, forgedOp...)

	// Hash with Blake2b-256
	hash := blake2b.Sum256(message)

	// Sign with Ed25519
	signature := ed25519.Sign(s.privateKey, hash[:])

	return signature, nil
}

// injectOperation injects a signed operation
func (s *ClientSigner) injectOperation(ctx context.Context, rpcURL string, forgedOp, signature []byte) (string, error) {
	// Combine forged operation with signature
	signedOp := append(forgedOp, signature...)

	// Encode as hex string
	signedOpHex := hex.EncodeToString(signedOp)

	reqBytes, err := json.Marshal(signedOpHex)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/injection/operation", rpcURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error: %s", string(body))
	}

	var opHash string
	if err := json.Unmarshal(body, &opHash); err != nil {
		return "", err
	}

	return opHash, nil
}

// buildFA2TransferParams builds the Micheline parameters for an FA2 transfer
func buildFA2TransferParams(from, to string, tokenID int, amount string) interface{} {
	// FA2 transfer format: list of { from_; txs: list of { to_; token_id; amount } }
	return []interface{}{
		map[string]interface{}{
			"prim": "Pair",
			"args": []interface{}{
				map[string]interface{}{
					"string": from,
				},
				[]interface{}{
					map[string]interface{}{
						"prim": "Pair",
						"args": []interface{}{
							map[string]interface{}{
								"string": to,
							},
							map[string]interface{}{
								"prim": "Pair",
								"args": []interface{}{
									map[string]interface{}{
										"int": fmt.Sprintf("%d", tokenID),
									},
									map[string]interface{}{
										"int": amount,
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// base58CheckEncode encodes data with prefix using Base58Check
func base58CheckEncode(prefix, data []byte) string {
	payload := append(prefix, data...)

	// Double SHA256 checksum
	hash1 := sha256.Sum256(payload)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum
	full := append(payload, checksum...)

	return base58Encode(full)
}

// base58CheckDecode decodes a Base58Check encoded string
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
	// Convert to big integer
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

	// Convert to bytes
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

// writeVarInt writes a variable-length integer (used in Micheline encoding)
func writeVarInt(buf *bytes.Buffer, n uint64) {
	for n >= 0x80 {
		buf.WriteByte(byte(n&0x7F) | 0x80)
		n >>= 7
	}
	buf.WriteByte(byte(n))
}

// writeString writes a Micheline string
func writeString(buf *bytes.Buffer, s string) {
	binary.Write(buf, binary.BigEndian, uint32(len(s)))
	buf.WriteString(s)
}

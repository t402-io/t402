// Package ton provides a TON signer implementation using Ed25519 for t402 payments.
//
// This package enables TON Jetton transfers for the t402 payment protocol.
// It supports WalletV4R2 (the standard TON wallet version) and builds
// external messages for Jetton (TEP-74) transfers.
package ton

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/xssnick/tonutils-go/address"
	"github.com/xssnick/tonutils-go/liteclient"
	"github.com/xssnick/tonutils-go/tlb"
	"github.com/xssnick/tonutils-go/ton"
	"github.com/xssnick/tonutils-go/ton/wallet"
	"github.com/xssnick/tonutils-go/tvm/cell"

	t402ton "github.com/t402-io/t402/sdks/go/mechanisms/ton"
)

// JettonTransferOp is the TEP-74 opcode for Jetton transfers
const JettonTransferOp = 0x0f8a7ea5

// DefaultGasAmount is the default TON amount for Jetton transfer gas (0.1 TON)
const DefaultGasAmount = 100_000_000

// DefaultForwardAmount is the default forward amount for notifications (1 nanoTON)
const DefaultForwardAmount = 1

// DefaultTimeout is the default message validity duration
const DefaultTimeout = 300 // 5 minutes

// ClientSigner implements t402ton.ClientTonSigner using an Ed25519 private key.
// This provides client-side message signing for creating TON payment payloads.
type ClientSigner struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	wallet     *wallet.Wallet
	api        ton.APIClientWrapped
	workchain  int8
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// Endpoint is the TON RPC endpoint URL or "mainnet"/"testnet" for default endpoints
	Endpoint string
	// Workchain is the TON workchain (0 for basechain, -1 for masterchain)
	Workchain int8
}

// NewClientSignerFromPrivateKey creates a client signer from a hex-encoded Ed25519 private key.
//
// Args:
//
//	privateKeyHex: Hex-encoded Ed25519 private key (64 bytes, with or without "0x" prefix)
//	config: Optional configuration (use nil for mainnet defaults)
//
// Returns:
//
//	ClientTonSigner implementation ready for use with ton.NewExactTonClient()
//	Error if private key is invalid or network connection fails
//
// Example:
//
//	signer, err := ton.NewClientSignerFromPrivateKey("1234...", nil)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	client := t402.NewT402Client().
//	    Register("ton:*", ton.NewExactTonClient(signer))
func NewClientSignerFromPrivateKey(privateKeyHex string, config *Config) (t402ton.ClientTonSigner, error) {
	// Strip 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Decode hex string to bytes
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex private key: %w", err)
	}

	// Ed25519 private key should be 64 bytes (seed + public key) or 32 bytes (seed only)
	if len(privateKeyBytes) == 32 {
		// Seed only - derive full key
		privateKeyBytes = ed25519.NewKeyFromSeed(privateKeyBytes)
	} else if len(privateKeyBytes) != 64 {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	return newClientSignerFromKey(ed25519.PrivateKey(privateKeyBytes), config)
}

// NewClientSignerFromMnemonic creates a client signer from a BIP39 mnemonic phrase.
//
// Args:
//
//	mnemonic: 24-word mnemonic phrase (space-separated)
//	config: Optional configuration (use nil for mainnet defaults)
//
// Returns:
//
//	ClientTonSigner implementation
//	Error if mnemonic is invalid
//
// Example:
//
//	signer, err := ton.NewClientSignerFromMnemonic("word1 word2 ... word24", nil)
func NewClientSignerFromMnemonic(mnemonic string, config *Config) (t402ton.ClientTonSigner, error) {
	words := strings.Fields(mnemonic)
	if len(words) != 24 {
		return nil, fmt.Errorf("invalid mnemonic: expected 24 words, got %d", len(words))
	}

	// Derive Ed25519 key from mnemonic using TON's key derivation
	privateKey, err := wallet.SeedToPrivateKeyWithOptions(words)
	if err != nil {
		return nil, fmt.Errorf("failed to derive key from mnemonic: %w", err)
	}

	return newClientSignerFromKey(privateKey, config)
}

// newClientSignerFromKey creates a client signer from an Ed25519 private key
func newClientSignerFromKey(privateKey ed25519.PrivateKey, config *Config) (*ClientSigner, error) {
	if config == nil {
		config = &Config{
			Endpoint:  "mainnet",
			Workchain: 0,
		}
	}

	// Extract public key
	publicKey := privateKey.Public().(ed25519.PublicKey)

	// Create API client
	client := liteclient.NewConnectionPool()

	// Select endpoint
	var cfgURL string
	switch config.Endpoint {
	case "mainnet", "":
		cfgURL = "https://ton.org/global.config.json"
	case "testnet":
		cfgURL = "https://ton.org/testnet-global.config.json"
	default:
		cfgURL = config.Endpoint
	}

	// Connect to network
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.AddConnectionsFromConfigUrl(ctx, cfgURL); err != nil {
		return nil, fmt.Errorf("failed to connect to TON network: %w", err)
	}

	api := ton.NewAPIClient(client, ton.ProofCheckPolicyFast).WithRetry()

	// Create wallet instance (WalletV4R2)
	w, err := wallet.FromPrivateKey(api, privateKey, wallet.V4R2)
	if err != nil {
		return nil, fmt.Errorf("failed to create wallet: %w", err)
	}

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		wallet:     w,
		api:        api,
		workchain:  config.Workchain,
	}, nil
}

// Address returns the signer's TON address in friendly format (bounceable).
func (s *ClientSigner) Address() string {
	return s.wallet.WalletAddress().String()
}

// GetSeqno returns the current wallet sequence number from the blockchain.
// This is used for replay protection in transactions.
func (s *ClientSigner) GetSeqno(ctx context.Context) (int64, error) {
	block, err := s.api.CurrentMasterchainInfo(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to get masterchain info: %w", err)
	}

	// Get account state to check if deployed
	account, err := s.api.WaitForBlock(block.SeqNo).GetAccount(ctx, block, s.wallet.WalletAddress())
	if err != nil {
		return 0, fmt.Errorf("failed to get account: %w", err)
	}

	// If not active, seqno is 0
	if !account.IsActive {
		return 0, nil
	}

	// Run get_seqno method on the wallet
	result, err := s.api.WaitForBlock(block.SeqNo).RunGetMethod(ctx, block, s.wallet.WalletAddress(), "seqno")
	if err != nil {
		// If method fails, try to infer seqno is 0
		if strings.Contains(err.Error(), "not deployed") || strings.Contains(err.Error(), "exit code") {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to get seqno: %w", err)
	}

	seqno, err := result.Int(0)
	if err != nil {
		return 0, fmt.Errorf("failed to parse seqno: %w", err)
	}

	return seqno.Int64(), nil
}

// SignMessage signs a Jetton transfer message and returns the base64-encoded BOC.
//
// Args:
//
//	ctx: Context for cancellation and timeout control
//	params: Message parameters including destination, value, and body
//
// Returns:
//
//	Base64-encoded signed external message (BOC format)
//	Error if signing fails
func (s *ClientSigner) SignMessage(ctx context.Context, params t402ton.SignMessageParams) (string, error) {
	// Parse destination address
	destAddr, err := address.ParseAddr(params.To)
	if err != nil {
		return "", fmt.Errorf("invalid destination address: %w", err)
	}

	// Parse body from base64 BOC
	bodyBytes, err := base64.StdEncoding.DecodeString(params.Body)
	if err != nil {
		return "", fmt.Errorf("invalid body encoding: %w", err)
	}

	bodyCell, err := cell.FromBOC(bodyBytes)
	if err != nil {
		return "", fmt.Errorf("invalid body BOC: %w", err)
	}

	// Convert value from nanoTON to Coins
	amount := tlb.FromNanoTONU(params.Value)

	// Create internal message
	internalMsg := &wallet.Message{
		Mode: wallet.PayGasSeparately,
		InternalMessage: &tlb.InternalMessage{
			IHRDisabled: true,
			Bounce:      true,
			DstAddr:     destAddr,
			Amount:      amount,
			Body:        bodyCell,
		},
	}

	// Build and sign external message
	extMsg, err := s.wallet.BuildExternalMessageForMany(ctx, []*wallet.Message{internalMsg})
	if err != nil {
		return "", fmt.Errorf("failed to build external message: %w", err)
	}

	// Convert external message to Cell
	extCell, err := tlb.ToCell(extMsg)
	if err != nil {
		return "", fmt.Errorf("failed to serialize external message: %w", err)
	}

	// Encode to BOC
	bocBytes := extCell.ToBOC()
	return base64.StdEncoding.EncodeToString(bocBytes), nil
}

// BuildJettonTransferBody builds a TEP-74 Jetton transfer message body.
//
// Args:
//
//	queryId: Unique identifier for the transfer
//	amount: Jetton amount in smallest units
//	destination: Recipient address for the Jettons
//	responseDestination: Address to receive excess TON
//	forwardAmount: TON amount to forward with notification (typically 1 nanoTON)
//
// Returns:
//
//	Base64-encoded message body BOC
func BuildJettonTransferBody(
	queryId *big.Int,
	amount *big.Int,
	destination string,
	responseDestination string,
	forwardAmount uint64,
) (string, error) {
	// Parse addresses
	destAddr, err := address.ParseAddr(destination)
	if err != nil {
		return "", fmt.Errorf("invalid destination address: %w", err)
	}

	respAddr, err := address.ParseAddr(responseDestination)
	if err != nil {
		return "", fmt.Errorf("invalid response destination address: %w", err)
	}

	// Build the Jetton transfer cell (TEP-74)
	body := cell.BeginCell().
		MustStoreUInt(JettonTransferOp, 32).         // op: transfer
		MustStoreBigUInt(queryId, 64).               // query_id
		MustStoreBigCoins(amount).                   // amount
		MustStoreAddr(destAddr).                     // destination
		MustStoreAddr(respAddr).                     // response_destination
		MustStoreBoolBit(false).                     // no custom payload
		MustStoreCoins(forwardAmount).               // forward_ton_amount
		MustStoreBoolBit(false).                     // no forward payload
		EndCell()

	// Encode to BOC
	bocBytes := body.ToBOC()
	return base64.StdEncoding.EncodeToString(bocBytes), nil
}

// GenerateQueryId generates a unique query ID for Jetton transfers.
// Uses timestamp + random component for uniqueness.
func GenerateQueryId() *big.Int {
	timestamp := time.Now().UnixMilli()
	random := time.Now().UnixNano() % 1000000

	// queryId = timestamp * 1000000 + random
	result := new(big.Int).SetInt64(timestamp)
	result.Mul(result, big.NewInt(1000000))
	result.Add(result, big.NewInt(random))

	return result
}

// GetJettonWalletAddress derives the Jetton wallet address for an owner.
// This queries the Jetton master contract to get the associated wallet.
func (s *ClientSigner) GetJettonWalletAddress(ctx context.Context, ownerAddress string, jettonMasterAddress string) (string, error) {
	// Parse addresses
	owner, err := address.ParseAddr(ownerAddress)
	if err != nil {
		return "", fmt.Errorf("invalid owner address: %w", err)
	}

	master, err := address.ParseAddr(jettonMasterAddress)
	if err != nil {
		return "", fmt.Errorf("invalid jetton master address: %w", err)
	}

	// Get current block
	block, err := s.api.CurrentMasterchainInfo(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get masterchain info: %w", err)
	}

	// Build the slice parameter for get_wallet_address
	ownerSlice := cell.BeginCell().MustStoreAddr(owner).EndCell().BeginParse()

	// Call get_wallet_address on Jetton master
	result, err := s.api.WaitForBlock(block.SeqNo).RunGetMethod(ctx, block, master, "get_wallet_address", ownerSlice)
	if err != nil {
		return "", fmt.Errorf("failed to call get_wallet_address: %w", err)
	}

	// Parse result - the result is a slice containing the address
	walletSlice, err := result.Slice(0)
	if err != nil {
		return "", fmt.Errorf("failed to get result slice: %w", err)
	}

	walletAddr, err := walletSlice.LoadAddr()
	if err != nil {
		return "", fmt.Errorf("failed to parse wallet address: %w", err)
	}

	return walletAddr.String(), nil
}

// GetAPI returns the underlying TON API client for advanced operations.
func (s *ClientSigner) GetAPI() ton.APIClientWrapped {
	return s.api
}

// GetWallet returns the underlying wallet instance for advanced operations.
func (s *ClientSigner) GetWallet() *wallet.Wallet {
	return s.wallet
}

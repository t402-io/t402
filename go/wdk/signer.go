package wdk

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	hdwallet "github.com/miguelmota/go-ethereum-hdwallet"
	"github.com/tyler-smith/go-bip39"
)

// DefaultDerivationPath is the standard Ethereum HD wallet derivation path.
const DefaultDerivationPath = "m/44'/60'/0'/0/0"

// Signer provides wallet functionality for T402 payments.
type Signer struct {
	seedPhrase   string
	accountIndex int
	timeout      int
	initialized  bool

	// EVM wallet
	wallet     *hdwallet.Wallet
	account    accounts.Account
	privateKey *ecdsa.PrivateKey
	address    common.Address

	// Chain configurations
	chains map[string]ChainConfig

	// Ethereum clients per chain
	clients map[string]*ethclient.Client
}

// NewSigner creates a new WDK signer.
//
// Parameters:
//   - seedPhrase: BIP-39 mnemonic seed phrase (12, 15, 18, 21, or 24 words)
//   - chains: Map of chain names to RPC URLs (optional)
//   - accountIndex: HD wallet account index (default: 0)
//
// Returns an uninitialized signer. Call Initialize() before using signing operations.
func NewSigner(seedPhrase string, chains map[string]string, accountIndex int) (*Signer, error) {
	if seedPhrase == "" {
		return nil, InitializationError("seed phrase is required", ErrInvalidSeedPhrase)
	}

	if !ValidateSeedPhrase(seedPhrase) {
		return nil, InitializationError("invalid seed phrase: expected 12, 15, 18, 21, or 24 words", ErrInvalidSeedPhrase)
	}

	s := &Signer{
		seedPhrase:   seedPhrase,
		accountIndex: accountIndex,
		timeout:      30,
		chains:       make(map[string]ChainConfig),
		clients:      make(map[string]*ethclient.Client),
	}

	// Configure chains
	if chains != nil {
		for chainName, rpcURL := range chains {
			if baseConfig, ok := GetChainConfig(chainName); ok {
				s.chains[chainName] = ChainConfig{
					ChainID:     baseConfig.ChainID,
					Network:     baseConfig.Network,
					Name:        chainName,
					RPCURL:      rpcURL,
					NetworkType: baseConfig.NetworkType,
				}
			} else {
				// Allow custom chains
				s.chains[chainName] = ChainConfig{
					ChainID:     1,
					Network:     "eip155:1",
					Name:        chainName,
					RPCURL:      rpcURL,
					NetworkType: NetworkTypeEVM,
				}
			}
		}
	}

	// Add default chain if none configured
	if len(s.chains) == 0 {
		if defaultConfig, ok := GetChainConfig("arbitrum"); ok {
			s.chains["arbitrum"] = defaultConfig
		}
	}

	return s, nil
}

// Initialize derives accounts from the seed phrase.
// Must be called before using signing operations.
func (s *Signer) Initialize(ctx context.Context) error {
	if s.initialized {
		return nil
	}

	// Create HD wallet from seed phrase
	wallet, err := hdwallet.NewFromMnemonic(s.seedPhrase)
	if err != nil {
		return InitializationError(fmt.Sprintf("failed to create wallet: %v", err), err)
	}
	s.wallet = wallet

	// Derive account from path
	path := hdwallet.MustParseDerivationPath(fmt.Sprintf("m/44'/60'/0'/0/%d", s.accountIndex))
	account, err := wallet.Derive(path, true)
	if err != nil {
		return InitializationError(fmt.Sprintf("failed to derive account: %v", err), err)
	}
	s.account = account
	s.address = account.Address

	// Get private key
	privateKey, err := wallet.PrivateKey(account)
	if err != nil {
		return InitializationError(fmt.Sprintf("failed to get private key: %v", err), err)
	}
	s.privateKey = privateKey

	s.initialized = true
	return nil
}

// IsInitialized returns whether the signer is initialized.
func (s *Signer) IsInitialized() bool {
	return s.initialized
}

// GetAddress returns the wallet address for a network type.
func (s *Signer) GetAddress(networkType NetworkType) (string, error) {
	if !s.initialized {
		return "", SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	switch networkType {
	case NetworkTypeEVM:
		return s.address.Hex(), nil
	case NetworkTypeSolana, NetworkTypeTON, NetworkTypeTRON:
		// Future: add support for other network types
		return "", fmt.Errorf("network type %s not yet supported", networkType)
	default:
		return "", fmt.Errorf("unknown network type: %s", networkType)
	}
}

// GetEVMAddress returns the EVM address.
func (s *Signer) GetEVMAddress() (common.Address, error) {
	if !s.initialized {
		return common.Address{}, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}
	return s.address, nil
}

// GetConfiguredChains returns the list of configured chain names.
func (s *Signer) GetConfiguredChains() []string {
	chains := make([]string, 0, len(s.chains))
	for chain := range s.chains {
		chains = append(chains, chain)
	}
	return chains
}

// IsChainConfigured checks if a chain is configured.
func (s *Signer) IsChainConfigured(chain string) bool {
	_, ok := s.chains[chain]
	return ok
}

// GetChainConfig returns the configuration for a chain.
func (s *Signer) GetChainConfig(chain string) (ChainConfig, bool) {
	config, ok := s.chains[chain]
	return config, ok
}

// SignTypedData signs EIP-712 typed data.
// This is the primary signing method used for T402 EIP-3009 payments.
func (s *Signer) SignTypedData(typedData apitypes.TypedData) ([]byte, error) {
	if !s.initialized {
		return nil, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	// Hash the typed data
	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return nil, SigningError(ErrorCodeSignTypedDataFailed, fmt.Sprintf("failed to hash domain: %v", err), "", err)
	}

	typedDataHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return nil, SigningError(ErrorCodeSignTypedDataFailed, fmt.Sprintf("failed to hash message: %v", err), "", err)
	}

	// Create the EIP-712 hash
	rawData := []byte(fmt.Sprintf("\x19\x01%s%s", string(domainSeparator), string(typedDataHash)))
	hash := crypto.Keccak256Hash(rawData)

	// Sign the hash
	signature, err := crypto.Sign(hash.Bytes(), s.privateKey)
	if err != nil {
		return nil, SigningError(ErrorCodeSignTypedDataFailed, fmt.Sprintf("failed to sign: %v", err), "", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if signature[64] < 27 {
		signature[64] += 27
	}

	return signature, nil
}

// SignMessage signs a personal message.
func (s *Signer) SignMessage(message []byte) ([]byte, error) {
	if !s.initialized {
		return nil, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	// Create Ethereum signed message hash
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(message))
	hash := crypto.Keccak256Hash([]byte(prefix), message)

	// Sign the hash
	signature, err := crypto.Sign(hash.Bytes(), s.privateKey)
	if err != nil {
		return nil, SigningError(ErrorCodeSignMessageFailed, fmt.Sprintf("failed to sign message: %v", err), "", err)
	}

	// Adjust V value for Ethereum compatibility (27 or 28)
	if signature[64] < 27 {
		signature[64] += 27
	}

	return signature, nil
}

// getClient returns an Ethereum client for a chain.
func (s *Signer) getClient(ctx context.Context, chain string) (*ethclient.Client, error) {
	// Check if client already exists
	if client, ok := s.clients[chain]; ok {
		return client, nil
	}

	// Get chain config
	config, ok := s.chains[chain]
	if !ok {
		return nil, ChainError(ErrorCodeChainNotConfigured, fmt.Sprintf("chain '%s' not configured", chain), chain)
	}

	// Create client
	client, err := ethclient.DialContext(ctx, config.RPCURL)
	if err != nil {
		return nil, BalanceError(ErrorCodeBalanceFetchFailed, fmt.Sprintf("failed to connect to %s: %v", chain, err), chain, "", err)
	}

	s.clients[chain] = client
	return client, nil
}

// GetNativeBalance returns the native token balance for a chain.
func (s *Signer) GetNativeBalance(ctx context.Context, chain string) (*big.Int, error) {
	if !s.initialized {
		return nil, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	client, err := s.getClient(ctx, chain)
	if err != nil {
		return nil, err
	}

	balance, err := client.BalanceAt(ctx, s.address, nil)
	if err != nil {
		return nil, BalanceError(ErrorCodeBalanceFetchFailed, fmt.Sprintf("failed to get balance: %v", err), chain, "", err)
	}

	return balance, nil
}

// GetTokenBalance returns the ERC20 token balance for a chain.
func (s *Signer) GetTokenBalance(ctx context.Context, chain, tokenAddress string) (*big.Int, error) {
	if !s.initialized {
		return nil, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	if !strings.HasPrefix(tokenAddress, "0x") {
		return nil, BalanceError(ErrorCodeInvalidTokenAddress, fmt.Sprintf("invalid token address: %s", tokenAddress), chain, tokenAddress, nil)
	}

	client, err := s.getClient(ctx, chain)
	if err != nil {
		return nil, err
	}

	// Call balanceOf on the token contract
	tokenAddr := common.HexToAddress(tokenAddress)
	ownerAddr := s.address

	// Encode the balanceOf call
	data := crypto.Keccak256([]byte("balanceOf(address)"))[:4]
	data = append(data, common.LeftPadBytes(ownerAddr.Bytes(), 32)...)

	msg := ethereum.CallMsg{
		To:   &tokenAddr,
		Data: data,
	}

	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, BalanceError(ErrorCodeTokenBalanceFetchFailed, fmt.Sprintf("failed to get token balance: %v", err), chain, tokenAddress, err)
	}

	if len(result) == 0 {
		return big.NewInt(0), nil
	}

	return new(big.Int).SetBytes(result), nil
}

// GetUSDT0Balance returns the USDT0 balance for a chain.
func (s *Signer) GetUSDT0Balance(ctx context.Context, chain string) (*big.Int, error) {
	usdt0Addr, ok := USDT0Addresses[chain]
	if !ok {
		return big.NewInt(0), nil
	}
	return s.GetTokenBalance(ctx, chain, usdt0Addr)
}

// GetUSDCBalance returns the USDC balance for a chain.
func (s *Signer) GetUSDCBalance(ctx context.Context, chain string) (*big.Int, error) {
	usdcAddr, ok := USDCAddresses[chain]
	if !ok {
		return big.NewInt(0), nil
	}
	return s.GetTokenBalance(ctx, chain, usdcAddr)
}

// GetAllBalances returns USDT0/USDC balances for all configured chains.
func (s *Signer) GetAllBalances(ctx context.Context) (map[string]*big.Int, error) {
	if !s.initialized {
		return nil, SignerError(ErrorCodeSignerNotInitialized, "signer not initialized")
	}

	balances := make(map[string]*big.Int)

	for chainName, config := range s.chains {
		// Try USDT0 first, then USDC
		usdt0Balance, err := s.GetUSDT0Balance(ctx, chainName)
		if err == nil && usdt0Balance.Cmp(big.NewInt(0)) > 0 {
			balances[config.Network] = usdt0Balance
		} else {
			usdcBalance, err := s.GetUSDCBalance(ctx, chainName)
			if err == nil {
				balances[config.Network] = usdcBalance
			} else {
				balances[config.Network] = big.NewInt(0)
			}
		}
	}

	return balances, nil
}

// Close closes all client connections.
func (s *Signer) Close() {
	for _, client := range s.clients {
		client.Close()
	}
	s.clients = make(map[string]*ethclient.Client)
}

// GenerateSeedPhrase generates a new BIP-39 mnemonic seed phrase.
func GenerateSeedPhrase(numWords int) (string, error) {
	var bitSize int
	switch numWords {
	case 12:
		bitSize = 128
	case 15:
		bitSize = 160
	case 18:
		bitSize = 192
	case 21:
		bitSize = 224
	case 24:
		bitSize = 256
	default:
		bitSize = 128 // Default to 12 words
	}

	entropy, err := bip39.NewEntropy(bitSize)
	if err != nil {
		return "", fmt.Errorf("failed to generate entropy: %w", err)
	}

	mnemonic, err := bip39.NewMnemonic(entropy)
	if err != nil {
		return "", fmt.Errorf("failed to generate mnemonic: %w", err)
	}

	return mnemonic, nil
}

// ValidateSeedPhrase validates a BIP-39 seed phrase.
func ValidateSeedPhrase(seedPhrase string) bool {
	words := strings.Fields(strings.TrimSpace(seedPhrase))
	wordCount := len(words)

	// Valid word counts: 12, 15, 18, 21, 24
	validCounts := map[int]bool{12: true, 15: true, 18: true, 21: true, 24: true}
	if !validCounts[wordCount] {
		return false
	}

	// Validate using bip39 library
	return bip39.IsMnemonicValid(seedPhrase)
}

// FormatTokenAmount formats a token amount for display.
func FormatTokenAmount(amount *big.Int, decimals int) string {
	if amount == nil || amount.Cmp(big.NewInt(0)) == 0 {
		return "0"
	}

	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Div(amount, divisor)
	fraction := new(big.Int).Mod(amount, divisor)

	if fraction.Cmp(big.NewInt(0)) == 0 {
		return whole.String()
	}

	// Format fraction and trim trailing zeros
	fractionStr := fraction.String()
	for len(fractionStr) < decimals {
		fractionStr = "0" + fractionStr
	}
	fractionStr = strings.TrimRight(fractionStr, "0")

	return fmt.Sprintf("%s.%s", whole.String(), fractionStr)
}


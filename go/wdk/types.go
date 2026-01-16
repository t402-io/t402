// Package wdk provides T402 WDK (Wallet Development Kit) support for Go.
//
// The WDK package enables wallet functionality for T402 payments using
// BIP-39 seed phrase derivation, multi-chain support, and EIP-712 signing.
package wdk

import "math/big"

// NetworkType represents the type of blockchain network.
type NetworkType string

const (
	// NetworkTypeEVM represents Ethereum Virtual Machine compatible networks.
	NetworkTypeEVM NetworkType = "evm"
	// NetworkTypeSolana represents the Solana network.
	NetworkTypeSolana NetworkType = "solana"
	// NetworkTypeTON represents The Open Network.
	NetworkTypeTON NetworkType = "ton"
	// NetworkTypeTRON represents the TRON network.
	NetworkTypeTRON NetworkType = "tron"
)

// ChainConfig contains configuration for a blockchain network.
type ChainConfig struct {
	// ChainID is the network's chain identifier.
	ChainID int64 `json:"chainId"`
	// Network is the CAIP-2 network identifier (e.g., "eip155:42161").
	Network string `json:"network"`
	// Name is the human-readable chain name.
	Name string `json:"name"`
	// RPCURL is the JSON-RPC endpoint URL.
	RPCURL string `json:"rpcUrl"`
	// NetworkType indicates the blockchain type (EVM, Solana, etc.).
	NetworkType NetworkType `json:"networkType"`
}

// TokenInfo contains metadata about a token.
type TokenInfo struct {
	// Address is the token contract address.
	Address string `json:"address"`
	// Symbol is the token symbol (e.g., "USDC").
	Symbol string `json:"symbol"`
	// Name is the full token name.
	Name string `json:"name"`
	// Decimals is the number of decimal places.
	Decimals int `json:"decimals"`
	// SupportsEIP3009 indicates if the token supports EIP-3009 transfers.
	SupportsEIP3009 bool `json:"supportsEip3009"`
}

// TokenBalance represents a token balance result.
type TokenBalance struct {
	// Token is the token contract address.
	Token string `json:"token"`
	// Symbol is the token symbol.
	Symbol string `json:"symbol"`
	// Balance is the raw balance in smallest units.
	Balance *big.Int `json:"balance"`
	// Formatted is the human-readable balance string.
	Formatted string `json:"formatted"`
	// Decimals is the token's decimal places.
	Decimals int `json:"decimals"`
}

// ChainBalance represents balances for a single chain.
type ChainBalance struct {
	// Chain is the chain name.
	Chain string `json:"chain"`
	// Network is the CAIP-2 network identifier.
	Network string `json:"network"`
	// Native is the native token balance in wei.
	Native *big.Int `json:"native"`
	// Tokens is the list of token balances.
	Tokens []TokenBalance `json:"tokens"`
}

// AggregatedBalance represents aggregated balances across all chains.
type AggregatedBalance struct {
	// TotalUSDT0 is the total USDT0 balance across all chains.
	TotalUSDT0 *big.Int `json:"totalUsdt0"`
	// TotalUSDC is the total USDC balance across all chains.
	TotalUSDC *big.Int `json:"totalUsdc"`
	// Chains is the per-chain balance breakdown.
	Chains []ChainBalance `json:"chains"`
}

// PaymentParams contains parameters for making a payment.
type PaymentParams struct {
	// Network is the CAIP-2 network identifier.
	Network string `json:"network"`
	// Asset is the token contract address.
	Asset string `json:"asset"`
	// To is the recipient address.
	To string `json:"to"`
	// Amount is the payment amount in smallest units.
	Amount *big.Int `json:"amount"`
}

// PaymentResult represents the result of a payment operation.
type PaymentResult struct {
	// Success indicates if the payment was successful.
	Success bool `json:"success"`
	// TxHash is the transaction hash if successful.
	TxHash string `json:"txHash,omitempty"`
	// Error contains the error message if failed.
	Error string `json:"error,omitempty"`
}

// SignedTypedData represents EIP-712 typed data structure.
type SignedTypedData struct {
	// Domain contains the EIP-712 domain data.
	Domain map[string]interface{} `json:"domain"`
	// Types contains the EIP-712 type definitions.
	Types map[string]interface{} `json:"types"`
	// PrimaryType is the primary type name.
	PrimaryType string `json:"primaryType"`
	// Message contains the data to sign.
	Message map[string]interface{} `json:"message"`
}

// TypedDataDomain represents EIP-712 domain structure.
type TypedDataDomain struct {
	// Name is the domain name.
	Name string `json:"name,omitempty"`
	// Version is the domain version.
	Version string `json:"version,omitempty"`
	// ChainID is the chain ID.
	ChainID int64 `json:"chainId,omitempty"`
	// VerifyingContract is the contract address.
	VerifyingContract string `json:"verifyingContract,omitempty"`
	// Salt is an optional salt value.
	Salt string `json:"salt,omitempty"`
}

// Config contains WDK configuration options.
type Config struct {
	// Chains maps chain names to RPC URLs.
	Chains map[string]string `json:"chains"`
	// CacheTTL is the balance cache TTL in seconds.
	CacheTTL int `json:"cacheTtl"`
	// Timeout is the operation timeout in seconds.
	Timeout int `json:"timeout"`
}

// BridgeParams contains parameters for bridging tokens.
type BridgeParams struct {
	// FromChain is the source chain name.
	FromChain string `json:"fromChain"`
	// ToChain is the destination chain name.
	ToChain string `json:"toChain"`
	// Amount is the amount to bridge in smallest units.
	Amount *big.Int `json:"amount"`
	// Recipient is the optional recipient address (defaults to sender).
	Recipient string `json:"recipient,omitempty"`
}

// BridgeResult represents the result of a bridge operation.
type BridgeResult struct {
	// TxHash is the source chain transaction hash.
	TxHash string `json:"txHash"`
	// EstimatedTime is the estimated completion time in seconds.
	EstimatedTime int `json:"estimatedTime"`
}

// DefaultConfig returns a default WDK configuration.
func DefaultConfig() *Config {
	return &Config{
		Chains:   make(map[string]string),
		CacheTTL: 60,
		Timeout:  30,
	}
}

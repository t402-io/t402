// Package gasless provides ERC-4337 gasless payment functionality for the WDK.
package gasless

import "math/big"

// Config holds the gasless client configuration.
type Config struct {
	// BundlerURL is the ERC-4337 bundler endpoint.
	BundlerURL string
	// PaymasterURL is the ERC-4337 paymaster endpoint (optional).
	PaymasterURL string
	// PrivateKey is the hex wallet private key (with or without 0x prefix).
	PrivateKey string
	// RPCURLs maps network names to custom RPC endpoints.
	RPCURLs map[string]string
}

// PaymentParams holds parameters for a gasless payment.
type PaymentParams struct {
	// To is the recipient address.
	To string
	// Amount is the payment amount in token units (e.g., "1.5" for 1.5 USDT0).
	Amount string
	// Token is the token to send (USDT0, USDC, USDT).
	Token string
	// Network is the target network (e.g., "ethereum", "arbitrum").
	Network string
}

// PaymentResult holds the result of a gasless payment.
type PaymentResult struct {
	// TxHash is the on-chain transaction hash.
	TxHash string `json:"txHash"`
	// UserOpHash is the ERC-4337 UserOperation hash.
	UserOpHash string `json:"userOpHash"`
	// Network is the network where the payment was executed.
	Network string `json:"network"`
	// Amount is the human-readable amount sent.
	Amount string `json:"amount"`
	// Token is the token sent.
	Token string `json:"token"`
	// To is the recipient address.
	To string `json:"to"`
	// Sponsored indicates if gas was sponsored by a paymaster.
	Sponsored bool `json:"sponsored"`
	// ExplorerURL is the block explorer link for the transaction.
	ExplorerURL string `json:"explorerUrl,omitempty"`
}

// UserOperation represents an ERC-4337 user operation.
type UserOperation struct {
	Sender               string `json:"sender"`
	Nonce                string `json:"nonce"`
	InitCode             string `json:"initCode"`
	CallData             string `json:"callData"`
	CallGasLimit         string `json:"callGasLimit"`
	VerificationGasLimit string `json:"verificationGasLimit"`
	PreVerificationGas   string `json:"preVerificationGas"`
	MaxFeePerGas         string `json:"maxFeePerGas"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	PaymasterAndData     string `json:"paymasterAndData"`
	Signature            string `json:"signature"`
}

// GasEstimate holds gas estimation for a user operation.
type GasEstimate struct {
	CallGasLimit         *big.Int
	VerificationGasLimit *big.Int
	PreVerificationGas   *big.Int
}

// UserOperationReceipt holds the receipt of a submitted user operation.
type UserOperationReceipt struct {
	TransactionHash string `json:"transactionHash"`
	Success         bool   `json:"success"`
}

// Package bridge provides cross-chain USDT0 bridging via LayerZero OFT for the WDK.
package bridge

import "math/big"

// Config holds the bridge client configuration.
type Config struct {
	// PrivateKey is the hex wallet private key (with or without 0x prefix).
	PrivateKey string
	// RPCURLs maps network names to custom RPC endpoints.
	RPCURLs map[string]string
}

// BridgeParams holds parameters for a bridge operation.
type BridgeParams struct {
	// FromChain is the source chain name.
	FromChain string
	// ToChain is the destination chain name.
	ToChain string
	// Amount is the amount to bridge in human-readable format (e.g., "100").
	Amount string
	// Recipient is the recipient address on the destination chain.
	Recipient string
}

// BridgeResult holds the result of a bridge operation.
type BridgeResult struct {
	// TxHash is the transaction hash on the source chain.
	TxHash string `json:"txHash"`
	// MessageGUID is the LayerZero message GUID for tracking.
	MessageGUID string `json:"messageGuid"`
	// FromChain is the source chain.
	FromChain string `json:"fromChain"`
	// ToChain is the destination chain.
	ToChain string `json:"toChain"`
	// Amount is the human-readable amount sent.
	Amount string `json:"amount"`
	// ExplorerURL is the block explorer link for the transaction.
	ExplorerURL string `json:"explorerUrl"`
	// TrackingURL is the LayerZero Scan tracking link.
	TrackingURL string `json:"trackingUrl"`
	// EstimatedTime is the estimated delivery time in seconds.
	EstimatedTime int `json:"estimatedTime"`
}

// FeeResult holds the result of a bridge fee query.
type FeeResult struct {
	// NativeFee is the formatted native token fee.
	NativeFee string `json:"nativeFee"`
	// NativeSymbol is the native token symbol.
	NativeSymbol string `json:"nativeSymbol"`
	// FromChain is the source chain.
	FromChain string `json:"fromChain"`
	// ToChain is the destination chain.
	ToChain string `json:"toChain"`
	// Amount is the formatted amount to bridge.
	Amount string `json:"amount"`
	// EstimatedTime is the estimated delivery time in seconds.
	EstimatedTime int `json:"estimatedTime"`
}

// SendParam represents the LayerZero OFT send parameters.
type SendParam struct {
	DstEid       uint32
	To           [32]byte
	AmountLD     *big.Int
	MinAmountLD  *big.Int
	ExtraOptions []byte
	ComposeMsg   []byte
	OftCmd       []byte
}

// MessagingFee represents the LayerZero messaging fee.
type MessagingFee struct {
	NativeFee  *big.Int
	LzTokenFee *big.Int
}

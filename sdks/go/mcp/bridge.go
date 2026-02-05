package mcp

import (
	"context"

	"github.com/t402-io/t402/sdks/go/wdk/bridge"
)

// ExecuteBridge performs a USDT0 bridge via LayerZero OFT using the WDK bridge client.
func ExecuteBridge(ctx context.Context, config *ServerConfig, input BridgeInput) (*BridgeResult, error) {
	client := bridge.NewClient(bridge.Config{
		PrivateKey: config.PrivateKey,
		RPCURLs:    config.RPCURLs,
	})

	result, err := client.Bridge(ctx, bridge.BridgeParams{
		FromChain: input.FromChain,
		ToChain:   input.ToChain,
		Amount:    input.Amount,
		Recipient: input.Recipient,
	})
	if err != nil {
		return nil, err
	}

	return &BridgeResult{
		TxHash:        result.TxHash,
		MessageGUID:   result.MessageGUID,
		FromChain:     result.FromChain,
		ToChain:       result.ToChain,
		Amount:        result.Amount,
		ExplorerURL:   result.ExplorerURL,
		TrackingURL:   result.TrackingURL,
		EstimatedTime: result.EstimatedTime,
	}, nil
}

// GetBridgeFee queries the bridge fee for a USDT0 transfer using the WDK bridge client.
func GetBridgeFee(ctx context.Context, config *ServerConfig, input GetBridgeFeeInput) (*BridgeFeeResult, error) {
	client := bridge.NewClient(bridge.Config{
		PrivateKey: config.PrivateKey,
		RPCURLs:    config.RPCURLs,
	})

	result, err := client.QuoteFee(ctx, bridge.BridgeParams{
		FromChain: input.FromChain,
		ToChain:   input.ToChain,
		Amount:    input.Amount,
		Recipient: input.Recipient,
	})
	if err != nil {
		return nil, err
	}

	return &BridgeFeeResult{
		NativeFee:     result.NativeFee,
		NativeSymbol:  result.NativeSymbol,
		FromChain:     result.FromChain,
		ToChain:       result.ToChain,
		Amount:        result.Amount,
		EstimatedTime: result.EstimatedTime,
	}, nil
}

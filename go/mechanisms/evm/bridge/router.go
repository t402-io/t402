package bridge

import (
	"context"
	"fmt"
	"strings"
)

// CrossChainPaymentRouter routes payments across chains using USDT0 bridge.
type CrossChainPaymentRouter struct {
	bridge      *Usdt0Bridge
	scanClient  *LayerZeroScanClient
	sourceChain string
}

// NewCrossChainPaymentRouter creates a cross-chain payment router.
func NewCrossChainPaymentRouter(signer BridgeSigner, sourceChain string) (*CrossChainPaymentRouter, error) {
	bridge, err := NewUsdt0Bridge(signer, sourceChain)
	if err != nil {
		return nil, err
	}

	return &CrossChainPaymentRouter{
		bridge:      bridge,
		scanClient:  NewLayerZeroScanClient(),
		sourceChain: strings.ToLower(sourceChain),
	}, nil
}

// RoutePayment routes payment across chains.
//
// This method:
// 1. Bridges USDT0 from source chain to destination chain
// 2. Sends funds to the payer's address on destination chain
// 3. Returns tracking info for monitoring delivery
//
// After delivery, the payer can use the bridged funds to pay on the destination chain.
func (r *CrossChainPaymentRouter) RoutePayment(ctx context.Context, params *CrossChainPaymentParams) (*CrossChainPaymentResult, error) {
	if err := r.validateParams(params); err != nil {
		return nil, err
	}

	slippage := params.SlippageTolerance
	if slippage <= 0 {
		slippage = DefaultSlippage
	}

	// Execute bridge transaction
	result, err := r.bridge.Send(ctx, &BridgeExecuteParams{
		BridgeQuoteParams: BridgeQuoteParams{
			FromChain: params.SourceChain,
			ToChain:   params.DestinationChain,
			Amount:    params.Amount,
			Recipient: params.Payer, // Bridge to payer's address
		},
		SlippageTolerance: slippage,
	})
	if err != nil {
		return nil, err
	}

	return &CrossChainPaymentResult{
		BridgeTxHash:           result.TxHash,
		MessageGUID:            result.MessageGUID,
		AmountBridged:          result.AmountSent,
		EstimatedReceiveAmount: result.AmountToReceive,
		SourceChain:            params.SourceChain,
		DestinationChain:       params.DestinationChain,
		EstimatedDeliveryTime:  result.EstimatedTime,
	}, nil
}

// EstimateFees gets estimated fees for routing a payment.
func (r *CrossChainPaymentRouter) EstimateFees(ctx context.Context, params *CrossChainPaymentParams) (*BridgeQuote, error) {
	return r.bridge.Quote(ctx, &BridgeQuoteParams{
		FromChain: params.SourceChain,
		ToChain:   params.DestinationChain,
		Amount:    params.Amount,
		Recipient: params.Payer,
	})
}

// TrackMessage retrieves the current status of a message.
func (r *CrossChainPaymentRouter) TrackMessage(ctx context.Context, messageGUID string) (*LayerZeroMessage, error) {
	return r.scanClient.GetMessage(ctx, messageGUID)
}

// WaitForDelivery waits for payment to be delivered on destination chain.
func (r *CrossChainPaymentRouter) WaitForDelivery(ctx context.Context, messageGUID string, opts *WaitForDeliveryOptions) (*LayerZeroMessage, error) {
	return r.scanClient.WaitForDelivery(ctx, messageGUID, opts)
}

// CanRoute checks if routing between two chains is supported.
func (r *CrossChainPaymentRouter) CanRoute(sourceChain, destinationChain string) bool {
	return !strings.EqualFold(sourceChain, destinationChain) &&
		SupportsBridging(sourceChain) &&
		SupportsBridging(destinationChain)
}

// GetSupportedDestinations returns all supported destination chains from source chain.
func (r *CrossChainPaymentRouter) GetSupportedDestinations() []string {
	return r.bridge.GetSupportedDestinations()
}

// GetBridgeableChains returns all bridgeable chains (static method equivalent).
func GetRouterBridgeableChains() []string {
	return GetBridgeableChains()
}

// validateParams validates routing parameters.
func (r *CrossChainPaymentRouter) validateParams(params *CrossChainPaymentParams) error {
	if !strings.EqualFold(params.SourceChain, r.sourceChain) {
		return fmt.Errorf(
			"source chain mismatch: router initialized for %q but got %q",
			r.sourceChain,
			params.SourceChain,
		)
	}

	if !r.CanRoute(params.SourceChain, params.DestinationChain) {
		return fmt.Errorf(
			"cannot route payment from %q to %q. Supported chains: %s",
			params.SourceChain,
			params.DestinationChain,
			strings.Join(GetBridgeableChains(), ", "),
		)
	}

	if params.Amount == nil || params.Amount.Sign() <= 0 {
		return fmt.Errorf("amount must be greater than 0")
	}

	return nil
}

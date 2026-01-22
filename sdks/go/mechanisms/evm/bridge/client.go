package bridge

import (
	"context"
	"fmt"
	"math/big"
	"strings"
)

// Usdt0Bridge provides cross-chain USDT0 transfers using LayerZero OFT standard.
type Usdt0Bridge struct {
	signer BridgeSigner
	chain  string
}

// NewUsdt0Bridge creates a new bridge client for a specific chain.
func NewUsdt0Bridge(signer BridgeSigner, chain string) (*Usdt0Bridge, error) {
	if !SupportsBridging(chain) {
		return nil, fmt.Errorf(
			"chain %q does not support USDT0 bridging. Supported chains: %s",
			chain,
			strings.Join(GetBridgeableChains(), ", "),
		)
	}

	return &Usdt0Bridge{
		signer: signer,
		chain:  strings.ToLower(chain),
	}, nil
}

// Quote gets a quote for bridging USDT0.
func (b *Usdt0Bridge) Quote(ctx context.Context, params *BridgeQuoteParams) (*BridgeQuote, error) {
	if err := b.validateParams(params); err != nil {
		return nil, err
	}

	sendParam, err := b.buildSendParam(params.ToChain, params.Amount, params.Recipient, DefaultSlippage)
	if err != nil {
		return nil, err
	}

	oftAddress, _ := GetUSDT0OFTAddress(params.FromChain)

	// Get quote from contract
	result, err := b.signer.ReadContract(ctx, oftAddress, OFTSendABI, "quoteSend", sendParam, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote: %w", err)
	}

	fee, err := parseMessagingFee(result)
	if err != nil {
		return nil, fmt.Errorf("failed to parse fee: %w", err)
	}

	return &BridgeQuote{
		NativeFee:          fee.NativeFee,
		AmountToSend:       params.Amount,
		MinAmountToReceive: sendParam.MinAmountLD,
		EstimatedTime:      EstimatedBridgeTime,
		FromChain:          params.FromChain,
		ToChain:            params.ToChain,
	}, nil
}

// Send executes a bridge transaction.
func (b *Usdt0Bridge) Send(ctx context.Context, params *BridgeExecuteParams) (*BridgeResult, error) {
	if err := b.validateParams(&params.BridgeQuoteParams); err != nil {
		return nil, err
	}

	slippage := params.SlippageTolerance
	if slippage <= 0 {
		slippage = DefaultSlippage
	}

	oftAddress, _ := GetUSDT0OFTAddress(params.FromChain)
	sendParam, err := b.buildSendParam(params.ToChain, params.Amount, params.Recipient, slippage)
	if err != nil {
		return nil, err
	}

	refundAddress := params.RefundAddress
	if refundAddress == "" {
		refundAddress = b.signer.Address()
	}

	// Get fee quote
	result, err := b.signer.ReadContract(ctx, oftAddress, OFTSendABI, "quoteSend", sendParam, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote: %w", err)
	}

	fee, err := parseMessagingFee(result)
	if err != nil {
		return nil, fmt.Errorf("failed to parse fee: %w", err)
	}

	// Check and approve allowance if needed
	if err := b.ensureAllowance(ctx, oftAddress, params.Amount); err != nil {
		return nil, fmt.Errorf("failed to ensure allowance: %w", err)
	}

	// Execute bridge transaction
	txHash, err := b.signer.WriteContract(
		ctx,
		oftAddress,
		OFTSendABI,
		"send",
		fee.NativeFee, // value
		sendParam,
		fee,
		refundAddress,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to execute bridge: %w", err)
	}

	// Wait for transaction confirmation
	receipt, err := b.signer.WaitForTransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for transaction: %w", err)
	}

	if receipt.Status != 1 {
		return nil, fmt.Errorf("bridge transaction failed: %s", txHash)
	}

	// Extract message GUID from OFTSent event logs
	messageGUID, err := extractMessageGUID(receipt)
	if err != nil {
		return nil, err
	}

	return &BridgeResult{
		TxHash:          txHash,
		MessageGUID:     messageGUID,
		AmountSent:      params.Amount,
		AmountToReceive: sendParam.MinAmountLD,
		FromChain:       params.FromChain,
		ToChain:         params.ToChain,
		EstimatedTime:   EstimatedBridgeTime,
	}, nil
}

// GetSupportedDestinations returns all supported destination chains from current chain.
func (b *Usdt0Bridge) GetSupportedDestinations() []string {
	chains := GetBridgeableChains()
	result := make([]string, 0, len(chains)-1)
	for _, chain := range chains {
		if chain != b.chain {
			result = append(result, chain)
		}
	}
	return result
}

// SupportsDestination checks if a destination chain is supported.
func (b *Usdt0Bridge) SupportsDestination(toChain string) bool {
	return toChain != b.chain && SupportsBridging(toChain)
}

// validateParams validates bridge parameters.
func (b *Usdt0Bridge) validateParams(params *BridgeQuoteParams) error {
	if strings.ToLower(params.FromChain) != b.chain {
		return fmt.Errorf(
			"source chain mismatch: bridge initialized for %q but got %q",
			b.chain,
			params.FromChain,
		)
	}

	if !SupportsBridging(params.FromChain) {
		return fmt.Errorf("source chain %q does not support USDT0 bridging", params.FromChain)
	}

	if !SupportsBridging(params.ToChain) {
		return fmt.Errorf("destination chain %q does not support USDT0 bridging", params.ToChain)
	}

	if strings.EqualFold(params.FromChain, params.ToChain) {
		return fmt.Errorf("source and destination chains must be different")
	}

	if params.Amount == nil || params.Amount.Sign() <= 0 {
		return fmt.Errorf("amount must be greater than 0")
	}

	return nil
}

// buildSendParam builds the LayerZero SendParam struct.
func (b *Usdt0Bridge) buildSendParam(toChain string, amount *big.Int, recipient string, slippage float64) (*SendParam, error) {
	dstEid, ok := GetEndpointID(toChain)
	if !ok {
		return nil, fmt.Errorf("unknown destination chain: %s", toChain)
	}

	to, err := AddressToBytes32(recipient)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address: %w", err)
	}

	// Calculate minimum amount with slippage
	slippageBps := int64(slippage * 100)
	minAmount := new(big.Int).Sub(
		amount,
		new(big.Int).Div(
			new(big.Int).Mul(amount, big.NewInt(slippageBps)),
			big.NewInt(10000),
		),
	)

	return &SendParam{
		DstEid:       dstEid,
		To:           to,
		AmountLD:     amount,
		MinAmountLD:  minAmount,
		ExtraOptions: DefaultExtraOptions,
		ComposeMsg:   []byte{},
		OftCmd:       []byte{},
	}, nil
}

// ensureAllowance checks and approves token allowance if needed.
func (b *Usdt0Bridge) ensureAllowance(ctx context.Context, oftAddress string, amount *big.Int) error {
	signerAddress := b.signer.Address()

	// Check current allowance
	result, err := b.signer.ReadContract(ctx, oftAddress, ERC20ApproveABI, "allowance", signerAddress, oftAddress)
	if err != nil {
		return fmt.Errorf("failed to check allowance: %w", err)
	}

	allowance, ok := result.(*big.Int)
	if !ok {
		// Try to convert from interface
		if v, ok := result.(big.Int); ok {
			allowance = &v
		} else {
			allowance = big.NewInt(0)
		}
	}

	// Approve if needed
	if allowance.Cmp(amount) < 0 {
		_, err := b.signer.WriteContract(ctx, oftAddress, ERC20ApproveABI, "approve", nil, oftAddress, amount)
		if err != nil {
			return fmt.Errorf("failed to approve: %w", err)
		}
	}

	return nil
}

// extractMessageGUID extracts the LayerZero message GUID from OFTSent event logs.
func extractMessageGUID(receipt *BridgeTransactionReceipt) (string, error) {
	for _, log := range receipt.Logs {
		if len(log.Topics) >= 2 && strings.EqualFold(log.Topics[0], OFTSentEventTopic) {
			// GUID is the first indexed parameter (topics[1])
			return log.Topics[1], nil
		}
	}

	return "", fmt.Errorf(
		"failed to extract message GUID from transaction logs: " +
			"the OFTSent event was not found in the transaction receipt",
	)
}

// parseMessagingFee parses the MessagingFee from contract response.
func parseMessagingFee(result interface{}) (*MessagingFee, error) {
	// Handle different response formats
	switch v := result.(type) {
	case *MessagingFee:
		return v, nil
	case MessagingFee:
		return &v, nil
	case map[string]interface{}:
		fee := &MessagingFee{
			NativeFee:  big.NewInt(0),
			LzTokenFee: big.NewInt(0),
		}
		if nf, ok := v["nativeFee"].(*big.Int); ok {
			fee.NativeFee = nf
		}
		if lf, ok := v["lzTokenFee"].(*big.Int); ok {
			fee.LzTokenFee = lf
		}
		return fee, nil
	case []interface{}:
		// Tuple response: [nativeFee, lzTokenFee]
		if len(v) >= 2 {
			fee := &MessagingFee{
				NativeFee:  big.NewInt(0),
				LzTokenFee: big.NewInt(0),
			}
			if nf, ok := v[0].(*big.Int); ok {
				fee.NativeFee = nf
			}
			if lf, ok := v[1].(*big.Int); ok {
				fee.LzTokenFee = lf
			}
			return fee, nil
		}
	}

	return nil, fmt.Errorf("unexpected fee response format: %T", result)
}

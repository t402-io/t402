package mcp

// Phase C Batch 3 (2026-04-24): six additional MCP tools to close the
// cross-SDK parity gap. All schemas match the TypeScript SDK exactly;
// demo-mode handling follows the same pattern as the batch-1 and
// batch-2 tools (fixed outputs, no RPC calls).
//
// Tools added here:
//   - t402/verifySignature         — EIP-191 signature verification
//   - t402/estimatePaymentFee      — gas + USD cost for an ERC-20 transfer
//   - t402/compareNetworkFees      — estimate fees across multiple networks
//   - t402/getHistoricalPrice      — CoinGecko historical price series
//   - t402/quoteBridge             — getBridgeFee + store a quoteId
//   - t402/executeBridgeFromQuote  — execute a bridge from a stored quote
//
// See also: memory/phase-c-d-decisions-2026-04-24.md

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ---------------------------------------------------------------------------
// t402/verifySignature
// ---------------------------------------------------------------------------

// handleVerifySignature handles the t402/verifySignature tool.
func (s *Server) handleVerifySignature(_ context.Context, args json.RawMessage) *ToolResult {
	var input VerifySignatureInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if input.Message == "" {
		return errorResult("message must not be empty")
	}
	if !IsValidNetwork(input.Chain) {
		return errorResult(fmt.Sprintf("Invalid chain: %s", input.Chain))
	}
	if !strings.HasPrefix(input.Address, "0x") || len(input.Address) != 42 {
		return errorResult("address must be a 0x-prefixed 20-byte hex address")
	}

	valid, recovered, err := verifyEIP191(input.Message, input.Signature, input.Address)
	result := VerifySignatureResult{
		Valid:   valid,
		Address: input.Address,
		Message: input.Message,
		Network: input.Chain,
	}
	if err != nil {
		result.Error = err.Error()
	}

	lines := []string{
		"## Signature Verification",
		"",
		fmt.Sprintf("- **Valid:** %t", result.Valid),
		fmt.Sprintf("- **Expected Address:** %s", result.Address),
		fmt.Sprintf("- **Network:** %s", result.Network),
		fmt.Sprintf("- **Message:** %s", result.Message),
	}
	if recovered != "" && !valid {
		lines = append(lines, fmt.Sprintf("- **Recovered Address:** %s", recovered))
	}
	if result.Error != "" {
		lines = append(lines, fmt.Sprintf("- **Error:** %s", result.Error))
	}
	return textResult(strings.Join(lines, "\n"))
}

// verifyEIP191 recovers the signer of a personal_sign message and checks
// it against the expected address. Returns (valid, recovered_address, err).
func verifyEIP191(message, signature, expectedAddress string) (bool, string, error) {
	sigHex := strings.TrimPrefix(signature, "0x")
	if len(sigHex) != 130 {
		return false, "", fmt.Errorf("signature must be 65 bytes (130 hex chars), got %d", len(sigHex))
	}
	sigBytes, err := hexutil.Decode("0x" + sigHex)
	if err != nil {
		return false, "", fmt.Errorf("decode signature: %w", err)
	}
	// go-ethereum expects v as 0/1; personal_sign emits 27/28.
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	msgBytes := []byte(message)
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(msgBytes))
	hash := crypto.Keccak256(append([]byte(prefix), msgBytes...))

	pubKey, err := crypto.SigToPub(hash, sigBytes)
	if err != nil {
		return false, "", fmt.Errorf("recover pubkey: %w", err)
	}
	recovered := crypto.PubkeyToAddress(*pubKey)
	recoveredStr := recovered.Hex()

	expected := common.HexToAddress(expectedAddress)
	return recovered == expected, recoveredStr, nil
}

// ---------------------------------------------------------------------------
// t402/estimatePaymentFee
// ---------------------------------------------------------------------------

// handleEstimatePaymentFee handles the t402/estimatePaymentFee tool.
func (s *Server) handleEstimatePaymentFee(
	ctx context.Context, args json.RawMessage,
) *ToolResult {
	var input EstimatePaymentFeeInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if !IsValidNetwork(input.Network) {
		return errorResult(fmt.Sprintf("Invalid network: %s", input.Network))
	}

	est, err := estimatePaymentFee(ctx, s.config, input)
	if err != nil {
		return errorResult(err.Error())
	}
	return textResult(formatPaymentFee(est))
}

// estimatePaymentFee computes a PaymentFeeEstimate for the given input.
// Demo mode uses a canned table so the call works offline; live mode
// estimates ERC-20 transfer gas against the configured RPC and converts
// the resulting native cost to USD via CoinGecko.
func estimatePaymentFee(
	ctx context.Context, config *ServerConfig, input EstimatePaymentFeeInput,
) (PaymentFeeEstimate, error) {
	network := SupportedNetwork(input.Network)
	nativeSymbol := NativeSymbols[network]
	if nativeSymbol == "" {
		nativeSymbol = "ETH"
	}

	demo := config == nil || config.DemoMode
	if demo {
		return demoPaymentFee(input.Network, nativeSymbol), nil
	}

	tokenAddr, ok := GetTokenAddress(network, SupportedToken(input.Token))
	if !ok {
		return PaymentFeeEstimate{}, fmt.Errorf(
			"token %s not supported on %s", input.Token, input.Network,
		)
	}

	client, err := ethclient.DialContext(ctx, GetRPCURL(config, network))
	if err != nil {
		return PaymentFeeEstimate{}, fmt.Errorf("dial %s: %w", input.Network, err)
	}
	defer client.Close()

	// Build ERC-20 transfer calldata with a throw-away recipient so the
	// estimate reflects realistic gas.
	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return PaymentFeeEstimate{}, fmt.Errorf("parse amount: %w", err)
	}
	dummyTo := common.HexToAddress("0x000000000000000000000000000000000000dEaD")
	data := append([]byte{}, transferSelector...)
	data = append(data, common.LeftPadBytes(dummyTo.Bytes(), 32)...)
	data = append(data, common.LeftPadBytes(amount.Bytes(), 32)...)
	tokenAddrCommon := common.HexToAddress(tokenAddr)
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		To:   &tokenAddrCommon,
		Data: data,
	})
	if err != nil || gasLimit == 0 {
		gasLimit = 65_000
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return PaymentFeeEstimate{}, fmt.Errorf("gas price: %w", err)
	}
	nativeCost := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), gasPrice)

	usdCost := "unknown"
	if prices, err := getTokenPrices(ctx, []string{nativeSymbol}, "usd"); err == nil {
		if price, ok := prices[strings.ToUpper(nativeSymbol)]; ok && price > 0 {
			cost := weiToEtherFloat(nativeCost) * price
			usdCost = fmt.Sprintf("$%.4f", cost)
		}
	}

	return PaymentFeeEstimate{
		Network:      input.Network,
		GasLimit:     fmt.Sprintf("%d", gasLimit),
		GasPriceGwei: formatGwei(gasPrice),
		NativeCost:   weiToEther(nativeCost),
		NativeSymbol: nativeSymbol,
		USDCost:      usdCost,
	}, nil
}

// demoPaymentFee returns a canned estimate mirroring the TS demo table.
func demoPaymentFee(network, nativeSymbol string) PaymentFeeEstimate {
	type entry struct {
		gasLimit    uint64
		gasPrice    *big.Int
		nativePrice float64
	}
	gwei := big.NewInt(1_000_000_000)
	mul := func(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), gwei) }
	table := map[string]entry{
		"ethereum":  {65_000, mul(25), 3250.42},
		"base":      {65_000, mul(0).Add(big.NewInt(50_000_000), big.NewInt(0)), 3250.42},
		"arbitrum":  {65_000, big.NewInt(100_000_000), 3250.42},
		"optimism":  {65_000, big.NewInt(50_000_000), 3250.42},
		"polygon":   {65_000, mul(30), 0.58},
		"avalanche": {65_000, mul(25), 24.15},
		"ink":       {65_000, big.NewInt(50_000_000), 3250.42},
		"berachain": {65_000, mul(1), 3.82},
		"unichain":  {65_000, big.NewInt(50_000_000), 3250.42},
	}
	e, ok := table[network]
	if !ok {
		e = table["ethereum"]
	}
	nativeCost := new(big.Int).Mul(new(big.Int).SetUint64(e.gasLimit), e.gasPrice)
	usdCost := weiToEtherFloat(nativeCost) * e.nativePrice
	return PaymentFeeEstimate{
		Network:      network,
		GasLimit:     fmt.Sprintf("%d", e.gasLimit),
		GasPriceGwei: formatGwei(e.gasPrice),
		NativeCost:   weiToEther(nativeCost),
		NativeSymbol: nativeSymbol,
		USDCost:      fmt.Sprintf("$%.4f", usdCost),
	}
}

func formatPaymentFee(e PaymentFeeEstimate) string {
	return strings.Join([]string{
		fmt.Sprintf("## Payment Fee Estimate (%s)", e.Network),
		"",
		fmt.Sprintf("- **Gas Limit:** %s", e.GasLimit),
		fmt.Sprintf("- **Gas Price:** %s gwei", e.GasPriceGwei),
		fmt.Sprintf("- **Native Cost:** %s %s", e.NativeCost, e.NativeSymbol),
		fmt.Sprintf("- **USD Cost:** %s", e.USDCost),
	}, "\n")
}

// weiToEther renders a wei amount as an 18-decimal string.
func weiToEther(wei *big.Int) string {
	f := new(big.Float).Quo(new(big.Float).SetInt(wei), big.NewFloat(1e18))
	return f.Text('f', 9)
}

// weiToEtherFloat is a lossy version used only for USD conversion; the
// caller handles decimal-place formatting.
func weiToEtherFloat(wei *big.Int) float64 {
	f, _ := new(big.Float).Quo(new(big.Float).SetInt(wei), big.NewFloat(1e18)).Float64()
	return f
}

// formatGwei renders a wei amount as gwei with 3 decimals.
func formatGwei(wei *big.Int) string {
	f := new(big.Float).Quo(new(big.Float).SetInt(wei), big.NewFloat(1e9))
	return f.Text('f', 3)
}

// ---------------------------------------------------------------------------
// t402/compareNetworkFees
// ---------------------------------------------------------------------------

// handleCompareNetworkFees handles the t402/compareNetworkFees tool.
func (s *Server) handleCompareNetworkFees(
	ctx context.Context, args json.RawMessage,
) *ToolResult {
	var input CompareNetworkFeesInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	networks := input.Networks
	if len(networks) == 0 {
		for _, n := range AllNetworks() {
			networks = append(networks, string(n))
		}
	}

	estimates := make([]PaymentFeeEstimate, 0, len(networks))
	for _, network := range networks {
		if !IsValidNetwork(network) {
			return errorResult(fmt.Sprintf("Invalid network: %s", network))
		}
		est, err := estimatePaymentFee(ctx, s.config, EstimatePaymentFeeInput{
			Network: network,
			Amount:  input.Amount,
			Token:   input.Token,
		})
		if err != nil {
			// Skip unsupported networks for this token (e.g. USDT on ink).
			continue
		}
		estimates = append(estimates, est)
	}

	// Sort by numeric USD cost ascending; unparseable entries sink.
	sort.SliceStable(estimates, func(i, j int) bool {
		return extractUSDAmount(estimates[i].USDCost) < extractUSDAmount(estimates[j].USDCost)
	})

	lines := []string{
		fmt.Sprintf("## Network Fee Comparison for %s %s", input.Amount, input.Token),
		"",
	}
	for _, e := range estimates {
		lines = append(lines,
			fmt.Sprintf("### %s", e.Network),
			fmt.Sprintf("- USD Cost: %s", e.USDCost),
			fmt.Sprintf("- Native: %s %s", e.NativeCost, e.NativeSymbol),
			fmt.Sprintf("- Gas Limit × Price: %s × %s gwei", e.GasLimit, e.GasPriceGwei),
			"",
		)
	}
	if len(estimates) == 0 {
		lines = append(lines, "_No supported networks returned a successful estimate._")
	}
	return textResult(strings.Join(lines, "\n"))
}

// extractUSDAmount parses "$0.0012" → 0.0012; returns +Inf on parse failure
// so unparseable entries sort to the end.
func extractUSDAmount(s string) float64 {
	s = strings.TrimPrefix(s, "$")
	var f float64
	if _, err := fmt.Sscanf(s, "%f", &f); err != nil {
		return 1e18 // sentinel
	}
	return f
}

// ---------------------------------------------------------------------------
// t402/getHistoricalPrice
// ---------------------------------------------------------------------------

const coinGeckoHistoricalAPI = "https://api.coingecko.com/api/v3/coins/%s/market_chart"

// handleGetHistoricalPrice handles the t402/getHistoricalPrice tool.
func (s *Server) handleGetHistoricalPrice(
	ctx context.Context, args json.RawMessage,
) *ToolResult {
	var input GetHistoricalPriceInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if input.Token == "" {
		return errorResult("token must not be empty")
	}
	days := input.Days
	if days == 0 {
		days = 7
	}
	if days < 1 || days > 365 {
		return errorResult("days must be between 1 and 365")
	}

	if s.config != nil && s.config.DemoMode {
		return textResult(demoHistoricalPrice(input.Token, days))
	}

	coinID, ok := tokenToCoinGeckoID[strings.ToUpper(input.Token)]
	if !ok {
		coinID = strings.ToLower(input.Token)
	}

	url := fmt.Sprintf("%s?vs_currency=usd&days=%d", fmt.Sprintf(coinGeckoHistoricalAPI, coinID), days)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to build request: %v", err))
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errorResult(fmt.Sprintf("CoinGecko request failed: %v", err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return errorResult(fmt.Sprintf("CoinGecko API error: %s — %s", resp.Status, string(body)))
	}

	var data struct {
		Prices [][]float64 `json:"prices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return errorResult(fmt.Sprintf("decode response: %v", err))
	}
	if len(data.Prices) == 0 {
		return errorResult("CoinGecko returned no price data")
	}

	return textResult(formatHistoricalPrice(input.Token, coinID, days, data.Prices))
}

func formatHistoricalPrice(token, coinID string, days int, series [][]float64) string {
	lines := []string{
		fmt.Sprintf("## Historical Price — %s (%d days)", strings.ToUpper(token), days),
		"",
		fmt.Sprintf("- **CoinGecko ID:** %s", coinID),
		fmt.Sprintf("- **Data Points:** %d", len(series)),
		"",
	}

	start := series[0][1]
	end := series[len(series)-1][1]
	absolute := end - start
	percent := 0.0
	if start != 0 {
		percent = (absolute / start) * 100
	}

	lines = append(lines,
		"**Price Change Over Period:**",
		fmt.Sprintf("- Start: $%.4f", start),
		fmt.Sprintf("- End:   $%.4f", end),
		fmt.Sprintf("- Change: $%.4f (%.2f%%)", absolute, percent),
		"",
	)

	// Sample up to 10 evenly-spaced points for the markdown body.
	step := len(series) / 10
	if step < 1 {
		step = 1
	}
	lines = append(lines, "**Sample Points:**")
	for i := 0; i < len(series); i += step {
		ts := int64(series[i][0]) / 1000
		date := time.Unix(ts, 0).UTC().Format("2006-01-02 15:04")
		lines = append(lines, fmt.Sprintf("- %s: $%.4f", date, series[i][1]))
	}
	return strings.Join(lines, "\n")
}

func demoHistoricalPrice(token string, days int) string {
	now := time.Now().Unix()
	// 4 synthetic points so the output shape matches real responses.
	prices := [][2]float64{
		{float64((now - int64(days*86400)) * 1000), 3000},
		{float64((now - int64(days*64800)) * 1000), 3100},
		{float64((now - int64(days*43200)) * 1000), 3200},
		{float64(now * 1000), 3250},
	}
	lines := []string{
		fmt.Sprintf("## Historical Price — %s (%d days) [demo]", strings.ToUpper(token), days),
		"",
		"- **Demo mode** — synthetic data, CoinGecko was not contacted.",
		"",
		"**Price Change Over Period:** $250.00 (+8.33%)",
		"",
		"**Sample Points:**",
	}
	for _, p := range prices {
		ts := int64(p[0]) / 1000
		date := time.Unix(ts, 0).UTC().Format("2006-01-02 15:04")
		lines = append(lines, fmt.Sprintf("- %s: $%.4f", date, p[1]))
	}
	return strings.Join(lines, "\n")
}

// ---------------------------------------------------------------------------
// t402/quoteBridge
// ---------------------------------------------------------------------------

// handleQuoteBridge handles the t402/quoteBridge tool.
//
// Produces a bridge quote (delegates to the existing getBridgeFee path)
// and stores it under a UUID so the caller can submit the quoteId to
// executeBridgeFromQuote later.
func (s *Server) handleQuoteBridge(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetBridgeFeeInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	// Reuse the existing bridge fee handler to build the quote body, then
	// wrap it with a quoteId.
	feeResult := s.handleGetBridgeFee(ctx, args)
	if feeResult.IsError {
		return feeResult
	}

	quoteID := CreateQuote(QuoteTypeBridge, map[string]any{
		"fromChain": input.FromChain,
		"toChain":   input.ToChain,
		"amount":    input.Amount,
		"recipient": input.Recipient,
	})

	expiresAt := time.Now().Add(defaultQuoteTTL).UTC().Format(time.RFC3339)

	lines := []string{
		"## Bridge Quote",
		"",
		fmt.Sprintf("- **Quote ID:** `%s`", quoteID),
		fmt.Sprintf("- **From:** %s", input.FromChain),
		fmt.Sprintf("- **To:** %s", input.ToChain),
		fmt.Sprintf("- **Amount:** %s USDT0", input.Amount),
		fmt.Sprintf("- **Recipient:** %s", input.Recipient),
		fmt.Sprintf("- **Expires At:** %s", expiresAt),
		"",
		"Fee detail:",
		feeResult.Content[0].Text,
		"",
		"Submit `quoteId` to `t402/executeBridgeFromQuote` with `confirmed: true` to execute.",
	}
	return textResult(strings.Join(lines, "\n"))
}

// ---------------------------------------------------------------------------
// t402/executeBridgeFromQuote
// ---------------------------------------------------------------------------

// handleExecuteBridgeFromQuote handles the t402/executeBridgeFromQuote tool.
func (s *Server) handleExecuteBridgeFromQuote(
	ctx context.Context, args json.RawMessage,
) *ToolResult {
	var input ExecuteBridgeFromQuoteInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if input.QuoteID == "" {
		return errorResult("quoteId must not be empty")
	}

	quote, ok := GetQuote(input.QuoteID)
	if !ok {
		return errorResult("Quote not found or expired. Please request a new quote.")
	}
	if quote.Type != QuoteTypeBridge {
		return errorResult("Invalid quote type. Expected a bridge quote.")
	}

	fromChain, _ := quote.Data["fromChain"].(string)
	toChain, _ := quote.Data["toChain"].(string)
	amount, _ := quote.Data["amount"].(string)
	recipient, _ := quote.Data["recipient"].(string)

	if !input.Confirmed {
		lines := []string{
			"## Bridge Preview (NOT executed)",
			"",
			fmt.Sprintf("- **Quote ID:** `%s`", input.QuoteID),
			fmt.Sprintf("- **Amount:** %s USDT0", amount),
			fmt.Sprintf("- **From:** %s", fromChain),
			fmt.Sprintf("- **To:** %s", toChain),
			fmt.Sprintf("- **Recipient:** %s", recipient),
			"",
			"Set `confirmed: true` to execute.",
		}
		return textResult(strings.Join(lines, "\n"))
	}

	// Delegate to the existing bridge handler.
	bridgeArgs, err := json.Marshal(BridgeInput{
		FromChain: fromChain,
		ToChain:   toChain,
		Amount:    amount,
		Recipient: recipient,
	})
	if err != nil {
		return errorResult(fmt.Sprintf("failed to marshal bridge args: %v", err))
	}
	result := s.handleBridge(ctx, bridgeArgs)
	if !result.IsError {
		DeleteQuote(input.QuoteID)
	}
	return result
}

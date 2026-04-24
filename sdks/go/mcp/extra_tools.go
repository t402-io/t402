package mcp

// Phase C (2026-04-24): extra MCP tools that close the cross-SDK parity
// gap with the TypeScript SDK. This file keeps them in one place so the
// original tool set (getBalance/getAllBalances/pay/payGasless/getBridgeFee/
// bridge) in tools.go stays unchanged during the port.

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strings"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ---------------------------------------------------------------------------
// t402/getTokenPrice
// ---------------------------------------------------------------------------

// handleGetTokenPrice handles the t402/getTokenPrice tool.
func (s *Server) handleGetTokenPrice(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetTokenPriceInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if len(input.Tokens) == 0 {
		return errorResult("tokens must not be empty")
	}

	currency := input.Currency
	if currency == "" {
		currency = "usd"
	}

	var prices map[string]float64
	if s.config != nil && s.config.DemoMode {
		prices = getTokenPricesDemo(input.Tokens)
	} else {
		p, err := getTokenPrices(ctx, input.Tokens, currency)
		if err != nil {
			return errorResult(fmt.Sprintf("Failed to fetch prices: %v", err))
		}
		prices = p
	}

	// Sort tokens for stable output regardless of input order.
	keys := make([]string, 0, len(prices))
	for k := range prices {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	lines := []string{"## Token Prices", ""}
	for _, token := range keys {
		price := prices[token]
		if price > 0 {
			lines = append(lines, fmt.Sprintf("- **%s:** %s %s", token, formatFloat(price), strings.ToUpper(currency)))
		} else {
			lines = append(lines, fmt.Sprintf("- **%s:** Price unavailable", token))
		}
	}
	return textResult(strings.Join(lines, "\n"))
}

// formatFloat renders a float with enough precision for cents and a few
// subcent digits. Keeps the display comparable to TS toLocaleString.
func formatFloat(v float64) string {
	// Use up to 6 significant digits, trimmed of trailing zeros.
	s := fmt.Sprintf("%.6f", v)
	// Trim trailing zeros after decimal.
	if strings.Contains(s, ".") {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

// ---------------------------------------------------------------------------
// t402/getGasPrice
// ---------------------------------------------------------------------------

// handleGetGasPrice handles the t402/getGasPrice tool.
func (s *Server) handleGetGasPrice(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetGasPriceInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if !IsValidNetwork(string(input.Network)) {
		return errorResult(fmt.Sprintf("Invalid network: %s", input.Network))
	}

	if s.config != nil && s.config.DemoMode {
		// Return a plausible gas price so demo UX stays consistent.
		demoGwei := big.NewInt(25_000_000_000)
		return textResult(formatGasPriceResult(string(input.Network), demoGwei, true))
	}

	client, err := ethclient.DialContext(ctx, GetRPCURL(s.config, SupportedNetwork(input.Network)))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect to %s: %v", input.Network, err))
	}
	defer client.Close()

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to fetch gas price: %v", err))
	}
	return textResult(formatGasPriceResult(string(input.Network), gasPrice, false))
}

func formatGasPriceResult(network string, gasPriceWei *big.Int, demoMode bool) string {
	// Convert wei to gwei (1 gwei = 1e9 wei).
	gwei := new(big.Float).Quo(
		new(big.Float).SetInt(gasPriceWei),
		big.NewFloat(1e9),
	)
	lines := []string{
		fmt.Sprintf("## Gas Price on %s", network),
		"",
		fmt.Sprintf("- **Gas Price:** %s gwei", gwei.Text('f', 3)),
		fmt.Sprintf("- **Raw (wei):** %s", gasPriceWei.String()),
	}
	if demoMode {
		lines = append(lines, "- **Mode:** demo (no RPC call)")
	}
	return strings.Join(lines, "\n")
}

// ---------------------------------------------------------------------------
// t402/signMessage
// ---------------------------------------------------------------------------

// handleSignMessage handles the t402/signMessage tool.
func (s *Server) handleSignMessage(_ context.Context, args json.RawMessage) *ToolResult {
	var input SignMessageInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if input.Message == "" {
		return errorResult("message must not be empty")
	}
	if s.config == nil || s.config.PrivateKey == "" {
		return errorResult(
			"Private key not configured. Set T402_PRIVATE_KEY to sign messages.",
		)
	}

	pkHex := strings.TrimPrefix(s.config.PrivateKey, "0x")
	key, err := crypto.HexToECDSA(pkHex)
	if err != nil {
		return errorResult(fmt.Sprintf("Invalid private key: %v", err))
	}

	// EIP-191 personal_sign: sign keccak256("\x19Ethereum Signed Message:\n" + len + message).
	msgBytes := []byte(input.Message)
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(msgBytes))
	hash := crypto.Keccak256([]byte(prefix + string(msgBytes)))

	sig, err := crypto.Sign(hash, key)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to sign: %v", err))
	}
	// go-ethereum returns v as 0/1; normalize to 27/28 per EIP-191.
	sig[64] += 27

	address := crypto.PubkeyToAddress(key.PublicKey)
	result := SignMessageResult{
		Address:   address.Hex(),
		Message:   input.Message,
		Signature: hexutil.Encode(sig),
	}
	lines := []string{
		"## Signed Message",
		"",
		fmt.Sprintf("- **Address:** %s", result.Address),
		fmt.Sprintf("- **Message:** %s", result.Message),
		fmt.Sprintf("- **Signature:** %s", result.Signature),
	}
	return textResult(strings.Join(lines, "\n"))
}

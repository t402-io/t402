package mcp

// Phase C Batch 2 (2026-04-24): WDK-flavored MCP tools. These mirror
// the TypeScript `@t402/mcp` WDK tool schemas so agents can switch
// between SDKs without adjusting their tool calls. Three are fully
// implemented (getWallet, getBalances, transfer) since they map to
// straightforward EVM RPC patterns; the swap trio is a schema-only
// honest stub because Go has no `@tetherto/wdk-go` counterpart and
// wiring a multi-chain DEX aggregator client is out of scope here.
//
// See also: memory/phase-c-d-decisions-2026-04-24.md
// memory/cross-sdk-wdk-alignment-evaluation.md

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ---------------------------------------------------------------------------
// t402/wdk/getWallet
// ---------------------------------------------------------------------------

// handleWdkGetWallet handles the t402/wdk/getWallet tool.
func (s *Server) handleWdkGetWallet(_ context.Context, _ json.RawMessage) *ToolResult {
	if s.config == nil {
		return errorResult("Server is not configured")
	}

	networks := AllNetworks()
	chains := make([]string, 0, len(networks))
	for _, n := range networks {
		chains = append(chains, string(n))
	}

	address := ""
	demoMode := false

	if s.config.DemoMode || s.config.PrivateKey == "" {
		demoMode = true
		address = "0x0000000000000000000000000000000000000000"
	} else {
		pkHex := strings.TrimPrefix(s.config.PrivateKey, "0x")
		key, err := crypto.HexToECDSA(pkHex)
		if err != nil {
			return errorResult(fmt.Sprintf("Invalid private key: %v", err))
		}
		address = crypto.PubkeyToAddress(key.PublicKey).Hex()
	}

	lines := []string{
		"## Wallet",
		"",
		fmt.Sprintf("- **EVM Address:** %s", address),
		fmt.Sprintf("- **Chains:** %s", strings.Join(chains, ", ")),
	}
	if demoMode {
		lines = append(lines, "- **Mode:** demo (no private key configured)")
	}
	return textResult(strings.Join(lines, "\n"))
}

// ---------------------------------------------------------------------------
// t402/wdk/getBalances
// ---------------------------------------------------------------------------

// handleWdkGetBalances handles the t402/wdk/getBalances tool.
//
// Unlike handleGetAllBalances, this returns a simplified per-chain view
// (usdt0, usdc, native) plus USDT0/USDC totals. Demo mode returns empty
// balances so agents can exercise the call without RPCs.
func (s *Server) handleWdkGetBalances(ctx context.Context, args json.RawMessage) *ToolResult {
	var input WdkGetBalancesInput
	// Empty args are valid (optional chains list).
	if len(args) > 0 {
		if err := json.Unmarshal(args, &input); err != nil {
			return errorResult(fmt.Sprintf("Invalid input: %v", err))
		}
	}

	chains := input.Chains
	if len(chains) == 0 {
		for _, n := range AllNetworks() {
			chains = append(chains, string(n))
		}
	}

	// Build chain entries. Demo mode returns zeros; real mode queries RPCs.
	demoMode := s.config == nil || s.config.DemoMode || s.config.PrivateKey == ""
	var (
		address    string
		totalUsdt0 = new(big.Int)
		totalUsdc  = new(big.Int)
	)
	if !demoMode {
		pkHex := strings.TrimPrefix(s.config.PrivateKey, "0x")
		key, err := crypto.HexToECDSA(pkHex)
		if err != nil {
			return errorResult(fmt.Sprintf("Invalid private key: %v", err))
		}
		address = crypto.PubkeyToAddress(key.PublicKey).Hex()
	}

	entries := make([]WdkChainBalance, 0, len(chains))
	for _, chain := range chains {
		if !IsValidNetwork(chain) {
			return errorResult(fmt.Sprintf("Invalid network: %s", chain))
		}
		if demoMode {
			entries = append(entries, WdkChainBalance{
				Chain: chain, USDT0: "0", USDC: "0", Native: "0",
			})
			continue
		}

		native, usdt0Raw, usdcRaw, err := queryWdkBalances(ctx, s.config, chain, address)
		if err != nil {
			entries = append(entries, WdkChainBalance{
				Chain: chain, USDT0: "0", USDC: "0", Native: "0",
				Error: err.Error(),
			})
			continue
		}
		entries = append(entries, WdkChainBalance{
			Chain:  chain,
			USDT0:  FormatTokenAmount(usdt0Raw, TokenDecimals),
			USDC:   FormatTokenAmount(usdcRaw, TokenDecimals),
			Native: FormatTokenAmount(native, NativeDecimals),
		})
		totalUsdt0 = new(big.Int).Add(totalUsdt0, usdt0Raw)
		totalUsdc = new(big.Int).Add(totalUsdc, usdcRaw)
	}

	totalUsdt0Str := FormatTokenAmount(totalUsdt0, TokenDecimals)
	totalUsdcStr := FormatTokenAmount(totalUsdc, TokenDecimals)

	lines := []string{"## WDK Balances", ""}
	for _, e := range entries {
		lines = append(lines, fmt.Sprintf("### %s", e.Chain))
		lines = append(lines, fmt.Sprintf("- USDT0: %s", e.USDT0))
		lines = append(lines, fmt.Sprintf("- USDC: %s", e.USDC))
		lines = append(lines, fmt.Sprintf("- Native: %s", e.Native))
		if e.Error != "" {
			lines = append(lines, fmt.Sprintf("- Error: %s", e.Error))
		}
		lines = append(lines, "")
	}
	lines = append(lines, "## Totals",
		"",
		fmt.Sprintf("- **USDT0:** %s", totalUsdt0Str),
		fmt.Sprintf("- **USDC:** %s", totalUsdcStr),
	)
	if demoMode {
		lines = append(lines, "", "_Demo mode — balances are zero._")
	}
	return textResult(strings.Join(lines, "\n"))
}

// queryWdkBalances returns (native, usdt0, usdc) raw balances for a chain.
// Separated from the handler for clarity and testability.
func queryWdkBalances(
	ctx context.Context,
	config *ServerConfig,
	chain, address string,
) (nativeBal, usdt0Bal, usdcBal *big.Int, err error) {
	client, err := ethclient.DialContext(ctx, GetRPCURL(config, SupportedNetwork(chain)))
	if err != nil {
		return nil, nil, nil, fmt.Errorf("dial %s: %w", chain, err)
	}
	defer client.Close()

	addr := common.HexToAddress(address)
	nativeBal, err = client.BalanceAt(ctx, addr, nil)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("native balance: %w", err)
	}

	usdt0Bal = big.NewInt(0)
	if usdt0Addr, ok := GetTokenAddress(SupportedNetwork(chain), TokenUSDT0); ok {
		if bal, err := getERC20Balance(ctx, client, usdt0Addr, address); err == nil {
			usdt0Bal = bal
		}
	}
	usdcBal = big.NewInt(0)
	if usdcAddr, ok := GetTokenAddress(SupportedNetwork(chain), TokenUSDC); ok {
		if bal, err := getERC20Balance(ctx, client, usdcAddr, address); err == nil {
			usdcBal = bal
		}
	}
	return nativeBal, usdt0Bal, usdcBal, nil
}

// ---------------------------------------------------------------------------
// t402/wdk/transfer
// ---------------------------------------------------------------------------

// handleWdkTransfer handles the t402/wdk/transfer tool.
//
// Gated on a `confirmed` flag: when absent or false, returns a preview
// of what would be executed; when true, delegates to the core pay path.
// This matches the TS WDK agent UX where the LLM proposes a transfer
// and the human/tool-controller acknowledges before execution.
func (s *Server) handleWdkTransfer(ctx context.Context, args json.RawMessage) *ToolResult {
	var input WdkTransferInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if !IsValidNetwork(input.Chain) {
		return errorResult(fmt.Sprintf("Invalid chain: %s", input.Chain))
	}

	if !input.Confirmed {
		lines := []string{
			"## Transfer Preview (NOT executed)",
			"",
			fmt.Sprintf("- **Amount:** %s %s", input.Amount, input.Token),
			fmt.Sprintf("- **To:** %s", input.To),
			fmt.Sprintf("- **Chain:** %s", input.Chain),
			"",
			"Set `confirmed: true` to execute.",
		}
		return textResult(strings.Join(lines, "\n"))
	}

	// Reuse the core pay handler by repackaging args. Both tools settle
	// through the same ERC-20 transfer path; only the input shape differs
	// (wdk/transfer uses `chain`, pay uses `network`).
	payArgs := PayInput{
		To:      input.To,
		Amount:  input.Amount,
		Token:   SupportedToken(input.Token),
		Network: SupportedNetwork(input.Chain),
	}
	raw, err := json.Marshal(payArgs)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to marshal pay args: %v", err))
	}
	return s.handlePay(ctx, raw)
}

// ---------------------------------------------------------------------------
// t402/wdk/swap, t402/wdk/quoteSwap, t402/wdk/executeSwap — honest stubs
// ---------------------------------------------------------------------------

const swapNotSupportedMsg = `swap is not supported in the Go SDK.

The Go SDK has no equivalent to @tetherto/wdk and does not bundle a
multi-chain DEX aggregator. For swap workflows, use the TypeScript SDK
(@t402/mcp) which integrates with Tether WDK via wdk-swap-jupiter (SVM)
and @tetherto/wdk-protocol-swap-velora-evm (EVM).

The wdk/swap, wdk/quoteSwap, and wdk/executeSwap tool schemas are
exposed in the Go MCP server for cross-SDK parity at the tool-discovery
level, but the handlers return this error until a native swap adapter
is added.`

// handleWdkSwap handles the t402/wdk/swap tool — schema-only stub.
func (s *Server) handleWdkSwap(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(swapNotSupportedMsg)
}

// handleWdkQuoteSwap handles the t402/wdk/quoteSwap tool — schema-only stub.
func (s *Server) handleWdkQuoteSwap(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(swapNotSupportedMsg)
}

// handleWdkExecuteSwap handles the t402/wdk/executeSwap tool — schema-only stub.
func (s *Server) handleWdkExecuteSwap(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(swapNotSupportedMsg)
}

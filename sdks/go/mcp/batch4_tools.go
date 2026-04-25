package mcp

// Phase C Batch 4 (2026-04-25): seven additional MCP tools to bring
// Go SDK parity with TypeScript to 28/33 tool names. Mix of fully
// functional tools and honest stubs — see per-tool comments.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ---------------------------------------------------------------------------
// t402/searchBazaar  — full implementation
// ---------------------------------------------------------------------------

const defaultBazaarURL = "https://bazaar.t402.io/api/v1"

// handleSearchBazaar handles the t402/searchBazaar tool.
//
// Calls the public bazaar service when reachable, falls back to a small
// curated demo set when not. Schema and demo data mirror the TS impl
// so cross-SDK behavior is identical.
func (s *Server) handleSearchBazaar(ctx context.Context, args json.RawMessage) *ToolResult {
	var input SearchBazaarInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if input.Query == "" {
		return errorResult("query must not be empty")
	}

	// Build query string
	q := url.Values{}
	q.Set("q", input.Query)
	if input.Category != "" {
		q.Set("category", input.Category)
	}
	if input.MaxPrice != "" {
		q.Set("maxPrice", input.MaxPrice)
	}
	if input.Network != "" {
		q.Set("network", input.Network)
	}
	if input.Token != "" {
		q.Set("token", input.Token)
	}
	if input.Tags != "" {
		q.Set("tags", input.Tags)
	}

	endpoint := fmt.Sprintf("%s/search?%s", defaultBazaarURL, q.Encode())
	services := fetchBazaarServices(ctx, endpoint)
	if services == nil {
		services = bazaarDemoResults(input.Query)
	}

	if len(services) == 0 {
		return textResult("No services found.")
	}
	lines := []string{"## Bazaar Results", ""}
	for _, svc := range services {
		amount := svc.Price.Amount
		if val, ok := new(big.Int).SetString(amount, 10); ok {
			// Display human-readable value (assumes 6-decimal token).
			f := new(big.Float).Quo(new(big.Float).SetInt(val), big.NewFloat(1e6))
			amount = f.Text('f', 4)
		}
		lines = append(lines,
			fmt.Sprintf("• **%s** — %s", svc.Name, svc.Description),
			fmt.Sprintf("  URL: %s", svc.URL),
			fmt.Sprintf("  Price: %s %s on %s", amount, svc.Price.Token, svc.Price.Network),
		)
		if len(svc.Tags) > 0 {
			lines = append(lines, fmt.Sprintf("  Tags: %s", strings.Join(svc.Tags, ", ")))
		}
		lines = append(lines, "")
	}
	return textResult(strings.Join(lines, "\n"))
}

// fetchBazaarServices returns nil on any failure so the caller can fall
// back to demo results without a separate error path.
func fetchBazaarServices(ctx context.Context, endpoint string) []BazaarService {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	var data struct {
		Services []BazaarService `json:"services"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}
	return data.Services
}

// bazaarDemoResults mirrors the TS demo table.
func bazaarDemoResults(query string) []BazaarService {
	q := strings.ToLower(query)
	all := []BazaarService{
		{
			URL:         "https://api.weather402.com/forecast",
			Name:        "Weather Forecast API",
			Description: "Global weather data with hourly resolution, 7-day forecast",
			Category:    "data",
			Price:       BazaarPrice{Amount: "1000", Token: "USDC", Network: "eip155:8453"},
			Methods:     []string{"GET"},
		},
		{
			URL:         "https://api.llm402.com/v1/chat/completions",
			Name:        "LLM Inference API",
			Description: "Pay-per-request access to GPT-4, Claude, and open models",
			Category:    "ai",
			Price:       BazaarPrice{Amount: "5000", Token: "USDC", Network: "eip155:8453"},
			Methods:     []string{"POST"},
		},
		{
			URL:         "https://api.market402.com/report",
			Name:        "DeFi Market Intelligence",
			Description: "Weekly DeFi market analysis with trading signals and risk metrics",
			Category:    "reports",
			Price:       BazaarPrice{Amount: "50000", Token: "USDT0", Network: "eip155:42161"},
			Methods:     []string{"GET"},
		},
		{
			URL:         "https://api.image402.com/generate",
			Name:        "Image Generation API",
			Description: "High-res image generation via Stable Diffusion XL and Flux",
			Category:    "ai",
			Price:       BazaarPrice{Amount: "2000", Token: "USDC", Network: "eip155:8453"},
			Methods:     []string{"POST"},
		},
		{
			URL:         "https://api.compute402.com/gpu/run",
			Name:        "GPU Compute Service",
			Description: "On-demand GPU compute for ML inference (A100, H100)",
			Category:    "compute",
			Price:       BazaarPrice{Amount: "100000", Token: "USDT0", Network: "eip155:42161"},
			Methods:     []string{"POST"},
		},
	}
	out := []BazaarService{}
	for _, s := range all {
		if strings.Contains(strings.ToLower(s.Name), q) ||
			strings.Contains(strings.ToLower(s.Description), q) ||
			strings.Contains(strings.ToLower(s.Category), q) {
			out = append(out, s)
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// t402/payForService  — honest stub
// ---------------------------------------------------------------------------

const payForServiceStubMsg = `payForService is not implemented in the Go SDK.

This tool needs the same auto-pay orchestration as t402/autoPay (fetch
URL, detect 402, sign payment, retry) and the Go SDK does not yet have
the WDK-level wallet abstraction those flows expect.

For now use the TypeScript SDK (@t402/mcp), which composes pay/wdkTransfer
with the 402 handshake out of the box. The schema is exposed here so
agents that switch SDKs do not need to update their tool catalogue.`

// handlePayForService handles the t402/payForService tool — schema-only stub.
func (s *Server) handlePayForService(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(payForServiceStubMsg)
}

// ---------------------------------------------------------------------------
// t402/autoPay  — honest stub
// ---------------------------------------------------------------------------

const autoPayStubMsg = `autoPay is not implemented in the Go SDK.

autoPay performs a multi-step orchestration (fetch → 402 detect →
balance check → sign → retry) that depends on a WDK-style wallet
abstraction. Until Go has that layer, agents should compose the
existing primitives manually:
  1. fetch the resource URL with any HTTP client
  2. on 402, parse the X-Payment-Required header
  3. call t402/wdk/transfer with the amount/recipient/chain
  4. retry the original request with X-Payment header

The TS SDK does this in one call. Schema is exposed here for cross-SDK
discovery parity only.`

func (s *Server) handleAutoPay(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(autoPayStubMsg)
}

// ---------------------------------------------------------------------------
// t402/erc8004/* — three honest stubs
// ---------------------------------------------------------------------------

const erc8004StubMsg = `ERC-8004 agent identity tools are not implemented in the Go SDK.

Agent identity resolution, wallet verification, and reputation lookup
all require the @t402/erc8004 helper functions (resolveAgent,
verifyPayToMatchesAgent, getReputationSummary) which are TS-only at the
moment. Porting them to Go would mean shipping the ERC-8004 contract
ABI bindings — useful future work, but out of scope for this batch.

Use the TypeScript SDK (@t402/mcp) for ERC-8004 flows. Schemas are
exposed here for cross-SDK discovery parity.`

func (s *Server) handleErc8004ResolveAgent(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(erc8004StubMsg)
}
func (s *Server) handleErc8004VerifyWallet(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(erc8004StubMsg)
}
func (s *Server) handleErc8004CheckReputation(_ context.Context, _ json.RawMessage) *ToolResult {
	return errorResult(erc8004StubMsg)
}

// ---------------------------------------------------------------------------
// t402/getTransferHistory  — full implementation
// ---------------------------------------------------------------------------

// transferEventSig is the keccak256 of "Transfer(address,address,uint256)".
var transferEventSig = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

const defaultTransferHistoryLimit = 10
const maxTransferHistoryLimit = 100

// handleGetTransferHistory handles the t402/getTransferHistory tool.
//
// Queries Transfer events for the configured ERC-20 stablecoins on the
// given network where the address appears as either sender or receiver,
// then merges and limits the results. The block range is hard-capped to
// the most recent 10k blocks to keep the call cheap on public RPCs.
func (s *Server) handleGetTransferHistory(
	ctx context.Context, args json.RawMessage,
) *ToolResult {
	var input GetTransferHistoryInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}
	if !IsValidNetwork(input.Network) {
		return errorResult(fmt.Sprintf("Invalid network: %s", input.Network))
	}
	if input.Address == "" {
		return errorResult("address must not be empty")
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultTransferHistoryLimit
	}
	if limit > maxTransferHistoryLimit {
		limit = maxTransferHistoryLimit
	}

	if s.config != nil && s.config.DemoMode {
		return textResult(formatTransferHistoryDemo(input.Network, input.Address, limit))
	}

	network := SupportedNetwork(input.Network)
	client, err := ethclient.DialContext(ctx, GetRPCURL(s.config, network))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect to %s: %v", input.Network, err))
	}
	defer client.Close()

	latest, err := client.BlockNumber(ctx)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to fetch block number: %v", err))
	}
	const blockRange = 10_000
	var fromBlock uint64
	if latest > blockRange {
		fromBlock = latest - blockRange
	}

	tokens := []SupportedToken{TokenUSDC, TokenUSDT, TokenUSDT0}
	if input.Token != "" {
		tokens = []SupportedToken{SupportedToken(input.Token)}
	}

	addr := common.HexToAddress(input.Address)
	addrTopic := common.BytesToHash(common.LeftPadBytes(addr.Bytes(), 32))

	events := []transferRecord{}
	for _, token := range tokens {
		tokenAddr, ok := GetTokenAddress(network, token)
		if !ok {
			continue
		}
		tokenContract := common.HexToAddress(tokenAddr)

		for _, position := range []int{1, 2} { // 1 = from, 2 = to
			topics := [][]common.Hash{
				{transferEventSig},
				nil,
				nil,
			}
			topics[position] = []common.Hash{addrTopic}

			query := ethereum.FilterQuery{
				FromBlock: new(big.Int).SetUint64(fromBlock),
				ToBlock:   new(big.Int).SetUint64(latest),
				Addresses: []common.Address{tokenContract},
				Topics:    topics,
			}
			logs, err := client.FilterLogs(ctx, query)
			if err != nil {
				continue
			}
			for _, lg := range logs {
				events = append(events, transferRecordFromLog(lg, string(token), input.Network))
			}
		}
	}

	// Sort newest-first by block number then log index.
	sortTransfersDesc(events)
	if len(events) > limit {
		events = events[:limit]
	}

	return textResult(formatTransferHistory(input.Address, input.Network, events))
}

type transferRecord struct {
	Token       string
	Network     string
	From        string
	To          string
	Amount      *big.Int
	BlockNumber uint64
	TxHash      string
	LogIndex    uint
}

func transferRecordFromLog(lg types.Log, token, network string) transferRecord {
	from := common.BytesToAddress(lg.Topics[1].Bytes()).Hex()
	to := common.BytesToAddress(lg.Topics[2].Bytes()).Hex()
	amount := new(big.Int).SetBytes(lg.Data)
	return transferRecord{
		Token:       token,
		Network:     network,
		From:        from,
		To:          to,
		Amount:      amount,
		BlockNumber: lg.BlockNumber,
		TxHash:      lg.TxHash.Hex(),
		LogIndex:    lg.Index,
	}
}

// sortTransfersDesc sorts by (BlockNumber, LogIndex) descending.
// Inline sort to avoid pulling in a comparison helper.
func sortTransfersDesc(rs []transferRecord) {
	for i := 1; i < len(rs); i++ {
		for j := i; j > 0; j-- {
			a, b := rs[j-1], rs[j]
			less := a.BlockNumber < b.BlockNumber ||
				(a.BlockNumber == b.BlockNumber && a.LogIndex < b.LogIndex)
			if less {
				rs[j-1], rs[j] = b, a
			} else {
				break
			}
		}
	}
}

func formatTransferHistory(address, network string, rs []transferRecord) string {
	if len(rs) == 0 {
		return fmt.Sprintf("## Transfer History\n\nNo transfers found for %s on %s in the last 10,000 blocks.", address, network)
	}
	lines := []string{
		fmt.Sprintf("## Transfer History — %s on %s", address, network),
		"",
		fmt.Sprintf("Showing %d most recent transfers (latest 10,000 blocks):", len(rs)),
		"",
	}
	for _, r := range rs {
		amount := new(big.Float).Quo(new(big.Float).SetInt(r.Amount), big.NewFloat(1e6))
		direction := "→"
		other := r.To
		if strings.EqualFold(r.From, address) {
			direction = "↗"
		} else if strings.EqualFold(r.To, address) {
			direction = "↘"
			other = r.From
		}
		lines = append(lines,
			fmt.Sprintf("- %s %s %s %s  (block %d, tx `%s`)",
				direction, amount.Text('f', 4), r.Token, other, r.BlockNumber, r.TxHash),
		)
	}
	return strings.Join(lines, "\n")
}

func formatTransferHistoryDemo(network, address string, limit int) string {
	return strings.Join([]string{
		fmt.Sprintf("## Transfer History — %s on %s [demo]", address, network),
		"",
		"_Demo mode — no RPC was queried._",
		"",
		fmt.Sprintf("Would have returned up to %d most recent ERC-20 transfers in the last 10,000 blocks.", limit),
	}, "\n")
}

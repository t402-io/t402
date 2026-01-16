package bridge

import (
	"context"
	"math/big"
)

// RouteStrategy defines the strategy for selecting the best bridge route.
type RouteStrategy string

const (
	// StrategyCheapest selects the route with the lowest native fee.
	StrategyCheapest RouteStrategy = "cheapest"
	// StrategyFastest selects the route with the shortest estimated time.
	StrategyFastest RouteStrategy = "fastest"
	// StrategyPreferred selects the preferred source chain if available.
	StrategyPreferred RouteStrategy = "preferred"
)

// SmartChainBalance contains balance information for a single chain.
type SmartChainBalance struct {
	// Chain is the chain name (e.g., "ethereum", "arbitrum").
	Chain string
	// USDT0Balance is the USDT0 token balance (6 decimals).
	USDT0Balance *big.Int
	// NativeBalance is the native token balance (in wei).
	NativeBalance *big.Int
	// CanBridge indicates if the chain has sufficient balance and gas for bridging.
	CanBridge bool
}

// BalanceSummary contains aggregated balance information across all chains.
type BalanceSummary struct {
	// Balances is the list of per-chain balances.
	Balances []SmartChainBalance
	// TotalUSDT0 is the total USDT0 balance across all chains.
	TotalUSDT0 *big.Int
	// BridgeableChains is the list of chains that can bridge.
	BridgeableChains []string
}

// BridgeRoute represents a potential bridge route from one chain to another.
type BridgeRoute struct {
	// FromChain is the source chain name.
	FromChain string
	// ToChain is the destination chain name.
	ToChain string
	// NativeFee is the estimated native token fee for bridging (in wei).
	NativeFee *big.Int
	// EstimatedTime is the estimated completion time in seconds.
	EstimatedTime int
	// Available indicates if this route is currently available.
	Available bool
	// UnavailableReason explains why the route is unavailable (if not available).
	UnavailableReason string
	// AvailableAmount is the maximum amount that can be bridged on this route.
	AvailableAmount *big.Int
}

// AutoBridgeParams contains parameters for automatic bridge routing.
type AutoBridgeParams struct {
	// ToChain is the destination chain name.
	ToChain string
	// Amount is the amount to bridge (6 decimals for USDT0).
	Amount *big.Int
	// Recipient is the address on destination chain to receive funds.
	Recipient string
	// PreferredSourceChain is the preferred source chain (for StrategyPreferred).
	PreferredSourceChain string
	// SlippageTolerance is the slippage tolerance percentage (default: 0.5).
	SlippageTolerance float64
	// Strategy is the route selection strategy (default: StrategyCheapest).
	Strategy RouteStrategy
}

// SmartBridgeResult contains the result of a smart bridge operation.
type SmartBridgeResult struct {
	BridgeResult
	// SelectedRoute is the route that was selected for bridging.
	SelectedRoute *BridgeRoute
	// Strategy is the strategy used for route selection.
	Strategy RouteStrategy
}

// MultiChainSigner defines the interface for signing operations across multiple chains.
type MultiChainSigner interface {
	// GetAddress returns the signer's address (same across all EVM chains).
	GetAddress() string

	// GetConfiguredChains returns the list of configured chain names.
	GetConfiguredChains() []string

	// IsChainConfigured checks if a chain is configured.
	IsChainConfigured(chain string) bool

	// GetBridgeSigner returns a BridgeSigner for a specific chain.
	GetBridgeSigner(chain string) (BridgeSigner, error)

	// GetNativeBalance returns the native token balance for a chain.
	GetNativeBalance(ctx context.Context, chain string) (*big.Int, error)

	// GetUSDT0Balance returns the USDT0 token balance for a chain.
	GetUSDT0Balance(ctx context.Context, chain string) (*big.Int, error)
}

// SmartBridgeRouter defines the interface for smart cross-chain bridge routing.
type SmartBridgeRouter interface {
	// GetBalances retrieves USDT0 and native balances across all configured chains.
	GetBalances(ctx context.Context) (*BalanceSummary, error)

	// GetRoutes evaluates all possible routes to bridge to a destination chain.
	GetRoutes(ctx context.Context, toChain string, amount *big.Int) ([]BridgeRoute, error)

	// SelectBestRoute selects the best route based on strategy.
	SelectBestRoute(routes []BridgeRoute, strategy RouteStrategy, preferredChain string) *BridgeRoute

	// AutoBridge automatically selects the best route and executes the bridge.
	AutoBridge(ctx context.Context, params *AutoBridgeParams) (*SmartBridgeResult, error)

	// Bridge executes a bridge transaction for a specific route.
	Bridge(ctx context.Context, params *BridgeExecuteParams) (*BridgeResult, error)

	// TrackMessage retrieves the current status of a LayerZero message.
	TrackMessage(ctx context.Context, messageGUID string) (*LayerZeroMessage, error)

	// WaitForDelivery waits for a message to be delivered on the destination chain.
	WaitForDelivery(ctx context.Context, messageGUID string, opts *WaitForDeliveryOptions) (*LayerZeroMessage, error)
}

// SmartRouterConfig contains configuration options for SmartBridgeRouter.
type SmartRouterConfig struct {
	// DefaultStrategy is the default route selection strategy.
	DefaultStrategy RouteStrategy
	// MinNativeBalance is the minimum native balance required for bridging (in wei).
	// Routes with insufficient native balance will be marked unavailable.
	MinNativeBalance *big.Int
}

// DefaultSmartRouterConfig returns a default configuration.
func DefaultSmartRouterConfig() *SmartRouterConfig {
	return &SmartRouterConfig{
		DefaultStrategy:  StrategyCheapest,
		MinNativeBalance: big.NewInt(1000000000000000), // 0.001 ETH default
	}
}

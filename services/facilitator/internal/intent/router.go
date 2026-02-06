package intent

import (
	"context"
	"fmt"
	"math/big"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RouterConfig holds configuration for the route finder
type RouterConfig struct {
	// DefaultRouteValidity is how long a route quote is valid
	DefaultRouteValidity time.Duration
	// MaxRoutes is the maximum number of routes to return
	MaxRoutes int
	// MinScore is the minimum acceptable route score
	MinScore float64
	// PreferNativeAsset prefers routes using native assets
	PreferNativeAsset bool
}

// DefaultRouterConfig returns default router configuration
func DefaultRouterConfig() *RouterConfig {
	return &RouterConfig{
		DefaultRouteValidity: 5 * time.Minute,
		MaxRoutes:            5,
		MinScore:             0.5,
		PreferNativeAsset:    true,
	}
}

// NetworkProvider provides information about supported networks
type NetworkProvider interface {
	GetSupportedNetworks() []string
	GetNetworkConfig(network string) (*NetworkConfig, error)
	GetAssetAddress(network, asset string) (string, error)
	GetAssetDecimals(network, asset string) (int, error)
}

// GasEstimator estimates gas costs
type GasEstimator interface {
	EstimateGas(ctx context.Context, network string, txType string) (string, error)
	GetGasPrice(ctx context.Context, network string) (string, error)
}

// BridgeProvider provides bridge quotes
type BridgeProvider interface {
	GetQuote(ctx context.Context, fromNetwork, toNetwork, asset, amount string) (*BridgeQuote, error)
	GetSupportedBridges(fromNetwork, toNetwork string) []string
}

// BalanceChecker checks wallet balances
type BalanceChecker interface {
	GetBalance(ctx context.Context, network, address, asset string) (string, error)
}

// RouteStats tracks success/failure statistics for routes
type RouteStats struct {
	SuccessCount int64
	FailureCount int64
	LastFailure  time.Time
}

// Router finds and scores routes for payment intents
type Router struct {
	config          *RouterConfig
	networkProvider NetworkProvider
	gasEstimator    GasEstimator
	bridgeProvider  BridgeProvider
	balanceChecker  BalanceChecker

	// P1-9: Track route reliability to penalize failed paths
	routeStats    map[string]*RouteStats // key: "protocol:sourceNetwork:targetNetwork"
	routeStatsMu  sync.RWMutex
}

// NewRouter creates a new route finder
func NewRouter(
	config *RouterConfig,
	networkProvider NetworkProvider,
	gasEstimator GasEstimator,
	bridgeProvider BridgeProvider,
	balanceChecker BalanceChecker,
) *Router {
	if config == nil {
		config = DefaultRouterConfig()
	}
	return &Router{
		config:          config,
		networkProvider: networkProvider,
		gasEstimator:    gasEstimator,
		bridgeProvider:  bridgeProvider,
		balanceChecker:  balanceChecker,
		routeStats:      make(map[string]*RouteStats),
	}
}

// FindRoutes finds all possible routes for an intent
func (r *Router) FindRoutes(ctx context.Context, intent *Intent) ([]*Route, error) {
	var routes []*Route

	// Determine source networks to check
	sourceNetworks := intent.SourceNetworks
	if len(sourceNetworks) == 0 {
		sourceNetworks = r.networkProvider.GetSupportedNetworks()
	}

	// Determine target network
	targetNetwork := intent.TargetNetwork
	if targetNetwork == "" {
		// If no target specified, use the same as source (single-chain)
		// or find the best target network
		targetNetwork = r.findBestTargetNetwork(ctx, intent)
	}

	for _, sourceNetwork := range sourceNetworks {
		// Find direct routes (same network)
		if sourceNetwork == targetNetwork || targetNetwork == "" {
			directRoute, err := r.findDirectRoute(ctx, intent, sourceNetwork)
			if err == nil && directRoute != nil {
				routes = append(routes, directRoute)
			}
		}

		// Find cross-chain routes if networks differ
		if sourceNetwork != targetNetwork && targetNetwork != "" {
			crossChainRoutes, err := r.findCrossChainRoutes(ctx, intent, sourceNetwork, targetNetwork)
			if err == nil {
				routes = append(routes, crossChainRoutes...)
			}
		}
	}

	// Score and sort routes
	for _, route := range routes {
		route.Score = r.scoreRoute(route, intent)
	}

	sort.Slice(routes, func(i, j int) bool {
		return routes[i].Score > routes[j].Score
	})

	// Filter by minimum score
	filtered := make([]*Route, 0, len(routes))
	for _, route := range routes {
		if route.Score >= r.config.MinScore {
			filtered = append(filtered, route)
		}
	}

	// Limit number of routes
	if len(filtered) > r.config.MaxRoutes {
		filtered = filtered[:r.config.MaxRoutes]
	}

	return filtered, nil
}

// findDirectRoute finds a direct route on a single network
func (r *Router) findDirectRoute(ctx context.Context, intent *Intent, network string) (*Route, error) {
	// Get asset address
	assetAddr, err := r.networkProvider.GetAssetAddress(network, intent.Asset)
	if err != nil {
		return nil, fmt.Errorf("asset not found on network: %w", err)
	}

	// Get network config for timing
	netConfig, err := r.networkProvider.GetNetworkConfig(network)
	if err != nil {
		return nil, fmt.Errorf("failed to get network config: %w", err)
	}

	// Estimate gas
	gasEstimate := "0"
	if r.gasEstimator != nil {
		gasEstimate, _ = r.gasEstimator.EstimateGas(ctx, network, "transfer")
	}

	// Calculate estimated time (2 confirmations)
	estimatedTime := int64(netConfig.AvgBlockTime * float64(netConfig.Confirmations+1))

	route := &Route{
		ID:             uuid.New().String(),
		SourceNetwork:  network,
		TargetNetwork:  network,
		SourceAsset:    assetAddr,
		TargetAsset:    assetAddr,
		InputAmount:    intent.Amount,
		OutputAmount:   intent.Amount, // No slippage for direct transfer
		EstimatedGas:   gasEstimate,
		EstimatedTime:  estimatedTime,
		Slippage:       0,
		RequiresBridge: false,
		ValidUntil:     time.Now().Add(r.config.DefaultRouteValidity),
		Steps: []*RouteStep{
			{
				Order:       1,
				Type:        StepTypeTransfer,
				Network:     network,
				FromAsset:   assetAddr,
				ToAsset:     assetAddr,
				FromAmount:  intent.Amount,
				ToAmount:    intent.Amount,
				GasEstimate: gasEstimate,
			},
		},
	}

	return route, nil
}

// findCrossChainRoutes finds routes involving bridging
func (r *Router) findCrossChainRoutes(ctx context.Context, intent *Intent, sourceNetwork, targetNetwork string) ([]*Route, error) {
	if r.bridgeProvider == nil {
		return nil, nil
	}

	var routes []*Route

	// Get bridge quotes
	quote, err := r.bridgeProvider.GetQuote(ctx, sourceNetwork, targetNetwork, intent.Asset, intent.Amount)
	if err != nil {
		return nil, err
	}

	// Get asset addresses
	sourceAsset, err := r.networkProvider.GetAssetAddress(sourceNetwork, intent.Asset)
	if err != nil {
		return nil, err
	}
	targetAsset, err := r.networkProvider.GetAssetAddress(targetNetwork, intent.Asset)
	if err != nil {
		return nil, err
	}

	// Calculate slippage
	inputAmount := new(big.Int)
	inputAmount.SetString(intent.Amount, 10)
	outputAmount := new(big.Int)
	outputAmount.SetString(quote.OutputAmount, 10)

	slippage := float64(0)
	if inputAmount.Sign() > 0 {
		diff := new(big.Int).Sub(inputAmount, outputAmount)
		diffFloat := new(big.Float).SetInt(diff)
		inputFloat := new(big.Float).SetInt(inputAmount)
		slippageFloat := new(big.Float).Quo(diffFloat, inputFloat)
		slippage, _ = slippageFloat.Float64()
	}

	// Check slippage tolerance
	if slippage > intent.MaxSlippage {
		return nil, fmt.Errorf("slippage %f exceeds max %f", slippage, intent.MaxSlippage)
	}

	route := &Route{
		ID:             uuid.New().String(),
		SourceNetwork:  sourceNetwork,
		TargetNetwork:  targetNetwork,
		SourceAsset:    sourceAsset,
		TargetAsset:    targetAsset,
		InputAmount:    intent.Amount,
		OutputAmount:   quote.OutputAmount,
		EstimatedGas:   quote.Fee,
		EstimatedTime:  quote.EstimatedTime,
		Slippage:       slippage,
		RequiresBridge: true,
		BridgeProtocol: quote.Protocol,
		ValidUntil:     quote.ValidUntil,
		Steps: []*RouteStep{
			{
				Order:      1,
				Type:       StepTypeBridge,
				Network:    sourceNetwork,
				Protocol:   quote.Protocol,
				FromAsset:  sourceAsset,
				ToAsset:    targetAsset,
				FromAmount: intent.Amount,
				ToAmount:   quote.OutputAmount,
			},
		},
	}

	routes = append(routes, route)

	return routes, nil
}

// scoreRoute calculates a score for a route based on various factors
func (r *Router) scoreRoute(route *Route, intent *Intent) float64 {
	score := 1.0

	// Factor 1: Slippage (lower is better)
	// Max penalty of 0.3 for slippage at max tolerance
	if intent.MaxSlippage > 0 {
		slippageRatio := route.Slippage / intent.MaxSlippage
		score -= slippageRatio * 0.3
	}

	// Factor 2: Speed (faster is better for high priority)
	// Normalize time to 0-1 range (assuming max 1 hour = 3600 seconds)
	normalizedTime := float64(route.EstimatedTime) / 3600.0
	if normalizedTime > 1.0 {
		normalizedTime = 1.0
	}

	switch intent.Priority {
	case PriorityUrgent:
		score -= normalizedTime * 0.4
	case PriorityHigh:
		score -= normalizedTime * 0.3
	case PriorityNormal:
		score -= normalizedTime * 0.2
	case PriorityLow:
		score -= normalizedTime * 0.1
	}

	// Factor 3: Complexity (fewer steps is better)
	stepPenalty := float64(len(route.Steps)-1) * 0.05
	score -= stepPenalty

	// Factor 4: Bridge risk (direct routes preferred)
	if route.RequiresBridge {
		score -= 0.1
	}

	// Factor 5: Gas cost
	if intent.MaxGasCost != "" && route.EstimatedGas != "" {
		maxGas := new(big.Int)
		maxGas.SetString(intent.MaxGasCost, 10)
		estimatedGas := new(big.Int)
		estimatedGas.SetString(route.EstimatedGas, 10)

		if maxGas.Sign() > 0 && estimatedGas.Cmp(maxGas) > 0 {
			// Over budget, significant penalty
			score -= 0.5
		} else if maxGas.Sign() > 0 {
			gasRatio := new(big.Float).Quo(
				new(big.Float).SetInt(estimatedGas),
				new(big.Float).SetInt(maxGas),
			)
			ratio, _ := gasRatio.Float64()
			score -= ratio * 0.1
		}
	}

	// P1-9: Factor 6: Historical reliability (penalize routes with high failure rate)
	if route.RequiresBridge && route.BridgeProtocol != "" {
		statsKey := fmt.Sprintf("%s:%s:%s", route.BridgeProtocol, route.SourceNetwork, route.TargetNetwork)
		r.routeStatsMu.RLock()
		stats := r.routeStats[statsKey]
		r.routeStatsMu.RUnlock()

		if stats != nil {
			total := stats.SuccessCount + stats.FailureCount
			if total >= 5 { // Only apply penalty if we have enough data
				failureRate := float64(stats.FailureCount) / float64(total)
				// Apply penalty based on failure rate (max 0.3 penalty for 100% failure)
				score -= failureRate * 0.3

				// Additional penalty for recent failures (within last hour)
				if time.Since(stats.LastFailure) < time.Hour {
					score -= 0.1
				}
			}
		}
	}

	// Ensure score is between 0 and 1
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}

	return score
}

// P1-9: RecordRouteSuccess records a successful route execution
func (r *Router) RecordRouteSuccess(route *Route) {
	if route == nil || !route.RequiresBridge || route.BridgeProtocol == "" {
		return
	}

	statsKey := fmt.Sprintf("%s:%s:%s", route.BridgeProtocol, route.SourceNetwork, route.TargetNetwork)
	r.routeStatsMu.Lock()
	defer r.routeStatsMu.Unlock()

	stats := r.routeStats[statsKey]
	if stats == nil {
		stats = &RouteStats{}
		r.routeStats[statsKey] = stats
	}
	stats.SuccessCount++
}

// P1-9: RecordRouteFailure records a failed route execution
func (r *Router) RecordRouteFailure(route *Route) {
	if route == nil || !route.RequiresBridge || route.BridgeProtocol == "" {
		return
	}

	statsKey := fmt.Sprintf("%s:%s:%s", route.BridgeProtocol, route.SourceNetwork, route.TargetNetwork)
	r.routeStatsMu.Lock()
	defer r.routeStatsMu.Unlock()

	stats := r.routeStats[statsKey]
	if stats == nil {
		stats = &RouteStats{}
		r.routeStats[statsKey] = stats
	}
	stats.FailureCount++
	stats.LastFailure = time.Now()
}

// P1-9: GetRouteStats returns reliability statistics for a route
func (r *Router) GetRouteStats(protocol, sourceNetwork, targetNetwork string) *RouteStats {
	statsKey := fmt.Sprintf("%s:%s:%s", protocol, sourceNetwork, targetNetwork)
	r.routeStatsMu.RLock()
	defer r.routeStatsMu.RUnlock()
	return r.routeStats[statsKey]
}

// findBestTargetNetwork determines the best target network when not specified
func (r *Router) findBestTargetNetwork(ctx context.Context, intent *Intent) string {
	// If source networks specified, prefer the first one
	if len(intent.SourceNetworks) > 0 {
		return intent.SourceNetworks[0]
	}

	// Otherwise use the first supported network
	networks := r.networkProvider.GetSupportedNetworks()
	if len(networks) > 0 {
		return networks[0]
	}

	return ""
}

// GetRecommendedRoute returns the best route from a list
func (r *Router) GetRecommendedRoute(routes []*Route) *Route {
	if len(routes) == 0 {
		return nil
	}
	// Routes are already sorted by score, so return the first one
	return routes[0]
}

// ValidateRoute checks if a route is still valid
func (r *Router) ValidateRoute(route *Route) error {
	if route == nil {
		return ErrNoRouteSelected
	}

	if time.Now().After(route.ValidUntil) {
		return ErrRouteExpired
	}

	return nil
}

// RefreshRoute refreshes a route quote
func (r *Router) RefreshRoute(ctx context.Context, intent *Intent, route *Route) (*Route, error) {
	if route.RequiresBridge {
		// Get fresh bridge quote
		quote, err := r.bridgeProvider.GetQuote(ctx, route.SourceNetwork, route.TargetNetwork, intent.Asset, intent.Amount)
		if err != nil {
			return nil, err
		}

		// Update route with new quote
		route.OutputAmount = quote.OutputAmount
		route.EstimatedGas = quote.Fee
		route.EstimatedTime = quote.EstimatedTime
		route.ValidUntil = quote.ValidUntil

		// Recalculate slippage
		inputAmount := new(big.Int)
		inputAmount.SetString(intent.Amount, 10)
		outputAmount := new(big.Int)
		outputAmount.SetString(quote.OutputAmount, 10)

		if inputAmount.Sign() > 0 {
			diff := new(big.Int).Sub(inputAmount, outputAmount)
			diffFloat := new(big.Float).SetInt(diff)
			inputFloat := new(big.Float).SetInt(inputAmount)
			slippageFloat := new(big.Float).Quo(diffFloat, inputFloat)
			route.Slippage, _ = slippageFloat.Float64()
		}
	} else {
		// Just extend validity for direct routes
		route.ValidUntil = time.Now().Add(r.config.DefaultRouteValidity)
	}

	// Rescore
	route.Score = r.scoreRoute(route, intent)

	return route, nil
}

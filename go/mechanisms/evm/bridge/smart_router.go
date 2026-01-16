package bridge

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"sync"
)

// smartBridgeRouter implements the SmartBridgeRouter interface.
type smartBridgeRouter struct {
	signer     MultiChainSigner
	config     *SmartRouterConfig
	scanClient *LayerZeroScanClient

	// Lazy-loaded bridges per chain
	bridges   map[string]*Usdt0Bridge
	bridgeMu  sync.RWMutex
}

// NewSmartBridgeRouter creates a new SmartBridgeRouter.
func NewSmartBridgeRouter(signer MultiChainSigner, config *SmartRouterConfig) (SmartBridgeRouter, error) {
	if signer == nil {
		return nil, fmt.Errorf("signer is required")
	}

	if config == nil {
		config = DefaultSmartRouterConfig()
	}

	return &smartBridgeRouter{
		signer:     signer,
		config:     config,
		scanClient: NewLayerZeroScanClient(),
		bridges:    make(map[string]*Usdt0Bridge),
	}, nil
}

// GetBalances retrieves USDT0 and native balances across all configured chains.
func (r *smartBridgeRouter) GetBalances(ctx context.Context) (*BalanceSummary, error) {
	chains := r.signer.GetConfiguredChains()

	// Filter to only bridgeable chains
	var bridgeableChains []string
	for _, chain := range chains {
		if SupportsBridging(chain) {
			bridgeableChains = append(bridgeableChains, chain)
		}
	}

	if len(bridgeableChains) == 0 {
		return &BalanceSummary{
			Balances:         []SmartChainBalance{},
			TotalUSDT0:       big.NewInt(0),
			BridgeableChains: []string{},
		}, nil
	}

	// Concurrently fetch balances for all chains
	type balanceResult struct {
		chain         string
		usdt0Balance  *big.Int
		nativeBalance *big.Int
		err           error
	}

	results := make(chan balanceResult, len(bridgeableChains))
	var wg sync.WaitGroup

	for _, chain := range bridgeableChains {
		wg.Add(1)
		go func(c string) {
			defer wg.Done()

			usdt0, err := r.signer.GetUSDT0Balance(ctx, c)
			if err != nil {
				results <- balanceResult{chain: c, err: err}
				return
			}

			native, err := r.signer.GetNativeBalance(ctx, c)
			if err != nil {
				results <- balanceResult{chain: c, err: err}
				return
			}

			results <- balanceResult{
				chain:         c,
				usdt0Balance:  usdt0,
				nativeBalance: native,
			}
		}(chain)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	balances := make([]SmartChainBalance, 0, len(bridgeableChains))
	totalUSDT0 := big.NewInt(0)
	var canBridgeChains []string

	for result := range results {
		if result.err != nil {
			// Log error but continue with other chains
			balances = append(balances, SmartChainBalance{
				Chain:         result.chain,
				USDT0Balance:  big.NewInt(0),
				NativeBalance: big.NewInt(0),
				CanBridge:     false,
			})
			continue
		}

		canBridge := result.usdt0Balance.Sign() > 0 &&
			result.nativeBalance.Cmp(r.config.MinNativeBalance) >= 0

		balances = append(balances, SmartChainBalance{
			Chain:         result.chain,
			USDT0Balance:  result.usdt0Balance,
			NativeBalance: result.nativeBalance,
			CanBridge:     canBridge,
		})

		totalUSDT0.Add(totalUSDT0, result.usdt0Balance)
		if canBridge {
			canBridgeChains = append(canBridgeChains, result.chain)
		}
	}

	return &BalanceSummary{
		Balances:         balances,
		TotalUSDT0:       totalUSDT0,
		BridgeableChains: canBridgeChains,
	}, nil
}

// GetRoutes evaluates all possible routes to bridge to a destination chain.
func (r *smartBridgeRouter) GetRoutes(ctx context.Context, toChain string, amount *big.Int) ([]BridgeRoute, error) {
	toChain = strings.ToLower(toChain)

	if !SupportsBridging(toChain) {
		return nil, fmt.Errorf("destination chain %q does not support USDT0 bridging", toChain)
	}

	// Get balances first
	summary, err := r.GetBalances(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get balances: %w", err)
	}

	// Concurrently evaluate routes from all potential source chains
	type routeResult struct {
		route BridgeRoute
		err   error
	}

	var sourceChains []string
	for _, balance := range summary.Balances {
		if balance.Chain != toChain && balance.CanBridge {
			sourceChains = append(sourceChains, balance.Chain)
		}
	}

	if len(sourceChains) == 0 {
		return []BridgeRoute{}, nil
	}

	results := make(chan routeResult, len(sourceChains))
	var wg sync.WaitGroup

	for _, balance := range summary.Balances {
		if balance.Chain == toChain {
			continue
		}

		wg.Add(1)
		go func(bal SmartChainBalance) {
			defer wg.Done()

			route := BridgeRoute{
				FromChain:       bal.Chain,
				ToChain:         toChain,
				EstimatedTime:   GetEstimatedBridgeTime(bal.Chain, toChain),
				Available:       false,
				AvailableAmount: bal.USDT0Balance,
			}

			// Check if this chain can bridge
			if !bal.CanBridge {
				if bal.USDT0Balance.Sign() <= 0 {
					route.UnavailableReason = "insufficient USDT0 balance"
				} else {
					route.UnavailableReason = "insufficient native token for gas"
				}
				results <- routeResult{route: route}
				return
			}

			// Check if amount is available
			if amount != nil && bal.USDT0Balance.Cmp(amount) < 0 {
				route.UnavailableReason = fmt.Sprintf("insufficient balance: have %s, need %s",
					bal.USDT0Balance.String(), amount.String())
				results <- routeResult{route: route}
				return
			}

			// Get quote for the route
			bridge, err := r.getOrCreateBridge(bal.Chain)
			if err != nil {
				route.UnavailableReason = fmt.Sprintf("failed to create bridge: %v", err)
				results <- routeResult{route: route}
				return
			}

			quoteAmount := amount
			if quoteAmount == nil || quoteAmount.Sign() <= 0 {
				// Use available balance for quote if no amount specified
				quoteAmount = bal.USDT0Balance
			}

			quote, err := bridge.Quote(ctx, &BridgeQuoteParams{
				FromChain: bal.Chain,
				ToChain:   toChain,
				Amount:    quoteAmount,
				Recipient: r.signer.GetAddress(),
			})
			if err != nil {
				route.UnavailableReason = fmt.Sprintf("failed to get quote: %v", err)
				results <- routeResult{route: route}
				return
			}

			// Check if we have enough native for the fee
			if bal.NativeBalance.Cmp(quote.NativeFee) < 0 {
				route.UnavailableReason = "insufficient native token for bridge fee"
				results <- routeResult{route: route}
				return
			}

			route.NativeFee = quote.NativeFee
			route.Available = true
			results <- routeResult{route: route}
		}(balance)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect routes
	routes := make([]BridgeRoute, 0, len(sourceChains))
	for result := range results {
		routes = append(routes, result.route)
	}

	return routes, nil
}

// SelectBestRoute selects the best route based on strategy.
func (r *smartBridgeRouter) SelectBestRoute(routes []BridgeRoute, strategy RouteStrategy, preferredChain string) *BridgeRoute {
	if len(routes) == 0 {
		return nil
	}

	// Filter to available routes only
	var availableRoutes []BridgeRoute
	for _, route := range routes {
		if route.Available {
			availableRoutes = append(availableRoutes, route)
		}
	}

	if len(availableRoutes) == 0 {
		return nil
	}

	switch strategy {
	case StrategyPreferred:
		// Try preferred chain first
		if preferredChain != "" {
			for i := range availableRoutes {
				if strings.EqualFold(availableRoutes[i].FromChain, preferredChain) {
					return &availableRoutes[i]
				}
			}
		}
		// Fall back to cheapest
		return r.selectCheapest(availableRoutes)

	case StrategyFastest:
		return r.selectFastest(availableRoutes)

	case StrategyCheapest:
		fallthrough
	default:
		return r.selectCheapest(availableRoutes)
	}
}

// selectCheapest returns the route with the lowest native fee.
func (r *smartBridgeRouter) selectCheapest(routes []BridgeRoute) *BridgeRoute {
	if len(routes) == 0 {
		return nil
	}

	best := &routes[0]
	for i := 1; i < len(routes); i++ {
		if routes[i].NativeFee != nil && best.NativeFee != nil {
			if routes[i].NativeFee.Cmp(best.NativeFee) < 0 {
				best = &routes[i]
			}
		}
	}
	return best
}

// selectFastest returns the route with the shortest estimated time.
func (r *smartBridgeRouter) selectFastest(routes []BridgeRoute) *BridgeRoute {
	if len(routes) == 0 {
		return nil
	}

	best := &routes[0]
	for i := 1; i < len(routes); i++ {
		if routes[i].EstimatedTime < best.EstimatedTime {
			best = &routes[i]
		}
	}
	return best
}

// AutoBridge automatically selects the best route and executes the bridge.
func (r *smartBridgeRouter) AutoBridge(ctx context.Context, params *AutoBridgeParams) (*SmartBridgeResult, error) {
	if params == nil {
		return nil, fmt.Errorf("params is required")
	}

	if params.Amount == nil || params.Amount.Sign() <= 0 {
		return nil, fmt.Errorf("amount must be greater than 0")
	}

	// Get available routes
	routes, err := r.GetRoutes(ctx, params.ToChain, params.Amount)
	if err != nil {
		return nil, fmt.Errorf("failed to get routes: %w", err)
	}

	// Select strategy
	strategy := params.Strategy
	if strategy == "" {
		strategy = r.config.DefaultStrategy
	}

	// Select best route
	bestRoute := r.SelectBestRoute(routes, strategy, params.PreferredSourceChain)
	if bestRoute == nil {
		return nil, fmt.Errorf("no available route to %s for amount %s",
			params.ToChain, params.Amount.String())
	}

	// Execute bridge
	recipient := params.Recipient
	if recipient == "" {
		recipient = r.signer.GetAddress()
	}

	slippage := params.SlippageTolerance
	if slippage <= 0 {
		slippage = DefaultSlippage
	}

	result, err := r.Bridge(ctx, &BridgeExecuteParams{
		BridgeQuoteParams: BridgeQuoteParams{
			FromChain: bestRoute.FromChain,
			ToChain:   params.ToChain,
			Amount:    params.Amount,
			Recipient: recipient,
		},
		SlippageTolerance: slippage,
	})
	if err != nil {
		return nil, fmt.Errorf("bridge execution failed: %w", err)
	}

	return &SmartBridgeResult{
		BridgeResult:  *result,
		SelectedRoute: bestRoute,
		Strategy:      strategy,
	}, nil
}

// Bridge executes a bridge transaction for a specific route.
func (r *smartBridgeRouter) Bridge(ctx context.Context, params *BridgeExecuteParams) (*BridgeResult, error) {
	bridge, err := r.getOrCreateBridge(params.FromChain)
	if err != nil {
		return nil, err
	}

	return bridge.Send(ctx, params)
}

// TrackMessage retrieves the current status of a LayerZero message.
func (r *smartBridgeRouter) TrackMessage(ctx context.Context, messageGUID string) (*LayerZeroMessage, error) {
	return r.scanClient.GetMessage(ctx, messageGUID)
}

// WaitForDelivery waits for a message to be delivered on the destination chain.
func (r *smartBridgeRouter) WaitForDelivery(ctx context.Context, messageGUID string, opts *WaitForDeliveryOptions) (*LayerZeroMessage, error) {
	return r.scanClient.WaitForDelivery(ctx, messageGUID, opts)
}

// getOrCreateBridge lazily creates or retrieves a cached Usdt0Bridge for a chain.
func (r *smartBridgeRouter) getOrCreateBridge(chain string) (*Usdt0Bridge, error) {
	chain = strings.ToLower(chain)

	// Check cache first
	r.bridgeMu.RLock()
	if bridge, ok := r.bridges[chain]; ok {
		r.bridgeMu.RUnlock()
		return bridge, nil
	}
	r.bridgeMu.RUnlock()

	// Create new bridge
	r.bridgeMu.Lock()
	defer r.bridgeMu.Unlock()

	// Double-check after acquiring write lock
	if bridge, ok := r.bridges[chain]; ok {
		return bridge, nil
	}

	signer, err := r.signer.GetBridgeSigner(chain)
	if err != nil {
		return nil, fmt.Errorf("failed to get signer for chain %s: %w", chain, err)
	}

	bridge, err := NewUsdt0Bridge(signer, chain)
	if err != nil {
		return nil, err
	}

	r.bridges[chain] = bridge
	return bridge, nil
}

// GetEstimatedBridgeTime returns the estimated bridge time between two chains.
func GetEstimatedBridgeTime(fromChain, toChain string) int {
	fromChain = strings.ToLower(fromChain)
	toChain = strings.ToLower(toChain)

	if times, ok := EstimatedBridgeTimes[fromChain]; ok {
		if time, ok := times[toChain]; ok {
			return time
		}
	}

	// Default estimated time
	return EstimatedBridgeTime
}

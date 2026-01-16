package bridge

import (
	"context"
	"math/big"
	"testing"
)

// MockMultiChainSigner implements MultiChainSigner for testing.
type MockMultiChainSigner struct {
	address         string
	configuredChains []string
	balances        map[string]*big.Int
	nativeBalances  map[string]*big.Int
	bridgeSigners   map[string]BridgeSigner
}

func NewMockMultiChainSigner(address string) *MockMultiChainSigner {
	return &MockMultiChainSigner{
		address:         address,
		configuredChains: []string{},
		balances:        make(map[string]*big.Int),
		nativeBalances:  make(map[string]*big.Int),
		bridgeSigners:   make(map[string]BridgeSigner),
	}
}

func (m *MockMultiChainSigner) GetAddress() string {
	return m.address
}

func (m *MockMultiChainSigner) GetConfiguredChains() []string {
	return m.configuredChains
}

func (m *MockMultiChainSigner) IsChainConfigured(chain string) bool {
	for _, c := range m.configuredChains {
		if c == chain {
			return true
		}
	}
	return false
}

func (m *MockMultiChainSigner) GetBridgeSigner(chain string) (BridgeSigner, error) {
	if signer, ok := m.bridgeSigners[chain]; ok {
		return signer, nil
	}
	return NewSimpleBridgeSigner(m.address), nil
}

func (m *MockMultiChainSigner) GetNativeBalance(ctx context.Context, chain string) (*big.Int, error) {
	if balance, ok := m.nativeBalances[chain]; ok {
		return balance, nil
	}
	return big.NewInt(0), nil
}

func (m *MockMultiChainSigner) GetUSDT0Balance(ctx context.Context, chain string) (*big.Int, error) {
	if balance, ok := m.balances[chain]; ok {
		return balance, nil
	}
	return big.NewInt(0), nil
}

func (m *MockMultiChainSigner) SetChains(chains []string) {
	m.configuredChains = chains
}

func (m *MockMultiChainSigner) SetBalance(chain string, usdt0, native *big.Int) {
	m.balances[chain] = usdt0
	m.nativeBalances[chain] = native
}

func (m *MockMultiChainSigner) SetBridgeSigner(chain string, signer BridgeSigner) {
	m.bridgeSigners[chain] = signer
}

func TestNewSmartBridgeRouter(t *testing.T) {
	// Test with nil signer
	_, err := NewSmartBridgeRouter(nil, nil)
	if err == nil {
		t.Error("NewSmartBridgeRouter(nil, nil) should return error")
	}

	// Test with valid signer
	signer := NewMockMultiChainSigner("0x1234")
	router, err := NewSmartBridgeRouter(signer, nil)
	if err != nil {
		t.Errorf("NewSmartBridgeRouter() error = %v", err)
	}
	if router == nil {
		t.Error("NewSmartBridgeRouter() returned nil router")
	}
}

func TestRouteStrategy(t *testing.T) {
	tests := []struct {
		strategy RouteStrategy
		expected string
	}{
		{StrategyCheapest, "cheapest"},
		{StrategyFastest, "fastest"},
		{StrategyPreferred, "preferred"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if string(tt.strategy) != tt.expected {
				t.Errorf("RouteStrategy = %s, want %s", tt.strategy, tt.expected)
			}
		})
	}
}

func TestSelectBestRoute_Cheapest(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	router, _ := NewSmartBridgeRouter(signer, nil)

	routes := []BridgeRoute{
		{FromChain: "ethereum", ToChain: "arbitrum", NativeFee: big.NewInt(1000000), EstimatedTime: 180, Available: true},
		{FromChain: "ink", ToChain: "arbitrum", NativeFee: big.NewInt(500000), EstimatedTime: 300, Available: true},
		{FromChain: "berachain", ToChain: "arbitrum", NativeFee: big.NewInt(800000), EstimatedTime: 300, Available: true},
	}

	best := router.SelectBestRoute(routes, StrategyCheapest, "")
	if best == nil {
		t.Fatal("SelectBestRoute() returned nil")
	}
	if best.FromChain != "ink" {
		t.Errorf("SelectBestRoute(cheapest) = %s, want ink", best.FromChain)
	}
}

func TestSelectBestRoute_Fastest(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	router, _ := NewSmartBridgeRouter(signer, nil)

	routes := []BridgeRoute{
		{FromChain: "ethereum", ToChain: "arbitrum", NativeFee: big.NewInt(1000000), EstimatedTime: 180, Available: true},
		{FromChain: "ink", ToChain: "arbitrum", NativeFee: big.NewInt(500000), EstimatedTime: 300, Available: true},
		{FromChain: "berachain", ToChain: "arbitrum", NativeFee: big.NewInt(800000), EstimatedTime: 300, Available: true},
	}

	best := router.SelectBestRoute(routes, StrategyFastest, "")
	if best == nil {
		t.Fatal("SelectBestRoute() returned nil")
	}
	if best.FromChain != "ethereum" {
		t.Errorf("SelectBestRoute(fastest) = %s, want ethereum", best.FromChain)
	}
}

func TestSelectBestRoute_Preferred(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	router, _ := NewSmartBridgeRouter(signer, nil)

	routes := []BridgeRoute{
		{FromChain: "ethereum", ToChain: "arbitrum", NativeFee: big.NewInt(1000000), EstimatedTime: 180, Available: true},
		{FromChain: "ink", ToChain: "arbitrum", NativeFee: big.NewInt(500000), EstimatedTime: 300, Available: true},
		{FromChain: "berachain", ToChain: "arbitrum", NativeFee: big.NewInt(800000), EstimatedTime: 300, Available: true},
	}

	// Test with preferred chain
	best := router.SelectBestRoute(routes, StrategyPreferred, "berachain")
	if best == nil {
		t.Fatal("SelectBestRoute() returned nil")
	}
	if best.FromChain != "berachain" {
		t.Errorf("SelectBestRoute(preferred, berachain) = %s, want berachain", best.FromChain)
	}

	// Test with unavailable preferred chain - should fall back to cheapest
	best2 := router.SelectBestRoute(routes, StrategyPreferred, "unichain")
	if best2 == nil {
		t.Fatal("SelectBestRoute() returned nil")
	}
	if best2.FromChain != "ink" {
		t.Errorf("SelectBestRoute(preferred, unichain) = %s, want ink (cheapest)", best2.FromChain)
	}
}

func TestSelectBestRoute_NoAvailableRoutes(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	router, _ := NewSmartBridgeRouter(signer, nil)

	// All routes unavailable
	routes := []BridgeRoute{
		{FromChain: "ethereum", ToChain: "arbitrum", Available: false, UnavailableReason: "insufficient balance"},
		{FromChain: "ink", ToChain: "arbitrum", Available: false, UnavailableReason: "insufficient gas"},
	}

	best := router.SelectBestRoute(routes, StrategyCheapest, "")
	if best != nil {
		t.Errorf("SelectBestRoute() should return nil when no routes available, got %v", best)
	}

	// Empty routes
	best2 := router.SelectBestRoute([]BridgeRoute{}, StrategyCheapest, "")
	if best2 != nil {
		t.Errorf("SelectBestRoute() should return nil for empty routes, got %v", best2)
	}
}

func TestSelectBestRoute_MixedAvailability(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	router, _ := NewSmartBridgeRouter(signer, nil)

	routes := []BridgeRoute{
		{FromChain: "ethereum", ToChain: "arbitrum", NativeFee: big.NewInt(100000), Available: false, UnavailableReason: "insufficient balance"},
		{FromChain: "ink", ToChain: "arbitrum", NativeFee: big.NewInt(500000), Available: true},
		{FromChain: "berachain", ToChain: "arbitrum", NativeFee: big.NewInt(200000), Available: true},
	}

	// Should only consider available routes
	best := router.SelectBestRoute(routes, StrategyCheapest, "")
	if best == nil {
		t.Fatal("SelectBestRoute() returned nil")
	}
	// Cheapest available is berachain (200000), not ethereum (100000) which is unavailable
	if best.FromChain != "berachain" {
		t.Errorf("SelectBestRoute() = %s, want berachain", best.FromChain)
	}
}

func TestGetEstimatedBridgeTime(t *testing.T) {
	tests := []struct {
		from     string
		to       string
		expected int
	}{
		{"ethereum", "arbitrum", 180},
		{"arbitrum", "ethereum", 900},
		{"ink", "berachain", 300},
		{"unknown", "ethereum", EstimatedBridgeTime}, // Default
		{"ethereum", "unknown", EstimatedBridgeTime}, // Default
	}

	for _, tt := range tests {
		t.Run(tt.from+"->"+tt.to, func(t *testing.T) {
			result := GetEstimatedBridgeTime(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("GetEstimatedBridgeTime(%s, %s) = %d, want %d", tt.from, tt.to, result, tt.expected)
			}
		})
	}
}

func TestGetEstimatedBridgeTime_CaseInsensitive(t *testing.T) {
	time1 := GetEstimatedBridgeTime("ETHEREUM", "ARBITRUM")
	time2 := GetEstimatedBridgeTime("ethereum", "arbitrum")
	time3 := GetEstimatedBridgeTime("Ethereum", "Arbitrum")

	if time1 != time2 || time2 != time3 {
		t.Errorf("GetEstimatedBridgeTime should be case insensitive: %d, %d, %d", time1, time2, time3)
	}
}

func TestSmartChainBalance(t *testing.T) {
	balance := SmartChainBalance{
		Chain:         "ethereum",
		USDT0Balance:  big.NewInt(100000000), // 100 USDT0
		NativeBalance: big.NewInt(1e18),      // 1 ETH
		CanBridge:     true,
	}

	if balance.Chain != "ethereum" {
		t.Errorf("Chain = %s, want ethereum", balance.Chain)
	}
	if balance.USDT0Balance.Cmp(big.NewInt(100000000)) != 0 {
		t.Errorf("USDT0Balance = %s, want 100000000", balance.USDT0Balance)
	}
	if !balance.CanBridge {
		t.Error("CanBridge should be true")
	}
}

func TestBalanceSummary(t *testing.T) {
	summary := BalanceSummary{
		Balances: []SmartChainBalance{
			{Chain: "ethereum", USDT0Balance: big.NewInt(50000000), CanBridge: true},
			{Chain: "arbitrum", USDT0Balance: big.NewInt(30000000), CanBridge: true},
		},
		TotalUSDT0:       big.NewInt(80000000),
		BridgeableChains: []string{"ethereum", "arbitrum"},
	}

	if len(summary.Balances) != 2 {
		t.Errorf("len(Balances) = %d, want 2", len(summary.Balances))
	}
	if summary.TotalUSDT0.Cmp(big.NewInt(80000000)) != 0 {
		t.Errorf("TotalUSDT0 = %s, want 80000000", summary.TotalUSDT0)
	}
	if len(summary.BridgeableChains) != 2 {
		t.Errorf("len(BridgeableChains) = %d, want 2", len(summary.BridgeableChains))
	}
}

func TestBridgeRoute(t *testing.T) {
	route := BridgeRoute{
		FromChain:         "ethereum",
		ToChain:           "arbitrum",
		NativeFee:         big.NewInt(1000000000000000), // 0.001 ETH
		EstimatedTime:     180,
		Available:         true,
		AvailableAmount:   big.NewInt(100000000),
	}

	if route.FromChain != "ethereum" {
		t.Errorf("FromChain = %s, want ethereum", route.FromChain)
	}
	if !route.Available {
		t.Error("Available should be true")
	}
	if route.EstimatedTime != 180 {
		t.Errorf("EstimatedTime = %d, want 180", route.EstimatedTime)
	}
}

func TestBridgeRoute_Unavailable(t *testing.T) {
	route := BridgeRoute{
		FromChain:          "ethereum",
		ToChain:            "arbitrum",
		Available:          false,
		UnavailableReason:  "insufficient USDT0 balance",
	}

	if route.Available {
		t.Error("Available should be false")
	}
	if route.UnavailableReason == "" {
		t.Error("UnavailableReason should be set")
	}
}

func TestAutoBridgeParams(t *testing.T) {
	params := AutoBridgeParams{
		ToChain:              "ethereum",
		Amount:               big.NewInt(100000000),
		Recipient:            "0x1234567890123456789012345678901234567890",
		PreferredSourceChain: "arbitrum",
		SlippageTolerance:    0.5,
		Strategy:             StrategyCheapest,
	}

	if params.ToChain != "ethereum" {
		t.Errorf("ToChain = %s, want ethereum", params.ToChain)
	}
	if params.Amount.Cmp(big.NewInt(100000000)) != 0 {
		t.Errorf("Amount = %s, want 100000000", params.Amount)
	}
	if params.Strategy != StrategyCheapest {
		t.Errorf("Strategy = %s, want cheapest", params.Strategy)
	}
}

func TestSmartBridgeResult(t *testing.T) {
	result := SmartBridgeResult{
		BridgeResult: BridgeResult{
			TxHash:          "0xabc123",
			MessageGUID:     "0xguid456",
			AmountSent:      big.NewInt(100000000),
			AmountToReceive: big.NewInt(99500000),
			FromChain:       "arbitrum",
			ToChain:         "ethereum",
			EstimatedTime:   900,
		},
		SelectedRoute: &BridgeRoute{
			FromChain:     "arbitrum",
			ToChain:       "ethereum",
			NativeFee:     big.NewInt(1000000000000000),
			EstimatedTime: 900,
			Available:     true,
		},
		Strategy: StrategyCheapest,
	}

	if result.TxHash != "0xabc123" {
		t.Errorf("TxHash = %s, want 0xabc123", result.TxHash)
	}
	if result.SelectedRoute == nil {
		t.Error("SelectedRoute should not be nil")
	}
	if result.Strategy != StrategyCheapest {
		t.Errorf("Strategy = %s, want cheapest", result.Strategy)
	}
}

func TestDefaultSmartRouterConfig(t *testing.T) {
	config := DefaultSmartRouterConfig()

	if config.DefaultStrategy != StrategyCheapest {
		t.Errorf("DefaultStrategy = %s, want cheapest", config.DefaultStrategy)
	}
	if config.MinNativeBalance == nil {
		t.Error("MinNativeBalance should not be nil")
	}
	if config.MinNativeBalance.Cmp(big.NewInt(1000000000000000)) != 0 {
		t.Errorf("MinNativeBalance = %s, want 1000000000000000", config.MinNativeBalance)
	}
}

func TestEstimatedBridgeTimes(t *testing.T) {
	// Verify the map structure
	if EstimatedBridgeTimes == nil {
		t.Fatal("EstimatedBridgeTimes should not be nil")
	}

	// Check all bridgeable chains have entries
	chains := GetBridgeableChains()
	for _, fromChain := range chains {
		if _, ok := EstimatedBridgeTimes[fromChain]; !ok {
			t.Errorf("EstimatedBridgeTimes missing entry for chain: %s", fromChain)
			continue
		}
		for _, toChain := range chains {
			if fromChain == toChain {
				continue
			}
			if _, ok := EstimatedBridgeTimes[fromChain][toChain]; !ok {
				t.Errorf("EstimatedBridgeTimes missing entry for %s -> %s", fromChain, toChain)
			}
		}
	}
}

func TestSimpleBridgeSigner(t *testing.T) {
	signer := NewSimpleBridgeSigner("0x1234")

	if signer.Address() != "0x1234" {
		t.Errorf("Address() = %s, want 0x1234", signer.Address())
	}

	// Test that methods return errors when not configured
	ctx := context.Background()
	_, err := signer.ReadContract(ctx, "0x", nil, "test")
	if err == nil {
		t.Error("ReadContract() should return error when not configured")
	}

	_, err = signer.WriteContract(ctx, "0x", nil, "test", nil)
	if err == nil {
		t.Error("WriteContract() should return error when not configured")
	}

	_, err = signer.WaitForTransactionReceipt(ctx, "0x")
	if err == nil {
		t.Error("WaitForTransactionReceipt() should return error when not configured")
	}
}

func TestSimpleBridgeSigner_WithMocks(t *testing.T) {
	signer := NewSimpleBridgeSigner("0x1234")

	// Configure mock functions
	signer.SetReadFunc(func(ctx context.Context, address string, abiJSON []byte, functionName string, args ...interface{}) (interface{}, error) {
		return big.NewInt(1000), nil
	})

	signer.SetWriteFunc(func(ctx context.Context, address string, abiJSON []byte, functionName string, value *big.Int, args ...interface{}) (string, error) {
		return "0xtxhash", nil
	})

	signer.SetWaitFunc(func(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error) {
		return &BridgeTransactionReceipt{Status: 1, TransactionHash: txHash}, nil
	})

	ctx := context.Background()

	// Test read
	result, err := signer.ReadContract(ctx, "0x", nil, "test")
	if err != nil {
		t.Errorf("ReadContract() error = %v", err)
	}
	if result.(*big.Int).Cmp(big.NewInt(1000)) != 0 {
		t.Errorf("ReadContract() result = %v, want 1000", result)
	}

	// Test write
	txHash, err := signer.WriteContract(ctx, "0x", nil, "test", nil)
	if err != nil {
		t.Errorf("WriteContract() error = %v", err)
	}
	if txHash != "0xtxhash" {
		t.Errorf("WriteContract() txHash = %s, want 0xtxhash", txHash)
	}

	// Test wait
	receipt, err := signer.WaitForTransactionReceipt(ctx, "0xtest")
	if err != nil {
		t.Errorf("WaitForTransactionReceipt() error = %v", err)
	}
	if receipt.Status != 1 {
		t.Errorf("WaitForTransactionReceipt() status = %d, want 1", receipt.Status)
	}
}

func TestGetBalances_NoBridgeableChains(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	signer.SetChains([]string{"base", "polygon"}) // These don't support bridging

	router, _ := NewSmartBridgeRouter(signer, nil)

	ctx := context.Background()
	summary, err := router.GetBalances(ctx)
	if err != nil {
		t.Errorf("GetBalances() error = %v", err)
	}

	if len(summary.Balances) != 0 {
		t.Errorf("len(Balances) = %d, want 0", len(summary.Balances))
	}
	if summary.TotalUSDT0.Sign() != 0 {
		t.Errorf("TotalUSDT0 = %s, want 0", summary.TotalUSDT0)
	}
}

func TestGetBalances_WithBalances(t *testing.T) {
	signer := NewMockMultiChainSigner("0x1234")
	signer.SetChains([]string{"ethereum", "arbitrum", "ink"})
	signer.SetBalance("ethereum", big.NewInt(50000000), big.NewInt(1e18))
	signer.SetBalance("arbitrum", big.NewInt(30000000), big.NewInt(1e17))
	signer.SetBalance("ink", big.NewInt(20000000), big.NewInt(1e15))

	router, _ := NewSmartBridgeRouter(signer, nil)

	ctx := context.Background()
	summary, err := router.GetBalances(ctx)
	if err != nil {
		t.Errorf("GetBalances() error = %v", err)
	}

	if len(summary.Balances) != 3 {
		t.Errorf("len(Balances) = %d, want 3", len(summary.Balances))
	}

	// Check that chains with sufficient native balance are marked as bridgeable
	foundEthereum := false
	foundArbitrum := false
	for _, balance := range summary.Balances {
		if balance.Chain == "ethereum" && balance.CanBridge {
			foundEthereum = true
		}
		if balance.Chain == "arbitrum" && balance.CanBridge {
			foundArbitrum = true
		}
	}

	if !foundEthereum {
		t.Error("ethereum should be bridgeable")
	}
	if !foundArbitrum {
		t.Error("arbitrum should be bridgeable")
	}
}

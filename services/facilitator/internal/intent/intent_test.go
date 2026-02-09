package intent

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestIntentStatus(t *testing.T) {
	tests := []struct {
		status IntentStatus
		valid  bool
	}{
		{IntentStatusPending, true},
		{IntentStatusRouted, true},
		{IntentStatusExecuting, true},
		{IntentStatusCompleted, true},
		{IntentStatusFailed, true},
		{IntentStatusCancelled, true},
		{IntentStatusExpired, true},
		{IntentStatus("invalid"), false},
	}

	validStatuses := map[IntentStatus]bool{
		IntentStatusPending:   true,
		IntentStatusRouted:    true,
		IntentStatusExecuting: true,
		IntentStatusCompleted: true,
		IntentStatusFailed:    true,
		IntentStatusCancelled: true,
		IntentStatusExpired:   true,
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			_, exists := validStatuses[tt.status]
			if exists != tt.valid {
				t.Errorf("status %s: expected valid=%v, got %v", tt.status, tt.valid, exists)
			}
		})
	}
}

func TestIntentPriority(t *testing.T) {
	priorities := []IntentPriority{
		PriorityLow,
		PriorityNormal,
		PriorityHigh,
		PriorityUrgent,
	}

	for _, p := range priorities {
		if p == "" {
			t.Errorf("priority should not be empty")
		}
	}
}

func TestStepType(t *testing.T) {
	steps := []StepType{
		StepTypeTransfer,
		StepTypeSwap,
		StepTypeBridge,
		StepTypeApprove,
		StepTypeWrap,
		StepTypeUnwrap,
	}

	for _, s := range steps {
		if s == "" {
			t.Errorf("step type should not be empty")
		}
	}
}

func TestIntentModel(t *testing.T) {
	now := time.Now()
	expires := now.Add(5 * time.Minute)

	intent := &Intent{
		ID:             "test-id",
		Payer:          "0xPayer",
		Payee:          "0xPayee",
		Amount:         "1000000000",
		Asset:          "USDT",
		SourceNetworks: []string{"eip155:1", "eip155:8453"},
		TargetNetwork:  "eip155:8453",
		MaxSlippage:    0.005,
		MaxGasCost:     "100000000",
		Priority:       PriorityNormal,
		Status:         IntentStatusPending,
		CreatedAt:      now,
		ExpiresAt:      expires,
		Metadata:       map[string]string{"key": "value"},
	}

	if intent.ID != "test-id" {
		t.Errorf("expected ID 'test-id', got %s", intent.ID)
	}
	if intent.Status != IntentStatusPending {
		t.Errorf("expected status 'pending', got %s", intent.Status)
	}
	if len(intent.SourceNetworks) != 2 {
		t.Errorf("expected 2 source networks, got %d", len(intent.SourceNetworks))
	}
}

func TestRouteModel(t *testing.T) {
	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		SourceAsset:    "0xSourceAsset",
		TargetAsset:    "0xTargetAsset",
		InputAmount:    "1000000000",
		OutputAmount:   "999000000",
		EstimatedGas:   "100000",
		EstimatedTime:  60,
		Slippage:       0.001,
		Score:          0.95,
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
		ValidUntil:     time.Now().Add(5 * time.Minute),
		Steps: []*RouteStep{
			{
				Order:      1,
				Type:       StepTypeBridge,
				Network:    "eip155:1",
				Protocol:   "LayerZero",
				FromAsset:  "0xSourceAsset",
				ToAsset:    "0xTargetAsset",
				FromAmount: "1000000000",
				ToAmount:   "999000000",
			},
		},
	}

	if route.Score != 0.95 {
		t.Errorf("expected score 0.95, got %f", route.Score)
	}
	if len(route.Steps) != 1 {
		t.Errorf("expected 1 step, got %d", len(route.Steps))
	}
	if !route.RequiresBridge {
		t.Error("expected requiresBridge to be true")
	}
}

func TestCreateIntentRequest(t *testing.T) {
	req := &CreateIntentRequest{
		Payer:          "0xPayer",
		Payee:          "0xPayee",
		Amount:         "1000000000",
		Asset:          "USDT",
		SourceNetworks: []string{"eip155:1"},
		TargetNetwork:  "eip155:8453",
		MaxSlippage:    0.01,
		MaxGasCost:     "50000000",
		Priority:       PriorityHigh,
		ExpiresIn:      300,
		Metadata:       map[string]string{"ref": "123"},
	}

	if req.Asset != "USDT" {
		t.Errorf("expected asset 'USDT', got %s", req.Asset)
	}
	if req.Priority != PriorityHigh {
		t.Errorf("expected priority 'high', got %s", req.Priority)
	}
}

func TestListIntentsRequest(t *testing.T) {
	req := ListIntentsRequest{
		Payer:  "0xPayer",
		Payee:  "0xPayee",
		Status: []IntentStatus{IntentStatusPending, IntentStatusRouted},
		Limit:  50,
		Offset: 10,
	}

	if len(req.Status) != 2 {
		t.Errorf("expected 2 statuses, got %d", len(req.Status))
	}
	if req.Limit != 50 {
		t.Errorf("expected limit 50, got %d", req.Limit)
	}
}

func TestDefaultServiceConfig(t *testing.T) {
	config := DefaultServiceConfig()

	if config.DefaultExpiry != 5*time.Minute {
		t.Errorf("expected default expiry 5m, got %v", config.DefaultExpiry)
	}
	if config.MaxExpiry != 1*time.Hour {
		t.Errorf("expected max expiry 1h, got %v", config.MaxExpiry)
	}
	if config.DefaultSlippage != 0.005 {
		t.Errorf("expected default slippage 0.005, got %f", config.DefaultSlippage)
	}
	if config.AutoExecute {
		t.Error("expected auto execute to be disabled by default")
	}
	if config.ExecutionWorkers != 5 {
		t.Errorf("expected 5 execution workers, got %d", config.ExecutionWorkers)
	}
}

func TestDefaultRouterConfig(t *testing.T) {
	config := DefaultRouterConfig()

	if config.DefaultRouteValidity != 5*time.Minute {
		t.Errorf("expected route validity 5m, got %v", config.DefaultRouteValidity)
	}
	if config.MaxRoutes != 5 {
		t.Errorf("expected max routes 5, got %d", config.MaxRoutes)
	}
	if config.MinScore != 0.5 {
		t.Errorf("expected min score 0.5, got %f", config.MinScore)
	}
}

// Mock implementations for testing

type mockNetworkProvider struct {
	networks []string
	configs  map[string]*NetworkConfig
	assets   map[string]map[string]string
}

func (m *mockNetworkProvider) GetSupportedNetworks() []string {
	return m.networks
}

func (m *mockNetworkProvider) GetNetworkConfig(network string) (*NetworkConfig, error) {
	if config, ok := m.configs[network]; ok {
		return config, nil
	}
	return &NetworkConfig{
		Network:       network,
		AvgBlockTime:  12.0,
		Confirmations: 2,
	}, nil
}

func (m *mockNetworkProvider) GetAssetAddress(network, asset string) (string, error) {
	if m.assets != nil {
		if netAssets, ok := m.assets[network]; ok {
			if addr, ok := netAssets[asset]; ok {
				return addr, nil
			}
		}
	}
	return "0xAsset", nil
}

func (m *mockNetworkProvider) GetAssetDecimals(network, asset string) (int, error) {
	return 6, nil
}

type mockVerifier struct {
	verifyResult bool
	verifyErr    error
}

func (m *mockVerifier) VerifyIntentSignature(ctx context.Context, network, payer, intentID, routeID, signature string) (bool, error) {
	return m.verifyResult, m.verifyErr
}

type mockExecutor struct {
	txHashes []string
	execErr  error
}

func (m *mockExecutor) ExecutePayment(ctx context.Context, route *Route, payer, payee string) ([]string, error) {
	return m.txHashes, m.execErr
}

func TestRouterCreation(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}

	router := NewRouter(nil, provider, nil, nil, nil)
	if router == nil {
		t.Fatal("expected non-nil router")
	}

	// Check default config is applied
	if router.config.MaxRoutes != 5 {
		t.Errorf("expected default config to be applied")
	}
}

func TestServiceCreation(t *testing.T) {
	verifier := &mockVerifier{verifyResult: true}
	executor := &mockExecutor{txHashes: []string{"0xtx"}}

	service := NewService(nil, nil, verifier, executor, nil, nil)
	if service == nil {
		t.Fatal("expected non-nil service")
	}

	// Check default config is applied
	if service.config.DefaultExpiry != 5*time.Minute {
		t.Errorf("expected default config to be applied")
	}
}

func TestErrors(t *testing.T) {
	errors := []error{
		ErrIntentNotFound,
		ErrIntentAlreadyExists,
		ErrInvalidStatusChange,
		ErrIntentExpired,
		ErrNoRouteSelected,
		ErrRouteExpired,
		ErrInvalidIntent,
		ErrInvalidSignature,
		ErrIntentNotPending,
		ErrIntentNotRouted,
		ErrExecutionFailed,
	}

	for _, err := range errors {
		if err == nil {
			t.Error("expected non-nil error")
		}
		if err.Error() == "" {
			t.Error("expected non-empty error message")
		}
	}
}

func TestListIntentsResponse(t *testing.T) {
	resp := &ListIntentsResponse{
		Intents: []*Intent{
			{ID: "1"},
			{ID: "2"},
		},
		Total:   10,
		Limit:   20,
		Offset:  0,
		HasMore: true,
	}

	if len(resp.Intents) != 2 {
		t.Errorf("expected 2 intents, got %d", len(resp.Intents))
	}
	if !resp.HasMore {
		t.Error("expected HasMore to be true")
	}
}

func TestExecuteIntentRequest(t *testing.T) {
	req := &ExecuteIntentRequest{
		IntentID:  "intent-1",
		Signature: "0xsig...",
		RouteID:   "route-1",
	}

	if req.IntentID != "intent-1" {
		t.Errorf("expected intent ID 'intent-1', got %s", req.IntentID)
	}
}

func TestBridgeQuote(t *testing.T) {
	quote := &BridgeQuote{
		Protocol:      "LayerZero",
		InputAmount:   "1000000000",
		OutputAmount:  "999500000",
		Fee:           "500000",
		EstimatedTime: 120,
		ValidUntil:    time.Now().Add(5 * time.Minute),
	}

	if quote.Protocol != "LayerZero" {
		t.Errorf("expected protocol 'LayerZero', got %s", quote.Protocol)
	}
	if quote.EstimatedTime != 120 {
		t.Errorf("expected estimated time 120, got %d", quote.EstimatedTime)
	}
}

func TestNetworkConfig(t *testing.T) {
	config := &NetworkConfig{
		Network:       "eip155:1",
		Assets:        []string{"USDT", "USDC"},
		GasToken:      "ETH",
		AvgBlockTime:  12.0,
		Confirmations: 2,
		BridgesFrom:   []string{"LayerZero", "Stargate"},
		BridgesTo:     []string{"LayerZero"},
	}

	if len(config.Assets) != 2 {
		t.Errorf("expected 2 assets, got %d", len(config.Assets))
	}
	if config.Confirmations != 2 {
		t.Errorf("expected 2 confirmations, got %d", config.Confirmations)
	}
}

func TestAssetMapping(t *testing.T) {
	mapping := &AssetMapping{
		Symbol:   "USDT",
		Decimals: 6,
		Networks: map[string]string{
			"eip155:1":    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
			"eip155:8453": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
		},
	}

	if mapping.Symbol != "USDT" {
		t.Errorf("expected symbol 'USDT', got %s", mapping.Symbol)
	}
	if len(mapping.Networks) != 2 {
		t.Errorf("expected 2 networks, got %d", len(mapping.Networks))
	}
}

// ============== Router RecordRouteSuccess Tests ==============

func TestRecordRouteSuccess_BridgeRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	// Record multiple successes
	router.RecordRouteSuccess(route)
	router.RecordRouteSuccess(route)
	router.RecordRouteSuccess(route)

	stats := router.GetRouteStats("LayerZero", "eip155:1", "eip155:8453")
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.SuccessCount != 3 {
		t.Errorf("expected 3 successes, got %d", stats.SuccessCount)
	}
	if stats.FailureCount != 0 {
		t.Errorf("expected 0 failures, got %d", stats.FailureCount)
	}
}

func TestRecordRouteSuccess_NilRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	// Should not panic with nil route
	router.RecordRouteSuccess(nil)
}

func TestRecordRouteSuccess_DirectRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		RequiresBridge: false, // Direct route, no bridge
	}

	// Should not record stats for non-bridge routes
	router.RecordRouteSuccess(route)

	stats := router.GetRouteStats("", "eip155:1", "eip155:1")
	if stats != nil {
		t.Error("expected nil stats for direct route")
	}
}

func TestRecordRouteSuccess_EmptyBridgeProtocol(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "", // Empty protocol
	}

	// Should not record stats with empty protocol
	router.RecordRouteSuccess(route)

	stats := router.GetRouteStats("", "eip155:1", "eip155:8453")
	if stats != nil {
		t.Error("expected nil stats for empty bridge protocol")
	}
}

// ============== Router RecordRouteFailure Tests ==============

func TestRecordRouteFailure_BridgeRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	// Record multiple failures
	router.RecordRouteFailure(route)
	router.RecordRouteFailure(route)

	stats := router.GetRouteStats("LayerZero", "eip155:1", "eip155:8453")
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.FailureCount != 2 {
		t.Errorf("expected 2 failures, got %d", stats.FailureCount)
	}
	if stats.SuccessCount != 0 {
		t.Errorf("expected 0 successes, got %d", stats.SuccessCount)
	}
	// LastFailure should be recent
	if time.Since(stats.LastFailure) > 5*time.Second {
		t.Error("expected LastFailure to be recent")
	}
}

func TestRecordRouteFailure_NilRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	// Should not panic with nil route
	router.RecordRouteFailure(nil)
}

func TestRecordRouteFailure_DirectRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		RequiresBridge: false,
	}

	// Should not record stats for non-bridge routes
	router.RecordRouteFailure(route)

	stats := router.GetRouteStats("", "eip155:1", "eip155:1")
	if stats != nil {
		t.Error("expected nil stats for direct route")
	}
}

// ============== Router Mixed Success/Failure Tests ==============

func TestRecordRouteSuccessAndFailure_Mixed(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "Stargate",
	}

	// Record mixed results
	router.RecordRouteSuccess(route)
	router.RecordRouteSuccess(route)
	router.RecordRouteSuccess(route)
	router.RecordRouteFailure(route)
	router.RecordRouteSuccess(route)
	router.RecordRouteFailure(route)

	stats := router.GetRouteStats("Stargate", "eip155:1", "eip155:8453")
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.SuccessCount != 4 {
		t.Errorf("expected 4 successes, got %d", stats.SuccessCount)
	}
	if stats.FailureCount != 2 {
		t.Errorf("expected 2 failures, got %d", stats.FailureCount)
	}
}

func TestRecordRouteStats_MultipleProtocols(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453", "eip155:42161"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	layerZeroRoute := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	stargateRoute := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:42161",
		RequiresBridge: true,
		BridgeProtocol: "Stargate",
	}

	router.RecordRouteSuccess(layerZeroRoute)
	router.RecordRouteSuccess(layerZeroRoute)
	router.RecordRouteFailure(stargateRoute)

	lzStats := router.GetRouteStats("LayerZero", "eip155:1", "eip155:8453")
	sgStats := router.GetRouteStats("Stargate", "eip155:1", "eip155:42161")

	if lzStats == nil {
		t.Fatal("expected non-nil LayerZero stats")
	}
	if sgStats == nil {
		t.Fatal("expected non-nil Stargate stats")
	}

	if lzStats.SuccessCount != 2 {
		t.Errorf("LayerZero: expected 2 successes, got %d", lzStats.SuccessCount)
	}
	if lzStats.FailureCount != 0 {
		t.Errorf("LayerZero: expected 0 failures, got %d", lzStats.FailureCount)
	}
	if sgStats.FailureCount != 1 {
		t.Errorf("Stargate: expected 1 failure, got %d", sgStats.FailureCount)
	}
}

// ============== GetRouteStats Tests ==============

func TestGetRouteStats_NonExistent(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	stats := router.GetRouteStats("NonExistentProtocol", "eip155:1", "eip155:8453")
	if stats != nil {
		t.Error("expected nil stats for non-existent route")
	}
}

func TestGetRouteStats_AfterRecords(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	// Record successes and failures
	for i := 0; i < 10; i++ {
		router.RecordRouteSuccess(route)
	}
	for i := 0; i < 3; i++ {
		router.RecordRouteFailure(route)
	}

	stats := router.GetRouteStats("LayerZero", "eip155:1", "eip155:8453")
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.SuccessCount != 10 {
		t.Errorf("expected 10 successes, got %d", stats.SuccessCount)
	}
	if stats.FailureCount != 3 {
		t.Errorf("expected 3 failures, got %d", stats.FailureCount)
	}
}

// ============== ValidateRoute Tests ==============

func TestValidateRoute_NilRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	err := router.ValidateRoute(nil)
	if err != ErrNoRouteSelected {
		t.Errorf("expected ErrNoRouteSelected, got %v", err)
	}
}

func TestValidateRoute_ValidRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:         "route-1",
		ValidUntil: time.Now().Add(5 * time.Minute),
	}

	err := router.ValidateRoute(route)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestValidateRoute_ExpiredRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		ID:         "route-1",
		ValidUntil: time.Now().Add(-1 * time.Minute), // Expired
	}

	err := router.ValidateRoute(route)
	if err != ErrRouteExpired {
		t.Errorf("expected ErrRouteExpired, got %v", err)
	}
}

// ============== GetRecommendedRoute Tests ==============

func TestGetRecommendedRoute_EmptyList(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := router.GetRecommendedRoute([]*Route{})
	if route != nil {
		t.Error("expected nil for empty routes list")
	}
}

func TestGetRecommendedRoute_NilList(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := router.GetRecommendedRoute(nil)
	if route != nil {
		t.Error("expected nil for nil routes list")
	}
}

func TestGetRecommendedRoute_ReturnsFirst(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	routes := []*Route{
		{ID: "best-route", Score: 0.95},
		{ID: "second-route", Score: 0.80},
		{ID: "third-route", Score: 0.70},
	}

	recommended := router.GetRecommendedRoute(routes)
	if recommended == nil {
		t.Fatal("expected non-nil recommended route")
	}
	if recommended.ID != "best-route" {
		t.Errorf("expected 'best-route', got %s", recommended.ID)
	}
}

// ============== RefreshRoute Tests ==============

// mockBridgeProvider implements BridgeProvider for testing
type mockBridgeProvider struct {
	quote    *BridgeQuote
	quoteErr error
}

func (m *mockBridgeProvider) GetQuote(ctx context.Context, fromNetwork, toNetwork, asset, amount string) (*BridgeQuote, error) {
	if m.quoteErr != nil {
		return nil, m.quoteErr
	}
	return m.quote, nil
}

func (m *mockBridgeProvider) GetSupportedBridges(fromNetwork, toNetwork string) []string {
	return []string{"LayerZero"}
}

func TestRefreshRoute_DirectRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	intent := &Intent{
		Amount:      "1000000000",
		Asset:       "USDT",
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		InputAmount:    "1000000000",
		OutputAmount:   "1000000000",
		RequiresBridge: false,
		ValidUntil:     time.Now().Add(-1 * time.Minute), // Expired
	}

	ctx := context.Background()
	refreshed, err := router.RefreshRoute(ctx, intent, route)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if refreshed == nil {
		t.Fatal("expected non-nil refreshed route")
	}

	// Validity should be extended
	if time.Until(refreshed.ValidUntil) < 4*time.Minute {
		t.Error("expected validity to be extended to ~5 minutes")
	}

	// Score should be recalculated
	if refreshed.Score <= 0 || refreshed.Score > 1 {
		t.Errorf("expected score between 0 and 1, got %f", refreshed.Score)
	}
}

func TestRefreshRoute_BridgeRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}

	bridgeProvider := &mockBridgeProvider{
		quote: &BridgeQuote{
			Protocol:      "LayerZero",
			InputAmount:   "1000000000",
			OutputAmount:  "998000000",
			Fee:           "200000",
			EstimatedTime: 120,
			ValidUntil:    time.Now().Add(5 * time.Minute),
		},
	}

	router := NewRouter(nil, provider, nil, bridgeProvider, nil)

	intent := &Intent{
		Amount:      "1000000000",
		Asset:       "USDT",
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		InputAmount:    "1000000000",
		OutputAmount:   "999000000",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
		ValidUntil:     time.Now().Add(-1 * time.Minute),
	}

	ctx := context.Background()
	refreshed, err := router.RefreshRoute(ctx, intent, route)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Output amount should be updated from new quote
	if refreshed.OutputAmount != "998000000" {
		t.Errorf("expected output amount '998000000', got %s", refreshed.OutputAmount)
	}
	// Gas should be updated from quote fee
	if refreshed.EstimatedGas != "200000" {
		t.Errorf("expected estimated gas '200000', got %s", refreshed.EstimatedGas)
	}
	// Estimated time should be updated
	if refreshed.EstimatedTime != 120 {
		t.Errorf("expected estimated time 120, got %d", refreshed.EstimatedTime)
	}
	// Slippage should be recalculated: (1000000000 - 998000000) / 1000000000 = 0.002
	if refreshed.Slippage < 0.001 || refreshed.Slippage > 0.003 {
		t.Errorf("expected slippage around 0.002, got %f", refreshed.Slippage)
	}
}

func TestRefreshRoute_BridgeQuoteError(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}

	bridgeProvider := &mockBridgeProvider{
		quoteErr: errors.New("bridge unavailable"),
	}

	router := NewRouter(nil, provider, nil, bridgeProvider, nil)

	intent := &Intent{
		Amount:      "1000000000",
		Asset:       "USDT",
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	route := &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	ctx := context.Background()
	_, err := router.RefreshRoute(ctx, intent, route)
	if err == nil {
		t.Error("expected error for failed bridge quote")
	}
}

// ============== scoreRoute Tests ==============

func TestScoreRoute_DirectRoute(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		Slippage:       0,
		EstimatedTime:  15,
		RequiresBridge: false,
		Steps:          []*RouteStep{{Order: 1}},
	}

	intent := &Intent{
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	score := router.scoreRoute(route, intent)

	// Direct route with no slippage, fast time, single step should score very high
	if score < 0.9 {
		t.Errorf("expected score >= 0.9 for optimal direct route, got %f", score)
	}
}

func TestScoreRoute_BridgeRoutePenalized(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	directRoute := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		Slippage:       0,
		EstimatedTime:  15,
		RequiresBridge: false,
		Steps:          []*RouteStep{{Order: 1}},
	}

	bridgeRoute := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		Slippage:       0,
		EstimatedTime:  15,
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
		Steps:          []*RouteStep{{Order: 1}},
	}

	intent := &Intent{
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	directScore := router.scoreRoute(directRoute, intent)
	bridgeScore := router.scoreRoute(bridgeRoute, intent)

	if bridgeScore >= directScore {
		t.Errorf("bridge route (%f) should score lower than direct route (%f)", bridgeScore, directScore)
	}
}

func TestScoreRoute_UrgentPriorityPenalizesSlowRoutes(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:1",
		EstimatedTime:  1800, // 30 minutes
		RequiresBridge: false,
		Steps:          []*RouteStep{{Order: 1}},
	}

	urgentIntent := &Intent{
		MaxSlippage: 0.01,
		Priority:    PriorityUrgent,
	}

	lowIntent := &Intent{
		MaxSlippage: 0.01,
		Priority:    PriorityLow,
	}

	urgentScore := router.scoreRoute(route, urgentIntent)
	lowScore := router.scoreRoute(route, lowIntent)

	if urgentScore >= lowScore {
		t.Errorf("urgent score (%f) should be lower than low-priority score (%f) for slow routes",
			urgentScore, lowScore)
	}
}

func TestScoreRoute_HighFailureRatePenalized(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		Slippage:       0,
		EstimatedTime:  15,
		RequiresBridge: true,
		BridgeProtocol: "UnreliableBridge",
		Steps:          []*RouteStep{{Order: 1}},
	}

	intent := &Intent{
		MaxSlippage: 0.01,
		Priority:    PriorityNormal,
	}

	// Score without failure history
	scoreWithoutHistory := router.scoreRoute(route, intent)

	// Record many failures
	for i := 0; i < 10; i++ {
		router.RecordRouteFailure(route)
	}

	// Score with failure history
	scoreWithHistory := router.scoreRoute(route, intent)

	if scoreWithHistory >= scoreWithoutHistory {
		t.Errorf("score with failure history (%f) should be lower than without (%f)",
			scoreWithHistory, scoreWithoutHistory)
	}
}

// ============== Concurrent Route Stats Tests ==============

func TestRecordRouteStats_ConcurrentAccess(t *testing.T) {
	provider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, provider, nil, nil, nil)

	route := &Route{
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		RequiresBridge: true,
		BridgeProtocol: "LayerZero",
	}

	var wg sync.WaitGroup

	// Launch concurrent success/failure recordings
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			router.RecordRouteSuccess(route)
		}()
		go func() {
			defer wg.Done()
			router.RecordRouteFailure(route)
		}()
	}

	wg.Wait()

	stats := router.GetRouteStats("LayerZero", "eip155:1", "eip155:8453")
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.SuccessCount != 100 {
		t.Errorf("expected 100 successes, got %d", stats.SuccessCount)
	}
	if stats.FailureCount != 100 {
		t.Errorf("expected 100 failures, got %d", stats.FailureCount)
	}
}

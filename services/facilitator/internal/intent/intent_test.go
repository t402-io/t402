package intent

import (
	"context"
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

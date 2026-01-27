package intent

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============== Mock Transaction ==============

type mockTx struct {
	repo         *mockRepository
	committed    bool
	rolledBack   bool
	commitErr    error
	rollbackErr  error
}

func (t *mockTx) Commit() error {
	if t.commitErr != nil {
		return t.commitErr
	}
	t.committed = true
	t.repo.mu.Lock()
	t.repo.txCommitted = true
	t.repo.mu.Unlock()
	return nil
}

func (t *mockTx) Rollback() error {
	if t.rollbackErr != nil {
		return t.rollbackErr
	}
	t.rolledBack = true
	t.repo.mu.Lock()
	t.repo.txRolledBack = true
	t.repo.mu.Unlock()
	return nil
}

// ============== Mock Repository ==============

type mockRepository struct {
	intents      map[string]*Intent
	mu           sync.RWMutex
	txStarted    bool
	txCommitted  bool
	txRolledBack bool
	beginTxErr   error
	forUpdateErr error
	createErr    error
	updateErr    error
	updateInTxErr error
}

// Ensure mockRepository implements RepositoryInterface
var _ RepositoryInterface = (*mockRepository)(nil)

func newMockRepository() *mockRepository {
	return &mockRepository{
		intents: make(map[string]*Intent),
	}
}

func (m *mockRepository) BeginTx(ctx context.Context) (TxInterface, error) {
	if m.beginTxErr != nil {
		return nil, m.beginTxErr
	}
	m.mu.Lock()
	m.txStarted = true
	m.mu.Unlock()
	return &mockTx{repo: m}, nil
}

func (m *mockRepository) Create(ctx context.Context, intent *Intent) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if intent.ID == "" {
		intent.ID = generateID()
	}
	intent.CreatedAt = time.Now()
	m.intents[intent.ID] = intent
	return nil
}

func (m *mockRepository) GetByID(ctx context.Context, id string) (*Intent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if intent, ok := m.intents[id]; ok {
		return intent, nil
	}
	return nil, ErrIntentNotFound
}

func (m *mockRepository) GetByIDForUpdate(ctx context.Context, tx TxInterface, id string) (*Intent, error) {
	if m.forUpdateErr != nil {
		return nil, m.forUpdateErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if intent, ok := m.intents[id]; ok {
		return intent, nil
	}
	return nil, ErrIntentNotFound
}

func (m *mockRepository) Update(ctx context.Context, intent *Intent) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.intents[intent.ID]; !ok {
		return ErrIntentNotFound
	}
	m.intents[intent.ID] = intent
	return nil
}

func (m *mockRepository) UpdateInTx(ctx context.Context, tx TxInterface, intent *Intent) error {
	if m.updateInTxErr != nil {
		return m.updateInTxErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.intents[intent.ID]; !ok {
		return ErrIntentNotFound
	}
	m.intents[intent.ID] = intent
	return nil
}

func (m *mockRepository) UpdateStatus(ctx context.Context, id string, status IntentStatus, errorMsg string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if intent, ok := m.intents[id]; ok {
		intent.Status = status
		intent.ErrorMessage = errorMsg
		return nil
	}
	return ErrIntentNotFound
}

func (m *mockRepository) List(ctx context.Context, filter ListIntentsRequest) ([]*Intent, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []*Intent
	for _, intent := range m.intents {
		// Apply filters
		if filter.Payer != "" && intent.Payer != filter.Payer {
			continue
		}
		if filter.Payee != "" && intent.Payee != filter.Payee {
			continue
		}
		if len(filter.Status) > 0 {
			found := false
			for _, s := range filter.Status {
				if intent.Status == s {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		results = append(results, intent)
	}

	total := int64(len(results))

	// Apply pagination
	start := filter.Offset
	if start > len(results) {
		start = len(results)
	}
	end := start + filter.Limit
	if end > len(results) {
		end = len(results)
	}
	if filter.Limit <= 0 {
		end = len(results)
	}

	return results[start:end], total, nil
}

func (m *mockRepository) GetExpiredIntents(ctx context.Context) ([]*Intent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var expired []*Intent
	now := time.Now()
	for _, intent := range m.intents {
		if intent.Status == IntentStatusPending && now.After(intent.ExpiresAt) {
			expired = append(expired, intent)
		}
	}
	return expired, nil
}

func (m *mockRepository) GetPendingIntents(ctx context.Context, limit int) ([]*Intent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var pending []*Intent
	for _, intent := range m.intents {
		if intent.Status == IntentStatusPending {
			pending = append(pending, intent)
			if len(pending) >= limit {
				break
			}
		}
	}
	return pending, nil
}

func (m *mockRepository) CountByStatus(ctx context.Context) (map[IntentStatus]int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	counts := make(map[IntentStatus]int64)
	for _, intent := range m.intents {
		counts[intent.Status]++
	}
	return counts, nil
}

// ============== Mock Router ==============

type mockRouter struct {
	routes          []*Route
	findRoutesErr   error
	validateErr     error
	refreshedRoute  *Route
	refreshErr      error
}

// ============== Test Helpers ==============

var intentCounter int64

func generateID() string {
	n := atomic.AddInt64(&intentCounter, 1)
	return "test-intent-" + time.Now().Format("20060102150405") + "-" + string(rune(n+'a'))
}

type testableService struct {
	*Service
	mockRepo     *mockRepository
	mockVerifier *mockTestVerifier
	mockExecutor *mockTestExecutor
}

type mockTestVerifier struct {
	verifyResult bool
	verifyErr    error
}

func (m *mockTestVerifier) VerifyIntentSignature(ctx context.Context, network, payer, intentID, routeID, signature string) (bool, error) {
	return m.verifyResult, m.verifyErr
}

type mockTestExecutor struct {
	txHashes    []string
	execErr     error
	execCalled  bool
}

func (m *mockTestExecutor) ExecutePayment(ctx context.Context, route *Route, payer, payee string) ([]string, error) {
	m.execCalled = true
	return m.txHashes, m.execErr
}

func newTestableService() *testableService {
	mockRepo := newMockRepository()
	mockVerifier := &mockTestVerifier{verifyResult: true}
	mockExecutor := &mockTestExecutor{txHashes: []string{"0xtxhash"}}

	// Create a mock router with default routes
	mockProvider := &mockNetworkProvider{
		networks: []string{"eip155:1", "eip155:8453"},
	}
	router := NewRouter(nil, mockProvider, nil, nil, nil)

	config := &ServiceConfig{
		DefaultExpiry:    5 * time.Minute,
		MaxExpiry:        1 * time.Hour,
		DefaultSlippage:  0.005,
		AutoExecute:      false,
		ExecutionWorkers: 1,
	}

	service := NewService(mockRepo, router, mockVerifier, mockExecutor, nil, config)

	return &testableService{
		Service:      service,
		mockRepo:     mockRepo,
		mockVerifier: mockVerifier,
		mockExecutor: mockExecutor,
	}
}

func (ts *testableService) createTestIntent(status IntentStatus, expiresAt time.Time) *Intent {
	intent := &Intent{
		ID:             generateID(),
		Payer:          "0xPayer",
		Payee:          "0xPayee",
		Amount:         "1000000000",
		Asset:          "USDT",
		SourceNetworks: []string{"eip155:1"},
		TargetNetwork:  "eip155:8453",
		MaxSlippage:    0.005,
		Priority:       PriorityNormal,
		Status:         status,
		CreatedAt:      time.Now(),
		ExpiresAt:      expiresAt,
		AvailableRoutes: []*Route{
			{
				ID:            "route-1",
				SourceNetwork: "eip155:1",
				TargetNetwork: "eip155:8453",
				InputAmount:   "1000000000",
				OutputAmount:  "999500000",
				Score:         0.9,
				ValidUntil:    time.Now().Add(5 * time.Minute),
			},
		},
	}

	ts.mockRepo.mu.Lock()
	ts.mockRepo.intents[intent.ID] = intent
	ts.mockRepo.mu.Unlock()

	return intent
}

// ============== CreateIntent Tests ==============

func TestCreateIntent_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	req := &CreateIntentRequest{
		Payer:          "0xPayer",
		Payee:          "0xPayee",
		Amount:         "1000000000",
		Asset:          "USDT",
		SourceNetworks: []string{"eip155:1"},
		TargetNetwork:  "eip155:8453",
		MaxSlippage:    0.01,
		Priority:       PriorityNormal,
	}

	resp, err := ts.CreateIntent(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.NotEmpty(t, resp.Intent.ID)
	assert.Equal(t, IntentStatusPending, resp.Intent.Status)
	assert.Equal(t, "0xPayer", resp.Intent.Payer)
	assert.Equal(t, "0xPayee", resp.Intent.Payee)
}

func TestCreateIntent_InvalidRequest(t *testing.T) {
	tests := []struct {
		name string
		req  *CreateIntentRequest
	}{
		{
			name: "empty amount",
			req: &CreateIntentRequest{
				Payer: "0xPayer",
				Asset: "USDT",
			},
		},
		{
			name: "empty asset",
			req: &CreateIntentRequest{
				Payer:  "0xPayer",
				Amount: "1000000000",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := newTestableService()
			ctx := context.Background()

			_, err := ts.CreateIntent(ctx, tt.req)
			assert.Error(t, err)
		})
	}
}

func TestCreateIntent_DefaultValues(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	req := &CreateIntentRequest{
		Payer:  "0xPayer",
		Amount: "1000000000",
		Asset:  "USDT",
		// No MaxSlippage, Priority, or ExpiresIn - should use defaults
	}

	resp, err := ts.CreateIntent(ctx, req)
	require.NoError(t, err)

	// Check defaults were applied
	assert.Equal(t, ts.config.DefaultSlippage, resp.Intent.MaxSlippage)
	assert.Equal(t, PriorityNormal, resp.Intent.Priority)

	// Expiry should be set
	assert.False(t, resp.Intent.ExpiresAt.IsZero())
}

// ============== SelectRoute Tests ==============

func TestSelectRoute_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create a pending intent with routes
	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	req := &SelectRouteRequest{
		IntentID: intent.ID,
		RouteID:  "route-1",
	}

	resp, err := ts.SelectRoute(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, IntentStatusRouted, resp.Intent.Status)
	assert.NotNil(t, resp.Intent.SelectedRoute)
	assert.Equal(t, "route-1", resp.Intent.SelectedRoute.ID)
}

func TestSelectRoute_IntentNotPending(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an already routed intent
	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusRouted, expires)

	req := &SelectRouteRequest{
		IntentID: intent.ID,
		RouteID:  "route-1",
	}

	_, err := ts.SelectRoute(ctx, req)
	assert.Error(t, err)
	assert.Equal(t, ErrIntentNotPending, err)
}

func TestSelectRoute_IntentExpired(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an expired intent
	expires := time.Now().Add(-1 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	req := &SelectRouteRequest{
		IntentID: intent.ID,
		RouteID:  "route-1",
	}

	_, err := ts.SelectRoute(ctx, req)
	assert.Error(t, err)
	assert.Equal(t, ErrIntentExpired, err)
}

func TestSelectRoute_RouteNotFound(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	req := &SelectRouteRequest{
		IntentID: intent.ID,
		RouteID:  "nonexistent-route",
	}

	_, err := ts.SelectRoute(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "route not found")
}

// ============== ExecuteIntent Tests ==============

func TestExecuteIntent_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create a routed intent
	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusRouted, expires)
	intent.SelectedRoute = intent.AvailableRoutes[0]
	ts.mockRepo.Update(ctx, intent)

	req := &ExecuteIntentRequest{
		IntentID:  intent.ID,
		Signature: "valid-signature",
	}

	resp, err := ts.ExecuteIntent(ctx, req)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, IntentStatusCompleted, resp.Intent.Status)
	assert.NotEmpty(t, resp.TxHashes)
}

func TestExecuteIntent_NotRouted(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create a pending intent (not routed)
	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	req := &ExecuteIntentRequest{
		IntentID:  intent.ID,
		Signature: "valid-signature",
	}

	_, err := ts.ExecuteIntent(ctx, req)
	assert.Error(t, err)
	assert.Equal(t, ErrIntentNotRouted, err)
}

func TestExecuteIntent_InvalidSignature(t *testing.T) {
	ts := newTestableService()
	ts.mockVerifier.verifyResult = false
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusRouted, expires)
	intent.SelectedRoute = intent.AvailableRoutes[0]
	ts.mockRepo.Update(ctx, intent)

	req := &ExecuteIntentRequest{
		IntentID:  intent.ID,
		Signature: "invalid-signature",
	}

	_, err := ts.ExecuteIntent(ctx, req)
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidSignature, err)
}

func TestExecuteIntent_ExecutionError(t *testing.T) {
	ts := newTestableService()
	ts.mockExecutor.execErr = errors.New("execution failed")
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusRouted, expires)
	intent.SelectedRoute = intent.AvailableRoutes[0]
	ts.mockRepo.Update(ctx, intent)

	req := &ExecuteIntentRequest{
		IntentID:  intent.ID,
		Signature: "valid-signature",
	}

	// ExecuteIntent doesn't return an error on execution failure
	// It marks the intent as Failed but returns a response with status info
	resp, err := ts.ExecuteIntent(ctx, req)
	require.NoError(t, err)
	assert.Equal(t, IntentStatusFailed, resp.Intent.Status)
	assert.NotEmpty(t, resp.Message)

	// Verify intent status is marked as failed
	updatedIntent, _ := ts.mockRepo.GetByID(ctx, intent.ID)
	assert.Equal(t, IntentStatusFailed, updatedIntent.Status)
}

// ============== GetIntent Tests ==============

func TestGetIntent_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	result, err := ts.GetIntent(ctx, intent.ID)
	require.NoError(t, err)
	assert.Equal(t, intent.ID, result.Intent.ID)
	assert.Equal(t, intent.Payer, result.Intent.Payer)
}

func TestGetIntent_NotFound(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	_, err := ts.GetIntent(ctx, "nonexistent-id")
	assert.Error(t, err)
	assert.Equal(t, ErrIntentNotFound, err)
}

// ============== ListIntents Tests ==============

func TestListIntents_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create multiple intents
	expires := time.Now().Add(5 * time.Minute)
	for i := 0; i < 5; i++ {
		ts.createTestIntent(IntentStatusPending, expires)
	}

	resp, err := ts.ListIntents(ctx, ListIntentsRequest{
		Limit: 10,
	})
	require.NoError(t, err)
	assert.Len(t, resp.Intents, 5)
	assert.Equal(t, int64(5), resp.Total)
}

func TestListIntents_FilterByStatus(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)

	// Create intents with different statuses
	for i := 0; i < 3; i++ {
		ts.createTestIntent(IntentStatusPending, expires)
	}
	for i := 0; i < 2; i++ {
		ts.createTestIntent(IntentStatusRouted, expires)
	}

	resp, err := ts.ListIntents(ctx, ListIntentsRequest{
		Status: []IntentStatus{IntentStatusPending},
		Limit:  10,
	})
	require.NoError(t, err)
	assert.Len(t, resp.Intents, 3)
}

func TestListIntents_FilterByPayer(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)

	// Create an intent with a specific payer
	intent := ts.createTestIntent(IntentStatusPending, expires)
	intent.Payer = "0xSpecificPayer"
	ts.mockRepo.Update(ctx, intent)

	// Create other intents
	for i := 0; i < 3; i++ {
		ts.createTestIntent(IntentStatusPending, expires)
	}

	resp, err := ts.ListIntents(ctx, ListIntentsRequest{
		Payer: "0xSpecificPayer",
		Limit: 10,
	})
	require.NoError(t, err)
	assert.Len(t, resp.Intents, 1)
}

// ============== CancelIntent Tests ==============

func TestCancelIntent_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	req := &CancelIntentRequest{
		IntentID: intent.ID,
		Reason:   "user cancelled",
	}

	err := ts.CancelIntent(ctx, req)
	require.NoError(t, err)

	// Verify status changed
	updatedIntent, _ := ts.mockRepo.GetByID(ctx, intent.ID)
	assert.Equal(t, IntentStatusCancelled, updatedIntent.Status)
}

func TestCancelIntent_AlreadyExecuted(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)
	intent := ts.createTestIntent(IntentStatusCompleted, expires)

	req := &CancelIntentRequest{
		IntentID: intent.ID,
		Reason:   "user cancelled",
	}

	err := ts.CancelIntent(ctx, req)
	assert.Error(t, err)
}

// ============== ProcessExpiredIntents Tests ==============

func TestProcessExpiredIntents(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an expired intent
	expires := time.Now().Add(-1 * time.Hour)
	intent := ts.createTestIntent(IntentStatusPending, expires)

	// Process expired intents
	ts.processExpiredIntents()

	// Verify intent was marked as expired
	updatedIntent, _ := ts.mockRepo.GetByID(ctx, intent.ID)
	assert.Equal(t, IntentStatusExpired, updatedIntent.Status)
}

// ============== Service Start/Stop Tests ==============

func TestServiceStartStop(t *testing.T) {
	ts := newTestableService()

	// Start service (background workers)
	ts.Start()

	// Give workers time to start
	time.Sleep(50 * time.Millisecond)

	// Stop service
	ts.Stop()

	// No panic or hang indicates success
}

// ============== Configuration Tests ==============

func TestServiceWithCustomConfig(t *testing.T) {
	repo := newMockRepository()
	verifier := &mockTestVerifier{verifyResult: true}
	executor := &mockTestExecutor{txHashes: []string{"0x123"}}

	customConfig := &ServiceConfig{
		DefaultExpiry:    10 * time.Minute,
		MaxExpiry:        2 * time.Hour,
		DefaultSlippage:  0.01,
		AutoExecute:      true,
		ExecutionWorkers: 10,
	}

	service := NewService(repo, nil, verifier, executor, nil, customConfig)

	assert.Equal(t, 10*time.Minute, service.config.DefaultExpiry)
	assert.Equal(t, 2*time.Hour, service.config.MaxExpiry)
	assert.Equal(t, 0.01, service.config.DefaultSlippage)
	assert.True(t, service.config.AutoExecute)
	assert.Equal(t, 10, service.config.ExecutionWorkers)
}

// ============== CountByStatus Tests ==============

func TestCountByStatus(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expires := time.Now().Add(5 * time.Minute)

	// Create intents with various statuses
	for i := 0; i < 3; i++ {
		ts.createTestIntent(IntentStatusPending, expires)
	}
	for i := 0; i < 2; i++ {
		ts.createTestIntent(IntentStatusRouted, expires)
	}
	ts.createTestIntent(IntentStatusCompleted, expires)

	counts, err := ts.mockRepo.CountByStatus(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(3), counts[IntentStatusPending])
	assert.Equal(t, int64(2), counts[IntentStatusRouted])
	assert.Equal(t, int64(1), counts[IntentStatusCompleted])
}

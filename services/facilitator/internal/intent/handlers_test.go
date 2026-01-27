package intent

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ============== Helper Functions ==============

func setupTestIntentRouter(h *Handlers) *gin.Engine {
	router := gin.New()
	rg := router.Group("/v1")
	h.RegisterRoutes(rg)
	return router
}

func createTestIntentHandlers(repo RepositoryInterface) *Handlers {
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

	mockVerifier := &mockTestVerifier{verifyResult: true}
	mockExecutor := &mockTestExecutor{txHashes: []string{"0xtxhash"}}

	service := NewService(repo, router, mockVerifier, mockExecutor, nil, config)
	return NewHandlers(service)
}

// ============== Test Handler Construction ==============

func TestNewIntentHandlers(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)

	assert.NotNil(t, handlers)
	assert.NotNil(t, handlers.service)
}

func TestRegisterIntentRoutes(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Verify routes are registered
	routes := router.Routes()
	expectedPaths := []string{
		"/v1/intent",
		"/v1/intent/:id",
		"/v1/intent/:id/route",
		"/v1/intent/:id/execute",
		"/v1/intent/:id/cancel",
		"/v1/intent/:id/refresh",
		"/v1/intent/stats",
	}

	registeredPaths := make(map[string]bool)
	for _, route := range routes {
		registeredPaths[route.Path] = true
	}

	for _, path := range expectedPaths {
		assert.True(t, registeredPaths[path], "Expected route %s to be registered", path)
	}
}

// ============== Test CreateIntent Handler ==============

func TestHandler_CreateIntent_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "invalid_request", resp.Error)
}

func TestHandler_CreateIntent_MissingRequiredFields(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Missing payer field
	reqBody := CreateIntentRequest{
		Payee:  "0x5678",
		Amount: "1000000",
		Asset:  "USDT",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_CreateIntent_EmptyAmountOrAsset(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Empty amount
	reqBody := CreateIntentRequest{
		Payer:  "0x1234",
		Payee:  "0x5678",
		Amount: "",
		Asset:  "USDT",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Service returns invalid_intent error for empty amount/asset
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_CreateIntent_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	reqBody := CreateIntentRequest{
		Payer:          "0x1234567890123456789012345678901234567890",
		Payee:          "0x0987654321098765432109876543210987654321",
		Amount:         "1000000",
		Asset:          "USDT",
		SourceNetworks: []string{"eip155:1"},
		TargetNetwork:  "eip155:8453",
		Priority:       PriorityNormal,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp CreateIntentResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.Intent.ID)
	assert.Equal(t, IntentStatusPending, resp.Intent.Status)
}

// ============== Test GetIntent Handler ==============

func TestHandler_GetIntent_EmptyID(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/intent/", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// With gin, empty path segment results in 301 redirect or 200 (list endpoint)
	assert.True(t, w.Code == http.StatusMovedPermanently || w.Code == http.StatusOK)
}

func TestHandler_GetIntent_NotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/intent/nonexistent", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "intent_not_found", resp.Error)
}

func TestHandler_GetIntent_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create an intent first
	intent := &Intent{
		ID:        "test-intent-1",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	mock.Create(context.Background(), intent)

	req := httptest.NewRequest(http.MethodGet, "/v1/intent/test-intent-1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp GetIntentResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "test-intent-1", resp.Intent.ID)
}

// ============== Test SelectRoute Handler ==============

func TestHandler_SelectRoute_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/test-id/route", bytes.NewBufferString("invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_SelectRoute_IntentNotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	reqBody := SelectRouteRequest{
		IntentID: "nonexistent", // Required by binding
		RouteID:  "route-1",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/nonexistent/route", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_SelectRoute_IntentNotPending(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create an already routed intent
	intent := &Intent{
		ID:        "routed-intent",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusRouted, // Already routed
		Priority:  PriorityNormal,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	mock.Create(context.Background(), intent)

	reqBody := SelectRouteRequest{
		IntentID: "routed-intent", // Required by binding
		RouteID:  "route-1",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/routed-intent/route", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "intent_not_pending", resp.Error)
}

func TestHandler_SelectRoute_IntentExpired(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create an expired intent
	intent := &Intent{
		ID:        "expired-intent",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now().Add(-1 * time.Hour),
		ExpiresAt: time.Now().Add(-30 * time.Minute), // Expired
		AvailableRoutes: []*Route{
			{
				ID:            "route-1",
				SourceNetwork: "eip155:1",
				TargetNetwork: "eip155:8453",
				ValidUntil:    time.Now().Add(5 * time.Minute),
			},
		},
	}
	mock.Create(context.Background(), intent)

	reqBody := SelectRouteRequest{
		IntentID: "expired-intent", // Required by binding
		RouteID:  "route-1",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/expired-intent/route", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusGone, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "intent_expired", resp.Error)
}

// ============== Test ExecuteIntent Handler ==============

func TestHandler_ExecuteIntent_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/test-id/execute", bytes.NewBufferString("invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_ExecuteIntent_IntentNotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	reqBody := ExecuteIntentRequest{
		IntentID:  "nonexistent", // Required by binding
		Signature: "valid-sig",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/nonexistent/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_ExecuteIntent_NotRouted(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create a pending intent (not routed)
	intent := &Intent{
		ID:        "pending-intent",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
		// No SelectedRoute
	}
	mock.Create(context.Background(), intent)

	reqBody := ExecuteIntentRequest{
		IntentID:  "pending-intent", // Required by binding
		Signature: "valid-sig",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/pending-intent/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "no_route_selected", resp.Error)
}

// ============== Test CancelIntent Handler ==============

func TestHandler_CancelIntent_IntentNotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	reqBody := CancelIntentRequest{
		Reason: "user cancelled",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/nonexistent/cancel", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_CancelIntent_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create a pending intent
	intent := &Intent{
		ID:        "cancel-intent",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	mock.Create(context.Background(), intent)

	reqBody := CancelIntentRequest{
		Reason: "user cancelled",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/cancel-intent/cancel", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var result map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &result)
	require.NoError(t, err)
	assert.Equal(t, "cancelled", result["status"])
}

func TestHandler_CancelIntent_WithoutBody(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create a pending intent
	intent := &Intent{
		ID:        "cancel-intent-2",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	mock.Create(context.Background(), intent)

	// No body - cancel request is optional
	req := httptest.NewRequest(http.MethodPost, "/v1/intent/cancel-intent-2/cancel", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test RefreshRoutes Handler ==============

func TestHandler_RefreshRoutes_IntentNotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/nonexistent/refresh", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_RefreshRoutes_IntentExpired(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create an expired intent
	intent := &Intent{
		ID:        "refresh-expired",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Amount:    "1000000",
		Asset:     "USDT",
		Status:    IntentStatusPending,
		Priority:  PriorityNormal,
		CreatedAt: time.Now().Add(-1 * time.Hour),
		ExpiresAt: time.Now().Add(-30 * time.Minute), // Expired
	}
	mock.Create(context.Background(), intent)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/refresh-expired/refresh", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusGone, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "intent_expired", resp.Error)
}

func TestHandler_RefreshRoutes_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create a pending intent
	intent := &Intent{
		ID:             "refresh-intent",
		Payer:          "0x1234",
		Payee:          "0x5678",
		Amount:         "1000000",
		Asset:          "USDT",
		Status:         IntentStatusPending,
		Priority:       PriorityNormal,
		SourceNetworks: []string{"eip155:1"},
		TargetNetwork:  "eip155:8453",
		CreatedAt:      time.Now(),
		ExpiresAt:      time.Now().Add(5 * time.Minute),
	}
	mock.Create(context.Background(), intent)

	req := httptest.NewRequest(http.MethodPost, "/v1/intent/refresh-intent/refresh", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp RefreshRoutesResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.NotNil(t, resp.Intent)
}

// ============== Test ListIntents Handler ==============

func TestHandler_ListIntents_InvalidQuery(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/intent?limit=invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_ListIntents_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create some intents
	for i := 0; i < 3; i++ {
		intent := &Intent{
			ID:        "list-intent-" + string(rune('0'+i)),
			Payer:     "0x1234",
			Payee:     "0x5678",
			Amount:    "1000000",
			Asset:     "USDT",
			Status:    IntentStatusPending,
			Priority:  PriorityNormal,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(5 * time.Minute),
		}
		mock.Create(context.Background(), intent)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/intent?limit=10", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp ListIntentsResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(resp.Intents), 3)
}

func TestHandler_ListIntents_WithFilters(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/intent?payer=0x1234&status=pending&limit=20&offset=0", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test GetStats Handler ==============

func TestHandler_GetStats_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestIntentHandlers(mock)
	router := setupTestIntentRouter(handlers)

	// Create some intents with different statuses
	statuses := []IntentStatus{IntentStatusPending, IntentStatusPending, IntentStatusRouted, IntentStatusCompleted}
	for i, status := range statuses {
		intent := &Intent{
			ID:        "stats-intent-" + string(rune('0'+i)),
			Payer:     "0x1234",
			Payee:     "0x5678",
			Amount:    "1000000",
			Asset:     "USDT",
			Status:    status,
			Priority:  PriorityNormal,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(5 * time.Minute),
		}
		mock.Create(context.Background(), intent)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/intent/stats", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stats map[string]int64
	err := json.Unmarshal(w.Body.Bytes(), &stats)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stats["pending"])
	assert.Equal(t, int64(1), stats["routed"])
	assert.Equal(t, int64(1), stats["completed"])
}

// ============== Test ErrorResponse ==============

func TestHandler_IntentErrorResponse_Structure(t *testing.T) {
	resp := ErrorResponse{
		Error:   "test_error",
		Message: "Test error message",
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded ErrorResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "test_error", decoded.Error)
	assert.Equal(t, "Test error message", decoded.Message)
}

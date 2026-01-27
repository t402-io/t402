package streaming

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

func setupTestRouter(h *Handlers) *gin.Engine {
	router := gin.New()
	rg := router.Group("/v1")
	h.RegisterRoutes(rg)
	return router
}

func createTestHandlers(repo RepositoryInterface) *Handlers {
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0xabc123def456"}
	service := NewService(repo, verifier, settler, nil, nil)
	return NewHandlers(service)
}

// ============== Test Validation Functions ==============

func TestValidateStringLength(t *testing.T) {
	tests := []struct {
		name     string
		s        string
		maxLen   int
		expected bool
	}{
		{"empty string", "", 10, true},
		{"within limit", "hello", 10, true},
		{"at limit", "hello", 5, true},
		{"exceeds limit", "hello world", 5, false},
		{"zero max length", "a", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateStringLength(tt.s, tt.maxLen)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected string
	}{
		{"nil error", nil, "unknown error"},
		{"normal error", errors.New("validation failed"), "validation failed"},
		{"sql error", errors.New("sql: no rows in result set"), "internal error"},
		{"pq error", errors.New("pq: connection refused"), "internal error"},
		{"redis error", errors.New("redis: connection timeout"), "internal error"},
		{"path in error", errors.New("/var/log/error.log not found"), "internal error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ============== Test Handler Construction ==============

func TestNewHandlers(t *testing.T) {
	mock := newMockRepository()
	service := NewService(mock, nil, nil, nil, nil)
	handlers := NewHandlers(service)

	assert.NotNil(t, handlers)
	assert.NotNil(t, handlers.service)
}

func TestRegisterRoutes(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Verify routes are registered
	routes := router.Routes()
	expectedPaths := []string{
		"/v1/stream/open",
		"/v1/stream/update",
		"/v1/stream/close",
		"/v1/stream/:id",
		"/v1/stream/:id/pause",
		"/v1/stream/:id/resume",
		"/v1/stream",
	}

	registeredPaths := make(map[string]bool)
	for _, route := range routes {
		registeredPaths[route.Path] = true
	}

	for _, path := range expectedPaths {
		assert.True(t, registeredPaths[path], "Expected route %s to be registered", path)
	}
}

// ============== Test OpenStream Handler ==============

func TestHandler_OpenStream_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/open", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "invalid_request", resp.Error)
}

func TestHandler_OpenStream_ExceedsFieldLength(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create request with field exceeding max length
	longNetwork := make([]byte, MaxNetworkLength+1)
	for i := range longNetwork {
		longNetwork[i] = 'a'
	}

	reqBody := OpenStreamRequest{
		Network:   string(longNetwork),
		Scheme:    "exact",
		Payer:     "0x1234",
		Payee:     "0x5678",
		Asset:     "USDT",
		MaxAmount: "1000000",
		Signature: "valid-sig",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/open", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "invalid_request", resp.Error)
	assert.Contains(t, resp.Message, "exceed maximum allowed length")
}

func TestHandler_OpenStream_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	expires := time.Now().Add(24 * time.Hour)
	reqBody := OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890123456789012345678901234567890",
		Payee:     "0x0987654321098765432109876543210987654321",
		Asset:     "USDT",
		MaxAmount: "1000000",
		Signature: "valid-sig",
		ExpiresAt: &expires,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/open", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp OpenStreamResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.Stream.ID)
}

// ============== Test UpdateStream Handler ==============

func TestHandler_UpdateStream_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/update", bytes.NewBufferString("invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_UpdateStream_ExceedsFieldLength(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	longStreamID := make([]byte, MaxStreamIDLength+1)
	for i := range longStreamID {
		longStreamID[i] = 'a'
	}

	reqBody := UpdateStreamRequest{
		StreamID: string(longStreamID),
		Amount:   "100",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/update", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_UpdateStream_StreamNotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	reqBody := UpdateStreamRequest{
		StreamID:  "nonexistent",
		Amount:    "100",
		Signature: "valid-sig",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/update", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ============== Test CloseStream Handler ==============

func TestHandler_CloseStream_InvalidJSON(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/close", bytes.NewBufferString("invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_CloseStream_ExceedsFieldLength(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	longReason := make([]byte, MaxReasonLength+1)
	for i := range longReason {
		longReason[i] = 'a'
	}

	reqBody := CloseStreamRequest{
		StreamID:    "stream-1",
		FinalAmount: "100",
		Reason:      string(longReason),
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/close", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ============== Test GetStream Handler ==============

func TestHandler_GetStream_EmptyID(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Note: gin will match /:id with empty string as 404, not bad request
	req := httptest.NewRequest(http.MethodGet, "/v1/stream/", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// With gin, empty path segment results in 301 redirect or 404
	assert.True(t, w.Code == http.StatusMovedPermanently || w.Code == http.StatusNotFound)
}

func TestHandler_GetStream_NotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/stream/nonexistent", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_GetStream_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create a stream first
	stream := &Stream{
		ID:        "test-stream-1",
		Network:   "eip155:1",
		Scheme:    "exact",
		Status:    StreamStatusActive,
		Payer:     "0x1234",
		Payee:     "0x5678",
		MaxAmount: "1000000",
		CreatedAt: time.Now(),
		ExpiresAt: func() *time.Time { t := time.Now().Add(24 * time.Hour); return &t }(),
	}
	mock.Create(context.Background(), stream)

	req := httptest.NewRequest(http.MethodGet, "/v1/stream/test-stream-1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp GetStreamResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "test-stream-1", resp.Stream.ID)
}

func TestHandler_GetStream_WithUpdates(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create stream
	stream := &Stream{
		ID:        "test-stream-2",
		Network:   "eip155:1",
		Status:    StreamStatusActive,
		CreatedAt: time.Now(),
		ExpiresAt: func() *time.Time { t := time.Now().Add(24 * time.Hour); return &t }(),
	}
	mock.Create(context.Background(), stream)

	req := httptest.NewRequest(http.MethodGet, "/v1/stream/test-stream-2?include_updates=true", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test PauseStream Handler ==============

func TestHandler_PauseStream_EmptyID(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)

	router := gin.New()
	router.POST("/v1/stream/:id/pause", handlers.PauseStream)

	// Direct call with empty id param
	req := httptest.NewRequest(http.MethodPost, "/v1/stream//pause", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Router may return 400 (matched with empty id) or 404 (not matched)
	assert.True(t, w.Code == http.StatusNotFound || w.Code == http.StatusBadRequest)
}

func TestHandler_PauseStream_NotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/nonexistent/pause", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_PauseStream_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create active stream
	stream := &Stream{
		ID:        "pause-stream-1",
		Network:   "eip155:1",
		Status:    StreamStatusActive,
		Payer:     "0x1234",
		Payee:     "0x5678",
		CreatedAt: time.Now(),
		ExpiresAt: func() *time.Time { t := time.Now().Add(24 * time.Hour); return &t }(),
	}
	mock.Create(context.Background(), stream)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/pause-stream-1/pause", nil)
	req.Header.Set("X-Requester-Address", "0x5678") // Must be payee
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test ResumeStream Handler ==============

func TestHandler_ResumeStream_EmptyID(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream//resume", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Router may return 400 (matched with empty id) or 404 (not matched)
	assert.True(t, w.Code == http.StatusNotFound || w.Code == http.StatusBadRequest)
}

func TestHandler_ResumeStream_NotFound(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/nonexistent/resume", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandler_ResumeStream_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create paused stream
	stream := &Stream{
		ID:        "resume-stream-1",
		Network:   "eip155:1",
		Status:    StreamStatusPaused,
		Payer:     "0x1234",
		Payee:     "0x5678",
		CreatedAt: time.Now(),
		ExpiresAt: func() *time.Time { t := time.Now().Add(24 * time.Hour); return &t }(),
	}
	mock.Create(context.Background(), stream)

	req := httptest.NewRequest(http.MethodPost, "/v1/stream/resume-stream-1/resume", nil)
	req.Header.Set("X-Requester-Address", "0x5678") // Must be payee
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test ListStreams Handler ==============

func TestHandler_ListStreams_InvalidQuery(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/stream?limit=invalid", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_ListStreams_Success(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	// Create some streams
	for i := 0; i < 3; i++ {
		stream := &Stream{
			ID:        "list-stream-" + string(rune('0'+i)),
			Network:   "eip155:1",
			Status:    StreamStatusActive,
			CreatedAt: time.Now(),
			ExpiresAt: func() *time.Time { t := time.Now().Add(24 * time.Hour); return &t }(),
		}
		mock.Create(context.Background(), stream)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/stream?limit=10", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp ListStreamsResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(resp.Streams), 3)
}

func TestHandler_ListStreams_WithFilters(t *testing.T) {
	mock := newMockRepository()
	handlers := createTestHandlers(mock)
	router := setupTestRouter(handlers)

	req := httptest.NewRequest(http.MethodGet, "/v1/stream?network=eip155:1&status=active&limit=20&offset=0", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ============== Test Error Response ==============

func TestHandler_ErrorResponse_Structure(t *testing.T) {
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

// ============== Test Constants ==============

func TestInputValidationConstants(t *testing.T) {
	assert.Equal(t, 64, MaxStreamIDLength)
	assert.Equal(t, 128, MaxAddressLength)
	assert.Equal(t, 78, MaxAmountLength)
	assert.Equal(t, 256, MaxSignatureLength)
	assert.Equal(t, 64, MaxNetworkLength)
	assert.Equal(t, 32, MaxSchemeLength)
	assert.Equal(t, 128, MaxAssetLength)
	assert.Equal(t, 256, MaxReasonLength)
}

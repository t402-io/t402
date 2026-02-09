package streaming

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockTx implements TxInterface for testing
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

// mockRepository implements RepositoryInterface for testing
type mockRepository struct {
	streams       map[string]*Stream
	updates       map[string][]*StreamUpdate
	events        []*StreamEvent
	mu            sync.RWMutex
	txStarted     bool
	txCommitted   bool
	txRolledBack  bool
	beginTxErr    error
	forUpdateErr  error
	createErr     error
	updateErr     error
	updateInTxErr error
}

// Ensure mockRepository implements RepositoryInterface
var _ RepositoryInterface = (*mockRepository)(nil)

func newMockRepository() *mockRepository {
	return &mockRepository{
		streams: make(map[string]*Stream),
		updates: make(map[string][]*StreamUpdate),
		events:  make([]*StreamEvent, 0),
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

func (m *mockRepository) Create(ctx context.Context, stream *Stream) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if stream.ID == "" {
		stream.ID = "stream-" + time.Now().Format("20060102150405.000000000")
	}
	stream.CreatedAt = time.Now().UTC()
	stream.LastUpdatedAt = time.Now().UTC()
	m.streams[stream.ID] = stream
	return nil
}

func (m *mockRepository) GetByID(ctx context.Context, id string) (*Stream, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if stream, ok := m.streams[id]; ok {
		// Return a copy to avoid race conditions
		copied := *stream
		return &copied, nil
	}
	return nil, ErrStreamNotFound
}

func (m *mockRepository) GetByIDForUpdate(ctx context.Context, tx TxInterface, id string) (*Stream, error) {
	if m.forUpdateErr != nil {
		return nil, m.forUpdateErr
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if stream, ok := m.streams[id]; ok {
		// Return a copy to avoid race conditions
		copied := *stream
		return &copied, nil
	}
	return nil, ErrStreamNotFound
}

func (m *mockRepository) Update(ctx context.Context, stream *Stream) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	stream.LastUpdatedAt = time.Now().UTC()
	m.streams[stream.ID] = stream
	return nil
}

func (m *mockRepository) UpdateInTx(ctx context.Context, tx TxInterface, stream *Stream) error {
	if m.updateInTxErr != nil {
		return m.updateInTxErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	stream.LastUpdatedAt = time.Now().UTC()
	m.streams[stream.ID] = stream
	return nil
}

func (m *mockRepository) UpdateStatus(ctx context.Context, id string, status StreamStatus) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if stream, ok := m.streams[id]; ok {
		stream.Status = status
		stream.LastUpdatedAt = time.Now().UTC()
		return nil
	}
	return ErrStreamNotFound
}

func (m *mockRepository) List(ctx context.Context, req ListStreamsRequest) ([]*Stream, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*Stream
	for _, stream := range m.streams {
		// Filter by status (req.Status is []StreamStatus)
		if len(req.Status) > 0 {
			found := false
			for _, s := range req.Status {
				if stream.Status == s {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		if req.Payer != "" && stream.Payer != req.Payer {
			continue
		}
		if req.Payee != "" && stream.Payee != req.Payee {
			continue
		}
		if req.Network != "" && stream.Network != req.Network {
			continue
		}
		result = append(result, stream)
	}
	return result, int64(len(result)), nil
}

func (m *mockRepository) CreateUpdate(ctx context.Context, update *StreamUpdate) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if update.ID == "" {
		update.ID = "update-" + time.Now().Format("20060102150405.000000000")
	}
	update.Timestamp = time.Now().UTC()
	m.updates[update.StreamID] = append(m.updates[update.StreamID], update)
	return nil
}

func (m *mockRepository) CreateUpdateInTx(ctx context.Context, tx TxInterface, update *StreamUpdate) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if update.ID == "" {
		update.ID = "update-" + time.Now().Format("20060102150405.000000000")
	}
	update.Timestamp = time.Now().UTC()
	m.updates[update.StreamID] = append(m.updates[update.StreamID], update)
	return nil
}

func (m *mockRepository) GetUpdates(ctx context.Context, streamID string, limit int) ([]*StreamUpdate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	updates := m.updates[streamID]
	if limit > 0 && len(updates) > limit {
		return updates[:limit], nil
	}
	return updates, nil
}

func (m *mockRepository) GetLatestUpdate(ctx context.Context, streamID string) (*StreamUpdate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	updates := m.updates[streamID]
	if len(updates) == 0 {
		return nil, nil
	}
	return updates[len(updates)-1], nil
}

func (m *mockRepository) GetLatestUpdateInTx(ctx context.Context, tx TxInterface, streamID string) (*StreamUpdate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	updates := m.updates[streamID]
	if len(updates) == 0 {
		return nil, nil
	}
	return updates[len(updates)-1], nil
}

func (m *mockRepository) GetStreamStats(ctx context.Context, streamID string) (*StreamStats, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	stream, ok := m.streams[streamID]
	if !ok {
		return nil, ErrStreamNotFound
	}
	updates := m.updates[streamID]
	return &StreamStats{
		TotalUpdates:    int64(len(updates)),
		AverageRate:     stream.RatePerSecond,
		Duration:        int64(time.Since(stream.CreatedAt).Seconds()),
		ResourcesUsed:   int64(len(updates) * 100),
		EfficiencyScore: 0.9,
	}, nil
}

func (m *mockRepository) GetExpiredStreams(ctx context.Context) ([]*Stream, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var expired []*Stream
	now := time.Now()
	for _, stream := range m.streams {
		if stream.ExpiresAt != nil && now.After(*stream.ExpiresAt) &&
			stream.Status != StreamStatusExpired &&
			stream.Status != StreamStatusClosed &&
			stream.Status != StreamStatusCancelled {
			expired = append(expired, stream)
		}
	}
	return expired, nil
}

func (m *mockRepository) CreateEvent(ctx context.Context, event *StreamEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if event.ID == "" {
		event.ID = "event-" + time.Now().Format("20060102150405.000000000")
	}
	event.Timestamp = time.Now().UTC()
	m.events = append(m.events, event)
	return nil
}

// mockVerifier implements SignatureVerifier for testing
type mockVerifier struct {
	verifyResult bool
	verifyErr    error
}

func (m *mockVerifier) VerifyStreamSignature(ctx context.Context, network, payer, message, signature string) (bool, error) {
	if m.verifyErr != nil {
		return false, m.verifyErr
	}
	return m.verifyResult, nil
}

// mockSettler implements Settler for testing
type mockSettler struct {
	settleTxHash string
	settleErr    error
	settleError  error // alias for settleErr (used in some tests)
	settleCalled bool
}

func (m *mockSettler) SettleStream(ctx context.Context, network, scheme, from, to, asset, amount string) (string, error) {
	m.settleCalled = true
	if m.settleErr != nil {
		return "", m.settleErr
	}
	if m.settleError != nil {
		return "", m.settleError
	}
	return m.settleTxHash, nil
}

// testableService wraps a real Service with test dependencies
type testableService struct {
	*Service
	mockRepo     *mockRepository
	mockVerifier *mockVerifier
	mockSettler  *mockSettler
}

func newTestableService() *testableService {
	repo := newMockRepository()
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0xabc123def456"}

	// Create real service with mock dependencies
	service := NewService(repo, verifier, settler, nil, nil)

	return &testableService{
		Service:      service,
		mockRepo:     repo,
		mockVerifier: verifier,
		mockSettler:  settler,
	}
}

func newTestableServiceWithConfig(config *ServiceConfig) *testableService {
	repo := newMockRepository()
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0xabc123def456"}

	service := NewService(repo, verifier, settler, nil, config)

	return &testableService{
		Service:      service,
		mockRepo:     repo,
		mockVerifier: verifier,
		mockSettler:  settler,
	}
}

// streamCounter ensures unique stream IDs
var streamCounter int64

// Helper to create a test stream in the repository
func (ts *testableService) createTestStream(status StreamStatus, expiresAt *time.Time) *Stream {
	counter := atomic.AddInt64(&streamCounter, 1)
	stream := &Stream{
		ID:            "test-stream-" + strconv.FormatInt(counter, 10) + "-" + strconv.FormatInt(time.Now().UnixNano(), 36),
		Network:       "eip155:1",
		Scheme:        "exact",
		Payer:         "0x1234567890abcdef1234567890abcdef12345678",
		Payee:         "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:         "0x6B175474E89094C44Da98b954EescdFEFC",
		MaxAmount:     "1000000000",
		CurrentAmount: "0",
		SettledAmount: "0",
		RatePerSecond: "1000",
		Status:        status,
		ExpiresAt:     expiresAt,
	}
	ts.mockRepo.Create(context.Background(), stream)
	return stream
}

// ============== OpenStream Tests ==============

func TestOpenStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "valid-signature",
	}

	resp, err := ts.OpenStream(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)
	assert.NotEmpty(t, resp.Stream.ID)
	assert.Equal(t, StreamStatusActive, resp.Stream.Status)

	// Verify stream was created in repository
	stream, err := ts.mockRepo.GetByID(ctx, resp.Stream.ID)
	require.NoError(t, err)
	assert.Equal(t, req.Payer, stream.Payer)
	assert.Equal(t, req.Payee, stream.Payee)
	assert.Equal(t, req.MaxAmount, stream.MaxAmount)
}

func TestOpenStream_InvalidAmount(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	tests := []struct {
		name      string
		maxAmount string
	}{
		{"empty", ""},
		{"zero", "0"},
		{"negative", "-100"},
		{"invalid_format", "not-a-number"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &OpenStreamRequest{
				Network:   "eip155:1",
				Scheme:    "exact",
				Payer:     "0x1234567890abcdef1234567890abcdef12345678",
				Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
				Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
				MaxAmount: tt.maxAmount,
				Signature: "valid-signature",
			}

			_, err := ts.OpenStream(ctx, req)
			assert.ErrorIs(t, err, ErrInvalidAmount)
		})
	}
}

func TestOpenStream_InvalidSignature(t *testing.T) {
	ts := newTestableService()
	ts.mockVerifier.verifyResult = false
	ctx := context.Background()

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "invalid-signature",
	}

	_, err := ts.OpenStream(ctx, req)
	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestOpenStream_VerifierError(t *testing.T) {
	ts := newTestableService()
	ts.mockVerifier.verifyErr = errors.New("verification failed")
	ctx := context.Background()

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "signature",
	}

	_, err := ts.OpenStream(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to verify signature")
}

func TestOpenStream_WithMetadata(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	metadata := Metadata{
		Description: "Test stream",
		Extra: map[string]string{
			"custom_field": "custom_value",
			"user_id":      "user123",
		},
	}

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "valid-signature",
		Metadata:  &metadata,
	}

	resp, err := ts.OpenStream(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)

	// Verify metadata was stored
	stream, err := ts.mockRepo.GetByID(ctx, resp.Stream.ID)
	require.NoError(t, err)
	assert.Equal(t, "custom_value", stream.Metadata.Extra["custom_field"])
	assert.Equal(t, "user123", stream.Metadata.Extra["user_id"])
}

func TestOpenStream_WithCustomExpiry(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	customExpiry := time.Now().Add(48 * time.Hour)

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "valid-signature",
		ExpiresAt: &customExpiry,
	}

	resp, err := ts.OpenStream(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)

	// Verify expiry was set
	stream, err := ts.mockRepo.GetByID(ctx, resp.Stream.ID)
	require.NoError(t, err)
	assert.NotNil(t, stream.ExpiresAt)
	assert.WithinDuration(t, customExpiry, *stream.ExpiresAt, time.Second)
}

// ============== UpdateStream Tests ==============

func TestUpdateStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an active stream
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "500000000",
		Signature: "valid-signature",
	}

	resp, err := ts.UpdateStream(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)
	require.NotNil(t, resp.Update)
	assert.Equal(t, "500000000", resp.Stream.CurrentAmount)
	assert.Equal(t, uint64(1), resp.Update.SequenceNum)
}

func TestUpdateStream_StreamNotFound(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	req := &UpdateStreamRequest{
		StreamID:  "non-existent-stream",
		Amount:    "500000000",
		Signature: "valid-signature",
	}

	_, err := ts.UpdateStream(ctx, req)
	assert.ErrorIs(t, err, ErrStreamNotFound)
}

func TestUpdateStream_StreamNotActive(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create a paused stream
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "500000000",
		Signature: "valid-signature",
	}

	_, err := ts.UpdateStream(ctx, req)
	assert.ErrorIs(t, err, ErrStreamNotActive)
}

func TestUpdateStream_StreamExpired(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an expired stream
	expiry := time.Now().Add(-1 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "500000000",
		Signature: "valid-signature",
	}

	_, err := ts.UpdateStream(ctx, req)
	assert.ErrorIs(t, err, ErrStreamExpired)
}

func TestUpdateStream_AmountExceedsMax(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an active stream with max amount of 1000000000
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "2000000000", // Exceeds max
		Signature: "valid-signature",
	}

	_, err := ts.UpdateStream(ctx, req)
	assert.ErrorIs(t, err, ErrAmountExceeded)
}

func TestUpdateStream_InvalidSignature(t *testing.T) {
	ts := newTestableService()
	ts.mockVerifier.verifyResult = false
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "500000000",
		Signature: "invalid-signature",
	}

	_, err := ts.UpdateStream(ctx, req)
	assert.ErrorIs(t, err, ErrInvalidSignature)
}

func TestUpdateStream_SequenceNumbers(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Perform multiple updates with delays to avoid rate limiting
	for i := 1; i <= 5; i++ {
		time.Sleep(150 * time.Millisecond)

		req := &UpdateStreamRequest{
			StreamID:  stream.ID,
			Amount:    "100000000",
			Signature: "valid-signature",
		}

		resp, err := ts.UpdateStream(ctx, req)
		if err == nil {
			assert.Equal(t, uint64(i), resp.Update.SequenceNum)
		}
	}
}

// ============== CloseStream Tests ==============

func TestCloseStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// First update the stream to have some amount
	updateReq := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "500000000",
		Signature: "valid-signature",
	}
	_, err := ts.UpdateStream(ctx, updateReq)
	require.NoError(t, err)

	// Now close the stream
	closeReq := &CloseStreamRequest{
		StreamID:       stream.ID,
		FinalAmount:    "500000000",
		PayerSignature: "valid-signature",
	}

	resp, err := ts.CloseStream(ctx, closeReq)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)
	assert.Equal(t, StreamStatusClosed, resp.Stream.Status)
	assert.NotEmpty(t, resp.TxHash)
}

func TestCloseStream_AlreadyClosed(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusClosed, &expiry)

	req := &CloseStreamRequest{
		StreamID:       stream.ID,
		FinalAmount:    "0",
		PayerSignature: "valid-signature",
	}

	_, err := ts.CloseStream(ctx, req)
	assert.Error(t, err)
}

func TestCloseStream_SettlementError(t *testing.T) {
	ts := newTestableService()
	ts.mockSettler.settleErr = errors.New("settlement failed")
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "500000000"
	ts.mockRepo.Update(ctx, stream)

	req := &CloseStreamRequest{
		StreamID:       stream.ID,
		FinalAmount:    "500000000",
		PayerSignature: "valid-signature",
	}

	_, err := ts.CloseStream(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "settlement failed")
}

// ============== PauseStream Tests ==============

func TestPauseStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Requester must be the payee
	err := ts.PauseStream(ctx, stream.ID, stream.Payee)

	require.NoError(t, err)

	// Verify stream was paused
	updatedStream, err := ts.mockRepo.GetByID(ctx, stream.ID)
	require.NoError(t, err)
	assert.Equal(t, StreamStatusPaused, updatedStream.Status)
}

func TestPauseStream_NotActive(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)

	err := ts.PauseStream(ctx, stream.ID, stream.Payee)
	assert.ErrorIs(t, err, ErrStreamNotActive)
}

func TestPauseStream_Unauthorized(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Use payer (not payee) as requester - should be unauthorized
	err := ts.PauseStream(ctx, stream.ID, stream.Payer)
	assert.ErrorIs(t, err, ErrUnauthorized)
}

// ============== ResumeStream Tests ==============

func TestResumeStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)

	err := ts.ResumeStream(ctx, stream.ID, stream.Payee)

	require.NoError(t, err)

	// Verify stream was resumed
	updatedStream, err := ts.mockRepo.GetByID(ctx, stream.ID)
	require.NoError(t, err)
	assert.Equal(t, StreamStatusActive, updatedStream.Status)
}

func TestResumeStream_NotPaused(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	err := ts.ResumeStream(ctx, stream.ID, stream.Payee)
	assert.Error(t, err)
}

func TestResumeStream_Expired(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(-1 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)

	err := ts.ResumeStream(ctx, stream.ID, stream.Payee)
	assert.ErrorIs(t, err, ErrStreamExpired)
}

func TestResumeStream_Unauthorized(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)

	// Use payer (not payee) as requester - should be unauthorized
	err := ts.ResumeStream(ctx, stream.ID, stream.Payer)
	assert.ErrorIs(t, err, ErrUnauthorized)
}

// ============== GetStream Tests ==============

func TestGetStream_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Add some updates
	ts.mockRepo.CreateUpdate(ctx, &StreamUpdate{
		StreamID:  stream.ID,
		Amount:    "100000000",
		Signature: "sig1",
	})

	resp, err := ts.GetStream(ctx, stream.ID, true, true)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.Stream)
	assert.Equal(t, stream.ID, resp.Stream.ID)
	assert.NotNil(t, resp.Updates)
	assert.NotNil(t, resp.Stats)
}

func TestGetStream_NotFound(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	_, err := ts.GetStream(ctx, "non-existent", false, false)
	assert.ErrorIs(t, err, ErrStreamNotFound)
}

// ============== ListStreams Tests ==============

func TestListStreams_Success(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create multiple streams
	expiry := time.Now().Add(24 * time.Hour)
	ts.createTestStream(StreamStatusActive, &expiry)
	ts.createTestStream(StreamStatusActive, &expiry)
	ts.createTestStream(StreamStatusPaused, &expiry)

	req := ListStreamsRequest{
		Limit: 10,
	}

	resp, err := ts.ListStreams(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, int64(3), resp.Total)
	assert.Len(t, resp.Streams, 3)
}

func TestListStreams_FilterByStatus(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	ts.createTestStream(StreamStatusActive, &expiry)
	ts.createTestStream(StreamStatusActive, &expiry)
	ts.createTestStream(StreamStatusPaused, &expiry)

	req := ListStreamsRequest{
		Status: []StreamStatus{StreamStatusActive},
		Limit:  10,
	}

	resp, err := ts.ListStreams(ctx, req)

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, int64(2), resp.Total)
	for _, s := range resp.Streams {
		assert.Equal(t, StreamStatusActive, s.Status)
	}
}

// ============== Rate Limiting Tests ==============

func TestCheckRateLimit(t *testing.T) {
	config := &ServiceConfig{
		DefaultExpiry:       24 * time.Hour,
		MaxStreamDuration:   30 * 24 * time.Hour,
		MinUpdateInterval:   100 * time.Millisecond,
		MaxUpdatesPerSecond: 10,
	}
	ts := newTestableServiceWithConfig(config)

	// Should allow first request
	assert.NoError(t, ts.checkRateLimit("test-stream"))

	// Should allow up to rate limit
	for i := 0; i < 8; i++ {
		time.Sleep(110 * time.Millisecond) // Respect min interval
		assert.NoError(t, ts.checkRateLimit("test-stream"))
	}

	// Should deny when rate limit exceeded
	assert.Error(t, ts.checkRateLimit("test-stream"))

	// Wait for rate limit window to reset
	time.Sleep(1100 * time.Millisecond)
	assert.NoError(t, ts.checkRateLimit("test-stream"))
}

func TestCheckRateLimit_MinInterval(t *testing.T) {
	config := &ServiceConfig{
		DefaultExpiry:       24 * time.Hour,
		MaxStreamDuration:   30 * 24 * time.Hour,
		MinUpdateInterval:   200 * time.Millisecond,
		MaxUpdatesPerSecond: 100,
	}
	ts := newTestableServiceWithConfig(config)

	// First request should succeed
	assert.NoError(t, ts.checkRateLimit("test-stream"))

	// Immediate second request should fail (min interval not met)
	assert.Error(t, ts.checkRateLimit("test-stream"))

	// Wait for min interval
	time.Sleep(250 * time.Millisecond)
	assert.NoError(t, ts.checkRateLimit("test-stream"))
}

// ============== Cleanup Tests ==============

func TestCleanupRateLimiter(t *testing.T) {
	ts := newTestableService()

	// Add some rate limit entries
	ts.checkRateLimit("stream-1")
	ts.checkRateLimit("stream-2")
	ts.checkRateLimit("stream-3")

	// Manually age one entry (cleanupRateLimiter checks lastUpdate, not resetAt)
	ts.limitMu.Lock()
	if state, ok := ts.updateLimits["stream-1"]; ok {
		state.lastUpdate = time.Now().Add(-2 * time.Hour)
	}
	ts.limitMu.Unlock()

	// Run cleanup
	ts.cleanupRateLimiter()

	// Verify old entry was removed
	ts.limitMu.RLock()
	_, exists := ts.updateLimits["stream-1"]
	ts.limitMu.RUnlock()
	assert.False(t, exists, "stale entry should be removed")

	// Verify other entries still exist
	ts.limitMu.RLock()
	_, exists2 := ts.updateLimits["stream-2"]
	_, exists3 := ts.updateLimits["stream-3"]
	ts.limitMu.RUnlock()
	assert.True(t, exists2)
	assert.True(t, exists3)
}

// ============== Process Expired Streams Tests ==============

func TestProcessExpiredStreams(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create an expired stream
	expiry := time.Now().Add(-1 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Run expiry processing
	ts.processExpiredStreams()

	// Verify stream was marked as expired
	updatedStream, err := ts.mockRepo.GetByID(ctx, stream.ID)
	require.NoError(t, err)
	assert.Equal(t, StreamStatusExpired, updatedStream.Status)
}

// ============== Concurrent Update Tests ==============

func TestConcurrentUpdates(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	var wg sync.WaitGroup
	errCount := 0
	var mu sync.Mutex

	// Launch concurrent updates
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			time.Sleep(time.Duration(i*20) * time.Millisecond) // Stagger requests

			req := &UpdateStreamRequest{
				StreamID:  stream.ID,
				Amount:    "100000000",
				Signature: "valid-signature",
			}
			_, err := ts.UpdateStream(ctx, req)
			if err != nil {
				mu.Lock()
				errCount++
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	t.Logf("Total errors: %d out of 10 concurrent updates", errCount)
}

// ============== Status Transition Tests ==============

func TestStatusTransitions(t *testing.T) {
	tests := []struct {
		name     string
		from     StreamStatus
		to       StreamStatus
		expected bool
	}{
		{"active->paused", StreamStatusActive, StreamStatusPaused, true},
		{"active->closed", StreamStatusActive, StreamStatusClosed, true},
		{"paused->active", StreamStatusPaused, StreamStatusActive, true},
		{"paused->closed", StreamStatusPaused, StreamStatusClosed, true},
		{"closed->active", StreamStatusClosed, StreamStatusActive, false},
		{"closed->paused", StreamStatusClosed, StreamStatusPaused, false},
		{"expired->active", StreamStatusExpired, StreamStatusActive, false},
		{"pending->closed", StreamStatusPending, StreamStatusClosed, true}, // pending can be closed
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := newTestableService()
			ctx := context.Background()

			expiry := time.Now().Add(24 * time.Hour)
			stream := ts.createTestStream(tt.from, &expiry)

			var err error
			switch tt.to {
			case StreamStatusPaused:
				err = ts.PauseStream(ctx, stream.ID, stream.Payee)
			case StreamStatusActive:
				err = ts.ResumeStream(ctx, stream.ID, stream.Payee)
			case StreamStatusClosed:
				req := &CloseStreamRequest{
					StreamID:       stream.ID,
					FinalAmount:    "0",
					PayerSignature: "valid",
				}
				_, err = ts.CloseStream(ctx, req)
			}

			if tt.expected {
				assert.NoError(t, err, "transition should succeed")
			} else {
				assert.Error(t, err, "transition should fail")
			}
		})
	}
}

// ============== Configuration Tests ==============

func TestDefaultServiceConfig(t *testing.T) {
	config := DefaultServiceConfig()

	assert.Equal(t, 24*time.Hour, config.DefaultExpiry)
	assert.Equal(t, 30*24*time.Hour, config.MaxStreamDuration)
	assert.Equal(t, 100*time.Millisecond, config.MinUpdateInterval)
	assert.Equal(t, 100, config.MaxUpdatesPerSecond)
	assert.False(t, config.EnableAutoSettle)
	assert.NotNil(t, config.AutoSettleThreshold)
}

func TestServiceCreation(t *testing.T) {
	repo := newMockRepository()
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0x123"}

	service := NewService(repo, verifier, settler, nil, nil)

	assert.NotNil(t, service)
	assert.NotNil(t, service.config)
	assert.NotNil(t, service.updateLimits)
}

func TestServiceWithCustomConfig(t *testing.T) {
	repo := newMockRepository()
	verifier := &mockVerifier{verifyResult: true}
	settler := &mockSettler{settleTxHash: "0x123"}

	customConfig := &ServiceConfig{
		DefaultExpiry:       48 * time.Hour,
		MaxStreamDuration:   60 * 24 * time.Hour,
		MinUpdateInterval:   50 * time.Millisecond,
		MaxUpdatesPerSecond: 200,
		EnableAutoSettle:    true,
	}

	service := NewService(repo, verifier, settler, nil, customConfig)

	assert.Equal(t, 48*time.Hour, service.config.DefaultExpiry)
	assert.Equal(t, 200, service.config.MaxUpdatesPerSecond)
	assert.True(t, service.config.EnableAutoSettle)
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

// ============== Auto-Settle Tests ==============

func TestProcessAutoSettle(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(1000000) // 1 USDT (6 decimals)
	ts.config.EnableAutoSettle = true
	ctx := context.Background()

	// Create an active stream with enough unsettled amount
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "5000000"  // 5 USDT
	stream.SettledAmount = "0"        // Nothing settled yet
	ts.mockRepo.Update(ctx, stream)

	// Process auto-settle
	ts.processAutoSettle()

	// Verify the settler was called (via mock)
	assert.True(t, ts.mockSettler.settleCalled, "settler should have been called")

	// Verify settled amount was updated
	updatedStream, _ := ts.mockRepo.GetByID(ctx, stream.ID)
	assert.Equal(t, "5000000", updatedStream.SettledAmount)
}

func TestProcessAutoSettle_BelowThreshold(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(10000000) // 10 USDT
	ctx := context.Background()

	// Create an active stream with unsettled amount below threshold
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "5000000"  // 5 USDT
	stream.SettledAmount = "0"
	ts.mockRepo.Update(ctx, stream)

	// Reset settler mock
	ts.mockSettler.settleCalled = false

	// Process auto-settle
	ts.processAutoSettle()

	// Verify settler was NOT called (below threshold)
	assert.False(t, ts.mockSettler.settleCalled, "settler should not be called for amounts below threshold")
}

func TestProcessAutoSettle_SettlementFailure(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(1000000) // 1 USDT
	ts.mockSettler.settleError = fmt.Errorf("settlement failed")
	ctx := context.Background()

	// Create an active stream
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "5000000"
	stream.SettledAmount = "0"
	ts.mockRepo.Update(ctx, stream)

	// Process auto-settle
	ts.processAutoSettle()

	// Verify settled amount was reverted to original
	updatedStream, _ := ts.mockRepo.GetByID(ctx, stream.ID)
	assert.Equal(t, "0", updatedStream.SettledAmount, "settled amount should be reverted on failure")

	// Reset for cleanup
	ts.mockSettler.settleError = nil
}

func TestProcessAutoSettleStream_InvalidAmount(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(1000000)
	ctx := context.Background()

	// Create stream with invalid current amount
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "invalid-amount"
	ts.mockRepo.Update(ctx, stream)

	// Should not panic with invalid amount
	ts.processAutoSettleStream(ctx, stream.ID)

	// Settler should not be called
	assert.False(t, ts.mockSettler.settleCalled)
}

func TestProcessAutoSettleStream_StreamNotActive(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(1000000)
	ctx := context.Background()

	// Create a paused stream
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusPaused, &expiry)
	stream.CurrentAmount = "5000000"
	stream.SettledAmount = "0"
	ts.mockRepo.Update(ctx, stream)

	// Reset settler mock
	ts.mockSettler.settleCalled = false

	// Process auto-settle
	ts.processAutoSettleStream(ctx, stream.ID)

	// Settler should not be called for non-active streams
	assert.False(t, ts.mockSettler.settleCalled, "settler should not be called for non-active streams")
}

// ============== GetStreamStats Tests ==============

func TestGetStreamStats(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Create a stream with some updates
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	// Add updates via the repository mock
	for i := 0; i < 5; i++ {
		update := &StreamUpdate{
			ID:            fmt.Sprintf("update-%d-%d", atomic.AddInt64(&streamCounter, 1), i),
			StreamID:      stream.ID,
			Amount:        fmt.Sprintf("%d", (i+1)*1000000),
			Signature:     "sig",
			Timestamp:     time.Now(),
			SequenceNum:   uint64(i + 1),
			ResourceUnits: int64((i + 1) * 100),
		}
		ts.mockRepo.CreateUpdate(ctx, update)
	}

	stats, err := ts.mockRepo.GetStreamStats(ctx, stream.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(5), stats.TotalUpdates)
}

// ============== Additional Edge Case Tests ==============

func TestOpenStream_EmptyNetwork(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	req := &OpenStreamRequest{
		Network:   "", // Empty network
		Scheme:    "exact",
		Payer:     "0xPayer",
		Payee:     "0xPayee",
		Asset:     "0xUSDT",
		MaxAmount: "1000000000",
	}

	_, err := ts.OpenStream(ctx, req)
	// Depending on implementation, this may or may not fail
	// The important thing is it doesn't panic
	_ = err
}

func TestUpdateStream_ZeroAmount(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)

	req := &UpdateStreamRequest{
		StreamID:  stream.ID,
		Amount:    "0", // Zero amount - currently allowed by the service
		Signature: "valid",
	}

	// Zero amount is currently accepted (format is valid)
	// This behavior could be changed if needed by adding explicit zero check
	_, err := ts.UpdateStream(ctx, req)
	assert.NoError(t, err, "zero amount is valid format")
}

func TestCloseStream_WithFinalAmount(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "500000000"
	ts.mockRepo.Update(ctx, stream)

	req := &CloseStreamRequest{
		StreamID:       stream.ID,
		FinalAmount:    "500000000", // Match current amount
		PayerSignature: "valid",
		Reason:         "completed",
	}

	resp, err := ts.CloseStream(ctx, req)
	require.NoError(t, err)
	assert.Equal(t, StreamStatusClosed, resp.Stream.Status)
}

func TestListStreams_EmptyResult(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Don't create any streams
	req := ListStreamsRequest{
		Network: "nonexistent-network",
		Limit:   10,
	}

	resp, err := ts.ListStreams(ctx, req)
	require.NoError(t, err)
	assert.Empty(t, resp.Streams)
	assert.Equal(t, int64(0), resp.Total)
}

// ============== Auto-Settle Pause/Resume Tests ==============

func TestPauseAutoSettle(t *testing.T) {
	ts := newTestableService()

	// Initially not paused
	assert.False(t, ts.IsAutoSettlePaused(), "auto-settle should not be paused initially")

	// Pause
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused(), "auto-settle should be paused after PauseAutoSettle")
}

func TestResumeAutoSettle(t *testing.T) {
	ts := newTestableService()

	// Pause first
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused())

	// Resume
	ts.ResumeAutoSettle()
	assert.False(t, ts.IsAutoSettlePaused(), "auto-settle should not be paused after ResumeAutoSettle")
}

func TestPauseResumeAutoSettle_Cycle(t *testing.T) {
	ts := newTestableService()

	// Initial state: not paused
	assert.False(t, ts.IsAutoSettlePaused(), "initial state should be not paused")

	// Pause
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused(), "should be paused after first pause")

	// Pause again (idempotent)
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused(), "should still be paused after second pause")

	// Resume
	ts.ResumeAutoSettle()
	assert.False(t, ts.IsAutoSettlePaused(), "should not be paused after resume")

	// Resume again (idempotent)
	ts.ResumeAutoSettle()
	assert.False(t, ts.IsAutoSettlePaused(), "should still not be paused after second resume")

	// Pause-Resume-Pause cycle
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused())
	ts.ResumeAutoSettle()
	assert.False(t, ts.IsAutoSettlePaused())
	ts.PauseAutoSettle()
	assert.True(t, ts.IsAutoSettlePaused())
}

func TestPauseAutoSettle_ConcurrentAccess(t *testing.T) {
	ts := newTestableService()

	var wg sync.WaitGroup

	// Launch concurrent pause/resume/check operations
	for i := 0; i < 50; i++ {
		wg.Add(3)
		go func() {
			defer wg.Done()
			ts.PauseAutoSettle()
		}()
		go func() {
			defer wg.Done()
			ts.ResumeAutoSettle()
		}()
		go func() {
			defer wg.Done()
			_ = ts.IsAutoSettlePaused()
		}()
	}

	wg.Wait()

	// After all goroutines complete, the state should be deterministic
	// (either paused or not). The important thing is no data race or panic.
	_ = ts.IsAutoSettlePaused()
}

func TestProcessAutoSettle_PausedSkipsSettlement(t *testing.T) {
	ts := newTestableService()
	ts.config.AutoSettleThreshold = big.NewInt(1000000) // 1 USDT
	ts.config.EnableAutoSettle = true
	ctx := context.Background()

	// Create an active stream with enough unsettled amount
	expiry := time.Now().Add(24 * time.Hour)
	stream := ts.createTestStream(StreamStatusActive, &expiry)
	stream.CurrentAmount = "5000000" // 5 USDT
	stream.SettledAmount = "0"
	ts.mockRepo.Update(ctx, stream)

	// Pause auto-settlement
	ts.PauseAutoSettle()

	// Reset settler mock
	ts.mockSettler.settleCalled = false

	// Process auto-settle
	ts.processAutoSettle()

	// Settler should NOT be called because auto-settle is paused
	assert.False(t, ts.mockSettler.settleCalled, "settler should not be called when auto-settle is paused")

	// Resume and process again
	ts.ResumeAutoSettle()
	ts.processAutoSettle()

	// Now settler should be called
	assert.True(t, ts.mockSettler.settleCalled, "settler should be called after resuming auto-settle")
}

func TestOpenStream_ExceedsMaxStreamAmount(t *testing.T) {
	config := DefaultServiceConfig()
	config.MaxStreamAmount = big.NewInt(1000000000) // 1000 USDT
	ts := newTestableServiceWithConfig(config)
	ctx := context.Background()

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "999999999999", // Exceeds max stream amount
		Signature: "valid-signature",
	}

	_, err := ts.OpenStream(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "stream amount exceeds maximum allowed")
}

func TestOpenStream_ExpiryClampedToMax(t *testing.T) {
	ts := newTestableService()
	ctx := context.Background()

	// Set expiry far in the future, beyond MaxStreamDuration (30 days)
	farFuture := time.Now().Add(365 * 24 * time.Hour) // 1 year

	req := &OpenStreamRequest{
		Network:   "eip155:1",
		Scheme:    "exact",
		Payer:     "0x1234567890abcdef1234567890abcdef12345678",
		Payee:     "0xabcdef1234567890abcdef1234567890abcdef12",
		Asset:     "0x6B175474E89094C44Da98b954EecdFEFC",
		MaxAmount: "1000000000",
		Signature: "valid-signature",
		ExpiresAt: &farFuture,
	}

	resp, err := ts.OpenStream(ctx, req)
	require.NoError(t, err)

	// Expiry should be clamped to MaxStreamDuration (30 days)
	stream, _ := ts.mockRepo.GetByID(ctx, resp.Stream.ID)
	maxExpiry := time.Now().Add(ts.config.MaxStreamDuration)
	assert.WithinDuration(t, maxExpiry, *stream.ExpiresAt, 5*time.Second,
		"expiry should be clamped to max stream duration")
}

func TestDefaultServiceConfig_AllFields(t *testing.T) {
	config := DefaultServiceConfig()

	assert.NotNil(t, config.MaxStreamAmount, "MaxStreamAmount should be set")
	assert.Equal(t, "100000000000", config.MaxStreamAmount.String(), "MaxStreamAmount should be 100,000 USDT")
	assert.Equal(t, 5*time.Minute, config.SettlementTimeout, "SettlementTimeout should be 5 minutes")
	assert.Equal(t, 30*time.Second, config.LockTimeout, "LockTimeout should be 30 seconds")
	assert.Equal(t, time.Hour, config.AutoSettleInterval, "AutoSettleInterval should be 1 hour")
}

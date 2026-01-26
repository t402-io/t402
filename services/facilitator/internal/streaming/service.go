package streaming

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/metrics"
)

var (
	ErrInvalidAmount    = errors.New("invalid amount")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrStreamNotActive  = errors.New("stream is not active")
	ErrUnauthorized     = errors.New("unauthorized operation")
)

// SignatureVerifier verifies payment signatures
type SignatureVerifier interface {
	VerifyStreamSignature(ctx context.Context, network, payer, message, signature string) (bool, error)
}

// Settler settles payments on-chain
type Settler interface {
	SettleStream(ctx context.Context, network, scheme, from, to, asset, amount string) (string, error)
}

// ServiceConfig holds service configuration
type ServiceConfig struct {
	// DefaultExpiry is the default stream expiry duration
	DefaultExpiry time.Duration
	// MaxStreamDuration is the maximum allowed stream duration
	MaxStreamDuration time.Duration
	// MinUpdateInterval is the minimum time between updates
	MinUpdateInterval time.Duration
	// MaxUpdatesPerSecond is the rate limit for updates
	MaxUpdatesPerSecond int
	// EnableAutoSettle enables automatic periodic settlement
	EnableAutoSettle bool
	// AutoSettleThreshold is the amount threshold for auto-settlement
	AutoSettleThreshold *big.Int
	// AutoSettleInterval is the interval for auto-settlement checks
	AutoSettleInterval time.Duration
}

// DefaultServiceConfig returns default configuration
func DefaultServiceConfig() *ServiceConfig {
	threshold := big.NewInt(0)
	threshold.SetString("1000000000", 10) // 1000 USDT (6 decimals)

	return &ServiceConfig{
		DefaultExpiry:       24 * time.Hour,
		MaxStreamDuration:   30 * 24 * time.Hour, // 30 days
		MinUpdateInterval:   100 * time.Millisecond,
		MaxUpdatesPerSecond: 100,
		EnableAutoSettle:    false,
		AutoSettleThreshold: threshold,
		AutoSettleInterval:  time.Hour,
	}
}

// Service handles streaming payment operations
type Service struct {
	repo     *Repository
	verifier SignatureVerifier
	settler  Settler
	metrics  *metrics.Metrics
	config   *ServiceConfig

	// Rate limiting state
	updateLimits map[string]*rateLimitState
	limitMu      sync.RWMutex

	// Background workers
	stopCh chan struct{}
	wg     sync.WaitGroup
}

type rateLimitState struct {
	lastUpdate time.Time
	count      int
	resetAt    time.Time
}

// NewService creates a new streaming service
func NewService(repo *Repository, verifier SignatureVerifier, settler Settler, m *metrics.Metrics, config *ServiceConfig) *Service {
	if config == nil {
		config = DefaultServiceConfig()
	}

	return &Service{
		repo:         repo,
		verifier:     verifier,
		settler:      settler,
		metrics:      m,
		config:       config,
		updateLimits: make(map[string]*rateLimitState),
		stopCh:       make(chan struct{}),
	}
}

// Start starts background workers
func (s *Service) Start() {
	// Start expiry checker
	s.wg.Add(1)
	go s.expiryWorker()

	// Start auto-settle worker if enabled
	if s.config.EnableAutoSettle {
		s.wg.Add(1)
		go s.autoSettleWorker()
	}
}

// Stop stops background workers
func (s *Service) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

// OpenStream opens a new payment stream
func (s *Service) OpenStream(ctx context.Context, req *OpenStreamRequest) (*OpenStreamResponse, error) {
	// Validate amount
	maxAmount := new(big.Int)
	if _, ok := maxAmount.SetString(req.MaxAmount, 10); !ok {
		return nil, ErrInvalidAmount
	}
	if maxAmount.Sign() <= 0 {
		return nil, ErrInvalidAmount
	}

	// Verify signature
	message := fmt.Sprintf("open_stream:%s:%s:%s:%s:%s",
		req.Network, req.Payer, req.Payee, req.Asset, req.MaxAmount)
	valid, err := s.verifier.VerifyStreamSignature(ctx, req.Network, req.Payer, message, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to verify signature: %w", err)
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	// Set expiry
	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		expiresAt = req.ExpiresAt
	} else {
		t := time.Now().Add(s.config.DefaultExpiry)
		expiresAt = &t
	}

	// Validate expiry
	if expiresAt.After(time.Now().Add(s.config.MaxStreamDuration)) {
		t := time.Now().Add(s.config.MaxStreamDuration)
		expiresAt = &t
	}

	// Create stream
	stream := &Stream{
		Network:       req.Network,
		Scheme:        req.Scheme,
		Payer:         req.Payer,
		Payee:         req.Payee,
		Asset:         req.Asset,
		MaxAmount:     req.MaxAmount,
		CurrentAmount: "0",
		SettledAmount: "0",
		RatePerSecond: req.RatePerSecond,
		Status:        StreamStatusActive, // Immediately active for facilitator-based streams
		ExpiresAt:     expiresAt,
	}

	if req.Metadata != nil {
		stream.Metadata = *req.Metadata
	}

	// Save to database
	if err := s.repo.Create(ctx, stream); err != nil {
		return nil, fmt.Errorf("failed to create stream: %w", err)
	}

	// Record event
	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: stream.ID,
		Type:     StreamEventOpened,
		Data: map[string]interface{}{
			"maxAmount": req.MaxAmount,
			"expiresAt": expiresAt,
		},
	})

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordStreamOpened(stream.Network, stream.Scheme)
	}

	return &OpenStreamResponse{
		Stream: stream,
	}, nil
}

// UpdateStream updates a stream with new payment amount
func (s *Service) UpdateStream(ctx context.Context, req *UpdateStreamRequest) (*UpdateStreamResponse, error) {
	// Get stream
	stream, err := s.repo.GetByID(ctx, req.StreamID)
	if err != nil {
		return nil, err
	}

	// Check status
	if stream.Status != StreamStatusActive {
		return nil, ErrStreamNotActive
	}

	// Check expiry
	if stream.ExpiresAt != nil && time.Now().After(*stream.ExpiresAt) {
		// Mark as expired
		s.repo.UpdateStatus(ctx, stream.ID, StreamStatusExpired)
		return nil, ErrStreamExpired
	}

	// Rate limiting
	if err := s.checkRateLimit(stream.ID); err != nil {
		return nil, err
	}

	// Validate amount
	newAmount := new(big.Int)
	if _, ok := newAmount.SetString(req.Amount, 10); !ok {
		return nil, ErrInvalidAmount
	}

	currentAmount := new(big.Int)
	currentAmount.SetString(stream.CurrentAmount, 10)

	maxAmount := new(big.Int)
	maxAmount.SetString(stream.MaxAmount, 10)

	// New amount must be >= current amount (no going backwards)
	if newAmount.Cmp(currentAmount) < 0 {
		return nil, ErrInvalidAmount
	}

	// New amount must be <= max amount
	if newAmount.Cmp(maxAmount) > 0 {
		return nil, ErrAmountExceeded
	}

	// Verify signature
	latestUpdate, _ := s.repo.GetLatestUpdate(ctx, stream.ID)
	var seqNum uint64 = 1
	if latestUpdate != nil {
		seqNum = latestUpdate.SequenceNum + 1
	}

	message := fmt.Sprintf("update_stream:%s:%s:%d", stream.ID, req.Amount, seqNum)
	valid, err := s.verifier.VerifyStreamSignature(ctx, stream.Network, stream.Payer, message, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to verify signature: %w", err)
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	// Create update record
	update := &StreamUpdate{
		StreamID:      stream.ID,
		Amount:        req.Amount,
		Signature:     req.Signature,
		SequenceNum:   seqNum,
		ResourceUnits: req.ResourceUnits,
	}

	if err := s.repo.CreateUpdate(ctx, update); err != nil {
		return nil, fmt.Errorf("failed to create update: %w", err)
	}

	// Update stream
	stream.CurrentAmount = req.Amount
	if err := s.repo.Update(ctx, stream); err != nil {
		return nil, fmt.Errorf("failed to update stream: %w", err)
	}

	// Record event
	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: stream.ID,
		Type:     StreamEventUpdated,
		Data: map[string]interface{}{
			"amount":      req.Amount,
			"sequenceNum": seqNum,
		},
	})

	// Calculate remaining
	remaining := new(big.Int).Sub(maxAmount, newAmount)

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordStreamUpdate(stream.Network, stream.Scheme)
	}

	return &UpdateStreamResponse{
		Stream:      stream,
		Update:      update,
		Remaining:   remaining.String(),
		CanContinue: remaining.Sign() > 0,
	}, nil
}

// CloseStream closes a stream and settles the final amount
func (s *Service) CloseStream(ctx context.Context, req *CloseStreamRequest) (*CloseStreamResponse, error) {
	// Get stream
	stream, err := s.repo.GetByID(ctx, req.StreamID)
	if err != nil {
		return nil, err
	}

	// Check status - can only close active, paused, or pending streams
	if stream.Status != StreamStatusActive && stream.Status != StreamStatusPaused && stream.Status != StreamStatusPending {
		return nil, fmt.Errorf("cannot close stream with status: %s", stream.Status)
	}

	// Validate final amount
	finalAmount := new(big.Int)
	if _, ok := finalAmount.SetString(req.FinalAmount, 10); !ok {
		return nil, ErrInvalidAmount
	}

	currentAmount := new(big.Int)
	currentAmount.SetString(stream.CurrentAmount, 10)

	// Final amount should be >= current streamed amount
	if finalAmount.Cmp(currentAmount) < 0 {
		return nil, fmt.Errorf("final amount cannot be less than current amount")
	}

	maxAmount := new(big.Int)
	maxAmount.SetString(stream.MaxAmount, 10)

	if finalAmount.Cmp(maxAmount) > 0 {
		return nil, ErrAmountExceeded
	}

	// Verify payer signature
	message := fmt.Sprintf("close_stream:%s:%s", stream.ID, req.FinalAmount)
	valid, err := s.verifier.VerifyStreamSignature(ctx, stream.Network, stream.Payer, message, req.PayerSignature)
	if err != nil {
		return nil, fmt.Errorf("failed to verify signature: %w", err)
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	// Mark as closing
	stream.Status = StreamStatusClosing
	if err := s.repo.Update(ctx, stream); err != nil {
		return nil, fmt.Errorf("failed to update stream status: %w", err)
	}

	// Calculate amount to settle (final - already settled)
	settledAmount := new(big.Int)
	settledAmount.SetString(stream.SettledAmount, 10)
	amountToSettle := new(big.Int).Sub(finalAmount, settledAmount)

	var txHash string
	if amountToSettle.Sign() > 0 {
		// Settle on-chain
		txHash, err = s.settler.SettleStream(ctx, stream.Network, stream.Scheme, stream.Payer, stream.Payee, stream.Asset, amountToSettle.String())
		if err != nil {
			// Revert status on failure
			stream.Status = StreamStatusActive
			s.repo.Update(ctx, stream)
			return nil, fmt.Errorf("failed to settle: %w", err)
		}
	}

	// Update stream as closed
	now := time.Now()
	stream.Status = StreamStatusClosed
	stream.ClosedAt = &now
	stream.SettledAmount = finalAmount.String()
	stream.SettlementTxHash = txHash

	if err := s.repo.Update(ctx, stream); err != nil {
		return nil, fmt.Errorf("failed to finalize stream: %w", err)
	}

	// Record event
	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: stream.ID,
		Type:     StreamEventClosed,
		Data: map[string]interface{}{
			"finalAmount": req.FinalAmount,
			"txHash":      txHash,
			"reason":      req.Reason,
		},
	})

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordStreamClosed(stream.Network, stream.Scheme, true)
	}

	return &CloseStreamResponse{
		Stream:        stream,
		SettledAmount: amountToSettle.String(),
		TxHash:        txHash,
		RefundAmount:  "0", // For facilitator-based streams, no refund needed
	}, nil
}

// GetStream retrieves a stream with optional details
func (s *Service) GetStream(ctx context.Context, streamID string, includeUpdates bool, includeStats bool) (*GetStreamResponse, error) {
	stream, err := s.repo.GetByID(ctx, streamID)
	if err != nil {
		return nil, err
	}

	response := &GetStreamResponse{
		Stream: stream,
	}

	if includeUpdates {
		updates, err := s.repo.GetUpdates(ctx, streamID, 50)
		if err == nil {
			response.Updates = updates
		}
	}

	if includeStats {
		stats, err := s.repo.GetStreamStats(ctx, streamID)
		if err == nil {
			response.Stats = stats
		}
	}

	return response, nil
}

// ListStreams lists streams with filtering
func (s *Service) ListStreams(ctx context.Context, req ListStreamsRequest) (*ListStreamsResponse, error) {
	streams, total, err := s.repo.List(ctx, req)
	if err != nil {
		return nil, err
	}

	return &ListStreamsResponse{
		Streams: streams,
		Total:   total,
		Limit:   req.Limit,
		Offset:  req.Offset,
		HasMore: int64(req.Offset+len(streams)) < total,
	}, nil
}

// PauseStream pauses an active stream
func (s *Service) PauseStream(ctx context.Context, streamID string, requester string) error {
	stream, err := s.repo.GetByID(ctx, streamID)
	if err != nil {
		return err
	}

	// Only payee can pause
	if requester != stream.Payee {
		return ErrUnauthorized
	}

	if stream.Status != StreamStatusActive {
		return ErrStreamNotActive
	}

	stream.Status = StreamStatusPaused
	if err := s.repo.Update(ctx, stream); err != nil {
		return err
	}

	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: streamID,
		Type:     StreamEventPaused,
	})

	return nil
}

// ResumeStream resumes a paused stream
func (s *Service) ResumeStream(ctx context.Context, streamID string, requester string) error {
	stream, err := s.repo.GetByID(ctx, streamID)
	if err != nil {
		return err
	}

	// Only payee can resume
	if requester != stream.Payee {
		return ErrUnauthorized
	}

	if stream.Status != StreamStatusPaused {
		return fmt.Errorf("stream is not paused")
	}

	// Check if expired
	if stream.ExpiresAt != nil && time.Now().After(*stream.ExpiresAt) {
		return ErrStreamExpired
	}

	stream.Status = StreamStatusActive
	if err := s.repo.Update(ctx, stream); err != nil {
		return err
	}

	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: streamID,
		Type:     StreamEventResumed,
	})

	return nil
}

// checkRateLimit checks if update is within rate limits
func (s *Service) checkRateLimit(streamID string) error {
	s.limitMu.Lock()
	defer s.limitMu.Unlock()

	now := time.Now()
	state, exists := s.updateLimits[streamID]

	if !exists {
		s.updateLimits[streamID] = &rateLimitState{
			lastUpdate: now,
			count:      1,
			resetAt:    now.Add(time.Second),
		}
		return nil
	}

	// Reset counter if window passed
	if now.After(state.resetAt) {
		state.count = 1
		state.resetAt = now.Add(time.Second)
		state.lastUpdate = now
		return nil
	}

	// Check rate
	if state.count >= s.config.MaxUpdatesPerSecond {
		return fmt.Errorf("rate limit exceeded: max %d updates per second", s.config.MaxUpdatesPerSecond)
	}

	// Check minimum interval
	if now.Sub(state.lastUpdate) < s.config.MinUpdateInterval {
		return fmt.Errorf("update too fast: minimum interval is %v", s.config.MinUpdateInterval)
	}

	state.count++
	state.lastUpdate = now
	return nil
}

// expiryWorker periodically checks for expired streams
func (s *Service) expiryWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.processExpiredStreams()
		}
	}
}

func (s *Service) processExpiredStreams() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	streams, err := s.repo.GetExpiredStreams(ctx)
	if err != nil {
		return
	}

	for _, stream := range streams {
		// Update status
		if err := s.repo.UpdateStatus(ctx, stream.ID, StreamStatusExpired); err != nil {
			continue
		}

		// Record event
		s.repo.CreateEvent(ctx, &StreamEvent{
			StreamID: stream.ID,
			Type:     StreamEventExpired,
		})

		// Record metrics
		if s.metrics != nil {
			s.metrics.RecordStreamClosed(stream.Network, stream.Scheme, false)
		}
	}
}

// autoSettleWorker periodically settles accumulated amounts
func (s *Service) autoSettleWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.config.AutoSettleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.processAutoSettle()
		}
	}
}

func (s *Service) processAutoSettle() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Get active streams
	streams, _, err := s.repo.List(ctx, ListStreamsRequest{
		Status: []StreamStatus{StreamStatusActive},
		Limit:  100,
	})
	if err != nil {
		return
	}

	for _, stream := range streams {
		currentAmount := new(big.Int)
		currentAmount.SetString(stream.CurrentAmount, 10)

		settledAmount := new(big.Int)
		settledAmount.SetString(stream.SettledAmount, 10)

		unsettled := new(big.Int).Sub(currentAmount, settledAmount)

		// Check if unsettled amount exceeds threshold
		if unsettled.Cmp(s.config.AutoSettleThreshold) >= 0 {
			// Settle the unsettled amount
			txHash, err := s.settler.SettleStream(ctx, stream.Network, stream.Scheme, stream.Payer, stream.Payee, stream.Asset, unsettled.String())
			if err != nil {
				continue
			}

			// Update settled amount
			stream.SettledAmount = currentAmount.String()
			stream.SettlementTxHash = txHash
			s.repo.Update(ctx, stream)

			// Record metrics
			if s.metrics != nil {
				s.metrics.RecordStreamSettlement(stream.Network, stream.Scheme)
			}
		}
	}
}

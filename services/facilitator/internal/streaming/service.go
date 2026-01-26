package streaming

import (
	"context"
	"errors"
	"fmt"
	"log"
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
// SECURITY: Uses database transaction with row-level locking to prevent race conditions
// and ensure atomic sequence number assignment
func (s *Service) UpdateStream(ctx context.Context, req *UpdateStreamRequest) (*UpdateStreamResponse, error) {
	// Rate limiting check first (before acquiring lock)
	if err := s.checkRateLimit(req.StreamID); err != nil {
		return nil, err
	}

	// Validate new amount format early (before acquiring lock)
	newAmount := new(big.Int)
	if _, ok := newAmount.SetString(req.Amount, 10); !ok {
		return nil, ErrInvalidAmount
	}

	// Start transaction for atomic operation
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get stream with row-level lock (SELECT ... FOR UPDATE)
	stream, err := s.repo.GetByIDForUpdate(ctx, tx, req.StreamID)
	if err != nil {
		return nil, err
	}

	// Check status (now atomic with lock)
	if stream.Status != StreamStatusActive {
		return nil, ErrStreamNotActive
	}

	// Check expiry
	if stream.ExpiresAt != nil && time.Now().After(*stream.ExpiresAt) {
		// Mark as expired within transaction
		stream.Status = StreamStatusExpired
		s.repo.UpdateInTx(ctx, tx, stream)
		tx.Commit()
		return nil, ErrStreamExpired
	}

	// SECURITY: Always check SetString return value to prevent invalid amounts being treated as 0
	currentAmount := new(big.Int)
	if _, ok := currentAmount.SetString(stream.CurrentAmount, 10); !ok {
		return nil, fmt.Errorf("invalid current amount in stream: %s", stream.CurrentAmount)
	}

	maxAmount := new(big.Int)
	if _, ok := maxAmount.SetString(stream.MaxAmount, 10); !ok {
		return nil, fmt.Errorf("invalid max amount in stream: %s", stream.MaxAmount)
	}

	// New amount must be >= current amount (no going backwards)
	if newAmount.Cmp(currentAmount) < 0 {
		return nil, ErrInvalidAmount
	}

	// New amount must be <= max amount
	if newAmount.Cmp(maxAmount) > 0 {
		return nil, ErrAmountExceeded
	}

	// Get latest update with lock to ensure atomic sequence number calculation
	// SECURITY: This prevents duplicate sequence numbers from concurrent updates
	latestUpdate, _ := s.repo.GetLatestUpdateInTx(ctx, tx, stream.ID)
	var seqNum uint64 = 1
	if latestUpdate != nil {
		seqNum = latestUpdate.SequenceNum + 1
	}

	// Verify signature (uses sequence number, so must be after calculation)
	message := fmt.Sprintf("update_stream:%s:%s:%d", stream.ID, req.Amount, seqNum)
	valid, err := s.verifier.VerifyStreamSignature(ctx, stream.Network, stream.Payer, message, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to verify signature: %w", err)
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	// Create update record within transaction
	update := &StreamUpdate{
		StreamID:      stream.ID,
		Amount:        req.Amount,
		Signature:     req.Signature,
		SequenceNum:   seqNum,
		ResourceUnits: req.ResourceUnits,
	}

	if err := s.repo.CreateUpdateInTx(ctx, tx, update); err != nil {
		return nil, fmt.Errorf("failed to create update: %w", err)
	}

	// Update stream within transaction
	stream.CurrentAmount = req.Amount
	if err := s.repo.UpdateInTx(ctx, tx, stream); err != nil {
		return nil, fmt.Errorf("failed to update stream: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Record event (non-critical, outside transaction)
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
// Uses database-level locking to prevent race conditions and double settlement
func (s *Service) CloseStream(ctx context.Context, req *CloseStreamRequest) (*CloseStreamResponse, error) {
	// Start transaction for atomic operation
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback() // Will be no-op if committed

	// Get stream with row-level lock (SELECT ... FOR UPDATE)
	// This prevents concurrent CloseStream calls from proceeding simultaneously
	stream, err := s.repo.GetByIDForUpdate(ctx, tx, req.StreamID)
	if err != nil {
		return nil, err
	}

	// Check status - can only close active, paused, or pending streams
	// This check is now atomic with the lock acquisition
	if stream.Status != StreamStatusActive && stream.Status != StreamStatusPaused && stream.Status != StreamStatusPending {
		return nil, fmt.Errorf("cannot close stream with status: %s", stream.Status)
	}

	// Validate final amount
	finalAmount := new(big.Int)
	if _, ok := finalAmount.SetString(req.FinalAmount, 10); !ok {
		return nil, ErrInvalidAmount
	}

	// SECURITY: Always check SetString return value
	currentAmount := new(big.Int)
	if _, ok := currentAmount.SetString(stream.CurrentAmount, 10); !ok {
		return nil, fmt.Errorf("invalid current amount in stream: %s", stream.CurrentAmount)
	}

	// Final amount should be >= current streamed amount
	if finalAmount.Cmp(currentAmount) < 0 {
		return nil, fmt.Errorf("final amount cannot be less than current amount")
	}

	maxAmount := new(big.Int)
	if _, ok := maxAmount.SetString(stream.MaxAmount, 10); !ok {
		return nil, fmt.Errorf("invalid max amount in stream: %s", stream.MaxAmount)
	}

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

	// Mark as closing within the transaction
	stream.Status = StreamStatusClosing
	if err := s.repo.UpdateInTx(ctx, tx, stream); err != nil {
		return nil, fmt.Errorf("failed to update stream status: %w", err)
	}

	// Commit the transaction to release the lock before settlement
	// This ensures other requests will see the "closing" status
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Calculate amount to settle (final - already settled)
	// SECURITY: Always check SetString return value
	settledAmount := new(big.Int)
	if _, ok := settledAmount.SetString(stream.SettledAmount, 10); !ok {
		return nil, fmt.Errorf("invalid settled amount in stream: %s", stream.SettledAmount)
	}
	amountToSettle := new(big.Int).Sub(finalAmount, settledAmount)

	var txHash string
	if amountToSettle.Sign() > 0 {
		// Settle on-chain (outside transaction to avoid long locks)
		txHash, err = s.settler.SettleStream(ctx, stream.Network, stream.Scheme, stream.Payer, stream.Payee, stream.Asset, amountToSettle.String())
		if err != nil {
			// Revert status on failure using a new transaction
			revertTx, txErr := s.repo.BeginTx(ctx)
			if txErr == nil {
				revertStream, getErr := s.repo.GetByIDForUpdate(ctx, revertTx, req.StreamID)
				if getErr == nil && revertStream.Status == StreamStatusClosing {
					revertStream.Status = StreamStatusActive
					s.repo.UpdateInTx(ctx, revertTx, revertStream)
					revertTx.Commit()
				} else {
					revertTx.Rollback()
				}
			}
			return nil, fmt.Errorf("failed to settle: %w", err)
		}
	}

	// Update stream as closed using a new transaction
	closeTx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start close transaction: %w", err)
	}
	defer closeTx.Rollback()

	stream, err = s.repo.GetByIDForUpdate(ctx, closeTx, req.StreamID)
	if err != nil {
		return nil, err
	}

	// Verify it's still in closing status (should be unless something went wrong)
	if stream.Status != StreamStatusClosing {
		return nil, fmt.Errorf("stream status changed unexpectedly: %s", stream.Status)
	}

	now := time.Now()
	stream.Status = StreamStatusClosed
	stream.ClosedAt = &now
	stream.SettledAmount = finalAmount.String()
	stream.SettlementTxHash = txHash

	if err := s.repo.UpdateInTx(ctx, closeTx, stream); err != nil {
		return nil, fmt.Errorf("failed to finalize stream: %w", err)
	}

	if err := closeTx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit close transaction: %w", err)
	}

	// Record event (non-critical, don't fail the operation)
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
// SECURITY: Uses database transaction with row-level locking to prevent race conditions
func (s *Service) PauseStream(ctx context.Context, streamID string, requester string) error {
	// Start transaction for atomic operation
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get stream with row-level lock (SELECT ... FOR UPDATE)
	stream, err := s.repo.GetByIDForUpdate(ctx, tx, streamID)
	if err != nil {
		return err
	}

	// Only payee can pause
	if requester != stream.Payee {
		return ErrUnauthorized
	}

	// Status check is now atomic with the lock
	if stream.Status != StreamStatusActive {
		return ErrStreamNotActive
	}

	stream.Status = StreamStatusPaused
	if err := s.repo.UpdateInTx(ctx, tx, stream); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Record event (non-critical, outside transaction)
	s.repo.CreateEvent(ctx, &StreamEvent{
		StreamID: streamID,
		Type:     StreamEventPaused,
	})

	return nil
}

// ResumeStream resumes a paused stream
// SECURITY: Uses database transaction with row-level locking to prevent race conditions
func (s *Service) ResumeStream(ctx context.Context, streamID string, requester string) error {
	// Start transaction for atomic operation
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Get stream with row-level lock (SELECT ... FOR UPDATE)
	stream, err := s.repo.GetByIDForUpdate(ctx, tx, streamID)
	if err != nil {
		return err
	}

	// Only payee can resume
	if requester != stream.Payee {
		return ErrUnauthorized
	}

	// Status check is now atomic with the lock
	if stream.Status != StreamStatusPaused {
		return fmt.Errorf("stream is not paused")
	}

	// Check if expired
	if stream.ExpiresAt != nil && time.Now().After(*stream.ExpiresAt) {
		return ErrStreamExpired
	}

	stream.Status = StreamStatusActive
	if err := s.repo.UpdateInTx(ctx, tx, stream); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Record event (non-critical, outside transaction)
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
		// SECURITY: Always check SetString return value - skip streams with invalid amounts
		currentAmount := new(big.Int)
		if _, ok := currentAmount.SetString(stream.CurrentAmount, 10); !ok {
			log.Printf("Warning: stream %s has invalid current amount: %s", stream.ID, stream.CurrentAmount)
			continue
		}

		settledAmount := new(big.Int)
		if _, ok := settledAmount.SetString(stream.SettledAmount, 10); !ok {
			log.Printf("Warning: stream %s has invalid settled amount: %s", stream.ID, stream.SettledAmount)
			continue
		}

		unsettled := new(big.Int).Sub(currentAmount, settledAmount)

		// Check if unsettled amount exceeds threshold
		if unsettled.Cmp(s.config.AutoSettleThreshold) >= 0 {
			// Settle the unsettled amount
			txHash, err := s.settler.SettleStream(ctx, stream.Network, stream.Scheme, stream.Payer, stream.Payee, stream.Asset, unsettled.String())
			if err != nil {
				log.Printf("Warning: failed to auto-settle stream %s: %v", stream.ID, err)
				continue
			}

			// Update settled amount
			stream.SettledAmount = currentAmount.String()
			stream.SettlementTxHash = txHash
			if err := s.repo.Update(ctx, stream); err != nil {
				log.Printf("Warning: failed to update stream %s after settlement: %v", stream.ID, err)
			}

			// Record metrics
			if s.metrics != nil {
				s.metrics.RecordStreamSettlement(stream.Network, stream.Scheme)
			}
		}
	}
}

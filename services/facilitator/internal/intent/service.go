package intent

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/metrics"
)

var (
	ErrInvalidIntent    = errors.New("invalid intent")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrIntentNotPending = errors.New("intent is not pending")
	ErrIntentNotRouted  = errors.New("intent has no route selected")
	ErrExecutionFailed  = errors.New("execution failed")
)

// SignatureVerifier verifies payment signatures
type SignatureVerifier interface {
	VerifyIntentSignature(ctx context.Context, network, payer, intentID, routeID, signature string) (bool, error)
}

// PaymentExecutor executes payments
type PaymentExecutor interface {
	ExecutePayment(ctx context.Context, route *Route, payer, payee string) ([]string, error)
}

// ServiceConfig holds service configuration
type ServiceConfig struct {
	// DefaultExpiry is the default intent expiry duration
	DefaultExpiry time.Duration
	// MaxExpiry is the maximum allowed intent expiry
	MaxExpiry time.Duration
	// DefaultSlippage is the default max slippage
	DefaultSlippage float64
	// AutoExecute enables automatic execution of routed intents
	AutoExecute bool
	// ExecutionWorkers is the number of concurrent execution workers
	ExecutionWorkers int
}

// DefaultServiceConfig returns default configuration
func DefaultServiceConfig() *ServiceConfig {
	return &ServiceConfig{
		DefaultExpiry:    5 * time.Minute,
		MaxExpiry:        1 * time.Hour,
		DefaultSlippage:  0.005, // 0.5%
		AutoExecute:      false,
		ExecutionWorkers: 5,
	}
}

// Service handles payment intent operations
type Service struct {
	repo     *Repository
	router   *Router
	verifier SignatureVerifier
	executor PaymentExecutor
	metrics  *metrics.Metrics
	config   *ServiceConfig

	// Background workers
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewService creates a new intent service
func NewService(
	repo *Repository,
	router *Router,
	verifier SignatureVerifier,
	executor PaymentExecutor,
	m *metrics.Metrics,
	config *ServiceConfig,
) *Service {
	if config == nil {
		config = DefaultServiceConfig()
	}

	return &Service{
		repo:     repo,
		router:   router,
		verifier: verifier,
		executor: executor,
		metrics:  m,
		config:   config,
		stopCh:   make(chan struct{}),
	}
}

// Start starts background workers
func (s *Service) Start() {
	// Start expiry checker
	s.wg.Add(1)
	go s.expiryWorker()

	// Start auto-execution workers if enabled
	if s.config.AutoExecute {
		for i := 0; i < s.config.ExecutionWorkers; i++ {
			s.wg.Add(1)
			go s.executionWorker()
		}
	}
}

// Stop stops background workers
func (s *Service) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

// CreateIntent creates a new payment intent and finds routes
func (s *Service) CreateIntent(ctx context.Context, req *CreateIntentRequest) (*CreateIntentResponse, error) {
	// Validate request
	if req.Amount == "" || req.Asset == "" {
		return nil, ErrInvalidIntent
	}

	// Set defaults
	maxSlippage := req.MaxSlippage
	if maxSlippage == 0 {
		maxSlippage = s.config.DefaultSlippage
	}

	priority := req.Priority
	if priority == "" {
		priority = PriorityNormal
	}

	expiresIn := time.Duration(req.ExpiresIn) * time.Second
	if expiresIn == 0 {
		expiresIn = s.config.DefaultExpiry
	}
	if expiresIn > s.config.MaxExpiry {
		expiresIn = s.config.MaxExpiry
	}

	// Create intent
	intent := &Intent{
		Payer:          req.Payer,
		Payee:          req.Payee,
		Amount:         req.Amount,
		Asset:          req.Asset,
		SourceNetworks: req.SourceNetworks,
		TargetNetwork:  req.TargetNetwork,
		MaxSlippage:    maxSlippage,
		MaxGasCost:     req.MaxGasCost,
		Priority:       priority,
		Status:         IntentStatusPending,
		ExpiresAt:      time.Now().Add(expiresIn),
		Metadata:       req.Metadata,
	}

	// Find routes
	routes, err := s.router.FindRoutes(ctx, intent)
	if err != nil {
		return nil, fmt.Errorf("failed to find routes: %w", err)
	}

	intent.AvailableRoutes = routes

	// Save to database
	if err := s.repo.Create(ctx, intent); err != nil {
		return nil, fmt.Errorf("failed to create intent: %w", err)
	}

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordIntentCreated(intent.TargetNetwork, string(intent.Priority))
	}

	return &CreateIntentResponse{
		Intent:           intent,
		AvailableRoutes:  routes,
		RecommendedRoute: s.router.GetRecommendedRoute(routes),
	}, nil
}

// SelectRoute selects a route for an intent
func (s *Service) SelectRoute(ctx context.Context, req *SelectRouteRequest) (*SelectRouteResponse, error) {
	// Get intent
	intent, err := s.repo.GetByID(ctx, req.IntentID)
	if err != nil {
		return nil, err
	}

	// Check status
	if intent.Status != IntentStatusPending {
		return nil, ErrIntentNotPending
	}

	// Check expiry
	if time.Now().After(intent.ExpiresAt) {
		s.repo.UpdateStatus(ctx, intent.ID, IntentStatusExpired, "")
		return nil, ErrIntentExpired
	}

	// Find the selected route
	var selectedRoute *Route
	for _, route := range intent.AvailableRoutes {
		if route.ID == req.RouteID {
			selectedRoute = route
			break
		}
	}

	if selectedRoute == nil {
		return nil, fmt.Errorf("route not found: %s", req.RouteID)
	}

	// Validate route is still valid
	if err := s.router.ValidateRoute(selectedRoute); err != nil {
		// Try to refresh the route
		refreshed, refreshErr := s.router.RefreshRoute(ctx, intent, selectedRoute)
		if refreshErr != nil {
			return nil, fmt.Errorf("route expired and refresh failed: %w", refreshErr)
		}
		selectedRoute = refreshed
	}

	// Update intent
	intent.SelectedRoute = selectedRoute
	intent.Status = IntentStatusRouted

	if err := s.repo.Update(ctx, intent); err != nil {
		return nil, fmt.Errorf("failed to update intent: %w", err)
	}

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordIntentRouted(selectedRoute.SourceNetwork, selectedRoute.TargetNetwork)
	}

	return &SelectRouteResponse{
		Intent:        intent,
		SelectedRoute: selectedRoute,
	}, nil
}

// ExecuteIntent executes a routed intent
func (s *Service) ExecuteIntent(ctx context.Context, req *ExecuteIntentRequest) (*ExecuteIntentResponse, error) {
	// Get intent
	intent, err := s.repo.GetByID(ctx, req.IntentID)
	if err != nil {
		return nil, err
	}

	// Check status
	if intent.Status != IntentStatusRouted && intent.Status != IntentStatusPending {
		return nil, fmt.Errorf("intent cannot be executed in status: %s", intent.Status)
	}

	// Check expiry
	if time.Now().After(intent.ExpiresAt) {
		s.repo.UpdateStatus(ctx, intent.ID, IntentStatusExpired, "")
		return nil, ErrIntentExpired
	}

	// Get route - either from request or from intent
	var route *Route
	if req.RouteID != "" {
		for _, r := range intent.AvailableRoutes {
			if r.ID == req.RouteID {
				route = r
				break
			}
		}
	} else {
		route = intent.SelectedRoute
	}

	if route == nil {
		return nil, ErrIntentNotRouted
	}

	// Validate route
	if err := s.router.ValidateRoute(route); err != nil {
		return nil, err
	}

	// Verify signature
	valid, err := s.verifier.VerifyIntentSignature(ctx, route.SourceNetwork, intent.Payer, intent.ID, route.ID, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to verify signature: %w", err)
	}
	if !valid {
		return nil, ErrInvalidSignature
	}

	// Mark as executing
	intent.Status = IntentStatusExecuting
	intent.SelectedRoute = route
	if err := s.repo.Update(ctx, intent); err != nil {
		return nil, fmt.Errorf("failed to update intent status: %w", err)
	}

	// Execute payment
	txHashes, execErr := s.executor.ExecutePayment(ctx, route, intent.Payer, intent.Payee)

	// Update intent based on result
	now := time.Now()
	if execErr != nil {
		intent.Status = IntentStatusFailed
		intent.ErrorMessage = execErr.Error()
		if s.metrics != nil {
			s.metrics.RecordIntentCompleted(route.SourceNetwork, route.TargetNetwork, false)
		}
	} else {
		intent.Status = IntentStatusCompleted
		intent.ExecutedAt = &now
		intent.TxHashes = txHashes
		if s.metrics != nil {
			s.metrics.RecordIntentCompleted(route.SourceNetwork, route.TargetNetwork, true)
		}
	}

	if err := s.repo.Update(ctx, intent); err != nil {
		return nil, fmt.Errorf("failed to finalize intent: %w", err)
	}

	return &ExecuteIntentResponse{
		Intent:   intent,
		TxHashes: txHashes,
		Status:   string(intent.Status),
		Message:  intent.ErrorMessage,
	}, nil
}

// GetIntent retrieves an intent by ID
func (s *Service) GetIntent(ctx context.Context, intentID string) (*GetIntentResponse, error) {
	intent, err := s.repo.GetByID(ctx, intentID)
	if err != nil {
		return nil, err
	}

	return &GetIntentResponse{
		Intent: intent,
	}, nil
}

// ListIntents lists intents with filtering
func (s *Service) ListIntents(ctx context.Context, req ListIntentsRequest) (*ListIntentsResponse, error) {
	intents, total, err := s.repo.List(ctx, req)
	if err != nil {
		return nil, err
	}

	return &ListIntentsResponse{
		Intents: intents,
		Total:   total,
		Limit:   req.Limit,
		Offset:  req.Offset,
		HasMore: int64(req.Offset+len(intents)) < total,
	}, nil
}

// CancelIntent cancels a pending intent
func (s *Service) CancelIntent(ctx context.Context, req *CancelIntentRequest) error {
	intent, err := s.repo.GetByID(ctx, req.IntentID)
	if err != nil {
		return err
	}

	// Can only cancel pending or routed intents
	if intent.Status != IntentStatusPending && intent.Status != IntentStatusRouted {
		return fmt.Errorf("cannot cancel intent in status: %s", intent.Status)
	}

	intent.Status = IntentStatusCancelled
	intent.ErrorMessage = req.Reason

	if err := s.repo.Update(ctx, intent); err != nil {
		return fmt.Errorf("failed to cancel intent: %w", err)
	}

	// Record metrics
	if s.metrics != nil {
		s.metrics.RecordIntentCancelled(intent.TargetNetwork)
	}

	return nil
}

// RefreshRoutes refreshes available routes for an intent
func (s *Service) RefreshRoutes(ctx context.Context, req *RefreshRoutesRequest) (*RefreshRoutesResponse, error) {
	intent, err := s.repo.GetByID(ctx, req.IntentID)
	if err != nil {
		return nil, err
	}

	// Can only refresh pending intents
	if intent.Status != IntentStatusPending {
		return nil, fmt.Errorf("cannot refresh routes for intent in status: %s", intent.Status)
	}

	// Check expiry
	if time.Now().After(intent.ExpiresAt) {
		s.repo.UpdateStatus(ctx, intent.ID, IntentStatusExpired, "")
		return nil, ErrIntentExpired
	}

	// Find new routes
	routes, err := s.router.FindRoutes(ctx, intent)
	if err != nil {
		return nil, fmt.Errorf("failed to find routes: %w", err)
	}

	// Update intent
	intent.AvailableRoutes = routes
	if err := s.repo.Update(ctx, intent); err != nil {
		return nil, fmt.Errorf("failed to update intent: %w", err)
	}

	return &RefreshRoutesResponse{
		Intent:           intent,
		AvailableRoutes:  routes,
		RecommendedRoute: s.router.GetRecommendedRoute(routes),
	}, nil
}

// expiryWorker periodically checks for expired intents
func (s *Service) expiryWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.processExpiredIntents()
		}
	}
}

func (s *Service) processExpiredIntents() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	intents, err := s.repo.GetExpiredIntents(ctx)
	if err != nil {
		return
	}

	for _, intent := range intents {
		if err := s.repo.UpdateStatus(ctx, intent.ID, IntentStatusExpired, ""); err != nil {
			continue
		}

		if s.metrics != nil {
			s.metrics.RecordIntentExpired(intent.TargetNetwork)
		}
	}
}

// executionWorker processes routed intents for auto-execution
func (s *Service) executionWorker() {
	defer s.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			// This would need additional logic to process auto-executable intents
			// For now, auto-execution is not implemented
		}
	}
}

// GetStats returns intent statistics
func (s *Service) GetStats(ctx context.Context) (map[IntentStatus]int64, error) {
	return s.repo.CountByStatus(ctx)
}

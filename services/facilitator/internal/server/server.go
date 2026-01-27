package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/auth"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/health"
	"github.com/t402-io/t402/services/facilitator/internal/idempotency"
	"github.com/t402-io/t402/services/facilitator/internal/intent"
	"github.com/t402-io/t402/services/facilitator/internal/metrics"
	"github.com/t402-io/t402/services/facilitator/internal/persistence"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
	"github.com/t402-io/t402/services/facilitator/internal/streaming"
	"github.com/t402-io/t402/services/facilitator/internal/tracing"
)

// Version is the service version (set at build time)
var Version = "dev"

// Facilitator defines the interface for the t402 facilitator
type Facilitator interface {
	Verify(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error)
	Settle(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error)
	GetSupported() t402.SupportedResponse
}

// Server is the HTTP server for the facilitator
type Server struct {
	router           *gin.Engine
	httpServer       *http.Server
	facilitator      Facilitator
	config           *config.Config
	metrics          *metrics.Metrics
	limiter          ratelimit.Limiter
	health           *health.Checker
	authManager      *auth.Manager
	db               *persistence.DB
	settlementRepo   *persistence.SettlementRepository
	auditRepo        *persistence.AuditRepository
	tracer           *tracing.Provider
	idempotencyStore *idempotency.Store

	// Advanced features (require database)
	streamingHandlers *streaming.Handlers
	intentHandlers    *intent.Handlers
}

// New creates a new facilitator server
func New(
	facilitator Facilitator,
	redisClient *cache.Client,
	cfg *config.Config,
) *Server {
	return NewWithDB(facilitator, redisClient, cfg, nil)
}

// NewWithDB creates a new facilitator server with database support
func NewWithDB(
	facilitator Facilitator,
	redisClient *cache.Client,
	cfg *config.Config,
	db *persistence.DB,
) *Server {
	return NewWithTracing(facilitator, redisClient, cfg, db, nil)
}

// NewWithTracing creates a new facilitator server with full observability support
func NewWithTracing(
	facilitator Facilitator,
	redisClient *cache.Client,
	cfg *config.Config,
	db *persistence.DB,
	tracer *tracing.Provider,
) *Server {
	// Set Gin mode
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create components
	m := metrics.New()
	// Use fallback limiter that falls back to in-memory limiting when Redis is unavailable
	redisLimiter := ratelimit.NewRedisLimiter(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow)
	limiter := ratelimit.NewFallbackLimiter(redisLimiter, cfg.RateLimitRequests, cfg.RateLimitWindow)
	healthChecker := health.NewChecker(redisClient, Version)

	// Create auth manager and load API keys
	authManager := auth.NewManager(redisClient)
	if cfg.APIKeys != "" {
		if err := authManager.LoadFromEnv(cfg.APIKeys); err != nil {
			log.Printf("Warning: failed to load API keys: %v", err)
		} else {
			log.Printf("Loaded %d API keys", authManager.GetKeyCount())
		}
	}

	// Create idempotency store (24 hour TTL by default)
	idempotencyStore := idempotency.NewStore(redisClient, 24*time.Hour)
	log.Printf("Idempotency protection enabled")

	// Create router
	router := gin.New()

	s := &Server{
		router:           router,
		facilitator:      facilitator,
		config:           cfg,
		metrics:          m,
		limiter:          limiter,
		health:           healthChecker,
		authManager:      authManager,
		db:               db,
		tracer:           tracer,
		idempotencyStore: idempotencyStore,
	}

	// Setup persistence repositories if database is available
	if db != nil {
		s.settlementRepo = persistence.NewSettlementRepository(db)
		s.auditRepo = persistence.NewAuditRepository(db)

		// Setup streaming service and handlers
		streamingRepo := streaming.NewRepository(db.DB)
		streamingRepoAdapter := streaming.NewRepositoryAdapter(streamingRepo)
		streamingService := streaming.NewService(streamingRepoAdapter, nil, nil, m, nil)
		s.streamingHandlers = streaming.NewHandlers(streamingService)
		log.Printf("Streaming payments enabled")

		// Setup intent service and handlers
		intentRepo := intent.NewRepository(db.DB)
		intentRepoAdapter := intent.NewRepositoryAdapter(intentRepo)
		intentRouter := intent.NewRouter(nil, nil, nil, nil, nil)
		intentService := intent.NewService(intentRepoAdapter, intentRouter, nil, nil, m, nil)
		s.intentHandlers = intent.NewHandlers(intentService)
		log.Printf("Intent-based routing enabled")
	}

	// Setup middleware and routes
	s.setupMiddleware()
	s.setupRoutes()

	return s
}

// setupMiddleware configures the middleware stack
func (s *Server) setupMiddleware() {
	// Recovery middleware
	s.router.Use(gin.Recovery())

	// Security headers middleware (XSS, clickjacking, MIME sniffing protection)
	s.router.Use(SecurityHeadersMiddleware(s.config.IsProduction()))

	// Body size limit middleware (prevent DoS via large payloads)
	s.router.Use(BodySizeLimitMiddleware(MaxBodySize))

	// Request ID middleware
	s.router.Use(RequestIDMiddleware())

	// Tracing middleware (if enabled)
	if s.tracer != nil && s.tracer.IsEnabled() {
		s.router.Use(tracing.Middleware(s.tracer, nil))
	}

	// Logging middleware
	s.router.Use(LoggingMiddleware())

	// CORS middleware with configurable allowed origins
	// Warn if using wildcard CORS in production (security risk)
	if s.config.IsProduction() && s.config.CORSAllowedOrigins == "*" {
		log.Printf("WARNING: Wildcard CORS (*) enabled in production. Consider restricting to specific origins.")
	}
	s.router.Use(CORSMiddleware(s.config.CORSAllowedOrigins))

	// Metrics middleware
	s.router.Use(s.metrics.Middleware())

	// Rate limiting middleware (skip health/metrics endpoints)
	s.router.Use(RateLimitMiddleware(s.limiter))

	// API key authentication middleware
	authConfig := auth.DefaultConfig()
	authConfig.Required = s.config.APIKeyRequired
	s.router.Use(auth.Middleware(s.authManager, authConfig))

	// API key metrics middleware
	s.router.Use(s.apiKeyMetricsMiddleware())

	// Audit middleware (if database is configured)
	if s.auditRepo != nil {
		s.router.Use(persistence.AuditMiddleware(s.auditRepo, nil))
	}
}

// apiKeyMetricsMiddleware records API key usage metrics
func (s *Server) apiKeyMetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Record API key usage if authenticated
		if keyName := auth.GetKeyName(c); keyName != "" {
			s.metrics.RecordAPIKeyUsage(keyName, c.FullPath())
		}
	}
}

// setupRoutes configures all routes
func (s *Server) setupRoutes() {
	// Health endpoints (no rate limiting)
	s.router.GET("/health", s.health.HealthHandler())
	s.router.GET("/ready", s.health.ReadyHandler())

	// Metrics endpoint
	s.router.GET("/metrics", s.metrics.Handler())

	// API info endpoint
	s.router.GET("/", s.handleInfo)
	s.router.GET("/info", s.handleInfo)

	// Facilitator endpoints
	s.router.POST("/verify", s.handleVerify)
	s.router.POST("/settle", s.handleSettle)
	s.router.GET("/supported", s.handleSupported)

	// Stats endpoints (if database is configured)
	if s.auditRepo != nil {
		s.router.GET("/stats/requests", persistence.RequestStatsHandler(s.auditRepo))
	}
	if s.settlementRepo != nil {
		s.router.GET("/stats/settlements", persistence.SettlementStatsHandler(s.settlementRepo))
	}

	// API v1 group for advanced features
	v1 := s.router.Group("/v1")

	// Streaming payments endpoints (if database is configured)
	if s.streamingHandlers != nil {
		s.streamingHandlers.RegisterRoutes(v1)
	}

	// Intent-based routing endpoints (if database is configured)
	if s.intentHandlers != nil {
		s.intentHandlers.RegisterRoutes(v1)
	}
}

// APIInfo represents the API information response
type APIInfo struct {
	Name        string              `json:"name"`
	Version     string              `json:"version"`
	Description string              `json:"description"`
	Docs        string              `json:"docs"`
	Endpoints   []EndpointInfo      `json:"endpoints"`
	Features    map[string]bool     `json:"features"`
}

// EndpointInfo describes an API endpoint
type EndpointInfo struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
}

// handleInfo returns API information
func (s *Server) handleInfo(c *gin.Context) {
	info := APIInfo{
		Name:        "T402 Facilitator API",
		Version:     Version,
		Description: "Payment verification and settlement service for T402 protocol",
		Docs:        "https://docs.t402.io",
		Endpoints: []EndpointInfo{
			{Method: "GET", Path: "/health", Description: "Liveness probe"},
			{Method: "GET", Path: "/ready", Description: "Readiness probe with dependency checks"},
			{Method: "GET", Path: "/info", Description: "API information and available endpoints"},
			{Method: "GET", Path: "/supported", Description: "List supported networks, schemes, and signers"},
			{Method: "POST", Path: "/verify", Description: "Verify a payment authorization signature"},
			{Method: "POST", Path: "/settle", Description: "Execute on-chain payment settlement"},
			{Method: "GET", Path: "/metrics", Description: "Prometheus metrics endpoint"},
		},
		Features: map[string]bool{
			"verification":       true,
			"settlement":         true,
			"rate_limiting":      s.limiter != nil,
			"audit_logging":      s.auditRepo != nil,
			"tracing":            s.tracer != nil && s.tracer.IsEnabled(),
			"streaming_payments": s.streamingHandlers != nil,
			"intent_routing":     s.intentHandlers != nil,
		},
	}

	// Add stats endpoints if available
	if s.auditRepo != nil {
		info.Endpoints = append(info.Endpoints, EndpointInfo{
			Method:      "GET",
			Path:        "/stats/requests",
			Description: "Request statistics",
		})
	}
	if s.settlementRepo != nil {
		info.Endpoints = append(info.Endpoints, EndpointInfo{
			Method:      "GET",
			Path:        "/stats/settlements",
			Description: "Settlement statistics",
		})
	}

	// Add streaming endpoints if available
	if s.streamingHandlers != nil {
		info.Endpoints = append(info.Endpoints,
			EndpointInfo{Method: "POST", Path: "/v1/stream/open", Description: "Open a new payment stream"},
			EndpointInfo{Method: "POST", Path: "/v1/stream/update", Description: "Update stream with new amount"},
			EndpointInfo{Method: "POST", Path: "/v1/stream/close", Description: "Close and settle a stream"},
			EndpointInfo{Method: "GET", Path: "/v1/stream/:id", Description: "Get stream status"},
			EndpointInfo{Method: "POST", Path: "/v1/stream/:id/pause", Description: "Pause a stream"},
			EndpointInfo{Method: "POST", Path: "/v1/stream/:id/resume", Description: "Resume a paused stream"},
			EndpointInfo{Method: "GET", Path: "/v1/stream", Description: "List streams"},
		)
	}

	// Add intent endpoints if available
	if s.intentHandlers != nil {
		info.Endpoints = append(info.Endpoints,
			EndpointInfo{Method: "POST", Path: "/v1/intent", Description: "Create a payment intent"},
			EndpointInfo{Method: "GET", Path: "/v1/intent/:id", Description: "Get intent status"},
			EndpointInfo{Method: "POST", Path: "/v1/intent/:id/route", Description: "Select a route for the intent"},
			EndpointInfo{Method: "POST", Path: "/v1/intent/:id/execute", Description: "Execute the intent payment"},
			EndpointInfo{Method: "POST", Path: "/v1/intent/:id/cancel", Description: "Cancel the intent"},
			EndpointInfo{Method: "POST", Path: "/v1/intent/:id/refresh", Description: "Refresh available routes"},
			EndpointInfo{Method: "GET", Path: "/v1/intent", Description: "List intents"},
			EndpointInfo{Method: "GET", Path: "/v1/intent/stats", Description: "Get intent statistics"},
		)
	}

	c.JSON(http.StatusOK, info)
}

// Start starts the HTTP server
func (s *Server) Start() {
	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.config.Port),
		Handler:      s.router,
		ReadTimeout:  s.config.ReadTimeout,
		WriteTimeout: s.config.WriteTimeout,
		IdleTimeout:  s.config.IdleTimeout,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting facilitator server on port %d", s.config.Port)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	s.waitForShutdown()
}

// waitForShutdown waits for interrupt signal and gracefully shuts down
func (s *Server) waitForShutdown() {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), s.config.ShutdownTimeout)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}

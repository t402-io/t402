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
	"github.com/t402-io/t402/services/facilitator/internal/metrics"
	"github.com/t402-io/t402/services/facilitator/internal/persistence"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
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
	router         *gin.Engine
	httpServer     *http.Server
	facilitator    Facilitator
	config         *config.Config
	metrics        *metrics.Metrics
	limiter        ratelimit.Limiter
	health         *health.Checker
	authManager    *auth.Manager
	db             *persistence.DB
	settlementRepo *persistence.SettlementRepository
	auditRepo      *persistence.AuditRepository
	tracer         *tracing.Provider
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
	limiter := ratelimit.NewRedisLimiter(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow)
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

	// Create router
	router := gin.New()

	s := &Server{
		router:      router,
		facilitator: facilitator,
		config:      cfg,
		metrics:     m,
		limiter:     limiter,
		health:      healthChecker,
		authManager: authManager,
		db:          db,
		tracer:      tracer,
	}

	// Setup persistence repositories if database is available
	if db != nil {
		s.settlementRepo = persistence.NewSettlementRepository(db)
		s.auditRepo = persistence.NewAuditRepository(db)
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

	// Request ID middleware
	s.router.Use(RequestIDMiddleware())

	// Tracing middleware (if enabled)
	if s.tracer != nil && s.tracer.IsEnabled() {
		s.router.Use(tracing.Middleware(s.tracer, nil))
	}

	// Logging middleware
	s.router.Use(LoggingMiddleware())

	// CORS middleware with configurable allowed origins
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
}

// Start starts the HTTP server
func (s *Server) Start() {
	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.config.Port),
		Handler:      s.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}

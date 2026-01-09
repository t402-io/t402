package health

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// Status represents the health status
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
	StatusDegraded  Status = "degraded"
)

// Check represents a single health check
type Check struct {
	Name    string `json:"name"`
	Status  Status `json:"status"`
	Message string `json:"message,omitempty"`
}

// Response is the health check response
type Response struct {
	Status  Status  `json:"status"`
	Checks  []Check `json:"checks,omitempty"`
	Version string  `json:"version,omitempty"`
}

// Checker performs health checks
type Checker struct {
	redis   *cache.Client
	version string
}

// NewChecker creates a new health checker
func NewChecker(redis *cache.Client, version string) *Checker {
	return &Checker{
		redis:   redis,
		version: version,
	}
}

// HealthHandler returns a handler for the /health endpoint (liveness)
func (h *Checker) HealthHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, Response{
			Status:  StatusHealthy,
			Version: h.version,
		})
	}
}

// ReadyHandler returns a handler for the /ready endpoint (readiness)
func (h *Checker) ReadyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		checks := h.runChecks(ctx)
		overallStatus := h.calculateOverallStatus(checks)

		status := http.StatusOK
		if overallStatus != StatusHealthy {
			status = http.StatusServiceUnavailable
		}

		c.JSON(status, Response{
			Status:  overallStatus,
			Checks:  checks,
			Version: h.version,
		})
	}
}

// runChecks runs all health checks concurrently
func (h *Checker) runChecks(ctx context.Context) []Check {
	var wg sync.WaitGroup
	checksChan := make(chan Check, 10)

	// Redis check
	wg.Add(1)
	go func() {
		defer wg.Done()
		checksChan <- h.checkRedis(ctx)
	}()

	// Wait for all checks to complete
	go func() {
		wg.Wait()
		close(checksChan)
	}()

	// Collect results
	var checks []Check
	for check := range checksChan {
		checks = append(checks, check)
	}

	return checks
}

// checkRedis checks Redis connectivity
func (h *Checker) checkRedis(ctx context.Context) Check {
	check := Check{Name: "redis"}

	if h.redis == nil {
		check.Status = StatusUnhealthy
		check.Message = "redis client not configured"
		return check
	}

	if err := h.redis.Ping(ctx); err != nil {
		check.Status = StatusUnhealthy
		check.Message = err.Error()
		return check
	}

	check.Status = StatusHealthy
	return check
}

// calculateOverallStatus determines the overall health status
func (h *Checker) calculateOverallStatus(checks []Check) Status {
	hasUnhealthy := false
	hasDegraded := false

	for _, check := range checks {
		switch check.Status {
		case StatusUnhealthy:
			hasUnhealthy = true
		case StatusDegraded:
			hasDegraded = true
		}
	}

	if hasUnhealthy {
		return StatusUnhealthy
	}
	if hasDegraded {
		return StatusDegraded
	}
	return StatusHealthy
}

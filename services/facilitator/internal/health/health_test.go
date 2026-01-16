package health

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestNewChecker(t *testing.T) {
	checker := NewChecker(nil, "1.0.0")

	if checker == nil {
		t.Fatal("expected non-nil checker")
	}
	if checker.version != "1.0.0" {
		t.Errorf("expected version=1.0.0, got %s", checker.version)
	}
	if checker.redis != nil {
		t.Error("expected redis to be nil")
	}
}

func TestHealthHandler(t *testing.T) {
	checker := NewChecker(nil, "2.0.0")

	router := gin.New()
	router.GET("/health", checker.HealthHandler())

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Status != StatusHealthy {
		t.Errorf("expected status=healthy, got %s", resp.Status)
	}
	if resp.Version != "2.0.0" {
		t.Errorf("expected version=2.0.0, got %s", resp.Version)
	}
}

func TestReadyHandler_NoRedis(t *testing.T) {
	checker := NewChecker(nil, "2.0.0")

	router := gin.New()
	router.GET("/ready", checker.ReadyHandler())

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 503 when Redis is not configured
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", w.Code)
	}

	var resp Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Status != StatusUnhealthy {
		t.Errorf("expected status=unhealthy, got %s", resp.Status)
	}

	// Should have redis check in response
	if len(resp.Checks) == 0 {
		t.Fatal("expected at least one check")
	}

	redisCheck := resp.Checks[0]
	if redisCheck.Name != "redis" {
		t.Errorf("expected check name=redis, got %s", redisCheck.Name)
	}
	if redisCheck.Status != StatusUnhealthy {
		t.Errorf("expected redis check status=unhealthy, got %s", redisCheck.Status)
	}
	if redisCheck.Message != "redis client not configured" {
		t.Errorf("unexpected message: %s", redisCheck.Message)
	}
}

func TestCheckRedis_NilClient(t *testing.T) {
	checker := NewChecker(nil, "1.0.0")

	check := checker.checkRedis(context.Background())

	if check.Name != "redis" {
		t.Errorf("expected name=redis, got %s", check.Name)
	}
	if check.Status != StatusUnhealthy {
		t.Errorf("expected status=unhealthy, got %s", check.Status)
	}
	if check.Message != "redis client not configured" {
		t.Errorf("expected message about redis not configured, got %s", check.Message)
	}
}

func TestCalculateOverallStatus(t *testing.T) {
	checker := NewChecker(nil, "1.0.0")

	tests := []struct {
		name     string
		checks   []Check
		expected Status
	}{
		{
			name:     "empty checks",
			checks:   []Check{},
			expected: StatusHealthy,
		},
		{
			name: "all healthy",
			checks: []Check{
				{Name: "redis", Status: StatusHealthy},
				{Name: "db", Status: StatusHealthy},
			},
			expected: StatusHealthy,
		},
		{
			name: "one unhealthy",
			checks: []Check{
				{Name: "redis", Status: StatusHealthy},
				{Name: "db", Status: StatusUnhealthy},
			},
			expected: StatusUnhealthy,
		},
		{
			name: "one degraded",
			checks: []Check{
				{Name: "redis", Status: StatusHealthy},
				{Name: "db", Status: StatusDegraded},
			},
			expected: StatusDegraded,
		},
		{
			name: "degraded and unhealthy prefers unhealthy",
			checks: []Check{
				{Name: "redis", Status: StatusDegraded},
				{Name: "db", Status: StatusUnhealthy},
			},
			expected: StatusUnhealthy,
		},
		{
			name: "all unhealthy",
			checks: []Check{
				{Name: "redis", Status: StatusUnhealthy},
				{Name: "db", Status: StatusUnhealthy},
			},
			expected: StatusUnhealthy,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := checker.calculateOverallStatus(tt.checks)
			if got != tt.expected {
				t.Errorf("calculateOverallStatus() = %s, expected %s", got, tt.expected)
			}
		})
	}
}

func TestStatusConstants(t *testing.T) {
	if StatusHealthy != "healthy" {
		t.Errorf("StatusHealthy = %s, expected healthy", StatusHealthy)
	}
	if StatusUnhealthy != "unhealthy" {
		t.Errorf("StatusUnhealthy = %s, expected unhealthy", StatusUnhealthy)
	}
	if StatusDegraded != "degraded" {
		t.Errorf("StatusDegraded = %s, expected degraded", StatusDegraded)
	}
}

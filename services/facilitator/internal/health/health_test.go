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

func TestCheckStruct(t *testing.T) {
	check := Check{
		Name:    "test-check",
		Status:  StatusHealthy,
		Message: "all good",
	}

	if check.Name != "test-check" {
		t.Errorf("Name = %s, expected test-check", check.Name)
	}
	if check.Status != StatusHealthy {
		t.Errorf("Status = %s, expected healthy", check.Status)
	}
	if check.Message != "all good" {
		t.Errorf("Message = %s, expected 'all good'", check.Message)
	}
}

func TestResponseStruct(t *testing.T) {
	resp := Response{
		Status:  StatusHealthy,
		Version: "1.0.0",
		Checks: []Check{
			{Name: "redis", Status: StatusHealthy},
		},
	}

	if resp.Status != StatusHealthy {
		t.Errorf("Status = %s, expected healthy", resp.Status)
	}
	if resp.Version != "1.0.0" {
		t.Errorf("Version = %s, expected 1.0.0", resp.Version)
	}
	if len(resp.Checks) != 1 {
		t.Errorf("expected 1 check, got %d", len(resp.Checks))
	}
}

func TestHealthHandler_EmptyVersion(t *testing.T) {
	checker := NewChecker(nil, "")

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

	if resp.Version != "" {
		t.Errorf("expected empty version, got %s", resp.Version)
	}
}

func TestCheckRedis_ContextCancellation(t *testing.T) {
	checker := NewChecker(nil, "1.0.0")

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	check := checker.checkRedis(ctx)

	// Should still return unhealthy since redis is nil
	if check.Status != StatusUnhealthy {
		t.Errorf("expected status=unhealthy, got %s", check.Status)
	}
}

func TestCalculateOverallStatus_SingleCheck(t *testing.T) {
	checker := NewChecker(nil, "1.0.0")

	tests := []struct {
		name     string
		status   Status
		expected Status
	}{
		{"healthy", StatusHealthy, StatusHealthy},
		{"unhealthy", StatusUnhealthy, StatusUnhealthy},
		{"degraded", StatusDegraded, StatusDegraded},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checks := []Check{{Name: "test", Status: tt.status}}
			got := checker.calculateOverallStatus(checks)
			if got != tt.expected {
				t.Errorf("calculateOverallStatus() = %s, expected %s", got, tt.expected)
			}
		})
	}
}

func TestResponseJSON(t *testing.T) {
	resp := Response{
		Status:  StatusHealthy,
		Version: "2.0.0",
		Checks: []Check{
			{Name: "redis", Status: StatusHealthy},
			{Name: "db", Status: StatusDegraded, Message: "slow response"},
		},
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	// Verify JSON contains expected fields
	jsonStr := string(data)
	if !contains(jsonStr, `"status":"healthy"`) {
		t.Error("JSON missing status field")
	}
	if !contains(jsonStr, `"version":"2.0.0"`) {
		t.Error("JSON missing version field")
	}
	if !contains(jsonStr, `"checks"`) {
		t.Error("JSON missing checks field")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestNewChecker_WithVersion(t *testing.T) {
	versions := []string{"1.0.0", "dev", "v2.3.1-beta", ""}

	for _, v := range versions {
		checker := NewChecker(nil, v)
		if checker.version != v {
			t.Errorf("expected version=%s, got %s", v, checker.version)
		}
	}
}

func TestReadyHandler_StatusCodes(t *testing.T) {
	// Test that unhealthy status returns 503
	checker := NewChecker(nil, "1.0.0")

	router := gin.New()
	router.GET("/ready", checker.ReadyHandler())

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 503 because redis is nil
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503, got %d", w.Code)
	}
}

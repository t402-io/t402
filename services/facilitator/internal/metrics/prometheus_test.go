package metrics

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
)

var (
	testMetrics *Metrics
	once        sync.Once
)

func init() {
	gin.SetMode(gin.TestMode)
}

// getTestMetrics returns a singleton Metrics instance for testing
func getTestMetrics() *Metrics {
	once.Do(func() {
		testMetrics = New()
	})
	return testMetrics
}

func TestNew(t *testing.T) {
	m := getTestMetrics()
	if m == nil {
		t.Fatal("Expected non-nil metrics")
	}
	if m.requestsTotal == nil {
		t.Error("Expected requestsTotal to be initialized")
	}
	if m.requestDuration == nil {
		t.Error("Expected requestDuration to be initialized")
	}
	if m.verifyTotal == nil {
		t.Error("Expected verifyTotal to be initialized")
	}
	if m.settleTotal == nil {
		t.Error("Expected settleTotal to be initialized")
	}
	if m.activeRequests == nil {
		t.Error("Expected activeRequests to be initialized")
	}
	if m.apiKeyUsage == nil {
		t.Error("Expected apiKeyUsage to be initialized")
	}
	if m.apiKeyAuthFailed == nil {
		t.Error("Expected apiKeyAuthFailed to be initialized")
	}
}

func TestMetrics_Middleware(t *testing.T) {
	m := getTestMetrics()

	router := gin.New()
	router.Use(m.Middleware())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestMetrics_MiddlewareSkipsMetricsPath(t *testing.T) {
	m := getTestMetrics()

	router := gin.New()
	router.Use(m.Middleware())
	router.GET("/metrics", func(c *gin.Context) {
		c.String(http.StatusOK, "metrics")
	})

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestMetrics_RecordVerify(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordVerify("eip155:1", "exact", true)
	m.RecordVerify("eip155:1", "exact", false)
	m.RecordVerify("solana:mainnet", "exact", true)
}

func TestMetrics_RecordSettle(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordSettle("eip155:1", "exact", true)
	m.RecordSettle("eip155:1", "exact", false)
	m.RecordSettle("ton:mainnet", "exact", true)
}

func TestMetrics_RecordAPIKeyUsage(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordAPIKeyUsage("test-app", "/verify")
	m.RecordAPIKeyUsage("test-app", "/settle")
	m.RecordAPIKeyUsage("prod-app", "/supported")
}

func TestMetrics_RecordAPIKeyAuthFailed(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordAPIKeyAuthFailed("invalid")
	m.RecordAPIKeyAuthFailed("expired")
	m.RecordAPIKeyAuthFailed("revoked")
}

func TestMetrics_Handler(t *testing.T) {
	m := getTestMetrics()

	router := gin.New()
	router.GET("/metrics", m.Handler())

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check that it returns Prometheus format
	body := w.Body.String()
	if len(body) == 0 {
		t.Error("Expected non-empty response body")
	}
}

func TestMetrics_MiddlewareRecordsStatusCodes(t *testing.T) {
	m := getTestMetrics()

	router := gin.New()
	router.Use(m.Middleware())

	router.GET("/success", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	router.GET("/error", func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "error")
	})
	router.GET("/notfound", func(c *gin.Context) {
		c.String(http.StatusNotFound, "not found")
	})

	tests := []struct {
		path       string
		wantStatus int
	}{
		{"/success", http.StatusOK},
		{"/error", http.StatusInternalServerError},
		{"/notfound", http.StatusNotFound},
	}

	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != tt.wantStatus {
			t.Errorf("Path %s: expected status %d, got %d", tt.path, tt.wantStatus, w.Code)
		}
	}
}

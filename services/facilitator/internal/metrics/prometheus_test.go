package metrics

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

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

// Tests for alerting metrics

func TestMetrics_RecordError(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordError("verification", "eip155:1")
	m.RecordError("settlement", "eip155:8453")
	m.RecordError("rpc", "ton:mainnet")
}

func TestMetrics_RecordSettleDuration(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordSettleDuration("eip155:1", "exact", 5*time.Second)
	m.RecordSettleDuration("eip155:8453", "exact", 100*time.Millisecond)
	m.RecordSettleDuration("ton:mainnet", "exact", 30*time.Second)
}

func TestMetrics_SetWalletBalance(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.SetWalletBalance("eip155:1", "0x1234", "ETH", 1.5)
	m.SetWalletBalance("eip155:8453", "0x5678", "USDT", 10000.0)
	m.SetWalletBalance("ton:mainnet", "EQ123", "TON", 100.0)
}

func TestMetrics_SetRPCHealth(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.SetRPCHealth("eip155:1", "https://eth.llamarpc.com", true)
	m.SetRPCHealth("eip155:1", "https://eth.llamarpc.com", false)
	m.SetRPCHealth("eip155:8453", "https://mainnet.base.org", true)
}

func TestMetrics_SetDBHealth(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.SetDBHealth(true)
	m.SetDBHealth(false)
}

func TestMetrics_RecordRateLimitExceeded(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordRateLimitExceeded("192.168.1.1", "")
	m.RecordRateLimitExceeded("10.0.0.1", "key-123")
}

func TestMetrics_SetLastSuccessfulSync(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.SetLastSuccessfulSync("eip155:1", "verify")
	m.SetLastSuccessfulSync("eip155:8453", "settle")
}

func TestNew_AlertingMetrics(t *testing.T) {
	m := getTestMetrics()

	// Verify alerting metrics are initialized
	if m.errorsTotal == nil {
		t.Error("Expected errorsTotal to be initialized")
	}
	if m.settleDuration == nil {
		t.Error("Expected settleDuration to be initialized")
	}
	if m.walletBalance == nil {
		t.Error("Expected walletBalance to be initialized")
	}
	if m.rpcHealthy == nil {
		t.Error("Expected rpcHealthy to be initialized")
	}
	if m.dbHealthy == nil {
		t.Error("Expected dbHealthy to be initialized")
	}
	if m.rateLimitExceeded == nil {
		t.Error("Expected rateLimitExceeded to be initialized")
	}
	if m.lastSuccessfulSync == nil {
		t.Error("Expected lastSuccessfulSync to be initialized")
	}
}

// Tests for streaming metrics

func TestMetrics_RecordStreamOpened(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordStreamOpened("eip155:1", "exact")
	m.RecordStreamOpened("eip155:8453", "upto")
	m.RecordStreamOpened("ton:mainnet", "exact")
}

func TestMetrics_RecordStreamUpdate(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordStreamUpdate("eip155:1", "exact")
	m.RecordStreamUpdate("eip155:8453", "exact")
}

func TestMetrics_RecordStreamClosed(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordStreamClosed("eip155:1", "exact", true)
	m.RecordStreamClosed("eip155:1", "exact", false)
	m.RecordStreamClosed("ton:mainnet", "exact", true)
}

func TestMetrics_RecordStreamSettlement(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordStreamSettlement("eip155:1", "exact")
	m.RecordStreamSettlement("eip155:8453", "upto")
}

func TestMetrics_RecordStreamDuration(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordStreamDuration("eip155:1", "exact", 1*time.Hour)
	m.RecordStreamDuration("eip155:8453", "exact", 30*time.Minute)
	m.RecordStreamDuration("ton:mainnet", "exact", 24*time.Hour)
}

func TestNew_StreamingMetrics(t *testing.T) {
	m := getTestMetrics()

	// Verify streaming metrics are initialized
	if m.streamsOpened == nil {
		t.Error("Expected streamsOpened to be initialized")
	}
	if m.streamsUpdated == nil {
		t.Error("Expected streamsUpdated to be initialized")
	}
	if m.streamsClosed == nil {
		t.Error("Expected streamsClosed to be initialized")
	}
	if m.streamsSettled == nil {
		t.Error("Expected streamsSettled to be initialized")
	}
	if m.activeStreams == nil {
		t.Error("Expected activeStreams to be initialized")
	}
	if m.streamDuration == nil {
		t.Error("Expected streamDuration to be initialized")
	}
}

// Tests for intent metrics

func TestMetrics_RecordIntentCreated(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordIntentCreated("eip155:1", "normal")
	m.RecordIntentCreated("eip155:8453", "high")
	m.RecordIntentCreated("ton:mainnet", "urgent")
}

func TestMetrics_RecordIntentRouted(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordIntentRouted("eip155:1", "eip155:8453")
	m.RecordIntentRouted("eip155:1", "eip155:1")
}

func TestMetrics_RecordIntentCompleted(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordIntentCompleted("eip155:1", "eip155:8453", true)
	m.RecordIntentCompleted("eip155:1", "eip155:8453", false)
}

func TestMetrics_RecordIntentCancelled(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordIntentCancelled("eip155:1")
	m.RecordIntentCancelled("eip155:8453")
}

func TestMetrics_RecordIntentExpired(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordIntentExpired("eip155:1")
	m.RecordIntentExpired("ton:mainnet")
}

func TestMetrics_RecordRouteScore(t *testing.T) {
	m := getTestMetrics()

	// Should not panic
	m.RecordRouteScore("eip155:1", "eip155:8453", 0.95)
	m.RecordRouteScore("eip155:1", "eip155:1", 1.0)
	m.RecordRouteScore("ton:mainnet", "ton:mainnet", 0.8)
}

func TestNew_IntentMetrics(t *testing.T) {
	m := getTestMetrics()

	// Verify intent metrics are initialized
	if m.intentsCreated == nil {
		t.Error("Expected intentsCreated to be initialized")
	}
	if m.intentsRouted == nil {
		t.Error("Expected intentsRouted to be initialized")
	}
	if m.intentsCompleted == nil {
		t.Error("Expected intentsCompleted to be initialized")
	}
	if m.intentsCancelled == nil {
		t.Error("Expected intentsCancelled to be initialized")
	}
	if m.intentsExpired == nil {
		t.Error("Expected intentsExpired to be initialized")
	}
	if m.activeIntents == nil {
		t.Error("Expected activeIntents to be initialized")
	}
	if m.routeScore == nil {
		t.Error("Expected routeScore to be initialized")
	}
}

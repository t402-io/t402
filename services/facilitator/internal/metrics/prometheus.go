package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all Prometheus metrics for the facilitator
type Metrics struct {
	requestsTotal    *prometheus.CounterVec
	requestDuration  *prometheus.HistogramVec
	verifyTotal      *prometheus.CounterVec
	settleTotal      *prometheus.CounterVec
	activeRequests   prometheus.Gauge
	apiKeyUsage      *prometheus.CounterVec
	apiKeyAuthFailed *prometheus.CounterVec

	// Alerting metrics
	errorsTotal        *prometheus.CounterVec
	settleDuration     *prometheus.HistogramVec
	walletBalance      *prometheus.GaugeVec
	rpcHealthy         *prometheus.GaugeVec
	dbHealthy          prometheus.Gauge
	rateLimitExceeded  *prometheus.CounterVec
	lastSuccessfulSync *prometheus.GaugeVec

	// Streaming metrics
	streamsOpened      *prometheus.CounterVec
	streamsUpdated     *prometheus.CounterVec
	streamsClosed      *prometheus.CounterVec
	streamsSettled     *prometheus.CounterVec
	activeStreams      *prometheus.GaugeVec
	streamDuration     *prometheus.HistogramVec

	// Intent metrics
	intentsCreated   *prometheus.CounterVec
	intentsRouted    *prometheus.CounterVec
	intentsCompleted *prometheus.CounterVec
	intentsCancelled *prometheus.CounterVec
	intentsExpired   *prometheus.CounterVec
	activeIntents    *prometheus.GaugeVec
	routeScore       *prometheus.HistogramVec
}

// New creates and registers all Prometheus metrics
func New() *Metrics {
	m := &Metrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status"},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "facilitator_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint"},
		),
		verifyTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_verify_total",
				Help: "Total number of verify requests",
			},
			[]string{"network", "scheme", "result"},
		),
		settleTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_settle_total",
				Help: "Total number of settle requests",
			},
			[]string{"network", "scheme", "result"},
		),
		activeRequests: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "facilitator_active_requests",
				Help: "Number of currently active requests",
			},
		),
		apiKeyUsage: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_api_key_usage_total",
				Help: "Total requests per API key",
			},
			[]string{"key_name", "endpoint"},
		),
		apiKeyAuthFailed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_api_key_auth_failed_total",
				Help: "Total failed API key authentications",
			},
			[]string{"reason"},
		),

		// Alerting metrics
		errorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_errors_total",
				Help: "Total number of errors by type and network",
			},
			[]string{"type", "network"},
		),
		settleDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "facilitator_settle_duration_seconds",
				Help:    "Settlement processing duration in seconds",
				Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300},
			},
			[]string{"network", "scheme"},
		),
		walletBalance: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "facilitator_wallet_balance",
				Help: "Wallet balance in native token units",
			},
			[]string{"network", "address", "asset"},
		),
		rpcHealthy: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "facilitator_rpc_healthy",
				Help: "RPC endpoint health status (1=healthy, 0=unhealthy)",
			},
			[]string{"network", "endpoint"},
		),
		dbHealthy: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "facilitator_db_healthy",
				Help: "Database health status (1=healthy, 0=unhealthy)",
			},
		),
		rateLimitExceeded: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_rate_limit_exceeded_total",
				Help: "Total number of rate limit exceeded events",
			},
			[]string{"ip", "api_key"},
		),
		lastSuccessfulSync: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "facilitator_last_successful_sync_timestamp",
				Help: "Timestamp of last successful operation",
			},
			[]string{"network", "operation"},
		),

		// Streaming metrics
		streamsOpened: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_streams_opened_total",
				Help: "Total number of streams opened",
			},
			[]string{"network", "scheme"},
		),
		streamsUpdated: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_streams_updated_total",
				Help: "Total number of stream updates",
			},
			[]string{"network", "scheme"},
		),
		streamsClosed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_streams_closed_total",
				Help: "Total number of streams closed",
			},
			[]string{"network", "scheme", "result"},
		),
		streamsSettled: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_streams_settled_total",
				Help: "Total number of stream settlements",
			},
			[]string{"network", "scheme"},
		),
		activeStreams: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "facilitator_active_streams",
				Help: "Number of currently active streams",
			},
			[]string{"network", "scheme"},
		),
		streamDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "facilitator_stream_duration_seconds",
				Help:    "Duration of streams from open to close",
				Buckets: []float64{60, 300, 900, 1800, 3600, 7200, 14400, 43200, 86400},
			},
			[]string{"network", "scheme"},
		),

		// Intent metrics
		intentsCreated: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_intents_created_total",
				Help: "Total number of intents created",
			},
			[]string{"network", "priority"},
		),
		intentsRouted: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_intents_routed_total",
				Help: "Total number of intents with route selected",
			},
			[]string{"source_network", "target_network"},
		),
		intentsCompleted: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_intents_completed_total",
				Help: "Total number of intents completed",
			},
			[]string{"source_network", "target_network", "result"},
		),
		intentsCancelled: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_intents_cancelled_total",
				Help: "Total number of intents cancelled",
			},
			[]string{"network"},
		),
		intentsExpired: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "facilitator_intents_expired_total",
				Help: "Total number of intents expired",
			},
			[]string{"network"},
		),
		activeIntents: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "facilitator_active_intents",
				Help: "Number of currently active intents",
			},
			[]string{"status"},
		),
		routeScore: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "facilitator_route_score",
				Help:    "Distribution of route scores",
				Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
			},
			[]string{"source_network", "target_network"},
		),
	}

	// Register all metrics
	prometheus.MustRegister(
		m.requestsTotal,
		m.requestDuration,
		m.verifyTotal,
		m.settleTotal,
		m.activeRequests,
		m.apiKeyUsage,
		m.apiKeyAuthFailed,
		m.errorsTotal,
		m.settleDuration,
		m.walletBalance,
		m.rpcHealthy,
		m.dbHealthy,
		m.rateLimitExceeded,
		m.lastSuccessfulSync,
		m.streamsOpened,
		m.streamsUpdated,
		m.streamsClosed,
		m.streamsSettled,
		m.activeStreams,
		m.streamDuration,
		m.intentsCreated,
		m.intentsRouted,
		m.intentsCompleted,
		m.intentsCancelled,
		m.intentsExpired,
		m.activeIntents,
		m.routeScore,
	)

	return m
}

// Middleware returns a Gin middleware that records metrics
func (m *Metrics) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip metrics endpoint
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		start := time.Now()
		m.activeRequests.Inc()

		c.Next()

		m.activeRequests.Dec()
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		m.requestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), status).Inc()
		m.requestDuration.WithLabelValues(c.Request.Method, c.FullPath()).Observe(duration)
	}
}

// RecordVerify records a verify request result
func (m *Metrics) RecordVerify(network, scheme string, success bool) {
	result := "success"
	if !success {
		result = "failure"
	}
	m.verifyTotal.WithLabelValues(network, scheme, result).Inc()
}

// RecordSettle records a settle request result
func (m *Metrics) RecordSettle(network, scheme string, success bool) {
	result := "success"
	if !success {
		result = "failure"
	}
	m.settleTotal.WithLabelValues(network, scheme, result).Inc()
}

// RecordAPIKeyUsage records API key usage
func (m *Metrics) RecordAPIKeyUsage(keyName, endpoint string) {
	m.apiKeyUsage.WithLabelValues(keyName, endpoint).Inc()
}

// RecordAPIKeyAuthFailed records a failed API key authentication
func (m *Metrics) RecordAPIKeyAuthFailed(reason string) {
	m.apiKeyAuthFailed.WithLabelValues(reason).Inc()
}

// Handler returns the Prometheus HTTP handler
func (m *Metrics) Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// RecordError records an error event
func (m *Metrics) RecordError(errorType, network string) {
	m.errorsTotal.WithLabelValues(errorType, network).Inc()
}

// RecordSettleDuration records the duration of a settlement operation
func (m *Metrics) RecordSettleDuration(network, scheme string, duration time.Duration) {
	m.settleDuration.WithLabelValues(network, scheme).Observe(duration.Seconds())
}

// SetWalletBalance updates the wallet balance metric
func (m *Metrics) SetWalletBalance(network, address, asset string, balance float64) {
	m.walletBalance.WithLabelValues(network, address, asset).Set(balance)
}

// SetRPCHealth updates the RPC health status
func (m *Metrics) SetRPCHealth(network, endpoint string, healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	m.rpcHealthy.WithLabelValues(network, endpoint).Set(value)
}

// SetDBHealth updates the database health status
func (m *Metrics) SetDBHealth(healthy bool) {
	value := 0.0
	if healthy {
		value = 1.0
	}
	m.dbHealthy.Set(value)
}

// RecordRateLimitExceeded records a rate limit exceeded event
func (m *Metrics) RecordRateLimitExceeded(ip, apiKey string) {
	m.rateLimitExceeded.WithLabelValues(ip, apiKey).Inc()
}

// SetLastSuccessfulSync updates the timestamp of last successful operation
func (m *Metrics) SetLastSuccessfulSync(network, operation string) {
	m.lastSuccessfulSync.WithLabelValues(network, operation).SetToCurrentTime()
}

// RecordStreamOpened records a new stream being opened
func (m *Metrics) RecordStreamOpened(network, scheme string) {
	m.streamsOpened.WithLabelValues(network, scheme).Inc()
	m.activeStreams.WithLabelValues(network, scheme).Inc()
}

// RecordStreamUpdate records a stream update
func (m *Metrics) RecordStreamUpdate(network, scheme string) {
	m.streamsUpdated.WithLabelValues(network, scheme).Inc()
}

// RecordStreamClosed records a stream being closed
func (m *Metrics) RecordStreamClosed(network, scheme string, success bool) {
	result := "success"
	if !success {
		result = "failure"
	}
	m.streamsClosed.WithLabelValues(network, scheme, result).Inc()
	m.activeStreams.WithLabelValues(network, scheme).Dec()
}

// RecordStreamSettlement records a stream settlement
func (m *Metrics) RecordStreamSettlement(network, scheme string) {
	m.streamsSettled.WithLabelValues(network, scheme).Inc()
}

// RecordStreamDuration records the duration of a stream
func (m *Metrics) RecordStreamDuration(network, scheme string, duration time.Duration) {
	m.streamDuration.WithLabelValues(network, scheme).Observe(duration.Seconds())
}

// RecordIntentCreated records a new intent being created
func (m *Metrics) RecordIntentCreated(network, priority string) {
	m.intentsCreated.WithLabelValues(network, priority).Inc()
	m.activeIntents.WithLabelValues("pending").Inc()
}

// RecordIntentRouted records an intent being routed
func (m *Metrics) RecordIntentRouted(sourceNetwork, targetNetwork string) {
	m.intentsRouted.WithLabelValues(sourceNetwork, targetNetwork).Inc()
	m.activeIntents.WithLabelValues("pending").Dec()
	m.activeIntents.WithLabelValues("routed").Inc()
}

// RecordIntentCompleted records an intent being completed
func (m *Metrics) RecordIntentCompleted(sourceNetwork, targetNetwork string, success bool) {
	result := "success"
	if !success {
		result = "failure"
	}
	m.intentsCompleted.WithLabelValues(sourceNetwork, targetNetwork, result).Inc()
	m.activeIntents.WithLabelValues("routed").Dec()
}

// RecordIntentCancelled records an intent being cancelled
func (m *Metrics) RecordIntentCancelled(network string) {
	m.intentsCancelled.WithLabelValues(network).Inc()
	m.activeIntents.WithLabelValues("pending").Dec()
}

// RecordIntentExpired records an intent expiring
func (m *Metrics) RecordIntentExpired(network string) {
	m.intentsExpired.WithLabelValues(network).Inc()
	m.activeIntents.WithLabelValues("pending").Dec()
}

// RecordRouteScore records the score of a selected route
func (m *Metrics) RecordRouteScore(sourceNetwork, targetNetwork string, score float64) {
	m.routeScore.WithLabelValues(sourceNetwork, targetNetwork).Observe(score)
}

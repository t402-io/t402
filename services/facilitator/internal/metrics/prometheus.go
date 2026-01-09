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
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	verifyTotal     *prometheus.CounterVec
	settleTotal     *prometheus.CounterVec
	activeRequests  prometheus.Gauge
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
	}

	// Register all metrics
	prometheus.MustRegister(
		m.requestsTotal,
		m.requestDuration,
		m.verifyTotal,
		m.settleTotal,
		m.activeRequests,
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

// Handler returns the Prometheus HTTP handler
func (m *Metrics) Handler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

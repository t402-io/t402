package server

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// VerifyRequest is the request body for /verify
type VerifyRequest struct {
	PaymentPayload      json.RawMessage `json:"paymentPayload" binding:"required"`
	PaymentRequirements json.RawMessage `json:"paymentRequirements" binding:"required"`
}

// SettleRequest is the request body for /settle
type SettleRequest struct {
	PaymentPayload      json.RawMessage `json:"paymentPayload" binding:"required"`
	PaymentRequirements json.RawMessage `json:"paymentRequirements" binding:"required"`
}

// handleVerify handles POST /verify
func (s *Server) handleVerify(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// Call facilitator verify
	result, err := s.facilitator.Verify(
		c.Request.Context(),
		req.PaymentPayload,
		req.PaymentRequirements,
	)

	if err != nil {
		s.metrics.RecordVerify(network, scheme, false)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "verification failed",
			"details": err.Error(),
		})
		return
	}

	// Record metrics
	s.metrics.RecordVerify(network, scheme, result.IsValid)

	c.JSON(http.StatusOK, result)
}

// handleSettle handles POST /settle
func (s *Server) handleSettle(c *gin.Context) {
	var req SettleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// Call facilitator settle
	result, err := s.facilitator.Settle(
		c.Request.Context(),
		req.PaymentPayload,
		req.PaymentRequirements,
	)

	if err != nil {
		s.metrics.RecordSettle(network, scheme, false)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "settlement failed",
			"details": err.Error(),
		})
		return
	}

	// Record metrics
	s.metrics.RecordSettle(network, scheme, result.Success)

	status := http.StatusOK
	if !result.Success {
		status = http.StatusUnprocessableEntity
	}

	c.JSON(status, result)
}

// handleSupported handles GET /supported
func (s *Server) handleSupported(c *gin.Context) {
	supported := s.facilitator.GetSupported()
	c.JSON(http.StatusOK, supported)
}

// extractNetworkScheme extracts network and scheme from requirements JSON for metrics
func extractNetworkScheme(requirements json.RawMessage) (string, string) {
	var req struct {
		Network string `json:"network"`
		Scheme  string `json:"scheme"`
	}
	if err := json.Unmarshal(requirements, &req); err != nil {
		return "unknown", "unknown"
	}
	return req.Network, req.Scheme
}

// readBody reads the request body (helper for raw body handling)
func readBody(c *gin.Context) ([]byte, error) {
	return io.ReadAll(c.Request.Body)
}

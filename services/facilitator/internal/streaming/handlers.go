package streaming

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Input validation constants
// SECURITY: Prevents DoS attacks via oversized inputs
const (
	MaxStreamIDLength    = 64
	MaxAddressLength     = 128
	MaxAmountLength      = 78  // Max uint256 has 78 digits
	MaxSignatureLength   = 256 // Base64 encoded signatures
	MaxNetworkLength     = 64
	MaxSchemeLength      = 32
	MaxAssetLength       = 128
	MaxReasonLength      = 256
)

// validateStringLength checks if a string exceeds the maximum allowed length
func validateStringLength(s string, maxLen int) bool {
	return len(s) <= maxLen
}

// sanitizeError returns a safe error message without leaking implementation details
func sanitizeError(err error) string {
	if err == nil {
		return "unknown error"
	}
	errStr := err.Error()
	// Don't expose internal details like SQL errors, file paths, etc.
	if strings.Contains(errStr, "sql:") ||
		strings.Contains(errStr, "pq:") ||
		strings.Contains(errStr, "redis:") ||
		strings.Contains(errStr, "/") {
		return "internal error"
	}
	return errStr
}

// Handlers provides HTTP handlers for streaming API
type Handlers struct {
	service *Service
}

// NewHandlers creates new streaming handlers
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// RegisterRoutes registers streaming routes on a gin router group
func (h *Handlers) RegisterRoutes(rg *gin.RouterGroup) {
	streams := rg.Group("/stream")
	{
		streams.POST("/open", h.OpenStream)
		streams.POST("/update", h.UpdateStream)
		streams.POST("/close", h.CloseStream)
		streams.GET("/:id", h.GetStream)
		streams.POST("/:id/pause", h.PauseStream)
		streams.POST("/:id/resume", h.ResumeStream)
		streams.GET("", h.ListStreams)
	}
}

// OpenStream handles POST /stream/open
// @Summary Open a new payment stream
// @Description Opens a new payment stream with the specified parameters
// @Tags streaming
// @Accept json
// @Produce json
// @Param request body OpenStreamRequest true "Open stream request"
// @Success 201 {object} OpenStreamResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/open [post]
func (h *Handlers) OpenStream(c *gin.Context) {
	var req OpenStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
		})
		return
	}

	// SECURITY: Validate input field lengths to prevent DoS
	if !validateStringLength(req.Network, MaxNetworkLength) ||
		!validateStringLength(req.Scheme, MaxSchemeLength) ||
		!validateStringLength(req.Payer, MaxAddressLength) ||
		!validateStringLength(req.Payee, MaxAddressLength) ||
		!validateStringLength(req.Asset, MaxAssetLength) ||
		!validateStringLength(req.MaxAmount, MaxAmountLength) ||
		!validateStringLength(req.Signature, MaxSignatureLength) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "One or more fields exceed maximum allowed length",
		})
		return
	}

	resp, err := h.service.OpenStream(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrInvalidAmount:
			status = http.StatusBadRequest
			errCode = "invalid_amount"
		case ErrInvalidSignature:
			status = http.StatusBadRequest
			errCode = "invalid_signature"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: sanitizeError(err),
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// UpdateStream handles POST /stream/update
// @Summary Update a payment stream
// @Description Updates the current amount of a payment stream
// @Tags streaming
// @Accept json
// @Produce json
// @Param request body UpdateStreamRequest true "Update stream request"
// @Success 200 {object} UpdateStreamResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/update [post]
func (h *Handlers) UpdateStream(c *gin.Context) {
	var req UpdateStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
		})
		return
	}

	// SECURITY: Validate input field lengths
	if !validateStringLength(req.StreamID, MaxStreamIDLength) ||
		!validateStringLength(req.Amount, MaxAmountLength) ||
		!validateStringLength(req.Signature, MaxSignatureLength) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "One or more fields exceed maximum allowed length",
		})
		return
	}

	resp, err := h.service.UpdateStream(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrStreamNotFound:
			status = http.StatusNotFound
			errCode = "stream_not_found"
		case ErrStreamNotActive:
			status = http.StatusConflict
			errCode = "stream_not_active"
		case ErrStreamExpired:
			status = http.StatusGone
			errCode = "stream_expired"
		case ErrInvalidAmount:
			status = http.StatusBadRequest
			errCode = "invalid_amount"
		case ErrAmountExceeded:
			status = http.StatusBadRequest
			errCode = "amount_exceeded"
		case ErrInvalidSignature:
			status = http.StatusBadRequest
			errCode = "invalid_signature"
		case ErrInvalidSequence:
			status = http.StatusConflict
			errCode = "invalid_sequence"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: sanitizeError(err),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CloseStream handles POST /stream/close
// @Summary Close a payment stream
// @Description Closes a payment stream and settles the final amount
// @Tags streaming
// @Accept json
// @Produce json
// @Param request body CloseStreamRequest true "Close stream request"
// @Success 200 {object} CloseStreamResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/close [post]
func (h *Handlers) CloseStream(c *gin.Context) {
	var req CloseStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
		})
		return
	}

	// SECURITY: Validate input field lengths
	if !validateStringLength(req.StreamID, MaxStreamIDLength) ||
		!validateStringLength(req.FinalAmount, MaxAmountLength) ||
		!validateStringLength(req.PayerSignature, MaxSignatureLength) ||
		!validateStringLength(req.PayeeSignature, MaxSignatureLength) ||
		!validateStringLength(req.Reason, MaxReasonLength) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "One or more fields exceed maximum allowed length",
		})
		return
	}

	resp, err := h.service.CloseStream(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrStreamNotFound:
			status = http.StatusNotFound
			errCode = "stream_not_found"
		case ErrInvalidAmount:
			status = http.StatusBadRequest
			errCode = "invalid_amount"
		case ErrAmountExceeded:
			status = http.StatusBadRequest
			errCode = "amount_exceeded"
		case ErrInvalidSignature:
			status = http.StatusBadRequest
			errCode = "invalid_signature"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: sanitizeError(err),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetStream handles GET /stream/:id
// @Summary Get stream details
// @Description Retrieves details of a specific payment stream
// @Tags streaming
// @Produce json
// @Param id path string true "Stream ID"
// @Param include_updates query bool false "Include recent updates"
// @Param include_stats query bool false "Include statistics"
// @Success 200 {object} GetStreamResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/{id} [get]
func (h *Handlers) GetStream(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "stream ID is required",
		})
		return
	}

	includeUpdates := c.Query("include_updates") == "true"
	includeStats := c.Query("include_stats") == "true"

	resp, err := h.service.GetStream(c.Request.Context(), streamID, includeUpdates, includeStats)
	if err != nil {
		if err == ErrStreamNotFound {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "stream_not_found",
				Message: "stream not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// PauseStream handles POST /stream/:id/pause
// @Summary Pause a payment stream
// @Description Temporarily pauses an active payment stream
// @Tags streaming
// @Produce json
// @Param id path string true "Stream ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/{id}/pause [post]
func (h *Handlers) PauseStream(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "stream ID is required",
		})
		return
	}

	// Get requester from auth context
	requester := c.GetString("address")
	if requester == "" {
		// For API key auth, get from header
		requester = c.GetHeader("X-Requester-Address")
	}

	err := h.service.PauseStream(c.Request.Context(), streamID, requester)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrStreamNotFound:
			status = http.StatusNotFound
			errCode = "stream_not_found"
		case ErrUnauthorized:
			status = http.StatusForbidden
			errCode = "unauthorized"
		case ErrStreamNotActive:
			status = http.StatusConflict
			errCode = "stream_not_active"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, map[string]string{
		"status":  "paused",
		"message": "stream paused successfully",
	})
}

// ResumeStream handles POST /stream/:id/resume
// @Summary Resume a paused payment stream
// @Description Resumes a paused payment stream
// @Tags streaming
// @Produce json
// @Param id path string true "Stream ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream/{id}/resume [post]
func (h *Handlers) ResumeStream(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "stream ID is required",
		})
		return
	}

	// Get requester from auth context
	requester := c.GetString("address")
	if requester == "" {
		requester = c.GetHeader("X-Requester-Address")
	}

	err := h.service.ResumeStream(c.Request.Context(), streamID, requester)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrStreamNotFound:
			status = http.StatusNotFound
			errCode = "stream_not_found"
		case ErrUnauthorized:
			status = http.StatusForbidden
			errCode = "unauthorized"
		case ErrStreamExpired:
			status = http.StatusGone
			errCode = "stream_expired"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, map[string]string{
		"status":  "active",
		"message": "stream resumed successfully",
	})
}

// ListStreams handles GET /stream
// @Summary List payment streams
// @Description Lists payment streams with optional filtering
// @Tags streaming
// @Produce json
// @Param network query string false "Filter by network"
// @Param payer query string false "Filter by payer address"
// @Param payee query string false "Filter by payee address"
// @Param status query []string false "Filter by status"
// @Param limit query int false "Max results (default 20, max 100)"
// @Param offset query int false "Offset for pagination"
// @Param order_by query string false "Order by field"
// @Param order_desc query bool false "Descending order"
// @Success 200 {object} ListStreamsResponse
// @Failure 500 {object} ErrorResponse
// @Router /stream [get]
func (h *Handlers) ListStreams(c *gin.Context) {
	var req ListStreamsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.service.ListStreams(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

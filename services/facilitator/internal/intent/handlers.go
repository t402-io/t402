package intent

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handlers provides HTTP handlers for intent API
type Handlers struct {
	service *Service
}

// NewHandlers creates new intent handlers
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// RegisterRoutes registers intent routes on a gin router group
func (h *Handlers) RegisterRoutes(rg *gin.RouterGroup) {
	intents := rg.Group("/intent")
	{
		intents.POST("", h.CreateIntent)
		intents.GET("/:id", h.GetIntent)
		intents.POST("/:id/route", h.SelectRoute)
		intents.POST("/:id/execute", h.ExecuteIntent)
		intents.POST("/:id/cancel", h.CancelIntent)
		intents.POST("/:id/refresh", h.RefreshRoutes)
		intents.GET("", h.ListIntents)
		intents.GET("/stats", h.GetStats)
	}
}

// CreateIntent handles POST /intent
// @Summary Create a new payment intent
// @Description Creates a new payment intent and finds available routes
// @Tags intent
// @Accept json
// @Produce json
// @Param request body CreateIntentRequest true "Create intent request"
// @Success 201 {object} CreateIntentResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent [post]
func (h *Handlers) CreateIntent(c *gin.Context) {
	var req CreateIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.service.CreateIntent(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		if err == ErrInvalidIntent {
			status = http.StatusBadRequest
			errCode = "invalid_intent"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// GetIntent handles GET /intent/:id
// @Summary Get intent details
// @Description Retrieves details of a specific payment intent
// @Tags intent
// @Produce json
// @Param id path string true "Intent ID"
// @Success 200 {object} GetIntentResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent/{id} [get]
func (h *Handlers) GetIntent(c *gin.Context) {
	intentID := c.Param("id")
	if intentID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "intent ID is required",
		})
		return
	}

	resp, err := h.service.GetIntent(c.Request.Context(), intentID)
	if err != nil {
		if err == ErrIntentNotFound {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "intent_not_found",
				Message: "intent not found",
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

// SelectRoute handles POST /intent/:id/route
// @Summary Select a route for an intent
// @Description Selects an execution route for a payment intent
// @Tags intent
// @Accept json
// @Produce json
// @Param id path string true "Intent ID"
// @Param request body SelectRouteRequest true "Select route request"
// @Success 200 {object} SelectRouteResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent/{id}/route [post]
func (h *Handlers) SelectRoute(c *gin.Context) {
	intentID := c.Param("id")

	var req SelectRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}
	req.IntentID = intentID

	resp, err := h.service.SelectRoute(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrIntentNotFound:
			status = http.StatusNotFound
			errCode = "intent_not_found"
		case ErrIntentNotPending:
			status = http.StatusConflict
			errCode = "intent_not_pending"
		case ErrIntentExpired:
			status = http.StatusGone
			errCode = "intent_expired"
		case ErrRouteExpired:
			status = http.StatusGone
			errCode = "route_expired"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ExecuteIntent handles POST /intent/:id/execute
// @Summary Execute a payment intent
// @Description Executes a routed payment intent
// @Tags intent
// @Accept json
// @Produce json
// @Param id path string true "Intent ID"
// @Param request body ExecuteIntentRequest true "Execute intent request"
// @Success 200 {object} ExecuteIntentResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent/{id}/execute [post]
func (h *Handlers) ExecuteIntent(c *gin.Context) {
	intentID := c.Param("id")

	var req ExecuteIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}
	req.IntentID = intentID

	resp, err := h.service.ExecuteIntent(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrIntentNotFound:
			status = http.StatusNotFound
			errCode = "intent_not_found"
		case ErrIntentNotRouted:
			status = http.StatusConflict
			errCode = "no_route_selected"
		case ErrIntentExpired:
			status = http.StatusGone
			errCode = "intent_expired"
		case ErrRouteExpired:
			status = http.StatusGone
			errCode = "route_expired"
		case ErrInvalidSignature:
			status = http.StatusBadRequest
			errCode = "invalid_signature"
		case ErrExecutionFailed:
			status = http.StatusInternalServerError
			errCode = "execution_failed"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CancelIntent handles POST /intent/:id/cancel
// @Summary Cancel a payment intent
// @Description Cancels a pending or routed payment intent
// @Tags intent
// @Accept json
// @Produce json
// @Param id path string true "Intent ID"
// @Param request body CancelIntentRequest false "Cancel request with optional reason"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent/{id}/cancel [post]
func (h *Handlers) CancelIntent(c *gin.Context) {
	intentID := c.Param("id")

	var req CancelIntentRequest
	c.ShouldBindJSON(&req) // Optional body
	req.IntentID = intentID

	err := h.service.CancelIntent(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		if err == ErrIntentNotFound {
			status = http.StatusNotFound
			errCode = "intent_not_found"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, map[string]string{
		"status":  "cancelled",
		"message": "intent cancelled successfully",
	})
}

// RefreshRoutes handles POST /intent/:id/refresh
// @Summary Refresh available routes
// @Description Refreshes the available routes for a pending intent
// @Tags intent
// @Produce json
// @Param id path string true "Intent ID"
// @Success 200 {object} RefreshRoutesResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 410 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent/{id}/refresh [post]
func (h *Handlers) RefreshRoutes(c *gin.Context) {
	intentID := c.Param("id")

	req := &RefreshRoutesRequest{IntentID: intentID}
	resp, err := h.service.RefreshRoutes(c.Request.Context(), req)
	if err != nil {
		status := http.StatusInternalServerError
		errCode := "internal_error"

		switch err {
		case ErrIntentNotFound:
			status = http.StatusNotFound
			errCode = "intent_not_found"
		case ErrIntentExpired:
			status = http.StatusGone
			errCode = "intent_expired"
		}

		c.JSON(status, ErrorResponse{
			Error:   errCode,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ListIntents handles GET /intent
// @Summary List payment intents
// @Description Lists payment intents with optional filtering
// @Tags intent
// @Produce json
// @Param payer query string false "Filter by payer address"
// @Param payee query string false "Filter by payee address"
// @Param status query []string false "Filter by status"
// @Param limit query int false "Max results (default 20, max 100)"
// @Param offset query int false "Offset for pagination"
// @Success 200 {object} ListIntentsResponse
// @Failure 500 {object} ErrorResponse
// @Router /intent [get]
func (h *Handlers) ListIntents(c *gin.Context) {
	var req ListIntentsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	resp, err := h.service.ListIntents(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetStats handles GET /intent/stats
// @Summary Get intent statistics
// @Description Returns counts of intents by status
// @Tags intent
// @Produce json
// @Success 200 {object} map[string]int64
// @Failure 500 {object} ErrorResponse
// @Router /intent/stats [get]
func (h *Handlers) GetStats(c *gin.Context) {
	stats, err := h.service.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
		return
	}

	// Convert to string keys for JSON
	result := make(map[string]int64)
	for status, count := range stats {
		result[string(status)] = count
	}

	c.JSON(http.StatusOK, result)
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

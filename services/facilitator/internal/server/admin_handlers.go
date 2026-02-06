package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/streaming"
)

// P1-16: AdminHandlers provides HTTP endpoints for operational management.
// These endpoints require "admin" permission via the auth middleware.
type AdminHandlers struct {
	streamingService *streaming.Service
}

// NewAdminHandlers creates new admin handlers.
func NewAdminHandlers(streamingService *streaming.Service) *AdminHandlers {
	return &AdminHandlers{
		streamingService: streamingService,
	}
}

// RegisterRoutes registers admin routes on the given router group.
func (h *AdminHandlers) RegisterRoutes(group *gin.RouterGroup) {
	admin := group.Group("/admin")
	admin.POST("/auto-settle/pause", h.handlePauseAutoSettle)
	admin.POST("/auto-settle/resume", h.handleResumeAutoSettle)
	admin.GET("/auto-settle/status", h.handleAutoSettleStatus)
}

// handlePauseAutoSettle pauses the auto-settlement worker.
func (h *AdminHandlers) handlePauseAutoSettle(c *gin.Context) {
	if h.streamingService == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "streaming payments not enabled",
		})
		return
	}
	h.streamingService.PauseAutoSettle()
	c.JSON(http.StatusOK, gin.H{
		"status":  "paused",
		"message": "Auto-settlement worker has been paused",
	})
}

// handleResumeAutoSettle resumes the auto-settlement worker.
func (h *AdminHandlers) handleResumeAutoSettle(c *gin.Context) {
	if h.streamingService == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "streaming payments not enabled",
		})
		return
	}
	h.streamingService.ResumeAutoSettle()
	c.JSON(http.StatusOK, gin.H{
		"status":  "resumed",
		"message": "Auto-settlement worker has been resumed",
	})
}

// handleAutoSettleStatus returns the current auto-settlement status.
func (h *AdminHandlers) handleAutoSettleStatus(c *gin.Context) {
	if h.streamingService == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "streaming payments not enabled",
		})
		return
	}
	paused := h.streamingService.IsAutoSettlePaused()
	status := "running"
	if paused {
		status = "paused"
	}
	c.JSON(http.StatusOK, gin.H{
		"status": status,
	})
}

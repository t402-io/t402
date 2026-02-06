package discovery

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/auth"
	"github.com/t402-io/t402/services/facilitator/internal/errors"
)

// Handlers provides HTTP handlers for the discovery API.
type Handlers struct {
	repo *Repository
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(repo *Repository) *Handlers {
	return &Handlers{repo: repo}
}

// RegisterRoutes registers the discovery API routes.
func (h *Handlers) RegisterRoutes(rg *gin.RouterGroup) {
	discovery := rg.Group("/discovery")
	{
		discovery.GET("/resources", h.ListResources)
		discovery.GET("/resources/:id", h.GetResource)
		discovery.POST("/register", h.RegisterResource)
		discovery.PUT("/resources/:id", h.UpdateResource)
		discovery.DELETE("/resources/:id", h.DeleteResource)
	}
}

// ListResources handles GET /discovery/resources
// @Summary List discoverable resources
// @Description List t402-enabled resources from the Bazaar with optional filtering
// @Tags Discovery
// @Accept json
// @Produce json
// @Param type query string false "Filter by resource type (e.g., 'http')"
// @Param network query string false "Filter by network (e.g., 'eip155:8453')"
// @Param scheme query string false "Filter by payment scheme (e.g., 'exact')"
// @Param category query string false "Filter by metadata category"
// @Param provider query string false "Filter by metadata provider"
// @Param limit query int false "Maximum results (1-100)" default(20)
// @Param offset query int false "Pagination offset" default(0)
// @Success 200 {object} DiscoveryResponse
// @Failure 400 {object} errors.Error
// @Failure 500 {object} errors.Error
// @Router /discovery/resources [get]
func (h *Handlers) ListResources(c *gin.Context) {
	var params ListResourcesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidParameters, "Invalid query parameters", err.Error()))
		return
	}

	resources, total, err := h.repo.List(c.Request.Context(), &params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to list resources"))
		return
	}

	items := make([]DiscoveryItem, 0, len(resources))
	for _, r := range resources {
		item, err := ToDiscoveryItem(&r)
		if err != nil {
			continue // Skip malformed resources
		}
		items = append(items, *item)
	}

	response := DiscoveryResponse{
		T402Version: 2,
		Items:       items,
		Pagination: PaginationInfo{
			Limit:  params.Limit,
			Offset: params.Offset,
			Total:  int(total),
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetResource handles GET /discovery/resources/:id
// @Summary Get resource details
// @Description Get details of a specific discoverable resource
// @Tags Discovery
// @Accept json
// @Produce json
// @Param id path string true "Resource ID"
// @Success 200 {object} DiscoveryItem
// @Failure 404 {object} errors.Error
// @Failure 500 {object} errors.Error
// @Router /discovery/resources/{id} [get]
func (h *Handlers) GetResource(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidParameters, "Resource ID is required", ""))
		return
	}

	resource, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to get resource"))
		return
	}

	if resource == nil {
		c.JSON(http.StatusNotFound, errors.NewClientError(errors.ResourceNotFound, "Resource not found", ""))
		return
	}

	item, err := ToDiscoveryItem(resource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to process resource"))
		return
	}

	c.JSON(http.StatusOK, item)
}

// RegisterResource handles POST /discovery/register
// @Summary Register a new resource
// @Description Register a new t402-enabled resource in the Bazaar
// @Tags Discovery
// @Accept json
// @Produce json
// @Param resource body RegisterResourceRequest true "Resource registration data"
// @Success 201 {object} RegisterResourceResponse
// @Failure 400 {object} errors.Error
// @Failure 409 {object} errors.Error
// @Failure 500 {object} errors.Error
// @Router /discovery/register [post]
func (h *Handlers) RegisterResource(c *gin.Context) {
	var req RegisterResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Invalid request body", err.Error()))
		return
	}

	// Validate required fields
	if req.Resource == "" {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Resource URL is required", ""))
		return
	}
	if req.Type == "" {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Resource type is required", ""))
		return
	}
	if len(req.Accepts) == 0 {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "At least one payment option is required", ""))
		return
	}

	// Validate payment options
	for i, opt := range req.Accepts {
		if opt.Scheme == "" {
			c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Scheme is required for all payment options", ""))
			return
		}
		if opt.Network == "" {
			c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Network is required for all payment options", ""))
			return
		}
		if opt.Amount == "" {
			c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Amount is required for all payment options", ""))
			return
		}
		if opt.Asset == "" {
			c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Asset is required for all payment options", ""))
			return
		}
		if opt.PayTo == "" {
			c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "PayTo address is required for all payment options", ""))
			return
		}
		if opt.MaxTimeoutSeconds <= 0 {
			// Set default timeout
			req.Accepts[i].MaxTimeoutSeconds = 3600
		}
	}

	// Get owner ID from API key if available
	ownerID := auth.GetKeyName(c)

	// Create the resource
	resource, err := h.repo.Create(c.Request.Context(), &req, ownerID)
	if err != nil {
		if isConflictError(err) {
			c.JSON(http.StatusConflict, errors.NewClientError(errors.ResourceAlreadyExists, "Resource already exists", err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to create resource"))
		return
	}

	response := RegisterResourceResponse{
		ID:          resource.ID,
		Resource:    resource.Resource,
		Type:        resource.Type,
		T402Version: resource.T402Version,
		CreatedAt:   resource.CreatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// UpdateResource handles PUT /discovery/resources/:id
// @Summary Update a resource
// @Description Update an existing discoverable resource
// @Tags Discovery
// @Accept json
// @Produce json
// @Param id path string true "Resource ID"
// @Param resource body UpdateResourceRequest true "Resource update data"
// @Success 200 {object} DiscoveryItem
// @Failure 400 {object} errors.Error
// @Failure 403 {object} errors.Error
// @Failure 404 {object} errors.Error
// @Failure 500 {object} errors.Error
// @Router /discovery/resources/{id} [put]
func (h *Handlers) UpdateResource(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidParameters, "Resource ID is required", ""))
		return
	}

	var req UpdateResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidPayload, "Invalid request body", err.Error()))
		return
	}

	// Get owner ID from API key
	ownerID := auth.GetKeyName(c)

	resource, err := h.repo.Update(c.Request.Context(), id, &req, ownerID)
	if err != nil {
		if isAuthError(err) {
			c.JSON(http.StatusForbidden, errors.NewClientError(errors.NotAuthorized, "Not authorized to update this resource", ""))
			return
		}
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to update resource"))
		return
	}

	if resource == nil {
		c.JSON(http.StatusNotFound, errors.NewClientError(errors.ResourceNotFound, "Resource not found", ""))
		return
	}

	item, err := ToDiscoveryItem(resource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to process resource"))
		return
	}

	c.JSON(http.StatusOK, item)
}

// DeleteResource handles DELETE /discovery/resources/:id
// @Summary Delete a resource
// @Description Delete (deactivate) a discoverable resource
// @Tags Discovery
// @Accept json
// @Produce json
// @Param id path string true "Resource ID"
// @Success 204 "No Content"
// @Failure 403 {object} errors.Error
// @Failure 404 {object} errors.Error
// @Failure 500 {object} errors.Error
// @Router /discovery/resources/{id} [delete]
func (h *Handlers) DeleteResource(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, errors.NewClientError(errors.InvalidParameters, "Resource ID is required", ""))
		return
	}

	// Get owner ID from API key
	ownerID := auth.GetKeyName(c)

	err := h.repo.Delete(c.Request.Context(), id, ownerID)
	if err != nil {
		if isAuthError(err) {
			c.JSON(http.StatusForbidden, errors.NewClientError(errors.NotAuthorized, "Not authorized to delete this resource", ""))
			return
		}
		c.JSON(http.StatusInternalServerError, errors.NewInternalError("Failed to delete resource"))
		return
	}

	c.Status(http.StatusNoContent)
}

// isConflictError checks if an error indicates a conflict (duplicate resource).
func isConflictError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return contains(errStr, "already exists") ||
		contains(errStr, "duplicate") ||
		contains(errStr, "unique")
}

// isAuthError checks if an error indicates an authorization failure.
func isAuthError(err error) bool {
	if err == nil {
		return false
	}
	return contains(err.Error(), "not authorized")
}

// contains checks if a string contains a substring (case-insensitive would be better but keeping it simple).
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		len(s) > 0 && len(substr) > 0 && containsImpl(s, substr))
}

func containsImpl(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

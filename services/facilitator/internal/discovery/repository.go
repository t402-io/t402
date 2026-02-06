package discovery

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Repository handles database operations for discoverable resources.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new discovery repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// AutoMigrate creates or updates the database schema.
func (r *Repository) AutoMigrate() error {
	query := `
		CREATE TABLE IF NOT EXISTS discoverable_resources (
			id VARCHAR(255) PRIMARY KEY,
			resource TEXT NOT NULL UNIQUE,
			type VARCHAR(50) NOT NULL,
			t402_version INTEGER NOT NULL DEFAULT 2,
			accepts JSONB NOT NULL,
			metadata JSONB DEFAULT '{}',
			owner_id VARCHAR(255),
			active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_discoverable_resources_type ON discoverable_resources(type);
		CREATE INDEX IF NOT EXISTS idx_discoverable_resources_owner_id ON discoverable_resources(owner_id);
		CREATE INDEX IF NOT EXISTS idx_discoverable_resources_active ON discoverable_resources(active);
	`
	_, err := r.db.Exec(query)
	return err
}

// generateID generates a unique resource ID.
func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based ID
		return fmt.Sprintf("res_%d", time.Now().UnixNano())
	}
	return "res_" + hex.EncodeToString(b)
}

// Create registers a new discoverable resource.
func (r *Repository) Create(ctx context.Context, req *RegisterResourceRequest, ownerID string) (*DiscoverableResource, error) {
	// Validate accepts array
	if len(req.Accepts) == 0 {
		return nil, fmt.Errorf("accepts array must not be empty")
	}

	// Marshal accepts to JSON
	acceptsJSON, err := json.Marshal(req.Accepts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal accepts: %w", err)
	}

	// Marshal metadata to JSON (can be nil)
	var metadataJSON []byte
	if req.Metadata != nil {
		metadataJSON, err = json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
	} else {
		metadataJSON = []byte("{}")
	}

	// Set default t402Version if not specified
	t402Version := req.T402Version
	if t402Version == 0 {
		t402Version = 2
	}

	id := generateID()
	now := time.Now()

	query := `
		INSERT INTO discoverable_resources (id, resource, type, t402_version, accepts, metadata, owner_id, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8)
		RETURNING id, resource, type, t402_version, accepts, metadata, owner_id, active, created_at, updated_at
	`

	resource := &DiscoverableResource{}
	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	err = r.db.QueryRowContext(dbCtx, query, id, req.Resource, req.Type, t402Version, acceptsJSON, metadataJSON, ownerID, now).Scan(
		&resource.ID, &resource.Resource, &resource.Type, &resource.T402Version,
		&resource.Accepts, &resource.Metadata, &resource.OwnerID, &resource.Active,
		&resource.CreatedAt, &resource.UpdatedAt,
	)
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "duplicate") || strings.Contains(errLower, "unique") {
			return nil, fmt.Errorf("resource already exists: %s", req.Resource)
		}
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	return resource, nil
}

// GetByID retrieves a resource by ID.
func (r *Repository) GetByID(ctx context.Context, id string) (*DiscoverableResource, error) {
	query := `
		SELECT id, resource, type, t402_version, accepts, metadata, owner_id, active, created_at, updated_at
		FROM discoverable_resources
		WHERE id = $1
	`

	resource := &DiscoverableResource{}
	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	err := r.db.QueryRowContext(dbCtx, query, id).Scan(
		&resource.ID, &resource.Resource, &resource.Type, &resource.T402Version,
		&resource.Accepts, &resource.Metadata, &resource.OwnerID, &resource.Active,
		&resource.CreatedAt, &resource.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get resource: %w", err)
	}

	return resource, nil
}

// GetByResourceURL retrieves a resource by its URL.
func (r *Repository) GetByResourceURL(ctx context.Context, resourceURL string) (*DiscoverableResource, error) {
	query := `
		SELECT id, resource, type, t402_version, accepts, metadata, owner_id, active, created_at, updated_at
		FROM discoverable_resources
		WHERE resource = $1
	`

	resource := &DiscoverableResource{}
	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	err := r.db.QueryRowContext(dbCtx, query, resourceURL).Scan(
		&resource.ID, &resource.Resource, &resource.Type, &resource.T402Version,
		&resource.Accepts, &resource.Metadata, &resource.OwnerID, &resource.Active,
		&resource.CreatedAt, &resource.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get resource: %w", err)
	}

	return resource, nil
}

// List retrieves resources based on filter parameters.
func (r *Repository) List(ctx context.Context, params *ListResourcesParams) ([]DiscoverableResource, int64, error) {
	params.Validate()

	// Build the WHERE clause
	conditions := []string{}
	args := []interface{}{}
	argIndex := 1

	if params.ActiveOnly {
		conditions = append(conditions, fmt.Sprintf("active = $%d", argIndex))
		args = append(args, true)
		argIndex++
	}

	if params.Type != "" {
		conditions = append(conditions, fmt.Sprintf("type = $%d", argIndex))
		args = append(args, params.Type)
		argIndex++
	}

	// Filter by network (in accepts JSON array)
	if params.Network != "" {
		conditions = append(conditions, fmt.Sprintf("accepts @> $%d::jsonb", argIndex))
		args = append(args, fmt.Sprintf(`[{"network":"%s"}]`, params.Network))
		argIndex++
	}

	// Filter by scheme (in accepts JSON array)
	if params.Scheme != "" {
		conditions = append(conditions, fmt.Sprintf("accepts @> $%d::jsonb", argIndex))
		args = append(args, fmt.Sprintf(`[{"scheme":"%s"}]`, params.Scheme))
		argIndex++
	}

	// Filter by category (in metadata JSON)
	if params.Category != "" {
		conditions = append(conditions, fmt.Sprintf("metadata->>'category' = $%d", argIndex))
		args = append(args, params.Category)
		argIndex++
	}

	// Filter by provider (in metadata JSON)
	if params.Provider != "" {
		conditions = append(conditions, fmt.Sprintf("metadata->>'provider' = $%d", argIndex))
		args = append(args, params.Provider)
		argIndex++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM discoverable_resources %s", whereClause)

	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	var total int64
	if err := r.db.QueryRowContext(dbCtx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count resources: %w", err)
	}

	// List query with pagination
	listQuery := fmt.Sprintf(`
		SELECT id, resource, type, t402_version, accepts, metadata, owner_id, active, created_at, updated_at
		FROM discoverable_resources
		%s
		ORDER BY updated_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, params.Limit, params.Offset)

	rows, err := r.db.QueryContext(dbCtx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list resources: %w", err)
	}
	defer rows.Close()

	resources := []DiscoverableResource{}
	for rows.Next() {
		var resource DiscoverableResource
		if err := rows.Scan(
			&resource.ID, &resource.Resource, &resource.Type, &resource.T402Version,
			&resource.Accepts, &resource.Metadata, &resource.OwnerID, &resource.Active,
			&resource.CreatedAt, &resource.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan resource: %w", err)
		}
		resources = append(resources, resource)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate resources: %w", err)
	}

	return resources, total, nil
}

// Update updates a resource.
func (r *Repository) Update(ctx context.Context, id string, req *UpdateResourceRequest, ownerID string) (*DiscoverableResource, error) {
	// First get the existing resource
	resource, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if resource == nil {
		return nil, nil
	}

	// Check ownership if ownerID is provided
	if ownerID != "" && resource.OwnerID != ownerID {
		return nil, fmt.Errorf("not authorized to update this resource")
	}

	// Build the SET clause
	// Use CURRENT_TIMESTAMP for cross-database compatibility (PostgreSQL and SQLite)
	setClauses := []string{"updated_at = CURRENT_TIMESTAMP"}
	args := []interface{}{}
	argIndex := 1

	if req.Accepts != nil && len(req.Accepts) > 0 {
		acceptsJSON, err := json.Marshal(req.Accepts)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal accepts: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("accepts = $%d", argIndex))
		args = append(args, acceptsJSON)
		argIndex++
	}

	if req.Metadata != nil {
		metadataJSON, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("metadata = $%d", argIndex))
		args = append(args, metadataJSON)
		argIndex++
	}

	if req.Active != nil {
		setClauses = append(setClauses, fmt.Sprintf("active = $%d", argIndex))
		args = append(args, *req.Active)
		argIndex++
	}

	if len(setClauses) == 1 {
		// Only updated_at, nothing to update
		return resource, nil
	}

	query := fmt.Sprintf(`
		UPDATE discoverable_resources
		SET %s
		WHERE id = $%d
	`, strings.Join(setClauses, ", "), argIndex)

	args = append(args, id)

	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	if _, err := r.db.ExecContext(dbCtx, query, args...); err != nil {
		return nil, fmt.Errorf("failed to update resource: %w", err)
	}

	// Reload the resource
	return r.GetByID(ctx, id)
}

// Delete soft-deletes a resource by marking it as inactive.
func (r *Repository) Delete(ctx context.Context, id string, ownerID string) error {
	resource, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if resource == nil {
		return nil
	}

	// Check ownership if ownerID is provided
	if ownerID != "" && resource.OwnerID != ownerID {
		return fmt.Errorf("not authorized to delete this resource")
	}

	query := `UPDATE discoverable_resources SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`

	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	_, err = r.db.ExecContext(dbCtx, query, id)
	return err
}

// HardDelete permanently deletes a resource.
func (r *Repository) HardDelete(ctx context.Context, id string) error {
	query := `DELETE FROM discoverable_resources WHERE id = $1`

	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	_, err := r.db.ExecContext(dbCtx, query, id)
	return err
}

// CountByOwner returns the count of resources owned by a specific owner.
func (r *Repository) CountByOwner(ctx context.Context, ownerID string) (int64, error) {
	query := `SELECT COUNT(*) FROM discoverable_resources WHERE owner_id = $1 AND active = true`

	var dbCtx context.Context
	if ctx != nil {
		dbCtx = ctx
	} else {
		dbCtx = context.Background()
	}

	var count int64
	err := r.db.QueryRowContext(dbCtx, query, ownerID).Scan(&count)
	return count, err
}

// ToDiscoveryItem converts a DiscoverableResource to a DiscoveryItem.
func ToDiscoveryItem(resource *DiscoverableResource) (*DiscoveryItem, error) {
	var accepts []PaymentOption
	if err := json.Unmarshal([]byte(resource.Accepts), &accepts); err != nil {
		return nil, fmt.Errorf("failed to unmarshal accepts: %w", err)
	}

	var metadata *ResourceMetadata
	if resource.Metadata != "" && resource.Metadata != "{}" {
		metadata = &ResourceMetadata{}
		if err := json.Unmarshal([]byte(resource.Metadata), metadata); err != nil {
			// Non-fatal, just don't include metadata
			metadata = nil
		}
	}

	return &DiscoveryItem{
		ID:          resource.ID,
		Resource:    resource.Resource,
		Type:        resource.Type,
		T402Version: resource.T402Version,
		Accepts:     accepts,
		LastUpdated: resource.UpdatedAt.Unix(),
		Metadata:    metadata,
	}, nil
}

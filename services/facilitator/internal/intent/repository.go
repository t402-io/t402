package intent

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrIntentNotFound      = errors.New("intent not found")
	ErrIntentAlreadyExists = errors.New("intent already exists")
	ErrInvalidStatusChange = errors.New("invalid status change")
	ErrIntentExpired       = errors.New("intent has expired")
	ErrNoRouteSelected     = errors.New("no route selected")
	ErrRouteExpired        = errors.New("route has expired")
)

// Repository handles intent persistence
type Repository struct {
	db *sql.DB
}

// Tx wraps a database transaction for atomic operations
type Tx struct {
	tx *sql.Tx
}

// NewRepository creates a new intent repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// BeginTx starts a new database transaction
func (r *Repository) BeginTx(ctx context.Context) (*Tx, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	return &Tx{tx: tx}, nil
}

// Commit commits the transaction
func (t *Tx) Commit() error {
	return t.tx.Commit()
}

// Rollback rolls back the transaction
func (t *Tx) Rollback() error {
	return t.tx.Rollback()
}

// GetByIDForUpdate retrieves an intent by ID with a row-level lock (FOR UPDATE)
// This prevents concurrent modifications and race conditions
func (r *Repository) GetByIDForUpdate(ctx context.Context, tx *Tx, id string) (*Intent, error) {
	query := `
		SELECT
			id, payer, payee, amount, asset,
			source_networks, target_network, max_slippage, max_gas_cost,
			priority, status, selected_route, available_routes,
			created_at, expires_at, executed_at, tx_hashes, error_message, metadata
		FROM intents
		WHERE id = $1
		FOR UPDATE
	`

	intent := &Intent{}
	var sourceNetworks, txHashes pq.StringArray
	var selectedRouteJSON, routesJSON, metadataJSON []byte
	var executedAt sql.NullTime
	var targetNetwork, maxGasCost, errorMessage sql.NullString

	err := tx.tx.QueryRowContext(ctx, query, id).Scan(
		&intent.ID, &intent.Payer, &intent.Payee, &intent.Amount, &intent.Asset,
		&sourceNetworks, &targetNetwork, &intent.MaxSlippage, &maxGasCost,
		&intent.Priority, &intent.Status, &selectedRouteJSON, &routesJSON,
		&intent.CreatedAt, &intent.ExpiresAt, &executedAt, &txHashes, &errorMessage, &metadataJSON,
	)
	if err == sql.ErrNoRows {
		return nil, ErrIntentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get intent for update: %w", err)
	}

	intent.SourceNetworks = sourceNetworks
	intent.TxHashes = txHashes
	if targetNetwork.Valid {
		intent.TargetNetwork = targetNetwork.String
	}
	if maxGasCost.Valid {
		intent.MaxGasCost = maxGasCost.String
	}
	if errorMessage.Valid {
		intent.ErrorMessage = errorMessage.String
	}
	if executedAt.Valid {
		intent.ExecutedAt = &executedAt.Time
	}

	if len(selectedRouteJSON) > 0 && string(selectedRouteJSON) != "null" {
		intent.SelectedRoute = &Route{}
		if err := json.Unmarshal(selectedRouteJSON, intent.SelectedRoute); err != nil {
			return nil, fmt.Errorf("failed to unmarshal selected route: %w", err)
		}
	}

	if len(routesJSON) > 0 {
		if err := json.Unmarshal(routesJSON, &intent.AvailableRoutes); err != nil {
			return nil, fmt.Errorf("failed to unmarshal routes: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &intent.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return intent, nil
}

// UpdateInTx updates an intent within a transaction
func (r *Repository) UpdateInTx(ctx context.Context, tx *Tx, intent *Intent) error {
	routesJSON, err := json.Marshal(intent.AvailableRoutes)
	if err != nil {
		return fmt.Errorf("failed to marshal routes: %w", err)
	}

	selectedRouteJSON, err := json.Marshal(intent.SelectedRoute)
	if err != nil {
		return fmt.Errorf("failed to marshal selected route: %w", err)
	}

	metadataJSON, err := json.Marshal(intent.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		UPDATE intents SET
			status = $2,
			selected_route = $3,
			available_routes = $4,
			executed_at = $5,
			tx_hashes = $6,
			error_message = $7,
			metadata = $8
		WHERE id = $1
	`

	result, err := tx.tx.ExecContext(ctx, query,
		intent.ID, intent.Status, selectedRouteJSON, routesJSON,
		intent.ExecutedAt, pq.Array(intent.TxHashes), intent.ErrorMessage, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to update intent in transaction: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrIntentNotFound
	}

	return nil
}

// Create creates a new intent
func (r *Repository) Create(ctx context.Context, intent *Intent) error {
	if intent.ID == "" {
		intent.ID = uuid.New().String()
	}
	intent.CreatedAt = time.Now().UTC()

	routesJSON, err := json.Marshal(intent.AvailableRoutes)
	if err != nil {
		return fmt.Errorf("failed to marshal routes: %w", err)
	}

	selectedRouteJSON, err := json.Marshal(intent.SelectedRoute)
	if err != nil {
		return fmt.Errorf("failed to marshal selected route: %w", err)
	}

	metadataJSON, err := json.Marshal(intent.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		INSERT INTO intents (
			id, payer, payee, amount, asset,
			source_networks, target_network, max_slippage, max_gas_cost,
			priority, status, selected_route, available_routes,
			created_at, expires_at, executed_at, tx_hashes, error_message, metadata
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13,
			$14, $15, $16, $17, $18, $19
		)
	`

	_, err = r.db.ExecContext(ctx, query,
		intent.ID, intent.Payer, intent.Payee, intent.Amount, intent.Asset,
		pq.Array(intent.SourceNetworks), intent.TargetNetwork, intent.MaxSlippage, intent.MaxGasCost,
		intent.Priority, intent.Status, selectedRouteJSON, routesJSON,
		intent.CreatedAt, intent.ExpiresAt, intent.ExecutedAt, pq.Array(intent.TxHashes), intent.ErrorMessage, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to create intent: %w", err)
	}

	return nil
}

// GetByID retrieves an intent by ID
func (r *Repository) GetByID(ctx context.Context, id string) (*Intent, error) {
	query := `
		SELECT
			id, payer, payee, amount, asset,
			source_networks, target_network, max_slippage, max_gas_cost,
			priority, status, selected_route, available_routes,
			created_at, expires_at, executed_at, tx_hashes, error_message, metadata
		FROM intents
		WHERE id = $1
	`

	intent := &Intent{}
	var sourceNetworks, txHashes pq.StringArray
	var selectedRouteJSON, routesJSON, metadataJSON []byte
	var executedAt sql.NullTime
	var targetNetwork, maxGasCost, errorMessage sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&intent.ID, &intent.Payer, &intent.Payee, &intent.Amount, &intent.Asset,
		&sourceNetworks, &targetNetwork, &intent.MaxSlippage, &maxGasCost,
		&intent.Priority, &intent.Status, &selectedRouteJSON, &routesJSON,
		&intent.CreatedAt, &intent.ExpiresAt, &executedAt, &txHashes, &errorMessage, &metadataJSON,
	)
	if err == sql.ErrNoRows {
		return nil, ErrIntentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get intent: %w", err)
	}

	intent.SourceNetworks = sourceNetworks
	intent.TxHashes = txHashes
	if targetNetwork.Valid {
		intent.TargetNetwork = targetNetwork.String
	}
	if maxGasCost.Valid {
		intent.MaxGasCost = maxGasCost.String
	}
	if errorMessage.Valid {
		intent.ErrorMessage = errorMessage.String
	}
	if executedAt.Valid {
		intent.ExecutedAt = &executedAt.Time
	}

	if len(selectedRouteJSON) > 0 && string(selectedRouteJSON) != "null" {
		intent.SelectedRoute = &Route{}
		if err := json.Unmarshal(selectedRouteJSON, intent.SelectedRoute); err != nil {
			return nil, fmt.Errorf("failed to unmarshal selected route: %w", err)
		}
	}

	if len(routesJSON) > 0 {
		if err := json.Unmarshal(routesJSON, &intent.AvailableRoutes); err != nil {
			return nil, fmt.Errorf("failed to unmarshal routes: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &intent.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return intent, nil
}

// Update updates an intent
func (r *Repository) Update(ctx context.Context, intent *Intent) error {
	routesJSON, err := json.Marshal(intent.AvailableRoutes)
	if err != nil {
		return fmt.Errorf("failed to marshal routes: %w", err)
	}

	selectedRouteJSON, err := json.Marshal(intent.SelectedRoute)
	if err != nil {
		return fmt.Errorf("failed to marshal selected route: %w", err)
	}

	metadataJSON, err := json.Marshal(intent.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		UPDATE intents SET
			status = $2,
			selected_route = $3,
			available_routes = $4,
			executed_at = $5,
			tx_hashes = $6,
			error_message = $7,
			metadata = $8
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query,
		intent.ID, intent.Status, selectedRouteJSON, routesJSON,
		intent.ExecutedAt, pq.Array(intent.TxHashes), intent.ErrorMessage, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to update intent: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrIntentNotFound
	}

	return nil
}

// UpdateStatus updates only the intent status
func (r *Repository) UpdateStatus(ctx context.Context, id string, status IntentStatus, errorMsg string) error {
	query := `
		UPDATE intents SET
			status = $2,
			error_message = $3
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, status, errorMsg)
	if err != nil {
		return fmt.Errorf("failed to update intent status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrIntentNotFound
	}

	return nil
}

// List lists intents with filtering
func (r *Repository) List(ctx context.Context, filter ListIntentsRequest) ([]*Intent, int64, error) {
	// Build query with filters
	baseQuery := `FROM intents WHERE 1=1`
	countQuery := `SELECT COUNT(*) ` + baseQuery
	selectQuery := `
		SELECT
			id, payer, payee, amount, asset,
			source_networks, target_network, max_slippage, max_gas_cost,
			priority, status, selected_route, available_routes,
			created_at, expires_at, executed_at, tx_hashes, error_message, metadata
	` + baseQuery

	args := []interface{}{}
	argNum := 1

	if filter.Payer != "" {
		selectQuery += fmt.Sprintf(" AND payer = $%d", argNum)
		countQuery += fmt.Sprintf(" AND payer = $%d", argNum)
		args = append(args, filter.Payer)
		argNum++
	}
	if filter.Payee != "" {
		selectQuery += fmt.Sprintf(" AND payee = $%d", argNum)
		countQuery += fmt.Sprintf(" AND payee = $%d", argNum)
		args = append(args, filter.Payee)
		argNum++
	}
	if len(filter.Status) > 0 {
		selectQuery += fmt.Sprintf(" AND status = ANY($%d)", argNum)
		countQuery += fmt.Sprintf(" AND status = ANY($%d)", argNum)
		args = append(args, pq.Array(filter.Status))
		argNum++
	}

	// Get total count
	var total int64
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count intents: %w", err)
	}

	// Add ordering and pagination
	selectQuery += " ORDER BY created_at DESC"

	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	if filter.Limit > 100 {
		filter.Limit = 100
	}
	selectQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, filter.Limit, filter.Offset)

	// Execute query
	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list intents: %w", err)
	}
	defer rows.Close()

	intents := []*Intent{}
	for rows.Next() {
		intent := &Intent{}
		var sourceNetworks, txHashes pq.StringArray
		var selectedRouteJSON, routesJSON, metadataJSON []byte
		var executedAt sql.NullTime
		var targetNetwork, maxGasCost, errorMessage sql.NullString

		err := rows.Scan(
			&intent.ID, &intent.Payer, &intent.Payee, &intent.Amount, &intent.Asset,
			&sourceNetworks, &targetNetwork, &intent.MaxSlippage, &maxGasCost,
			&intent.Priority, &intent.Status, &selectedRouteJSON, &routesJSON,
			&intent.CreatedAt, &intent.ExpiresAt, &executedAt, &txHashes, &errorMessage, &metadataJSON,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan intent: %w", err)
		}

		intent.SourceNetworks = sourceNetworks
		intent.TxHashes = txHashes
		if targetNetwork.Valid {
			intent.TargetNetwork = targetNetwork.String
		}
		if maxGasCost.Valid {
			intent.MaxGasCost = maxGasCost.String
		}
		if errorMessage.Valid {
			intent.ErrorMessage = errorMessage.String
		}
		if executedAt.Valid {
			intent.ExecutedAt = &executedAt.Time
		}

		if len(selectedRouteJSON) > 0 && string(selectedRouteJSON) != "null" {
			intent.SelectedRoute = &Route{}
			json.Unmarshal(selectedRouteJSON, intent.SelectedRoute)
		}

		if len(routesJSON) > 0 {
			json.Unmarshal(routesJSON, &intent.AvailableRoutes)
		}

		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &intent.Metadata)
		}

		intents = append(intents, intent)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate intents: %w", err)
	}

	return intents, total, nil
}

// GetExpiredIntents gets intents that have expired
func (r *Repository) GetExpiredIntents(ctx context.Context) ([]*Intent, error) {
	query := `
		SELECT id
		FROM intents
		WHERE status IN ('pending', 'routed')
		  AND expires_at < $1
	`

	rows, err := r.db.QueryContext(ctx, query, time.Now().UTC())
	if err != nil {
		return nil, fmt.Errorf("failed to get expired intents: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan id: %w", err)
		}
		ids = append(ids, id)
	}

	intents := make([]*Intent, 0, len(ids))
	for _, id := range ids {
		intent, err := r.GetByID(ctx, id)
		if err == nil {
			intents = append(intents, intent)
		}
	}

	return intents, nil
}

// GetPendingIntents gets intents that are pending execution
func (r *Repository) GetPendingIntents(ctx context.Context, limit int) ([]*Intent, error) {
	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT id
		FROM intents
		WHERE status = 'routed'
		  AND expires_at > $1
		ORDER BY
			CASE priority
				WHEN 'urgent' THEN 1
				WHEN 'high' THEN 2
				WHEN 'normal' THEN 3
				WHEN 'low' THEN 4
			END,
			created_at ASC
		LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, time.Now().UTC(), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending intents: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan id: %w", err)
		}
		ids = append(ids, id)
	}

	intents := make([]*Intent, 0, len(ids))
	for _, id := range ids {
		intent, err := r.GetByID(ctx, id)
		if err == nil {
			intents = append(intents, intent)
		}
	}

	return intents, nil
}

// CountByStatus counts intents by status
func (r *Repository) CountByStatus(ctx context.Context) (map[IntentStatus]int64, error) {
	query := `
		SELECT status, COUNT(*) as count
		FROM intents
		GROUP BY status
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to count by status: %w", err)
	}
	defer rows.Close()

	counts := make(map[IntentStatus]int64)
	for rows.Next() {
		var status IntentStatus
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		counts[status] = count
	}

	return counts, nil
}

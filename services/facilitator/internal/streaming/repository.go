package streaming

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrStreamNotFound      = errors.New("stream not found")
	ErrStreamAlreadyExists = errors.New("stream already exists")
	ErrInvalidStatus       = errors.New("invalid stream status transition")
	ErrStreamExpired       = errors.New("stream has expired")
	ErrAmountExceeded      = errors.New("amount exceeds maximum authorized")
	ErrInvalidSequence     = errors.New("invalid update sequence number")
)

// Repository handles stream persistence
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new stream repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Create creates a new stream
func (r *Repository) Create(ctx context.Context, stream *Stream) error {
	if stream.ID == "" {
		stream.ID = uuid.New().String()
	}
	stream.CreatedAt = time.Now().UTC()
	stream.LastUpdatedAt = stream.CreatedAt

	metadataJSON, err := json.Marshal(stream.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		INSERT INTO streams (
			id, network, scheme, payer, payee, asset,
			max_amount, current_amount, settled_amount, rate_per_second,
			status, created_at, activated_at, last_updated_at, expires_at,
			closed_at, deposit_tx_hash, settlement_tx_hash, metadata
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19
		)
	`

	_, err = r.db.ExecContext(ctx, query,
		stream.ID, stream.Network, stream.Scheme, stream.Payer, stream.Payee, stream.Asset,
		stream.MaxAmount, stream.CurrentAmount, stream.SettledAmount, stream.RatePerSecond,
		stream.Status, stream.CreatedAt, stream.ActivatedAt, stream.LastUpdatedAt, stream.ExpiresAt,
		stream.ClosedAt, stream.DepositTxHash, stream.SettlementTxHash, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to create stream: %w", err)
	}

	return nil
}

// GetByID retrieves a stream by ID
func (r *Repository) GetByID(ctx context.Context, id string) (*Stream, error) {
	query := `
		SELECT
			id, network, scheme, payer, payee, asset,
			max_amount, current_amount, settled_amount, rate_per_second,
			status, created_at, activated_at, last_updated_at, expires_at,
			closed_at, deposit_tx_hash, settlement_tx_hash, metadata
		FROM streams
		WHERE id = $1
	`

	stream := &Stream{}
	var metadataJSON []byte
	var activatedAt, expiresAt, closedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&stream.ID, &stream.Network, &stream.Scheme, &stream.Payer, &stream.Payee, &stream.Asset,
		&stream.MaxAmount, &stream.CurrentAmount, &stream.SettledAmount, &stream.RatePerSecond,
		&stream.Status, &stream.CreatedAt, &activatedAt, &stream.LastUpdatedAt, &expiresAt,
		&closedAt, &stream.DepositTxHash, &stream.SettlementTxHash, &metadataJSON,
	)
	if err == sql.ErrNoRows {
		return nil, ErrStreamNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get stream: %w", err)
	}

	if activatedAt.Valid {
		stream.ActivatedAt = &activatedAt.Time
	}
	if expiresAt.Valid {
		stream.ExpiresAt = &expiresAt.Time
	}
	if closedAt.Valid {
		stream.ClosedAt = &closedAt.Time
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &stream.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return stream, nil
}

// Update updates a stream
func (r *Repository) Update(ctx context.Context, stream *Stream) error {
	stream.LastUpdatedAt = time.Now().UTC()

	metadataJSON, err := json.Marshal(stream.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		UPDATE streams SET
			current_amount = $2,
			settled_amount = $3,
			status = $4,
			activated_at = $5,
			last_updated_at = $6,
			closed_at = $7,
			deposit_tx_hash = $8,
			settlement_tx_hash = $9,
			metadata = $10
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query,
		stream.ID, stream.CurrentAmount, stream.SettledAmount, stream.Status,
		stream.ActivatedAt, stream.LastUpdatedAt, stream.ClosedAt,
		stream.DepositTxHash, stream.SettlementTxHash, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to update stream: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrStreamNotFound
	}

	return nil
}

// UpdateStatus updates only the stream status
func (r *Repository) UpdateStatus(ctx context.Context, id string, status StreamStatus) error {
	query := `
		UPDATE streams SET
			status = $2,
			last_updated_at = $3
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, status, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to update stream status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrStreamNotFound
	}

	return nil
}

// List lists streams with filtering
func (r *Repository) List(ctx context.Context, filter ListStreamsRequest) ([]*Stream, int64, error) {
	// Build query with filters
	baseQuery := `FROM streams WHERE 1=1`
	countQuery := `SELECT COUNT(*) ` + baseQuery
	selectQuery := `
		SELECT
			id, network, scheme, payer, payee, asset,
			max_amount, current_amount, settled_amount, rate_per_second,
			status, created_at, activated_at, last_updated_at, expires_at,
			closed_at, deposit_tx_hash, settlement_tx_hash, metadata
	` + baseQuery

	args := []interface{}{}
	argNum := 1

	if filter.Network != "" {
		selectQuery += fmt.Sprintf(" AND network = $%d", argNum)
		countQuery += fmt.Sprintf(" AND network = $%d", argNum)
		args = append(args, filter.Network)
		argNum++
	}
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
		args = append(args, filter.Status)
		argNum++
	}

	// Get total count
	var total int64
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count streams: %w", err)
	}

	// Add ordering
	orderBy := "created_at"
	if filter.OrderBy != "" {
		orderBy = filter.OrderBy
	}
	orderDir := "ASC"
	if filter.OrderDesc {
		orderDir = "DESC"
	}
	selectQuery += fmt.Sprintf(" ORDER BY %s %s", orderBy, orderDir)

	// Add pagination
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
		return nil, 0, fmt.Errorf("failed to list streams: %w", err)
	}
	defer rows.Close()

	streams := []*Stream{}
	for rows.Next() {
		stream := &Stream{}
		var metadataJSON []byte
		var activatedAt, expiresAt, closedAt sql.NullTime

		err := rows.Scan(
			&stream.ID, &stream.Network, &stream.Scheme, &stream.Payer, &stream.Payee, &stream.Asset,
			&stream.MaxAmount, &stream.CurrentAmount, &stream.SettledAmount, &stream.RatePerSecond,
			&stream.Status, &stream.CreatedAt, &activatedAt, &stream.LastUpdatedAt, &expiresAt,
			&closedAt, &stream.DepositTxHash, &stream.SettlementTxHash, &metadataJSON,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan stream: %w", err)
		}

		if activatedAt.Valid {
			stream.ActivatedAt = &activatedAt.Time
		}
		if expiresAt.Valid {
			stream.ExpiresAt = &expiresAt.Time
		}
		if closedAt.Valid {
			stream.ClosedAt = &closedAt.Time
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &stream.Metadata); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		streams = append(streams, stream)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate streams: %w", err)
	}

	return streams, total, nil
}

// CreateUpdate records a stream update
func (r *Repository) CreateUpdate(ctx context.Context, update *StreamUpdate) error {
	if update.ID == "" {
		update.ID = uuid.New().String()
	}
	update.Timestamp = time.Now().UTC()

	query := `
		INSERT INTO stream_updates (
			id, stream_id, amount, signature, timestamp, sequence_num, resource_units
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.db.ExecContext(ctx, query,
		update.ID, update.StreamID, update.Amount, update.Signature,
		update.Timestamp, update.SequenceNum, update.ResourceUnits,
	)
	if err != nil {
		return fmt.Errorf("failed to create stream update: %w", err)
	}

	return nil
}

// GetUpdates retrieves updates for a stream
func (r *Repository) GetUpdates(ctx context.Context, streamID string, limit int) ([]*StreamUpdate, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, stream_id, amount, signature, timestamp, sequence_num, resource_units
		FROM stream_updates
		WHERE stream_id = $1
		ORDER BY sequence_num DESC
		LIMIT $2
	`

	rows, err := r.db.QueryContext(ctx, query, streamID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get updates: %w", err)
	}
	defer rows.Close()

	updates := []*StreamUpdate{}
	for rows.Next() {
		update := &StreamUpdate{}
		err := rows.Scan(
			&update.ID, &update.StreamID, &update.Amount, &update.Signature,
			&update.Timestamp, &update.SequenceNum, &update.ResourceUnits,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan update: %w", err)
		}
		updates = append(updates, update)
	}

	return updates, nil
}

// GetLatestUpdate gets the latest update for a stream
func (r *Repository) GetLatestUpdate(ctx context.Context, streamID string) (*StreamUpdate, error) {
	query := `
		SELECT id, stream_id, amount, signature, timestamp, sequence_num, resource_units
		FROM stream_updates
		WHERE stream_id = $1
		ORDER BY sequence_num DESC
		LIMIT 1
	`

	update := &StreamUpdate{}
	err := r.db.QueryRowContext(ctx, query, streamID).Scan(
		&update.ID, &update.StreamID, &update.Amount, &update.Signature,
		&update.Timestamp, &update.SequenceNum, &update.ResourceUnits,
	)
	if err == sql.ErrNoRows {
		return nil, nil // No updates yet
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest update: %w", err)
	}

	return update, nil
}

// GetStreamStats calculates statistics for a stream
func (r *Repository) GetStreamStats(ctx context.Context, streamID string) (*StreamStats, error) {
	query := `
		SELECT
			COUNT(*) as total_updates,
			COALESCE(SUM(resource_units), 0) as total_resources,
			COALESCE(MAX(timestamp) - MIN(timestamp), INTERVAL '0') as duration
		FROM stream_updates
		WHERE stream_id = $1
	`

	stats := &StreamStats{}
	var duration time.Duration

	err := r.db.QueryRowContext(ctx, query, streamID).Scan(
		&stats.TotalUpdates,
		&stats.ResourcesUsed,
		&duration,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get stream stats: %w", err)
	}

	stats.Duration = int64(duration.Seconds())

	return stats, nil
}

// GetExpiredStreams gets streams that have expired
func (r *Repository) GetExpiredStreams(ctx context.Context) ([]*Stream, error) {
	query := `
		SELECT
			id, network, scheme, payer, payee, asset,
			max_amount, current_amount, settled_amount, rate_per_second,
			status, created_at, activated_at, last_updated_at, expires_at,
			closed_at, deposit_tx_hash, settlement_tx_hash, metadata
		FROM streams
		WHERE status IN ('pending', 'active', 'paused')
		  AND expires_at IS NOT NULL
		  AND expires_at < $1
	`

	rows, err := r.db.QueryContext(ctx, query, time.Now().UTC())
	if err != nil {
		return nil, fmt.Errorf("failed to get expired streams: %w", err)
	}
	defer rows.Close()

	streams := []*Stream{}
	for rows.Next() {
		stream := &Stream{}
		var metadataJSON []byte
		var activatedAt, expiresAt, closedAt sql.NullTime

		err := rows.Scan(
			&stream.ID, &stream.Network, &stream.Scheme, &stream.Payer, &stream.Payee, &stream.Asset,
			&stream.MaxAmount, &stream.CurrentAmount, &stream.SettledAmount, &stream.RatePerSecond,
			&stream.Status, &stream.CreatedAt, &activatedAt, &stream.LastUpdatedAt, &expiresAt,
			&closedAt, &stream.DepositTxHash, &stream.SettlementTxHash, &metadataJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan stream: %w", err)
		}

		if activatedAt.Valid {
			stream.ActivatedAt = &activatedAt.Time
		}
		if expiresAt.Valid {
			stream.ExpiresAt = &expiresAt.Time
		}
		if closedAt.Valid {
			stream.ClosedAt = &closedAt.Time
		}

		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &stream.Metadata)
		}

		streams = append(streams, stream)
	}

	return streams, nil
}

// CreateEvent records a stream event
func (r *Repository) CreateEvent(ctx context.Context, event *StreamEvent) error {
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	event.Timestamp = time.Now().UTC()

	dataJSON, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	query := `
		INSERT INTO stream_events (id, stream_id, type, data, timestamp)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err = r.db.ExecContext(ctx, query,
		event.ID, event.StreamID, event.Type, dataJSON, event.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("failed to create event: %w", err)
	}

	return nil
}

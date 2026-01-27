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

// allowedOrderByColumns defines the whitelist of columns that can be used for ORDER BY
// SECURITY: This prevents SQL injection attacks via the OrderBy parameter
var allowedOrderByColumns = map[string]bool{
	"created_at":      true,
	"updated_at":      true,
	"last_updated_at": true,
	"status":          true,
	"network":         true,
	"payer":           true,
	"payee":           true,
	"current_amount":  true,
	"max_amount":      true,
}

// Repository handles stream persistence
type Repository struct {
	db *sql.DB
}

// Tx wraps a database transaction for atomic operations
type Tx struct {
	tx *sql.Tx
}

// NewRepository creates a new stream repository
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

// GetByIDForUpdate retrieves a stream by ID with a row-level lock (FOR UPDATE)
// This prevents concurrent modifications and race conditions
func (r *Repository) GetByIDForUpdate(ctx context.Context, tx *Tx, id string) (*Stream, error) {
	query := `
		SELECT
			id, network, scheme, payer, payee, asset,
			max_amount, current_amount, settled_amount, rate_per_second,
			status, created_at, activated_at, last_updated_at, expires_at,
			closed_at, deposit_tx_hash, settlement_tx_hash, metadata
		FROM streams
		WHERE id = $1
		FOR UPDATE
	`

	stream := &Stream{}
	var metadataJSON []byte
	var activatedAt, expiresAt, closedAt sql.NullTime

	err := tx.tx.QueryRowContext(ctx, query, id).Scan(
		&stream.ID, &stream.Network, &stream.Scheme, &stream.Payer, &stream.Payee, &stream.Asset,
		&stream.MaxAmount, &stream.CurrentAmount, &stream.SettledAmount, &stream.RatePerSecond,
		&stream.Status, &stream.CreatedAt, &activatedAt, &stream.LastUpdatedAt, &expiresAt,
		&closedAt, &stream.DepositTxHash, &stream.SettlementTxHash, &metadataJSON,
	)
	if err == sql.ErrNoRows {
		return nil, ErrStreamNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get stream for update: %w", err)
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

// UpdateInTx updates a stream within a transaction
func (r *Repository) UpdateInTx(ctx context.Context, tx *Tx, stream *Stream) error {
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

	result, err := tx.tx.ExecContext(ctx, query,
		stream.ID, stream.CurrentAmount, stream.SettledAmount, stream.Status,
		stream.ActivatedAt, stream.LastUpdatedAt, stream.ClosedAt,
		stream.DepositTxHash, stream.SettlementTxHash, metadataJSON,
	)
	if err != nil {
		return fmt.Errorf("failed to update stream in transaction: %w", err)
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

	// Add ordering with whitelist validation to prevent SQL injection
	// SECURITY: Only allow columns in the whitelist to prevent ORDER BY injection
	orderBy := "created_at"
	if filter.OrderBy != "" {
		if allowedOrderByColumns[filter.OrderBy] {
			orderBy = filter.OrderBy
		}
		// If OrderBy is not in whitelist, silently use default (created_at)
		// This prevents attackers from knowing which columns are allowed
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

// CreateUpdateInTx records a stream update within a transaction
// SECURITY: Use this method to ensure atomic sequence number assignment
func (r *Repository) CreateUpdateInTx(ctx context.Context, tx *Tx, update *StreamUpdate) error {
	if update.ID == "" {
		update.ID = uuid.New().String()
	}
	update.Timestamp = time.Now().UTC()

	query := `
		INSERT INTO stream_updates (
			id, stream_id, amount, signature, timestamp, sequence_num, resource_units
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := tx.tx.ExecContext(ctx, query,
		update.ID, update.StreamID, update.Amount, update.Signature,
		update.Timestamp, update.SequenceNum, update.ResourceUnits,
	)
	if err != nil {
		return fmt.Errorf("failed to create stream update in transaction: %w", err)
	}

	return nil
}

// GetLatestUpdateInTx gets the latest update for a stream within a transaction
// SECURITY: Use with FOR UPDATE to ensure atomic sequence number calculation
func (r *Repository) GetLatestUpdateInTx(ctx context.Context, tx *Tx, streamID string) (*StreamUpdate, error) {
	query := `
		SELECT id, stream_id, amount, signature, timestamp, sequence_num, resource_units
		FROM stream_updates
		WHERE stream_id = $1
		ORDER BY sequence_num DESC
		LIMIT 1
		FOR UPDATE
	`

	update := &StreamUpdate{}
	err := tx.tx.QueryRowContext(ctx, query, streamID).Scan(
		&update.ID, &update.StreamID, &update.Amount, &update.Signature,
		&update.Timestamp, &update.SequenceNum, &update.ResourceUnits,
	)
	if err == sql.ErrNoRows {
		return nil, nil // No updates yet
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest update in transaction: %w", err)
	}

	return update, nil
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

// RepositoryAdapter wraps *Repository and implements RepositoryInterface
// This enables dependency injection for testing while preserving existing code
type RepositoryAdapter struct {
	repo *Repository
}

// NewRepositoryAdapter creates a new adapter that implements RepositoryInterface
func NewRepositoryAdapter(repo *Repository) *RepositoryAdapter {
	return &RepositoryAdapter{repo: repo}
}

// Ensure RepositoryAdapter implements RepositoryInterface
var _ RepositoryInterface = (*RepositoryAdapter)(nil)

func (a *RepositoryAdapter) BeginTx(ctx context.Context) (TxInterface, error) {
	return a.repo.BeginTx(ctx)
}

func (a *RepositoryAdapter) Create(ctx context.Context, stream *Stream) error {
	return a.repo.Create(ctx, stream)
}

func (a *RepositoryAdapter) GetByID(ctx context.Context, id string) (*Stream, error) {
	return a.repo.GetByID(ctx, id)
}

func (a *RepositoryAdapter) GetByIDForUpdate(ctx context.Context, tx TxInterface, id string) (*Stream, error) {
	concreteTx, ok := tx.(*Tx)
	if !ok {
		return nil, fmt.Errorf("invalid transaction type: expected *Tx")
	}
	return a.repo.GetByIDForUpdate(ctx, concreteTx, id)
}

func (a *RepositoryAdapter) Update(ctx context.Context, stream *Stream) error {
	return a.repo.Update(ctx, stream)
}

func (a *RepositoryAdapter) UpdateInTx(ctx context.Context, tx TxInterface, stream *Stream) error {
	concreteTx, ok := tx.(*Tx)
	if !ok {
		return fmt.Errorf("invalid transaction type: expected *Tx")
	}
	return a.repo.UpdateInTx(ctx, concreteTx, stream)
}

func (a *RepositoryAdapter) UpdateStatus(ctx context.Context, id string, status StreamStatus) error {
	return a.repo.UpdateStatus(ctx, id, status)
}

func (a *RepositoryAdapter) List(ctx context.Context, filter ListStreamsRequest) ([]*Stream, int64, error) {
	return a.repo.List(ctx, filter)
}

func (a *RepositoryAdapter) CreateUpdate(ctx context.Context, update *StreamUpdate) error {
	return a.repo.CreateUpdate(ctx, update)
}

func (a *RepositoryAdapter) CreateUpdateInTx(ctx context.Context, tx TxInterface, update *StreamUpdate) error {
	concreteTx, ok := tx.(*Tx)
	if !ok {
		return fmt.Errorf("invalid transaction type: expected *Tx")
	}
	return a.repo.CreateUpdateInTx(ctx, concreteTx, update)
}

func (a *RepositoryAdapter) GetUpdates(ctx context.Context, streamID string, limit int) ([]*StreamUpdate, error) {
	return a.repo.GetUpdates(ctx, streamID, limit)
}

func (a *RepositoryAdapter) GetLatestUpdate(ctx context.Context, streamID string) (*StreamUpdate, error) {
	return a.repo.GetLatestUpdate(ctx, streamID)
}

func (a *RepositoryAdapter) GetLatestUpdateInTx(ctx context.Context, tx TxInterface, streamID string) (*StreamUpdate, error) {
	concreteTx, ok := tx.(*Tx)
	if !ok {
		return nil, fmt.Errorf("invalid transaction type: expected *Tx")
	}
	return a.repo.GetLatestUpdateInTx(ctx, concreteTx, streamID)
}

func (a *RepositoryAdapter) GetStreamStats(ctx context.Context, streamID string) (*StreamStats, error) {
	return a.repo.GetStreamStats(ctx, streamID)
}

func (a *RepositoryAdapter) GetExpiredStreams(ctx context.Context) ([]*Stream, error) {
	return a.repo.GetExpiredStreams(ctx)
}

func (a *RepositoryAdapter) CreateEvent(ctx context.Context, event *StreamEvent) error {
	return a.repo.CreateEvent(ctx, event)
}

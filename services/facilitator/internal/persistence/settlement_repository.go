package persistence

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// SettlementRepository provides access to settlement records
type SettlementRepository struct {
	db *DB
}

// NewSettlementRepository creates a new settlement repository
func NewSettlementRepository(db *DB) *SettlementRepository {
	return &SettlementRepository{db: db}
}

// Create inserts a new settlement record
func (r *SettlementRepository) Create(ctx context.Context, s *Settlement) error {
	if s.Metadata == nil {
		s.Metadata = json.RawMessage("{}")
	}

	query := `
		INSERT INTO settlements (
			network, scheme, tx_hash, from_address, to_address,
			amount, asset, status, created_at, confirmed_at,
			error_message, gas_used, gas_price, metadata
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		) RETURNING id`

	err := r.db.QueryRowContext(ctx, query,
		s.Network,
		s.Scheme,
		nullString(s.TxHash),
		s.FromAddress,
		s.ToAddress,
		s.Amount,
		s.Asset,
		s.Status,
		s.CreatedAt,
		nullTime(s.ConfirmedAt),
		nullString(s.ErrorMessage),
		s.GasUsed,
		s.GasPrice,
		s.Metadata,
	).Scan(&s.ID)

	if err != nil {
		return fmt.Errorf("failed to create settlement: %w", err)
	}

	return nil
}

// GetByID retrieves a settlement by its ID
func (r *SettlementRepository) GetByID(ctx context.Context, id string) (*Settlement, error) {
	query := `
		SELECT id, network, scheme, tx_hash, from_address, to_address,
			   amount, asset, status, created_at, confirmed_at,
			   error_message, gas_used, gas_price, metadata
		FROM settlements
		WHERE id = $1`

	s := &Settlement{}
	var txHash, errorMessage sql.NullString
	var confirmedAt sql.NullTime
	var gasUsed, gasPrice sql.NullInt64

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&s.ID,
		&s.Network,
		&s.Scheme,
		&txHash,
		&s.FromAddress,
		&s.ToAddress,
		&s.Amount,
		&s.Asset,
		&s.Status,
		&s.CreatedAt,
		&confirmedAt,
		&errorMessage,
		&gasUsed,
		&gasPrice,
		&s.Metadata,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get settlement: %w", err)
	}

	s.TxHash = txHash.String
	s.ErrorMessage = errorMessage.String
	if confirmedAt.Valid {
		s.ConfirmedAt = &confirmedAt.Time
	}
	if gasUsed.Valid {
		val := gasUsed.Int64
		s.GasUsed = &val
	}
	if gasPrice.Valid {
		val := gasPrice.Int64
		s.GasPrice = &val
	}

	return s, nil
}

// GetByTxHash retrieves a settlement by transaction hash
func (r *SettlementRepository) GetByTxHash(ctx context.Context, network, txHash string) (*Settlement, error) {
	query := `
		SELECT id, network, scheme, tx_hash, from_address, to_address,
			   amount, asset, status, created_at, confirmed_at,
			   error_message, gas_used, gas_price, metadata
		FROM settlements
		WHERE network = $1 AND tx_hash = $2`

	s := &Settlement{}
	var txHashNull, errorMessage sql.NullString
	var confirmedAt sql.NullTime
	var gasUsed, gasPrice sql.NullInt64

	err := r.db.QueryRowContext(ctx, query, network, txHash).Scan(
		&s.ID,
		&s.Network,
		&s.Scheme,
		&txHashNull,
		&s.FromAddress,
		&s.ToAddress,
		&s.Amount,
		&s.Asset,
		&s.Status,
		&s.CreatedAt,
		&confirmedAt,
		&errorMessage,
		&gasUsed,
		&gasPrice,
		&s.Metadata,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get settlement by tx hash: %w", err)
	}

	s.TxHash = txHashNull.String
	s.ErrorMessage = errorMessage.String
	if confirmedAt.Valid {
		s.ConfirmedAt = &confirmedAt.Time
	}
	if gasUsed.Valid {
		val := gasUsed.Int64
		s.GasUsed = &val
	}
	if gasPrice.Valid {
		val := gasPrice.Int64
		s.GasPrice = &val
	}

	return s, nil
}

// ErrInvalidStateTransition is returned when an invalid state transition is attempted
var ErrInvalidStateTransition = errors.New("invalid settlement state transition")

// ErrSettlementNotFound is returned when a settlement is not found
var ErrSettlementNotFound = errors.New("settlement not found")

// validTransitions defines the allowed state transitions
// - pending can transition to confirmed or failed
// - confirmed is a terminal state (no transitions allowed)
// - failed can transition back to pending (for retry)
var validTransitions = map[SettlementStatus][]SettlementStatus{
	SettlementStatusPending:   {SettlementStatusConfirmed, SettlementStatusFailed},
	SettlementStatusConfirmed: {}, // Terminal state
	SettlementStatusFailed:    {SettlementStatusPending}, // Allow retry
}

// isValidTransition checks if the transition from currentStatus to newStatus is valid
func isValidTransition(currentStatus, newStatus SettlementStatus) bool {
	allowedStatuses, exists := validTransitions[currentStatus]
	if !exists {
		return false
	}
	for _, allowed := range allowedStatuses {
		if allowed == newStatus {
			return true
		}
	}
	return false
}

// UpdateStatus updates the status of a settlement with state machine validation
// Uses SELECT FOR UPDATE to prevent race conditions
func (r *SettlementRepository) UpdateStatus(ctx context.Context, id string, status SettlementStatus, errorMessage string) error {
	// Start a transaction for atomic read-modify-write
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Get current status with row lock
	var currentStatus SettlementStatus
	lockQuery := `SELECT status FROM settlements WHERE id = $1 FOR UPDATE`
	err = tx.QueryRowContext(ctx, lockQuery, id).Scan(&currentStatus)
	if err == sql.ErrNoRows {
		return ErrSettlementNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get settlement status: %w", err)
	}

	// Validate state transition
	if !isValidTransition(currentStatus, status) {
		return fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidStateTransition, currentStatus, status)
	}

	// Perform the update
	var updateQuery string
	var args []interface{}

	if status == SettlementStatusConfirmed {
		updateQuery = `
			UPDATE settlements
			SET status = $1, confirmed_at = $2, error_message = $3
			WHERE id = $4`
		args = []interface{}{status, time.Now().UTC(), nullString(errorMessage), id}
	} else {
		updateQuery = `
			UPDATE settlements
			SET status = $1, error_message = $2
			WHERE id = $3`
		args = []interface{}{status, nullString(errorMessage), id}
	}

	result, err := tx.ExecContext(ctx, updateQuery, args...)
	if err != nil {
		return fmt.Errorf("failed to update settlement status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrSettlementNotFound
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// UpdateTxHash updates the transaction hash of a settlement
func (r *SettlementRepository) UpdateTxHash(ctx context.Context, id, txHash string) error {
	query := `UPDATE settlements SET tx_hash = $1 WHERE id = $2`

	result, err := r.db.ExecContext(ctx, query, txHash, id)
	if err != nil {
		return fmt.Errorf("failed to update settlement tx hash: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("settlement not found: %s", id)
	}

	return nil
}

// UpdateGasInfo updates gas usage information
func (r *SettlementRepository) UpdateGasInfo(ctx context.Context, id string, gasUsed, gasPrice int64) error {
	query := `UPDATE settlements SET gas_used = $1, gas_price = $2 WHERE id = $3`

	result, err := r.db.ExecContext(ctx, query, gasUsed, gasPrice, id)
	if err != nil {
		return fmt.Errorf("failed to update settlement gas info: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("settlement not found: %s", id)
	}

	return nil
}

// List retrieves settlements based on filter criteria
func (r *SettlementRepository) List(ctx context.Context, filter SettlementFilter) ([]*Settlement, error) {
	query := `
		SELECT id, network, scheme, tx_hash, from_address, to_address,
			   amount, asset, status, created_at, confirmed_at,
			   error_message, gas_used, gas_price, metadata
		FROM settlements`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filter.Network != "" {
		conditions = append(conditions, fmt.Sprintf("network = $%d", argNum))
		args = append(args, filter.Network)
		argNum++
	}
	if filter.Scheme != "" {
		conditions = append(conditions, fmt.Sprintf("scheme = $%d", argNum))
		args = append(args, filter.Scheme)
		argNum++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argNum))
		args = append(args, filter.Status)
		argNum++
	}
	if filter.FromAddress != "" {
		conditions = append(conditions, fmt.Sprintf("from_address = $%d", argNum))
		args = append(args, filter.FromAddress)
		argNum++
	}
	if filter.ToAddress != "" {
		conditions = append(conditions, fmt.Sprintf("to_address = $%d", argNum))
		args = append(args, filter.ToAddress)
		argNum++
	}
	if filter.StartTime != nil {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argNum))
		args = append(args, filter.StartTime)
		argNum++
	}
	if filter.EndTime != nil {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argNum))
		args = append(args, filter.EndTime)
		argNum++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY created_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", filter.Limit)
	}
	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list settlements: %w", err)
	}
	defer rows.Close()

	var settlements []*Settlement
	for rows.Next() {
		s := &Settlement{}
		var txHash, errorMessage sql.NullString
		var confirmedAt sql.NullTime
		var gasUsed, gasPrice sql.NullInt64

		err := rows.Scan(
			&s.ID,
			&s.Network,
			&s.Scheme,
			&txHash,
			&s.FromAddress,
			&s.ToAddress,
			&s.Amount,
			&s.Asset,
			&s.Status,
			&s.CreatedAt,
			&confirmedAt,
			&errorMessage,
			&gasUsed,
			&gasPrice,
			&s.Metadata,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan settlement: %w", err)
		}

		s.TxHash = txHash.String
		s.ErrorMessage = errorMessage.String
		if confirmedAt.Valid {
			s.ConfirmedAt = &confirmedAt.Time
		}
		if gasUsed.Valid {
			val := gasUsed.Int64
			s.GasUsed = &val
		}
		if gasPrice.Valid {
			val := gasPrice.Int64
			s.GasPrice = &val
		}

		settlements = append(settlements, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating settlements: %w", err)
	}

	return settlements, nil
}

// CountByStatus returns the count of settlements by status
func (r *SettlementRepository) CountByStatus(ctx context.Context, network string) (map[SettlementStatus]int64, error) {
	query := `
		SELECT status, COUNT(*) as count
		FROM settlements
		WHERE ($1 = '' OR network = $1)
		GROUP BY status`

	rows, err := r.db.QueryContext(ctx, query, network)
	if err != nil {
		return nil, fmt.Errorf("failed to count settlements: %w", err)
	}
	defer rows.Close()

	counts := make(map[SettlementStatus]int64)
	for rows.Next() {
		var status SettlementStatus
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		counts[status] = count
	}

	return counts, nil
}

// helper functions

func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

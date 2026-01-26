package persistence

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// AuditRepository provides access to audit log records
type AuditRepository struct {
	db *DB
}

// NewAuditRepository creates a new audit repository
func NewAuditRepository(db *DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Log creates a new audit log entry
func (r *AuditRepository) Log(ctx context.Context, entry *AuditEntry) error {
	query := `
		INSERT INTO audit_logs (
			timestamp, action, network, request_id, ip_address,
			api_key_id, request_body, response_body, duration_ms, status_code
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		) RETURNING id`

	var requestBody, responseBody []byte
	if entry.RequestBody != nil {
		requestBody = entry.RequestBody
	}
	if entry.ResponseBody != nil {
		responseBody = entry.ResponseBody
	}

	err := r.db.QueryRowContext(ctx, query,
		entry.Timestamp,
		entry.Action,
		nullString(entry.Network),
		nullString(entry.RequestID),
		nullString(entry.IPAddress),
		nullString(entry.APIKeyID),
		nullJSON(requestBody),
		nullJSON(responseBody),
		entry.DurationMs,
		entry.StatusCode,
	).Scan(&entry.ID)

	if err != nil {
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	return nil
}

// GetByID retrieves an audit log entry by its ID
func (r *AuditRepository) GetByID(ctx context.Context, id string) (*AuditEntry, error) {
	query := `
		SELECT id, timestamp, action, network, request_id, ip_address,
			   api_key_id, request_body, response_body, duration_ms, status_code
		FROM audit_logs
		WHERE id = $1`

	entry := &AuditEntry{}
	var network, requestID, ipAddress, apiKeyID sql.NullString
	var requestBody, responseBody []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&entry.ID,
		&entry.Timestamp,
		&entry.Action,
		&network,
		&requestID,
		&ipAddress,
		&apiKeyID,
		&requestBody,
		&responseBody,
		&entry.DurationMs,
		&entry.StatusCode,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get audit log: %w", err)
	}

	entry.Network = network.String
	entry.RequestID = requestID.String
	entry.IPAddress = ipAddress.String
	entry.APIKeyID = apiKeyID.String
	if requestBody != nil {
		entry.RequestBody = json.RawMessage(requestBody)
	}
	if responseBody != nil {
		entry.ResponseBody = json.RawMessage(responseBody)
	}

	return entry, nil
}

// List retrieves audit log entries based on filter criteria
func (r *AuditRepository) List(ctx context.Context, filter AuditFilter) ([]*AuditEntry, error) {
	query := `
		SELECT id, timestamp, action, network, request_id, ip_address,
			   api_key_id, request_body, response_body, duration_ms, status_code
		FROM audit_logs`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filter.Action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", argNum))
		args = append(args, filter.Action)
		argNum++
	}
	if filter.Network != "" {
		conditions = append(conditions, fmt.Sprintf("network = $%d", argNum))
		args = append(args, filter.Network)
		argNum++
	}
	if filter.IPAddress != "" {
		conditions = append(conditions, fmt.Sprintf("ip_address = $%d", argNum))
		args = append(args, filter.IPAddress)
		argNum++
	}
	if filter.APIKeyID != "" {
		conditions = append(conditions, fmt.Sprintf("api_key_id = $%d", argNum))
		args = append(args, filter.APIKeyID)
		argNum++
	}
	if filter.StartTime != nil {
		conditions = append(conditions, fmt.Sprintf("timestamp >= $%d", argNum))
		args = append(args, filter.StartTime)
		argNum++
	}
	if filter.EndTime != nil {
		conditions = append(conditions, fmt.Sprintf("timestamp <= $%d", argNum))
		args = append(args, filter.EndTime)
		argNum++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY timestamp DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", filter.Limit)
	}
	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit logs: %w", err)
	}
	defer rows.Close()

	var entries []*AuditEntry
	for rows.Next() {
		entry := &AuditEntry{}
		var network, requestID, ipAddress, apiKeyID sql.NullString
		var requestBody, responseBody []byte

		err := rows.Scan(
			&entry.ID,
			&entry.Timestamp,
			&entry.Action,
			&network,
			&requestID,
			&ipAddress,
			&apiKeyID,
			&requestBody,
			&responseBody,
			&entry.DurationMs,
			&entry.StatusCode,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}

		entry.Network = network.String
		entry.RequestID = requestID.String
		entry.IPAddress = ipAddress.String
		entry.APIKeyID = apiKeyID.String
		if requestBody != nil {
			entry.RequestBody = json.RawMessage(requestBody)
		}
		if responseBody != nil {
			entry.ResponseBody = json.RawMessage(responseBody)
		}

		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating audit logs: %w", err)
	}

	return entries, nil
}

// CountByAction returns the count of audit logs by action type
func (r *AuditRepository) CountByAction(ctx context.Context, network string) (map[AuditAction]int64, error) {
	query := `
		SELECT action, COUNT(*) as count
		FROM audit_logs
		WHERE ($1 = '' OR network = $1)
		GROUP BY action`

	rows, err := r.db.QueryContext(ctx, query, network)
	if err != nil {
		return nil, fmt.Errorf("failed to count audit logs: %w", err)
	}
	defer rows.Close()

	counts := make(map[AuditAction]int64)
	for rows.Next() {
		var action AuditAction
		var count int64
		if err := rows.Scan(&action, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		counts[action] = count
	}

	return counts, nil
}

// GetRequestStats returns statistics for requests within a time window
func (r *AuditRepository) GetRequestStats(ctx context.Context, filter AuditFilter) (*RequestStats, error) {
	query := `
		SELECT
			COUNT(*) as total_requests,
			COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
			COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
			COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
			COALESCE(MAX(duration_ms), 0) as max_duration_ms,
			COALESCE(MIN(duration_ms), 0) as min_duration_ms
		FROM audit_logs
		WHERE ($1 = '' OR network = $1)
		  AND ($2::timestamp IS NULL OR timestamp >= $2)
		  AND ($3::timestamp IS NULL OR timestamp <= $3)`

	stats := &RequestStats{}
	err := r.db.QueryRowContext(ctx, query, filter.Network, filter.StartTime, filter.EndTime).Scan(
		&stats.TotalRequests,
		&stats.SuccessfulRequests,
		&stats.FailedRequests,
		&stats.AvgDurationMs,
		&stats.MaxDurationMs,
		&stats.MinDurationMs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get request stats: %w", err)
	}

	return stats, nil
}

// DeleteOlderThan removes audit logs older than the specified time
// Used for log rotation/cleanup
func (r *AuditRepository) DeleteOlderThan(ctx context.Context, before string) (int64, error) {
	query := `DELETE FROM audit_logs WHERE timestamp < $1`

	result, err := r.db.ExecContext(ctx, query, before)
	if err != nil {
		return 0, fmt.Errorf("failed to delete old audit logs: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rows, nil
}

// RequestStats holds aggregated request statistics
type RequestStats struct {
	TotalRequests      int64   `json:"totalRequests"`
	SuccessfulRequests int64   `json:"successfulRequests"`
	FailedRequests     int64   `json:"failedRequests"`
	AvgDurationMs      float64 `json:"avgDurationMs"`
	MaxDurationMs      int     `json:"maxDurationMs"`
	MinDurationMs      int     `json:"minDurationMs"`
}

// helper function for JSON fields
func nullJSON(data []byte) interface{} {
	if data == nil || len(data) == 0 {
		return nil
	}
	return data
}

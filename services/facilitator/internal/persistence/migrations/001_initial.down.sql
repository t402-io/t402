-- Rollback T402 Facilitator Database Schema
-- Version: 001_initial

-- Drop indexes first
DROP INDEX IF EXISTS idx_audit_logs_api_key_id;
DROP INDEX IF EXISTS idx_audit_logs_ip_address;
DROP INDEX IF EXISTS idx_audit_logs_request_id;
DROP INDEX IF EXISTS idx_audit_logs_network;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;

DROP INDEX IF EXISTS idx_settlements_to_address;
DROP INDEX IF EXISTS idx_settlements_from_address;
DROP INDEX IF EXISTS idx_settlements_tx_hash;
DROP INDEX IF EXISTS idx_settlements_created_at;
DROP INDEX IF EXISTS idx_settlements_status;
DROP INDEX IF EXISTS idx_settlements_scheme;
DROP INDEX IF EXISTS idx_settlements_network;

-- Drop tables
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS settlements;

-- Note: We don't drop the uuid-ossp extension as it may be used by other tables

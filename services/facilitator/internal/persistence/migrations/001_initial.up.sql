-- T402 Facilitator Database Schema
-- Version: 001_initial

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settlements table: records all payment settlement transactions
CREATE TABLE IF NOT EXISTS settlements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network         VARCHAR(50) NOT NULL,
    scheme          VARCHAR(30) NOT NULL,
    tx_hash         VARCHAR(100),
    from_address    VARCHAR(100) NOT NULL,
    to_address      VARCHAR(100) NOT NULL,
    amount          DECIMAL(38, 0) NOT NULL,
    asset           VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMP WITH TIME ZONE,
    error_message   TEXT,
    gas_used        BIGINT,
    gas_price       BIGINT,
    metadata        JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT settlements_status_check CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- Indexes for settlements
CREATE INDEX IF NOT EXISTS idx_settlements_network ON settlements(network);
CREATE INDEX IF NOT EXISTS idx_settlements_scheme ON settlements(scheme);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_created_at ON settlements(created_at);
CREATE INDEX IF NOT EXISTS idx_settlements_tx_hash ON settlements(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_from_address ON settlements(from_address);
CREATE INDEX IF NOT EXISTS idx_settlements_to_address ON settlements(to_address);

-- Audit logs table: records all API requests for auditing
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    action          VARCHAR(50) NOT NULL,
    network         VARCHAR(50),
    request_id      VARCHAR(100),
    ip_address      VARCHAR(50),
    api_key_id      VARCHAR(100),
    request_body    JSONB,
    response_body   JSONB,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    status_code     INTEGER NOT NULL DEFAULT 0,

    -- Constraints
    CONSTRAINT audit_logs_action_check CHECK (action IN ('verify', 'settle', 'error', 'health', 'supported'))
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_network ON audit_logs(network) WHERE network IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id) WHERE api_key_id IS NOT NULL;

-- Partition audit_logs by month for better performance (optional, for high-volume deployments)
-- This is commented out as it requires PostgreSQL 10+ and needs manual partition management
-- CREATE TABLE audit_logs_partitioned (...) PARTITION BY RANGE (timestamp);

-- Comments for documentation
COMMENT ON TABLE settlements IS 'Records of all payment settlement transactions';
COMMENT ON COLUMN settlements.id IS 'Unique identifier for the settlement';
COMMENT ON COLUMN settlements.network IS 'CAIP-2 network identifier (e.g., eip155:1)';
COMMENT ON COLUMN settlements.scheme IS 'Payment scheme (e.g., exact, exact-direct, upto)';
COMMENT ON COLUMN settlements.tx_hash IS 'Blockchain transaction hash';
COMMENT ON COLUMN settlements.from_address IS 'Sender/payer address';
COMMENT ON COLUMN settlements.to_address IS 'Recipient/payee address';
COMMENT ON COLUMN settlements.amount IS 'Payment amount in smallest unit (e.g., wei, lamports)';
COMMENT ON COLUMN settlements.asset IS 'Asset identifier (e.g., token contract address, denom)';
COMMENT ON COLUMN settlements.status IS 'Settlement status: pending, confirmed, failed';
COMMENT ON COLUMN settlements.metadata IS 'Additional metadata as JSON';

COMMENT ON TABLE audit_logs IS 'Audit log of all API requests';
COMMENT ON COLUMN audit_logs.action IS 'API action type: verify, settle, error, health, supported';
COMMENT ON COLUMN audit_logs.request_id IS 'Unique request identifier for tracing';
COMMENT ON COLUMN audit_logs.duration_ms IS 'Request processing duration in milliseconds';

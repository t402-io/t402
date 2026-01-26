-- Rollback streaming payments tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_stream_events_timestamp;
DROP INDEX IF EXISTS idx_stream_events_type;
DROP INDEX IF EXISTS idx_stream_events_stream_id;

DROP INDEX IF EXISTS idx_stream_updates_sequence;
DROP INDEX IF EXISTS idx_stream_updates_timestamp;
DROP INDEX IF EXISTS idx_stream_updates_stream_id;

DROP INDEX IF EXISTS idx_streams_active;
DROP INDEX IF EXISTS idx_streams_expires_at;
DROP INDEX IF EXISTS idx_streams_created_at;
DROP INDEX IF EXISTS idx_streams_status;
DROP INDEX IF EXISTS idx_streams_payee;
DROP INDEX IF EXISTS idx_streams_payer;
DROP INDEX IF EXISTS idx_streams_network;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS stream_events;
DROP TABLE IF EXISTS stream_updates;
DROP TABLE IF EXISTS streams;

-- Rollback intent-based routing tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_intents_expiring;
DROP INDEX IF EXISTS idx_intents_pending;
DROP INDEX IF EXISTS idx_intents_expires_at;
DROP INDEX IF EXISTS idx_intents_created_at;
DROP INDEX IF EXISTS idx_intents_priority;
DROP INDEX IF EXISTS idx_intents_status;
DROP INDEX IF EXISTS idx_intents_payee;
DROP INDEX IF EXISTS idx_intents_payer;

-- Drop table
DROP TABLE IF EXISTS intents;

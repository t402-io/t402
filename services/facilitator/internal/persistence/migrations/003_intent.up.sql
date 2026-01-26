-- Intent-based routing tables

-- Intents table
CREATE TABLE IF NOT EXISTS intents (
    id                  VARCHAR(36) PRIMARY KEY,
    payer               VARCHAR(200) NOT NULL,
    payee               VARCHAR(100) NOT NULL,
    amount              VARCHAR(78) NOT NULL,
    asset               VARCHAR(20) NOT NULL,
    source_networks     TEXT[],
    target_network      VARCHAR(50),
    max_slippage        DECIMAL(10, 8) NOT NULL DEFAULT 0.005,
    max_gas_cost        VARCHAR(78),
    priority            VARCHAR(20) NOT NULL DEFAULT 'normal',
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    selected_route      JSONB,
    available_routes    JSONB DEFAULT '[]',
    created_at          TIMESTAMP NOT NULL,
    expires_at          TIMESTAMP NOT NULL,
    executed_at         TIMESTAMP,
    tx_hashes           TEXT[],
    error_message       TEXT,
    metadata            JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT chk_intent_status CHECK (status IN ('pending', 'routed', 'executing', 'completed', 'failed', 'cancelled', 'expired')),
    CONSTRAINT chk_intent_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Indexes for intents
CREATE INDEX IF NOT EXISTS idx_intents_payer ON intents(payer);
CREATE INDEX IF NOT EXISTS idx_intents_payee ON intents(payee);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);
CREATE INDEX IF NOT EXISTS idx_intents_priority ON intents(priority);
CREATE INDEX IF NOT EXISTS idx_intents_created_at ON intents(created_at);
CREATE INDEX IF NOT EXISTS idx_intents_expires_at ON intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_intents_pending ON intents(status, priority, created_at) WHERE status IN ('pending', 'routed');
CREATE INDEX IF NOT EXISTS idx_intents_expiring ON intents(status, expires_at) WHERE status IN ('pending', 'routed');

-- Comments
COMMENT ON TABLE intents IS 'Payment intents for intent-based routing';
COMMENT ON COLUMN intents.payer IS 'Payer identifier (can be multi-chain address)';
COMMENT ON COLUMN intents.payee IS 'Payee address on target network';
COMMENT ON COLUMN intents.amount IS 'Desired payment amount';
COMMENT ON COLUMN intents.asset IS 'Asset type (e.g., USDT, USDC)';
COMMENT ON COLUMN intents.source_networks IS 'Preferred source networks (CAIP-2)';
COMMENT ON COLUMN intents.target_network IS 'Preferred target network (CAIP-2)';
COMMENT ON COLUMN intents.max_slippage IS 'Maximum allowed slippage (0-1)';
COMMENT ON COLUMN intents.max_gas_cost IS 'Maximum gas cost willing to pay';
COMMENT ON COLUMN intents.priority IS 'Execution priority (low, normal, high, urgent)';
COMMENT ON COLUMN intents.selected_route IS 'Selected execution route as JSON';
COMMENT ON COLUMN intents.available_routes IS 'All available routes as JSON array';

-- Seed data for local development (live mode testing)
CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT,
  from_address TEXT,
  to_address TEXT,
  network TEXT,
  token TEXT,
  amount TEXT,
  status TEXT DEFAULT 'settled',
  service TEXT,
  resource TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample settlements for demo address
INSERT INTO settlements (tx_hash, from_address, to_address, network, token, amount, status, service, created_at)
VALUES
  ('0xabc1', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService1', 'eip155:8453', 'USDC', '500000', 'settled', 'LLM Inference', NOW() - interval '1 hour'),
  ('0xabc2', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService2', 'eip155:42161', 'USDT0', '1200000', 'settled', 'Weather API', NOW() - interval '3 hours'),
  ('0xabc3', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService1', 'eip155:8453', 'USDC', '750000', 'settled', 'Image Gen', NOW() - interval '6 hours'),
  ('0xabc4', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService3', 'eip155:137', 'USDC', '300000', 'pending', 'Search API', NOW() - interval '12 hours'),
  ('0xabc5', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService2', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'USDC', '2000000', 'settled', 'Code Review', NOW() - interval '1 day'),
  ('0xabc6', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService4', 'ton:mainnet', 'USDT', '450000', 'settled', 'Analytics', NOW() - interval '2 days'),
  ('0xabc7', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService1', 'eip155:8453', 'USDC', '100000', 'failed', 'PDF Parse', NOW() - interval '3 days'),
  ('0xabc8', '0xFunder1', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', 'eip155:8453', 'USDC', '10000000', 'settled', 'Funding', NOW() - interval '5 days'),
  ('0xabc9', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService5', 'stellar:pubnet', 'USDC', '8500000', 'settled', 'Translate', NOW() - interval '4 days'),
  ('0xabca', '0xC88f67e776f16DcFBf42e6bDda1B82604448899B', '0xService6', 'tron:mainnet', 'USDT', '600000', 'settled', 'LLM Inference', NOW() - interval '6 days');

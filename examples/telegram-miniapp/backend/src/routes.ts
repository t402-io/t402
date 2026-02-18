import { Router } from 'express'

const router = Router()

/**
 * Premium content database (simulated).
 *
 * In production, these would come from a database.
 * The preview is free; the full body is behind the 402 paywall.
 */
const CONTENT = new Map([
  [
    '1',
    {
      id: '1',
      title: 'Market Analysis Report',
      preview: 'Weekly crypto market overview...',
      body: 'BTC maintained support at $95K this week with strong institutional inflows. ETH staking yields remain attractive at 4.2%. TON ecosystem TVL grew 15% driven by new DeFi protocols. Key events next week: FOMC minutes, ETH upgrade proposal vote.',
      author: 'Research Team',
    },
  ],
  [
    '2',
    {
      id: '2',
      title: 'Trading Strategy Guide',
      preview: 'Advanced DeFi strategies...',
      body: 'Cross-chain yield optimization using USDT0: 1) Bridge USDT0 to highest-yield chain via LayerZero OFT. 2) Deploy into audited lending protocols. 3) Monitor APY differentials across chains. 4) Rebalance when spread exceeds 0.5%. Current best yields: Arbitrum 8.2%, Base 7.8%, Optimism 7.1%.',
      author: 'DeFi Desk',
    },
  ],
  [
    '3',
    {
      id: '3',
      title: 'Research Deep Dive',
      preview: 'TON ecosystem analysis...',
      body: 'TON blockchain has emerged as a leading platform for stablecoin payments thanks to low fees (~$0.01) and fast finality (~5s). The t402 protocol leverages TON USDT Jetton transfers for micropayments. Key advantages: native Telegram integration, wallet-less onboarding via Mini Apps, and growing merchant adoption.',
      author: 'Research Lead',
    },
  ],
])

/**
 * GET /api/content/:id
 *
 * Protected by t402 middleware. Returns full content after payment
 * verification. The middleware handles 402 responses automatically.
 */
router.get('/api/content/:id', (req, res) => {
  const content = CONTENT.get(req.params.id)

  if (!content) {
    res.status(404).json({ error: 'Content not found' })
    return
  }

  res.json(content)
})

/**
 * GET /api/catalog
 *
 * Free endpoint. Returns content previews without payment.
 */
router.get('/api/catalog', (_req, res) => {
  const catalog = Array.from(CONTENT.values()).map(({ id, title, preview }) => ({
    id,
    title,
    preview,
  }))
  res.json(catalog)
})

/**
 * GET /health
 *
 * Health check endpoint.
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' })
})

export { router }

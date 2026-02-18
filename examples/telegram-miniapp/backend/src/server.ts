import express from 'express'
import cors from 'cors'
import { paymentMiddleware, t402ResourceServer } from '@t402/express'
import { ExactTonScheme } from '@t402/ton/exact/server'
import { HTTPFacilitatorClient } from '@t402/core/server'
import { PORT, FACILITATOR_URL, TON_ADDRESS, TON_NETWORK } from './config.js'
import { router } from './routes.js'

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL })

const app = express()

// Enable CORS for the Mini App frontend
app.use(cors())
app.use(express.json())

/**
 * t402 payment middleware.
 *
 * Protects content endpoints with TON USDT payment requirements.
 * Content IDs 1, 2, 3 each have different price points.
 */
app.use(
  paymentMiddleware(
    {
      'GET /api/content/1': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.01',
            network: TON_NETWORK,
            payTo: TON_ADDRESS,
          },
        ],
        description: 'Market Analysis Report',
        mimeType: 'application/json',
      },
      'GET /api/content/2': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.05',
            network: TON_NETWORK,
            payTo: TON_ADDRESS,
          },
        ],
        description: 'Trading Strategy Guide',
        mimeType: 'application/json',
      },
      'GET /api/content/3': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.001',
            network: TON_NETWORK,
            payTo: TON_ADDRESS,
          },
        ],
        description: 'Research Deep Dive',
        mimeType: 'application/json',
      },
    },
    new t402ResourceServer(facilitatorClient).register(TON_NETWORK, new ExactTonScheme()),
  ),
)

// Mount routes
app.use(router)

app.listen(PORT, () => {
  console.log(`t402 Telegram Mini App backend running on http://localhost:${PORT}`)
  console.log(`  TON Address: ${TON_ADDRESS}`)
  console.log(`  Network: ${TON_NETWORK}`)
  console.log(`  Facilitator: ${FACILITATOR_URL}`)
  console.log()
  console.log('Protected endpoints:')
  console.log(`  GET /api/content/1 - $0.01 USDT`)
  console.log(`  GET /api/content/2 - $0.05 USDT`)
  console.log(`  GET /api/content/3 - $0.001 USDT`)
  console.log()
  console.log('Free endpoints:')
  console.log('  GET /api/catalog')
  console.log('  GET /health')
})

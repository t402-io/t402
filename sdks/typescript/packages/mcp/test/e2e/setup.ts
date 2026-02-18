/**
 * E2E test setup - Mock facilitator HTTP server
 */

import http from 'node:http'

export interface MockFacilitatorOptions {
  port?: number
}

export interface MockFacilitator {
  server: http.Server
  url: string
  stop: () => Promise<void>
}

const MOCK_SUPPORTED_RESPONSE = {
  networks: [
    { network: 'eip155:8453', name: 'base', schemes: ['exact'] },
    { network: 'eip155:1', name: 'ethereum', schemes: ['exact'] },
    { network: 'eip155:42161', name: 'arbitrum', schemes: ['exact'] },
  ],
}

const MOCK_VERIFY_RESPONSE = {
  isValid: true,
  invalidReason: null,
  payer: '0x1234567890abcdef1234567890abcdef12345678',
  network: 'eip155:8453',
  scheme: 'exact',
  amount: '1000000',
}

const MOCK_SETTLE_RESPONSE = {
  success: true,
  transaction: '0x' + '0'.repeat(64),
  network: 'eip155:8453',
  payer: '0x1234567890abcdef1234567890abcdef12345678',
}

/**
 * Start a mock facilitator HTTP server for E2E testing.
 */
export async function startMockFacilitator(
  options: MockFacilitatorOptions = {},
): Promise<MockFacilitator> {
  const port = options.port ?? 0 // Use 0 for random available port

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')

      if (req.url === '/supported' && req.method === 'GET') {
        res.writeHead(200)
        res.end(JSON.stringify(MOCK_SUPPORTED_RESPONSE))
      } else if (req.url === '/verify' && req.method === 'POST') {
        res.writeHead(200)
        res.end(JSON.stringify(MOCK_VERIFY_RESPONSE))
      } else if (req.url === '/settle' && req.method === 'POST') {
        res.writeHead(200)
        res.end(JSON.stringify(MOCK_SETTLE_RESPONSE))
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const actualPort = typeof address === 'object' && address ? address.port : port
      const url = `http://127.0.0.1:${actualPort}`

      resolve({
        server,
        url,
        stop: () =>
          new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()))
          }),
      })
    })
  })
}

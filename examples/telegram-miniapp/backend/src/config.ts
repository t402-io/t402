import { config } from 'dotenv'

config()

export const PORT = Number(process.env.PORT) || 4021
export const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.t402.io'
export const TON_ADDRESS = process.env.TON_ADDRESS || ''
export const TON_NETWORK = process.env.TON_NETWORK || 'ton:mainnet'

if (!TON_ADDRESS) {
  console.error('TON_ADDRESS environment variable is required')
  process.exit(1)
}

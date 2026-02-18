/**
 * DeFi constants - protocol addresses and supported tokens
 */

/** USDT0 addresses by chain */
export const USDT0_ADDRESSES: Record<string, string> = {
  ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  ink: '0x0200C29006150606B650577BBE7B6248F58110B1',
  berachain: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
  unichain: '0x588CE4F028D8e7B53B687865d6A67b3A54C75518',
}

/** USDC addresses by chain */
export const USDC_ADDRESSES: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
}

/** Aave V3 pool addresses by chain */
export const AAVE_V3_POOL_ADDRESSES: Record<string, string> = {
  ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  base: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
  optimism: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  avalanche: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
}

/** Default max slippage (0.5%) */
export const DEFAULT_MAX_SLIPPAGE = 0.005

/** Supported swap tokens (common ERC-20 tokens) */
export const SUPPORTED_SWAP_TOKENS: Record<string, Record<string, string>> = {
  ethereum: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  arbitrum: {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  },
  base: {
    WETH: '0x4200000000000000000000000000000000000006',
  },
}

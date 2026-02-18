/**
 * Bitcoin & Lightning Network Constants
 *
 * CAIP-2 network identifiers, dust limits, and fee constants.
 */

/**
 * CAIP-2 Network Identifiers for Bitcoin
 * Uses BIP-122 chain genesis block hashes
 */
export const BTC_MAINNET = 'bip122:000000000019d6689c085ae165831e93'
export const BTC_TESTNET = 'bip122:000000000933ea01ad0ee984209779ba'

/**
 * CAIP-2 Network Identifiers for Lightning Network
 */
export const LIGHTNING_MAINNET = 'lightning:mainnet'
export const LIGHTNING_TESTNET = 'lightning:testnet'

/**
 * All supported BTC on-chain networks
 */
export const BTC_NETWORKS = [BTC_MAINNET, BTC_TESTNET] as const

/**
 * All supported Lightning networks
 */
export const LIGHTNING_NETWORKS = [LIGHTNING_MAINNET, LIGHTNING_TESTNET] as const

/**
 * All supported networks (on-chain + Lightning)
 */
export const ALL_NETWORKS = [...BTC_NETWORKS, ...LIGHTNING_NETWORKS] as const

export type BtcNetwork = (typeof BTC_NETWORKS)[number]
export type LightningNetwork = (typeof LIGHTNING_NETWORKS)[number]

/**
 * Dust limit in satoshis - minimum viable output value
 * Outputs below this threshold are rejected by Bitcoin nodes
 */
export const DUST_LIMIT = 546

/**
 * Minimum relay fee in satoshis
 * Transactions with fees below this are not relayed by default
 */
export const MIN_RELAY_FEE = 1000

/**
 * Satoshis per BTC
 */
export const SATS_PER_BTC = 100_000_000

/**
 * Scheme identifiers
 */
export const SCHEME_EXACT = 'exact'

/**
 * Default timeout for payment validity (in seconds)
 */
export const DEFAULT_VALIDITY_DURATION = 3600 // 1 hour

/**
 * Bitcoin address prefixes for basic validation
 */
export const MAINNET_ADDRESS_PREFIXES = ['bc1', '1', '3']
export const TESTNET_ADDRESS_PREFIXES = ['tb1', 'm', 'n', '2']

/**
 * Multi-chain WDK adapters for T402
 *
 * These adapters wrap Tether WDK wallet accounts to implement
 * T402's existing signer interfaces for each chain.
 */

export { WDKTonSignerAdapter, createWDKTonSigner } from './ton-adapter.js'
export { WDKSvmSignerAdapter, createWDKSvmSigner } from './svm-adapter.js'
export { WDKTronSignerAdapter, createWDKTronSigner } from './tron-adapter.js'

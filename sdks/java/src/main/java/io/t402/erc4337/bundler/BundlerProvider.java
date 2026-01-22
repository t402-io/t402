package io.t402.erc4337.bundler;

/**
 * Supported bundler providers for ERC-4337.
 */
public enum BundlerProvider {
    /** Pimlico bundler service. */
    PIMLICO,

    /** Alchemy bundler service. */
    ALCHEMY,

    /** Custom/self-hosted bundler. */
    CUSTOM
}

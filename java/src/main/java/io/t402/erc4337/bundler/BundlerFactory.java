package io.t402.erc4337.bundler;

import io.t402.erc4337.BundlerClient;

/**
 * Factory for creating bundler clients.
 *
 * <p>Provides a unified way to create bundler clients for different providers.
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * // Create Pimlico bundler
 * BundlerClient pimlico = BundlerFactory.create(BundlerProvider.PIMLICO)
 *     .apiKey("your-pimlico-api-key")
 *     .chainId(8453)
 *     .build();
 *
 * // Create Alchemy bundler
 * BundlerClient alchemy = BundlerFactory.create(BundlerProvider.ALCHEMY)
 *     .apiKey("your-alchemy-api-key")
 *     .chainId(8453)
 *     .policyId("gas-manager-policy")
 *     .build();
 *
 * // Create custom bundler
 * BundlerClient custom = BundlerFactory.create(BundlerProvider.CUSTOM)
 *     .bundlerUrl("https://your-bundler.example.com")
 *     .build();
 * }</pre>
 */
public class BundlerFactory {

    private BundlerFactory() {
        // Static factory
    }

    /**
     * Creates a builder for the specified provider.
     *
     * @param provider The bundler provider
     * @return A builder for the specified provider
     */
    public static BundlerBuilder create(BundlerProvider provider) {
        return new BundlerBuilder(provider);
    }

    /**
     * Creates a Pimlico bundler builder.
     */
    public static BundlerBuilder pimlico() {
        return new BundlerBuilder(BundlerProvider.PIMLICO);
    }

    /**
     * Creates an Alchemy bundler builder.
     */
    public static BundlerBuilder alchemy() {
        return new BundlerBuilder(BundlerProvider.ALCHEMY);
    }

    /**
     * Creates a custom bundler builder.
     */
    public static BundlerBuilder custom() {
        return new BundlerBuilder(BundlerProvider.CUSTOM);
    }

    /**
     * Builder for creating bundler clients.
     */
    public static class BundlerBuilder {
        private final BundlerProvider provider;
        private String apiKey;
        private long chainId = 1;
        private String entryPoint = BundlerClient.ENTRYPOINT_V07_ADDRESS;
        private String bundlerUrl;
        private String paymasterUrl;
        private String policyId;

        BundlerBuilder(BundlerProvider provider) {
            this.provider = provider;
        }

        /**
         * Sets the API key for the bundler service.
         */
        public BundlerBuilder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        /**
         * Sets the chain ID.
         */
        public BundlerBuilder chainId(long chainId) {
            this.chainId = chainId;
            return this;
        }

        /**
         * Sets the EntryPoint contract address.
         */
        public BundlerBuilder entryPoint(String entryPoint) {
            this.entryPoint = entryPoint;
            return this;
        }

        /**
         * Sets the bundler URL (for custom bundlers or URL override).
         */
        public BundlerBuilder bundlerUrl(String url) {
            this.bundlerUrl = url;
            return this;
        }

        /**
         * Sets the paymaster URL (for Pimlico).
         */
        public BundlerBuilder paymasterUrl(String url) {
            this.paymasterUrl = url;
            return this;
        }

        /**
         * Sets the policy ID (for Alchemy Gas Manager or Pimlico sponsorship).
         */
        public BundlerBuilder policyId(String policyId) {
            this.policyId = policyId;
            return this;
        }

        /**
         * Builds the bundler client.
         *
         * @return A configured bundler client
         * @throws IllegalArgumentException if required parameters are missing
         */
        public BundlerClient build() {
            switch (provider) {
                case PIMLICO:
                    return buildPimlico();
                case ALCHEMY:
                    return buildAlchemy();
                case CUSTOM:
                    return buildCustom();
                default:
                    throw new IllegalArgumentException("Unknown provider: " + provider);
            }
        }

        /**
         * Builds a Pimlico bundler specifically (for Pimlico-specific methods).
         */
        public PimlicoBundler buildPimlico() {
            PimlicoBundler.Builder builder = PimlicoBundler.builder()
                .chainId(chainId)
                .entryPoint(entryPoint);

            if (apiKey != null) {
                builder.apiKey(apiKey);
            }
            if (bundlerUrl != null) {
                builder.bundlerUrl(bundlerUrl);
            }
            if (paymasterUrl != null) {
                builder.paymasterUrl(paymasterUrl);
            }

            return builder.build();
        }

        /**
         * Builds an Alchemy bundler specifically (for Alchemy-specific methods).
         */
        public AlchemyBundler buildAlchemy() {
            AlchemyBundler.Builder builder = AlchemyBundler.builder()
                .chainId(chainId)
                .entryPoint(entryPoint);

            if (apiKey != null) {
                builder.apiKey(apiKey);
            }
            if (bundlerUrl != null) {
                builder.bundlerUrl(bundlerUrl);
            }
            if (policyId != null) {
                builder.policyId(policyId);
            }

            return builder.build();
        }

        private BundlerClient buildCustom() {
            if (bundlerUrl == null) {
                throw new IllegalArgumentException("bundlerUrl is required for custom bundler");
            }
            return new BundlerClient(bundlerUrl, entryPoint);
        }
    }
}

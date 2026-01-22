package io.t402.erc4337.bundler;

import io.t402.erc4337.BundlerClient;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for BundlerFactory.
 */
class BundlerFactoryTest {

    @Test
    void createPimlicoBundler() {
        PimlicoBundler bundler = BundlerFactory.pimlico()
            .apiKey("test-api-key")
            .chainId(8453)
            .buildPimlico();

        assertNotNull(bundler);
    }

    @Test
    void createAlchemyBundler() {
        AlchemyBundler bundler = BundlerFactory.alchemy()
            .apiKey("test-api-key")
            .chainId(8453)
            .policyId("test-policy")
            .buildAlchemy();

        assertNotNull(bundler);
    }

    @Test
    void createCustomBundler() {
        BundlerClient bundler = BundlerFactory.custom()
            .bundlerUrl("https://bundler.example.com")
            .entryPoint("0x0000000071727De22E5E9d8BAf0edAc6f37da032")
            .build();

        assertNotNull(bundler);
    }

    @Test
    void createByProvider() {
        BundlerClient bundler = BundlerFactory.create(BundlerProvider.CUSTOM)
            .bundlerUrl("https://bundler.example.com")
            .build();

        assertNotNull(bundler);
    }

    @Test
    void customBundlerRequiresUrl() {
        assertThrows(IllegalArgumentException.class, () ->
            BundlerFactory.custom().build()
        );
    }

    @Test
    void pimlicoBundlerRequiresApiKeyOrUrl() {
        assertThrows(IllegalArgumentException.class, () ->
            BundlerFactory.pimlico()
                .chainId(8453)
                .build()
        );
    }

    @Test
    void pimlicoBundlerWithCustomUrl() {
        BundlerClient bundler = BundlerFactory.pimlico()
            .bundlerUrl("https://custom-pimlico.example.com")
            .chainId(8453)
            .build();

        assertNotNull(bundler);
    }

    @Test
    void alchemyBundlerRequiresApiKeyOrUrl() {
        assertThrows(IllegalArgumentException.class, () ->
            BundlerFactory.alchemy()
                .chainId(8453)
                .build()
        );
    }

    @Test
    void providerEnum() {
        assertEquals(BundlerProvider.PIMLICO, BundlerProvider.valueOf("PIMLICO"));
        assertEquals(BundlerProvider.ALCHEMY, BundlerProvider.valueOf("ALCHEMY"));
        assertEquals(BundlerProvider.CUSTOM, BundlerProvider.valueOf("CUSTOM"));
    }
}

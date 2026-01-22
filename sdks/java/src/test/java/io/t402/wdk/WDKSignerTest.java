package io.t402.wdk;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import io.t402.wdk.WDKTypes.*;

import java.util.Map;
import java.util.Set;

/**
 * Tests for WDKSigner.
 */
class WDKSignerTest {

    // Valid test seed phrase (12 words)
    private static final String TEST_SEED_PHRASE =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    @Test
    void generateSeedPhraseDefault() {
        String seedPhrase = WDKSigner.generateSeedPhrase();

        assertNotNull(seedPhrase);
        String[] words = seedPhrase.split(" ");
        assertEquals(12, words.length);
        assertTrue(WDKSigner.validateSeedPhrase(seedPhrase));
    }

    @Test
    void generateSeedPhraseWithWordCount() {
        String seed12 = WDKSigner.generateSeedPhrase(12);
        String seed24 = WDKSigner.generateSeedPhrase(24);

        assertEquals(12, seed12.split(" ").length);
        assertEquals(24, seed24.split(" ").length);
        assertTrue(WDKSigner.validateSeedPhrase(seed12));
        assertTrue(WDKSigner.validateSeedPhrase(seed24));
    }

    @Test
    void generateSeedPhraseRejectsInvalidWordCount() {
        assertThrows(IllegalArgumentException.class, () ->
            WDKSigner.generateSeedPhrase(10)
        );
        assertThrows(IllegalArgumentException.class, () ->
            WDKSigner.generateSeedPhrase(13)
        );
    }

    @Test
    void validateSeedPhraseWithValid() {
        assertTrue(WDKSigner.validateSeedPhrase(TEST_SEED_PHRASE));
    }

    @Test
    void validateSeedPhraseWithInvalid() {
        assertFalse(WDKSigner.validateSeedPhrase("invalid seed phrase"));
        assertFalse(WDKSigner.validateSeedPhrase(""));
        assertFalse(WDKSigner.validateSeedPhrase(null));
    }

    @Test
    void constructorWithValidSeedPhrase() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));
        WDKSigner signer = new WDKSigner(TEST_SEED_PHRASE, config);

        assertNotNull(signer.getAddress());
        assertTrue(signer.getAddress().startsWith("0x"));
        assertEquals(42, signer.getAddress().length());
    }

    @Test
    void constructorRejectsNullSeedPhrase() {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));

        assertThrows(WDKException.class, () ->
            new WDKSigner(null, config)
        );
    }

    @Test
    void constructorRejectsEmptySeedPhrase() {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));

        assertThrows(WDKException.class, () ->
            new WDKSigner("", config)
        );
    }

    @Test
    void constructorRejectsInvalidSeedPhrase() {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));

        assertThrows(WDKException.class, () ->
            new WDKSigner("invalid seed phrase words that are not valid", config)
        );
    }

    @Test
    void getNetworkReturnsCorrectFormat() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));
        WDKSigner signer = new WDKSigner(TEST_SEED_PHRASE, config);

        assertEquals("eip155:42161", signer.getNetwork("arbitrum"));
        assertEquals("eip155:1", signer.getNetwork("ethereum"));
        assertEquals("eip155:8453", signer.getNetwork("base"));
    }

    @Test
    void getSupportedChains() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));
        WDKSigner signer = new WDKSigner(TEST_SEED_PHRASE, config);

        Set<String> chains = signer.getSupportedChains();

        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
    }

    @Test
    void getUsdt0Chains() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));
        WDKSigner signer = new WDKSigner(TEST_SEED_PHRASE, config);

        Set<String> chains = signer.getUsdt0Chains();

        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
    }

    @Test
    void addressIsDeterministic() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));
        WDKSigner signer1 = new WDKSigner(TEST_SEED_PHRASE, config);
        WDKSigner signer2 = new WDKSigner(TEST_SEED_PHRASE, config);

        assertEquals(signer1.getAddress(), signer2.getAddress());
    }

    @Test
    void differentSeedPhrasesDifferentAddresses() throws WDKException {
        WDKConfig config = new WDKConfig(Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"));

        WDKSigner signer1 = new WDKSigner(TEST_SEED_PHRASE, config);
        WDKSigner signer2 = new WDKSigner(WDKSigner.generateSeedPhrase(), config);

        assertNotEquals(signer1.getAddress(), signer2.getAddress());
    }
}

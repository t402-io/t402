package io.t402.schemes.svm;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for SolanaJ-based signer implementations.
 */
@DisplayName("SolanaJ Signer Implementations")
class SolanajSignerTest {

    // Test keypair (64 bytes: 32 seed + 32 public key)
    private static final byte[] TEST_KEYPAIR = new byte[64];
    static {
        for (int i = 0; i < 64; i++) {
            TEST_KEYPAIR[i] = (byte) (i + 1);
        }
    }

    // JSON format as used by Solana CLI
    private static String createJsonKeypair() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 64; i++) {
            if (i > 0) sb.append(",");
            sb.append(i + 1);
        }
        sb.append("]");
        return sb.toString();
    }

    @Nested
    @DisplayName("SolanajClientSigner")
    class ClientSignerTest {

        @Test
        @DisplayName("should create signer from raw bytes")
        void testFromBytes() {
            SolanajClientSigner signer = new SolanajClientSigner(TEST_KEYPAIR);

            assertNotNull(signer.getAddress());
            assertFalse(signer.getAddress().isEmpty());
            assertEquals(32, signer.getPublicKeyBytes().length);
        }

        @Test
        @DisplayName("should create signer from 32-byte seed")
        void testFrom32ByteSeed() {
            byte[] seed = new byte[32];
            for (int i = 0; i < 32; i++) {
                seed[i] = (byte) (i + 1);
            }

            SolanajClientSigner signer = new SolanajClientSigner(seed);
            assertNotNull(signer.getAddress());
        }

        @Test
        @DisplayName("should create signer from JSON array")
        void testFromJson() {
            String json = createJsonKeypair();
            SolanajClientSigner signer = SolanajClientSigner.fromJson(json);

            assertNotNull(signer.getAddress());

            // Should produce same address as raw bytes
            SolanajClientSigner byteSigner = new SolanajClientSigner(TEST_KEYPAIR);
            assertEquals(byteSigner.getAddress(), signer.getAddress());
        }

        @Test
        @DisplayName("should reject null key")
        void testRejectNull() {
            assertThrows(IllegalArgumentException.class, () ->
                new SolanajClientSigner(null));
        }

        @Test
        @DisplayName("should reject invalid key length")
        void testRejectInvalidLength() {
            assertThrows(IllegalArgumentException.class, () ->
                new SolanajClientSigner(new byte[48]));
        }

        @Test
        @DisplayName("should reject invalid JSON format")
        void testRejectInvalidJson() {
            assertThrows(IllegalArgumentException.class, () ->
                SolanajClientSigner.fromJson("not json"));
        }
    }

    @Nested
    @DisplayName("SolanajFacilitatorSigner.Builder")
    class FacilitatorSignerBuilderTest {

        @Test
        @DisplayName("should build with single keypair")
        void testBuildWithKeypair() {
            SolanajFacilitatorSigner signer = new SolanajFacilitatorSigner.Builder()
                .addKeypair(TEST_KEYPAIR)
                .useDefaultRpcEndpoints()
                .build();

            List<String> addresses = signer.getAddresses();
            assertEquals(1, addresses.size());
            assertFalse(addresses.get(0).isEmpty());
        }

        @Test
        @DisplayName("should build with multiple keypairs")
        void testBuildWithMultipleKeypairs() {
            byte[] keypair1 = new byte[64];
            byte[] keypair2 = new byte[64];
            for (int i = 0; i < 64; i++) {
                keypair1[i] = (byte) (i + 1);
                keypair2[i] = (byte) (i + 100);
            }

            SolanajFacilitatorSigner signer = new SolanajFacilitatorSigner.Builder()
                .addKeypair(keypair1)
                .addKeypair(keypair2)
                .useDefaultRpcEndpoints()
                .build();

            List<String> addresses = signer.getAddresses();
            assertEquals(2, addresses.size());
            assertNotEquals(addresses.get(0), addresses.get(1));
        }

        @Test
        @DisplayName("should build with JSON keypair")
        void testBuildWithJsonKeypair() {
            SolanajFacilitatorSigner signer = new SolanajFacilitatorSigner.Builder()
                .addKeypairFromJson(createJsonKeypair())
                .useDefaultRpcEndpoints()
                .build();

            List<String> addresses = signer.getAddresses();
            assertEquals(1, addresses.size());
        }

        @Test
        @DisplayName("should build with custom RPC URLs")
        void testBuildWithCustomRpc() {
            SolanajFacilitatorSigner signer = new SolanajFacilitatorSigner.Builder()
                .addKeypair(TEST_KEYPAIR)
                .mainnetRpcUrl("https://custom-mainnet.example.com")
                .devnetRpcUrl("https://custom-devnet.example.com")
                .build();

            assertNotNull(signer);
        }

        @Test
        @DisplayName("should require at least one keypair")
        void testRequireKeypair() {
            assertThrows(IllegalStateException.class, () ->
                new SolanajFacilitatorSigner.Builder()
                    .useDefaultRpcEndpoints()
                    .build());
        }

        @Test
        @DisplayName("should require RPC endpoints")
        void testRequireRpc() {
            assertThrows(IllegalStateException.class, () ->
                new SolanajFacilitatorSigner.Builder()
                    .addKeypair(TEST_KEYPAIR)
                    .build());
        }

        @Test
        @DisplayName("should reject null keypair")
        void testRejectNullKeypair() {
            assertThrows(IllegalArgumentException.class, () ->
                new SolanajFacilitatorSigner.Builder()
                    .addKeypair(null));
        }
    }

    @Nested
    @DisplayName("Address Consistency")
    class AddressConsistencyTest {

        @Test
        @DisplayName("same keypair should produce same address")
        void testSameKeypairSameAddress() {
            SolanajClientSigner client1 = new SolanajClientSigner(TEST_KEYPAIR);
            SolanajClientSigner client2 = new SolanajClientSigner(TEST_KEYPAIR);

            assertEquals(client1.getAddress(), client2.getAddress());
        }

        @Test
        @DisplayName("client and facilitator signers with same key should have same address")
        void testClientFacilitatorConsistency() {
            SolanajClientSigner client = new SolanajClientSigner(TEST_KEYPAIR);
            SolanajFacilitatorSigner facilitator = new SolanajFacilitatorSigner.Builder()
                .addKeypair(TEST_KEYPAIR)
                .useDefaultRpcEndpoints()
                .build();

            assertEquals(client.getAddress(), facilitator.getAddresses().get(0));
        }

        @Test
        @DisplayName("addresses should be valid Base58")
        void testValidBase58Address() {
            SolanajClientSigner signer = new SolanajClientSigner(TEST_KEYPAIR);
            String address = signer.getAddress();

            // Base58 doesn't contain 0, O, I, l
            assertFalse(address.contains("0"));
            assertFalse(address.contains("O"));
            assertFalse(address.contains("I"));
            assertFalse(address.contains("l"));

            // Solana addresses are typically 32-44 characters
            assertTrue(address.length() >= 32 && address.length() <= 44);
        }
    }
}

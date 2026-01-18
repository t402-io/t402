package io.t402.schemes.svm;

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters;
import org.bouncycastle.crypto.signers.Ed25519Signer;
import org.p2p.solanaj.core.PublicKey;
import org.p2p.solanaj.rpc.RpcClient;
import org.p2p.solanaj.rpc.RpcException;
import org.p2p.solanaj.rpc.types.SignatureStatuses;
import org.p2p.solanaj.rpc.types.config.RpcSendTransactionConfig;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Reference implementation of FacilitatorSvmSigner using SolanaJ for RPC.
 * <p>
 * This implementation provides full Solana RPC integration for:
 * <ul>
 *   <li>Transaction signing as fee payer (using BouncyCastle Ed25519)</li>
 *   <li>Transaction simulation</li>
 *   <li>Transaction submission and confirmation</li>
 * </ul>
 * </p>
 *
 * <h2>Dependencies</h2>
 * Requires the optional SolanaJ dependency for RPC:
 * <pre>{@code
 * <dependency>
 *     <groupId>com.mmorrell</groupId>
 *     <artifactId>solanaj</artifactId>
 *     <version>1.27.3</version>
 * </dependency>
 * }</pre>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * // Create keypairs for fee payers (64-byte Ed25519 keypairs)
 * byte[] keypair1 = loadKeypairFromFile("fee-payer-1.json");
 * byte[] keypair2 = loadKeypairFromFile("fee-payer-2.json");
 *
 * // Initialize the signer
 * SolanajFacilitatorSigner signer = new SolanajFacilitatorSigner.Builder()
 *     .addKeypair(keypair1)
 *     .addKeypair(keypair2)
 *     .mainnetRpcUrl("https://api.mainnet-beta.solana.com")
 *     .devnetRpcUrl("https://api.devnet.solana.com")
 *     .build();
 *
 * // Use with ExactSvmFacilitatorScheme
 * ExactSvmFacilitatorScheme scheme = new ExactSvmFacilitatorScheme(signer);
 * }</pre>
 *
 * @see FacilitatorSvmSigner
 * @see org.p2p.solanaj.rpc.RpcClient
 */
public class SolanajFacilitatorSigner implements FacilitatorSvmSigner {

    private static final int SIGNATURE_LENGTH = 64;
    private static final int PUBLIC_KEY_LENGTH = 32;
    private static final int DEFAULT_CONFIRMATION_TIMEOUT_MS = 30000;
    private static final int CONFIRMATION_POLL_INTERVAL_MS = 500;

    private final Map<String, KeypairData> keypairs;
    private final List<String> addresses;
    private final Map<String, RpcClient> rpcClients;
    private final Executor executor;

    private SolanajFacilitatorSigner(Builder builder) {
        this.keypairs = new HashMap<>(builder.keypairs);
        this.addresses = new ArrayList<>(builder.addresses);
        this.rpcClients = new HashMap<>(builder.rpcClients);
        this.executor = builder.executor != null ? builder.executor : Executors.newCachedThreadPool();
    }

    @Override
    public List<String> getAddresses() {
        return new ArrayList<>(addresses);
    }

    @Override
    public CompletableFuture<String> signTransaction(String txBase64, String feePayer, String network) {
        return CompletableFuture.supplyAsync(() -> {
            KeypairData keypairData = keypairs.get(feePayer);
            if (keypairData == null) {
                throw new IllegalArgumentException("No keypair found for fee payer: " + feePayer);
            }

            try {
                byte[] txBytes = Base64.getDecoder().decode(txBase64);
                byte[] signedTx = addFeePayerSignature(txBytes, keypairData, feePayer);
                return Base64.getEncoder().encodeToString(signedTx);
            } catch (Exception e) {
                throw new SvmTransactionException("Failed to sign transaction: " + e.getMessage(), e);
            }
        }, executor);
    }

    @Override
    public CompletableFuture<Boolean> simulateTransaction(String txBase64, String network) {
        return CompletableFuture.supplyAsync(() -> {
            RpcClient client = getRpcClient(network);

            try {
                // SolanaJ's simulateTransaction API takes PublicKey list
                var result = client.getApi().simulateTransaction(
                    txBase64,
                    List.of() // Empty list of accounts to return
                );

                // Check simulation result - if we get here without exception, it succeeded
                // SimulatedTransaction has logs but error checking is done via exception
                return result != null;
            } catch (RpcException e) {
                // RPC exception means simulation failed
                throw new SvmTransactionException(
                    "Transaction simulation failed: " + e.getMessage(), e);
            }
        }, executor);
    }

    @Override
    public CompletableFuture<String> sendTransaction(String txBase64, String network) {
        return CompletableFuture.supplyAsync(() -> {
            RpcClient client = getRpcClient(network);

            try {
                // Use sendRawTransaction with default config
                RpcSendTransactionConfig config = new RpcSendTransactionConfig();
                String signature = client.getApi().sendRawTransaction(txBase64, config);
                return signature;
            } catch (RpcException e) {
                throw new SvmTransactionException("Failed to send transaction: " + e.getMessage(), e);
            }
        }, executor);
    }

    @Override
    public CompletableFuture<Boolean> confirmTransaction(String signature, String network) {
        return CompletableFuture.supplyAsync(() -> {
            RpcClient client = getRpcClient(network);

            long startTime = System.currentTimeMillis();
            while (System.currentTimeMillis() - startTime < DEFAULT_CONFIRMATION_TIMEOUT_MS) {
                try {
                    SignatureStatuses statuses = client.getApi().getSignatureStatuses(
                        List.of(signature),
                        true // searchTransactionHistory
                    );

                    if (statuses != null && statuses.getValue() != null
                            && !statuses.getValue().isEmpty()) {
                        var status = statuses.getValue().get(0);
                        if (status != null) {
                            // Check confirmation status
                            String confirmationStatus = status.getConfirmationStatus();
                            if ("confirmed".equals(confirmationStatus)
                                    || "finalized".equals(confirmationStatus)) {
                                return true;
                            }
                            // If status exists but no confirmation yet, keep polling
                        }
                    }

                    Thread.sleep(CONFIRMATION_POLL_INTERVAL_MS);
                } catch (RpcException e) {
                    throw new SvmTransactionException(
                        "RPC error while confirming transaction: " + e.getMessage(), e);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new SvmTransactionException("Confirmation interrupted", e);
                }
            }

            throw new SvmTransactionException(
                "Transaction confirmation timed out after " + DEFAULT_CONFIRMATION_TIMEOUT_MS + "ms");
        }, executor);
    }

    /**
     * Adds fee payer signature to a partially signed transaction.
     * <p>
     * Solana transaction format:
     * <ul>
     *   <li>CompactU16: number of signatures</li>
     *   <li>Signatures: [64 bytes each]</li>
     *   <li>Message: [header, accounts, blockhash, instructions]</li>
     * </ul>
     */
    private byte[] addFeePayerSignature(byte[] txBytes, KeypairData keypair, String feePayerAddress) {
        // Parse signature count (compact-u16)
        int offset = 0;
        int sigCount = readCompactU16(txBytes, offset);
        offset += compactU16Size(sigCount);

        // Skip existing signatures
        int signaturesStart = offset;
        offset += sigCount * SIGNATURE_LENGTH;

        // The message starts after signatures
        int messageStart = offset;
        byte[] message = Arrays.copyOfRange(txBytes, messageStart, txBytes.length);

        // Verify fee payer is first account in message
        // Message format: [header (3 bytes), account count, accounts...]
        int msgOffset = 3; // Skip header
        int accountCount = readCompactU16(message, msgOffset);
        msgOffset += compactU16Size(accountCount);

        // First account should be fee payer
        byte[] firstAccount = Arrays.copyOfRange(message, msgOffset, msgOffset + PUBLIC_KEY_LENGTH);
        String firstAccountAddr = SvmUtils.base58Encode(firstAccount);

        if (!feePayerAddress.equals(firstAccountAddr)) {
            throw new SvmTransactionException(
                "Fee payer mismatch: expected " + feePayerAddress + ", got " + firstAccountAddr);
        }

        // Sign the message
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(true, keypair.privateKey);
        signer.update(message, 0, message.length);
        byte[] signature = signer.generateSignature();

        // Build new transaction with fee payer signature in first slot
        ByteBuffer result = ByteBuffer.allocate(txBytes.length);
        result.order(ByteOrder.LITTLE_ENDIAN);

        // Copy signature count
        result.put(txBytes, 0, signaturesStart);

        // Put fee payer signature first
        result.put(signature);

        // Copy remaining signatures (skip first slot if it was empty/placeholder)
        if (sigCount > 0) {
            byte[] firstSig = Arrays.copyOfRange(txBytes, signaturesStart, signaturesStart + SIGNATURE_LENGTH);
            if (isEmptySignature(firstSig)) {
                // First signature was placeholder, copy rest
                if (sigCount > 1) {
                    result.put(txBytes, signaturesStart + SIGNATURE_LENGTH,
                        (sigCount - 1) * SIGNATURE_LENGTH);
                }
            } else {
                // First signature was real, this is an additional signature scenario
                // Put back the original first signature after ours
                result.put(txBytes, signaturesStart, sigCount * SIGNATURE_LENGTH);
            }
        }

        // Copy message
        result.put(message);

        return Arrays.copyOf(result.array(), result.position());
    }

    private boolean isEmptySignature(byte[] sig) {
        for (byte b : sig) {
            if (b != 0) {
                return false;
            }
        }
        return true;
    }

    private int readCompactU16(byte[] data, int offset) {
        int val = data[offset] & 0xFF;
        if (val < 0x80) {
            return val;
        }
        val = (val & 0x7F) | ((data[offset + 1] & 0xFF) << 7);
        if (val < 0x4000) {
            return val;
        }
        return (val & 0x3FFF) | ((data[offset + 2] & 0xFF) << 14);
    }

    private int compactU16Size(int value) {
        if (value < 0x80) {
            return 1;
        }
        if (value < 0x4000) {
            return 2;
        }
        return 3;
    }

    private RpcClient getRpcClient(String network) {
        String normalizedNetwork = SvmConstants.normalizeNetwork(network);
        RpcClient client = rpcClients.get(normalizedNetwork);

        if (client == null) {
            throw new IllegalArgumentException("No RPC client configured for network: " + network);
        }

        return client;
    }

    /**
     * Internal class to hold keypair data.
     */
    private static class KeypairData {
        final Ed25519PrivateKeyParameters privateKey;
        final Ed25519PublicKeyParameters publicKey;
        final String address;

        KeypairData(byte[] secretKey) {
            byte[] seed;
            if (secretKey.length == 64) {
                // Full keypair: first 32 bytes are seed
                seed = Arrays.copyOfRange(secretKey, 0, 32);
            } else if (secretKey.length == 32) {
                seed = secretKey;
            } else {
                throw new IllegalArgumentException(
                    "Invalid key length: expected 32 or 64, got " + secretKey.length);
            }

            this.privateKey = new Ed25519PrivateKeyParameters(seed, 0);
            this.publicKey = privateKey.generatePublicKey();
            this.address = SvmUtils.base58Encode(publicKey.getEncoded());
        }
    }

    /**
     * Builder for SolanajFacilitatorSigner.
     */
    public static class Builder {
        private final Map<String, KeypairData> keypairs = new HashMap<>();
        private final List<String> addresses = new ArrayList<>();
        private final Map<String, RpcClient> rpcClients = new HashMap<>();
        private Executor executor;

        /**
         * Adds a keypair for signing transactions.
         * <p>
         * The keypair can be either a 32-byte seed or a 64-byte full keypair
         * (32 bytes seed + 32 bytes public key, as used by Solana CLI).
         *
         * @param secretKey Secret key bytes (32 or 64 bytes)
         * @return This builder
         */
        public Builder addKeypair(byte[] secretKey) {
            if (secretKey == null) {
                throw new IllegalArgumentException("Secret key cannot be null");
            }

            KeypairData keypairData = new KeypairData(secretKey);
            keypairs.put(keypairData.address, keypairData);
            addresses.add(keypairData.address);

            return this;
        }

        /**
         * Adds a keypair from a Base58-encoded secret key.
         *
         * @param base58SecretKey Base58-encoded secret key
         * @return This builder
         */
        public Builder addKeypairBase58(String base58SecretKey) {
            byte[] secretKey = SvmUtils.base58Decode(base58SecretKey);
            return addKeypair(secretKey);
        }

        /**
         * Adds a keypair from a JSON array (Solana CLI format).
         * <p>
         * Solana CLI stores keypairs as JSON arrays of 64 integers.
         *
         * @param jsonArray JSON array string like "[1,2,3,...64 numbers]"
         * @return This builder
         */
        public Builder addKeypairFromJson(String jsonArray) {
            String trimmed = jsonArray.trim();
            if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
                throw new IllegalArgumentException("Invalid JSON array format");
            }

            String inner = trimmed.substring(1, trimmed.length() - 1);
            String[] parts = inner.split(",");
            byte[] secretKey = new byte[parts.length];

            for (int i = 0; i < parts.length; i++) {
                secretKey[i] = (byte) Integer.parseInt(parts[i].trim());
            }

            return addKeypair(secretKey);
        }

        /**
         * Sets the RPC URL for mainnet.
         *
         * @param rpcUrl RPC endpoint URL
         * @return This builder
         */
        public Builder mainnetRpcUrl(String rpcUrl) {
            rpcClients.put(SvmConstants.SOLANA_MAINNET, new RpcClient(rpcUrl));
            return this;
        }

        /**
         * Sets the RPC URL for devnet.
         *
         * @param rpcUrl RPC endpoint URL
         * @return This builder
         */
        public Builder devnetRpcUrl(String rpcUrl) {
            rpcClients.put(SvmConstants.SOLANA_DEVNET, new RpcClient(rpcUrl));
            return this;
        }

        /**
         * Sets the RPC URL for testnet.
         *
         * @param rpcUrl RPC endpoint URL
         * @return This builder
         */
        public Builder testnetRpcUrl(String rpcUrl) {
            rpcClients.put(SvmConstants.SOLANA_TESTNET, new RpcClient(rpcUrl));
            return this;
        }

        /**
         * Sets a custom RPC URL for a specific network.
         *
         * @param network CAIP-2 network identifier
         * @param rpcUrl RPC endpoint URL
         * @return This builder
         */
        public Builder rpcUrl(String network, String rpcUrl) {
            String normalizedNetwork = SvmConstants.normalizeNetwork(network);
            rpcClients.put(normalizedNetwork, new RpcClient(rpcUrl));
            return this;
        }

        /**
         * Uses default Solana public RPC endpoints.
         * <p>
         * Note: Public endpoints have rate limits. For production use,
         * configure dedicated RPC endpoints (Helius, QuickNode, etc.).
         *
         * @return This builder
         */
        public Builder useDefaultRpcEndpoints() {
            rpcClients.put(SvmConstants.SOLANA_MAINNET,
                new RpcClient(SvmConstants.MAINNET_RPC_URL));
            rpcClients.put(SvmConstants.SOLANA_DEVNET,
                new RpcClient(SvmConstants.DEVNET_RPC_URL));
            rpcClients.put(SvmConstants.SOLANA_TESTNET,
                new RpcClient(SvmConstants.TESTNET_RPC_URL));
            return this;
        }

        /**
         * Sets a custom executor for async operations.
         *
         * @param executor Executor for CompletableFuture operations
         * @return This builder
         */
        public Builder executor(Executor executor) {
            this.executor = executor;
            return this;
        }

        /**
         * Builds the SolanajFacilitatorSigner.
         *
         * @return Configured SolanajFacilitatorSigner instance
         * @throws IllegalStateException if no keypairs or RPC clients are configured
         */
        public SolanajFacilitatorSigner build() {
            if (keypairs.isEmpty()) {
                throw new IllegalStateException("At least one keypair must be configured");
            }

            if (rpcClients.isEmpty()) {
                throw new IllegalStateException(
                    "At least one RPC endpoint must be configured. "
                    + "Use useDefaultRpcEndpoints() or configure custom endpoints.");
            }

            return new SolanajFacilitatorSigner(this);
        }
    }
}

package io.t402.crypto;

import org.web3j.crypto.Credentials;
import org.web3j.crypto.Sign;
import org.web3j.crypto.StructuredDataEncoder;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * EVM implementation of CryptoSigner using Web3j.
 *
 * <p>Signs EIP-3009 TransferWithAuthorization payloads using EIP-712 typed data signing.
 * This is compatible with USDC, USDT and other tokens that implement EIP-3009.</p>
 *
 * <p>Example usage:</p>
 * <pre>{@code
 * Credentials credentials = Credentials.create(privateKey);
 * EvmSigner signer = new EvmSigner(credentials, 8453, "USD Coin", "2", usdcAddress);
 *
 * Map<String, Object> payload = new HashMap<>();
 * payload.put("from", signer.getAddress());
 * payload.put("to", recipientAddress);
 * payload.put("value", "1000000"); // 1 USDC
 * payload.put("validAfter", "0");
 * payload.put("validBefore", String.valueOf(System.currentTimeMillis() / 1000 + 3600));
 * payload.put("nonce", "0x" + generateNonce());
 *
 * String signature = signer.sign(payload);
 * }</pre>
 */
public class EvmSigner implements CryptoSigner {

    private final Credentials credentials;
    private final long chainId;
    private final String tokenName;
    private final String tokenVersion;
    private final String tokenAddress;

    /**
     * Creates a new EvmSigner.
     *
     * @param credentials   Web3j credentials containing the private key
     * @param chainId       The chain ID (e.g., 1 for Ethereum, 8453 for Base)
     * @param tokenName     Token name for EIP-712 domain (e.g., "USD Coin")
     * @param tokenVersion  Token version for EIP-712 domain (e.g., "2")
     * @param tokenAddress  Token contract address (with 0x prefix)
     */
    public EvmSigner(Credentials credentials, long chainId, String tokenName,
                     String tokenVersion, String tokenAddress) {
        this.credentials = credentials;
        this.chainId = chainId;
        this.tokenName = tokenName;
        this.tokenVersion = tokenVersion;
        this.tokenAddress = tokenAddress;
    }

    /**
     * Returns the signer's Ethereum address.
     *
     * @return The address derived from the private key
     */
    public String getAddress() {
        return credentials.getAddress();
    }

    /**
     * Signs an EIP-3009 TransferWithAuthorization payload.
     *
     * <p>Expected payload keys:</p>
     * <ul>
     *   <li>{@code from} - sender address (must match signer)</li>
     *   <li>{@code to} - recipient address</li>
     *   <li>{@code value} - amount in atomic units (string)</li>
     *   <li>{@code validAfter} - Unix timestamp (string)</li>
     *   <li>{@code validBefore} - Unix timestamp (string)</li>
     *   <li>{@code nonce} - 32-byte hex string with 0x prefix</li>
     * </ul>
     *
     * @param payload The authorization fields to sign
     * @return 0x-prefixed hex signature (65 bytes: r || s || v)
     * @throws IllegalArgumentException if payload is missing required fields
     * @throws CryptoSignException      if signing fails
     */
    @Override
    public String sign(Map<String, Object> payload) throws CryptoSignException {
        try {
            String from = getRequiredString(payload, "from");
            String to = getRequiredString(payload, "to");
            String value = getRequiredString(payload, "value");
            String validAfter = getRequiredString(payload, "validAfter");
            String validBefore = getRequiredString(payload, "validBefore");
            String nonce = getRequiredString(payload, "nonce");

            // Build EIP-712 structured data
            String jsonData = buildEip712Json(from, to, value, validAfter, validBefore, nonce);

            StructuredDataEncoder encoder = new StructuredDataEncoder(jsonData);
            byte[] hash = encoder.hashStructuredData();

            Sign.SignatureData signatureData = Sign.signMessage(hash, credentials.getEcKeyPair(), false);

            // Convert to 0x-prefixed hex: r (32 bytes) + s (32 bytes) + v (1 byte)
            return toHexSignature(signatureData);

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new CryptoSignException("Failed to sign EIP-712 message", e);
        }
    }

    private String getRequiredString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
        return value.toString();
    }

    private String buildEip712Json(String from, String to, String value,
                                   String validAfter, String validBefore, String nonce) {
        // EIP-712 typed data structure for TransferWithAuthorization
        Map<String, Object> data = new HashMap<>();

        // Types
        Map<String, Object> types = new HashMap<>();

        List<Map<String, String>> eip712Domain = new ArrayList<>();
        eip712Domain.add(Map.of("name", "name", "type", "string"));
        eip712Domain.add(Map.of("name", "version", "type", "string"));
        eip712Domain.add(Map.of("name", "chainId", "type", "uint256"));
        eip712Domain.add(Map.of("name", "verifyingContract", "type", "address"));
        types.put("EIP712Domain", eip712Domain);

        List<Map<String, String>> transferAuth = new ArrayList<>();
        transferAuth.add(Map.of("name", "from", "type", "address"));
        transferAuth.add(Map.of("name", "to", "type", "address"));
        transferAuth.add(Map.of("name", "value", "type", "uint256"));
        transferAuth.add(Map.of("name", "validAfter", "type", "uint256"));
        transferAuth.add(Map.of("name", "validBefore", "type", "uint256"));
        transferAuth.add(Map.of("name", "nonce", "type", "bytes32"));
        types.put("TransferWithAuthorization", transferAuth);

        data.put("types", types);

        // Domain
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", tokenName);
        domain.put("version", tokenVersion);
        domain.put("chainId", chainId);
        domain.put("verifyingContract", tokenAddress);
        data.put("domain", domain);

        // Primary type
        data.put("primaryType", "TransferWithAuthorization");

        // Message
        Map<String, Object> message = new HashMap<>();
        message.put("from", from);
        message.put("to", to);
        message.put("value", new BigInteger(value));
        message.put("validAfter", new BigInteger(validAfter));
        message.put("validBefore", new BigInteger(validBefore));
        message.put("nonce", nonce);
        data.put("message", message);

        try {
            return io.t402.util.Json.MAPPER.writeValueAsString(data);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize EIP-712 data", e);
        }
    }

    private String toHexSignature(Sign.SignatureData signatureData) {
        byte[] r = signatureData.getR();
        byte[] s = signatureData.getS();
        byte[] v = signatureData.getV();

        StringBuilder sb = new StringBuilder("0x");
        for (byte b : r) {
            sb.append(String.format("%02x", b));
        }
        for (byte b : s) {
            sb.append(String.format("%02x", b));
        }
        // v should be 27 or 28
        sb.append(String.format("%02x", v[0]));

        return sb.toString();
    }

    /**
     * Creates an EvmSigner from a private key hex string.
     *
     * @param privateKeyHex The private key (with or without 0x prefix)
     * @param chainId       The chain ID
     * @param tokenName     Token name for EIP-712 domain
     * @param tokenVersion  Token version for EIP-712 domain
     * @param tokenAddress  Token contract address
     * @return A new EvmSigner instance
     */
    public static EvmSigner fromPrivateKey(String privateKeyHex, long chainId,
                                           String tokenName, String tokenVersion,
                                           String tokenAddress) {
        String key = privateKeyHex.startsWith("0x") ? privateKeyHex.substring(2) : privateKeyHex;
        Credentials credentials = Credentials.create(key);
        return new EvmSigner(credentials, chainId, tokenName, tokenVersion, tokenAddress);
    }
}

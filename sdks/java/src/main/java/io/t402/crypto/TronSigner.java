package io.t402.crypto;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Map;

import org.bouncycastle.asn1.x9.X9ECParameters;
import org.bouncycastle.crypto.digests.KeccakDigest;
import org.bouncycastle.crypto.digests.SHA256Digest;
import org.bouncycastle.crypto.ec.CustomNamedCurves;
import org.bouncycastle.crypto.params.ECDomainParameters;
import org.bouncycastle.crypto.params.ECPrivateKeyParameters;
import org.bouncycastle.crypto.signers.ECDSASigner;
import org.bouncycastle.crypto.signers.HMacDSAKCalculator;
import org.bouncycastle.math.ec.ECPoint;
import org.bouncycastle.math.ec.FixedPointCombMultiplier;

/**
 * TRON signer implementation.
 *
 * <p>This signer handles payment authorization for TRON networks
 * using ECDSA secp256k1 signatures with Base58Check encoding.
 *
 * <p>Supported networks:
 * <ul>
 *   <li>tron:mainnet (TRON Mainnet)</li>
 *   <li>tron:nile (TRON Nile Testnet)</li>
 *   <li>tron:shasta (TRON Shasta Testnet)</li>
 * </ul>
 */
public class TronSigner implements CryptoSigner {

    /** TRON Mainnet network identifier. */
    public static final String MAINNET = "tron:mainnet";

    /** TRON Nile Testnet network identifier. */
    public static final String NILE = "tron:nile";

    /** TRON Shasta Testnet network identifier. */
    public static final String SHASTA = "tron:shasta";

    private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final byte TRON_ADDRESS_PREFIX = 0x41;

    // secp256k1 curve parameters
    private static final X9ECParameters CURVE_PARAMS = CustomNamedCurves.getByName("secp256k1");
    private static final ECDomainParameters CURVE = new ECDomainParameters(
        CURVE_PARAMS.getCurve(),
        CURVE_PARAMS.getG(),
        CURVE_PARAMS.getN(),
        CURVE_PARAMS.getH()
    );

    private final byte[] privateKey;
    private final String network;
    private final String address;

    /**
     * Creates a new TRON signer.
     *
     * @param privateKey 32-byte secp256k1 private key
     * @param network Network identifier (e.g., "tron:mainnet")
     */
    public TronSigner(byte[] privateKey, String network) {
        if (privateKey == null || privateKey.length != 32) {
            throw new IllegalArgumentException("Private key must be 32 bytes");
        }
        if (network == null || network.isEmpty()) {
            throw new IllegalArgumentException("Network must not be null or empty");
        }
        if (!isValidNetwork(network)) {
            throw new IllegalArgumentException("Invalid TRON network: " + network);
        }

        this.privateKey = privateKey.clone();
        this.network = network;
        this.address = deriveAddress(privateKey);
    }

    /**
     * Creates a TRON signer from a hex-encoded private key.
     *
     * @param hexPrivateKey Hex-encoded 32-byte private key
     * @param network Network identifier
     * @return New signer instance
     */
    public static TronSigner fromHex(String hexPrivateKey, String network) {
        byte[] decoded = hexDecode(hexPrivateKey);
        return new TronSigner(decoded, network);
    }

    /**
     * Returns the TRON address (Base58Check-encoded).
     *
     * @return TRON address starting with 'T'
     */
    public String getAddress() {
        return address;
    }

    /**
     * Returns the network identifier.
     *
     * @return Network identifier
     */
    public String getNetwork() {
        return network;
    }

    @Override
    public String sign(Map<String, Object> payload) throws CryptoSignException {
        try {
            // Extract required fields
            String from = getRequiredString(payload, "from");
            String to = getRequiredString(payload, "to");
            String amount = getRequiredString(payload, "amount");
            String nonce = getRequiredString(payload, "nonce");
            String token = getOptionalString(payload, "token", "USDT");
            String validAfter = getOptionalString(payload, "validAfter", "0");
            String validBefore = getOptionalString(payload, "validBefore",
                String.valueOf(System.currentTimeMillis() / 1000 + 3600));

            // Build canonical message for signing
            String message = buildCanonicalMessage(
                from, to, amount, nonce, token, validAfter, validBefore);

            // Hash the message using Keccak-256 (TRON uses Ethereum-style hashing)
            byte[] messageHash = keccak256(message.getBytes(StandardCharsets.UTF_8));

            // Sign using ECDSA secp256k1
            byte[] signature = ecdsaSign(messageHash);

            // Return hex-encoded signature with 0x prefix
            return "0x" + hexEncode(signature);

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new CryptoSignException("Failed to sign TRON payment", e);
        }
    }

    /**
     * Builds the canonical message for signing.
     */
    private String buildCanonicalMessage(
            String from,
            String to,
            String amount,
            String nonce,
            String token,
            String validAfter,
            String validBefore) {
        return String.format(
            "T402:TRON:EXACT:%s:%s:%s:%s:%s:%s:%s:%s",
            network,
            from,
            to,
            amount,
            token,
            nonce,
            validAfter,
            validBefore
        );
    }

    /**
     * Computes Keccak-256 hash.
     *
     * <p>Uses BouncyCastle KeccakDigest for proper Keccak-256 hashing.
     */
    private byte[] keccak256(byte[] input) {
        KeccakDigest digest = new KeccakDigest(256);
        digest.update(input, 0, input.length);
        byte[] hash = new byte[32];
        digest.doFinal(hash, 0);
        return hash;
    }

    /**
     * Signs a message using ECDSA secp256k1 with RFC 6979 deterministic k.
     *
     * <p>Uses BouncyCastle ECDSASigner with HMacDSAKCalculator for deterministic signing.
     * Returns a 65-byte signature in the format [r (32 bytes), s (32 bytes), v (1 byte)].
     */
    private byte[] ecdsaSign(byte[] messageHash) {
        BigInteger privateKeyInt = new BigInteger(1, privateKey);
        ECPrivateKeyParameters privKeyParams = new ECPrivateKeyParameters(privateKeyInt, CURVE);

        // Use RFC 6979 deterministic k calculator for reproducible signatures
        ECDSASigner signer = new ECDSASigner(new HMacDSAKCalculator(new SHA256Digest()));
        signer.init(true, privKeyParams);
        BigInteger[] components = signer.generateSignature(messageHash);

        BigInteger r = components[0];
        BigInteger s = components[1];

        // Ensure s is in the lower half of the curve order (EIP-2)
        BigInteger halfCurveOrder = CURVE.getN().shiftRight(1);
        if (s.compareTo(halfCurveOrder) > 0) {
            s = CURVE.getN().subtract(s);
        }

        // Build 65-byte signature: r (32) + s (32) + v (1)
        byte[] signature = new byte[65];

        byte[] rBytes = r.toByteArray();
        byte[] sBytes = s.toByteArray();

        // Copy r (handle leading zero for positive BigInteger)
        int rStart = rBytes.length > 32 ? rBytes.length - 32 : 0;
        int rLen = Math.min(rBytes.length, 32);
        System.arraycopy(rBytes, rStart, signature, 32 - rLen, rLen);

        // Copy s (handle leading zero for positive BigInteger)
        int sStart = sBytes.length > 32 ? sBytes.length - 32 : 0;
        int sLen = Math.min(sBytes.length, 32);
        System.arraycopy(sBytes, sStart, signature, 64 - sLen, sLen);

        // Calculate recovery id (v)
        // For TRON, v is typically 27 or 28
        int recId = calculateRecoveryId(messageHash, r, s, privateKeyInt);
        signature[64] = (byte) (27 + recId);

        return signature;
    }

    /**
     * Calculates the recovery ID for ECDSA signature.
     */
    private int calculateRecoveryId(byte[] messageHash, BigInteger r, BigInteger s, BigInteger privateKey) {
        // Derive public key from private key
        ECPoint publicKeyPoint = new FixedPointCombMultiplier().multiply(CURVE.getG(), privateKey);
        byte[] publicKeyBytes = publicKeyPoint.getEncoded(false);

        // Try both recovery IDs (0 and 1)
        for (int recId = 0; recId < 2; recId++) {
            ECPoint recovered = recoverPublicKey(messageHash, r, s, recId);
            if (recovered != null) {
                byte[] recoveredBytes = recovered.getEncoded(false);
                if (Arrays.equals(publicKeyBytes, recoveredBytes)) {
                    return recId;
                }
            }
        }

        // Default to 0 if recovery ID not found
        return 0;
    }

    /**
     * Recovers public key from signature components.
     */
    private ECPoint recoverPublicKey(byte[] messageHash, BigInteger r, BigInteger s, int recId) {
        BigInteger n = CURVE.getN();
        BigInteger i = BigInteger.valueOf((long) recId / 2);
        BigInteger x = r.add(i.multiply(n));

        // Check x is within curve field
        BigInteger prime = CURVE_PARAMS.getCurve().getField().getCharacteristic();
        if (x.compareTo(prime) >= 0) {
            return null;
        }

        // Decompress point
        ECPoint R = decompressPoint(x, (recId & 1) == 1);
        if (R == null || !R.multiply(n).isInfinity()) {
            return null;
        }

        BigInteger e = new BigInteger(1, messageHash);
        BigInteger eInv = BigInteger.ZERO.subtract(e).mod(n);
        BigInteger rInv = r.modInverse(n);
        BigInteger srInv = rInv.multiply(s).mod(n);
        BigInteger eInvrInv = rInv.multiply(eInv).mod(n);

        ECPoint q = CURVE.getG().multiply(eInvrInv).add(R.multiply(srInv));
        return q;
    }

    /**
     * Decompresses a point on the curve.
     */
    private ECPoint decompressPoint(BigInteger x, boolean yBit) {
        try {
            byte[] compressedKey = new byte[33];
            compressedKey[0] = (byte) (yBit ? 0x03 : 0x02);
            byte[] xBytes = x.toByteArray();
            int xStart = xBytes.length > 32 ? xBytes.length - 32 : 0;
            int xLen = Math.min(xBytes.length, 32);
            System.arraycopy(xBytes, xStart, compressedKey, 33 - xLen, xLen);
            return CURVE_PARAMS.getCurve().decodePoint(compressedKey);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Derives TRON address from private key.
     *
     * <p>Uses proper EC point multiplication to derive the public key,
     * then Keccak-256 hash to derive the address.
     */
    private String deriveAddress(byte[] privateKey) {
        // Convert private key to BigInteger
        BigInteger privateKeyInt = new BigInteger(1, privateKey);

        // Derive public key point using EC multiplication
        ECPoint publicKeyPoint = new FixedPointCombMultiplier().multiply(CURVE.getG(), privateKeyInt);

        // Get uncompressed public key bytes (65 bytes: 0x04 + x + y)
        byte[] publicKeyBytes = publicKeyPoint.getEncoded(false);

        // Take the x and y coordinates (skip the 0x04 prefix)
        byte[] publicKeyXY = new byte[64];
        System.arraycopy(publicKeyBytes, 1, publicKeyXY, 0, 64);

        // Keccak-256 hash of the public key (x || y)
        byte[] hash = keccak256(publicKeyXY);

        // Take last 20 bytes and prepend TRON address prefix (0x41)
        byte[] addressBytes = new byte[21];
        addressBytes[0] = TRON_ADDRESS_PREFIX;
        System.arraycopy(hash, hash.length - 20, addressBytes, 1, 20);

        return base58CheckEncode(addressBytes);
    }

    /**
     * Extracts a required string field from the payload.
     */
    private String getRequiredString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
        return value.toString();
    }

    /**
     * Extracts an optional string field with a default value.
     */
    private String getOptionalString(Map<String, Object> payload, String key, String defaultValue) {
        Object value = payload.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * Checks if a network identifier is valid for TRON.
     */
    public static boolean isValidNetwork(String network) {
        return MAINNET.equals(network) || NILE.equals(network) || SHASTA.equals(network);
    }

    /**
     * Validates a TRON address.
     *
     * @param address Address to validate (should start with 'T')
     * @return true if valid TRON address
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }

        // TRON addresses start with 'T' and are 34 characters
        if (!address.startsWith("T") || address.length() != 34) {
            return false;
        }

        try {
            byte[] decoded = base58CheckDecode(address);
            return decoded.length == 21 && decoded[0] == TRON_ADDRESS_PREFIX;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Encodes bytes using Base58Check (with checksum).
     */
    private static String base58CheckEncode(byte[] input) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] hash1 = sha256.digest(input);
            byte[] hash2 = sha256.digest(hash1);

            byte[] addressWithChecksum = new byte[input.length + 4];
            System.arraycopy(input, 0, addressWithChecksum, 0, input.length);
            System.arraycopy(hash2, 0, addressWithChecksum, input.length, 4);

            return base58Encode(addressWithChecksum);
        } catch (Exception e) {
            throw new RuntimeException("Base58Check encoding failed", e);
        }
    }

    /**
     * Decodes Base58Check encoded string.
     */
    private static byte[] base58CheckDecode(String input) throws Exception {
        byte[] decoded = base58Decode(input);
        if (decoded.length < 4) {
            throw new IllegalArgumentException("Invalid Base58Check string");
        }

        // Verify checksum
        byte[] data = new byte[decoded.length - 4];
        System.arraycopy(decoded, 0, data, 0, data.length);

        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        byte[] hash1 = sha256.digest(data);
        byte[] hash2 = sha256.digest(hash1);

        for (int i = 0; i < 4; i++) {
            if (decoded[decoded.length - 4 + i] != hash2[i]) {
                throw new IllegalArgumentException("Invalid checksum");
            }
        }

        return data;
    }

    /**
     * Encodes bytes to Base58 string.
     */
    private static String base58Encode(byte[] input) {
        if (input.length == 0) {
            return "";
        }

        int zeros = 0;
        while (zeros < input.length && input[zeros] == 0) {
            zeros++;
        }

        byte[] temp = new byte[input.length * 2];
        int j = temp.length;

        int startAt = zeros;
        while (startAt < input.length) {
            int mod = divmod(input, startAt, 256, 58);
            if (input[startAt] == 0) {
                startAt++;
            }
            temp[--j] = (byte) BASE58_ALPHABET.charAt(mod);
        }

        while (j < temp.length && temp[j] == BASE58_ALPHABET.charAt(0)) {
            j++;
        }

        while (--zeros >= 0) {
            temp[--j] = (byte) BASE58_ALPHABET.charAt(0);
        }

        return new String(temp, j, temp.length - j, StandardCharsets.US_ASCII);
    }

    /**
     * Decodes Base58 string to bytes.
     */
    private static byte[] base58Decode(String input) {
        if (input.isEmpty()) {
            return new byte[0];
        }

        byte[] input58 = new byte[input.length()];
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            int digit = BASE58_ALPHABET.indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid Base58 character: " + c);
            }
            input58[i] = (byte) digit;
        }

        int zeros = 0;
        while (zeros < input58.length && input58[zeros] == 0) {
            zeros++;
        }

        byte[] temp = new byte[input.length()];
        int j = temp.length;

        int startAt = zeros;
        while (startAt < input58.length) {
            int mod = divmod(input58, startAt, 58, 256);
            if (input58[startAt] == 0) {
                startAt++;
            }
            temp[--j] = (byte) mod;
        }

        while (j < temp.length && temp[j] == 0) {
            j++;
        }

        // Copy leading zeros and decoded bytes into result
        byte[] result = new byte[zeros + (temp.length - j)];
        // Fill leading zeros
        for (int i = 0; i < zeros; i++) {
            result[i] = 0;
        }
        // Copy decoded bytes
        System.arraycopy(temp, j, result, zeros, temp.length - j);
        return result;
    }

    private static int divmod(byte[] number, int firstDigit, int base, int divisor) {
        int remainder = 0;
        for (int i = firstDigit; i < number.length; i++) {
            int digit = (int) number[i] & 0xFF;
            int temp = remainder * base + digit;
            number[i] = (byte) (temp / divisor);
            remainder = temp % divisor;
        }
        return remainder;
    }

    private static String hexEncode(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xFF));
        }
        return sb.toString();
    }

    private static byte[] hexDecode(String hex) {
        String cleanHex = hex.startsWith("0x") ? hex.substring(2) : hex;
        int len = cleanHex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(cleanHex.charAt(i), 16) << 4)
                                + Character.digit(cleanHex.charAt(i + 1), 16));
        }
        return data;
    }
}

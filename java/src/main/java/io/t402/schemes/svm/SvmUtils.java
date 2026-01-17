package io.t402.schemes.svm;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Utility functions for Solana SVM operations.
 */
public final class SvmUtils {

    private SvmUtils() {}

    /** Base58 alphabet used by Solana. */
    private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    /** Pattern for validating Solana addresses (base58, 32-44 characters). */
    private static final Pattern SVM_ADDRESS_PATTERN = Pattern.compile("^[1-9A-HJ-NP-Za-km-z]{32,44}$");

    /** Minimum transaction size in bytes. */
    private static final int MIN_TRANSACTION_SIZE = 100;

    /**
     * Validates a Solana address.
     * <p>
     * Solana addresses are base58 encoded, 32-44 characters.
     *
     * @param address the address to validate
     * @return true if valid, false otherwise
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return SVM_ADDRESS_PATTERN.matcher(address).matches();
    }

    /**
     * Compares two Solana addresses for equality.
     * <p>
     * Solana addresses are case-sensitive (base58).
     *
     * @param addr1 first address
     * @param addr2 second address
     * @return true if addresses are equal
     */
    public static boolean addressesEqual(String addr1, String addr2) {
        if (addr1 == null || addr2 == null) {
            return false;
        }
        return addr1.equals(addr2);
    }

    /**
     * Parses a decimal string amount to token smallest units.
     *
     * @param amount decimal string (e.g., "1.50")
     * @param decimals token decimals
     * @return amount in smallest units
     * @throws IllegalArgumentException if amount format is invalid
     */
    public static BigInteger parseAmount(String amount, int decimals) {
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("Amount cannot be null or empty");
        }

        amount = amount.trim();

        try {
            BigDecimal decimal = new BigDecimal(amount);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            return decimal.multiply(multiplier).setScale(0, RoundingMode.DOWN).toBigInteger();
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid amount format: " + amount, e);
        }
    }

    /**
     * Formats an amount in smallest units to a decimal string.
     *
     * @param amount amount in smallest units
     * @param decimals token decimals
     * @return decimal string representation
     */
    public static String formatAmount(BigInteger amount, int decimals) {
        if (amount.equals(BigInteger.ZERO)) {
            return "0";
        }

        BigDecimal decimal = new BigDecimal(amount);
        BigDecimal divisor = BigDecimal.TEN.pow(decimals);
        BigDecimal result = decimal.divide(divisor, decimals, RoundingMode.DOWN);

        // Remove trailing zeros
        String str = result.stripTrailingZeros().toPlainString();
        return str;
    }

    /**
     * Formats an amount in smallest units to a decimal string.
     *
     * @param amount amount in smallest units
     * @param decimals token decimals
     * @return decimal string representation
     */
    public static String formatAmount(long amount, int decimals) {
        return formatAmount(BigInteger.valueOf(amount), decimals);
    }

    /**
     * Validates that a string is a valid base64-encoded Solana transaction.
     *
     * @param txBase64 base64 encoded transaction string
     * @return true if valid, false otherwise
     */
    public static boolean isValidTransaction(String txBase64) {
        if (txBase64 == null || txBase64.isEmpty()) {
            return false;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(txBase64);
            return decoded.length >= MIN_TRANSACTION_SIZE;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Decodes a base64 encoded transaction.
     *
     * @param txBase64 base64 encoded transaction string
     * @return transaction bytes
     * @throws IllegalArgumentException if transaction cannot be decoded
     */
    public static byte[] decodeTransaction(String txBase64) {
        if (txBase64 == null || txBase64.isEmpty()) {
            throw new IllegalArgumentException("Transaction cannot be null or empty");
        }

        try {
            return Base64.getDecoder().decode(txBase64);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Failed to decode transaction: " + e.getMessage(), e);
        }
    }

    /**
     * Encodes transaction bytes to base64.
     *
     * @param txBytes transaction bytes
     * @return base64 encoded transaction string
     */
    public static String encodeTransaction(byte[] txBytes) {
        return Base64.getEncoder().encodeToString(txBytes);
    }

    /**
     * Encodes bytes to Base58 string.
     *
     * @param input bytes to encode
     * @return base58 encoded string
     */
    public static String base58Encode(byte[] input) {
        if (input.length == 0) {
            return "";
        }

        // Count leading zeros
        int leadingZeros = 0;
        while (leadingZeros < input.length && input[leadingZeros] == 0) {
            leadingZeros++;
        }

        // Make a copy to work with (divmod modifies the array)
        byte[] inputCopy = input.clone();

        // Allocate enough space for the encoded output
        StringBuilder encoded = new StringBuilder();

        int start = leadingZeros;
        while (start < inputCopy.length) {
            int remainder = 0;
            int newStart = inputCopy.length;

            for (int i = start; i < inputCopy.length; i++) {
                int digit = (inputCopy[i] & 0xFF);
                int temp = remainder * 256 + digit;
                inputCopy[i] = (byte) (temp / 58);
                remainder = temp % 58;
                if (inputCopy[i] != 0 && newStart == inputCopy.length) {
                    newStart = i;
                }
            }
            start = newStart;
            encoded.insert(0, BASE58_ALPHABET.charAt(remainder));
        }

        // Add leading '1's for each leading zero byte
        for (int i = 0; i < leadingZeros; i++) {
            encoded.insert(0, '1');
        }

        return encoded.toString();
    }

    /**
     * Decodes Base58 string to bytes.
     *
     * @param input base58 encoded string
     * @return decoded bytes
     * @throws IllegalArgumentException if input contains invalid characters
     */
    public static byte[] base58Decode(String input) {
        if (input.isEmpty()) {
            return new byte[0];
        }

        // Count leading '1's (zeros in decoded form)
        int leadingZeros = 0;
        while (leadingZeros < input.length() && input.charAt(leadingZeros) == '1') {
            leadingZeros++;
        }

        // Convert base58 digits to base256
        byte[] output = new byte[input.length()];
        int outputStart = output.length;

        for (int i = leadingZeros; i < input.length(); i++) {
            char c = input.charAt(i);
            int digit = BASE58_ALPHABET.indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid Base58 character: " + c);
            }

            int carry = digit;
            for (int j = output.length - 1; j >= 0; j--) {
                carry += 58 * (output[j] & 0xFF);
                output[j] = (byte) (carry % 256);
                carry /= 256;
                if (output[j] != 0 && j < outputStart) {
                    outputStart = j;
                }
            }
        }

        // Skip leading zeros in output
        while (outputStart < output.length && output[outputStart] == 0) {
            outputStart++;
        }

        // Build final result with leading zeros
        byte[] result = new byte[leadingZeros + (output.length - outputStart)];
        // First leadingZeros bytes are 0 (already initialized)
        System.arraycopy(output, outputStart, result, leadingZeros, output.length - outputStart);

        return result;
    }

    /**
     * Checks if the given data represents a valid SVM payload.
     *
     * @param data map containing payload data
     * @return true if the data is a valid SVM payload structure
     */
    public static boolean isValidSvmPayload(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        Object tx = data.get("transaction");
        if (!(tx instanceof String) || !isValidTransaction((String) tx)) {
            return false;
        }

        return true;
    }

    /**
     * Gets the current Unix timestamp in seconds.
     *
     * @return current Unix timestamp
     */
    public static long getCurrentTimestamp() {
        return System.currentTimeMillis() / 1000;
    }

    /**
     * Calculates a validity timestamp from now.
     *
     * @param durationSeconds duration in seconds
     * @return Unix timestamp for validity
     */
    public static long calculateValidUntil(int durationSeconds) {
        return getCurrentTimestamp() + durationSeconds;
    }
}

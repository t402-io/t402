package io.t402.wdk;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Map;

/**
 * Types for T402 WDK integration.
 */
public final class WDKTypes {

    private WDKTypes() {
        // Utility class
    }

    /**
     * WDK configuration.
     */
    public static class WDKConfig {
        private final Map<String, String> rpcUrls;
        private final int accountIndex;
        private final long timeoutMs;

        public WDKConfig(Map<String, String> rpcUrls) {
            this(rpcUrls, 0, 30000);
        }

        public WDKConfig(Map<String, String> rpcUrls, int accountIndex, long timeoutMs) {
            this.rpcUrls = rpcUrls;
            this.accountIndex = accountIndex;
            this.timeoutMs = timeoutMs;
        }

        public Map<String, String> getRpcUrls() {
            return rpcUrls;
        }

        public int getAccountIndex() {
            return accountIndex;
        }

        public long getTimeoutMs() {
            return timeoutMs;
        }
    }

    /**
     * Token balance information.
     */
    public static class TokenBalance {
        private final String symbol;
        private final BigInteger balance;
        private final int decimals;

        public TokenBalance(String symbol, BigInteger balance, int decimals) {
            this.symbol = symbol;
            this.balance = balance;
            this.decimals = decimals;
        }

        public String getSymbol() {
            return symbol;
        }

        public BigInteger getBalance() {
            return balance;
        }

        public int getDecimals() {
            return decimals;
        }

        /**
         * Get formatted balance as decimal string.
         */
        public String getFormatted() {
            return formatAmount(balance, decimals);
        }

        /**
         * Get balance as BigDecimal.
         */
        public BigDecimal getDecimalValue() {
            return new BigDecimal(balance).divide(
                BigDecimal.TEN.pow(decimals),
                decimals,
                java.math.RoundingMode.DOWN
            );
        }
    }

    /**
     * Chain balance with native and token balances.
     */
    public static class ChainBalance {
        private final String chain;
        private final BigInteger nativeBalance;
        private final Map<String, TokenBalance> tokenBalances;

        public ChainBalance(String chain, BigInteger nativeBalance, Map<String, TokenBalance> tokenBalances) {
            this.chain = chain;
            this.nativeBalance = nativeBalance;
            this.tokenBalances = tokenBalances;
        }

        public String getChain() {
            return chain;
        }

        public BigInteger getNativeBalance() {
            return nativeBalance;
        }

        public Map<String, TokenBalance> getTokenBalances() {
            return tokenBalances;
        }

        /**
         * Get native balance formatted (18 decimals).
         */
        public String getNativeFormatted() {
            return formatAmount(nativeBalance, 18);
        }
    }

    /**
     * Payment parameters.
     */
    public static class PaymentParams {
        private final String to;
        private final BigInteger amount;
        private final String token;
        private final String validAfter;
        private final String validBefore;
        private final String nonce;

        public PaymentParams(String to, BigInteger amount, String token, String nonce) {
            this(to, amount, token, "0",
                String.valueOf(System.currentTimeMillis() / 1000 + 3600), nonce);
        }

        public PaymentParams(
                String to,
                BigInteger amount,
                String token,
                String validAfter,
                String validBefore,
                String nonce) {
            this.to = to;
            this.amount = amount;
            this.token = token;
            this.validAfter = validAfter;
            this.validBefore = validBefore;
            this.nonce = nonce;
        }

        public String getTo() {
            return to;
        }

        public BigInteger getAmount() {
            return amount;
        }

        public String getToken() {
            return token;
        }

        public String getValidAfter() {
            return validAfter;
        }

        public String getValidBefore() {
            return validBefore;
        }

        public String getNonce() {
            return nonce;
        }
    }

    /**
     * Payment result.
     */
    public static class PaymentResult {
        private final String signature;
        private final String from;
        private final String to;
        private final BigInteger amount;
        private final String token;

        public PaymentResult(String signature, String from, String to, BigInteger amount, String token) {
            this.signature = signature;
            this.from = from;
            this.to = to;
            this.amount = amount;
            this.token = token;
        }

        public String getSignature() {
            return signature;
        }

        public String getFrom() {
            return from;
        }

        public String getTo() {
            return to;
        }

        public BigInteger getAmount() {
            return amount;
        }

        public String getToken() {
            return token;
        }
    }

    /**
     * Format a token amount for display.
     *
     * @param amount Raw amount
     * @param decimals Token decimals
     * @return Formatted string
     */
    public static String formatAmount(BigInteger amount, int decimals) {
        if (amount == null) {
            return "0";
        }

        BigDecimal value = new BigDecimal(amount)
            .divide(BigDecimal.TEN.pow(decimals), decimals, java.math.RoundingMode.DOWN);

        // Strip trailing zeros
        return value.stripTrailingZeros().toPlainString();
    }

    /**
     * Parse a formatted amount to raw value.
     *
     * @param amount Formatted amount string
     * @param decimals Token decimals
     * @return Raw amount
     */
    public static BigInteger parseAmount(String amount, int decimals) {
        return new BigDecimal(amount)
            .multiply(BigDecimal.TEN.pow(decimals))
            .toBigInteger();
    }
}

package io.t402.erc4337.bundler;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import io.t402.erc4337.BundlerClient;
import io.t402.erc4337.BundlerException;
import io.t402.erc4337.GasEstimate;
import io.t402.erc4337.PaymasterData;
import io.t402.erc4337.UserOperation;
import io.t402.util.Json;

/**
 * Pimlico bundler client for ERC-4337.
 *
 * <p>Extends the base BundlerClient with Pimlico-specific features:
 * <ul>
 *   <li>API key authentication</li>
 *   <li>pm_sponsorUserOperation for gas sponsorship</li>
 *   <li>pm_validateSponsorshipPolicies for policy validation</li>
 *   <li>pimlico_getUserOperationGasPrice for gas price recommendations</li>
 * </ul>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * PimlicoBundler bundler = new PimlicoBundler.Builder()
 *     .apiKey("your-api-key")
 *     .chainId(8453)  // Base mainnet
 *     .build();
 *
 * // Get sponsored UserOp
 * UserOperation sponsoredOp = bundler.sponsorUserOperation(userOp, "sponsorship-policy-id");
 *
 * // Send to bundler
 * String userOpHash = bundler.sendUserOperation(sponsoredOp);
 * }</pre>
 *
 * @see <a href="https://docs.pimlico.io">Pimlico Documentation</a>
 */
public class PimlicoBundler extends BundlerClient {

    private static final String PIMLICO_BASE_URL = "https://api.pimlico.io/v2";

    private final String apiKey;
    private final long chainId;
    private final HttpClient httpClient;
    private final AtomicInteger requestId = new AtomicInteger(0);
    private final String bundlerUrl;
    private final String paymasterUrl;

    private PimlicoBundler(Builder builder) {
        super(builder.getBundlerUrl(), builder.entryPoint);
        this.apiKey = builder.apiKey;
        this.chainId = builder.chainId;
        this.httpClient = HttpClient.newHttpClient();
        this.bundlerUrl = builder.getBundlerUrl();
        this.paymasterUrl = builder.getPaymasterUrl();
    }

    /**
     * Sponsors a UserOperation using Pimlico's paymaster.
     *
     * @param userOp The UserOperation to sponsor
     * @return UserOperation with paymaster data
     * @throws BundlerException if sponsorship fails
     */
    public UserOperation sponsorUserOperation(UserOperation userOp) throws BundlerException {
        return sponsorUserOperation(userOp, null);
    }

    /**
     * Sponsors a UserOperation with a specific policy.
     *
     * @param userOp The UserOperation to sponsor
     * @param sponsorshipPolicyId Optional sponsorship policy ID
     * @return UserOperation with paymaster data
     * @throws BundlerException if sponsorship fails
     */
    @SuppressWarnings("unchecked")
    public UserOperation sponsorUserOperation(UserOperation userOp, String sponsorshipPolicyId)
            throws BundlerException {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("userOperation", packForRpc(userOp));
            params.put("entryPoint", ENTRYPOINT_V07_ADDRESS);

            if (sponsorshipPolicyId != null) {
                params.put("sponsorshipPolicyId", sponsorshipPolicyId);
            }

            Map<String, Object> result = (Map<String, Object>) paymasterRpcCall(
                "pm_sponsorUserOperation", params);

            // Apply paymaster data to UserOp
            return userOp.toBuilder()
                .paymasterAndData(buildPaymasterAndData(result))
                .preVerificationGas(parseBigInt(result.get("preVerificationGas")))
                .verificationGasLimit(parseBigInt(result.get("verificationGasLimit")))
                .callGasLimit(parseBigInt(result.get("callGasLimit")))
                .build();

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to sponsor UserOperation", e);
        }
    }

    /**
     * Validates sponsorship policies for a UserOperation.
     *
     * @param userOp The UserOperation to validate
     * @param sponsorshipPolicyIds List of policy IDs to validate
     * @return Map of policy ID to validation result
     * @throws BundlerException if validation fails
     */
    @SuppressWarnings("unchecked")
    public Map<String, Boolean> validateSponsorshipPolicies(
            UserOperation userOp,
            String... sponsorshipPolicyIds) throws BundlerException {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("userOperation", packForRpc(userOp));
            params.put("entryPoint", ENTRYPOINT_V07_ADDRESS);
            params.put("sponsorshipPolicyIds", sponsorshipPolicyIds);

            Map<String, Object> result = (Map<String, Object>) paymasterRpcCall(
                "pm_validateSponsorshipPolicies", params);

            Map<String, Boolean> validations = new HashMap<>();
            for (Map.Entry<String, Object> entry : result.entrySet()) {
                validations.put(entry.getKey(), Boolean.TRUE.equals(entry.getValue()));
            }
            return validations;

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to validate sponsorship policies", e);
        }
    }

    /**
     * Gets recommended gas prices from Pimlico.
     *
     * @return GasPriceRecommendation with slow, standard, and fast options
     * @throws BundlerException if request fails
     */
    @SuppressWarnings("unchecked")
    public GasPriceRecommendation getUserOperationGasPrice() throws BundlerException {
        try {
            Map<String, Object> result = (Map<String, Object>) bundlerRpcCall(
                "pimlico_getUserOperationGasPrice");

            return new GasPriceRecommendation(
                parseGasPrice((Map<String, Object>) result.get("slow")),
                parseGasPrice((Map<String, Object>) result.get("standard")),
                parseGasPrice((Map<String, Object>) result.get("fast"))
            );

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get gas price", e);
        }
    }

    /**
     * Gets the account nonce for a sender address.
     *
     * @param sender The account address
     * @param key Optional nonce key (default: 0)
     * @return Current nonce
     * @throws BundlerException if request fails
     */
    public BigInteger getAccountNonce(String sender, BigInteger key) throws BundlerException {
        try {
            Object result = bundlerRpcCall("eth_getAccountNonce", sender, toHex(key));
            return parseBigInt(result);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get account nonce", e);
        }
    }

    /**
     * Gets the account nonce with default key.
     */
    public BigInteger getAccountNonce(String sender) throws BundlerException {
        return getAccountNonce(sender, BigInteger.ZERO);
    }

    @Override
    public GasEstimate estimateUserOperationGas(UserOperation userOp) throws BundlerException {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) bundlerRpcCall(
                "eth_estimateUserOperationGas",
                packForRpc(userOp),
                ENTRYPOINT_V07_ADDRESS);

            return new GasEstimate(
                parseBigInt(result.get("verificationGasLimit")),
                parseBigInt(result.get("callGasLimit")),
                parseBigInt(result.get("preVerificationGas")),
                result.containsKey("paymasterVerificationGasLimit")
                    ? parseBigInt(result.get("paymasterVerificationGasLimit")) : null,
                result.containsKey("paymasterPostOpGasLimit")
                    ? parseBigInt(result.get("paymasterPostOpGasLimit")) : null
            );
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to estimate gas", e);
        }
    }

    // Internal helpers

    private Map<String, Object> packForRpc(UserOperation userOp) {
        Map<String, Object> packed = new HashMap<>();
        packed.put("sender", userOp.getSender());
        packed.put("nonce", toHex(userOp.getNonce()));
        packed.put("initCode", userOp.getInitCode());
        packed.put("callData", userOp.getCallData());
        packed.put("accountGasLimits", packAccountGasLimits(
            userOp.getVerificationGasLimit(), userOp.getCallGasLimit()));
        packed.put("preVerificationGas", toHex(userOp.getPreVerificationGas()));
        packed.put("gasFees", packGasFees(
            userOp.getMaxPriorityFeePerGas(), userOp.getMaxFeePerGas()));
        packed.put("paymasterAndData", userOp.getPaymasterAndData());
        packed.put("signature", userOp.getSignature());
        return packed;
    }

    private String packAccountGasLimits(BigInteger verificationGas, BigInteger callGas) {
        return "0x" + padHex(verificationGas, 32) + padHex(callGas, 32);
    }

    private String packGasFees(BigInteger maxPriorityFee, BigInteger maxFee) {
        return "0x" + padHex(maxPriorityFee, 32) + padHex(maxFee, 32);
    }

    private String buildPaymasterAndData(Map<String, Object> result) {
        String paymaster = (String) result.get("paymaster");
        BigInteger paymasterVerificationGas = parseBigInt(result.get("paymasterVerificationGasLimit"));
        BigInteger paymasterPostOpGas = parseBigInt(result.get("paymasterPostOpGasLimit"));
        String paymasterData = (String) result.getOrDefault("paymasterData", "0x");

        PaymasterData pd = new PaymasterData(
            paymaster, paymasterVerificationGas, paymasterPostOpGas, paymasterData);
        return pd.encode();
    }

    private GasPrice parseGasPrice(Map<String, Object> data) {
        return new GasPrice(
            parseBigInt(data.get("maxFeePerGas")),
            parseBigInt(data.get("maxPriorityFeePerGas"))
        );
    }

    private String toHex(BigInteger value) {
        return "0x" + value.toString(16);
    }

    private String padHex(BigInteger value, int length) {
        String hex = value.toString(16);
        while (hex.length() < length) {
            hex = "0" + hex;
        }
        return hex;
    }

    private BigInteger parseBigInt(Object value) {
        if (value == null) {
            return BigInteger.ZERO;
        }
        String str = value.toString();
        if (str.startsWith("0x")) {
            return new BigInteger(str.substring(2), 16);
        }
        return new BigInteger(str);
    }

    private Object bundlerRpcCall(String method, Object... params) throws IOException, InterruptedException {
        return rpcCall(bundlerUrl, method, params);
    }

    private Object paymasterRpcCall(String method, Object... params) throws IOException, InterruptedException {
        return rpcCall(paymasterUrl, method, params);
    }

    private Object rpcCall(String url, String method, Object... params) throws IOException, InterruptedException {
        Map<String, Object> request = new HashMap<>();
        request.put("jsonrpc", "2.0");
        request.put("id", requestId.incrementAndGet());
        request.put("method", method);
        request.put("params", params);

        String body = Json.MAPPER.writeValueAsString(request);

        HttpRequest httpRequest = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("HTTP error: " + response.statusCode());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> json = Json.MAPPER.readValue(response.body(), Map.class);

        if (json.containsKey("error")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> error = (Map<String, Object>) json.get("error");
            throw new IOException("RPC error: " + error.get("message"));
        }

        return json.get("result");
    }

    /**
     * Gas price recommendation.
     */
    public static class GasPriceRecommendation {
        public final GasPrice slow;
        public final GasPrice standard;
        public final GasPrice fast;

        public GasPriceRecommendation(GasPrice slow, GasPrice standard, GasPrice fast) {
            this.slow = slow;
            this.standard = standard;
            this.fast = fast;
        }
    }

    /**
     * Gas price with maxFeePerGas and maxPriorityFeePerGas.
     */
    public static class GasPrice {
        public final BigInteger maxFeePerGas;
        public final BigInteger maxPriorityFeePerGas;

        public GasPrice(BigInteger maxFeePerGas, BigInteger maxPriorityFeePerGas) {
            this.maxFeePerGas = maxFeePerGas;
            this.maxPriorityFeePerGas = maxPriorityFeePerGas;
        }
    }

    /**
     * Builder for PimlicoBundler.
     */
    public static class Builder {
        private String apiKey;
        private long chainId = 1;
        private String entryPoint = ENTRYPOINT_V07_ADDRESS;
        private String customBundlerUrl;
        private String customPaymasterUrl;

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder chainId(long chainId) {
            this.chainId = chainId;
            return this;
        }

        public Builder entryPoint(String entryPoint) {
            this.entryPoint = entryPoint;
            return this;
        }

        public Builder bundlerUrl(String url) {
            this.customBundlerUrl = url;
            return this;
        }

        public Builder paymasterUrl(String url) {
            this.customPaymasterUrl = url;
            return this;
        }

        String getBundlerUrl() {
            if (customBundlerUrl != null) {
                return customBundlerUrl;
            }
            return PIMLICO_BASE_URL + "/" + chainId + "/rpc?apikey=" + apiKey;
        }

        String getPaymasterUrl() {
            if (customPaymasterUrl != null) {
                return customPaymasterUrl;
            }
            return PIMLICO_BASE_URL + "/" + chainId + "/rpc?apikey=" + apiKey;
        }

        public PimlicoBundler build() {
            if (apiKey == null && customBundlerUrl == null) {
                throw new IllegalArgumentException("apiKey is required when not using custom URLs");
            }
            return new PimlicoBundler(this);
        }
    }

    /**
     * Creates a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }
}

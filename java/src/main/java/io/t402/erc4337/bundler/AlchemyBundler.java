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
 * Alchemy bundler client for ERC-4337.
 *
 * <p>Extends the base BundlerClient with Alchemy-specific features:
 * <ul>
 *   <li>API key authentication</li>
 *   <li>alchemy_requestPaymasterAndData for gas sponsorship</li>
 *   <li>alchemy_requestGasAndPaymasterAndData combined endpoint</li>
 *   <li>Gas Manager policy support</li>
 * </ul>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * AlchemyBundler bundler = new AlchemyBundler.Builder()
 *     .apiKey("your-api-key")
 *     .chainId(8453)  // Base mainnet
 *     .policyId("gas-manager-policy-id")  // Optional
 *     .build();
 *
 * // Get gas estimates and paymaster data in one call
 * UserOperation sponsoredOp = bundler.requestGasAndPaymasterAndData(userOp);
 *
 * // Send to bundler
 * String userOpHash = bundler.sendUserOperation(sponsoredOp);
 * }</pre>
 *
 * @see <a href="https://docs.alchemy.com/reference/bundler-api-endpoints">Alchemy Documentation</a>
 */
public class AlchemyBundler extends BundlerClient {

    private static final Map<Long, String> ALCHEMY_NETWORKS = Map.ofEntries(
        Map.entry(1L, "eth-mainnet"),
        Map.entry(11155111L, "eth-sepolia"),
        Map.entry(137L, "polygon-mainnet"),
        Map.entry(80002L, "polygon-amoy"),
        Map.entry(42161L, "arb-mainnet"),
        Map.entry(421614L, "arb-sepolia"),
        Map.entry(10L, "opt-mainnet"),
        Map.entry(11155420L, "opt-sepolia"),
        Map.entry(8453L, "base-mainnet"),
        Map.entry(84532L, "base-sepolia")
    );

    private final String apiKey;
    private final long chainId;
    private final String policyId;
    private final HttpClient httpClient;
    private final AtomicInteger requestId = new AtomicInteger(0);
    private final String bundlerUrl;

    private AlchemyBundler(Builder builder) {
        super(builder.getBundlerUrl(), builder.entryPoint);
        this.apiKey = builder.apiKey;
        this.chainId = builder.chainId;
        this.policyId = builder.policyId;
        this.httpClient = HttpClient.newHttpClient();
        this.bundlerUrl = builder.getBundlerUrl();
    }

    /**
     * Requests paymaster data for a UserOperation.
     *
     * @param userOp The UserOperation
     * @return UserOperation with paymaster data
     * @throws BundlerException if request fails
     */
    @SuppressWarnings("unchecked")
    public UserOperation requestPaymasterAndData(UserOperation userOp) throws BundlerException {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("userOperation", packForRpc(userOp));
            params.put("entryPoint", ENTRYPOINT_V07_ADDRESS);

            if (policyId != null) {
                params.put("policyId", policyId);
            }

            Map<String, Object> result = (Map<String, Object>) rpcCall(
                "alchemy_requestPaymasterAndData", params);

            String paymasterAndData = (String) result.get("paymasterAndData");

            return userOp.toBuilder()
                .paymasterAndData(paymasterAndData)
                .build();

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to request paymaster data", e);
        }
    }

    /**
     * Requests gas estimates and paymaster data in a single call.
     *
     * <p>This is more efficient than calling estimateUserOperationGas and
     * requestPaymasterAndData separately.
     *
     * @param userOp The UserOperation
     * @return UserOperation with gas estimates and paymaster data
     * @throws BundlerException if request fails
     */
    @SuppressWarnings("unchecked")
    public UserOperation requestGasAndPaymasterAndData(UserOperation userOp) throws BundlerException {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("userOperation", packForRpc(userOp));
            params.put("entryPoint", ENTRYPOINT_V07_ADDRESS);

            if (policyId != null) {
                params.put("policyId", policyId);
            }

            // Override for specific gas estimation settings
            Map<String, Object> overrides = new HashMap<>();
            overrides.put("maxFeePerGas", toHex(userOp.getMaxFeePerGas()));
            overrides.put("maxPriorityFeePerGas", toHex(userOp.getMaxPriorityFeePerGas()));
            params.put("overrides", overrides);

            Map<String, Object> result = (Map<String, Object>) rpcCall(
                "alchemy_requestGasAndPaymasterAndData", params);

            return userOp.toBuilder()
                .paymasterAndData((String) result.get("paymasterAndData"))
                .preVerificationGas(parseBigInt(result.get("preVerificationGas")))
                .verificationGasLimit(parseBigInt(result.get("verificationGasLimit")))
                .callGasLimit(parseBigInt(result.get("callGasLimit")))
                .maxFeePerGas(parseBigInt(result.get("maxFeePerGas")))
                .maxPriorityFeePerGas(parseBigInt(result.get("maxPriorityFeePerGas")))
                .build();

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to request gas and paymaster data", e);
        }
    }

    /**
     * Simulates a UserOperation to check for errors.
     *
     * @param userOp The UserOperation to simulate
     * @return Simulation result
     * @throws BundlerException if simulation fails
     */
    @SuppressWarnings("unchecked")
    public SimulationResult simulateUserOperation(UserOperation userOp) throws BundlerException {
        try {
            Map<String, Object> result = (Map<String, Object>) rpcCall(
                "alchemy_simulateUserOperationAssetChanges",
                packForRpc(userOp),
                ENTRYPOINT_V07_ADDRESS);

            return new SimulationResult(
                Boolean.TRUE.equals(result.get("changes")),
                (String) result.get("error")
            );

        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to simulate UserOperation", e);
        }
    }

    /**
     * Gets the current max priority fee per gas.
     *
     * @return Max priority fee in wei
     * @throws BundlerException if request fails
     */
    public BigInteger getMaxPriorityFeePerGas() throws BundlerException {
        try {
            Object result = rpcCall("rundler_maxPriorityFeePerGas");
            return parseBigInt(result);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get max priority fee", e);
        }
    }

    @Override
    public GasEstimate estimateUserOperationGas(UserOperation userOp) throws BundlerException {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) rpcCall(
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
        packed.put("verificationGasLimit", toHex(userOp.getVerificationGasLimit()));
        packed.put("callGasLimit", toHex(userOp.getCallGasLimit()));
        packed.put("preVerificationGas", toHex(userOp.getPreVerificationGas()));
        packed.put("maxFeePerGas", toHex(userOp.getMaxFeePerGas()));
        packed.put("maxPriorityFeePerGas", toHex(userOp.getMaxPriorityFeePerGas()));
        packed.put("paymasterAndData", userOp.getPaymasterAndData());
        packed.put("signature", userOp.getSignature());
        return packed;
    }

    private String toHex(BigInteger value) {
        return "0x" + value.toString(16);
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

    private Object rpcCall(String method, Object... params) throws IOException, InterruptedException {
        Map<String, Object> request = new HashMap<>();
        request.put("jsonrpc", "2.0");
        request.put("id", requestId.incrementAndGet());
        request.put("method", method);
        request.put("params", params);

        String body = Json.MAPPER.writeValueAsString(request);

        HttpRequest httpRequest = HttpRequest.newBuilder()
            .uri(URI.create(bundlerUrl))
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
     * Result of UserOperation simulation.
     */
    public static class SimulationResult {
        public final boolean success;
        public final String error;

        public SimulationResult(boolean success, String error) {
            this.success = success;
            this.error = error;
        }
    }

    /**
     * Builder for AlchemyBundler.
     */
    public static class Builder {
        private String apiKey;
        private long chainId = 1;
        private String entryPoint = ENTRYPOINT_V07_ADDRESS;
        private String policyId;
        private String customBundlerUrl;

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

        public Builder policyId(String policyId) {
            this.policyId = policyId;
            return this;
        }

        public Builder bundlerUrl(String url) {
            this.customBundlerUrl = url;
            return this;
        }

        String getBundlerUrl() {
            if (customBundlerUrl != null) {
                return customBundlerUrl;
            }

            String network = ALCHEMY_NETWORKS.get(chainId);
            if (network == null) {
                throw new IllegalArgumentException("Unsupported chain ID for Alchemy: " + chainId);
            }

            return "https://" + network + ".g.alchemy.com/v2/" + apiKey;
        }

        public AlchemyBundler build() {
            if (apiKey == null && customBundlerUrl == null) {
                throw new IllegalArgumentException("apiKey is required when not using custom URL");
            }
            return new AlchemyBundler(this);
        }
    }

    /**
     * Creates a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }
}

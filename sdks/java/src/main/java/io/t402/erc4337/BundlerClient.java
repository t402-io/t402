package io.t402.erc4337;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import io.t402.util.Json;

/**
 * ERC-4337 Bundler Client.
 *
 * <p>Client for interacting with ERC-4337 bundlers via JSON-RPC.
 * Handles UserOperation submission, gas estimation, and receipt polling.
 */
public class BundlerClient {

    /** Default EntryPoint v0.7 address. */
    public static final String ENTRYPOINT_V07_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    private final String bundlerUrl;
    private final String entryPoint;
    private final HttpClient httpClient;
    private final AtomicInteger requestId = new AtomicInteger(0);

    /**
     * Creates a new bundler client.
     *
     * @param bundlerUrl Bundler JSON-RPC URL
     */
    public BundlerClient(String bundlerUrl) {
        this(bundlerUrl, ENTRYPOINT_V07_ADDRESS);
    }

    /**
     * Creates a new bundler client with custom EntryPoint.
     *
     * @param bundlerUrl Bundler JSON-RPC URL
     * @param entryPoint EntryPoint contract address
     */
    public BundlerClient(String bundlerUrl, String entryPoint) {
        this.bundlerUrl = bundlerUrl;
        this.entryPoint = entryPoint;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Sends a UserOperation to the bundler.
     *
     * @param userOp The UserOperation to send
     * @return UserOperation hash
     * @throws BundlerException if submission fails
     */
    public String sendUserOperation(UserOperation userOp) throws BundlerException {
        Map<String, Object> packedOp = packForRpc(userOp);

        try {
            Object result = rpcCall("eth_sendUserOperation", packedOp, entryPoint);
            return (String) result;
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to send UserOperation", e);
        }
    }

    /**
     * Sends a UserOperation asynchronously.
     *
     * @param userOp The UserOperation to send
     * @return CompletableFuture with UserOperation hash
     */
    public CompletableFuture<String> sendUserOperationAsync(UserOperation userOp) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return sendUserOperation(userOp);
            } catch (BundlerException e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Estimates gas for a UserOperation.
     *
     * @param userOp The UserOperation to estimate
     * @return Gas estimate
     * @throws BundlerException if estimation fails
     */
    @SuppressWarnings("unchecked")
    public GasEstimate estimateUserOperationGas(UserOperation userOp) throws BundlerException {
        Map<String, Object> packedOp = packForRpc(userOp);

        try {
            Map<String, Object> result = (Map<String, Object>) rpcCall(
                "eth_estimateUserOperationGas", packedOp, entryPoint);

            BigInteger verificationGas = parseBigInt(result.get("verificationGasLimit"));
            BigInteger callGas = parseBigInt(result.get("callGasLimit"));
            BigInteger preVerificationGas = parseBigInt(result.get("preVerificationGas"));

            BigInteger paymasterVerificationGas = result.containsKey("paymasterVerificationGasLimit")
                ? parseBigInt(result.get("paymasterVerificationGasLimit")) : null;
            BigInteger paymasterPostOpGas = result.containsKey("paymasterPostOpGasLimit")
                ? parseBigInt(result.get("paymasterPostOpGasLimit")) : null;

            return new GasEstimate(
                verificationGas, callGas, preVerificationGas,
                paymasterVerificationGas, paymasterPostOpGas);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to estimate gas", e);
        }
    }

    /**
     * Gets a UserOperation by its hash.
     *
     * @param userOpHash The UserOperation hash
     * @return UserOperation or null if not found
     * @throws BundlerException if lookup fails
     */
    @SuppressWarnings("unchecked")
    public UserOperation getUserOperationByHash(String userOpHash) throws BundlerException {
        try {
            Object result = rpcCall("eth_getUserOperationByHash", userOpHash);
            if (result == null) {
                return null;
            }

            Map<String, Object> data = (Map<String, Object>) result;
            Map<String, Object> op = (Map<String, Object>) data.get("userOperation");

            return parseUserOperation(op);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get UserOperation", e);
        }
    }

    /**
     * Gets the receipt for a UserOperation.
     *
     * @param userOpHash The UserOperation hash
     * @return Receipt or null if not found
     * @throws BundlerException if lookup fails
     */
    @SuppressWarnings("unchecked")
    public UserOperationReceipt getUserOperationReceipt(String userOpHash) throws BundlerException {
        try {
            Object result = rpcCall("eth_getUserOperationReceipt", userOpHash);
            if (result == null) {
                return null;
            }

            Map<String, Object> data = (Map<String, Object>) result;
            return parseReceipt(data);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get receipt", e);
        }
    }

    /**
     * Waits for a UserOperation receipt with polling.
     *
     * @param userOpHash The UserOperation hash
     * @param timeoutMs Timeout in milliseconds
     * @param pollingIntervalMs Polling interval in milliseconds
     * @return Receipt
     * @throws BundlerException if timeout or lookup fails
     */
    public UserOperationReceipt waitForReceipt(
            String userOpHash, long timeoutMs, long pollingIntervalMs) throws BundlerException {
        long startTime = System.currentTimeMillis();

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            UserOperationReceipt receipt = getUserOperationReceipt(userOpHash);
            if (receipt != null) {
                return receipt;
            }

            try {
                Thread.sleep(pollingIntervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BundlerException("Wait interrupted", e);
            }
        }

        throw new BundlerException("Timeout waiting for UserOperation receipt: " + userOpHash);
    }

    /**
     * Waits for a UserOperation receipt with default timeout.
     */
    public UserOperationReceipt waitForReceipt(String userOpHash) throws BundlerException {
        return waitForReceipt(userOpHash, 60000, 2000);
    }

    /**
     * Gets supported EntryPoints from the bundler.
     *
     * @return Array of EntryPoint addresses
     * @throws BundlerException if lookup fails
     */
    @SuppressWarnings("unchecked")
    public String[] getSupportedEntryPoints() throws BundlerException {
        try {
            java.util.List<String> result = (java.util.List<String>) rpcCall("eth_supportedEntryPoints");
            return result.toArray(new String[0]);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get supported EntryPoints", e);
        }
    }

    /**
     * Gets the chain ID from the bundler.
     */
    public long getChainId() throws BundlerException {
        try {
            String result = (String) rpcCall("eth_chainId");
            return Long.parseLong(result.substring(2), 16);
        } catch (IOException | InterruptedException e) {
            throw new BundlerException("Failed to get chain ID", e);
        }
    }

    // Pack UserOperation for RPC
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

    // Pack account gas limits (v0.7 format)
    private String packAccountGasLimits(BigInteger verificationGas, BigInteger callGas) {
        String verification = padHex(verificationGas, 32);
        String call = padHex(callGas, 32);
        return "0x" + verification + call;
    }

    // Pack gas fees (v0.7 format)
    private String packGasFees(BigInteger maxPriorityFee, BigInteger maxFee) {
        String priority = padHex(maxPriorityFee, 32);
        String max = padHex(maxFee, 32);
        return "0x" + priority + max;
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

    private UserOperation parseUserOperation(Map<String, Object> op) {
        return UserOperation.builder()
            .sender((String) op.get("sender"))
            .nonce(parseBigInt(op.get("nonce")))
            .initCode((String) op.getOrDefault("initCode", "0x"))
            .callData((String) op.get("callData"))
            .verificationGasLimit(parseBigInt(op.get("verificationGasLimit")))
            .callGasLimit(parseBigInt(op.get("callGasLimit")))
            .preVerificationGas(parseBigInt(op.get("preVerificationGas")))
            .maxPriorityFeePerGas(parseBigInt(op.get("maxPriorityFeePerGas")))
            .maxFeePerGas(parseBigInt(op.get("maxFeePerGas")))
            .paymasterAndData((String) op.getOrDefault("paymasterAndData", "0x"))
            .signature((String) op.getOrDefault("signature", "0x"))
            .build();
    }

    @SuppressWarnings("unchecked")
    private UserOperationReceipt parseReceipt(Map<String, Object> data) {
        Map<String, Object> txReceipt = (Map<String, Object>) data.get("receipt");

        return new UserOperationReceipt(
            (String) data.get("userOpHash"),
            (String) data.get("sender"),
            parseBigInt(data.get("nonce")),
            (String) data.get("paymaster"),
            parseBigInt(data.get("actualGasCost")),
            parseBigInt(data.get("actualGasUsed")),
            Boolean.TRUE.equals(data.get("success")),
            (String) data.get("reason"),
            (String) txReceipt.get("transactionHash"),
            parseBigInt(txReceipt.get("blockNumber")),
            (String) txReceipt.get("blockHash")
        );
    }

    // Make JSON-RPC call
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
}

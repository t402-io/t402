package io.t402.erc4337;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;

import io.t402.util.Json;

/**
 * ERC-4337 Paymaster Client.
 *
 * <p>Handles paymaster interactions for gas sponsorship.
 * Supports verifying and sponsoring paymasters.
 */
public class PaymasterClient {

    /** Paymaster type for off-chain signature verification. */
    public static final String TYPE_VERIFYING = "verifying";

    /** Paymaster type for third-party gas sponsorship. */
    public static final String TYPE_SPONSORING = "sponsoring";

    /** Paymaster type for paying gas with ERC20 tokens. */
    public static final String TYPE_TOKEN = "token";

    private final String paymasterUrl;
    private final String paymasterAddress;
    private final String type;
    private final HttpClient httpClient;

    /**
     * Creates a new paymaster client for sponsoring paymasters.
     *
     * @param paymasterUrl Paymaster service URL
     */
    public PaymasterClient(String paymasterUrl) {
        this(paymasterUrl, null, TYPE_SPONSORING);
    }

    /**
     * Creates a new paymaster client.
     *
     * @param paymasterUrl Paymaster service URL
     * @param paymasterAddress On-chain paymaster address (for local paymasters)
     * @param type Paymaster type (verifying, sponsoring, token)
     */
    public PaymasterClient(String paymasterUrl, String paymasterAddress, String type) {
        this.paymasterUrl = paymasterUrl;
        this.paymasterAddress = paymasterAddress;
        this.type = type;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Gets paymaster data for a UserOperation.
     *
     * @param userOp The UserOperation
     * @param chainId Chain ID
     * @param entryPoint EntryPoint address
     * @return PaymasterData to include in UserOp
     * @throws PaymasterException if paymaster rejects or service fails
     */
    public PaymasterData getPaymasterData(
            UserOperation userOp,
            long chainId,
            String entryPoint) throws PaymasterException {
        return getPaymasterData(userOp, chainId, entryPoint, null);
    }

    /**
     * Gets paymaster data for a UserOperation with context.
     *
     * @param userOp The UserOperation
     * @param chainId Chain ID
     * @param entryPoint EntryPoint address
     * @param context Optional context for paymaster
     * @return PaymasterData to include in UserOp
     * @throws PaymasterException if paymaster rejects or service fails
     */
    public PaymasterData getPaymasterData(
            UserOperation userOp,
            long chainId,
            String entryPoint,
            Map<String, Object> context) throws PaymasterException {

        switch (type) {
            case TYPE_VERIFYING:
                return getVerifyingPaymasterData(userOp, chainId, entryPoint);
            case TYPE_SPONSORING:
                return getSponsoringPaymasterData(userOp, chainId, entryPoint, context);
            case TYPE_TOKEN:
                return getTokenPaymasterData(userOp, chainId, entryPoint);
            default:
                throw new PaymasterException("Unknown paymaster type: " + type);
        }
    }

    /**
     * Checks if the paymaster will sponsor this operation.
     *
     * @param userOp The UserOperation
     * @param chainId Chain ID
     * @param entryPoint EntryPoint address
     * @return true if paymaster will sponsor
     */
    @SuppressWarnings("unchecked")
    public boolean willSponsor(
            UserOperation userOp,
            long chainId,
            String entryPoint) {
        if (paymasterUrl == null) {
            return true; // Local paymaster always sponsors
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("userOp", serializeUserOp(userOp));
            request.put("chainId", chainId);
            request.put("entryPoint", entryPoint);

            String body = Json.MAPPER.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(paymasterUrl + "/check"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                return false;
            }

            Map<String, Object> result = Json.MAPPER.readValue(response.body(), Map.class);
            return Boolean.TRUE.equals(result.get("willSponsor"));

        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Gets estimated gas costs including paymaster.
     */
    public GasEstimate estimatePaymasterGas(UserOperation userOp, long chainId) {
        // Return default gas limits for most paymasters
        return GasEstimate.defaults();
    }

    // Get verifying paymaster data
    private PaymasterData getVerifyingPaymasterData(
            UserOperation userOp,
            long chainId,
            String entryPoint) throws PaymasterException {

        if (paymasterUrl != null) {
            return callPaymasterService(userOp, chainId, entryPoint, null);
        }

        // Local verifying paymaster
        return new PaymasterData(
            paymasterAddress,
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0x"
        );
    }

    // Get sponsoring paymaster data
    private PaymasterData getSponsoringPaymasterData(
            UserOperation userOp,
            long chainId,
            String entryPoint,
            Map<String, Object> context) throws PaymasterException {

        if (paymasterUrl == null) {
            throw new PaymasterException("Sponsoring paymaster requires a service URL");
        }

        return callSponsorService(userOp, chainId, entryPoint, context);
    }

    // Get token paymaster data
    private PaymasterData getTokenPaymasterData(
            UserOperation userOp,
            long chainId,
            String entryPoint) throws PaymasterException {

        if (paymasterUrl != null) {
            return callPaymasterService(userOp, chainId, entryPoint, null);
        }

        // Local token paymaster
        return new PaymasterData(
            paymasterAddress,
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0x"
        );
    }

    // Call paymaster service for data
    @SuppressWarnings("unchecked")
    private PaymasterData callPaymasterService(
            UserOperation userOp,
            long chainId,
            String entryPoint,
            Map<String, Object> context) throws PaymasterException {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("userOp", serializeUserOp(userOp));
            request.put("chainId", chainId);
            request.put("entryPoint", entryPoint);
            if (context != null) {
                request.put("context", context);
            }

            String body = Json.MAPPER.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(paymasterUrl + "/getPaymasterData"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new PaymasterException("Paymaster service error: " + response.body());
            }

            Map<String, Object> result = Json.MAPPER.readValue(response.body(), Map.class);
            return parsePaymasterResponse(result);

        } catch (IOException | InterruptedException e) {
            throw new PaymasterException("Failed to call paymaster service", e);
        }
    }

    // Call sponsor service
    @SuppressWarnings("unchecked")
    private PaymasterData callSponsorService(
            UserOperation userOp,
            long chainId,
            String entryPoint,
            Map<String, Object> context) throws PaymasterException {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("userOp", serializeUserOp(userOp));
            request.put("chainId", chainId);
            request.put("entryPoint", entryPoint);
            if (context != null) {
                request.put("context", context);
            }

            String body = Json.MAPPER.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(paymasterUrl + "/sponsor"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new PaymasterException("Paymaster rejected sponsorship: " + response.body());
            }

            Map<String, Object> result = Json.MAPPER.readValue(response.body(), Map.class);
            return parsePaymasterResponse(result);

        } catch (IOException | InterruptedException e) {
            throw new PaymasterException("Failed to call sponsor service", e);
        }
    }

    private PaymasterData parsePaymasterResponse(Map<String, Object> result) {
        String paymaster = (String) result.get("paymaster");
        BigInteger verificationGas = parseBigInt(result.get("paymasterVerificationGasLimit"));
        BigInteger postOpGas = parseBigInt(result.get("paymasterPostOpGasLimit"));
        String data = (String) result.getOrDefault("paymasterData", "0x");

        return new PaymasterData(paymaster, verificationGas, postOpGas, data);
    }

    private Map<String, String> serializeUserOp(UserOperation userOp) {
        Map<String, String> result = new HashMap<>();
        result.put("sender", userOp.getSender());
        result.put("nonce", "0x" + userOp.getNonce().toString(16));
        result.put("initCode", userOp.getInitCode());
        result.put("callData", userOp.getCallData());
        result.put("verificationGasLimit", "0x" + userOp.getVerificationGasLimit().toString(16));
        result.put("callGasLimit", "0x" + userOp.getCallGasLimit().toString(16));
        result.put("preVerificationGas", "0x" + userOp.getPreVerificationGas().toString(16));
        result.put("maxPriorityFeePerGas", "0x" + userOp.getMaxPriorityFeePerGas().toString(16));
        result.put("maxFeePerGas", "0x" + userOp.getMaxFeePerGas().toString(16));
        result.put("paymasterAndData", userOp.getPaymasterAndData());
        result.put("signature", userOp.getSignature());
        return result;
    }

    private BigInteger parseBigInt(Object value) {
        if (value == null) {
            return BigInteger.valueOf(100000); // Default
        }
        String str = value.toString();
        if (str.startsWith("0x")) {
            return new BigInteger(str.substring(2), 16);
        }
        return new BigInteger(str);
    }
}

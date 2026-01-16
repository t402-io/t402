package io.t402.bridge;

import io.t402.bridge.BridgeTypes.LayerZeroMessage;
import io.t402.bridge.BridgeTypes.LayerZeroMessageStatus;
import io.t402.util.Json;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Client for LayerZero Scan API.
 *
 * <p>Tracks cross-chain message delivery status.
 *
 * <p>Example usage:
 * <pre>{@code
 * LayerZeroScanClient client = new LayerZeroScanClient();
 *
 * // Get message status
 * LayerZeroMessage message = client.getMessage(messageGuid);
 * System.out.println("Status: " + message.getStatus());
 *
 * // Wait for delivery
 * LayerZeroMessage delivered = client.waitForDelivery(
 *     messageGuid,
 *     300000,  // 5 minutes timeout
 *     5000,    // poll every 5 seconds
 *     status -> System.out.println("Status changed: " + status)
 * );
 * System.out.println("Delivered! Dest TX: " + delivered.getDstTxHash());
 * }</pre>
 */
public class LayerZeroScanClient {

    private final String baseUrl;
    private final HttpClient httpClient;

    /**
     * Creates a new scan client with default URL.
     */
    public LayerZeroScanClient() {
        this(BridgeConstants.LAYERZERO_SCAN_BASE_URL);
    }

    /**
     * Creates a new scan client with custom URL.
     *
     * @param baseUrl Base URL for LayerZero Scan API
     */
    public LayerZeroScanClient(String baseUrl) {
        this.baseUrl = baseUrl;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Get message status by GUID.
     *
     * @param messageGuid LayerZero message GUID
     * @return Message information
     * @throws IOException if request fails
     */
    public LayerZeroMessage getMessage(String messageGuid) throws IOException {
        String url = baseUrl + "/messages/" + messageGuid;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Accept", "application/json")
            .GET()
            .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 404) {
                return null;
            }

            if (response.statusCode() != 200) {
                throw new IOException("LayerZero Scan API error: " + response.statusCode());
            }

            return parseMessage(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request interrupted", e);
        }
    }

    /**
     * Get message status asynchronously.
     */
    public CompletableFuture<LayerZeroMessage> getMessageAsync(String messageGuid) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return getMessage(messageGuid);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Wait for a message to be delivered.
     *
     * @param messageGuid LayerZero message GUID
     * @param timeoutMs Timeout in milliseconds
     * @param pollingIntervalMs Polling interval in milliseconds
     * @return Delivered message
     * @throws IOException if request fails or times out
     */
    public LayerZeroMessage waitForDelivery(
            String messageGuid,
            long timeoutMs,
            long pollingIntervalMs) throws IOException {
        return waitForDelivery(messageGuid, timeoutMs, pollingIntervalMs, null);
    }

    /**
     * Wait for a message to be delivered with status callback.
     *
     * @param messageGuid LayerZero message GUID
     * @param timeoutMs Timeout in milliseconds
     * @param pollingIntervalMs Polling interval in milliseconds
     * @param onStatusChange Callback for status changes (optional)
     * @return Delivered message
     * @throws IOException if request fails or times out
     */
    public LayerZeroMessage waitForDelivery(
            String messageGuid,
            long timeoutMs,
            long pollingIntervalMs,
            Consumer<LayerZeroMessageStatus> onStatusChange) throws IOException {

        long startTime = System.currentTimeMillis();
        LayerZeroMessageStatus lastStatus = null;

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            LayerZeroMessage message = getMessage(messageGuid);

            if (message != null) {
                if (message.getStatus() != lastStatus) {
                    lastStatus = message.getStatus();
                    if (onStatusChange != null) {
                        onStatusChange.accept(lastStatus);
                    }
                }

                if (message.getStatus() == LayerZeroMessageStatus.DELIVERED) {
                    return message;
                }

                if (message.getStatus() == LayerZeroMessageStatus.FAILED) {
                    throw new IOException("Message delivery failed: " + messageGuid);
                }
            }

            try {
                Thread.sleep(pollingIntervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("Wait interrupted", e);
            }
        }

        throw new IOException("Timeout waiting for message delivery: " + messageGuid);
    }

    /**
     * Wait for delivery with default timeout (5 minutes, 5 second polling).
     */
    public LayerZeroMessage waitForDelivery(String messageGuid) throws IOException {
        return waitForDelivery(messageGuid, 300000, 5000, null);
    }

    /**
     * Wait for delivery asynchronously.
     */
    public CompletableFuture<LayerZeroMessage> waitForDeliveryAsync(
            String messageGuid,
            long timeoutMs,
            long pollingIntervalMs,
            Consumer<LayerZeroMessageStatus> onStatusChange) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return waitForDelivery(messageGuid, timeoutMs, pollingIntervalMs, onStatusChange);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    @SuppressWarnings("unchecked")
    private LayerZeroMessage parseMessage(String json) throws IOException {
        try {
            Map<String, Object> data = Json.MAPPER.readValue(json, Map.class);

            String guid = (String) data.get("guid");
            String srcTxHash = (String) data.get("srcTxHash");
            String dstTxHash = (String) data.get("dstTxHash");
            String statusStr = (String) data.get("status");
            int srcChainId = ((Number) data.getOrDefault("srcChainId", 0)).intValue();
            int dstChainId = ((Number) data.getOrDefault("dstChainId", 0)).intValue();

            LayerZeroMessageStatus status = parseStatus(statusStr);

            return new LayerZeroMessage(guid, srcTxHash, dstTxHash, status, srcChainId, dstChainId);
        } catch (Exception e) {
            throw new IOException("Failed to parse LayerZero message", e);
        }
    }

    private LayerZeroMessageStatus parseStatus(String status) {
        if (status == null) {
            return LayerZeroMessageStatus.PENDING;
        }

        switch (status.toUpperCase()) {
            case "PENDING":
                return LayerZeroMessageStatus.PENDING;
            case "INFLIGHT":
                return LayerZeroMessageStatus.INFLIGHT;
            case "DELIVERED":
                return LayerZeroMessageStatus.DELIVERED;
            case "FAILED":
                return LayerZeroMessageStatus.FAILED;
            default:
                return LayerZeroMessageStatus.PENDING;
        }
    }
}

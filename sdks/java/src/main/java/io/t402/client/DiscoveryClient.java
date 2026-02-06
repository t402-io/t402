package io.t402.client;

import io.t402.model.DiscoveryModels;
import io.t402.model.DiscoveryModels.*;
import io.t402.util.Json;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Client for the Bazaar discovery API.
 * <p>
 * Provides methods to list, get, register, update, and delete
 * discoverable resources from the facilitator's Bazaar.
 * </p>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * DiscoveryClient discovery = new DiscoveryClient("https://facilitator.t402.io");
 *
 * // List resources
 * ListResourcesParams params = new ListResourcesParams();
 * params.type = "http";
 * params.limit = 10;
 * DiscoveryResponse resources = discovery.listResources(params);
 *
 * // Get a specific resource
 * DiscoveryItem item = discovery.getResource("res-123");
 *
 * // Register a new resource
 * RegisterResourceRequest req = new RegisterResourceRequest(
 *     "https://example.com/api", "http",
 *     List.of(new PaymentOption("exact", "eip155:8453", "100", "USDT", "0xabc", 3600))
 * );
 * RegisterResourceResponse resp = discovery.registerResource(req);
 * }</pre>
 */
public class DiscoveryClient {

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final String baseUrl;

    /**
     * Creates a new discovery client.
     *
     * @param baseUrl the base URL of the facilitator service
     */
    public DiscoveryClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
    }

    /**
     * Lists discoverable resources with optional filtering.
     *
     * @param params optional query parameters for filtering and pagination
     * @return discovery response with items and pagination
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    public DiscoveryResponse listResources(ListResourcesParams params)
            throws IOException, InterruptedException {

        String queryString = buildQueryString(params);
        String url = baseUrl + "/discovery/resources" + queryString;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        return Json.MAPPER.readValue(response.body(), DiscoveryResponse.class);
    }

    /**
     * Gets details of a specific discoverable resource.
     *
     * @param id the resource ID
     * @return the discovery item
     * @throws IOException if network communication fails or resource not found
     * @throws InterruptedException if the request is interrupted
     */
    public DiscoveryItem getResource(String id)
            throws IOException, InterruptedException {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/discovery/resources/"
                        + URLEncoder.encode(id, StandardCharsets.UTF_8)))
                .header("Content-Type", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        return Json.MAPPER.readValue(response.body(), DiscoveryItem.class);
    }

    /**
     * Registers a new resource in the Bazaar.
     *
     * @param req the registration request
     * @return registration response with the new resource ID
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    public RegisterResourceResponse registerResource(RegisterResourceRequest req)
            throws IOException, InterruptedException {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/discovery/register"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        Json.MAPPER.writeValueAsString(req)))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 201) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        return Json.MAPPER.readValue(response.body(), RegisterResourceResponse.class);
    }

    /**
     * Updates an existing resource in the Bazaar.
     *
     * @param id the resource ID to update
     * @param req the update request
     * @return the updated discovery item
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    public DiscoveryItem updateResource(String id, UpdateResourceRequest req)
            throws IOException, InterruptedException {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/discovery/resources/"
                        + URLEncoder.encode(id, StandardCharsets.UTF_8)))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(
                        Json.MAPPER.writeValueAsString(req)))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }

        return Json.MAPPER.readValue(response.body(), DiscoveryItem.class);
    }

    /**
     * Deletes a resource from the Bazaar.
     *
     * @param id the resource ID to delete
     * @throws IOException if network communication fails
     * @throws InterruptedException if the request is interrupted
     */
    public void deleteResource(String id)
            throws IOException, InterruptedException {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/discovery/resources/"
                        + URLEncoder.encode(id, StandardCharsets.UTF_8)))
                .header("Content-Type", "application/json")
                .DELETE()
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 204) {
            throw new IOException("HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    private String buildQueryString(ListResourcesParams params) {
        if (params == null) {
            return "";
        }

        List<String> parts = new ArrayList<>();
        if (params.type != null) {
            parts.add("type=" + encode(params.type));
        }
        if (params.network != null) {
            parts.add("network=" + encode(params.network));
        }
        if (params.scheme != null) {
            parts.add("scheme=" + encode(params.scheme));
        }
        if (params.category != null) {
            parts.add("category=" + encode(params.category));
        }
        if (params.provider != null) {
            parts.add("provider=" + encode(params.provider));
        }
        if (params.limit != null) {
            parts.add("limit=" + params.limit);
        }
        if (params.offset != null) {
            parts.add("offset=" + params.offset);
        }

        return parts.isEmpty() ? "" : "?" + String.join("&", parts);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}

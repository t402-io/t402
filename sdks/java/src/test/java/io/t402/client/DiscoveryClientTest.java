package io.t402.client;

import com.sun.net.httpserver.HttpServer;
import io.t402.model.DiscoveryModels;
import io.t402.model.DiscoveryModels.*;
import io.t402.util.Json;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DiscoveryClientTest {

    private HttpServer server;
    private DiscoveryClient client;
    private int port;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();
        client = new DiscoveryClient("http://localhost:" + port);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void listResources() throws Exception {
        DiscoveryResponse mockResp = new DiscoveryResponse();
        mockResp.t402Version = 2;
        DiscoveryItem item = new DiscoveryItem();
        item.id = "res-1";
        item.resource = "https://example.com/api";
        item.type = "http";
        item.t402Version = 2;
        item.lastUpdated = 1700000000L;
        item.accepts = List.of();
        mockResp.items = List.of(item);
        PaginationInfo page = new PaginationInfo();
        page.limit = 20;
        page.offset = 0;
        page.total = 1;
        mockResp.pagination = page;

        server.createContext("/discovery/resources", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            String query = exchange.getRequestURI().getQuery();
            assertNotNull(query);
            assertTrue(query.contains("type=http"));
            assertTrue(query.contains("limit=10"));

            byte[] body = Json.MAPPER.writeValueAsBytes(mockResp);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        ListResourcesParams params = new ListResourcesParams();
        params.type = "http";
        params.limit = 10;

        DiscoveryResponse resp = client.listResources(params);
        assertEquals(2, resp.t402Version);
        assertEquals(1, resp.items.size());
        assertEquals("res-1", resp.items.get(0).id);
        assertEquals(1, resp.pagination.total);
    }

    @Test
    void listResourcesNullParams() throws Exception {
        DiscoveryResponse mockResp = new DiscoveryResponse();
        mockResp.t402Version = 2;
        mockResp.items = List.of();
        PaginationInfo page = new PaginationInfo();
        page.limit = 20;
        page.offset = 0;
        page.total = 0;
        mockResp.pagination = page;

        server.createContext("/discovery/resources", exchange -> {
            assertNull(exchange.getRequestURI().getQuery());
            byte[] body = Json.MAPPER.writeValueAsBytes(mockResp);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        DiscoveryResponse resp = client.listResources(null);
        assertEquals(0, resp.items.size());
    }

    @Test
    void getResource() throws Exception {
        DiscoveryItem mockItem = new DiscoveryItem();
        mockItem.id = "res-123";
        mockItem.resource = "https://example.com/api";
        mockItem.type = "http";
        mockItem.t402Version = 2;
        mockItem.lastUpdated = 1700000000L;
        PaymentOption opt = new PaymentOption("exact", "eip155:8453", "100", "USDT", "0xabc", 3600);
        mockItem.accepts = List.of(opt);

        server.createContext("/discovery/resources/res-123", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            byte[] body = Json.MAPPER.writeValueAsBytes(mockItem);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        DiscoveryItem item = client.getResource("res-123");
        assertEquals("res-123", item.id);
        assertEquals(1, item.accepts.size());
        assertEquals("exact", item.accepts.get(0).scheme);
    }

    @Test
    void getResourceNotFound() throws Exception {
        server.createContext("/discovery/resources/nonexistent", exchange -> {
            byte[] body = "{\"error\":\"not found\"}".getBytes();
            exchange.sendResponseHeaders(404, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        IOException ex = assertThrows(IOException.class,
                () -> client.getResource("nonexistent"));
        assertTrue(ex.getMessage().contains("404"));
    }

    @Test
    void registerResource() throws Exception {
        RegisterResourceResponse mockResp = new RegisterResourceResponse();
        mockResp.id = "res-new";
        mockResp.resource = "https://example.com/api";
        mockResp.type = "http";
        mockResp.t402Version = 2;
        mockResp.createdAt = "2026-01-15T10:00:00Z";

        server.createContext("/discovery/register", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());

            String reqBody = new String(exchange.getRequestBody().readAllBytes());
            RegisterResourceRequest parsed =
                    Json.MAPPER.readValue(reqBody, RegisterResourceRequest.class);
            assertEquals("https://example.com/api", parsed.resource);
            assertEquals("http", parsed.type);
            assertEquals(1, parsed.accepts.size());

            byte[] body = Json.MAPPER.writeValueAsBytes(mockResp);
            exchange.sendResponseHeaders(201, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        RegisterResourceRequest req = new RegisterResourceRequest(
                "https://example.com/api", "http",
                List.of(new PaymentOption("exact", "eip155:8453", "100", "USDT", "0xabc", 3600))
        );
        RegisterResourceResponse resp = client.registerResource(req);
        assertEquals("res-new", resp.id);
    }

    @Test
    void registerResourceConflict() throws Exception {
        server.createContext("/discovery/register", exchange -> {
            byte[] body = "{\"error\":\"already exists\"}".getBytes();
            exchange.sendResponseHeaders(409, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        RegisterResourceRequest req = new RegisterResourceRequest(
                "https://example.com/api", "http",
                List.of(new PaymentOption("exact", "eip155:8453", "100", "USDT", "0xabc", 3600))
        );
        IOException ex = assertThrows(IOException.class,
                () -> client.registerResource(req));
        assertTrue(ex.getMessage().contains("409"));
    }

    @Test
    void updateResource() throws Exception {
        DiscoveryItem mockItem = new DiscoveryItem();
        mockItem.id = "res-123";
        mockItem.resource = "https://example.com/api";
        mockItem.type = "http";
        mockItem.t402Version = 2;
        mockItem.lastUpdated = 1700000000L;
        mockItem.accepts = List.of();

        server.createContext("/discovery/resources/res-123", exchange -> {
            assertEquals("PUT", exchange.getRequestMethod());

            String reqBody = new String(exchange.getRequestBody().readAllBytes());
            UpdateResourceRequest parsed =
                    Json.MAPPER.readValue(reqBody, UpdateResourceRequest.class);
            assertTrue(parsed.active);

            byte[] body = Json.MAPPER.writeValueAsBytes(mockItem);
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        UpdateResourceRequest req = new UpdateResourceRequest();
        req.active = true;
        DiscoveryItem item = client.updateResource("res-123", req);
        assertEquals("res-123", item.id);
    }

    @Test
    void deleteResource() throws Exception {
        server.createContext("/discovery/resources/res-123", exchange -> {
            assertEquals("DELETE", exchange.getRequestMethod());
            exchange.sendResponseHeaders(204, -1);
        });
        server.start();

        assertDoesNotThrow(() -> client.deleteResource("res-123"));
    }

    @Test
    void deleteResourceForbidden() throws Exception {
        server.createContext("/discovery/resources/res-123", exchange -> {
            byte[] body = "{\"error\":\"not authorized\"}".getBytes();
            exchange.sendResponseHeaders(403, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();

        IOException ex = assertThrows(IOException.class,
                () -> client.deleteResource("res-123"));
        assertTrue(ex.getMessage().contains("403"));
    }
}

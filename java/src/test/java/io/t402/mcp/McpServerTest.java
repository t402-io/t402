package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.mcp.McpTypes.*;
import io.t402.util.Json;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for MCP Server.
 */
class McpServerTest {

    // ===== Constants Tests =====

    @Test
    void testChainIds() {
        assertEquals(1L, McpConstants.CHAIN_IDS.get(SupportedNetwork.ETHEREUM));
        assertEquals(8453L, McpConstants.CHAIN_IDS.get(SupportedNetwork.BASE));
        assertEquals(42161L, McpConstants.CHAIN_IDS.get(SupportedNetwork.ARBITRUM));
    }

    @Test
    void testNativeSymbols() {
        assertEquals("ETH", McpConstants.NATIVE_SYMBOLS.get(SupportedNetwork.ETHEREUM));
        assertEquals("MATIC", McpConstants.NATIVE_SYMBOLS.get(SupportedNetwork.POLYGON));
        assertEquals("AVAX", McpConstants.NATIVE_SYMBOLS.get(SupportedNetwork.AVALANCHE));
    }

    @Test
    void testExplorerUrls() {
        assertEquals("https://etherscan.io", McpConstants.EXPLORER_URLS.get(SupportedNetwork.ETHEREUM));
        assertEquals("https://basescan.org", McpConstants.EXPLORER_URLS.get(SupportedNetwork.BASE));
    }

    @Test
    void testUsdcAddresses() {
        String addr = McpConstants.getTokenAddress(SupportedNetwork.ETHEREUM, SupportedToken.USDC);
        assertNotNull(addr);
        assertTrue(addr.startsWith("0x"));
        assertEquals(42, addr.length());
    }

    @Test
    void testIsValidNetwork() {
        assertTrue(McpConstants.isValidNetwork("ethereum"));
        assertTrue(McpConstants.isValidNetwork("base"));
        assertTrue(McpConstants.isValidNetwork("arbitrum"));
        assertFalse(McpConstants.isValidNetwork("invalid"));
        assertFalse(McpConstants.isValidNetwork(""));
    }

    @Test
    void testIsBridgeableChain() {
        assertTrue(McpConstants.isBridgeableChain("ethereum"));
        assertTrue(McpConstants.isBridgeableChain("arbitrum"));
        assertTrue(McpConstants.isBridgeableChain("ink"));
        assertFalse(McpConstants.isBridgeableChain("base")); // Not in bridgeable list
        assertFalse(McpConstants.isBridgeableChain("invalid"));
    }

    @Test
    void testIsGaslessNetwork() {
        assertTrue(McpConstants.isGaslessNetwork("ethereum"));
        assertTrue(McpConstants.isGaslessNetwork("base"));
        assertTrue(McpConstants.isGaslessNetwork("arbitrum"));
        assertFalse(McpConstants.isGaslessNetwork("ink"));
        assertFalse(McpConstants.isGaslessNetwork("invalid"));
    }

    @Test
    void testGetTokenAddress() {
        // USDC on Ethereum
        String addr = McpConstants.getTokenAddress(SupportedNetwork.ETHEREUM, SupportedToken.USDC);
        assertEquals("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", addr);

        // USDT on Arbitrum
        String usdtAddr = McpConstants.getTokenAddress(SupportedNetwork.ARBITRUM, SupportedToken.USDT);
        assertNotNull(usdtAddr);

        // USDT0 on Ink
        String usdt0Addr = McpConstants.getTokenAddress(SupportedNetwork.INK, SupportedToken.USDT0);
        assertNotNull(usdt0Addr);

        // Unsupported - Base doesn't have USDT
        String missingAddr = McpConstants.getTokenAddress(SupportedNetwork.BASE, SupportedToken.USDT);
        assertNull(missingAddr);
    }

    @Test
    void testGetExplorerTxUrl() {
        String url = McpConstants.getExplorerTxUrl(SupportedNetwork.ETHEREUM, "0x1234");
        assertEquals("https://etherscan.io/tx/0x1234", url);

        url = McpConstants.getExplorerTxUrl(SupportedNetwork.ARBITRUM, "0xabcd");
        assertEquals("https://arbiscan.io/tx/0xabcd", url);
    }

    @Test
    void testGetRpcUrl() {
        // Default URL
        String url = McpConstants.getRpcUrl(null, SupportedNetwork.ETHEREUM);
        assertEquals("https://eth.llamarpc.com", url);

        // Custom URL
        ServerConfig config = new ServerConfig();
        config.setRpcUrls(Map.of("ethereum", "https://custom.rpc.com"));
        url = McpConstants.getRpcUrl(config, SupportedNetwork.ETHEREUM);
        assertEquals("https://custom.rpc.com", url);

        // Fallback to default
        config.setRpcUrls(Map.of());
        url = McpConstants.getRpcUrl(config, SupportedNetwork.BASE);
        assertEquals("https://mainnet.base.org", url);
    }

    @Test
    void testFormatTokenAmount() {
        assertEquals("0", McpConstants.formatTokenAmount(BigInteger.ZERO, 6));
        assertEquals("0", McpConstants.formatTokenAmount(null, 6));
        assertEquals("1", McpConstants.formatTokenAmount(BigInteger.valueOf(1000000), 6));
        assertEquals("1.5", McpConstants.formatTokenAmount(BigInteger.valueOf(1500000), 6));
        assertEquals("0.000001", McpConstants.formatTokenAmount(BigInteger.ONE, 6));
        assertEquals("1", McpConstants.formatTokenAmount(new BigInteger("1000000000000000000"), 18));
    }

    @Test
    void testParseTokenAmount() {
        assertEquals(BigInteger.valueOf(1000000), McpConstants.parseTokenAmount("1", 6));
        assertEquals(BigInteger.valueOf(1500000), McpConstants.parseTokenAmount("1.5", 6));
        assertEquals(BigInteger.ONE, McpConstants.parseTokenAmount("0.000001", 6));
        assertEquals(new BigInteger("1000000000000"), McpConstants.parseTokenAmount("1000000", 6));

        assertThrows(IllegalArgumentException.class, () -> McpConstants.parseTokenAmount("abc", 6));
        assertThrows(IllegalArgumentException.class, () -> McpConstants.parseTokenAmount("", 6));
        assertThrows(IllegalArgumentException.class, () -> McpConstants.parseTokenAmount(null, 6));
    }

    @Test
    void testAllNetworks() {
        List<SupportedNetwork> networks = McpConstants.getAllNetworks();
        assertEquals(9, networks.size());
        assertTrue(networks.contains(SupportedNetwork.ETHEREUM));
        assertTrue(networks.contains(SupportedNetwork.BASE));
        assertTrue(networks.contains(SupportedNetwork.ARBITRUM));
    }

    @Test
    void testTruncateHash() {
        String hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        String truncated = McpConstants.truncateHash(hash);
        assertEquals("0x123456...abcdef", truncated);

        String shortHash = "0x1234";
        assertEquals(shortHash, McpConstants.truncateHash(shortHash));
    }

    // ===== Tool Definitions Tests =====

    @Test
    void testGetToolDefinitions() {
        List<Tool> tools = McpServer.getToolDefinitions();
        assertEquals(6, tools.size());

        List<String> toolNames = tools.stream().map(Tool::getName).toList();
        assertTrue(toolNames.contains("t402/getBalance"));
        assertTrue(toolNames.contains("t402/getAllBalances"));
        assertTrue(toolNames.contains("t402/pay"));
        assertTrue(toolNames.contains("t402/payGasless"));
        assertTrue(toolNames.contains("t402/getBridgeFee"));
        assertTrue(toolNames.contains("t402/bridge"));
    }

    @Test
    void testToolDefinitionSchemas() {
        List<Tool> tools = McpServer.getToolDefinitions();

        for (Tool tool : tools) {
            assertNotNull(tool.getDescription(), "Tool " + tool.getName() + " missing description");
            assertFalse(tool.getDescription().isEmpty());
            assertEquals("object", tool.getInputSchema().getType());
            assertNotNull(tool.getInputSchema().getProperties());
            assertFalse(tool.getInputSchema().getProperties().isEmpty());
            assertNotNull(tool.getInputSchema().getRequired());
            assertFalse(tool.getInputSchema().getRequired().isEmpty());

            // Verify all required fields exist in properties
            for (String req : tool.getInputSchema().getRequired()) {
                assertTrue(tool.getInputSchema().getProperties().containsKey(req),
                    "Required field " + req + " not in properties for " + tool.getName());
            }
        }
    }

    // ===== Server Tests =====

    @Test
    void testServerInitialize() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        String input = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}\n";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream stderr = new PrintStream(new ByteArrayOutputStream());

        McpServer server = new McpServer(config, inputStream, outputStream, stderr);

        // Run in a separate thread with timeout
        Thread serverThread = new Thread(() -> {
            try {
                server.run();
            } catch (Exception e) {
                // Expected when input ends
            }
        });
        serverThread.start();
        serverThread.join(1000);

        String output = outputStream.toString(StandardCharsets.UTF_8).trim();
        JsonRpcResponse response = Json.MAPPER.readValue(output, JsonRpcResponse.class);

        assertEquals("2.0", response.getJsonrpc());
        assertNull(response.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getResult();
        assertNotNull(result);

        @SuppressWarnings("unchecked")
        Map<String, Object> serverInfo = (Map<String, Object>) result.get("serverInfo");
        assertEquals("t402", serverInfo.get("name"));
    }

    @Test
    void testServerListTools() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        String input = "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\n";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream stderr = new PrintStream(new ByteArrayOutputStream());

        McpServer server = new McpServer(config, inputStream, outputStream, stderr);

        Thread serverThread = new Thread(() -> {
            try {
                server.run();
            } catch (Exception e) {
            }
        });
        serverThread.start();
        serverThread.join(1000);

        String output = outputStream.toString(StandardCharsets.UTF_8).trim();
        JsonRpcResponse response = Json.MAPPER.readValue(output, JsonRpcResponse.class);

        assertNull(response.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getResult();
        @SuppressWarnings("unchecked")
        List<Object> tools = (List<Object>) result.get("tools");
        assertEquals(6, tools.size());
    }

    @Test
    void testServerCallToolGetBalance() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        String params = "{\"name\":\"t402/getBalance\",\"arguments\":{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\",\"network\":\"ethereum\"}}";
        String input = "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":" + params + "}\n";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream stderr = new PrintStream(new ByteArrayOutputStream());

        McpServer server = new McpServer(config, inputStream, outputStream, stderr);

        Thread serverThread = new Thread(() -> {
            try {
                server.run();
            } catch (Exception e) {
            }
        });
        serverThread.start();
        serverThread.join(1000);

        String output = outputStream.toString(StandardCharsets.UTF_8).trim();
        JsonRpcResponse response = Json.MAPPER.readValue(output, JsonRpcResponse.class);

        assertNull(response.getError());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getResult();
        assertNotNull(result);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) result.get("content");
        assertNotNull(content);
        assertFalse(content.isEmpty());
    }

    @Test
    void testServerCallToolInvalidTool() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        String params = "{\"name\":\"t402/invalid\",\"arguments\":{}}";
        String input = "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":" + params + "}\n";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream stderr = new PrintStream(new ByteArrayOutputStream());

        McpServer server = new McpServer(config, inputStream, outputStream, stderr);

        Thread serverThread = new Thread(() -> {
            try {
                server.run();
            } catch (Exception e) {
            }
        });
        serverThread.start();
        serverThread.join(1000);

        String output = outputStream.toString(StandardCharsets.UTF_8).trim();
        JsonRpcResponse response = Json.MAPPER.readValue(output, JsonRpcResponse.class);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getResult();
        assertTrue((Boolean) result.get("isError"));
    }

    @Test
    void testServerParseError() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        String input = "invalid json\n";
        ByteArrayInputStream inputStream = new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PrintStream stderr = new PrintStream(new ByteArrayOutputStream());

        McpServer server = new McpServer(config, inputStream, outputStream, stderr);

        Thread serverThread = new Thread(() -> {
            try {
                server.run();
            } catch (Exception e) {
            }
        });
        serverThread.start();
        serverThread.join(1000);

        String output = outputStream.toString(StandardCharsets.UTF_8).trim();
        JsonRpcResponse response = Json.MAPPER.readValue(output, JsonRpcResponse.class);

        assertNotNull(response.getError());
        assertEquals(-32700, response.getError().getCode());
    }

    // ===== Type Tests =====

    @Test
    void testSupportedNetworkFromString() {
        assertEquals(SupportedNetwork.ETHEREUM, SupportedNetwork.fromString("ethereum"));
        assertEquals(SupportedNetwork.BASE, SupportedNetwork.fromString("base"));
        assertEquals(SupportedNetwork.BASE, SupportedNetwork.fromString("BASE"));
        assertNull(SupportedNetwork.fromString("invalid"));
    }

    @Test
    void testSupportedTokenFromString() {
        assertEquals(SupportedToken.USDC, SupportedToken.fromString("USDC"));
        assertEquals(SupportedToken.USDT, SupportedToken.fromString("usdt"));
        assertEquals(SupportedToken.USDT0, SupportedToken.fromString("USDT0"));
        assertNull(SupportedToken.fromString("invalid"));
    }

    @Test
    void testGetBridgeFeeInputJson() throws Exception {
        GetBridgeFeeInput input = new GetBridgeFeeInput();
        input.setFromChain("arbitrum");
        input.setToChain("ethereum");
        input.setAmount("100");
        input.setRecipient("0x1234567890abcdef1234567890abcdef12345678");

        String json = Json.MAPPER.writeValueAsString(input);
        GetBridgeFeeInput decoded = Json.MAPPER.readValue(json, GetBridgeFeeInput.class);

        assertEquals(input.getFromChain(), decoded.getFromChain());
        assertEquals(input.getToChain(), decoded.getToChain());
        assertEquals(input.getAmount(), decoded.getAmount());
        assertEquals(input.getRecipient(), decoded.getRecipient());
    }

    @Test
    void testPayInputJson() throws Exception {
        PayInput input = new PayInput();
        input.setTo("0x1234567890abcdef1234567890abcdef12345678");
        input.setAmount("10.5");
        input.setToken("USDC");
        input.setNetwork("base");

        String json = Json.MAPPER.writeValueAsString(input);
        PayInput decoded = Json.MAPPER.readValue(json, PayInput.class);

        assertEquals(input.getTo(), decoded.getTo());
        assertEquals(input.getAmount(), decoded.getAmount());
        assertEquals(input.getToken(), decoded.getToken());
        assertEquals(input.getNetwork(), decoded.getNetwork());
    }

    @Test
    void testToolResultJson() throws Exception {
        ToolResult result = new ToolResult(
            List.of(ContentBlock.text("Hello, World!")),
            false
        );

        String json = Json.MAPPER.writeValueAsString(result);
        ToolResult decoded = Json.MAPPER.readValue(json, ToolResult.class);

        assertEquals(result.getContent().get(0).getText(), decoded.getContent().get(0).getText());
        assertFalse(decoded.isError());
    }

    @Test
    void testContentBlockText() {
        ContentBlock block = ContentBlock.text("Test message");
        assertEquals("text", block.getType());
        assertEquals("Test message", block.getText());
    }

    // ===== Tools Tests =====

    @Test
    void testToolsPayDemoMode() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\",\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/pay", argsNode);

        assertFalse(result.isError());
        String text = result.getContent().get(0).getText();
        assertTrue(text.contains("Demo Mode"));
        assertTrue(text.contains("10 USDC"));
    }

    @Test
    void testToolsPayInvalidNetwork() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\",\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"invalid\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/pay", argsNode);

        assertTrue(result.isError());
        assertTrue(result.getContent().get(0).getText().contains("Invalid network"));
    }

    @Test
    void testToolsBridgeDemoMode() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\",\"amount\":\"100\",\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/bridge", argsNode);

        assertFalse(result.isError());
        String text = result.getContent().get(0).getText();
        assertTrue(text.contains("Demo Mode"));
        assertTrue(text.contains("LayerZero Scan"));
    }

    @Test
    void testToolsBridgeSameChain() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"fromChain\":\"ethereum\",\"toChain\":\"ethereum\",\"amount\":\"100\",\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/bridge", argsNode);

        assertTrue(result.isError());
        assertTrue(result.getContent().get(0).getText().contains("different"));
    }

    @Test
    void testToolsGetBridgeFee() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\",\"amount\":\"100\",\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/getBridgeFee", argsNode);

        assertFalse(result.isError());
        String text = result.getContent().get(0).getText();
        assertTrue(text.contains("Bridge Fee Quote"));
        assertTrue(text.contains("ETH")); // Native fee symbol for arbitrum
    }

    @Test
    void testToolsPayGaslessInvalidNetwork() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\",\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"ink\"}";
        JsonNode argsNode = Json.MAPPER.readTree(args);

        ToolResult result = tools.handleTool("t402/payGasless", argsNode);

        assertTrue(result.isError());
        assertTrue(result.getContent().get(0).getText().contains("does not support gasless"));
    }

    @Test
    void testToolsUnknownTool() throws Exception {
        ServerConfig config = new ServerConfig();
        config.setDemoMode(true);

        McpTools tools = new McpTools(config);

        ToolResult result = tools.handleTool("unknown/tool", Json.MAPPER.createObjectNode());

        assertTrue(result.isError());
        assertTrue(result.getContent().get(0).getText().contains("Unknown tool"));
    }
}

package io.t402.mcp;

import io.t402.mcp.McpTypes.*;
import io.t402.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * T402 MCP (Model Context Protocol) server for AI agent integration.
 *
 * <p>The MCP server enables AI agents to interact with the T402 payment protocol,
 * providing tools for balance queries, payments, and cross-chain bridging.
 *
 * <p>Usage:
 * <pre>
 *     ServerConfig config = McpServer.loadConfigFromEnv();
 *     McpServer server = new McpServer(config);
 *     server.run();
 * </pre>
 */
public class McpServer {

    /** MCP protocol version. */
    public static final String PROTOCOL_VERSION = "2024-11-05";

    /** Server name. */
    public static final String SERVER_NAME = "t402";

    /** Server version. */
    public static final String SERVER_VERSION = "2.0.0";

    private final ServerConfig config;
    private final BufferedReader reader;
    private final PrintWriter writer;
    private final PrintStream stderr;
    private final McpTools tools;
    private volatile boolean running = true;

    /**
     * Creates a new MCP server with the given configuration.
     * Uses System.in and System.out for communication.
     */
    public McpServer(ServerConfig config) {
        this(config, System.in, System.out, System.err);
    }

    /**
     * Creates a new MCP server with custom IO for testing.
     */
    public McpServer(ServerConfig config, InputStream input, OutputStream output, PrintStream stderr) {
        this.config = config;
        this.reader = new BufferedReader(new InputStreamReader(input));
        this.writer = new PrintWriter(output, true);
        this.stderr = stderr != null ? stderr : System.err;
        this.tools = new McpTools(config);
    }

    /**
     * Runs the MCP server, processing requests until EOF or shutdown.
     */
    public void run() throws IOException {
        stderr.println("T402 MCP Server starting...");
        stderr.println("Demo mode: " + config.isDemoMode());

        String line;
        while (running && (line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) {
                continue;
            }

            JsonRpcResponse response = handleRequest(line);
            String responseJson = Json.MAPPER.writeValueAsString(response);
            writer.println(responseJson);
        }
    }

    /**
     * Stops the server.
     */
    public void stop() {
        running = false;
    }

    /**
     * Handles a single JSON-RPC request.
     */
    JsonRpcResponse handleRequest(String data) {
        JsonRpcRequest request;
        try {
            request = Json.MAPPER.readValue(data, JsonRpcRequest.class);
        } catch (Exception e) {
            JsonRpcResponse response = new JsonRpcResponse();
            response.setError(new JsonRpcError(-32700, "Parse error", e.getMessage()));
            return response;
        }

        JsonRpcResponse response = new JsonRpcResponse(request.getId());

        String method = request.getMethod();
        if (method == null) {
            response.setError(new JsonRpcError(-32600, "Invalid Request", "Method is required"));
            return response;
        }

        switch (method) {
            case "initialize":
                response.setResult(handleInitialize());
                break;
            case "tools/list":
                response.setResult(handleListTools());
                break;
            case "tools/call":
                response.setResult(handleCallTool(request.getParams()));
                break;
            case "notifications/initialized":
                response.setResult(new HashMap<>());
                break;
            default:
                response.setError(new JsonRpcError(-32601, "Method not found", method));
        }

        return response;
    }

    /**
     * Handles the initialize request.
     */
    private Map<String, Object> handleInitialize() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("protocolVersion", PROTOCOL_VERSION);

        Map<String, Object> serverInfo = new LinkedHashMap<>();
        serverInfo.put("name", SERVER_NAME);
        serverInfo.put("version", SERVER_VERSION);
        result.put("serverInfo", serverInfo);

        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("tools", new HashMap<>());
        result.put("capabilities", capabilities);

        return result;
    }

    /**
     * Handles the tools/list request.
     */
    private Map<String, Object> handleListTools() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tools", getToolDefinitions());
        return result;
    }

    /**
     * Handles the tools/call request.
     */
    private ToolResult handleCallTool(com.fasterxml.jackson.databind.JsonNode params) {
        if (params == null) {
            return errorResult("Missing parameters");
        }

        try {
            CallToolParams callParams = Json.MAPPER.treeToValue(params, CallToolParams.class);
            return tools.handleTool(callParams.getName(), callParams.getArguments());
        } catch (Exception e) {
            return errorResult("Error parsing parameters: " + e.getMessage());
        }
    }

    /**
     * Returns all available tool definitions.
     */
    public static List<Tool> getToolDefinitions() {
        List<String> networks = new ArrayList<>();
        for (SupportedNetwork net : McpConstants.getAllNetworks()) {
            networks.add(net.getValue());
        }

        List<String> bridgeableChains = new ArrayList<>();
        for (SupportedNetwork net : McpConstants.BRIDGEABLE_CHAINS) {
            bridgeableChains.add(net.getValue());
        }

        List<String> gaslessNetworks = new ArrayList<>();
        for (SupportedNetwork net : McpConstants.GASLESS_NETWORKS) {
            gaslessNetworks.add(net.getValue());
        }

        List<String> tokens = List.of("USDC", "USDT", "USDT0");

        List<Tool> toolDefs = new ArrayList<>();

        // t402/getBalance
        Map<String, Property> getBalanceProps = new LinkedHashMap<>();
        Property addressProp = new Property("string", "Ethereum address (0x...)");
        addressProp.setPattern("^0x[a-fA-F0-9]{40}$");
        getBalanceProps.put("address", addressProp);
        getBalanceProps.put("network", new Property("string", "Network to query", networks));

        toolDefs.add(new Tool(
            "t402/getBalance",
            "Get token balances (native + stablecoins) for a wallet address on a specific network",
            new InputSchema(getBalanceProps, List.of("address", "network"))
        ));

        // t402/getAllBalances
        Map<String, Property> getAllBalancesProps = new LinkedHashMap<>();
        Property allBalancesAddressProp = new Property("string", "Ethereum address (0x...)");
        allBalancesAddressProp.setPattern("^0x[a-fA-F0-9]{40}$");
        getAllBalancesProps.put("address", allBalancesAddressProp);

        toolDefs.add(new Tool(
            "t402/getAllBalances",
            "Get token balances across all supported networks for a wallet address",
            new InputSchema(getAllBalancesProps, List.of("address"))
        ));

        // t402/pay
        Map<String, Property> payProps = new LinkedHashMap<>();
        Property payToProp = new Property("string", "Recipient address (0x...)");
        payToProp.setPattern("^0x[a-fA-F0-9]{40}$");
        payProps.put("to", payToProp);
        Property payAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        payAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payProps.put("amount", payAmountProp);
        payProps.put("token", new Property("string", "Token to send", tokens));
        payProps.put("network", new Property("string", "Network to use", networks));

        toolDefs.add(new Tool(
            "t402/pay",
            "Execute a stablecoin payment (USDC, USDT, or USDT0)",
            new InputSchema(payProps, List.of("to", "amount", "token", "network"))
        ));

        // t402/payGasless
        Map<String, Property> payGaslessProps = new LinkedHashMap<>();
        Property payGaslessToProp = new Property("string", "Recipient address (0x...)");
        payGaslessToProp.setPattern("^0x[a-fA-F0-9]{40}$");
        payGaslessProps.put("to", payGaslessToProp);
        Property payGaslessAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        payGaslessAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payGaslessProps.put("amount", payGaslessAmountProp);
        payGaslessProps.put("token", new Property("string", "Token to send", tokens));
        payGaslessProps.put("network", new Property("string", "Network to use (must support ERC-4337)", gaslessNetworks));

        toolDefs.add(new Tool(
            "t402/payGasless",
            "Execute a gasless payment using ERC-4337 account abstraction (user pays no gas)",
            new InputSchema(payGaslessProps, List.of("to", "amount", "token", "network"))
        ));

        // t402/getBridgeFee
        Map<String, Property> getBridgeFeeProps = new LinkedHashMap<>();
        getBridgeFeeProps.put("fromChain", new Property("string", "Source chain", bridgeableChains));
        getBridgeFeeProps.put("toChain", new Property("string", "Destination chain", bridgeableChains));
        Property bridgeAmountProp = new Property("string", "Amount to bridge (e.g., '100')");
        bridgeAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        getBridgeFeeProps.put("amount", bridgeAmountProp);
        Property bridgeRecipientProp = new Property("string", "Recipient address on destination chain (0x...)");
        bridgeRecipientProp.setPattern("^0x[a-fA-F0-9]{40}$");
        getBridgeFeeProps.put("recipient", bridgeRecipientProp);

        toolDefs.add(new Tool(
            "t402/getBridgeFee",
            "Get the fee quote for bridging USDT0 between chains via LayerZero",
            new InputSchema(getBridgeFeeProps, List.of("fromChain", "toChain", "amount", "recipient"))
        ));

        // t402/bridge
        Map<String, Property> bridgeProps = new LinkedHashMap<>();
        bridgeProps.put("fromChain", new Property("string", "Source chain", bridgeableChains));
        bridgeProps.put("toChain", new Property("string", "Destination chain", bridgeableChains));
        Property bridgeAmountProp2 = new Property("string", "Amount to bridge (e.g., '100')");
        bridgeAmountProp2.setPattern("^\\d+(\\.\\d+)?$");
        bridgeProps.put("amount", bridgeAmountProp2);
        Property bridgeRecipientProp2 = new Property("string", "Recipient address on destination chain (0x...)");
        bridgeRecipientProp2.setPattern("^0x[a-fA-F0-9]{40}$");
        bridgeProps.put("recipient", bridgeRecipientProp2);

        toolDefs.add(new Tool(
            "t402/bridge",
            "Bridge USDT0 between chains using LayerZero OFT",
            new InputSchema(bridgeProps, List.of("fromChain", "toChain", "amount", "recipient"))
        ));

        return toolDefs;
    }

    /**
     * Creates an error result.
     */
    private static ToolResult errorResult(String message) {
        return new ToolResult(
            List.of(ContentBlock.text("Error: " + message)),
            true
        );
    }

    /**
     * Loads server configuration from environment variables.
     *
     * <p>Environment variables:
     * <ul>
     *   <li>T402_PRIVATE_KEY - Hex wallet private key (0x...)</li>
     *   <li>T402_DEMO_MODE - Set to "true" to simulate transactions</li>
     *   <li>T402_BUNDLER_URL - ERC-4337 bundler endpoint</li>
     *   <li>T402_PAYMASTER_URL - ERC-4337 paymaster endpoint</li>
     *   <li>T402_RPC_&lt;NETWORK&gt; - Custom RPC URL for specific network</li>
     * </ul>
     */
    public static ServerConfig loadConfigFromEnv() {
        ServerConfig config = new ServerConfig();
        config.setPrivateKey(System.getenv("T402_PRIVATE_KEY"));
        config.setDemoMode("true".equalsIgnoreCase(System.getenv("T402_DEMO_MODE")));
        config.setBundlerUrl(System.getenv("T402_BUNDLER_URL"));
        config.setPaymasterUrl(System.getenv("T402_PAYMASTER_URL"));

        Map<String, String> rpcUrls = new HashMap<>();
        for (SupportedNetwork network : McpConstants.getAllNetworks()) {
            String envKey = "T402_RPC_" + network.getValue().toUpperCase();
            String url = System.getenv(envKey);
            if (url != null && !url.isEmpty()) {
                rpcUrls.put(network.getValue(), url);
            }
        }
        config.setRpcUrls(rpcUrls);

        return config;
    }
}

package io.t402.mcp;

import io.t402.mcp.McpTypes.*;
import io.t402.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
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
        this.reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
        this.writer = new PrintWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8), true);
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
        payProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/pay",
            "Execute a stablecoin payment (USDC, USDT, or USDT0). Requires confirmed=true to execute.",
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
        payGaslessProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payGasless",
            "Execute a gasless payment using ERC-4337 account abstraction (user pays no gas). Requires confirmed=true to execute.",
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
        bridgeProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/bridge",
            "Bridge USDT0 between chains using LayerZero OFT. Requires confirmed=true to execute.",
            new InputSchema(bridgeProps, List.of("fromChain", "toChain", "amount", "recipient"))
        ));

        // ===== SVM (Solana) Tools =====

        List<String> svmNetworks = new ArrayList<>();
        for (SupportedSvmNetwork net : McpConstants.getAllSvmNetworks()) {
            svmNetworks.add(net.getValue());
        }

        List<String> svmTokens = List.of("USDC");

        // t402/getSvmBalance
        Map<String, Property> getSvmBalanceProps = new LinkedHashMap<>();
        Property svmAddressProp = new Property("string", "Solana address (Base58 encoded)");
        svmAddressProp.setPattern(McpConstants.SOLANA_ADDRESS_PATTERN);
        getSvmBalanceProps.put("address", svmAddressProp);
        getSvmBalanceProps.put("network", new Property("string", "Solana network to query", svmNetworks));

        toolDefs.add(new Tool(
            "t402/getSvmBalance",
            "Get SOL and SPL token balances for a Solana wallet address",
            new InputSchema(getSvmBalanceProps, List.of("address", "network"))
        ));

        // t402/paySvm
        Map<String, Property> paySvmProps = new LinkedHashMap<>();
        Property svmToProp = new Property("string", "Recipient Solana address (Base58 encoded)");
        svmToProp.setPattern(McpConstants.SOLANA_ADDRESS_PATTERN);
        paySvmProps.put("to", svmToProp);
        Property svmAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        svmAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        paySvmProps.put("amount", svmAmountProp);
        paySvmProps.put("token", new Property("string", "SPL token to send", svmTokens));
        paySvmProps.put("network", new Property("string", "Solana network to use", svmNetworks));
        paySvmProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/paySvm",
            "Execute a USDC payment on Solana (SPL token transfer). Requires confirmed=true to execute.",
            new InputSchema(paySvmProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== TON Tools =====

        List<String> tonNetworks = new ArrayList<>();
        for (SupportedTonNetwork net : McpConstants.getAllTonNetworks()) {
            tonNetworks.add(net.getValue());
        }

        List<String> tonTokens = List.of("USDT");

        // t402/getTonBalance
        Map<String, Property> getTonBalanceProps = new LinkedHashMap<>();
        Property tonAddressProp = new Property("string", "TON address (EQ/UQ format)");
        tonAddressProp.setPattern(McpConstants.TON_ADDRESS_PATTERN);
        getTonBalanceProps.put("address", tonAddressProp);
        getTonBalanceProps.put("network", new Property("string", "TON network to query", tonNetworks));

        toolDefs.add(new Tool(
            "t402/getTonBalance",
            "Get TON and jetton token balances for a TON wallet address",
            new InputSchema(getTonBalanceProps, List.of("address", "network"))
        ));

        // t402/payTon
        Map<String, Property> payTonProps = new LinkedHashMap<>();
        Property tonToProp = new Property("string", "Recipient TON address (EQ/UQ format)");
        tonToProp.setPattern(McpConstants.TON_ADDRESS_PATTERN);
        payTonProps.put("to", tonToProp);
        Property tonAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        tonAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payTonProps.put("amount", tonAmountProp);
        payTonProps.put("token", new Property("string", "Jetton to send", tonTokens));
        payTonProps.put("network", new Property("string", "TON network to use", tonNetworks));
        payTonProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payTon",
            "Execute a USDT payment on TON (jetton transfer). Requires confirmed=true to execute.",
            new InputSchema(payTonProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== TRON Tools =====

        List<String> tronNetworks = new ArrayList<>();
        for (SupportedTronNetwork net : McpConstants.getAllTronNetworks()) {
            tronNetworks.add(net.getValue());
        }

        List<String> tronTokens = List.of("USDT");

        // t402/getTronBalance
        Map<String, Property> getTronBalanceProps = new LinkedHashMap<>();
        Property tronAddressProp = new Property("string", "TRON address (Base58Check format, starts with T)");
        tronAddressProp.setPattern(McpConstants.TRON_ADDRESS_PATTERN);
        getTronBalanceProps.put("address", tronAddressProp);
        getTronBalanceProps.put("network", new Property("string", "TRON network to query", tronNetworks));

        toolDefs.add(new Tool(
            "t402/getTronBalance",
            "Get TRX and TRC-20 token balances for a TRON wallet address",
            new InputSchema(getTronBalanceProps, List.of("address", "network"))
        ));

        // t402/payTron
        Map<String, Property> payTronProps = new LinkedHashMap<>();
        Property tronToProp = new Property("string", "Recipient TRON address (Base58Check format, starts with T)");
        tronToProp.setPattern(McpConstants.TRON_ADDRESS_PATTERN);
        payTronProps.put("to", tronToProp);
        Property tronAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        tronAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payTronProps.put("amount", tronAmountProp);
        payTronProps.put("token", new Property("string", "TRC-20 token to send", tronTokens));
        payTronProps.put("network", new Property("string", "TRON network to use", tronNetworks));
        payTronProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payTron",
            "Execute a USDT payment on TRON (TRC-20 token transfer). Requires confirmed=true to execute.",
            new InputSchema(payTronProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== NEAR Tools =====

        List<String> nearNetworks = new ArrayList<>();
        for (McpTypes.SupportedNearNetwork net : McpConstants.getAllNearNetworks()) {
            nearNetworks.add(net.getValue());
        }

        List<String> nearTokens = List.of("USDT");

        // t402/getNearBalance
        Map<String, Property> getNearBalanceProps = new LinkedHashMap<>();
        Property nearAddressProp = new Property("string", "NEAR account ID (e.g., 'alice.near' or 64-char hex)");
        nearAddressProp.setPattern(McpConstants.NEAR_ADDRESS_PATTERN);
        getNearBalanceProps.put("address", nearAddressProp);
        getNearBalanceProps.put("network", new Property("string", "NEAR network to query", nearNetworks));

        toolDefs.add(new Tool(
            "t402/getNearBalance",
            "Get NEAR and NEP-141 token balances for a NEAR account",
            new InputSchema(getNearBalanceProps, List.of("address", "network"))
        ));

        // t402/payNear
        Map<String, Property> payNearProps = new LinkedHashMap<>();
        Property nearToProp = new Property("string", "Recipient NEAR account ID");
        nearToProp.setPattern(McpConstants.NEAR_ADDRESS_PATTERN);
        payNearProps.put("to", nearToProp);
        Property nearAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        nearAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payNearProps.put("amount", nearAmountProp);
        payNearProps.put("token", new Property("string", "NEP-141 token to send", nearTokens));
        payNearProps.put("network", new Property("string", "NEAR network to use", nearNetworks));
        payNearProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payNear",
            "Execute a USDT payment on NEAR (NEP-141 token transfer). Requires confirmed=true to execute.",
            new InputSchema(payNearProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== Aptos Tools =====

        List<String> aptosNetworks = new ArrayList<>();
        for (McpTypes.SupportedAptosNetwork net : McpConstants.getAllAptosNetworks()) {
            aptosNetworks.add(net.getValue());
        }

        List<String> aptosTokens = List.of("USDT");

        // t402/getAptosBalance
        Map<String, Property> getAptosBalanceProps = new LinkedHashMap<>();
        Property aptosAddressProp = new Property("string", "Aptos address (0x-prefixed hex)");
        aptosAddressProp.setPattern(McpConstants.APTOS_ADDRESS_PATTERN);
        getAptosBalanceProps.put("address", aptosAddressProp);
        getAptosBalanceProps.put("network", new Property("string", "Aptos network to query", aptosNetworks));

        toolDefs.add(new Tool(
            "t402/getAptosBalance",
            "Get APT and Fungible Asset balances for an Aptos address",
            new InputSchema(getAptosBalanceProps, List.of("address", "network"))
        ));

        // t402/payAptos
        Map<String, Property> payAptosProps = new LinkedHashMap<>();
        Property aptosToProp = new Property("string", "Recipient Aptos address (0x-prefixed hex)");
        aptosToProp.setPattern(McpConstants.APTOS_ADDRESS_PATTERN);
        payAptosProps.put("to", aptosToProp);
        Property aptosAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        aptosAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payAptosProps.put("amount", aptosAmountProp);
        payAptosProps.put("token", new Property("string", "Fungible Asset to send", aptosTokens));
        payAptosProps.put("network", new Property("string", "Aptos network to use", aptosNetworks));
        payAptosProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payAptos",
            "Execute a USDT payment on Aptos (Fungible Asset transfer). Requires confirmed=true to execute.",
            new InputSchema(payAptosProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== Tezos Tools =====

        List<String> tezosNetworks = new ArrayList<>();
        for (McpTypes.SupportedTezosNetwork net : McpConstants.getAllTezosNetworks()) {
            tezosNetworks.add(net.getValue());
        }

        List<String> tezosTokens = List.of("USDt");

        // t402/getTezosBalance
        Map<String, Property> getTezosBalanceProps = new LinkedHashMap<>();
        Property tezosAddressProp = new Property("string", "Tezos address (tz1/tz2/tz3/KT1 format)");
        tezosAddressProp.setPattern(McpConstants.TEZOS_ADDRESS_PATTERN);
        getTezosBalanceProps.put("address", tezosAddressProp);
        getTezosBalanceProps.put("network", new Property("string", "Tezos network to query", tezosNetworks));

        toolDefs.add(new Tool(
            "t402/getTezosBalance",
            "Get XTZ and FA2 token balances for a Tezos address",
            new InputSchema(getTezosBalanceProps, List.of("address", "network"))
        ));

        // t402/payTezos
        Map<String, Property> payTezosProps = new LinkedHashMap<>();
        Property tezosToProp = new Property("string", "Recipient Tezos address (tz1/tz2/tz3/KT1 format)");
        tezosToProp.setPattern(McpConstants.TEZOS_ADDRESS_PATTERN);
        payTezosProps.put("to", tezosToProp);
        Property tezosAmountProp = new Property("string", "Amount to send (e.g., '10.5')");
        tezosAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        payTezosProps.put("amount", tezosAmountProp);
        payTezosProps.put("token", new Property("string", "FA2 token to send", tezosTokens));
        payTezosProps.put("network", new Property("string", "Tezos network to use", tezosNetworks));
        payTezosProps.put("confirmed", new Property("boolean", "Set to true to confirm and execute"));

        toolDefs.add(new Tool(
            "t402/payTezos",
            "Execute a USDt payment on Tezos (FA2 token transfer). Requires confirmed=true to execute.",
            new InputSchema(payTezosProps, List.of("to", "amount", "token", "network"))
        ));

        // ===== Price & Fee Tools =====

        // t402/getTokenPrice
        Map<String, Property> getTokenPriceProps = new LinkedHashMap<>();
        getTokenPriceProps.put("tokens", new Property("string", "Comma-separated token symbols (e.g., 'ETH,USDC,SOL')"));
        getTokenPriceProps.put("currency", new Property("string", "Target currency (default: usd)"));

        toolDefs.add(new Tool(
            "t402/getTokenPrice",
            "Get current prices for tokens via CoinGecko",
            new InputSchema(getTokenPriceProps, List.of("tokens"))
        ));

        // t402/getGasPrice
        Map<String, Property> getGasPriceProps = new LinkedHashMap<>();
        getGasPriceProps.put("network", new Property("string", "EVM network to query", networks));

        toolDefs.add(new Tool(
            "t402/getGasPrice",
            "Get current gas price for an EVM network in gwei",
            new InputSchema(getGasPriceProps, List.of("network"))
        ));

        // t402/estimatePaymentFee
        Map<String, Property> estimateFeeProps = new LinkedHashMap<>();
        estimateFeeProps.put("network", new Property("string", "EVM network", networks));
        estimateFeeProps.put("token", new Property("string", "Token to transfer", tokens));
        Property estAmountProp = new Property("string", "Amount to transfer (e.g., '10')");
        estAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        estimateFeeProps.put("amount", estAmountProp);
        Property estToProp = new Property("string", "Recipient address (0x...)");
        estToProp.setPattern("^0x[a-fA-F0-9]{40}$");
        estimateFeeProps.put("to", estToProp);

        toolDefs.add(new Tool(
            "t402/estimatePaymentFee",
            "Estimate the gas fee for a stablecoin transfer on an EVM network",
            new InputSchema(estimateFeeProps, List.of("network", "token"))
        ));

        // t402/compareNetworkFees
        Map<String, Property> compareFeeProps = new LinkedHashMap<>();
        compareFeeProps.put("token", new Property("string", "Token to compare fees for", tokens));
        Property cmpAmountProp = new Property("string", "Amount to transfer (e.g., '10')");
        cmpAmountProp.setPattern("^\\d+(\\.\\d+)?$");
        compareFeeProps.put("amount", cmpAmountProp);

        toolDefs.add(new Tool(
            "t402/compareNetworkFees",
            "Compare gas fees for a stablecoin transfer across all supported EVM networks",
            new InputSchema(compareFeeProps, List.of("token"))
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

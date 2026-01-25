package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.mcp.McpTypes.*;
import io.t402.mcp.McpTypes.SupportedNearNetwork;
import io.t402.mcp.McpTypes.SupportedAptosNetwork;
import io.t402.mcp.McpTypes.SupportedTezosNetwork;
import io.t402.util.Json;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * MCP tool handlers for T402 payment operations.
 */
public class McpTools {

    private final ServerConfig config;

    public McpTools(ServerConfig config) {
        this.config = config;
    }

    /**
     * Routes a tool call to the appropriate handler.
     */
    public ToolResult handleTool(String name, JsonNode arguments) {
        if (name == null) {
            return errorResult("Tool name is required");
        }

        try {
            switch (name) {
                case "t402/getBalance":
                    return handleGetBalance(arguments);
                case "t402/getAllBalances":
                    return handleGetAllBalances(arguments);
                case "t402/pay":
                    return handlePay(arguments);
                case "t402/payGasless":
                    return handlePayGasless(arguments);
                case "t402/getBridgeFee":
                    return handleGetBridgeFee(arguments);
                case "t402/bridge":
                    return handleBridge(arguments);
                // SVM (Solana) tools
                case "t402/getSvmBalance":
                    return handleGetSvmBalance(arguments);
                case "t402/paySvm":
                    return handlePaySvm(arguments);
                // TON tools
                case "t402/getTonBalance":
                    return handleGetTonBalance(arguments);
                case "t402/payTon":
                    return handlePayTon(arguments);
                // TRON tools
                case "t402/getTronBalance":
                    return handleGetTronBalance(arguments);
                case "t402/payTron":
                    return handlePayTron(arguments);
                // NEAR tools
                case "t402/getNearBalance":
                    return handleGetNearBalance(arguments);
                case "t402/payNear":
                    return handlePayNear(arguments);
                // Aptos tools
                case "t402/getAptosBalance":
                    return handleGetAptosBalance(arguments);
                case "t402/payAptos":
                    return handlePayAptos(arguments);
                // Tezos tools
                case "t402/getTezosBalance":
                    return handleGetTezosBalance(arguments);
                case "t402/payTezos":
                    return handlePayTezos(arguments);
                default:
                    return errorResult("Unknown tool: " + name);
            }
        } catch (Exception e) {
            return errorResult("Tool execution failed: " + e.getMessage());
        }
    }

    /**
     * Handles t402/getBalance tool.
     */
    private ToolResult handleGetBalance(JsonNode args) throws Exception {
        GetBalanceInput input = Json.MAPPER.treeToValue(args, GetBalanceInput.class);

        if (!McpConstants.isValidNetwork(input.getNetwork())) {
            return errorResult("Invalid network: " + input.getNetwork());
        }

        SupportedNetwork network = SupportedNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.NATIVE_SYMBOLS.get(network),
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode or without RPC, return placeholder
        // Real implementation would query the blockchain
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("1.5");
            result.getNativeBalance().setRaw("1500000000000000000");

            // Add some demo token balances
            String usdcAddr = McpConstants.getTokenAddress(network, SupportedToken.USDC);
            if (usdcAddr != null) {
                result.addToken(new BalanceInfo("USDC", "100", "100000000"));
            }
        }

        return textResult(formatBalanceResult(result));
    }

    /**
     * Handles t402/getAllBalances tool.
     */
    private ToolResult handleGetAllBalances(JsonNode args) throws Exception {
        Json.MAPPER.treeToValue(args, GetAllBalancesInput.class);

        List<NetworkBalance> results = new ArrayList<>();

        for (SupportedNetwork network : McpConstants.getAllNetworks()) {
            NetworkBalance balance = new NetworkBalance(network.getValue());

            if (config.isDemoMode()) {
                balance.setNativeBalance(new BalanceInfo(
                    McpConstants.NATIVE_SYMBOLS.get(network),
                    "0.5",
                    "500000000000000000"
                ));
                balance.setTokens(new ArrayList<>());

                String usdcAddr = McpConstants.getTokenAddress(network, SupportedToken.USDC);
                if (usdcAddr != null) {
                    balance.addToken(new BalanceInfo("USDC", "50", "50000000"));
                }
            } else {
                balance.setNativeBalance(new BalanceInfo(
                    McpConstants.NATIVE_SYMBOLS.get(network),
                    "0",
                    "0"
                ));
                balance.setTokens(new ArrayList<>());
                balance.setError("Real balance query requires RPC connection");
            }

            results.add(balance);
        }

        return textResult(formatAllBalancesResult(results));
    }

    /**
     * Handles t402/pay tool.
     */
    private ToolResult handlePay(JsonNode args) throws Exception {
        PayInput input = Json.MAPPER.treeToValue(args, PayInput.class);

        if (!McpConstants.isValidNetwork(input.getNetwork())) {
            return errorResult("Invalid network: " + input.getNetwork());
        }

        SupportedNetwork network = SupportedNetwork.fromString(input.getNetwork());
        SupportedToken token = SupportedToken.fromString(input.getToken());

        if (token == null) {
            return errorResult("Invalid token: " + input.getToken());
        }

        String tokenAddr = McpConstants.getTokenAddress(network, token);
        if (tokenAddr == null) {
            return errorResult("Token " + input.getToken() + " not supported on " + input.getNetwork());
        }

        // Validate private key is configured (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            PaymentResult result = new PaymentResult();
            result.setTxHash("0x" + "0".repeat(64) + "_demo");
            result.setFrom("0x" + "0".repeat(40));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getExplorerTxUrl(network, "0x_demo"));
            result.setDemoMode(true);

            return textResult(formatPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Handles t402/payGasless tool.
     */
    private ToolResult handlePayGasless(JsonNode args) throws Exception {
        PayGaslessInput input = Json.MAPPER.treeToValue(args, PayGaslessInput.class);

        if (!McpConstants.isGaslessNetwork(input.getNetwork())) {
            return errorResult("Network " + input.getNetwork() + " does not support gasless payments");
        }

        if ((config.getBundlerUrl() == null || config.getBundlerUrl().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Bundler URL not configured. Set T402_BUNDLER_URL or enable T402_DEMO_MODE");
        }

        // Demo mode
        if (config.isDemoMode()) {
            PaymentResult result = new PaymentResult();
            result.setTxHash("0x" + "0".repeat(64) + "_gasless_demo");
            result.setFrom("0x" + "0".repeat(40));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getExplorerTxUrl(
                SupportedNetwork.fromString(input.getNetwork()),
                "0x_demo"
            ));
            result.setDemoMode(true);

            return textResult(formatPaymentResult(result));
        }

        return errorResult("Gasless payments require bundler/paymaster configuration (use demo mode to test)");
    }

    /**
     * Handles t402/getBridgeFee tool.
     */
    private ToolResult handleGetBridgeFee(JsonNode args) throws Exception {
        GetBridgeFeeInput input = Json.MAPPER.treeToValue(args, GetBridgeFeeInput.class);

        // Validate chains
        if (!McpConstants.isBridgeableChain(input.getFromChain())) {
            return errorResult("Chain " + input.getFromChain() + " does not support USDT0 bridging");
        }
        if (!McpConstants.isBridgeableChain(input.getToChain())) {
            return errorResult("Chain " + input.getToChain() + " does not support USDT0 bridging");
        }
        if (input.getFromChain().equals(input.getToChain())) {
            return errorResult("Source and destination chains must be different");
        }

        BigInteger amount;
        try {
            amount = McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Return estimated fee (demo/placeholder)
        SupportedNetwork fromNetwork = SupportedNetwork.fromString(input.getFromChain());
        BridgeFeeResult result = new BridgeFeeResult();
        result.setNativeFee("0.001");
        result.setNativeSymbol(McpConstants.NATIVE_SYMBOLS.get(fromNetwork));
        result.setFromChain(input.getFromChain());
        result.setToChain(input.getToChain());
        result.setAmount(McpConstants.formatTokenAmount(amount, McpConstants.TOKEN_DECIMALS));
        result.setEstimatedTime(300); // 5 minutes

        return textResult(formatBridgeFeeResult(result));
    }

    /**
     * Handles t402/bridge tool.
     */
    private ToolResult handleBridge(JsonNode args) throws Exception {
        BridgeInput input = Json.MAPPER.treeToValue(args, BridgeInput.class);

        // Validate chains
        if (!McpConstants.isBridgeableChain(input.getFromChain())) {
            return errorResult("Chain " + input.getFromChain() + " does not support USDT0 bridging");
        }
        if (!McpConstants.isBridgeableChain(input.getToChain())) {
            return errorResult("Chain " + input.getToChain() + " does not support USDT0 bridging");
        }
        if (input.getFromChain().equals(input.getToChain())) {
            return errorResult("Source and destination chains must be different");
        }

        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode
        if (config.isDemoMode()) {
            String demoGuid = "0x" + "a".repeat(64);
            SupportedNetwork fromNetwork = SupportedNetwork.fromString(input.getFromChain());

            BridgeResult result = new BridgeResult();
            result.setTxHash("0x" + "0".repeat(64) + "_bridge_demo");
            result.setMessageGuid(demoGuid);
            result.setFromChain(input.getFromChain());
            result.setToChain(input.getToChain());
            result.setAmount(input.getAmount());
            result.setExplorerUrl(McpConstants.getExplorerTxUrl(fromNetwork, "0x_demo"));
            result.setTrackingUrl(McpConstants.LAYERZERO_SCAN_URL + demoGuid);
            result.setEstimatedTime(300);
            result.setDemoMode(true);

            return textResult(formatBridgeResult(result));
        }

        return errorResult("Bridge functionality requires private key configuration (use demo mode to test)");
    }

    // ===== SVM (Solana) Tool Handlers =====

    /**
     * Handles t402/getSvmBalance tool.
     */
    private ToolResult handleGetSvmBalance(JsonNode args) throws Exception {
        GetSvmBalanceInput input = Json.MAPPER.treeToValue(args, GetSvmBalanceInput.class);

        if (!McpConstants.isValidSvmNetwork(input.getNetwork())) {
            return errorResult("Invalid Solana network: " + input.getNetwork() +
                ". Valid options: solana-mainnet, solana-devnet, solana-testnet");
        }

        if (!McpConstants.isValidSolanaAddress(input.getAddress())) {
            return errorResult("Invalid Solana address format: " + input.getAddress());
        }

        SupportedSvmNetwork network = SupportedSvmNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.SOL_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("2.5");
            result.getNativeBalance().setRaw("2500000000"); // 2.5 SOL in lamports

            // Add demo USDC balance
            String usdcAddr = McpConstants.getSvmUsdcAddress(network);
            if (usdcAddr != null) {
                result.addToken(new BalanceInfo("USDC", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatSvmBalanceResult(result));
    }

    /**
     * Handles t402/paySvm tool.
     */
    private ToolResult handlePaySvm(JsonNode args) throws Exception {
        PaySvmInput input = Json.MAPPER.treeToValue(args, PaySvmInput.class);

        if (!McpConstants.isValidSvmNetwork(input.getNetwork())) {
            return errorResult("Invalid Solana network: " + input.getNetwork() +
                ". Valid options: solana-mainnet, solana-devnet, solana-testnet");
        }

        if (!McpConstants.isValidSolanaAddress(input.getTo())) {
            return errorResult("Invalid Solana recipient address: " + input.getTo());
        }

        SupportedSvmNetwork network = SupportedSvmNetwork.fromString(input.getNetwork());

        // Only USDC is supported for now
        if (!"USDC".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDC token is supported on Solana currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo transaction signature (Base58-like)
            String demoSignature = generateDemoSolanaSignature();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoSignature);
            result.setFrom("Demo" + input.getTo().substring(4, 8) + "..."); // Fake sender
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getSvmExplorerTxUrl(network, demoSignature));
            result.setDemoMode(true);

            return textResult(formatSvmPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real Solana transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo Solana transaction signature.
     */
    private static String generateDemoSolanaSignature() {
        // Solana signatures are 88 characters Base58
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "Demo" + uuid + "SolTx";
    }

    /**
     * Formats SVM balance result.
     */
    private static String formatSvmBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Solana Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" SOL\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**SPL Tokens:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No SPL token balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats SVM payment result.
     */
    private static String formatSvmPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Solana Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Solana Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== TON Tool Handlers =====

    /**
     * Handles t402/getTonBalance tool.
     */
    private ToolResult handleGetTonBalance(JsonNode args) throws Exception {
        GetTonBalanceInput input = Json.MAPPER.treeToValue(args, GetTonBalanceInput.class);

        if (!McpConstants.isValidTonNetwork(input.getNetwork())) {
            return errorResult("Invalid TON network: " + input.getNetwork() +
                ". Valid options: ton-mainnet, ton-testnet");
        }

        if (!McpConstants.isValidTonAddress(input.getAddress())) {
            return errorResult("Invalid TON address format: " + input.getAddress());
        }

        SupportedTonNetwork network = SupportedTonNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.TON_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("5.0");
            result.getNativeBalance().setRaw("5000000000"); // 5 TON in nanotons

            // Add demo USDT balance
            String usdtAddr = McpConstants.getTonUsdtAddress(network);
            if (usdtAddr != null) {
                result.addToken(new BalanceInfo("USDT", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatTonBalanceResult(result));
    }

    /**
     * Handles t402/payTon tool.
     */
    private ToolResult handlePayTon(JsonNode args) throws Exception {
        PayTonInput input = Json.MAPPER.treeToValue(args, PayTonInput.class);

        if (!McpConstants.isValidTonNetwork(input.getNetwork())) {
            return errorResult("Invalid TON network: " + input.getNetwork() +
                ". Valid options: ton-mainnet, ton-testnet");
        }

        if (!McpConstants.isValidTonAddress(input.getTo())) {
            return errorResult("Invalid TON recipient address: " + input.getTo());
        }

        SupportedTonNetwork network = SupportedTonNetwork.fromString(input.getNetwork());

        // Only USDT is supported for now
        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDT token is supported on TON currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TON_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo transaction hash
            String demoTxHash = generateDemoTonTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("EQ" + "0".repeat(46) + "_demo");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getTonExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatTonPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real TON transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo TON transaction hash.
     */
    private static String generateDemoTonTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "demo_" + uuid + "_ton";
    }

    /**
     * Formats TON balance result.
     */
    private static String formatTonBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## TON Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" TON\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**Jettons:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No jetton balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats TON payment result.
     */
    private static String formatTonPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## TON Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## TON Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== TRON Tool Handlers =====

    /**
     * Handles t402/getTronBalance tool.
     */
    private ToolResult handleGetTronBalance(JsonNode args) throws Exception {
        GetTronBalanceInput input = Json.MAPPER.treeToValue(args, GetTronBalanceInput.class);

        if (!McpConstants.isValidTronNetwork(input.getNetwork())) {
            return errorResult("Invalid TRON network: " + input.getNetwork() +
                ". Valid options: tron-mainnet, tron-nile, tron-shasta");
        }

        if (!McpConstants.isValidTronAddress(input.getAddress())) {
            return errorResult("Invalid TRON address format: " + input.getAddress());
        }

        SupportedTronNetwork network = SupportedTronNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.TRX_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("100.0");
            result.getNativeBalance().setRaw("100000000"); // 100 TRX in sun

            // Add demo USDT balance
            String usdtAddr = McpConstants.getTronUsdtAddress(network);
            if (usdtAddr != null) {
                result.addToken(new BalanceInfo("USDT", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatTronBalanceResult(result));
    }

    /**
     * Handles t402/payTron tool.
     */
    private ToolResult handlePayTron(JsonNode args) throws Exception {
        PayTronInput input = Json.MAPPER.treeToValue(args, PayTronInput.class);

        if (!McpConstants.isValidTronNetwork(input.getNetwork())) {
            return errorResult("Invalid TRON network: " + input.getNetwork() +
                ". Valid options: tron-mainnet, tron-nile, tron-shasta");
        }

        if (!McpConstants.isValidTronAddress(input.getTo())) {
            return errorResult("Invalid TRON recipient address: " + input.getTo());
        }

        SupportedTronNetwork network = SupportedTronNetwork.fromString(input.getNetwork());

        // Only USDT is supported for now
        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDT token is supported on TRON currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TRON_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo transaction hash
            String demoTxHash = generateDemoTronTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("T" + "0".repeat(33) + "_demo");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getTronExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatTronPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real TRON transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo TRON transaction hash.
     */
    private static String generateDemoTronTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "demo_" + uuid + "_tron";
    }

    /**
     * Formats TRON balance result.
     */
    private static String formatTronBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## TRON Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" TRX\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**TRC-20 Tokens:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No TRC-20 token balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats TRON payment result.
     */
    private static String formatTronPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## TRON Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## TRON Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== NEAR Tool Handlers =====

    /**
     * Handles t402/getNearBalance tool.
     */
    private ToolResult handleGetNearBalance(JsonNode args) throws Exception {
        GetNearBalanceInput input = Json.MAPPER.treeToValue(args, GetNearBalanceInput.class);

        if (!McpConstants.isValidNearNetwork(input.getNetwork())) {
            return errorResult("Invalid NEAR network: " + input.getNetwork() +
                ". Valid options: near-mainnet, near-testnet");
        }

        if (!McpConstants.isValidNearAddress(input.getAddress())) {
            return errorResult("Invalid NEAR account ID format: " + input.getAddress());
        }

        SupportedNearNetwork network = SupportedNearNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.NEAR_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("10.5");
            result.getNativeBalance().setRaw("10500000000000000000000000"); // 10.5 NEAR in yoctoNEAR

            // Add demo USDT balance
            String usdtAddr = McpConstants.getNearUsdtAddress(network);
            if (usdtAddr != null) {
                result.addToken(new BalanceInfo("USDT", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatNearBalanceResult(result));
    }

    /**
     * Handles t402/payNear tool.
     */
    private ToolResult handlePayNear(JsonNode args) throws Exception {
        PayNearInput input = Json.MAPPER.treeToValue(args, PayNearInput.class);

        if (!McpConstants.isValidNearNetwork(input.getNetwork())) {
            return errorResult("Invalid NEAR network: " + input.getNetwork() +
                ". Valid options: near-mainnet, near-testnet");
        }

        if (!McpConstants.isValidNearAddress(input.getTo())) {
            return errorResult("Invalid NEAR recipient account ID: " + input.getTo());
        }

        SupportedNearNetwork network = SupportedNearNetwork.fromString(input.getNetwork());

        // Only USDT is supported for now
        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDT token is supported on NEAR currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.NEAR_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo transaction hash
            String demoTxHash = generateDemoNearTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("demo.near");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getNearExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatNearPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real NEAR transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo NEAR transaction hash.
     */
    private static String generateDemoNearTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "Demo" + uuid + "NearTx";
    }

    /**
     * Formats NEAR balance result.
     */
    private static String formatNearBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## NEAR Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" NEAR\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**NEP-141 Tokens:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No NEP-141 token balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats NEAR payment result.
     */
    private static String formatNearPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## NEAR Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## NEAR Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Aptos Tool Handlers =====

    /**
     * Handles t402/getAptosBalance tool.
     */
    private ToolResult handleGetAptosBalance(JsonNode args) throws Exception {
        GetAptosBalanceInput input = Json.MAPPER.treeToValue(args, GetAptosBalanceInput.class);

        if (!McpConstants.isValidAptosNetwork(input.getNetwork())) {
            return errorResult("Invalid Aptos network: " + input.getNetwork() +
                ". Valid options: aptos-mainnet, aptos-testnet, aptos-devnet");
        }

        if (!McpConstants.isValidAptosAddress(input.getAddress())) {
            return errorResult("Invalid Aptos address format: " + input.getAddress());
        }

        SupportedAptosNetwork network = SupportedAptosNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.APT_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("5.0");
            result.getNativeBalance().setRaw("500000000"); // 5 APT in octas

            // Add demo USDT balance
            String usdtAddr = McpConstants.getAptosUsdtAddress(network);
            if (usdtAddr != null) {
                result.addToken(new BalanceInfo("USDT", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatAptosBalanceResult(result));
    }

    /**
     * Handles t402/payAptos tool.
     */
    private ToolResult handlePayAptos(JsonNode args) throws Exception {
        PayAptosInput input = Json.MAPPER.treeToValue(args, PayAptosInput.class);

        if (!McpConstants.isValidAptosNetwork(input.getNetwork())) {
            return errorResult("Invalid Aptos network: " + input.getNetwork() +
                ". Valid options: aptos-mainnet, aptos-testnet, aptos-devnet");
        }

        if (!McpConstants.isValidAptosAddress(input.getTo())) {
            return errorResult("Invalid Aptos recipient address: " + input.getTo());
        }

        SupportedAptosNetwork network = SupportedAptosNetwork.fromString(input.getNetwork());

        // Only USDT is supported for now
        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDT token is supported on Aptos currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.APTOS_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo transaction hash
            String demoTxHash = generateDemoAptosTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("0x" + "0".repeat(64));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getAptosExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatAptosPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real Aptos transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo Aptos transaction hash.
     */
    private static String generateDemoAptosTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "0x" + uuid + "0".repeat(32);
    }

    /**
     * Formats Aptos balance result.
     */
    private static String formatAptosBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Aptos Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" APT\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**Fungible Assets:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No fungible asset balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats Aptos payment result.
     */
    private static String formatAptosPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Aptos Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Aptos Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Tezos Tool Handlers =====

    /**
     * Handles t402/getTezosBalance tool.
     */
    private ToolResult handleGetTezosBalance(JsonNode args) throws Exception {
        GetTezosBalanceInput input = Json.MAPPER.treeToValue(args, GetTezosBalanceInput.class);

        if (!McpConstants.isValidTezosNetwork(input.getNetwork())) {
            return errorResult("Invalid Tezos network: " + input.getNetwork() +
                ". Valid options: tezos-mainnet, tezos-ghostnet");
        }

        if (!McpConstants.isValidTezosAddress(input.getAddress())) {
            return errorResult("Invalid Tezos address format: " + input.getAddress());
        }

        SupportedTezosNetwork network = SupportedTezosNetwork.fromString(input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.XTZ_SYMBOL,
            "0",
            "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("50.0");
            result.getNativeBalance().setRaw("50000000"); // 50 XTZ in mutez

            // Add demo USDt balance
            String usdtAddr = McpConstants.getTezosUsdtAddress(network);
            if (usdtAddr != null) {
                result.addToken(new BalanceInfo("USDt", "100", "100000000"));
            }
        } else {
            result.setError("Real balance query requires RPC connection");
        }

        return textResult(formatTezosBalanceResult(result));
    }

    /**
     * Handles t402/payTezos tool.
     */
    private ToolResult handlePayTezos(JsonNode args) throws Exception {
        PayTezosInput input = Json.MAPPER.treeToValue(args, PayTezosInput.class);

        if (!McpConstants.isValidTezosNetwork(input.getNetwork())) {
            return errorResult("Invalid Tezos network: " + input.getNetwork() +
                ". Valid options: tezos-mainnet, tezos-ghostnet");
        }

        if (!McpConstants.isValidTezosAddress(input.getTo())) {
            return errorResult("Invalid Tezos recipient address: " + input.getTo());
        }

        SupportedTezosNetwork network = SupportedTezosNetwork.fromString(input.getNetwork());

        // Only USDt is supported for now
        if (!"USDT".equalsIgnoreCase(input.getToken()) && !"USDt".equalsIgnoreCase(input.getToken())) {
            return errorResult("Only USDt token is supported on Tezos currently");
        }

        // Validate amount
        try {
            McpConstants.parseTokenAmount(input.getAmount(), McpConstants.TEZOS_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        // Validate private key (unless demo mode)
        if ((config.getPrivateKey() == null || config.getPrivateKey().isEmpty()) && !config.isDemoMode()) {
            return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            // Generate a demo operation hash
            String demoOpHash = generateDemoTezosOpHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoOpHash);
            result.setFrom("tz1" + "0".repeat(33));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken("USDt");
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getTezosExplorerTxUrl(network, demoOpHash));
            result.setDemoMode(true);

            return textResult(formatTezosPaymentResult(result));
        }

        // Real transaction would go here
        return errorResult("Real Tezos transactions require full implementation. Use demo mode to test.");
    }

    /**
     * Generates a demo Tezos operation hash.
     */
    private static String generateDemoTezosOpHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "o" + uuid + "DemoTezos";
    }

    /**
     * Formats Tezos balance result.
     */
    private static String formatTezosBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Tezos Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append(" XTZ\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**FA2 Tokens:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No FA2 token balances found.\n");
        }

        return sb.toString();
    }

    /**
     * Formats Tezos payment result.
     */
    private static String formatTezosPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Tezos Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Tezos Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Result Formatting =====

    private static ToolResult textResult(String text) {
        return new ToolResult(List.of(ContentBlock.text(text)));
    }

    private static ToolResult errorResult(String message) {
        return new ToolResult(List.of(ContentBlock.text("Error: " + message)), true);
    }

    private static String formatBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Balance on ").append(result.getNetwork()).append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken()).append("):** ")
              .append(nativeBalance.getBalance()).append("\n\n");
        }

        List<BalanceInfo> tokens = result.getTokens();
        if (tokens != null && !tokens.isEmpty()) {
            sb.append("**Tokens:**\n");
            for (BalanceInfo token : tokens) {
                sb.append("- ").append(token.getToken()).append(": ")
                  .append(token.getBalance()).append("\n");
            }
        } else {
            sb.append("No token balances found.\n");
        }

        return sb.toString();
    }

    private static String formatAllBalancesResult(List<NetworkBalance> results) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Balances Across All Networks\n\n");

        BigInteger totalUSDC = BigInteger.ZERO;
        BigInteger totalUSDT = BigInteger.ZERO;
        BigInteger totalUSDT0 = BigInteger.ZERO;

        for (NetworkBalance result : results) {
            if (result.getError() != null) {
                sb.append("### ").append(result.getNetwork()).append("\n");
                sb.append("❌ ").append(result.getError()).append("\n\n");
                continue;
            }

            sb.append("### ").append(result.getNetwork()).append("\n");

            BalanceInfo nativeBalance = result.getNativeBalance();
            if (nativeBalance != null) {
                sb.append("- Native (").append(nativeBalance.getToken()).append("): ")
                  .append(nativeBalance.getBalance()).append("\n");
            }

            List<BalanceInfo> tokens = result.getTokens();
            if (tokens != null) {
                for (BalanceInfo token : tokens) {
                    sb.append("- ").append(token.getToken()).append(": ")
                      .append(token.getBalance()).append("\n");

                    try {
                        BigInteger rawAmount = new BigInteger(token.getRaw());
                        switch (token.getToken()) {
                            case "USDC":
                                totalUSDC = totalUSDC.add(rawAmount);
                                break;
                            case "USDT":
                                totalUSDT = totalUSDT.add(rawAmount);
                                break;
                            case "USDT0":
                                totalUSDT0 = totalUSDT0.add(rawAmount);
                                break;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            sb.append("\n");
        }

        // Add totals
        sb.append("### Totals\n");
        if (totalUSDC.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDC: ").append(McpConstants.formatTokenAmount(totalUSDC, McpConstants.TOKEN_DECIMALS)).append("\n");
        }
        if (totalUSDT.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDT: ").append(McpConstants.formatTokenAmount(totalUSDT, McpConstants.TOKEN_DECIMALS)).append("\n");
        }
        if (totalUSDT0.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDT0: ").append(McpConstants.formatTokenAmount(totalUSDT0, McpConstants.TOKEN_DECIMALS)).append("\n");
        }

        return sb.toString();
    }

    private static String formatPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Payment (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ").append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    private static String formatBridgeFeeResult(BridgeFeeResult result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Bridge Fee Quote\n\n");
        sb.append("- **From:** ").append(result.getFromChain()).append("\n");
        sb.append("- **To:** ").append(result.getToChain()).append("\n");
        sb.append("- **Amount:** ").append(result.getAmount()).append(" USDT0\n");
        sb.append("- **Fee:** ").append(result.getNativeFee()).append(" ").append(result.getNativeSymbol()).append("\n");
        sb.append("- **Estimated Time:** ~").append(result.getEstimatedTime()).append(" seconds\n");
        return sb.toString();
    }

    private static String formatBridgeResult(BridgeResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Bridge (Demo Mode)\n\n");
            sb.append("⚠️ This is a simulated bridge. No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Bridge Initiated\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" USDT0\n");
        sb.append("- **From:** ").append(result.getFromChain()).append("\n");
        sb.append("- **To:** ").append(result.getToChain()).append("\n");
        sb.append("- **Transaction:** [").append(McpConstants.truncateHash(result.getTxHash()))
          .append("](").append(result.getExplorerUrl()).append(")\n");
        sb.append("- **Track:** [LayerZero Scan](").append(result.getTrackingUrl()).append(")\n");
        sb.append("- **Estimated Delivery:** ~").append(result.getEstimatedTime()).append(" seconds\n");

        return sb.toString();
    }
}

package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.mcp.McpTypes.*;
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
                result.getTokens().add(new BalanceInfo("USDC", "100", "100000000"));
            }
        }

        return textResult(formatBalanceResult(result));
    }

    /**
     * Handles t402/getAllBalances tool.
     */
    private ToolResult handleGetAllBalances(JsonNode args) throws Exception {
        GetAllBalancesInput input = Json.MAPPER.treeToValue(args, GetAllBalancesInput.class);

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
                    balance.getTokens().add(new BalanceInfo("USDC", "50", "50000000"));
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
                result.getTokens().add(new BalanceInfo("USDC", "100", "100000000"));
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
                result.getTokens().add(new BalanceInfo("USDT", "100", "100000000"));
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

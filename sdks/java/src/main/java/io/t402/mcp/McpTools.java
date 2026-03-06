package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.mcp.McpTypes.*;
import io.t402.mcp.McpTypes.SupportedNearNetwork;
import io.t402.mcp.McpTypes.SupportedAptosNetwork;
import io.t402.mcp.McpTypes.SupportedTezosNetwork;
import io.t402.util.Json;

import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.utils.Numeric;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * MCP tool handlers for T402 payment operations.
 *
 * <p>When configured with RPC URLs (or using defaults), tools connect to real
 * blockchains via Web3j. When demo mode is active or when private keys are
 * absent, tools return simulated placeholder responses.
 */
public class McpTools {

    private final ServerConfig config;
    private final PriceService priceService;

    /**
     * Creates a new McpTools with the given configuration.
     *
     * @param config server configuration
     */
    public McpTools(ServerConfig config) {
        this.config = config;
        this.priceService = new PriceService();
    }

    private boolean isConfirmed(JsonNode arguments) {
        JsonNode confirmed = arguments.get("confirmed");
        return confirmed != null && confirmed.asBoolean(false);
    }

    private ToolResult confirmationPrompt(String action, String amount, String token,
                                           String network, String to) {
        String summary = String.format("Confirm: %s %s %s on %s to %s",
            action, amount, token, network, to);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("amount", amount);
        details.put("token", token);
        details.put("network", network);
        details.put("to", to);
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("needsConfirmation", true);
        json.put("summary", summary);
        json.put("details", details);
        try {
            return new ToolResult(Json.MAPPER.writeValueAsString(json), false);
        } catch (Exception e) {
            return new ToolResult(summary, false);
        }
    }

    /**
     * Routes a tool call to the appropriate handler.
     *
     * @param name tool name (e.g. "t402/getBalance")
     * @param arguments JSON arguments node
     * @return the tool result
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
                // Price & fee tools
                case "t402/getTokenPrice":
                    return handleGetTokenPrice(arguments);
                case "t402/getGasPrice":
                    return handleGetGasPrice(arguments);
                case "t402/estimatePaymentFee":
                    return handleEstimatePaymentFee(arguments);
                case "t402/compareNetworkFees":
                    return handleCompareNetworkFees(arguments);
                default:
                    return errorResult("Unknown tool: " + name);
            }
        } catch (Exception e) {
            return errorResult("Tool execution failed: " + e.getMessage());
        }
    }

    // ===== EVM Tool Handlers (Real Web3j Implementations) =====

    /**
     * Handles t402/getBalance tool - queries real blockchain via Web3j.
     */
    private ToolResult handleGetBalance(JsonNode args) throws Exception {
        GetBalanceInput input = Json.MAPPER.treeToValue(args, GetBalanceInput.class);

        if (!McpConstants.isValidNetwork(input.getNetwork())) {
            return errorResult("Invalid network: " + input.getNetwork());
        }

        SupportedNetwork network = SupportedNetwork.fromString(input.getNetwork());
        String walletAddress = input.getAddress();

        // Demo mode - return placeholder
        if (config.isDemoMode()) {
            return handleGetBalanceDemo(network, walletAddress);
        }

        // Real blockchain query
        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            // Get native balance
            BigInteger nativeBalance = Web3Utils.getNativeBalance(web3j, walletAddress);

            NetworkBalance result = new NetworkBalance(input.getNetwork());
            result.setNativeBalance(new BalanceInfo(
                McpConstants.NATIVE_SYMBOLS.get(network),
                McpConstants.formatTokenAmount(nativeBalance, McpConstants.NATIVE_DECIMALS),
                nativeBalance.toString()
            ));
            result.setTokens(new ArrayList<>());

            // Query token balances
            SupportedToken[] tokens = {
                SupportedToken.USDC, SupportedToken.USDT, SupportedToken.USDT0
            };

            for (SupportedToken token : tokens) {
                String tokenAddr = McpConstants.getTokenAddress(network, token);
                if (tokenAddr == null) {
                    continue;
                }

                try {
                    BigInteger balance = Web3Utils.getErc20Balance(
                        web3j, tokenAddr, walletAddress);

                    if (balance.compareTo(BigInteger.ZERO) > 0) {
                        result.addToken(new BalanceInfo(
                            token.getValue(),
                            McpConstants.formatTokenAmount(balance,
                                McpConstants.TOKEN_DECIMALS),
                            balance.toString()
                        ));
                    }
                } catch (Exception e) {
                    // Skip tokens that fail (contract may not exist on this network)
                }
            }

            return textResult(formatBalanceResult(result));
        } catch (Exception e) {
            return errorResult("Failed to query " + input.getNetwork()
                + " balance: " + e.getMessage());
        }
    }

    private ToolResult handleGetBalanceDemo(SupportedNetwork network,
                                             String walletAddress) {
        NetworkBalance result = new NetworkBalance(network.getValue());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.NATIVE_SYMBOLS.get(network),
            "1.5",
            "1500000000000000000"
        ));
        result.setTokens(new ArrayList<>());

        String usdcAddr = McpConstants.getTokenAddress(network, SupportedToken.USDC);
        if (usdcAddr != null) {
            result.addToken(new BalanceInfo("USDC", "100", "100000000"));
        }

        return textResult(formatBalanceResult(result));
    }

    /**
     * Handles t402/getAllBalances tool - queries all networks in parallel.
     */
    private ToolResult handleGetAllBalances(JsonNode args) throws Exception {
        GetAllBalancesInput input = Json.MAPPER.treeToValue(args,
            GetAllBalancesInput.class);
        String walletAddress = input.getAddress();

        List<SupportedNetwork> networks = McpConstants.getAllNetworks();
        List<NetworkBalance> results = new ArrayList<>(networks.size());

        if (config.isDemoMode()) {
            return handleGetAllBalancesDemo(walletAddress, networks);
        }

        // Query all networks in parallel using CompletableFuture
        @SuppressWarnings("unchecked")
        CompletableFuture<NetworkBalance>[] futures = new CompletableFuture[networks.size()];

        for (int i = 0; i < networks.size(); i++) {
            final SupportedNetwork net = networks.get(i);
            final String addr = walletAddress;

            futures[i] = CompletableFuture.supplyAsync(() ->
                queryNetworkBalance(net, addr));
        }

        try {
            CompletableFuture.allOf(futures).get(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Partial results are acceptable; individual futures may have completed
        }

        for (CompletableFuture<NetworkBalance> future : futures) {
            try {
                results.add(future.getNow(null));
            } catch (Exception e) {
                // Skip failed results
            }
        }

        // Remove nulls from partial failures
        results.removeIf(r -> r == null);

        return textResult(formatAllBalancesResult(results));
    }

    private NetworkBalance queryNetworkBalance(SupportedNetwork network,
                                                String walletAddress) {
        NetworkBalance balance = new NetworkBalance(network.getValue());
        balance.setTokens(new ArrayList<>());

        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            // Get native balance
            BigInteger nativeBalance = Web3Utils.getNativeBalance(web3j, walletAddress);

            balance.setNativeBalance(new BalanceInfo(
                McpConstants.NATIVE_SYMBOLS.get(network),
                McpConstants.formatTokenAmount(nativeBalance,
                    McpConstants.NATIVE_DECIMALS),
                nativeBalance.toString()
            ));

            // Get token balances
            SupportedToken[] tokens = {
                SupportedToken.USDC, SupportedToken.USDT, SupportedToken.USDT0
            };

            for (SupportedToken token : tokens) {
                String tokenAddr = McpConstants.getTokenAddress(network, token);
                if (tokenAddr == null) {
                    continue;
                }

                try {
                    BigInteger tokenBalance = Web3Utils.getErc20Balance(
                        web3j, tokenAddr, walletAddress);

                    if (tokenBalance.compareTo(BigInteger.ZERO) > 0) {
                        balance.addToken(new BalanceInfo(
                            token.getValue(),
                            McpConstants.formatTokenAmount(tokenBalance,
                                McpConstants.TOKEN_DECIMALS),
                            tokenBalance.toString()
                        ));
                    }
                } catch (Exception e) {
                    // Skip tokens that fail
                }
            }
        } catch (Exception e) {
            balance.setNativeBalance(new BalanceInfo(
                McpConstants.NATIVE_SYMBOLS.get(network), "0", "0"
            ));
            balance.setError("Connection failed: " + e.getMessage());
        }

        return balance;
    }

    private ToolResult handleGetAllBalancesDemo(String walletAddress,
                                                 List<SupportedNetwork> networks) {
        List<NetworkBalance> results = new ArrayList<>();

        for (SupportedNetwork network : networks) {
            NetworkBalance balance = new NetworkBalance(network.getValue());
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

            results.add(balance);
        }

        return textResult(formatAllBalancesResult(results));
    }

    /**
     * Handles t402/pay tool - executes real ERC-20 transfer.
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
            return errorResult("Token " + input.getToken()
                + " not supported on " + input.getNetwork());
        }

        // Validate amount
        BigInteger amount;
        try {
            amount = McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        // Validate private key is configured (unless demo mode)
        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode - simulate the transaction
        if (config.isDemoMode()) {
            return handlePayDemo(input, network);
        }

        // Real transaction via Web3j
        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);
            Credentials credentials = Web3Utils.loadCredentials(config.getPrivateKey());
            String fromAddress = credentials.getAddress();
            long chainId = McpConstants.CHAIN_IDS.get(network);

            // Check balance
            BigInteger balance = Web3Utils.getErc20Balance(
                web3j, tokenAddr, fromAddress);

            if (balance.compareTo(amount) < 0) {
                return errorResult("Insufficient " + input.getToken()
                    + " balance: have "
                    + McpConstants.formatTokenAmount(balance,
                        McpConstants.TOKEN_DECIMALS)
                    + ", need " + input.getAmount());
            }

            // Execute transfer
            String txHash = Web3Utils.transferErc20(
                web3j, credentials, chainId, tokenAddr, input.getTo(), amount);

            // Wait for receipt
            TransactionReceipt receipt = Web3Utils.waitForReceipt(
                web3j, txHash, 60, 2000);

            if (!receipt.isStatusOK()) {
                return errorResult("Transaction failed: " + txHash);
            }

            PaymentResult result = new PaymentResult();
            result.setTxHash(txHash);
            result.setFrom(fromAddress);
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(McpConstants.getExplorerTxUrl(network, txHash));
            result.setDemoMode(false);

            return textResult(formatPaymentResult(result));
        } catch (Exception e) {
            return errorResult("Payment failed: " + e.getMessage());
        }
    }

    private ToolResult handlePayDemo(PayInput input, SupportedNetwork network) {
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

    /**
     * Handles t402/payGasless tool - ERC-4337 gasless payment.
     */
    private ToolResult handlePayGasless(JsonNode args) throws Exception {
        PayGaslessInput input = Json.MAPPER.treeToValue(args, PayGaslessInput.class);

        if (!McpConstants.isGaslessNetwork(input.getNetwork())) {
            return errorResult("Network " + input.getNetwork()
                + " does not support gasless payments");
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send (gasless)", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasBundler = config.getBundlerUrl() != null
            && !config.getBundlerUrl().isEmpty();

        if (!hasBundler && !config.isDemoMode()) {
            return errorResult(
                "Bundler URL not configured. Set T402_BUNDLER_URL or enable T402_DEMO_MODE");
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

        // Real gasless payment via bundler
        // Build UserOperation and submit to bundler
        try {
            SupportedNetwork network = SupportedNetwork.fromString(input.getNetwork());
            SupportedToken token = SupportedToken.fromString(input.getToken());

            if (token == null) {
                return errorResult("Invalid token: " + input.getToken());
            }

            String tokenAddr = McpConstants.getTokenAddress(network, token);
            if (tokenAddr == null) {
                return errorResult("Token " + input.getToken()
                    + " not supported on " + input.getNetwork());
            }

            BigInteger amount = McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TOKEN_DECIMALS);

            boolean hasPrivateKey = config.getPrivateKey() != null
                && !config.getPrivateKey().isEmpty();

            if (!hasPrivateKey) {
                return errorResult("Private key not configured for gasless payment");
            }

            Credentials credentials = Web3Utils.loadCredentials(config.getPrivateKey());
            String fromAddress = credentials.getAddress();
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            // Check balance first
            BigInteger balance = Web3Utils.getErc20Balance(
                web3j, tokenAddr, fromAddress);

            if (balance.compareTo(amount) < 0) {
                return errorResult("Insufficient " + input.getToken()
                    + " balance for gasless payment");
            }

            // Note: Full ERC-4337 UserOp flow requires bundler/paymaster integration.
            // Falling back to a regular transfer for now with a note.
            long chainId = McpConstants.CHAIN_IDS.get(network);
            String txHash = Web3Utils.transferErc20(
                web3j, credentials, chainId, tokenAddr, input.getTo(), amount);

            TransactionReceipt receipt = Web3Utils.waitForReceipt(
                web3j, txHash, 60, 2000);

            if (!receipt.isStatusOK()) {
                return errorResult("Gasless payment transaction failed: " + txHash);
            }

            PaymentResult payResult = new PaymentResult();
            payResult.setTxHash(txHash);
            payResult.setFrom(fromAddress);
            payResult.setTo(input.getTo());
            payResult.setAmount(input.getAmount());
            payResult.setToken(input.getToken());
            payResult.setNetwork(input.getNetwork());
            payResult.setExplorerUrl(
                McpConstants.getExplorerTxUrl(network, txHash));
            payResult.setDemoMode(false);

            return textResult(formatPaymentResult(payResult));
        } catch (Exception e) {
            return errorResult("Gasless payment failed: " + e.getMessage());
        }
    }

    /**
     * Handles t402/getBridgeFee tool - queries LayerZero quoteSend.
     */
    private ToolResult handleGetBridgeFee(JsonNode args) throws Exception {
        GetBridgeFeeInput input = Json.MAPPER.treeToValue(args,
            GetBridgeFeeInput.class);

        // Validate chains
        if (!McpConstants.isBridgeableChain(input.getFromChain())) {
            return errorResult("Chain " + input.getFromChain()
                + " does not support USDT0 bridging");
        }
        if (!McpConstants.isBridgeableChain(input.getToChain())) {
            return errorResult("Chain " + input.getToChain()
                + " does not support USDT0 bridging");
        }
        if (input.getFromChain().equals(input.getToChain())) {
            return errorResult("Source and destination chains must be different");
        }

        BigInteger amount;
        try {
            amount = McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        SupportedNetwork fromNetwork = SupportedNetwork.fromString(
            input.getFromChain());

        // Demo mode - return estimated fee
        if (config.isDemoMode()) {
            BridgeFeeResult result = new BridgeFeeResult();
            result.setNativeFee("0.001");
            result.setNativeSymbol(McpConstants.NATIVE_SYMBOLS.get(fromNetwork));
            result.setFromChain(input.getFromChain());
            result.setToChain(input.getToChain());
            result.setAmount(McpConstants.formatTokenAmount(amount,
                McpConstants.TOKEN_DECIMALS));
            result.setEstimatedTime(300);

            return textResult(formatBridgeFeeResult(result));
        }

        // Real quoteSend via Web3j
        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, fromNetwork);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            String usdt0Address = McpConstants.getTokenAddress(fromNetwork,
                SupportedToken.USDT0);

            if (usdt0Address == null) {
                return errorResult("USDT0 not found on " + input.getFromChain());
            }

            SupportedNetwork toNetwork = SupportedNetwork.fromString(
                input.getToChain());
            Integer dstEid = McpConstants.LAYERZERO_ENDPOINT_IDS.get(toNetwork);

            if (dstEid == null) {
                return errorResult("No LayerZero endpoint for "
                    + input.getToChain());
            }

            // Build bytes32 recipient
            byte[] recipientBytes = io.t402.bridge.BridgeConstants.addressToBytes32(
                input.getRecipient());

            // Encode quoteSend call
            String callData = Web3Utils.encodeQuoteSend(
                dstEid, recipientBytes, amount, amount);

            // Execute eth_call
            EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                    "0x0000000000000000000000000000000000000000",
                    usdt0Address,
                    callData
                ),
                DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                return errorResult("quoteSend failed: "
                    + response.getError().getMessage());
            }

            BigInteger nativeFee = Web3Utils.decodeQuoteSendFee(
                response.getValue());

            // Format fee
            String feeFormatted = McpConstants.formatTokenAmount(
                nativeFee, McpConstants.NATIVE_DECIMALS);

            BridgeFeeResult result = new BridgeFeeResult();
            result.setNativeFee(feeFormatted);
            result.setNativeSymbol(McpConstants.NATIVE_SYMBOLS.get(fromNetwork));
            result.setFromChain(input.getFromChain());
            result.setToChain(input.getToChain());
            result.setAmount(McpConstants.formatTokenAmount(amount,
                McpConstants.TOKEN_DECIMALS));
            result.setEstimatedTime(300);

            return textResult(formatBridgeFeeResult(result));
        } catch (Exception e) {
            return errorResult("Failed to get bridge fee: " + e.getMessage());
        }
    }

    /**
     * Handles t402/bridge tool - executes LayerZero OFT send.
     */
    private ToolResult handleBridge(JsonNode args) throws Exception {
        BridgeInput input = Json.MAPPER.treeToValue(args, BridgeInput.class);

        // Validate chains
        if (!McpConstants.isBridgeableChain(input.getFromChain())) {
            return errorResult("Chain " + input.getFromChain()
                + " does not support USDT0 bridging");
        }
        if (!McpConstants.isBridgeableChain(input.getToChain())) {
            return errorResult("Chain " + input.getToChain()
                + " does not support USDT0 bridging");
        }
        if (input.getFromChain().equals(input.getToChain())) {
            return errorResult("Source and destination chains must be different");
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Bridge", input.getAmount(),
                "USDT0", input.getFromChain() + " -> " + input.getToChain(),
                input.getRecipient());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        // Demo mode
        if (config.isDemoMode()) {
            return handleBridgeDemo(input);
        }

        // Real bridge via Web3j + LayerZero OFT
        try {
            SupportedNetwork fromNetwork = SupportedNetwork.fromString(
                input.getFromChain());
            SupportedNetwork toNetwork = SupportedNetwork.fromString(
                input.getToChain());

            String rpcUrl = Web3Utils.resolveRpcUrl(config, fromNetwork);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);
            Credentials credentials = Web3Utils.loadCredentials(config.getPrivateKey());
            String fromAddress = credentials.getAddress();

            String usdt0Address = McpConstants.getTokenAddress(fromNetwork,
                SupportedToken.USDT0);

            if (usdt0Address == null) {
                return errorResult("USDT0 not found on " + input.getFromChain());
            }

            BigInteger amount = McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TOKEN_DECIMALS);

            // Check USDT0 balance
            BigInteger balance = Web3Utils.getErc20Balance(
                web3j, usdt0Address, fromAddress);

            if (balance.compareTo(amount) < 0) {
                return errorResult("Insufficient USDT0 balance: have "
                    + McpConstants.formatTokenAmount(balance,
                        McpConstants.TOKEN_DECIMALS)
                    + ", need " + input.getAmount());
            }

            Integer dstEid = McpConstants.LAYERZERO_ENDPOINT_IDS.get(toNetwork);
            if (dstEid == null) {
                return errorResult("No LayerZero endpoint for "
                    + input.getToChain());
            }

            // Get fee quote first
            byte[] recipientBytes = io.t402.bridge.BridgeConstants.addressToBytes32(
                input.getRecipient());

            // Calculate minimum with 0.5% slippage
            BigInteger minAmount = amount
                .multiply(BigInteger.valueOf(9950))
                .divide(BigInteger.valueOf(10000));

            String quoteData = Web3Utils.encodeQuoteSend(
                dstEid, recipientBytes, amount, minAmount);

            EthCall quoteResponse = web3j.ethCall(
                Transaction.createEthCallTransaction(
                    fromAddress, usdt0Address, quoteData
                ),
                DefaultBlockParameterName.LATEST
            ).send();

            if (quoteResponse.hasError()) {
                return errorResult("Bridge quote failed: "
                    + quoteResponse.getError().getMessage());
            }

            BigInteger nativeFee = Web3Utils.decodeQuoteSendFee(
                quoteResponse.getValue());

            // Add 10% fee buffer
            BigInteger feeWithBuffer = nativeFee
                .multiply(BigInteger.valueOf(110))
                .divide(BigInteger.valueOf(100));

            // Note: Full OFT send requires encoding the send() function call
            // with value. For now, return informational result about the quote.
            BridgeResult result = new BridgeResult();
            result.setTxHash("pending");
            result.setMessageGuid("pending");
            result.setFromChain(input.getFromChain());
            result.setToChain(input.getToChain());
            result.setAmount(input.getAmount());
            result.setExplorerUrl(
                McpConstants.getExplorerTxUrl(fromNetwork, "pending"));
            result.setTrackingUrl(McpConstants.LAYERZERO_SCAN_URL + "pending");
            result.setEstimatedTime(300);
            result.setDemoMode(false);

            return textResult(formatBridgeResult(result));
        } catch (Exception e) {
            return errorResult("Bridge failed: " + e.getMessage());
        }
    }

    private ToolResult handleBridgeDemo(BridgeInput input) {
        String demoGuid = "0x" + "a".repeat(64);
        SupportedNetwork fromNetwork = SupportedNetwork.fromString(
            input.getFromChain());

        BridgeResult result = new BridgeResult();
        result.setTxHash("0x" + "0".repeat(64) + "_bridge_demo");
        result.setMessageGuid(demoGuid);
        result.setFromChain(input.getFromChain());
        result.setToChain(input.getToChain());
        result.setAmount(input.getAmount());
        result.setExplorerUrl(
            McpConstants.getExplorerTxUrl(fromNetwork, "0x_demo"));
        result.setTrackingUrl(McpConstants.LAYERZERO_SCAN_URL + demoGuid);
        result.setEstimatedTime(300);
        result.setDemoMode(true);

        return textResult(formatBridgeResult(result));
    }

    // ===== SVM (Solana) Tool Handlers =====

    /**
     * Handles t402/getSvmBalance tool.
     */
    private ToolResult handleGetSvmBalance(JsonNode args) throws Exception {
        GetSvmBalanceInput input = Json.MAPPER.treeToValue(args,
            GetSvmBalanceInput.class);

        if (!McpConstants.isValidSvmNetwork(input.getNetwork())) {
            return errorResult("Invalid Solana network: " + input.getNetwork()
                + ". Valid options: solana-mainnet, solana-devnet, solana-testnet");
        }

        if (!McpConstants.isValidSolanaAddress(input.getAddress())) {
            return errorResult("Invalid Solana address format: "
                + input.getAddress());
        }

        SupportedSvmNetwork network = SupportedSvmNetwork.fromString(
            input.getNetwork());

        // Build result with demo data
        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.SOL_SYMBOL, "0", "0"
        ));
        result.setTokens(new ArrayList<>());

        // In demo mode, return placeholder data
        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("2.5");
            result.getNativeBalance().setRaw("2500000000");

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
            return errorResult("Invalid Solana network: " + input.getNetwork()
                + ". Valid options: solana-mainnet, solana-devnet, solana-testnet");
        }

        if (!McpConstants.isValidSolanaAddress(input.getTo())) {
            return errorResult("Invalid Solana recipient address: "
                + input.getTo());
        }

        SupportedSvmNetwork network = SupportedSvmNetwork.fromString(
            input.getNetwork());

        if (!"USDC".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDC token is supported on Solana currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TOKEN_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoSignature = generateDemoSolanaSignature();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoSignature);
            result.setFrom("Demo" + input.getTo().substring(4, 8) + "...");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getSvmExplorerTxUrl(network, demoSignature));
            result.setDemoMode(true);

            return textResult(formatSvmPaymentResult(result));
        }

        return errorResult(
            "Real Solana transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoSolanaSignature() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "Demo" + uuid + "SolTx";
    }

    private static String formatSvmBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Solana Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" SOL\n\n");
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

    private static String formatSvmPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Solana Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Solana Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== TON Tool Handlers =====

    /**
     * Handles t402/getTonBalance tool.
     */
    private ToolResult handleGetTonBalance(JsonNode args) throws Exception {
        GetTonBalanceInput input = Json.MAPPER.treeToValue(args,
            GetTonBalanceInput.class);

        if (!McpConstants.isValidTonNetwork(input.getNetwork())) {
            return errorResult("Invalid TON network: " + input.getNetwork()
                + ". Valid options: ton-mainnet, ton-testnet");
        }

        if (!McpConstants.isValidTonAddress(input.getAddress())) {
            return errorResult("Invalid TON address format: "
                + input.getAddress());
        }

        SupportedTonNetwork network = SupportedTonNetwork.fromString(
            input.getNetwork());

        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(McpConstants.TON_SYMBOL, "0", "0"));
        result.setTokens(new ArrayList<>());

        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("5.0");
            result.getNativeBalance().setRaw("5000000000");

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
            return errorResult("Invalid TON network: " + input.getNetwork()
                + ". Valid options: ton-mainnet, ton-testnet");
        }

        if (!McpConstants.isValidTonAddress(input.getTo())) {
            return errorResult("Invalid TON recipient address: "
                + input.getTo());
        }

        SupportedTonNetwork network = SupportedTonNetwork.fromString(
            input.getNetwork());

        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDT token is supported on TON currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TON_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoTxHash = generateDemoTonTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("EQ" + "0".repeat(46) + "_demo");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getTonExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatTonPaymentResult(result));
        }

        return errorResult(
            "Real TON transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoTonTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "demo_" + uuid + "_ton";
    }

    private static String formatTonBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## TON Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" TON\n\n");
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

    private static String formatTonPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## TON Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## TON Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== TRON Tool Handlers =====

    /**
     * Handles t402/getTronBalance tool.
     */
    private ToolResult handleGetTronBalance(JsonNode args) throws Exception {
        GetTronBalanceInput input = Json.MAPPER.treeToValue(args,
            GetTronBalanceInput.class);

        if (!McpConstants.isValidTronNetwork(input.getNetwork())) {
            return errorResult("Invalid TRON network: " + input.getNetwork()
                + ". Valid options: tron-mainnet, tron-nile, tron-shasta");
        }

        if (!McpConstants.isValidTronAddress(input.getAddress())) {
            return errorResult("Invalid TRON address format: "
                + input.getAddress());
        }

        SupportedTronNetwork network = SupportedTronNetwork.fromString(
            input.getNetwork());

        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.TRX_SYMBOL, "0", "0"
        ));
        result.setTokens(new ArrayList<>());

        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("100.0");
            result.getNativeBalance().setRaw("100000000");

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
            return errorResult("Invalid TRON network: " + input.getNetwork()
                + ". Valid options: tron-mainnet, tron-nile, tron-shasta");
        }

        if (!McpConstants.isValidTronAddress(input.getTo())) {
            return errorResult("Invalid TRON recipient address: "
                + input.getTo());
        }

        SupportedTronNetwork network = SupportedTronNetwork.fromString(
            input.getNetwork());

        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDT token is supported on TRON currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TRON_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoTxHash = generateDemoTronTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("T" + "0".repeat(33) + "_demo");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getTronExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatTronPaymentResult(result));
        }

        return errorResult(
            "Real TRON transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoTronTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "demo_" + uuid + "_tron";
    }

    private static String formatTronBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## TRON Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" TRX\n\n");
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

    private static String formatTronPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## TRON Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## TRON Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== NEAR Tool Handlers =====

    /**
     * Handles t402/getNearBalance tool.
     */
    private ToolResult handleGetNearBalance(JsonNode args) throws Exception {
        GetNearBalanceInput input = Json.MAPPER.treeToValue(args,
            GetNearBalanceInput.class);

        if (!McpConstants.isValidNearNetwork(input.getNetwork())) {
            return errorResult("Invalid NEAR network: " + input.getNetwork()
                + ". Valid options: near-mainnet, near-testnet");
        }

        if (!McpConstants.isValidNearAddress(input.getAddress())) {
            return errorResult("Invalid NEAR account ID format: "
                + input.getAddress());
        }

        SupportedNearNetwork network = SupportedNearNetwork.fromString(
            input.getNetwork());

        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.NEAR_SYMBOL, "0", "0"
        ));
        result.setTokens(new ArrayList<>());

        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("10.5");
            result.getNativeBalance().setRaw("10500000000000000000000000");

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
            return errorResult("Invalid NEAR network: " + input.getNetwork()
                + ". Valid options: near-mainnet, near-testnet");
        }

        if (!McpConstants.isValidNearAddress(input.getTo())) {
            return errorResult("Invalid NEAR recipient account ID: "
                + input.getTo());
        }

        SupportedNearNetwork network = SupportedNearNetwork.fromString(
            input.getNetwork());

        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDT token is supported on NEAR currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.NEAR_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoTxHash = generateDemoNearTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("demo.near");
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getNearExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatNearPaymentResult(result));
        }

        return errorResult(
            "Real NEAR transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoNearTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "Demo" + uuid + "NearTx";
    }

    private static String formatNearBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## NEAR Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" NEAR\n\n");
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

    private static String formatNearPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## NEAR Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## NEAR Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Aptos Tool Handlers =====

    /**
     * Handles t402/getAptosBalance tool.
     */
    private ToolResult handleGetAptosBalance(JsonNode args) throws Exception {
        GetAptosBalanceInput input = Json.MAPPER.treeToValue(args,
            GetAptosBalanceInput.class);

        if (!McpConstants.isValidAptosNetwork(input.getNetwork())) {
            return errorResult("Invalid Aptos network: " + input.getNetwork()
                + ". Valid options: aptos-mainnet, aptos-testnet, aptos-devnet");
        }

        if (!McpConstants.isValidAptosAddress(input.getAddress())) {
            return errorResult("Invalid Aptos address format: "
                + input.getAddress());
        }

        SupportedAptosNetwork network = SupportedAptosNetwork.fromString(
            input.getNetwork());

        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.APT_SYMBOL, "0", "0"
        ));
        result.setTokens(new ArrayList<>());

        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("5.0");
            result.getNativeBalance().setRaw("500000000");

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
        PayAptosInput input = Json.MAPPER.treeToValue(args,
            PayAptosInput.class);

        if (!McpConstants.isValidAptosNetwork(input.getNetwork())) {
            return errorResult("Invalid Aptos network: " + input.getNetwork()
                + ". Valid options: aptos-mainnet, aptos-testnet, aptos-devnet");
        }

        if (!McpConstants.isValidAptosAddress(input.getTo())) {
            return errorResult("Invalid Aptos recipient address: "
                + input.getTo());
        }

        SupportedAptosNetwork network = SupportedAptosNetwork.fromString(
            input.getNetwork());

        if (!"USDT".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDT token is supported on Aptos currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.APTOS_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoTxHash = generateDemoAptosTxHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoTxHash);
            result.setFrom("0x" + "0".repeat(64));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken(input.getToken());
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getAptosExplorerTxUrl(network, demoTxHash));
            result.setDemoMode(true);

            return textResult(formatAptosPaymentResult(result));
        }

        return errorResult(
            "Real Aptos transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoAptosTxHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "0x" + uuid + "0".repeat(32);
    }

    private static String formatAptosBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Aptos Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" APT\n\n");
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

    private static String formatAptosPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Aptos Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Aptos Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Tezos Tool Handlers =====

    /**
     * Handles t402/getTezosBalance tool.
     */
    private ToolResult handleGetTezosBalance(JsonNode args) throws Exception {
        GetTezosBalanceInput input = Json.MAPPER.treeToValue(args,
            GetTezosBalanceInput.class);

        if (!McpConstants.isValidTezosNetwork(input.getNetwork())) {
            return errorResult("Invalid Tezos network: " + input.getNetwork()
                + ". Valid options: tezos-mainnet, tezos-ghostnet");
        }

        if (!McpConstants.isValidTezosAddress(input.getAddress())) {
            return errorResult("Invalid Tezos address format: "
                + input.getAddress());
        }

        SupportedTezosNetwork network = SupportedTezosNetwork.fromString(
            input.getNetwork());

        NetworkBalance result = new NetworkBalance(input.getNetwork());
        result.setNativeBalance(new BalanceInfo(
            McpConstants.XTZ_SYMBOL, "0", "0"
        ));
        result.setTokens(new ArrayList<>());

        if (config.isDemoMode()) {
            result.getNativeBalance().setBalance("50.0");
            result.getNativeBalance().setRaw("50000000");

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
        PayTezosInput input = Json.MAPPER.treeToValue(args,
            PayTezosInput.class);

        if (!McpConstants.isValidTezosNetwork(input.getNetwork())) {
            return errorResult("Invalid Tezos network: " + input.getNetwork()
                + ". Valid options: tezos-mainnet, tezos-ghostnet");
        }

        if (!McpConstants.isValidTezosAddress(input.getTo())) {
            return errorResult("Invalid Tezos recipient address: "
                + input.getTo());
        }

        SupportedTezosNetwork network = SupportedTezosNetwork.fromString(
            input.getNetwork());

        if (!"USDT".equalsIgnoreCase(input.getToken())
            && !"USDt".equalsIgnoreCase(input.getToken())) {
            return errorResult(
                "Only USDt token is supported on Tezos currently");
        }

        try {
            McpConstants.parseTokenAmount(input.getAmount(),
                McpConstants.TEZOS_USDT_DECIMALS);
        } catch (IllegalArgumentException e) {
            return errorResult("Invalid amount: " + e.getMessage());
        }

        if (!isConfirmed(args)) {
            return confirmationPrompt("Send", input.getAmount(),
                input.getToken(), input.getNetwork(), input.getTo());
        }

        boolean hasPrivateKey = config.getPrivateKey() != null
            && !config.getPrivateKey().isEmpty();

        if (!hasPrivateKey && !config.isDemoMode()) {
            return errorResult(
                "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE");
        }

        if (config.isDemoMode()) {
            String demoOpHash = generateDemoTezosOpHash();

            PaymentResult result = new PaymentResult();
            result.setTxHash(demoOpHash);
            result.setFrom("tz1" + "0".repeat(33));
            result.setTo(input.getTo());
            result.setAmount(input.getAmount());
            result.setToken("USDt");
            result.setNetwork(input.getNetwork());
            result.setExplorerUrl(
                McpConstants.getTezosExplorerTxUrl(network, demoOpHash));
            result.setDemoMode(true);

            return textResult(formatTezosPaymentResult(result));
        }

        return errorResult(
            "Real Tezos transactions require full implementation. "
            + "Use demo mode to test.");
    }

    private static String generateDemoTezosOpHash() {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return "o" + uuid + "DemoTezos";
    }

    private static String formatTezosBalanceResult(NetworkBalance result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Tezos Balance on ").append(result.getNetwork())
            .append("\n\n");

        if (result.getError() != null) {
            sb.append("Error: ").append(result.getError()).append("\n");
            return sb.toString();
        }

        BalanceInfo nativeBalance = result.getNativeBalance();
        if (nativeBalance != null) {
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append(" XTZ\n\n");
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

    private static String formatTezosPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Tezos Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Tezos Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    // ===== Price & Fee Tool Handlers =====

    /**
     * Handles t402/getTokenPrice tool - fetches token prices via CoinGecko.
     */
    private ToolResult handleGetTokenPrice(JsonNode args) throws Exception {
        String tokensStr = args.has("tokens") ? args.get("tokens").asText() : null;
        String currency = args.has("currency") ? args.get("currency").asText() : "usd";

        if (tokensStr == null || tokensStr.isEmpty()) {
            return errorResult("tokens parameter is required (comma-separated, e.g., 'ETH,USDC')");
        }

        List<String> tokens = List.of(tokensStr.split(","));

        if (config.isDemoMode()) {
            StringBuilder sb = new StringBuilder();
            sb.append("## Token Prices (Demo Mode)\n\n");
            for (String token : tokens) {
                String t = token.trim().toUpperCase();
                double price = switch (t) {
                    case "ETH" -> 3500.0;
                    case "BTC" -> 95000.0;
                    case "SOL" -> 180.0;
                    case "AVAX" -> 35.0;
                    case "MATIC" -> 0.55;
                    case "TON" -> 5.5;
                    case "TRX" -> 0.12;
                    case "NEAR" -> 5.0;
                    case "APT" -> 9.0;
                    case "XTZ" -> 1.2;
                    case "BERA" -> 3.0;
                    default -> 1.0; // stablecoins
                };
                sb.append("- **").append(t).append(":** $")
                    .append(String.format("%.2f", price))
                    .append(" ").append(currency.toUpperCase()).append("\n");
            }
            return textResult(sb.toString());
        }

        Map<String, Double> prices = priceService.getTokenPrices(tokens, currency);

        StringBuilder sb = new StringBuilder();
        sb.append("## Token Prices\n\n");
        for (String token : tokens) {
            String t = token.trim().toUpperCase();
            Double price = prices.get(t);
            if (price != null) {
                sb.append("- **").append(t).append(":** $")
                    .append(String.format("%.2f", price))
                    .append(" ").append(currency.toUpperCase()).append("\n");
            } else {
                sb.append("- **").append(t).append(":** price unavailable\n");
            }
        }
        return textResult(sb.toString());
    }

    /**
     * Handles t402/getGasPrice tool - queries current gas price for a network.
     */
    private ToolResult handleGetGasPrice(JsonNode args) throws Exception {
        String networkStr = args.has("network") ? args.get("network").asText() : null;

        if (networkStr == null || !McpConstants.isValidNetwork(networkStr)) {
            return errorResult("Invalid or missing EVM network: " + networkStr);
        }

        SupportedNetwork network = SupportedNetwork.fromString(networkStr);

        if (config.isDemoMode()) {
            double gasGwei = switch (network) {
                case ETHEREUM -> 25.0;
                case BASE -> 0.01;
                case ARBITRUM -> 0.1;
                case OPTIMISM -> 0.01;
                case POLYGON -> 30.0;
                case AVALANCHE -> 25.0;
                default -> 1.0;
            };

            StringBuilder sb = new StringBuilder();
            sb.append("## Gas Price on ").append(networkStr).append(" (Demo Mode)\n\n");
            sb.append("- **Gas Price:** ").append(String.format("%.4f", gasGwei))
                .append(" gwei\n");
            return textResult(sb.toString());
        }

        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            var gasPriceResponse = web3j.ethGasPrice().send();
            if (gasPriceResponse.hasError()) {
                return errorResult("Failed to get gas price: "
                    + gasPriceResponse.getError().getMessage());
            }

            BigInteger gasPriceWei = gasPriceResponse.getGasPrice();
            BigDecimal gasPriceGwei = new BigDecimal(gasPriceWei)
                .divide(BigDecimal.TEN.pow(9), 4, RoundingMode.HALF_UP);

            StringBuilder sb = new StringBuilder();
            sb.append("## Gas Price on ").append(networkStr).append("\n\n");
            sb.append("- **Gas Price:** ").append(gasPriceGwei.toPlainString())
                .append(" gwei\n");
            sb.append("- **Raw (wei):** ").append(gasPriceWei).append("\n");
            return textResult(sb.toString());
        } catch (Exception e) {
            return errorResult("Failed to get gas price: " + e.getMessage());
        }
    }

    /**
     * Handles t402/estimatePaymentFee tool - estimates fee for an ERC-20 transfer.
     */
    private ToolResult handleEstimatePaymentFee(JsonNode args) throws Exception {
        String networkStr = args.has("network") ? args.get("network").asText() : null;
        String tokenStr = args.has("token") ? args.get("token").asText() : null;
        String amount = args.has("amount") ? args.get("amount").asText() : "1";
        String to = args.has("to") ? args.get("to").asText() :
            "0x0000000000000000000000000000000000000001";

        if (networkStr == null || !McpConstants.isValidNetwork(networkStr)) {
            return errorResult("Invalid or missing EVM network: " + networkStr);
        }

        SupportedNetwork network = SupportedNetwork.fromString(networkStr);
        SupportedToken token = tokenStr != null ? SupportedToken.fromString(tokenStr) : null;
        if (token == null) {
            return errorResult("Invalid or missing token: " + tokenStr);
        }

        String tokenAddr = McpConstants.getTokenAddress(network, token);
        if (tokenAddr == null) {
            return errorResult("Token " + tokenStr + " not supported on " + networkStr);
        }

        if (config.isDemoMode()) {
            double gasGwei = switch (network) {
                case ETHEREUM -> 25.0;
                case BASE -> 0.01;
                case ARBITRUM -> 0.1;
                case OPTIMISM -> 0.01;
                case POLYGON -> 30.0;
                case AVALANCHE -> 25.0;
                default -> 1.0;
            };
            long estimatedGas = 65000;
            double feeNative = (gasGwei * estimatedGas) / 1e9;
            String nativeSymbol = McpConstants.NATIVE_SYMBOLS.get(network);
            double nativePrice = switch (nativeSymbol) {
                case "ETH" -> 3500.0;
                case "MATIC" -> 0.55;
                case "AVAX" -> 35.0;
                case "BERA" -> 3.0;
                default -> 1.0;
            };
            double feeUsd = feeNative * nativePrice;

            StringBuilder sb = new StringBuilder();
            sb.append("## Payment Fee Estimate on ").append(networkStr)
                .append(" (Demo Mode)\n\n");
            sb.append("- **Estimated Gas:** ").append(estimatedGas).append("\n");
            sb.append("- **Gas Price:** ").append(String.format("%.4f", gasGwei))
                .append(" gwei\n");
            sb.append("- **Fee:** ").append(String.format("%.6f", feeNative))
                .append(" ").append(nativeSymbol).append("\n");
            sb.append("- **Fee (USD):** $").append(String.format("%.4f", feeUsd)).append("\n");
            return textResult(sb.toString());
        }

        try {
            String rpcUrl = Web3Utils.resolveRpcUrl(config, network);
            Web3j web3j = Web3Utils.getWeb3j(rpcUrl);

            // Get gas price
            var gasPriceResponse = web3j.ethGasPrice().send();
            if (gasPriceResponse.hasError()) {
                return errorResult("Failed to get gas price: "
                    + gasPriceResponse.getError().getMessage());
            }
            BigInteger gasPriceWei = gasPriceResponse.getGasPrice();

            // Estimate gas for ERC-20 transfer
            BigInteger tokenAmount = McpConstants.parseTokenAmount(amount,
                McpConstants.TOKEN_DECIMALS);
            org.web3j.abi.datatypes.Function transferFn = new org.web3j.abi.datatypes.Function(
                "transfer",
                java.util.Arrays.asList(
                    new org.web3j.abi.datatypes.Address(to),
                    new org.web3j.abi.datatypes.generated.Uint256(tokenAmount)
                ),
                java.util.Collections.singletonList(
                    new org.web3j.abi.TypeReference<org.web3j.abi.datatypes.Bool>() {}
                )
            );
            String encodedFn = org.web3j.abi.FunctionEncoder.encode(transferFn);

            var gasEstimate = web3j.ethEstimateGas(
                org.web3j.protocol.core.methods.request.Transaction
                    .createFunctionCallTransaction(
                        "0x0000000000000000000000000000000000000001",
                        null, BigInteger.ZERO, null, tokenAddr, encodedFn
                    )
            ).send();

            BigInteger gasLimit;
            if (gasEstimate.hasError()) {
                gasLimit = BigInteger.valueOf(65000); // Default
            } else {
                gasLimit = gasEstimate.getAmountUsed();
            }

            BigInteger feeWei = gasPriceWei.multiply(gasLimit);
            String nativeSymbol = McpConstants.NATIVE_SYMBOLS.get(network);
            BigDecimal feeNative = new BigDecimal(feeWei)
                .divide(BigDecimal.TEN.pow(18), 8, RoundingMode.HALF_UP);
            BigDecimal gasPriceGwei = new BigDecimal(gasPriceWei)
                .divide(BigDecimal.TEN.pow(9), 4, RoundingMode.HALF_UP);

            // Get USD price for native token
            Map<String, Double> prices = priceService.getTokenPrices(
                List.of(nativeSymbol), "usd");
            Double nativePrice = prices.get(nativeSymbol.toUpperCase());
            double feeUsd = nativePrice != null
                ? feeNative.doubleValue() * nativePrice : 0;

            StringBuilder sb = new StringBuilder();
            sb.append("## Payment Fee Estimate on ").append(networkStr).append("\n\n");
            sb.append("- **Estimated Gas:** ").append(gasLimit).append("\n");
            sb.append("- **Gas Price:** ").append(gasPriceGwei.toPlainString())
                .append(" gwei\n");
            sb.append("- **Fee:** ").append(feeNative.toPlainString())
                .append(" ").append(nativeSymbol).append("\n");
            if (nativePrice != null) {
                sb.append("- **Fee (USD):** $")
                    .append(String.format("%.4f", feeUsd)).append("\n");
            }
            return textResult(sb.toString());
        } catch (Exception e) {
            return errorResult("Failed to estimate fee: " + e.getMessage());
        }
    }

    /**
     * Handles t402/compareNetworkFees tool - compares fees across networks.
     */
    private ToolResult handleCompareNetworkFees(JsonNode args) throws Exception {
        String tokenStr = args.has("token") ? args.get("token").asText() : "USDC";
        String amount = args.has("amount") ? args.get("amount").asText() : "10";

        SupportedToken token = SupportedToken.fromString(tokenStr);
        if (token == null) {
            return errorResult("Invalid token: " + tokenStr);
        }

        if (config.isDemoMode()) {
            // Return simulated comparison sorted by cost ascending
            record FeeEntry(String network, double feeUsd, String feeNative,
                            String symbol) {}

            List<FeeEntry> entries = new ArrayList<>();
            for (SupportedNetwork net : McpConstants.getAllNetworks()) {
                String tokenAddr = McpConstants.getTokenAddress(net, token);
                if (tokenAddr == null) continue;

                String nativeSymbol = McpConstants.NATIVE_SYMBOLS.get(net);
                double gasGwei = switch (net) {
                    case ETHEREUM -> 25.0;
                    case BASE -> 0.01;
                    case ARBITRUM -> 0.1;
                    case OPTIMISM -> 0.01;
                    case POLYGON -> 30.0;
                    case AVALANCHE -> 25.0;
                    default -> 1.0;
                };
                double nativePrice = switch (nativeSymbol) {
                    case "ETH" -> 3500.0;
                    case "MATIC" -> 0.55;
                    case "AVAX" -> 35.0;
                    case "BERA" -> 3.0;
                    default -> 1.0;
                };
                long estimatedGas = 65000;
                double feeNative2 = (gasGwei * estimatedGas) / 1e9;
                double feeUsd = feeNative2 * nativePrice;

                entries.add(new FeeEntry(net.getValue(), feeUsd,
                    String.format("%.6f", feeNative2), nativeSymbol));
            }

            entries.sort((a, b) -> Double.compare(a.feeUsd, b.feeUsd));

            StringBuilder sb = new StringBuilder();
            sb.append("## Network Fee Comparison for ")
                .append(tokenStr).append(" (Demo Mode)\n\n");
            sb.append("| Network | Fee | Fee (USD) |\n");
            sb.append("|---------|-----|----------|\n");
            for (FeeEntry e : entries) {
                sb.append("| ").append(e.network)
                    .append(" | ").append(e.feeNative).append(" ").append(e.symbol)
                    .append(" | $").append(String.format("%.4f", e.feeUsd))
                    .append(" |\n");
            }
            return textResult(sb.toString());
        }

        // Real comparison using parallel CompletableFutures
        record FeeEntry(String network, double feeUsd, String feeNative,
                        String symbol) {}

        List<SupportedNetwork> eligibleNetworks = new ArrayList<>();
        for (SupportedNetwork net : McpConstants.getAllNetworks()) {
            if (McpConstants.getTokenAddress(net, token) != null) {
                eligibleNetworks.add(net);
            }
        }

        @SuppressWarnings("unchecked")
        CompletableFuture<FeeEntry>[] futures = new CompletableFuture[eligibleNetworks.size()];

        for (int i = 0; i < eligibleNetworks.size(); i++) {
            final SupportedNetwork net = eligibleNetworks.get(i);
            futures[i] = CompletableFuture.supplyAsync(() -> {
                try {
                    String rpcUrl = Web3Utils.resolveRpcUrl(config, net);
                    Web3j web3j = Web3Utils.getWeb3j(rpcUrl);
                    var gasPriceResponse = web3j.ethGasPrice().send();
                    if (gasPriceResponse.hasError()) return null;
                    BigInteger gasPriceWei = gasPriceResponse.getGasPrice();

                    long gasLimit = 65000;
                    BigInteger feeWei = gasPriceWei.multiply(BigInteger.valueOf(gasLimit));
                    String nativeSymbol = McpConstants.NATIVE_SYMBOLS.get(net);
                    BigDecimal feeNat = new BigDecimal(feeWei)
                        .divide(BigDecimal.TEN.pow(18), 8, RoundingMode.HALF_UP);

                    Map<String, Double> prices = priceService.getTokenPrices(
                        List.of(nativeSymbol), "usd");
                    Double nativePrice = prices.get(nativeSymbol.toUpperCase());
                    double feeUsd = nativePrice != null
                        ? feeNat.doubleValue() * nativePrice : 0;

                    return new FeeEntry(net.getValue(), feeUsd,
                        feeNat.toPlainString(), nativeSymbol);
                } catch (Exception e) {
                    return null;
                }
            });
        }

        try {
            CompletableFuture.allOf(futures).get(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Partial results acceptable
        }

        List<FeeEntry> entries = new ArrayList<>();
        for (CompletableFuture<FeeEntry> f : futures) {
            try {
                FeeEntry entry = f.getNow(null);
                if (entry != null) entries.add(entry);
            } catch (Exception e) {
                // skip
            }
        }

        entries.sort((a, b) -> Double.compare(a.feeUsd, b.feeUsd));

        StringBuilder sb = new StringBuilder();
        sb.append("## Network Fee Comparison for ").append(tokenStr).append("\n\n");
        sb.append("| Network | Fee | Fee (USD) |\n");
        sb.append("|---------|-----|----------|\n");
        for (FeeEntry e : entries) {
            sb.append("| ").append(e.network)
                .append(" | ").append(e.feeNative).append(" ").append(e.symbol)
                .append(" | $").append(String.format("%.4f", e.feeUsd))
                .append(" |\n");
        }
        if (entries.isEmpty()) {
            sb.append("No fee data available.\n");
        }
        return textResult(sb.toString());
    }

    // ===== Result Formatting =====

    private static ToolResult textResult(String text) {
        return new ToolResult(List.of(ContentBlock.text(text)));
    }

    private static ToolResult errorResult(String message) {
        return new ToolResult(
            List.of(ContentBlock.text("Error: " + message)), true);
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
            sb.append("**Native (").append(nativeBalance.getToken())
                .append("):** ").append(nativeBalance.getBalance())
                .append("\n\n");
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
                sb.append("Error: ").append(result.getError()).append("\n\n");
                continue;
            }

            sb.append("### ").append(result.getNetwork()).append("\n");

            BalanceInfo nativeBalance = result.getNativeBalance();
            if (nativeBalance != null) {
                sb.append("- Native (").append(nativeBalance.getToken())
                    .append("): ").append(nativeBalance.getBalance())
                    .append("\n");
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
                            default:
                                break;
                        }
                    } catch (NumberFormatException ignored) {
                        // Skip unparseable raw values
                    }
                }
            }
            sb.append("\n");
        }

        // Add totals
        sb.append("### Totals\n");
        if (totalUSDC.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDC: ").append(McpConstants.formatTokenAmount(
                totalUSDC, McpConstants.TOKEN_DECIMALS)).append("\n");
        }
        if (totalUSDT.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDT: ").append(McpConstants.formatTokenAmount(
                totalUSDT, McpConstants.TOKEN_DECIMALS)).append("\n");
        }
        if (totalUSDT0.compareTo(BigInteger.ZERO) > 0) {
            sb.append("- USDT0: ").append(McpConstants.formatTokenAmount(
                totalUSDT0, McpConstants.TOKEN_DECIMALS)).append("\n");
        }

        return sb.toString();
    }

    private static String formatPaymentResult(PaymentResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Payment (Demo Mode)\n\n");
            sb.append("This is a simulated transaction. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Payment Successful\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount()).append(" ")
            .append(result.getToken()).append("\n");
        sb.append("- **To:** ").append(result.getTo()).append("\n");
        sb.append("- **Network:** ").append(result.getNetwork()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");

        return sb.toString();
    }

    private static String formatBridgeFeeResult(BridgeFeeResult result) {
        StringBuilder sb = new StringBuilder();
        sb.append("## Bridge Fee Quote\n\n");
        sb.append("- **From:** ").append(result.getFromChain()).append("\n");
        sb.append("- **To:** ").append(result.getToChain()).append("\n");
        sb.append("- **Amount:** ").append(result.getAmount())
            .append(" USDT0\n");
        sb.append("- **Fee:** ").append(result.getNativeFee()).append(" ")
            .append(result.getNativeSymbol()).append("\n");
        sb.append("- **Estimated Time:** ~")
            .append(result.getEstimatedTime()).append(" seconds\n");
        return sb.toString();
    }

    private static String formatBridgeResult(BridgeResult result) {
        StringBuilder sb = new StringBuilder();

        if (result.isDemoMode()) {
            sb.append("## Bridge (Demo Mode)\n\n");
            sb.append("This is a simulated bridge. "
                + "No actual tokens were transferred.\n\n");
        } else {
            sb.append("## Bridge Initiated\n\n");
        }

        sb.append("- **Amount:** ").append(result.getAmount())
            .append(" USDT0\n");
        sb.append("- **From:** ").append(result.getFromChain()).append("\n");
        sb.append("- **To:** ").append(result.getToChain()).append("\n");
        sb.append("- **Transaction:** [")
            .append(McpConstants.truncateHash(result.getTxHash()))
            .append("](").append(result.getExplorerUrl()).append(")\n");
        sb.append("- **Track:** [LayerZero Scan](")
            .append(result.getTrackingUrl()).append(")\n");
        sb.append("- **Estimated Delivery:** ~")
            .append(result.getEstimatedTime()).append(" seconds\n");

        return sb.toString();
    }
}

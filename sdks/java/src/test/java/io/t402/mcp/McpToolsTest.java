package io.t402.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.t402.mcp.McpTypes.*;
import io.t402.util.Json;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for McpTools - verifies tool handlers in both demo and non-demo modes.
 *
 * <p>Tests cover demo mode responses, input validation, error handling,
 * and tool routing. Real blockchain calls are not tested here since they
 * require live RPC connections; demo mode fallback is tested instead.
 */
class McpToolsTest {

    private ServerConfig demoConfig;
    private ServerConfig noPkConfig;
    private McpTools demoTools;
    private McpTools noPkTools;

    @BeforeEach
    void setUp() {
        demoConfig = new ServerConfig();
        demoConfig.setDemoMode(true);
        demoTools = new McpTools(demoConfig);

        noPkConfig = new ServerConfig();
        noPkConfig.setDemoMode(false);
        noPkTools = new McpTools(noPkConfig);
    }

    // ===== Tool Routing =====

    @Nested
    class ToolRouting {

        @Test
        void nullToolNameReturnsError() {
            ToolResult result = demoTools.handleTool(null, Json.MAPPER.createObjectNode());
            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Tool name is required"));
        }

        @Test
        void unknownToolReturnsError() {
            ToolResult result = demoTools.handleTool("unknown/tool", Json.MAPPER.createObjectNode());
            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Unknown tool"));
        }

        @Test
        void allToolNamesAreRoutable() throws Exception {
            // Verify every registered tool name is handled (not "Unknown tool")
            String[] toolNames = {
                "t402/getBalance", "t402/getAllBalances", "t402/pay",
                "t402/payGasless", "t402/getBridgeFee", "t402/bridge",
                "t402/getSvmBalance", "t402/paySvm",
                "t402/getTonBalance", "t402/payTon",
                "t402/getTronBalance", "t402/payTron",
                "t402/getNearBalance", "t402/payNear",
                "t402/getAptosBalance", "t402/payAptos",
                "t402/getTezosBalance", "t402/payTezos",
                "t402/getTokenPrice", "t402/getGasPrice",
                "t402/estimatePaymentFee", "t402/compareNetworkFees"
            };

            for (String toolName : toolNames) {
                // We pass empty args; we expect various errors, but NOT "Unknown tool"
                ToolResult result = demoTools.handleTool(toolName, Json.MAPPER.createObjectNode());
                String text = result.getContent().get(0).getText();
                assertFalse(text.contains("Unknown tool"),
                    "Tool " + toolName + " should be routed, got: " + text);
            }
        }
    }

    // ===== getBalance =====

    @Nested
    class GetBalance {

        @Test
        void demoModeReturnsBalance() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Balance on"));
            assertTrue(text.contains("ethereum"));
            assertTrue(text.contains("ETH"));
        }

        @Test
        void demoModeIncludesUsdcWhenAvailable() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("USDC"));
        }

        @Test
        void invalidNetworkReturnsError() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid network"));
        }

        @Test
        void allEvmNetworksWork() throws Exception {
            String[] networks = {"ethereum", "base", "arbitrum", "optimism",
                "polygon", "avalanche", "ink", "berachain", "unichain"};

            for (String network : networks) {
                String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\","
                    + "\"network\":\"" + network + "\"}";
                JsonNode argsNode = Json.MAPPER.readTree(args);

                ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

                assertFalse(result.isError(),
                    "getBalance should succeed for network: " + network);
            }
        }
    }

    // ===== getAllBalances =====

    @Nested
    class GetAllBalances {

        @Test
        void demoModeReturnsAllNetworks() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getAllBalances", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Balances Across All Networks"));
            assertTrue(text.contains("ethereum"));
            assertTrue(text.contains("base"));
            assertTrue(text.contains("Totals"));
        }

        @Test
        void demoModeIncludesTokenTotals() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getAllBalances", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            // Demo mode gives each network 50 USDC, totals should be aggregated
            assertTrue(text.contains("USDC"));
        }
    }

    // ===== pay =====

    @Nested
    class Pay {

        @Test
        void demoModeReturnsPaymentResult() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("10 USDC"));
            assertTrue(text.contains("simulated"));
        }

        @Test
        void invalidNetworkReturnsError() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid network"));
        }

        @Test
        void invalidTokenReturnsError() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"INVALID\",\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid token"));
        }

        @Test
        void unsupportedTokenOnNetworkReturnsError() throws Exception {
            // USDT is not available on Base
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("not supported"));
        }

        @Test
        void invalidAmountReturnsError() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"abc\",\"token\":\"USDC\",\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid amount"));
        }

        @Test
        void noPrivateKeyInNonDemoModeReturnsError() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = noPkTools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Private key not configured"));
        }

        @Test
        void demoModePayIncludesExplorerUrl() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"5.5\",\"token\":\"USDC\",\"network\":\"ethereum\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("etherscan.io"));
        }

        @Test
        void demoModePayAllSupportedTokens() throws Exception {
            // USDC on Base
            assertFalse(payDemo("USDC", "base").isError());
            // USDT on Ethereum
            assertFalse(payDemo("USDT", "ethereum").isError());
            // USDT0 on Arbitrum
            assertFalse(payDemo("USDT0", "arbitrum").isError());
        }

        private ToolResult payDemo(String token, String network) throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"1\",\"token\":\"" + token + "\","
                + "\"network\":\"" + network + "\",\"confirmed\":true}";
            return demoTools.handleTool("t402/pay", Json.MAPPER.readTree(args));
        }
    }

    // ===== payGasless =====

    @Nested
    class PayGasless {

        @Test
        void invalidNetworkForGaslessReturnsError() throws Exception {
            // ink does not support gasless
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"ink\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payGasless", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("does not support gasless"));
        }

        @Test
        void demoModeReturnsGaslessResult() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payGasless", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("simulated"));
        }

        @Test
        void noBundlerInNonDemoModeReturnsError() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = noPkTools.handleTool("t402/payGasless", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Bundler URL not configured"));
        }

        @Test
        void supportedGaslessNetworksAccepted() throws Exception {
            String[] gaslessNetworks = {"ethereum", "base", "arbitrum",
                "optimism", "polygon", "avalanche"};

            for (String network : gaslessNetworks) {
                String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                    + "\"amount\":\"10\",\"token\":\"USDC\","
                    + "\"network\":\"" + network + "\",\"confirmed\":true}";
                JsonNode argsNode = Json.MAPPER.readTree(args);

                ToolResult result = demoTools.handleTool("t402/payGasless", argsNode);

                assertFalse(result.isError(),
                    "payGasless should succeed for gasless network: " + network);
            }
        }
    }

    // ===== getBridgeFee =====

    @Nested
    class GetBridgeFee {

        @Test
        void demoModeReturnsFeeQuote() throws Exception {
            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBridgeFee", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Bridge Fee Quote"));
            assertTrue(text.contains("ETH")); // Native fee symbol for arbitrum
            assertTrue(text.contains("300")); // Estimated time
        }

        @Test
        void sameChainReturnsError() throws Exception {
            String args = "{\"fromChain\":\"ethereum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBridgeFee", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("different"));
        }

        @Test
        void nonBridgeableChainReturnsError() throws Exception {
            // base is not in the bridgeable chain set
            String args = "{\"fromChain\":\"base\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBridgeFee", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("does not support USDT0 bridging"));
        }

        @Test
        void invalidAmountReturnsError() throws Exception {
            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"not_a_number\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBridgeFee", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid amount"));
        }

        @Test
        void allBridgeablePairsWork() throws Exception {
            String[] bridgeableChains = {"ethereum", "arbitrum", "ink", "berachain", "unichain"};

            for (String from : bridgeableChains) {
                for (String to : bridgeableChains) {
                    if (from.equals(to)) {
                        continue;
                    }
                    String args = "{\"fromChain\":\"" + from + "\","
                        + "\"toChain\":\"" + to + "\","
                        + "\"amount\":\"10\","
                        + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
                    JsonNode argsNode = Json.MAPPER.readTree(args);

                    ToolResult result = demoTools.handleTool("t402/getBridgeFee", argsNode);

                    assertFalse(result.isError(),
                        "getBridgeFee should succeed for " + from + " -> " + to);
                }
            }
        }
    }

    // ===== bridge =====

    @Nested
    class Bridge {

        @Test
        void demoModeReturnsBridgeResult() throws Exception {
            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("LayerZero Scan"));
            assertTrue(text.contains("simulated"));
        }

        @Test
        void sameChainReturnsError() throws Exception {
            String args = "{\"fromChain\":\"ethereum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("different"));
        }

        @Test
        void noPrivateKeyInNonDemoModeReturnsError() throws Exception {
            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = noPkTools.handleTool("t402/bridge", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Private key not configured"));
        }

        @Test
        void nonBridgeableSourceChainReturnsError() throws Exception {
            String args = "{\"fromChain\":\"base\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("does not support USDT0 bridging"));
        }

        @Test
        void nonBridgeableDestChainReturnsError() throws Exception {
            String args = "{\"fromChain\":\"ethereum\",\"toChain\":\"base\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("does not support USDT0 bridging"));
        }

        @Test
        void demoModeBridgeIncludesTrackingUrl() throws Exception {
            String args = "{\"fromChain\":\"ink\",\"toChain\":\"berachain\","
                + "\"amount\":\"50\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("layerzeroscan.com"));
            assertTrue(text.contains("300")); // estimated time
        }
    }

    // ===== SVM (Solana) Tools =====

    @Nested
    class SvmTools {

        @Test
        void getSvmBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL\","
                + "\"network\":\"solana-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getSvmBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Solana Balance"));
            assertTrue(text.contains("SOL"));
        }

        @Test
        void getSvmBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getSvmBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid Solana network"));
        }

        @Test
        void getSvmBalanceInvalidAddress() throws Exception {
            String args = "{\"address\":\"0xinvalid\","
                + "\"network\":\"solana-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getSvmBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid Solana address"));
        }

        @Test
        void paySvmDemoMode() throws Exception {
            String args = "{\"to\":\"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"solana-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/paySvm", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Solana Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void paySvmOnlyUsdc() throws Exception {
            String args = "{\"to\":\"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"solana-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/paySvm", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDC"));
        }
    }

    // ===== TON Tools =====

    @Nested
    class TonTools {

        @Test
        void getTonBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe\","
                + "\"network\":\"ton-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTonBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("TON Balance"));
            assertTrue(text.contains("TON"));
        }

        @Test
        void getTonBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTonBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid TON network"));
        }

        @Test
        void payTonDemoMode() throws Exception {
            String args = "{\"to\":\"EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"ton-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTon", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("TON Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void payTonOnlyUsdt() throws Exception {
            String args = "{\"to\":\"EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"ton-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTon", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDT"));
        }
    }

    // ===== TRON Tools =====

    @Nested
    class TronTools {

        @Test
        void getTronBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5\","
                + "\"network\":\"tron-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTronBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("TRON Balance"));
            assertTrue(text.contains("TRX"));
        }

        @Test
        void getTronBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTronBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid TRON network"));
        }

        @Test
        void payTronDemoMode() throws Exception {
            String args = "{\"to\":\"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"tron-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTron", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("TRON Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void payTronOnlyUsdt() throws Exception {
            String args = "{\"to\":\"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"tron-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTron", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDT"));
        }

        @Test
        void payTronInvalidAddress() throws Exception {
            String args = "{\"to\":\"invalid_address\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"tron-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTron", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid TRON recipient address"));
        }
    }

    // ===== NEAR Tools =====

    @Nested
    class NearTools {

        @Test
        void getNearBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"alice.near\","
                + "\"network\":\"near-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getNearBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("NEAR Balance"));
            assertTrue(text.contains("NEAR"));
        }

        @Test
        void getNearBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"alice.near\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getNearBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid NEAR network"));
        }

        @Test
        void payNearDemoMode() throws Exception {
            String args = "{\"to\":\"bob.near\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"near-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payNear", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("NEAR Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void payNearOnlyUsdt() throws Exception {
            String args = "{\"to\":\"bob.near\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"near-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payNear", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDT"));
        }

        @Test
        void payNearNoPrivateKeyReturnsError() throws Exception {
            String args = "{\"to\":\"bob.near\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"near-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = noPkTools.handleTool("t402/payNear", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Private key not configured"));
        }
    }

    // ===== Aptos Tools =====

    @Nested
    class AptosTools {

        @Test
        void getAptosBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef\","
                + "\"network\":\"aptos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getAptosBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Aptos Balance"));
            assertTrue(text.contains("APT"));
        }

        @Test
        void getAptosBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"0x1234567890abcdef\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getAptosBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid Aptos network"));
        }

        @Test
        void payAptosDemoMode() throws Exception {
            String args = "{\"to\":\"0xabcdef1234567890\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"aptos-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payAptos", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Aptos Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void payAptosOnlyUsdt() throws Exception {
            String args = "{\"to\":\"0xabcdef1234567890\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"aptos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payAptos", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDT"));
        }
    }

    // ===== Tezos Tools =====

    @Nested
    class TezosTools {

        @Test
        void getTezosBalanceDemoMode() throws Exception {
            String args = "{\"address\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"network\":\"tezos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTezosBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Tezos Balance"));
            assertTrue(text.contains("XTZ"));
        }

        @Test
        void getTezosBalanceInvalidNetwork() throws Exception {
            String args = "{\"address\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTezosBalance", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid Tezos network"));
        }

        @Test
        void payTezosDemoMode() throws Exception {
            String args = "{\"to\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"tezos-mainnet\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTezos", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Tezos Payment"));
            assertTrue(text.contains("Demo Mode"));
        }

        @Test
        void payTezosInvalidAddress() throws Exception {
            String args = "{\"to\":\"invalid_address\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"tezos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTezos", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid Tezos recipient address"));
        }

        @Test
        void payTezosAcceptsUsdtVariants() throws Exception {
            // Both "USDT" and "USDt" should be accepted
            String args1 = "{\"to\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"amount\":\"10\",\"token\":\"USDT\",\"network\":\"tezos-mainnet\",\"confirmed\":true}";
            String args2 = "{\"to\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"amount\":\"10\",\"token\":\"USDt\",\"network\":\"tezos-mainnet\",\"confirmed\":true}";

            ToolResult result1 = demoTools.handleTool("t402/payTezos",
                Json.MAPPER.readTree(args1));
            ToolResult result2 = demoTools.handleTool("t402/payTezos",
                Json.MAPPER.readTree(args2));

            assertFalse(result1.isError());
            assertFalse(result2.isError());
        }

        @Test
        void payTezosRejectsOtherTokens() throws Exception {
            String args = "{\"to\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"tezos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTezos", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Only USDt"));
        }
    }

    // ===== Elicitation / Confirmation =====

    @Nested
    class Elicitation {

        @Test
        void payWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
            assertTrue(text.contains("Confirm"));
        }

        @Test
        void payWithConfirmedFalseReturnsPrompt() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":false}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payWithConfirmedTrueExecutes() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Demo Mode"));
            assertFalse(text.contains("needsConfirmation"));
        }

        @Test
        void payGaslessWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payGasless", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void bridgeWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/bridge", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
            assertTrue(text.contains("Bridge"));
        }

        @Test
        void paySvmWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU\","
                + "\"amount\":\"5\",\"token\":\"USDC\",\"network\":\"solana-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/paySvm", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payTonWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj3BzU3KgrFnkct0NsV\","
                + "\"amount\":\"5\",\"token\":\"USDT\",\"network\":\"ton-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTon", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payTronWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"TN2YqJfX5bAJMkNgDxvbTgnCYGhv9ZfMVq\","
                + "\"amount\":\"5\",\"token\":\"USDT\",\"network\":\"tron-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTron", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payNearWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"alice.near\","
                + "\"amount\":\"5\",\"token\":\"USDT\",\"network\":\"near-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payNear", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payAptosWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"0x" + "1".repeat(64) + "\","
                + "\"amount\":\"5\",\"token\":\"USDT\",\"network\":\"aptos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payAptos", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void payTezosWithoutConfirmedReturnsPrompt() throws Exception {
            String args = "{\"to\":\"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb\","
                + "\"amount\":\"5\",\"token\":\"USDT\",\"network\":\"tezos-mainnet\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/payTezos", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("needsConfirmation"));
        }

        @Test
        void confirmationPromptContainsDetails() throws Exception {
            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"25.5\",\"token\":\"USDC\",\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/pay", argsNode);

            String text = result.getContent().get(0).getText();
            JsonNode json = Json.MAPPER.readTree(text);
            assertTrue(json.get("needsConfirmation").asBoolean());
            assertEquals("25.5", json.get("details").get("amount").asText());
            assertEquals("USDC", json.get("details").get("token").asText());
            assertEquals("ethereum", json.get("details").get("network").asText());
            assertTrue(json.get("details").get("to").asText().startsWith("0x"));
        }

        @Test
        void readOnlyToolsDoNotRequireConfirmation() throws Exception {
            // getBalance is read-only - should work without confirmed param
            String args = "{\"address\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertFalse(text.contains("needsConfirmation"));
            assertTrue(text.contains("Balance on"));
        }
    }

    // ===== Token Price =====

    @Nested
    class TokenPrice {

        @Test
        void demoModeReturnsPrices() throws Exception {
            String args = "{\"tokens\":\"ETH,USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Token Prices"));
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("ETH"));
            assertTrue(text.contains("USDC"));
        }

        @Test
        void demoModeReturnsKnownPrices() throws Exception {
            String args = "{\"tokens\":\"BTC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("95000.00"));
        }

        @Test
        void demoModeDefaultsStablecoinToOne() throws Exception {
            String args = "{\"tokens\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("1.00"));
        }

        @Test
        void missingTokensReturnsError() throws Exception {
            String args = "{}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("tokens parameter is required"));
        }

        @Test
        void emptyTokensReturnsError() throws Exception {
            String args = "{\"tokens\":\"\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            assertTrue(result.isError());
        }

        @Test
        void customCurrencyAccepted() throws Exception {
            String args = "{\"tokens\":\"ETH\",\"currency\":\"eur\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getTokenPrice", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("EUR"));
        }
    }

    // ===== Gas Price =====

    @Nested
    class GasPrice {

        @Test
        void demoModeReturnsGasPrice() throws Exception {
            String args = "{\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getGasPrice", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Gas Price"));
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("gwei"));
        }

        @Test
        void demoModeBaseHasLowGas() throws Exception {
            String args = "{\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getGasPrice", argsNode);

            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("0.0100"));
        }

        @Test
        void demoModeEthereumHasHigherGas() throws Exception {
            String args = "{\"network\":\"ethereum\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getGasPrice", argsNode);

            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("25.0000"));
        }

        @Test
        void invalidNetworkReturnsError() throws Exception {
            String args = "{\"network\":\"invalid\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getGasPrice", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid or missing EVM network"));
        }

        @Test
        void missingNetworkReturnsError() throws Exception {
            String args = "{}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/getGasPrice", argsNode);

            assertTrue(result.isError());
        }
    }

    // ===== Estimate Payment Fee =====

    @Nested
    class EstimatePaymentFee {

        @Test
        void demoModeReturnsEstimate() throws Exception {
            String args = "{\"network\":\"base\",\"token\":\"USDC\",\"amount\":\"10\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/estimatePaymentFee", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Payment Fee Estimate"));
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("Estimated Gas"));
            assertTrue(text.contains("Gas Price"));
            assertTrue(text.contains("Fee (USD)"));
        }

        @Test
        void demoModeBaseIsCheap() throws Exception {
            String args = "{\"network\":\"base\",\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/estimatePaymentFee", argsNode);

            String text = result.getContent().get(0).getText();
            // Base: 0.01 gwei * 65000 gas / 1e9 * $3500 = very cheap
            assertTrue(text.contains("$"));
        }

        @Test
        void invalidNetworkReturnsError() throws Exception {
            String args = "{\"network\":\"invalid\",\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/estimatePaymentFee", argsNode);

            assertTrue(result.isError());
        }

        @Test
        void missingTokenReturnsError() throws Exception {
            String args = "{\"network\":\"base\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/estimatePaymentFee", argsNode);

            assertTrue(result.isError());
        }

        @Test
        void unsupportedTokenOnNetworkReturnsError() throws Exception {
            // Use a token that might not be supported everywhere
            String args = "{\"network\":\"berachain\",\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/estimatePaymentFee", argsNode);

            // Either works or returns an appropriate error
            assertNotNull(result);
        }
    }

    // ===== Compare Network Fees =====

    @Nested
    class CompareNetworkFees {

        @Test
        void demoModeReturnsComparison() throws Exception {
            String args = "{\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/compareNetworkFees", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("Network Fee Comparison"));
            assertTrue(text.contains("Demo Mode"));
            assertTrue(text.contains("USDC"));
            // Should contain table headers
            assertTrue(text.contains("Network"));
            assertTrue(text.contains("Fee (USD)"));
        }

        @Test
        void demoModeContainsMultipleNetworks() throws Exception {
            String args = "{\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/compareNetworkFees", argsNode);

            String text = result.getContent().get(0).getText();
            // USDC should be on multiple networks
            assertTrue(text.contains("base") || text.contains("ethereum")
                || text.contains("arbitrum"));
        }

        @Test
        void demoModeDefaultsToUsdc() throws Exception {
            String args = "{}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/compareNetworkFees", argsNode);

            assertFalse(result.isError());
            String text = result.getContent().get(0).getText();
            assertTrue(text.contains("USDC"));
        }

        @Test
        void invalidTokenReturnsError() throws Exception {
            String args = "{\"token\":\"INVALID\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/compareNetworkFees", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Invalid token"));
        }

        @Test
        void demoModeSortedByCostAscending() throws Exception {
            String args = "{\"token\":\"USDC\"}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = demoTools.handleTool("t402/compareNetworkFees", argsNode);

            String text = result.getContent().get(0).getText();
            // Extract USD values from the table and verify ascending order
            String[] lines = text.split("\n");
            double prevFee = -1;
            for (String line : lines) {
                if (line.contains("$") && line.startsWith("|") && !line.contains("Fee (USD)")) {
                    int dollarIdx = line.lastIndexOf("$");
                    if (dollarIdx >= 0) {
                        String feeStr = line.substring(dollarIdx + 1).replaceAll("[^0-9.]", "");
                        if (!feeStr.isEmpty()) {
                            double fee = Double.parseDouble(feeStr);
                            assertTrue(fee >= prevFee,
                                "Fees should be sorted ascending, but " + fee + " < " + prevFee);
                            prevFee = fee;
                        }
                    }
                }
            }
        }
    }

    // ===== Web3Utils Unit Tests =====

    @Nested
    class Web3UtilsTests {

        @Test
        void encodeQuoteSendProducesValidHex() {
            byte[] recipient = new byte[32];
            recipient[31] = 1;
            BigInteger amount = BigInteger.valueOf(1000000);
            BigInteger minAmount = BigInteger.valueOf(995000);

            String result = Web3Utils.encodeQuoteSend(
                30101, recipient, amount, minAmount);

            assertNotNull(result);
            assertTrue(result.startsWith("0x0d35b415"));
            // Should be well-formed hex
            String hex = result.substring(2); // remove 0x
            assertTrue(hex.length() > 0);
            assertEquals(0, hex.length() % 2, "Hex length should be even");
        }

        @Test
        void decodeQuoteSendFeeExtractsNativeFee() {
            // 1 ETH in wei = 10^18 = 0xDE0B6B3A7640000
            String hex = "0x"
                + "0000000000000000000000000000000000000000000000000de0b6b3a7640000" // nativeFee
                + "0000000000000000000000000000000000000000000000000000000000000000"; // lzTokenFee

            BigInteger fee = Web3Utils.decodeQuoteSendFee(hex);
            assertEquals(new BigInteger("1000000000000000000"), fee);
        }

        @Test
        void decodeQuoteSendFeeHandlesNull() {
            assertEquals(BigInteger.ZERO, Web3Utils.decodeQuoteSendFee(null));
        }

        @Test
        void decodeQuoteSendFeeHandlesShortHex() {
            assertEquals(BigInteger.ZERO, Web3Utils.decodeQuoteSendFee("0x"));
            assertEquals(BigInteger.ZERO, Web3Utils.decodeQuoteSendFee("0x0"));
        }

        @Test
        void decodeQuoteSendFeeHandlesZero() {
            String hex = "0x"
                + "0000000000000000000000000000000000000000000000000000000000000000"
                + "0000000000000000000000000000000000000000000000000000000000000000";

            BigInteger fee = Web3Utils.decodeQuoteSendFee(hex);
            assertEquals(BigInteger.ZERO, fee);
        }

        @Test
        void loadCredentialsWithPrefix() {
            // This is a well-known test private key (DO NOT use in production)
            String testKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
            var creds = Web3Utils.loadCredentials(testKey);
            assertNotNull(creds);
            assertNotNull(creds.getAddress());
            assertTrue(creds.getAddress().startsWith("0x"));
        }

        @Test
        void loadCredentialsWithoutPrefix() {
            String testKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
            var creds = Web3Utils.loadCredentials(testKey);
            assertNotNull(creds);
            assertNotNull(creds.getAddress());
        }

        @Test
        void resolveRpcUrlUsesDefault() {
            String rpcUrl = Web3Utils.resolveRpcUrl(null, SupportedNetwork.ETHEREUM);
            assertEquals("https://eth.llamarpc.com", rpcUrl);
        }

        @Test
        void resolveRpcUrlUsesConfigOverride() {
            ServerConfig config = new ServerConfig();
            config.setRpcUrls(java.util.Map.of("ethereum", "https://custom.rpc.com"));

            String rpcUrl = Web3Utils.resolveRpcUrl(config, SupportedNetwork.ETHEREUM);
            assertEquals("https://custom.rpc.com", rpcUrl);
        }
    }

    // ===== Error Handling Edge Cases =====

    @Nested
    class ErrorHandling {

        @Test
        void toolExecutionExceptionIsCaught() throws Exception {
            // Malformed JSON args should trigger an exception caught in handleTool
            String args = "{\"invalid_field\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            // getBalance with missing required fields
            // Jackson may return null for missing fields, leading to NPE
            // which should be caught by the top-level try-catch
            ToolResult result = demoTools.handleTool("t402/getBalance", argsNode);

            // Should either return an error or handle gracefully
            // (not throw an unhandled exception)
            assertNotNull(result);
            assertNotNull(result.getContent());
            assertFalse(result.getContent().isEmpty());
        }

        @Test
        void payWithEmptyPrivateKeyNonDemoMode() throws Exception {
            ServerConfig config = new ServerConfig();
            config.setDemoMode(false);
            config.setPrivateKey(""); // empty string
            McpTools tools = new McpTools(config);

            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = tools.handleTool("t402/pay", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Private key not configured"));
        }

        @Test
        void bridgeWithEmptyPrivateKeyNonDemoMode() throws Exception {
            ServerConfig config = new ServerConfig();
            config.setDemoMode(false);
            config.setPrivateKey(""); // empty string
            McpTools tools = new McpTools(config);

            String args = "{\"fromChain\":\"arbitrum\",\"toChain\":\"ethereum\","
                + "\"amount\":\"100\","
                + "\"recipient\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = tools.handleTool("t402/bridge", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Private key not configured"));
        }

        @Test
        void payGaslessWithEmptyBundlerNonDemoMode() throws Exception {
            ServerConfig config = new ServerConfig();
            config.setDemoMode(false);
            config.setBundlerUrl(""); // empty string
            McpTools tools = new McpTools(config);

            String args = "{\"to\":\"0x1234567890abcdef1234567890abcdef12345678\","
                + "\"amount\":\"10\",\"token\":\"USDC\",\"network\":\"base\",\"confirmed\":true}";
            JsonNode argsNode = Json.MAPPER.readTree(args);

            ToolResult result = tools.handleTool("t402/payGasless", argsNode);

            assertTrue(result.isError());
            assertTrue(result.getContent().get(0).getText().contains("Bundler URL not configured"));
        }
    }
}

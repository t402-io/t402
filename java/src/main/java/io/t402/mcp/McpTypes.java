package io.t402.mcp;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

/**
 * MCP (Model Context Protocol) type definitions for T402.
 */
public final class McpTypes {

    private McpTypes() {}

    // ===== Server Configuration =====

    /**
     * Configuration for the MCP server.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ServerConfig {
        private String privateKey;
        private Map<String, String> rpcUrls;
        private boolean demoMode;
        private String paymasterUrl;
        private String bundlerUrl;

        public ServerConfig() {}

        public String getPrivateKey() { return privateKey; }
        public void setPrivateKey(String privateKey) { this.privateKey = privateKey; }

        public Map<String, String> getRpcUrls() { return rpcUrls; }
        public void setRpcUrls(Map<String, String> rpcUrls) { this.rpcUrls = rpcUrls; }

        public boolean isDemoMode() { return demoMode; }
        public void setDemoMode(boolean demoMode) { this.demoMode = demoMode; }

        public String getPaymasterUrl() { return paymasterUrl; }
        public void setPaymasterUrl(String paymasterUrl) { this.paymasterUrl = paymasterUrl; }

        public String getBundlerUrl() { return bundlerUrl; }
        public void setBundlerUrl(String bundlerUrl) { this.bundlerUrl = bundlerUrl; }
    }

    // ===== Supported Types =====

    /**
     * Supported blockchain networks.
     */
    public enum SupportedNetwork {
        @JsonProperty("ethereum") ETHEREUM("ethereum"),
        @JsonProperty("base") BASE("base"),
        @JsonProperty("arbitrum") ARBITRUM("arbitrum"),
        @JsonProperty("optimism") OPTIMISM("optimism"),
        @JsonProperty("polygon") POLYGON("polygon"),
        @JsonProperty("avalanche") AVALANCHE("avalanche"),
        @JsonProperty("ink") INK("ink"),
        @JsonProperty("berachain") BERACHAIN("berachain"),
        @JsonProperty("unichain") UNICHAIN("unichain");

        private final String value;

        SupportedNetwork(String value) {
            this.value = value;
        }

        public String getValue() { return value; }

        public static SupportedNetwork fromString(String value) {
            for (SupportedNetwork network : values()) {
                if (network.value.equalsIgnoreCase(value)) {
                    return network;
                }
            }
            return null;
        }
    }

    /**
     * Supported token types.
     */
    public enum SupportedToken {
        @JsonProperty("USDC") USDC("USDC"),
        @JsonProperty("USDT") USDT("USDT"),
        @JsonProperty("USDT0") USDT0("USDT0");

        private final String value;

        SupportedToken(String value) {
            this.value = value;
        }

        public String getValue() { return value; }

        public static SupportedToken fromString(String value) {
            for (SupportedToken token : values()) {
                if (token.value.equalsIgnoreCase(value)) {
                    return token;
                }
            }
            return null;
        }
    }

    // ===== JSON-RPC Types =====

    /**
     * JSON-RPC 2.0 request.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JsonRpcRequest {
        private String jsonrpc;
        private JsonNode id;
        private String method;
        private JsonNode params;

        public String getJsonrpc() { return jsonrpc; }
        public void setJsonrpc(String jsonrpc) { this.jsonrpc = jsonrpc; }

        public JsonNode getId() { return id; }
        public void setId(JsonNode id) { this.id = id; }

        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }

        public JsonNode getParams() { return params; }
        public void setParams(JsonNode params) { this.params = params; }
    }

    /**
     * JSON-RPC 2.0 response.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JsonRpcResponse {
        private String jsonrpc = "2.0";
        private JsonNode id;
        private Object result;
        private JsonRpcError error;

        public JsonRpcResponse() {}

        public JsonRpcResponse(JsonNode id) {
            this.id = id;
        }

        public String getJsonrpc() { return jsonrpc; }
        public void setJsonrpc(String jsonrpc) { this.jsonrpc = jsonrpc; }

        public JsonNode getId() { return id; }
        public void setId(JsonNode id) { this.id = id; }

        public Object getResult() { return result; }
        public void setResult(Object result) { this.result = result; }

        public JsonRpcError getError() { return error; }
        public void setError(JsonRpcError error) { this.error = error; }
    }

    /**
     * JSON-RPC 2.0 error.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JsonRpcError {
        private int code;
        private String message;
        private Object data;

        public JsonRpcError() {}

        public JsonRpcError(int code, String message) {
            this.code = code;
            this.message = message;
        }

        public JsonRpcError(int code, String message, Object data) {
            this.code = code;
            this.message = message;
            this.data = data;
        }

        public int getCode() { return code; }
        public void setCode(int code) { this.code = code; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public Object getData() { return data; }
        public void setData(Object data) { this.data = data; }
    }

    // ===== MCP Tool Types =====

    /**
     * MCP tool definition.
     */
    public static class Tool {
        private String name;
        private String description;
        private InputSchema inputSchema;

        public Tool() {}

        public Tool(String name, String description, InputSchema inputSchema) {
            this.name = name;
            this.description = description;
            this.inputSchema = inputSchema;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public InputSchema getInputSchema() { return inputSchema; }
        public void setInputSchema(InputSchema inputSchema) { this.inputSchema = inputSchema; }
    }

    /**
     * JSON Schema for tool inputs.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InputSchema {
        private String type = "object";
        private Map<String, Property> properties;
        private List<String> required;

        public InputSchema() {}

        public InputSchema(Map<String, Property> properties, List<String> required) {
            this.properties = properties;
            this.required = required;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public Map<String, Property> getProperties() { return properties; }
        public void setProperties(Map<String, Property> properties) { this.properties = properties; }

        public List<String> getRequired() { return required; }
        public void setRequired(List<String> required) { this.required = required; }
    }

    /**
     * JSON Schema property.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Property {
        private String type;
        private String description;
        @JsonProperty("enum")
        private List<String> enumValues;
        private String pattern;

        public Property() {}

        public Property(String type, String description) {
            this.type = type;
            this.description = description;
        }

        public Property(String type, String description, List<String> enumValues) {
            this.type = type;
            this.description = description;
            this.enumValues = enumValues;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public List<String> getEnumValues() { return enumValues; }
        public void setEnumValues(List<String> enumValues) { this.enumValues = enumValues; }

        public String getPattern() { return pattern; }
        public void setPattern(String pattern) { this.pattern = pattern; }
    }

    /**
     * Parameters for tool call.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallToolParams {
        private String name;
        private JsonNode arguments;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public JsonNode getArguments() { return arguments; }
        public void setArguments(JsonNode arguments) { this.arguments = arguments; }
    }

    /**
     * Result of tool execution.
     */
    @JsonInclude(JsonInclude.Include.NON_DEFAULT)
    public static class ToolResult {
        private List<ContentBlock> content;
        private boolean isError;

        public ToolResult() {}

        public ToolResult(List<ContentBlock> content) {
            this.content = content;
        }

        public ToolResult(List<ContentBlock> content, boolean isError) {
            this.content = content;
            this.isError = isError;
        }

        public List<ContentBlock> getContent() { return content; }
        public void setContent(List<ContentBlock> content) { this.content = content; }

        public boolean isError() { return isError; }
        public void setError(boolean error) { isError = error; }
    }

    /**
     * Content block in tool result.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ContentBlock {
        private String type;
        private String text;

        public ContentBlock() {}

        public ContentBlock(String type, String text) {
            this.type = type;
            this.text = text;
        }

        public static ContentBlock text(String text) {
            return new ContentBlock("text", text);
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
    }

    // ===== Tool Input Types =====

    /**
     * Input for t402/getBalance.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GetBalanceInput {
        private String address;
        private String network;

        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }

        public String getNetwork() { return network; }
        public void setNetwork(String network) { this.network = network; }
    }

    /**
     * Input for t402/getAllBalances.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GetAllBalancesInput {
        private String address;

        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
    }

    /**
     * Input for t402/pay.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PayInput {
        private String to;
        private String amount;
        private String token;
        private String network;

        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public String getNetwork() { return network; }
        public void setNetwork(String network) { this.network = network; }
    }

    /**
     * Input for t402/payGasless.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PayGaslessInput {
        private String to;
        private String amount;
        private String token;
        private String network;

        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public String getNetwork() { return network; }
        public void setNetwork(String network) { this.network = network; }
    }

    /**
     * Input for t402/getBridgeFee.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GetBridgeFeeInput {
        private String fromChain;
        private String toChain;
        private String amount;
        private String recipient;

        public String getFromChain() { return fromChain; }
        public void setFromChain(String fromChain) { this.fromChain = fromChain; }

        public String getToChain() { return toChain; }
        public void setToChain(String toChain) { this.toChain = toChain; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getRecipient() { return recipient; }
        public void setRecipient(String recipient) { this.recipient = recipient; }
    }

    /**
     * Input for t402/bridge.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BridgeInput {
        private String fromChain;
        private String toChain;
        private String amount;
        private String recipient;

        public String getFromChain() { return fromChain; }
        public void setFromChain(String fromChain) { this.fromChain = fromChain; }

        public String getToChain() { return toChain; }
        public void setToChain(String toChain) { this.toChain = toChain; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getRecipient() { return recipient; }
        public void setRecipient(String recipient) { this.recipient = recipient; }
    }

    // ===== Tool Result Types =====

    /**
     * Balance information for a token.
     */
    public static class BalanceInfo {
        private String token;
        private String balance;
        private String raw;

        public BalanceInfo() {}

        public BalanceInfo(String token, String balance, String raw) {
            this.token = token;
            this.balance = balance;
            this.raw = raw;
        }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public String getBalance() { return balance; }
        public void setBalance(String balance) { this.balance = balance; }

        public String getRaw() { return raw; }
        public void setRaw(String raw) { this.raw = raw; }
    }

    /**
     * Balances for a single network.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NetworkBalance {
        private String network;
        private BalanceInfo nativeBalance;
        private List<BalanceInfo> tokens;
        private String error;

        public NetworkBalance() {}

        public NetworkBalance(String network) {
            this.network = network;
        }

        public String getNetwork() { return network; }
        public void setNetwork(String network) { this.network = network; }

        @JsonProperty("native")
        public BalanceInfo getNativeBalance() { return nativeBalance; }
        public void setNativeBalance(BalanceInfo nativeBalance) { this.nativeBalance = nativeBalance; }

        public List<BalanceInfo> getTokens() { return tokens; }
        public void setTokens(List<BalanceInfo> tokens) { this.tokens = tokens; }

        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }

    /**
     * Result of a payment.
     */
    @JsonInclude(JsonInclude.Include.NON_DEFAULT)
    public static class PaymentResult {
        private String txHash;
        private String from;
        private String to;
        private String amount;
        private String token;
        private String network;
        private String explorerUrl;
        private boolean demoMode;

        public String getTxHash() { return txHash; }
        public void setTxHash(String txHash) { this.txHash = txHash; }

        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }

        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }

        public String getNetwork() { return network; }
        public void setNetwork(String network) { this.network = network; }

        public String getExplorerUrl() { return explorerUrl; }
        public void setExplorerUrl(String explorerUrl) { this.explorerUrl = explorerUrl; }

        public boolean isDemoMode() { return demoMode; }
        public void setDemoMode(boolean demoMode) { this.demoMode = demoMode; }
    }

    /**
     * Result of a bridge fee query.
     */
    public static class BridgeFeeResult {
        private String nativeFee;
        private String nativeSymbol;
        private String fromChain;
        private String toChain;
        private String amount;
        private int estimatedTime;

        public String getNativeFee() { return nativeFee; }
        public void setNativeFee(String nativeFee) { this.nativeFee = nativeFee; }

        public String getNativeSymbol() { return nativeSymbol; }
        public void setNativeSymbol(String nativeSymbol) { this.nativeSymbol = nativeSymbol; }

        public String getFromChain() { return fromChain; }
        public void setFromChain(String fromChain) { this.fromChain = fromChain; }

        public String getToChain() { return toChain; }
        public void setToChain(String toChain) { this.toChain = toChain; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public int getEstimatedTime() { return estimatedTime; }
        public void setEstimatedTime(int estimatedTime) { this.estimatedTime = estimatedTime; }
    }

    /**
     * Result of a bridge operation.
     */
    @JsonInclude(JsonInclude.Include.NON_DEFAULT)
    public static class BridgeResult {
        private String txHash;
        private String messageGuid;
        private String fromChain;
        private String toChain;
        private String amount;
        private String explorerUrl;
        private String trackingUrl;
        private int estimatedTime;
        private boolean demoMode;

        public String getTxHash() { return txHash; }
        public void setTxHash(String txHash) { this.txHash = txHash; }

        public String getMessageGuid() { return messageGuid; }
        public void setMessageGuid(String messageGuid) { this.messageGuid = messageGuid; }

        public String getFromChain() { return fromChain; }
        public void setFromChain(String fromChain) { this.fromChain = fromChain; }

        public String getToChain() { return toChain; }
        public void setToChain(String toChain) { this.toChain = toChain; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getExplorerUrl() { return explorerUrl; }
        public void setExplorerUrl(String explorerUrl) { this.explorerUrl = explorerUrl; }

        public String getTrackingUrl() { return trackingUrl; }
        public void setTrackingUrl(String trackingUrl) { this.trackingUrl = trackingUrl; }

        public int getEstimatedTime() { return estimatedTime; }
        public void setEstimatedTime(int estimatedTime) { this.estimatedTime = estimatedTime; }

        public boolean isDemoMode() { return demoMode; }
        public void setDemoMode(boolean demoMode) { this.demoMode = demoMode; }
    }
}

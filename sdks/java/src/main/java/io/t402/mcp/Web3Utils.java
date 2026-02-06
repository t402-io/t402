package io.t402.mcp;

import io.t402.mcp.McpTypes.ServerConfig;
import io.t402.mcp.McpTypes.SupportedNetwork;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.RawTransaction;
import org.web3j.crypto.TransactionEncoder;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import org.web3j.protocol.core.methods.response.EthGetBalance;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt;
import org.web3j.protocol.core.methods.response.EthEstimateGas;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Web3j utility methods for blockchain interactions in MCP tools.
 *
 * <p>Provides ERC-20 balance queries, token transfers, and native balance lookups
 * using Web3j. Connections are cached per RPC URL for efficiency.
 */
public final class Web3Utils {

    private Web3Utils() {
        // Utility class
    }

    /** Cache of Web3j instances keyed by RPC URL. */
    private static final Map<String, Web3j> WEB3J_CACHE = new ConcurrentHashMap<>();

    /**
     * Get or create a Web3j instance for the given RPC URL.
     *
     * @param rpcUrl the JSON-RPC endpoint URL
     * @return a Web3j client connected to the endpoint
     */
    public static Web3j getWeb3j(String rpcUrl) {
        return WEB3J_CACHE.computeIfAbsent(rpcUrl, url -> Web3j.build(new HttpService(url)));
    }

    /**
     * Get the RPC URL for a network, preferring config overrides.
     *
     * @param config server config with optional RPC overrides
     * @param network EVM network
     * @return the RPC URL to use
     */
    public static String resolveRpcUrl(ServerConfig config, SupportedNetwork network) {
        return McpConstants.getRpcUrl(config, network);
    }

    /**
     * Get the native balance (ETH/MATIC/AVAX/etc.) for an address.
     *
     * @param web3j the Web3j client
     * @param address the wallet address (0x-prefixed)
     * @return the balance in wei
     * @throws Exception if the RPC call fails
     */
    public static BigInteger getNativeBalance(Web3j web3j, String address) throws Exception {
        EthGetBalance response = web3j
            .ethGetBalance(address, DefaultBlockParameterName.LATEST)
            .send();

        if (response.hasError()) {
            throw new RuntimeException("Failed to get native balance: "
                + response.getError().getMessage());
        }

        return response.getBalance();
    }

    /**
     * Get an ERC-20 token balance for an address.
     *
     * @param web3j the Web3j client
     * @param tokenAddress the ERC-20 contract address
     * @param ownerAddress the wallet address to query
     * @return the raw token balance (in smallest units)
     * @throws Exception if the RPC call fails
     */
    public static BigInteger getErc20Balance(Web3j web3j, String tokenAddress,
                                              String ownerAddress) throws Exception {
        Function function = new Function(
            "balanceOf",
            Collections.singletonList(new Address(ownerAddress)),
            Collections.singletonList(new TypeReference<Uint256>() { })
        );

        String encodedFunction = FunctionEncoder.encode(function);

        EthCall response = web3j
            .ethCall(
                Transaction.createEthCallTransaction(ownerAddress, tokenAddress, encodedFunction),
                DefaultBlockParameterName.LATEST
            )
            .send();

        if (response.hasError()) {
            throw new RuntimeException("Failed to get ERC-20 balance: "
                + response.getError().getMessage());
        }

        String value = response.getValue();
        if (value == null || value.equals("0x") || value.equals("0x0")) {
            return BigInteger.ZERO;
        }

        List<Type> decoded = FunctionReturnDecoder.decode(value,
            function.getOutputParameters());

        if (decoded.isEmpty()) {
            return BigInteger.ZERO;
        }

        return (BigInteger) decoded.get(0).getValue();
    }

    /**
     * Get the decimals for an ERC-20 token.
     *
     * @param web3j the Web3j client
     * @param tokenAddress the ERC-20 contract address
     * @return the number of decimals
     * @throws Exception if the RPC call fails
     */
    public static int getErc20Decimals(Web3j web3j, String tokenAddress) throws Exception {
        Function function = new Function(
            "decimals",
            Collections.emptyList(),
            Collections.singletonList(new TypeReference<Uint8>() { })
        );

        String encodedFunction = FunctionEncoder.encode(function);

        EthCall response = web3j
            .ethCall(
                Transaction.createEthCallTransaction(
                    "0x0000000000000000000000000000000000000000",
                    tokenAddress,
                    encodedFunction
                ),
                DefaultBlockParameterName.LATEST
            )
            .send();

        if (response.hasError()) {
            throw new RuntimeException("Failed to get decimals: "
                + response.getError().getMessage());
        }

        String value = response.getValue();
        if (value == null || value.equals("0x")) {
            return 6; // Default for USDC/USDT
        }

        List<Type> decoded = FunctionReturnDecoder.decode(value,
            function.getOutputParameters());

        if (decoded.isEmpty()) {
            return 6;
        }

        return ((BigInteger) decoded.get(0).getValue()).intValue();
    }

    /**
     * Execute an ERC-20 transfer.
     *
     * @param web3j the Web3j client
     * @param credentials the sender's credentials (private key)
     * @param chainId the chain ID for EIP-155 signing
     * @param tokenAddress the ERC-20 contract address
     * @param toAddress the recipient address
     * @param amount the amount in smallest token units
     * @return the transaction hash
     * @throws Exception if the transaction fails
     */
    public static String transferErc20(Web3j web3j, Credentials credentials,
                                        long chainId, String tokenAddress,
                                        String toAddress,
                                        BigInteger amount) throws Exception {

        String fromAddress = credentials.getAddress();

        // Encode transfer(address,uint256)
        Function function = new Function(
            "transfer",
            Arrays.asList(new Address(toAddress), new Uint256(amount)),
            Collections.singletonList(new TypeReference<Bool>() { })
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // Get nonce
        EthGetTransactionCount nonceResponse = web3j
            .ethGetTransactionCount(fromAddress, DefaultBlockParameterName.PENDING)
            .send();

        if (nonceResponse.hasError()) {
            throw new RuntimeException("Failed to get nonce: "
                + nonceResponse.getError().getMessage());
        }

        BigInteger nonce = nonceResponse.getTransactionCount();

        // Estimate gas
        EthEstimateGas gasEstimate = web3j
            .ethEstimateGas(
                Transaction.createFunctionCallTransaction(
                    fromAddress, nonce, BigInteger.ZERO, null, tokenAddress, encodedFunction
                )
            )
            .send();

        BigInteger gasLimit;
        if (gasEstimate.hasError()) {
            gasLimit = BigInteger.valueOf(100000); // Default gas limit
        } else {
            // Add 20% buffer
            gasLimit = gasEstimate.getAmountUsed()
                .multiply(BigInteger.valueOf(120))
                .divide(BigInteger.valueOf(100));
        }

        // Get gas price
        EthGasPrice gasPriceResponse = web3j.ethGasPrice().send();
        if (gasPriceResponse.hasError()) {
            throw new RuntimeException("Failed to get gas price: "
                + gasPriceResponse.getError().getMessage());
        }

        BigInteger gasPrice = gasPriceResponse.getGasPrice();

        // Build raw transaction
        RawTransaction rawTransaction = RawTransaction.createTransaction(
            nonce, gasPrice, gasLimit, tokenAddress, BigInteger.ZERO, encodedFunction
        );

        // Sign
        byte[] signedMessage = TransactionEncoder.signMessage(
            rawTransaction, chainId, credentials
        );

        String hexValue = Numeric.toHexString(signedMessage);

        // Send
        EthSendTransaction sendResponse = web3j.ethSendRawTransaction(hexValue).send();

        if (sendResponse.hasError()) {
            throw new RuntimeException("Transaction failed: "
                + sendResponse.getError().getMessage());
        }

        return sendResponse.getTransactionHash();
    }

    /**
     * Wait for a transaction receipt with polling.
     *
     * @param web3j the Web3j client
     * @param txHash the transaction hash
     * @param maxAttempts maximum poll attempts
     * @param pollIntervalMs interval between polls in milliseconds
     * @return the transaction receipt
     * @throws Exception if polling times out or fails
     */
    public static TransactionReceipt waitForReceipt(Web3j web3j, String txHash,
                                                      int maxAttempts,
                                                      long pollIntervalMs) throws Exception {
        for (int i = 0; i < maxAttempts; i++) {
            EthGetTransactionReceipt receiptResponse = web3j
                .ethGetTransactionReceipt(txHash)
                .send();

            if (receiptResponse.getTransactionReceipt().isPresent()) {
                return receiptResponse.getTransactionReceipt().get();
            }

            Thread.sleep(pollIntervalMs);
        }

        throw new RuntimeException("Timeout waiting for transaction receipt: " + txHash);
    }

    /**
     * Encode an OFT quoteSend call for LayerZero bridge fee estimation.
     *
     * @param dstEid destination endpoint ID
     * @param recipientBytes32 recipient address as bytes32
     * @param amount token amount
     * @param minAmount minimum acceptable amount
     * @return the ABI-encoded call data
     */
    public static String encodeQuoteSend(int dstEid, byte[] recipientBytes32,
                                          BigInteger amount,
                                          BigInteger minAmount) {
        // Manual ABI encoding for quoteSend tuple
        // quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)
        String selector = "0x0d35b415"; // quoteSend selector

        StringBuilder sb = new StringBuilder(selector);

        // Offset for tuple (starts at 64 bytes = position after the bool param)
        sb.append(padLeft("40", 64)); // offset to sendParam tuple = 64

        // _payInLzToken = false
        sb.append(padLeft("0", 64));

        // SendParam tuple
        // dstEid
        sb.append(padLeft(Integer.toHexString(dstEid), 64));

        // to (bytes32)
        sb.append(Numeric.toHexStringNoPrefixZeroPadded(
            new BigInteger(1, recipientBytes32), 64));

        // amountLD
        sb.append(padLeft(amount.toString(16), 64));

        // minAmountLD
        sb.append(padLeft(minAmount.toString(16), 64));

        // extraOptions offset (relative to tuple start)
        sb.append(padLeft("e0", 64)); // 7 * 32 = 224 = 0xe0

        // composeMsg offset
        sb.append(padLeft("100", 64)); // 8 * 32 = 256 = 0x100

        // oftCmd offset
        sb.append(padLeft("120", 64)); // 9 * 32 = 288 = 0x120

        // extraOptions (empty bytes)
        sb.append(padLeft("0", 64)); // length = 0

        // composeMsg (empty bytes)
        sb.append(padLeft("0", 64)); // length = 0

        // oftCmd (empty bytes)
        sb.append(padLeft("0", 64)); // length = 0

        return sb.toString();
    }

    /**
     * Decode a quoteSend response to extract the native fee.
     *
     * @param responseHex the ABI-encoded response hex string
     * @return the native fee in wei
     */
    public static BigInteger decodeQuoteSendFee(String responseHex) {
        if (responseHex == null || responseHex.length() < 66) {
            return BigInteger.ZERO;
        }

        String hex = responseHex.startsWith("0x") ? responseHex.substring(2) : responseHex;

        if (hex.length() < 64) {
            return BigInteger.ZERO;
        }

        // First 32 bytes = nativeFee
        String nativeFeeHex = hex.substring(0, 64);
        return new BigInteger(nativeFeeHex, 16);
    }

    /**
     * Create Credentials from a hex private key.
     *
     * @param privateKeyHex the private key (with or without 0x prefix)
     * @return Web3j Credentials
     */
    public static Credentials loadCredentials(String privateKeyHex) {
        String key = privateKeyHex.startsWith("0x")
            ? privateKeyHex.substring(2) : privateKeyHex;
        return Credentials.create(key);
    }

    /**
     * Shut down all cached Web3j connections.
     */
    public static void shutdown() {
        for (Web3j web3j : WEB3J_CACHE.values()) {
            web3j.shutdown();
        }
        WEB3J_CACHE.clear();
    }

    private static String padLeft(String hex, int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = hex.length(); i < length; i++) {
            sb.append('0');
        }
        sb.append(hex);
        return sb.toString();
    }
}

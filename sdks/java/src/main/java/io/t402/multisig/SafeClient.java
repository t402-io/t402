package io.t402.multisig;

import io.t402.multisig.SafeTypes.*;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.DynamicArray;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Sign;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.utils.Numeric;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;

/**
 * Client for interacting with Safe multi-sig contracts.
 */
public class SafeClient {

    private final String address;
    private final Web3j web3j;
    private Long chainId;
    private SafeInfo cachedInfo;

    /**
     * Create a new SafeClient.
     *
     * @param config Safe configuration
     */
    public SafeClient(SafeConfig config) {
        this.address = config.getAddress();
        this.web3j = Web3j.build(new HttpService(config.getRpcUrl()));
        this.chainId = config.getChainId();
    }

    /**
     * Get Safe address.
     */
    public String getAddress() {
        return address;
    }

    /**
     * Get chain ID.
     */
    public Long getChainId() throws IOException {
        if (chainId == null) {
            chainId = web3j.ethChainId().send().getChainId().longValue();
        }
        return chainId;
    }

    /**
     * Get Safe information (owners, threshold, nonce).
     */
    public SafeInfo getInfo() throws IOException {
        List<String> owners = getOwners();
        int threshold = getThreshold();
        BigInteger nonce = getNonce();
        Long chain = getChainId();

        cachedInfo = new SafeInfo(
                address,
                owners,
                threshold,
                nonce,
                null,
                chain
        );

        return cachedInfo;
    }

    /**
     * Get list of Safe owners.
     */
    public List<String> getOwners() throws IOException {
        Function function = new Function(
                "getOwners",
                Collections.emptyList(),
                Collections.singletonList(new TypeReference<DynamicArray<Address>>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);
        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, address, encodedFunction),
                DefaultBlockParameterName.LATEST
        ).send();

        List<Type> decoded = FunctionReturnDecoder.decode(
                response.getValue(),
                function.getOutputParameters()
        );

        if (decoded.isEmpty()) {
            return Collections.emptyList();
        }

        @SuppressWarnings("unchecked")
        List<Address> addressList = ((DynamicArray<Address>) decoded.get(0)).getValue();
        List<String> owners = new ArrayList<>();
        for (Address addr : addressList) {
            owners.add(addr.getValue());
        }

        return owners;
    }

    /**
     * Get the required number of signatures.
     */
    public int getThreshold() throws IOException {
        Function function = new Function(
                "getThreshold",
                Collections.emptyList(),
                Collections.singletonList(new TypeReference<Uint256>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);
        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, address, encodedFunction),
                DefaultBlockParameterName.LATEST
        ).send();

        List<Type> decoded = FunctionReturnDecoder.decode(
                response.getValue(),
                function.getOutputParameters()
        );

        if (decoded.isEmpty()) {
            return 0;
        }

        return ((Uint256) decoded.get(0)).getValue().intValue();
    }

    /**
     * Get the current Safe nonce.
     */
    public BigInteger getNonce() throws IOException {
        Function function = new Function(
                "nonce",
                Collections.emptyList(),
                Collections.singletonList(new TypeReference<Uint256>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);
        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, address, encodedFunction),
                DefaultBlockParameterName.LATEST
        ).send();

        List<Type> decoded = FunctionReturnDecoder.decode(
                response.getValue(),
                function.getOutputParameters()
        );

        if (decoded.isEmpty()) {
            return BigInteger.ZERO;
        }

        return ((Uint256) decoded.get(0)).getValue();
    }

    /**
     * Check if an address is a Safe owner.
     */
    public boolean isOwner(String ownerAddress) throws IOException {
        List<String> owners = getOwners();
        String ownerLower = ownerAddress.toLowerCase();
        for (String owner : owners) {
            if (owner.toLowerCase().equals(ownerLower)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a new transaction proposal.
     *
     * @param tx The Safe transaction
     * @return TransactionRequest for collecting signatures
     */
    public TransactionRequest proposeTransaction(SafeTransaction tx) throws IOException {
        // Get nonce if not set
        if (tx.getNonce() == null) {
            tx.setNonce(getNonce());
        }

        // Calculate transaction hash
        String txHash = getTransactionHash(tx);

        // Get threshold
        int threshold = getThreshold();

        // Create request
        long now = System.currentTimeMillis() / 1000;
        String id = generateRequestId();

        return new TransactionRequest(
                id,
                address,
                tx,
                txHash,
                threshold,
                now,
                now + SafeConstants.DEFAULT_REQUEST_EXPIRATION_SECONDS
        );
    }

    /**
     * Calculate the Safe transaction hash.
     */
    public String getTransactionHash(SafeTransaction tx) throws IOException {
        Function function = new Function(
                "getTransactionHash",
                Arrays.asList(
                        new Address(tx.getTo()),
                        new Uint256(tx.getValue()),
                        new DynamicBytes(tx.getData()),
                        new Uint8(tx.getOperation().getValue()),
                        new Uint256(tx.getSafeTxGas()),
                        new Uint256(tx.getBaseGas()),
                        new Uint256(tx.getGasPrice()),
                        new Address(tx.getGasToken()),
                        new Address(tx.getRefundReceiver()),
                        new Uint256(tx.getNonce() != null ? tx.getNonce() : BigInteger.ZERO)
                ),
                Collections.singletonList(new TypeReference<org.web3j.abi.datatypes.generated.Bytes32>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);
        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, address, encodedFunction),
                DefaultBlockParameterName.LATEST
        ).send();

        return response.getValue();
    }

    /**
     * Sign a transaction with credentials.
     *
     * @param tx          The Safe transaction
     * @param credentials Signing credentials
     * @return SafeSignature
     */
    public SafeSignature signTransaction(SafeTransaction tx, Credentials credentials) throws IOException {
        // Get transaction hash
        String txHashHex = getTransactionHash(tx);
        byte[] txHash = Numeric.hexStringToByteArray(txHashHex);

        // Sign the hash
        Sign.SignatureData sigData = Sign.signMessage(txHash, credentials.getEcKeyPair(), false);

        // Adjust v value for Safe (add 4 for EOA signature)
        byte v = sigData.getV()[0];
        if (v < 27) {
            v += 27;
        }
        v += 4;

        // Combine r, s, v
        byte[] signature = new byte[65];
        System.arraycopy(sigData.getR(), 0, signature, 0, 32);
        System.arraycopy(sigData.getS(), 0, signature, 32, 32);
        signature[64] = v;

        return new SafeSignature(
                credentials.getAddress(),
                signature,
                SignatureType.EOA
        );
    }

    /**
     * Add a signature to a transaction request.
     */
    public void addSignature(TransactionRequest request, SafeSignature signature) throws IOException {
        // Check if signer is an owner
        if (!isOwner(signature.getSigner())) {
            throw new IllegalArgumentException("Signer is not an owner: " + signature.getSigner());
        }

        request.addSignature(signature);
    }

    /**
     * Execute a Safe transaction with collected signatures.
     *
     * @param request   Transaction request with signatures
     * @param executor  Credentials of the executor
     * @return ExecutionResult
     */
    public ExecutionResult executeTransaction(TransactionRequest request, Credentials executor)
            throws IOException, ExecutionException, InterruptedException {

        if (!request.isReady()) {
            throw new IllegalArgumentException(String.format(
                    "Not enough signatures: have %d, need %d",
                    request.getCollectedCount(),
                    request.getThreshold()));
        }

        // Pack signatures sorted by signer address
        byte[] packedSigs = SignatureCollector.combineSignatures(request.getSignatures());

        // Build execTransaction function
        SafeTransaction tx = request.getTransaction();
        Function function = new Function(
                "execTransaction",
                Arrays.asList(
                        new Address(tx.getTo()),
                        new Uint256(tx.getValue()),
                        new DynamicBytes(tx.getData()),
                        new Uint8(tx.getOperation().getValue()),
                        new Uint256(tx.getSafeTxGas()),
                        new Uint256(tx.getBaseGas()),
                        new Uint256(tx.getGasPrice()),
                        new Address(tx.getGasToken()),
                        new Address(tx.getRefundReceiver()),
                        new DynamicBytes(packedSigs)
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // Send transaction
        RawTransactionManager txManager = new RawTransactionManager(
                web3j,
                executor,
                getChainId()
        );

        BigInteger gasPrice = web3j.ethGasPrice().send().getGasPrice();
        BigInteger gasLimit = BigInteger.valueOf(500000); // Estimate

        EthSendTransaction ethSendTransaction = txManager.sendTransaction(
                gasPrice,
                gasLimit,
                address,
                encodedFunction,
                BigInteger.ZERO
        );

        if (ethSendTransaction.hasError()) {
            throw new RuntimeException("Transaction failed: " + ethSendTransaction.getError().getMessage());
        }

        String txHash = ethSendTransaction.getTransactionHash();

        return new ExecutionResult(txHash, true);
    }

    /**
     * Wait for a transaction to be mined.
     *
     * @param txHash Transaction hash
     * @return ExecutionResult with final status
     */
    public ExecutionResult waitForExecution(String txHash) throws IOException, InterruptedException {
        while (true) {
            EthGetTransactionReceipt receipt = web3j.ethGetTransactionReceipt(txHash).send();
            if (receipt.getTransactionReceipt().isPresent()) {
                var txReceipt = receipt.getTransactionReceipt().get();
                boolean success = txReceipt.getStatus().equals("0x1");
                return new ExecutionResult(
                        txHash,
                        success,
                        txReceipt.getGasUsed().longValue(),
                        txReceipt.getBlockNumber().longValue()
                );
            }
            Thread.sleep(1000);
        }
    }

    /**
     * Close the Web3j connection.
     */
    public void close() {
        web3j.shutdown();
    }

    /**
     * Generate a unique request ID.
     */
    private String generateRequestId() {
        long timestamp = System.currentTimeMillis();
        byte[] randomBytes = new byte[4];
        new java.security.SecureRandom().nextBytes(randomBytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : randomBytes) {
            sb.append(String.format("%02x", b));
        }
        return String.format("msig_%x_%s", timestamp, sb.toString());
    }
}

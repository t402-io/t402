package io.t402.erc4337.safe;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

/**
 * Safe smart account helper for ERC-4337.
 *
 * <p>Provides utilities for encoding Safe transactions and signatures
 * for use with ERC-4337 UserOperations.
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * SafeAccount safe = new SafeAccount.Builder()
 *     .safeAddress("0x...")
 *     .owner(credentials)
 *     .chainId(8453)
 *     .build();
 *
 * // Encode a transfer call
 * String callData = safe.encodeExecTransaction(
 *     tokenAddress,
 *     BigInteger.ZERO,
 *     transferData,
 *     Operation.CALL
 * );
 * }</pre>
 *
 * @see <a href="https://safe.global">Safe Documentation</a>
 */
public class SafeAccount {

    /** Safe v1.4.1 singleton address (same on all chains). */
    public static final String SAFE_SINGLETON_141 = "0x41675C099F32341bf84BFc5382aF534df5C7461a";

    /** Safe proxy factory address. */
    public static final String SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";

    /** Safe 4337 module address. */
    public static final String SAFE_4337_MODULE = "0xa581c4A4DB7175302464fF3C06380BC3270b4037";

    /** Safe fallback handler. */
    public static final String SAFE_FALLBACK_HANDLER = "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4";

    private final String safeAddress;
    private final Credentials owner;
    private final long chainId;
    private final String singleton;
    private final String module4337;

    private SafeAccount(Builder builder) {
        this.safeAddress = builder.safeAddress;
        this.owner = builder.owner;
        this.chainId = builder.chainId;
        this.singleton = builder.singleton;
        this.module4337 = builder.module4337;
    }

    public String getSafeAddress() {
        return safeAddress;
    }

    public Credentials getOwner() {
        return owner;
    }

    public long getChainId() {
        return chainId;
    }

    /**
     * Encodes an execTransaction call for the Safe.
     *
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     * @param operation Operation type (CALL or DELEGATECALL)
     * @return Encoded call data
     */
    public String encodeExecTransaction(
            String to,
            BigInteger value,
            String data,
            Operation operation) {
        return encodeExecTransaction(to, value, data, operation, null);
    }

    /**
     * Encodes an execTransaction call with signature.
     *
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     * @param operation Operation type
     * @param signature Pre-computed signature (null for self-signed)
     * @return Encoded call data
     */
    public String encodeExecTransaction(
            String to,
            BigInteger value,
            String data,
            Operation operation,
            String signature) {

        // Safe execTransaction function
        Function function = new Function(
            "execTransaction",
            List.of(
                new Address(to),
                new Uint256(value),
                new DynamicBytes(Numeric.hexStringToByteArray(data)),
                new Uint8(operation.getValue()),
                new Uint256(BigInteger.ZERO),  // safeTxGas
                new Uint256(BigInteger.ZERO),  // baseGas
                new Uint256(BigInteger.ZERO),  // gasPrice
                new Address("0x0000000000000000000000000000000000000000"),  // gasToken
                new Address("0x0000000000000000000000000000000000000000"),  // refundReceiver
                new DynamicBytes(signature != null
                    ? Numeric.hexStringToByteArray(signature)
                    : new byte[0])
            ),
            List.of(new TypeReference<Bool>() {})
        );

        return FunctionEncoder.encode(function);
    }

    /**
     * Encodes a call for the 4337 module's executeUserOp.
     *
     * @param to Destination address
     * @param value ETH value
     * @param data Call data
     * @param operation Operation type
     * @return Encoded call data for 4337 module
     */
    public String encodeExecuteUserOp(
            String to,
            BigInteger value,
            String data,
            Operation operation) {

        Function function = new Function(
            "executeUserOp",
            List.of(
                new Address(to),
                new Uint256(value),
                new DynamicBytes(Numeric.hexStringToByteArray(data)),
                new Uint8(operation.getValue())
            ),
            List.of()
        );

        return FunctionEncoder.encode(function);
    }

    /**
     * Encodes multiple calls as a batch using multiSend.
     *
     * @param calls List of calls to batch
     * @return Encoded multiSend call data
     */
    public String encodeBatchCalls(List<SafeCall> calls) {
        // Pack transactions for multiSend
        byte[] packed = packTransactions(calls);

        Function function = new Function(
            "multiSend",
            List.of(new DynamicBytes(packed)),
            List.of()
        );

        return FunctionEncoder.encode(function);
    }

    /**
     * Computes the Safe transaction hash for signing.
     *
     * @param to Destination address
     * @param value ETH value
     * @param data Call data
     * @param operation Operation type
     * @param nonce Safe nonce
     * @return Safe transaction hash
     */
    public byte[] getSafeTransactionHash(
            String to,
            BigInteger value,
            String data,
            Operation operation,
            BigInteger nonce) {

        // EIP-712 domain separator
        byte[] domainSeparator = computeDomainSeparator();

        // Struct hash
        byte[] structHash = computeStructHash(to, value, data, operation, nonce);

        // Final hash: keccak256("\x19\x01" + domainSeparator + structHash)
        byte[] encoded = new byte[2 + 32 + 32];
        encoded[0] = 0x19;
        encoded[1] = 0x01;
        System.arraycopy(domainSeparator, 0, encoded, 2, 32);
        System.arraycopy(structHash, 0, encoded, 34, 32);

        return Hash.sha3(encoded);
    }

    /**
     * Signs a Safe transaction hash.
     *
     * @param safeTransactionHash The hash to sign
     * @return Encoded signature (65 bytes)
     */
    public String signSafeTransaction(byte[] safeTransactionHash) {
        Sign.SignatureData sigData = Sign.signMessage(safeTransactionHash, owner.getEcKeyPair(), false);

        // Encode as r + s + v (65 bytes)
        byte[] signature = new byte[65];
        System.arraycopy(sigData.getR(), 0, signature, 0, 32);
        System.arraycopy(sigData.getS(), 0, signature, 32, 32);
        signature[64] = sigData.getV()[0];

        // Adjust v for EIP-155 if needed
        if (signature[64] < 27) {
            signature[64] += 27;
        }

        return Numeric.toHexString(signature);
    }

    /**
     * Creates init code for deploying a new Safe with 4337 module.
     *
     * @param owners List of owner addresses
     * @param threshold Signature threshold
     * @param saltNonce Salt for deterministic address
     * @return Init code for UserOperation
     */
    public String createInitCode(List<String> owners, int threshold, BigInteger saltNonce) {
        // Setup data for Safe initialization
        String setupData = encodeSetup(owners, threshold);

        // Create proxy function
        Function createProxy = new Function(
            "createProxyWithNonce",
            List.of(
                new Address(singleton),
                new DynamicBytes(Numeric.hexStringToByteArray(setupData)),
                new Uint256(saltNonce)
            ),
            List.of(new TypeReference<Address>() {})
        );

        String createProxyData = FunctionEncoder.encode(createProxy);

        // Init code = factory address + createProxy call
        return SAFE_PROXY_FACTORY + createProxyData.substring(2);
    }

    /**
     * Computes the counterfactual Safe address.
     *
     * @param owners List of owner addresses
     * @param threshold Signature threshold
     * @param saltNonce Salt for deterministic address
     * @return Predicted Safe address
     */
    public String computeAddress(List<String> owners, int threshold, BigInteger saltNonce) {
        String setupData = encodeSetup(owners, threshold);
        byte[] setupHash = Hash.sha3(Numeric.hexStringToByteArray(setupData));

        // CREATE2 address calculation
        // address = keccak256(0xff + factory + salt + keccak256(initCode))[12:]

        // Salt = keccak256(setupHash + saltNonce)
        byte[] saltInput = new byte[64];
        System.arraycopy(setupHash, 0, saltInput, 0, 32);
        byte[] nonceBytes = Numeric.toBytesPadded(saltNonce, 32);
        System.arraycopy(nonceBytes, 0, saltInput, 32, 32);
        byte[] salt = Hash.sha3(saltInput);

        // Proxy bytecode hash (Safe proxy creation code)
        byte[] proxyBytecodeHash = getProxyBytecodeHash();

        // CREATE2: 0xff + factory + salt + bytecodeHash
        byte[] create2Input = new byte[1 + 20 + 32 + 32];
        create2Input[0] = (byte) 0xff;
        System.arraycopy(Numeric.hexStringToByteArray(SAFE_PROXY_FACTORY), 0, create2Input, 1, 20);
        System.arraycopy(salt, 0, create2Input, 21, 32);
        System.arraycopy(proxyBytecodeHash, 0, create2Input, 53, 32);

        byte[] addressHash = Hash.sha3(create2Input);
        byte[] address = new byte[20];
        System.arraycopy(addressHash, 12, address, 0, 20);

        return Numeric.toHexString(address);
    }

    // Helper methods

    private byte[] computeDomainSeparator() {
        // EIP-712 domain: keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
        byte[] typeHash = Hash.sha3(
            "EIP712Domain(uint256 chainId,address verifyingContract)".getBytes(StandardCharsets.UTF_8));

        byte[] encoded = new byte[32 + 32 + 32];
        System.arraycopy(typeHash, 0, encoded, 0, 32);
        System.arraycopy(Numeric.toBytesPadded(BigInteger.valueOf(chainId), 32), 0, encoded, 32, 32);
        byte[] addrBytes = Numeric.hexStringToByteArray(safeAddress);
        System.arraycopy(Numeric.toBytesPadded(new BigInteger(1, addrBytes), 32), 0, encoded, 64, 32);

        return Hash.sha3(encoded);
    }

    private byte[] computeStructHash(
            String to,
            BigInteger value,
            String data,
            Operation operation,
            BigInteger nonce) {
        // SafeTx type hash
        byte[] typeHash = Hash.sha3(
            ("SafeTx(address to,uint256 value,bytes data,uint8 operation,"
            + "uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,"
            + "address gasToken,address refundReceiver,uint256 nonce)").getBytes(StandardCharsets.UTF_8));

        byte[] dataHash = Hash.sha3(Numeric.hexStringToByteArray(data));

        // Encode struct
        byte[] encoded = new byte[32 * 11];
        int offset = 0;

        System.arraycopy(typeHash, 0, encoded, offset, 32);
        offset += 32;

        byte[] toBytes = Numeric.hexStringToByteArray(to);
        System.arraycopy(Numeric.toBytesPadded(new BigInteger(1, toBytes), 32), 0, encoded, offset, 32);
        offset += 32;

        System.arraycopy(Numeric.toBytesPadded(value, 32), 0, encoded, offset, 32);
        offset += 32;

        System.arraycopy(dataHash, 0, encoded, offset, 32);
        offset += 32;

        System.arraycopy(Numeric.toBytesPadded(BigInteger.valueOf(operation.getValue()), 32), 0, encoded, offset, 32);
        offset += 32;

        // safeTxGas, baseGas, gasPrice = 0
        offset += 32 * 3;

        // gasToken, refundReceiver = address(0)
        offset += 32 * 2;

        System.arraycopy(Numeric.toBytesPadded(nonce, 32), 0, encoded, offset, 32);

        return Hash.sha3(encoded);
    }

    private String encodeSetup(List<String> owners, int threshold) {
        List<Address> ownerAddresses = new ArrayList<>();
        for (String owner : owners) {
            ownerAddresses.add(new Address(owner));
        }

        // Enable 4337 module
        String enableModuleData = FunctionEncoder.encode(new Function(
            "enableModule",
            List.of(new Address(module4337)),
            List.of()
        ));

        Function setup = new Function(
            "setup",
            List.of(
                new org.web3j.abi.datatypes.DynamicArray<>(Address.class, ownerAddresses),
                new Uint256(threshold),
                new Address(safeAddress != null ? safeAddress : "0x0000000000000000000000000000000000000000"),
                new DynamicBytes(Numeric.hexStringToByteArray(enableModuleData)),
                new Address(SAFE_FALLBACK_HANDLER),
                new Address("0x0000000000000000000000000000000000000000"),
                new Uint256(BigInteger.ZERO),
                new Address("0x0000000000000000000000000000000000000000")
            ),
            List.of()
        );

        return FunctionEncoder.encode(setup);
    }

    private byte[] packTransactions(List<SafeCall> calls) {
        List<byte[]> packed = new ArrayList<>();
        int totalLength = 0;

        for (SafeCall call : calls) {
            byte[] data = Numeric.hexStringToByteArray(call.getData());
            // operation (1) + to (20) + value (32) + dataLength (32) + data
            int length = 1 + 20 + 32 + 32 + data.length;
            byte[] txPacked = new byte[length];

            txPacked[0] = (byte) call.getOperation().getValue();

            byte[] toBytes = Numeric.hexStringToByteArray(call.getTo());
            System.arraycopy(toBytes, 0, txPacked, 1, 20);

            byte[] valueBytes = Numeric.toBytesPadded(call.getValue(), 32);
            System.arraycopy(valueBytes, 0, txPacked, 21, 32);

            byte[] lengthBytes = Numeric.toBytesPadded(BigInteger.valueOf(data.length), 32);
            System.arraycopy(lengthBytes, 0, txPacked, 53, 32);

            System.arraycopy(data, 0, txPacked, 85, data.length);

            packed.add(txPacked);
            totalLength += length;
        }

        byte[] result = new byte[totalLength];
        int offset = 0;
        for (byte[] tx : packed) {
            System.arraycopy(tx, 0, result, offset, tx.length);
            offset += tx.length;
        }

        return result;
    }

    private byte[] getProxyBytecodeHash() {
        // Safe proxy creation code hash (depends on singleton)
        // This is a simplified version - in production, fetch from chain
        String creationCode = "0x608060405234801561001057600080fd5b5060405161017138038061017183398101604081905261002f91610054565b600080546001600160a01b0319166001600160a01b0392909216919091179055610084565b60006020828403121561006657600080fd5b81516001600160a01b038116811461007d57600080fd5b9392505050565b60df806100926000396000f3fe";
        return Hash.sha3(Numeric.hexStringToByteArray(creationCode + singleton.substring(2)));
    }

    /**
     * Builder for SafeAccount.
     */
    public static class Builder {
        private String safeAddress;
        private Credentials owner;
        private long chainId = 1;
        private String singleton = SAFE_SINGLETON_141;
        private String module4337 = SAFE_4337_MODULE;

        public Builder safeAddress(String safeAddress) {
            this.safeAddress = safeAddress;
            return this;
        }

        public Builder owner(Credentials owner) {
            this.owner = owner;
            return this;
        }

        public Builder chainId(long chainId) {
            this.chainId = chainId;
            return this;
        }

        public Builder singleton(String singleton) {
            this.singleton = singleton;
            return this;
        }

        public Builder module4337(String module4337) {
            this.module4337 = module4337;
            return this;
        }

        public SafeAccount build() {
            if (owner == null) {
                throw new IllegalArgumentException("owner is required");
            }
            return new SafeAccount(this);
        }
    }

    /**
     * Creates a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }
}

package io.t402.schemes.evm;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * EIP-712 type definitions and utilities for the Exact EVM scheme.
 *
 * <p>Provides type definitions for EIP-3009 TransferWithAuthorization signing,
 * EIP-712 domain construction, and payload serialization/deserialization.</p>
 */
public final class EvmTypes {

    private EvmTypes() {
        // Utility class
    }

    /**
     * Represents a field in an EIP-712 typed data structure.
     */
    public static class TypedDataField {
        /** Field name. */
        public final String name;
        /** Solidity type. */
        public final String type;

        /**
         * Creates a new TypedDataField.
         *
         * @param name field name
         * @param type solidity type (e.g., "address", "uint256", "bytes32")
         */
        public TypedDataField(String name, String type) {
            this.name = name;
            this.type = type;
        }

        /**
         * Converts field to a map representation.
         *
         * @return map with "name" and "type" entries
         */
        public Map<String, String> toMap() {
            Map<String, String> map = new HashMap<>();
            map.put("name", name);
            map.put("type", type);
            return map;
        }
    }

    // ============================================================
    // EIP-712 Type Definitions
    // ============================================================

    /** EIP-712 domain type fields. */
    public static final List<TypedDataField> DOMAIN_TYPE_FIELDS = List.of(
        new TypedDataField("name", "string"),
        new TypedDataField("version", "string"),
        new TypedDataField("chainId", "uint256"),
        new TypedDataField("verifyingContract", "address")
    );

    /** EIP-3009 TransferWithAuthorization type fields. */
    public static final List<TypedDataField> TRANSFER_WITH_AUTHORIZATION_FIELDS = List.of(
        new TypedDataField("from", "address"),
        new TypedDataField("to", "address"),
        new TypedDataField("value", "uint256"),
        new TypedDataField("validAfter", "uint256"),
        new TypedDataField("validBefore", "uint256"),
        new TypedDataField("nonce", "bytes32")
    );

    /** Primary type name for TransferWithAuthorization. */
    public static final String PRIMARY_TYPE = "TransferWithAuthorization";

    // ============================================================
    // Factory Methods
    // ============================================================

    /**
     * Gets the EIP-712 types map for TransferWithAuthorization signing.
     *
     * @return map of type name to list of field definitions
     */
    public static Map<String, List<Map<String, String>>> getTransferAuthTypes() {
        Map<String, List<Map<String, String>>> types = new HashMap<>();
        types.put("EIP712Domain", DOMAIN_TYPE_FIELDS.stream()
            .map(TypedDataField::toMap)
            .toList());
        types.put(PRIMARY_TYPE, TRANSFER_WITH_AUTHORIZATION_FIELDS.stream()
            .map(TypedDataField::toMap)
            .toList());
        return types;
    }

    /**
     * Creates an EIP-712 domain for TransferWithAuthorization signing.
     *
     * @param name      token name (e.g., "TetherToken")
     * @param version   domain version (e.g., "1")
     * @param chainId   numeric chain ID
     * @param tokenAddress token contract address (verifying contract)
     * @return map representing the EIP-712 domain
     */
    public static Map<String, Object> createDomain(String name, String version,
            long chainId, String tokenAddress) {
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", name);
        domain.put("version", version);
        domain.put("chainId", chainId);
        domain.put("verifyingContract", tokenAddress);
        return domain;
    }

    /**
     * Creates an EIP-712 message for TransferWithAuthorization signing.
     *
     * @param authorization the authorization parameters
     * @return map representing the EIP-712 message
     */
    public static Map<String, Object> createTransferAuthMessage(EvmAuthorization authorization) {
        Map<String, Object> message = new HashMap<>();
        message.put("from", authorization.getFrom());
        message.put("to", authorization.getTo());
        message.put("value", new BigInteger(authorization.getValue()));
        message.put("validAfter", new BigInteger(String.valueOf(authorization.getValidAfter())));
        message.put("validBefore", new BigInteger(String.valueOf(authorization.getValidBefore())));
        message.put("nonce", authorization.getNonce());
        return message;
    }

    /**
     * Checks if the given payload data represents a valid EIP-3009
     * TransferWithAuthorization payload.
     *
     * <p>A valid payload has a string signature and an authorization object
     * with from, to, value, validAfter, validBefore, and nonce fields.</p>
     *
     * @param data map containing payload data
     * @return true if the data is a valid EIP-3009 payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isTransferAuthPayload(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        Object sig = data.get("signature");
        Object auth = data.get("authorization");

        if (sig == null || auth == null) {
            return false;
        }

        // Signature should be a string (0x-prefixed hex)
        if (!(sig instanceof String)) {
            return false;
        }

        // Authorization should be a map with required fields
        if (!(auth instanceof Map)) {
            return false;
        }
        Map<String, Object> authMap = (Map<String, Object>) auth;
        return authMap.containsKey("from")
            && authMap.containsKey("to")
            && authMap.containsKey("value")
            && authMap.containsKey("validAfter")
            && authMap.containsKey("validBefore")
            && authMap.containsKey("nonce");
    }
}
